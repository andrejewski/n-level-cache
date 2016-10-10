'use strict';

const nothing = () => Promise.resolve(null);
const identity = x => x;
const empty = x => x === null || x === void 0;

class CacheValue {
  constructor(options) {
    this.cacheIndex = options.cacheIndex || 0;
    this.value = options.value;
  }

  getCacheIndex() {
    return this.cacheIndex;
  }

  getValue() {
    return this.value;
  }
}

function promiseUntil(predicate, funcs, args, cacheIndex) {
  cacheIndex = cacheIndex || 0;
  const func = funcs[cacheIndex];
  if (!func) return Promise.resolve();
  return func.apply(null, args)
    .then(value => {
      if (predicate(value)) {
        return new CacheValue({
          cacheIndex,
          value
        });
      }
      return promiseUntil(predicate, funcs, args, cacheIndex + 1);
    });
}

function readCaches(readers, key, options) {
  const firstFound = x => x;
  return promiseUntil(firstFound, readers, [key, options]);
}

function writeCaches(writers, key, cacheValue, options) {
  let promise = Promise.resolve();

  function buildCacheValue(i) {
    let writer = writers[i](key, cacheValue.getValue(), options);
    return writer.then((value) => new CacheValue({
      cacheIndex: i,
      value: value
    }));
  }

  if (cacheValue.getCacheIndex()) {
    let length = writers.length;
    for (let i = length - cacheValue.getCacheIndex(); i < length; i++) {
      promise = promise.then(() => buildCacheValue(i));
    }
  } else {
    for (let i = 0; i < writers.length; i++) {
      promise = promise.then(() => buildCacheValue(i));
    }
  }

  return promise;
}

class NLevelCache {
  constructor(options) {
    this.caches = options.caches || [];
    this.readers = this.caches.map(cache => cache.get);
    this.writers = [].concat(this.caches).reverse().map(cache => cache.set);
    this.compute = options.compute || nothing;
    this.keyForQuery = options.keyForQuery || identity;
    this.shouldWrite = options.shouldWrite || empty;
  }

  get(query, options) {
    options = options || {};

    const key = this.keyForQuery(query);
    return readCaches(this.readers, key, options).then(cacheValue => {
      let value = cacheValue && cacheValue.getValue();

      if (!this.shouldWrite(cacheValue)) return value;

      options._cacheValue = cacheValue;
      return this.set(query, options, key);
    });
  }

  set(query, options, key) {
    let promise;
    let cacheValue;

    if (options && (cacheValue = options._cacheValue)) {
      promise = Promise.resolve(cacheValue);
    } else {
      promise = Promise.resolve(this.compute(query, options)
        .then(value => new CacheValue({ value })));
    }

    return promise.then(cacheValue => {
      key = key || this.keyForQuery(query);
      return writeCaches(this.writers, key, cacheValue, options)
        .then(() => cacheValue.getValue());
    });
  }
}

module.exports = NLevelCache;
