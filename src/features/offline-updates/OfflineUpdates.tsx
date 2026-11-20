import { useCallback, useEffect, useState } from "react";

const APP_SHELL_VERSION = "v1";

type UpdateState = "checking" | "ready" | "waiting" | "installing" | "offline" | "unsupported" | "error";

export function OfflineUpdates() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [state, setState] = useState<UpdateState>("checking");
  const [detail, setDetail] = useState("Checking whether this browser can prepare an offline app shell.");
  const [online, setOnline] = useState(navigator.onLine);
  const [lastChecked, setLastChecked] = useState<string>("Not checked yet");
  const [reloadOnControllerChange, setReloadOnControllerChange] = useState(false);

  const renderRegistration = useCallback((value: ServiceWorkerRegistration) => {
    setRegistration(value);
    if (!navigator.onLine) {
      setState("offline");
      setDetail(navigator.serviceWorker.controller
        ? "The cached app shell can open without an internet connection."
        : "The first offline cache has not finished installing. Connect once and keep this page open.");
    } else if (value.waiting) {
      setState("waiting");
      setDetail("A newer version is downloaded and waiting. Install it when you are ready.");
    } else if (value.installing) {
      setState("installing");
      setDetail("New app files are being cached. Keep this page open until installation finishes.");
    } else if (navigator.serviceWorker.controller) {
      setState("ready");
      setDetail("The app shell is cached on this device. You can reopen it while offline.");
    } else {
      setState("checking");
      setDetail("Preparing offline access for the first visit.");
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") {
      setState("unsupported");
      setDetail("This browser or page context does not support service workers.");
      return;
    }

    let active = true;
    const onOnline = () => { setOnline(true); if (registration) renderRegistration(registration); };
    const onOffline = () => { setOnline(false); if (registration) renderRegistration(registration); };
    const onControllerChange = () => {
      if (reloadOnControllerChange) location.reload();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then(value => {
        if (!active) return;
        setRegistration(value);
        const watch = (worker: ServiceWorker | null) => {
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && active) renderRegistration(value);
            if (worker.state === "redundant" && active) {
              setState("error");
              setDetail("The browser rejected the new app cache. Your existing app and local library were not cleared.");
            }
          });
        };
        value.addEventListener("updatefound", () => {
          watch(value.installing);
          renderRegistration(value);
        });
        watch(value.installing);
        renderRegistration(value);
        void value.update().catch(() => undefined);
      })
      .catch(error => {
        if (!active) return;
        setState("error");
        setDetail(error instanceof Error ? error.message : "Offline setup could not start.");
      });

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [reloadOnControllerChange, registration, renderRegistration]);

  const checkForUpdates = async () => {
    if (!navigator.onLine) {
      setState("offline");
      setDetail("Connect to the internet to check for a newer deployment. The currently cached app remains available.");
      return;
    }
    if (!registration) return;
    setState("checking");
    setDetail("Contacting the website and checking its published service-worker version.");
    try {
      await registration.update();
      renderRegistration(registration);
      if (!registration.waiting && !registration.installing) {
        setState("ready");
        setDetail("This browser already has the latest service worker published on the website.");
      }
      setLastChecked(new Date().toLocaleString());
    } catch (error) {
      setState("error");
      setDetail(error instanceof Error ? error.message : "Could not check for updates. Your current cached app is unchanged.");
    }
  };

  const installUpdate = () => {
    if (!registration?.waiting) return;
    setReloadOnControllerChange(true);
    setState("installing");
    setDetail("Installing the update. Quiet Reader will reload when the new version takes control. Local browser data is not cleared.");
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const status = {
    checking: "Checking offline support…",
    ready: "Offline app is ready",
    waiting: "An update is ready",
    installing: "Preparing / installing update",
    offline: "You are offline",
    unsupported: "Offline support unavailable",
    error: "Could not complete offline setup"
  }[state];

  return (
    <section className="offline-panel" aria-labelledby="offline-title">
      <div className="offline-heading">
        <div>
          <p className="eyebrow">DEVICE UPDATE CONTROL</p>
          <h2 id="offline-title">Offline access & updates</h2>
        </div>
        <span className={online ? "connection online" : "connection offline"}>{online ? "Online" : "Offline"}</span>
      </div>
      <strong aria-live="polite">{status}</strong>
      <p className="offline-detail" aria-live="polite">{detail}</p>
      <div className="offline-actions">
        <button type="button" onClick={checkForUpdates} disabled={!online || !registration || state === "checking"}>
          Check for updates
        </button>
        <button type="button" className="install-button" onClick={installUpdate} disabled={!registration?.waiting}>
          Install update & reload
        </button>
      </div>
      <div className="offline-meta">
        <span>Offline shell {APP_SHELL_VERSION}</span>
        <span>{lastChecked === "Not checked yet" ? lastChecked : "Last checked: " + lastChecked}</span>
      </div>
      <div className="divider" />
      <h3>Local data stays local</h3>
      <p className="offline-detail">Installing an app update replaces cached application files only. It does not clear or recreate IndexedDB, localStorage, books, chapters, images, notes, bookmarks, highlights or reading progress.</p>
      <p className="offline-warning">The first visit must be online. Browser-level “Clear site data” still removes local data, so keep a separate backup.</p>
    </section>
  );
}
