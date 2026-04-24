class TTLCache {
  constructor({ defaultTtlMs, metrics, maxEntries = 1200 }) {
    this.defaultTtlMs = defaultTtlMs;
    this.metrics = metrics;
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.pending = new Map();
    this.lastCleanupAt = 0;
  }

  cleanupExpired(force = false) {
    const now = Date.now();
    if (!force && now - this.lastCleanupAt < 30_000 && this.store.size < this.maxEntries) {
      return;
    }

    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt <= now) {
        this.store.delete(key);
      }
    }

    this.lastCleanupAt = now;

    if (this.store.size > this.maxEntries) {
      this.evictOverflow();
    }
  }

  evictOverflow() {
    const overflow = this.store.size - this.maxEntries;
    if (overflow <= 0) {
      return;
    }

    const entries = [...this.store.entries()].sort(
      (left, right) => left[1].expiresAt - right[1].expiresAt
    );

    for (let index = 0; index < overflow; index += 1) {
      this.store.delete(entries[index][0]);
    }
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.metrics.inc('cache_misses_total');
      return null;
    }

    if (item.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.metrics.inc('cache_misses_total');
      return null;
    }

    this.metrics.inc('cache_hits_total');
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.cleanupExpired();
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
    if (this.store.size > this.maxEntries) {
      this.evictOverflow();
    }
    return value;
  }

  delete(key) {
    this.store.delete(key);
    this.pending.delete(key);
  }

  async wrap(key, producer, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const pending = Promise.resolve()
      .then(() => producer())
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, pending);
    return pending;
  }
}

module.exports = {
  TTLCache
};
