'use strict';

const noCaches = [];
const nothing = () => Promise.resolve(null);
const identity = x => x;
const empty = x => x === null || x === void 0;

function promiseUntil(predicate, funcs, args, index) {
  index = index || 0;
  const func = funcs[index];
  if (!func) return Promise.resolve();
  return func.apply(null, args)
    .then(value => {
      if (predicate(value)) {
        return value;
      }
      return promiseUntil(predicate, funcs, args, index + 1);
    });
}

function readCaches(caches, key, options) {
  const readers = caches.map(cache => cache.get);
  const firstFound = x => x;
  return promiseUntil(firstFound, readers, [key, options]);
}

function writeCaches(caches, key, value, options) {
  const writers = caches.reverse().map(cache => cache.set);
  const never = () => false;
  return promiseUntil(never, writers, [key, value, options]);
}

class NLevelCache {
  constructor(options) {
    this.caches = options.caches || noCaches;
    this.compute = options.compute || nothing;
    this.keyForQuery = options.keyForQuery || identity;
    this.shouldCompute = options.shouldCompute || empty;
  }

  get(query, options) {
    let key = this.keyForQuery(query);
    return readCaches(this.caches, key, options).then(readValue => {
      if (!this.shouldCompute(readValue)) return readValue;
      return this.set(query, options, key);
    });
  }

  set(query, options, key) {
    return this.compute(query, options)
      .then((value) => {
        key = key || this.keyForQuery(query);
        return writeCaches(this.caches, key, value, options).then(() => value);
      });
  }
}

module.exports = NLevelCache;
