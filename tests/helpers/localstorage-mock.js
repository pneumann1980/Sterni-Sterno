/**
 * Minimal in-memory localStorage mock for Node-based tests.
 * Install BEFORE instantiating TrophyManager (module import itself is safe —
 * trophies.js only touches localStorage inside the constructor / mutations).
 */
export function installLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem:    (k)    => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k)    => { store.delete(k); },
    clear:      ()     => { store.clear(); },
    _dump:      ()     => Object.fromEntries(store),
  };
  return globalThis.localStorage;
}
