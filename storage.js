/*
 * storage.js
 * ----------
 * A tiny storage layer with the same shape as Claude's artifact `window.storage`
 * API (get/set/delete/list), backed by localStorage instead.
 *
 * IMPORTANT LIMITATION: localStorage is per-browser, per-device. Two different
 * people (or the same person on two devices) will NOT see each other's scores.
 * "Shared" data here just means "not namespaced under a session" — it still
 * only lives in this one browser.
 *
 * To upgrade to a REAL cross-device leaderboard later, replace the functions
 * below with calls to a backend (Firebase Firestore, Supabase, a small REST
 * API, etc.) — keep the same function names/signatures and nothing else in
 * app.js needs to change.
 */

const LS_PREFIX = 'rtd:'; // read-the-defense namespace, avoids clobbering other localStorage keys

const storage = {
  async get(key, shared) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw === null) return null;
      return { key, value: raw, shared: !!shared };
    } catch (e) {
      return null;
    }
  },

  async set(key, value, shared) {
    try {
      localStorage.setItem(LS_PREFIX + key, value);
      return { key, value, shared: !!shared };
    } catch (e) {
      return null;
    }
  },

  async delete(key, shared) {
    try {
      localStorage.removeItem(LS_PREFIX + key);
      return { key, deleted: true, shared: !!shared };
    } catch (e) {
      return null;
    }
  },

  async list(prefix, shared) {
    try {
      const keys = [];
      const fullPrefix = LS_PREFIX + (prefix || '');
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          keys.push(k.slice(LS_PREFIX.length));
        }
      }
      return { keys, prefix, shared: !!shared };
    } catch (e) {
      return { keys: [], prefix, shared: !!shared };
    }
  }
};

// Exposed as window.storage so app.js can use the exact same calls the
// Claude-artifact version used.
window.storage = storage;
