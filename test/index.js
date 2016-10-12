const test = require('ava')
const NLevelCache = require('../')

function mockCache (store = {}) {
  const gets = []
  const sets = []
  return {
    get (key, options) {
      gets.push({key, options})
      return Promise.resolve(store[key])
    },
    set (key, value, options) {
      sets.push({key, value, options})
      store[key] = value
      return Promise.resolve()
    },
    stats () {
      return {gets, sets}
    }
  }
}

test('NLevelCache.get() should return the first cache hit', t => {
  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(val => t.is(val, value))
})

test('NLevelCache.get() should return the computed value if no cache value is found', t => {
  const key = 'key'
  const value = 'value'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.get(key).then(val => t.is(val, value))
})

test('NLevelCache.get() should read all caches before computing a value', t => {
  const key = 'key'
  const value = 'value'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.get(key).then(() => {
    t.is(cache1.stats().gets.length, 1)
    t.is(cache2.stats().gets.length, 1)
    t.is(cache3.stats().gets.length, 1)
  })
})

test('NLevelCache.get() should write all caches with the computed value', t => {
  const key = 'key'
  const value = 'value'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.get(key).then(() => {
    return Promise.all([
      cache1.get(key).then(val => t.is(val, value)),
      cache2.get(key).then(val => t.is(val, value)),
      cache3.get(key).then(val => t.is(val, value))
    ])
  })
})

test('NLevelCache.get(query) should convert query with NLevelCache.keyForQuery', t => {
  const key = 'key'
  const query = 'query'
  const value = 'value'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    keyForQuery (query) {
      return key
    },
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.get(query).then(() => {
    // caches should have been read for <key>
    t.is(cache1.stats().gets[0].key, key)
    t.is(cache2.stats().gets[0].key, key)
    t.is(cache3.stats().gets[0].key, key)

    return Promise.all([
      // computed value should be stored at <key>
      cache1.get(key).then(val => t.is(val, value)),
      cache2.get(key).then(val => t.is(val, value)),
      cache3.get(key).then(val => t.is(val, value))
    ])
  })
})

test('NLevelCache.get(query, options) should pass options to each cache', t => {
  const key = 'key'
  const value = 'value'
  const options = {}
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.get(key, options).then(() => {
    t.is(cache1.stats().gets[0].options, options)
    t.is(cache2.stats().gets[0].options, options)
    t.is(cache3.stats().gets[0].options, options)
    t.is(cache1.stats().sets[0].options, options)
    t.is(cache2.stats().sets[0].options, options)
    t.is(cache3.stats().sets[0].options, options)
  })
})

test('NLevelCache.get() should, if hydrate is truthy, write a cache hit to the missed caches', t => {
  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = mockCache({[key]: value})
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    hydrate: true,
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(() => {
    return Promise.all([
      cache1.get(key).then(val => t.is(val, value)),
      cache2.get(key).then(val => t.is(val, value)),
      cache3.get(key).then(val => t.falsy(val)) // never read
    ])
  })
})

test('NLevelCache.get() should, if hydrate is falsy, not write a cache hit to the missed caches', t => {
  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = mockCache({[key]: value})
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    hydrate: false,
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(() => {
    return Promise.all([
      cache1.get(key).then(val => t.falsy(val)), // never set
      cache2.get(key).then(val => t.is(val, value)),
      cache3.get(key).then(val => t.falsy(val)) // never read
    ])
  })
})

test('NLevelCache.get() should resolve a cache hit even if an earlier cache rejects', t => {
  const key = 'key'
  const value = 'value'
  const error = 'error'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = {
    get (key) {
      return Promise.reject(error)
    },
    set () {
      return Promise.resolve()
    }
  }
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(val => t.is(val, value))
})

test('NLevelCache.get() should reject if there are no cache hits and compute rejects', t => {
  const key = 'key'
  const error = 'error'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute () {
      return Promise.reject(error)
    }
  })

  return nLevel.get(key).catch(err => t.is(err, error))
})

test('NLevelCache.get() should resolve a found value even there are rejected cache writes', t => {
  const key = 'key'
  const value = 'value'
  const error = 'error'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = {
    get () {
      return Promise.resolve()
    },
    set () {
      return Promise.reject(error)
    }
  }
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(val => t.is(val, value))
})

test('NLevelCache.get() should call cache.onGetError for each cache rejection', t => {
  const error = 'error'

  function badGetCache () {
    const cache = mockCache()
    cache.errors = []
    cache.get = () => Promise.reject(error)
    cache.onGetError = error => cache.errors.push(error)
    return cache
  }

  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = badGetCache()
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.get(key).then(val => {
    t.is(val, value)
    t.deepEqual(cache2.errors, [error])
  })
})

test('NLevelCache.set() should write the computed value to all caches', t => {
  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.set(key).then(val => {
    t.is(val, computed)

    return Promise.all([
      cache1.get(key).then(val => t.is(val, computed)),
      cache2.get(key).then(val => t.is(val, computed)),
      cache3.get(key).then(val => t.is(val, computed))
    ])
  })
})

test('NLevelCache.set(query) should convert query with NLevelCache.keyForQuery', t => {
  const key = 'key'
  const query = 'query'
  const value = 'value'
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    keyForQuery (query) {
      return key
    },
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.set(query).then(() => {
    return Promise.all([
      // computed value should be stored at <key>
      cache1.get(key).then(val => t.is(val, value)),
      cache2.get(key).then(val => t.is(val, value)),
      cache3.get(key).then(val => t.is(val, value))
    ])
  })
})

test('NLevelCache.set(query, options) should pass options to each cache', t => {
  const key = 'key'
  const value = 'value'
  const options = {}
  const cache1 = mockCache()
  const cache2 = mockCache()
  const cache3 = mockCache()

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(value)
    }
  })

  return nLevel.set(key, options).then(() => {
    t.is(cache1.stats().sets[0].options, options)
    t.is(cache2.stats().sets[0].options, options)
    t.is(cache3.stats().sets[0].options, options)
  })
})

test('NLevelCache.set() should call cache.onSetError for each cache write rejection', t => {
  const error = 'error'

  function badSetCache () {
    const cache = mockCache()
    cache.errors = []
    cache.set = () => Promise.reject(error)
    cache.onSetError = error => cache.errors.push(error)
    return cache
  }

  const key = 'key'
  const value = 'value'
  const computed = 'computed'
  const cache1 = mockCache()
  const cache2 = badSetCache()
  const cache3 = mockCache({[key]: value})

  const nLevel = new NLevelCache({
    caches: [cache1, cache2, cache3],
    compute (query, options) {
      return Promise.resolve(computed)
    }
  })

  return nLevel.set(key).then(val => {
    t.is(val, computed)
    t.deepEqual(cache2.errors, [error])
  })
})
