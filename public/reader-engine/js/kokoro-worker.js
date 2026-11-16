// Experimental WebGPU Kokoro inference worker.
// Uses a graph-patched equivalent of Kokoro-82M because the upstream ONNX
// ConvTranspose graph can produce invalid audio with ONNX Runtime WebGPU.
const MODEL_ID = 'dev-amarnadh-gandham/Kokoro-82M-v1.0-ONNX-webgpu';
const VOICE_ASSET_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
let enginePromise = null;
let engine = null;
let queue = Promise.resolve();

function send(message, transfer = []) {
  self.postMessage(message, transfer);
}

async function loadModel() {
  if (engine) return engine;
  if (!enginePromise) {
    enginePromise = (async () => {
      send({ type: 'status', message: 'Checking WebGPU support…' });
      if (!self.navigator?.gpu) {
        throw new Error('WebGPU is unavailable in this browser/worker. Try current Chrome or Edge with hardware acceleration enabled.');
      }
      const adapter = await self.navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('WebGPU is present, but the browser could not provide a GPU adapter.');
      send({ type: 'status', message: 'Loading Kokoro WebGPU runtime…' });
      const { KokoroTTS } = await import(MODULE_URL);
      send({ type: 'status', message: 'Downloading / loading Kokoro WebGPU model…' });
      engine = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'fp32',
        device: 'webgpu',
        progress_callback: progress => {
          if (progress?.status === 'progress') {
            const pct = progress.total ? Math.round(progress.loaded / progress.total * 100) : null;
            send({ type: 'status', message: pct == null ? 'Downloading WebGPU model…' : 'Downloading WebGPU model… ' + pct + '%' });
          } else if (progress?.status === 'done') {
            send({ type: 'status', message: 'WebGPU model files ready…' });
          }
        }
      });
      send({ type: 'ready', backend: 'webgpu', model: MODEL_ID, voiceAssets: VOICE_ASSET_MODEL_ID });
      return engine;
    })().catch(error => {
      enginePromise = null;
      engine = null;
      throw error;
    });
  }
  return enginePromise;
}

self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'load') {
    queue = queue.then(() => loadModel()).then(
      () => send({ type: 'loaded', id: message.id, backend: 'webgpu' }),
      error => send({ type: 'error', id: message.id, message: error?.message || String(error) })
    );
    return;
  }
  if (message.type !== 'generate') return;
  queue = queue.then(async () => {
    const tts = await loadModel();
    const started = performance.now();
    const result = await tts.generate(message.text, { voice: message.voice, speed: message.speed ?? 1 });
    const inferenceMs = performance.now() - started;
    const samples = result.audio;
    if (!samples?.length) throw new Error('Kokoro returned empty audio');
    const sampleRate = result.sampling_rate || 24000;
    const audioSeconds = samples.length / sampleRate;
    const realTimeFactor = audioSeconds > 0 ? inferenceMs / 1000 / audioSeconds : null;
    const transferable = new Float32Array(samples);
    send({
      type: 'audio',
      id: message.id,
      samples: transferable.buffer,
      sampleRate,
      inferenceMs,
      audioSeconds,
      realTimeFactor,
      backend: 'webgpu'
    }, [transferable.buffer]);
  }).catch(error => {
    send({ type: 'error', id: message.id, message: error?.message || String(error) });
  });
};
