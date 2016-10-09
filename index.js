'use strict';

const nothing = () => Promise.resolve(null);
const identity = x => x;
const empty = x => x === null || x === void 0;

function reverse(arr) {
  let temp = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    temp.push(arr[i]);
  }
  return temp;
}

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

function readCaches(readers, key, options) {
  const firstFound = x => x;
  return promiseUntil(firstFound, readers, [key, options]);
}

function writeCaches(writers, key, value, options) {
  const never = () => false;
  return promiseUntil(never, writers, [key, value, options]);
}

class NLevelCache {
  constructor(options) {
    this.caches = options.caches || [];
    this.readers = this.caches.map(cache => cache.get);
    this.writers = reverse(this.caches).map(cache => cache.set);
    this.compute = options.compute || nothing;
    this.keyForQuery = options.keyForQuery || identity;
    this.shouldCompute = options.shouldCompute || empty;
  }

  get(query, options) {
    const key = this.keyForQuery(query);
    return readCaches(this.readers, key, options).then(readValue => {
      if (!this.shouldCompute(readValue)) return readValue;
      return this.set(query, options, key);
    });
  }

  set(query, options, key) {
    return this.compute(query, options)
      .then(value => {
        key = key || this.keyForQuery(query);
        return writeCaches(this.writers, key, value, options).then(() => value);
      });
  }
}

module.exports = NLevelCache;
