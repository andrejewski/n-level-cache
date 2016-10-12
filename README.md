# n-level-cache
Multi-level cache with any number of levels and gracefully fallback to the computed value.

```sh
npm install n-level-cache
```

## Explanation
Some systems have multiple layers of caching. On the server, these layers might be played by an in-memory data store (a hash map), any number of key-value data stores (Redis and Memcache), and finally a source of truth which is usually a database like Amazon's Dynamo or Postgres.

The goal of `n-level-cache` is to abstract away all the plumbing of multi-level caching by

- Reading from each cache one at a time, fastest to slowest, trying to get a cached value
- Computing the source of truth value if no cached value is found and writing it to all cache levels and finally returning the value
- Handling failures at any cache level, allowing other cache levels to work properly
- Rehydrating faster caches with values from slower caches
- Providing a consistent interface for building your caches and handling per-cache errors

## Examples

```js
const NLevelCache = require('n-level-cache')

// example: Redis (promisified)
class RedisCache {
  constructor (redis) {
    this.redis = redis
  },
  get (key, options) {
    return this.redis.get(key)
  },
  set (key, value, options) {
    if (options.ttl) {
      return this.redis.setex(key, options.ttl, value)
    }
    return this.redis.set(key, value)
  },
  onGetError (error) {/* log this */}
  onSetError (error) {/* log this */}
}

const nLevelCache = new NLevelCache({
  caches: [
    new RedisCache(redisClientL1),
    new RedisCache(redisClientL2)
  ],
  compute (key) {
    // optional last resort: if the cached value
    // is not found it will be computed, cached,
    // and returned to the caller
    return myDatabase.users.findById(key)
  }
})

return nLevelCache.get(userId).then(value => {
  // ...
})
```

```js
// example: Local/SessionStorage (in browser only)
class LocalCache {
  constructor (storage) {
    this.storage = storage
  },
  get (key, options) {
    return Promise.resolve(JSON.parse(this.storage.getItem(key)))
  },
  set (key, value, options) {
    this.storage.setItem(key, JSON.stringify(value))
    return Promise.resolve()
  }
}

const browserCaches = [
  new LocalCache(window.localStorage),
  new LocalCache(window.sessionStorage)
]

const nLevelCache = new NLevelCache({ caches: browserCaches })

nLevelCache.get(myKey).then(value => {
  console.log(value)
  // ^ will print the value if it is found in localStorage or
  // sessionStorage, otherwise value is null
})
```

## Documentation

### class NLevelCache(options)
```js
const nLevelCache = new NLevelCache({
  // default options shown
  caches: [], // ordered by fastest to slowest
              // see "Cache interface" below for details

  compute (query, options) {
    // computes the value if it is not found in any cache
    // query and options are passed directly from set/get
    // must return a promise
    return Promise.resolve(void 0)
  },

  isValue (x) {
    // checks a value returned from a cache
    // if true, the cache returned a useful value
    // why have this? sometimes null may be considered valid
    return x !== null && x !== void 0
  },

  hydrate: true,  // if true, if a value is found in a higher cache
                  // that value is set on all lower caches
                  // so the next time those caches have the value

  keyForQuery (query) {
    // returns a key for a given query
    // why have this? compute() take a query that can be complex
    // but caches only need a key.
    // For example: compute({model: 'user', id: 'chris'})
    // But the key would be "users:chris" if configured here
    // (Don't implement if your caches have different key schemes)
    return query
  }
})
```

### NLevelCache.get(query Any, options Object) Promise
Resolves with a cached value if found, otherwise the computed value. Rejects only if the computed value rejects. Any `options` passed will be passed along to the implemented cache methods.

### NLevelCache.set(query Any, options Object) Promise
Resolves with the computed value or rejects with the computed rejection. Writes the computed value to all caches as well. Any `options` passed will be passed along to the implemented cache methods.

### Cache interface
Caches passed to `n-level-cache` must fit the following interface. A cache does not have to be a class instance, it can be any object with these methods.

```js
class Cache {
  // required methods (must return a Promise):
  get (key, options) { return Promise.resolve(value) }
  set (key, value, options) { return Promise.resolve() }

  // optional error handlers
  onGetError (error) {}
  onSetError (error) {}
}
```

## Contributing

Contributions are incredibly welcome as long as they are standardly applicable and pass the tests (or break bad ones). Tests are done with AVA.

```sh
# running tests
npm run test
```

Follow me on [Twitter](https://twitter.com/compooter) for updates or just for the lolz and please check out my other [repositories](https://github.com/andrejewski) if I have earned it. I thank you for reading.
