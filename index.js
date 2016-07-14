'use strict';

const noCaches = [];
const nothing = () => Promise.resolve(null);
const identity = x => x;
const empty = x => x === null || x === void 0;

function nLevelCache(options, query) {
  const caches = options.caches || noCaches;
  const compute = options.compute || nothing;
  const relation = options.relation || identity;
  const key = relation(query);
  return readCaches(caches, key, options).then(readValue => {
    if (!empty(readValue)) return readValue;
    return compute(query).then(computedValue => {
      return writeCaches(caches, key, computedValue, options)
        .then(() => computedValue);
    });
  });
}

function promiseUntil(predicate, funcs, args, index) {
  index = index || 0;
  const func = funcs[index];
  if (!func) return Promise.resolve();
  return func.apply(null, args)
    .then(value => {
      return predicate(value)
        ? value
        : promiseUntil(predicate, funcs, args, index + 1);
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

module.exports = nLevelCache;
