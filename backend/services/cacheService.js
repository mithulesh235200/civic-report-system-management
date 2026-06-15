const cacheStore = new Map();

const now = () => Date.now();

const get = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now()) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value;
};

const set = (key, value, ttlMs = 30000) => {
  cacheStore.set(key, {
    value,
    expiresAt: now() + ttlMs,
  });

  return value;
};

const getOrSet = async (key, ttlMs, factory) => {
  const cached = get(key);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  return set(key, value, ttlMs);
};

const invalidate = (key) => {
  cacheStore.delete(key);
};

const invalidatePrefix = (prefix) => {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};

module.exports = {
  get,
  set,
  getOrSet,
  invalidate,
  invalidatePrefix,
};
