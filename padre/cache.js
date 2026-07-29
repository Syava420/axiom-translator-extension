class LRUCache {
  constructor(maxSize = CONFIG.CACHE.MAX_MEMORY_ENTRIES) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.pendingWrites = new Map();
    this.writeScheduled = false;
    this.storageLoaded = false;
    this._flushing = false;
  }

  async loadFromStorage() {
    try {

      const currentVersion = chrome.runtime.getManifest?.()?.version || '0';
      const versionKey = CONFIG.CACHE.STORAGE_KEY + '_version';
      const versionData = await chrome.storage.local.get(versionKey);
      const storedVersion = versionData[versionKey];

      if (storedVersion && storedVersion !== currentVersion) {
        await chrome.storage.local.remove(CONFIG.CACHE.STORAGE_KEY);
        await chrome.storage.local.set({ [versionKey]: currentVersion });
        this.storageLoaded = true;
        return;
      }

      if (!storedVersion) {
        await chrome.storage.local.set({ [versionKey]: currentVersion });
      }

      const data = await chrome.storage.local.get(CONFIG.CACHE.STORAGE_KEY);
      const stored = data[CONFIG.CACHE.STORAGE_KEY];
      if (stored && typeof stored === 'object') {
        const entries = Object.entries(stored);

        const toLoad = entries.slice(-this.maxSize);
        for (const [key, value] of toLoad) {
          if (value && !/QUERY.LENGTH|LIMIT.EXCEEDED|MAX.ALLOWED/i.test(value)) {
            this.cache.set(key, value);
          }
        }
      }
    } catch (err) {
    }
    this.storageLoaded = true;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    if (/QUERY.LENGTH|LIMIT.EXCEEDED|MAX.ALLOWED/i.test(value)) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (!value || /QUERY.LENGTH|LIMIT.EXCEEDED|MAX.ALLOWED/i.test(value)) return;
    if (this.cache.has(key)) this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
    this.schedulePersist(key, value);
  }

  get size() {
    return this.cache.size;
  }

  async clear() {
    this.cache.clear();
    this.pendingWrites.clear();
    try {
      await chrome.storage.local.remove(CONFIG.CACHE.STORAGE_KEY);
    } catch (err) {
    }
  }

  schedulePersist(key, value) {
    this.pendingWrites.set(key, value);
    if (!this.writeScheduled) {
      this.writeScheduled = true;
      setTimeout(() => this.flushToStorage(), CONFIG.CACHE.PERSIST_DEBOUNCE_MS);
    }
  }

  async flushToStorage() {
    if (this.pendingWrites.size === 0) {
      this.writeScheduled = false;
      return;
    }

    if (!chrome.runtime?.id) {
      this.pendingWrites.clear();
      this.writeScheduled = false;
      return;
    }

    if (this._flushing) {
      if (!this.writeScheduled) {
        this.writeScheduled = true;
        setTimeout(() => this.flushToStorage(), CONFIG.CACHE.PERSIST_DEBOUNCE_MS);
      }
      return;
    }

    const batch = new Map(this.pendingWrites);
    this.pendingWrites.clear();
    this.writeScheduled = false;
    this._flushing = true;

    try {
      const data = await chrome.storage.local.get(CONFIG.CACHE.STORAGE_KEY);
      const existing = data[CONFIG.CACHE.STORAGE_KEY] || {};

      for (const [key, value] of batch) {
        existing[key] = value;
      }

      const entries = Object.entries(existing);
      let toStore = existing;
      if (entries.length > CONFIG.CACHE.MAX_STORAGE_ENTRIES) {
        toStore = Object.fromEntries(
          entries.slice(entries.length - CONFIG.CACHE.MAX_STORAGE_ENTRIES)
        );
      }

      try {
        await chrome.storage.local.set({ [CONFIG.CACHE.STORAGE_KEY]: toStore });
      } catch (quotaErr) {
        if (quotaErr.message?.includes('QUOTA') || quotaErr.message?.includes('quota')) {
          const halfMax = Math.floor(CONFIG.CACHE.MAX_STORAGE_ENTRIES * 0.5);
          const trimmed = Object.fromEntries(
            Object.entries(toStore).slice(-halfMax)
          );
          await chrome.storage.local.set({ [CONFIG.CACHE.STORAGE_KEY]: trimmed });
        } else {
          throw quotaErr;
        }
      }
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) return;
    } finally {
      this._flushing = false;
    }
  }
}
