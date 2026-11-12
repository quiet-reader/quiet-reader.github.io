export function AppShell() {
  return (
    <main className="app-shell">
      <section className="migration-card" aria-labelledby="app-title">
        <p className="eyebrow">QUIET READER · VITE + REACT + TYPESCRIPT</p>
        <h1 id="app-title">The new foundation.</h1>
        <span className="migration-status">Migration in progress · not production-ready</span>
        <p>
          This branch establishes the new client-side architecture. The existing
          Quiet Reader remains the source of truth until feature parity and
          backup-restoration tests are complete.
        </p>
        <div className="divider" />
        <strong>Data preservation is the first release gate.</strong>
        <ul>
          <li>Keep the existing <code>quietbook-v2</code> IndexedDB database and records readable.</li>
          <li>Preserve ZIP backups and legacy QuietBookBackup JSON versions 2 and 3.</li>
          <li>Migrate features incrementally without changing their user-visible behaviour.</li>
        </ul>
      </section>
    </main>
  );
}