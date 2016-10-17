'use strict'

module.exports = class NLevelCache {
  constructor (options = {}) {
    const {caches, compute, isValue, hydrate, keyForQuery} = options
    this.caches = caches || []
    this.compute = compute || (() => Promise.resolve(void 0))
    this.isValue = isValue || (x => x !== null && x !== void 0)
    this.hydrate = hydrate !== void 0 ? hydrate : true
    this.keyForQuery = keyForQuery || (x => x)
  }

  get (query, options) {
    const key = this.keyForQuery(query)
    return this._getCaches(this.caches, key, options).then(({value, index}) => {
      if (this.hydrate) {
        const len = this.caches.length
        const isCacheValue = index < len
        if (isCacheValue) {
          const writers = this.caches.slice(0, index)
          return this._setCaches(writers, key, value, options)
        }
      }
      if (this.isValue(value)) return value
      return this.set(query, options, key)
    })
  }

  _getCaches (caches, key, options) {
    let index = -1
    const next = value => {
      if (index !== -1 && this.isValue(value)) return {value, index}
      if (++index >= caches.length) return {value, index}
      const cache = caches[index]
      return cache.get(key, options)
        .catch(error => {
          if (cache.onGetError) cache.onGetError(error)
        }).then(next)
    }
    return Promise.resolve(void 0).then(next)
  }

  set (query, options, key) {
    return this.compute(query, options).then(value => {
      key = key || this.keyForQuery(query)
      return this._setCaches(this.caches, key, value, options)
    })
  }

  _setCaches (caches, key, value, options) {
    const writes = []
    for (const cache of caches) {
      writes.push(cache.set(key, value, options)
        .catch(error => {
          if (cache.onSetError) cache.onSetError(error)
        }))
    }
    return Promise.all(writes).then(() => value)
  }
}
