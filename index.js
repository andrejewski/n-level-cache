'use strict';

class NLevelCache {
  constructor(options = {}) {
    const {caches, compute, isValue, hydrate, keyForQuery} = options;
    this.caches = caches || [];
    this.readers = caches.map(cache => cache.get);
    this.writers = caches.map(cache => cache.set).reverse();
    this.compute = compute || (() => Promise.resolve(null));
    this.isValue = isValue || (x => x !== null && x !== void 0);
    this.hydrate = hydrate || true;
    this.keyForQuery = keyForQuery || (x => x);
  }

  get(query, options) {
    const key = this.keyForQuery(query);
    return this._getCaches(this.readers, key, options).then(({value, index}) => {
      if (this.hydrate) {
        const len = this.writers.length;
        const isCacheValue = index < len;
        if (isCacheValue) {
          const writers = this.writers.slice(len - index);
          return this._setCaches(writers, key, value, options);
        }
      }
      if (this.isValue(value)) return value;
      return this.set(query, options, key);
    });
  }

  _getCaches(readers, key, options) {
    let index = -1;
    const next = value => {
      if (index !== -1 && this.isValue(value)) return {value, index};
      if (++index >= readers.length) return {value, index};
      return readers[index](key, options).then(next);
    }
    return Promise.resolve(void 0).then(next);
  }

  set(query, options, key) {
    return this.compute(query, options).then(value => {
      key = key || this.keyForQuery(query);
      return this._setCaches(this.writers, key, value, options);
    });
  }

  _setCaches(writers, key, value, options) {
    let index = 0;
    function next() {
      if (index >= writers.length) return value;
      return writers[index++](key, value, options).then(next);
    }
    return Promise.resolve(value).then(next);
  }
}

module.exports = NLevelCache;
