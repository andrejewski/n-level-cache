# n-level-cache
Multi-level cache with any number of levels and gracefully fallback to the computed value.

```sh
npm install n-level-cache
```

## Visual

```
key   -> cache1.get -> ... -> cacheN.get ->
                                            compute
value <- cache1.set <- ... <- cacheN.set <-
```

## Examples

```js
const nLevelCache = require('n-level-cache');

// example: Redis (promisified)
class RedisCache {
  constructor(redis) {
    this.redis = redis;
  },
  get(key, options) {
    return this.redis.get(key);
  },
  set(key, value, options) {
      if (options.ttl) {
        return this.redis.setex(key, options.ttl, value);
      } else {
        return this.redis.set(key, value);
      }
    }
}

const nLevelCache = new NLevelCache({
  caches: [
    new RedisCache(redisClientL1),
    new RedisCache(redisClientL2),
    // ...
  ],
  compute(key) {
    // optional last resort: if the cached value
    // is not found it will be computed, cached,
    // and returned to the caller
    return myDatabase.users.findById(key);
  }
});

return nLevelCache.get(userId)
  .then(value => {
    // ...
  });
```

```js
// example: Local/SessionStorage (in browser only)
class LocalCache {
  constructor(storage) {
    this.storage = storage;
  },
  get(key, options) {
    return Promise.resolve(JSON.parse(this.storage.getItem(key)));
  },
  set(key, value, options) {
    this.storage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
}

const browserCaches = [
  new LocalCache(window.localStorage),
  new LocalCache(window.sessionStorage),
];

const nLevelCache = new NLevelCache({ caches: browserCaches });

nLevelCache.get(myKey)
  .then(value => {
    console.log(value);
    // ^ will print the value if it is found in localStorage or
    // sessionStorage, otherwise value is null
  });
```

## Documentation

`class NLevelCache(options)`
```js
const NLevelCache = new NLevelCache({
  // default options shown
  caches: [], // get/checked from first to last
              // set/written from last to first
              // Each cache needs these methods:
              // get(key, options) Promise<maybe value>
              // set(key, value, options) Promise

  compute(query, options) {
    // computes the value if it is not found in any cache
    // query and options are passed directly from set/get
    // must return a promise
    return Promise.resolve(void 0);
  },

  isValue(x) {
    // checks a value returned from a cache
    // if true, the cache returned a useful value
    // why have this? sometimes null/undefined may be valid results
    return x !== null && x !== void 0;
  },

  hydrate: true,  // if true, if a value is found in a higher cache
                  // that value is set on all lower caches
                  // so the next time those caches have the value

  keyForQuery(query) {
    // returns a key for a given query
    // why have this? compute() take a query that can be complex
    // but caches only need a key.
    // For example: compute({model: 'user', id: 'chris'})
    // But the key would be "users:chris" if configured here
    return query;
  }
});
```

`NLevelCache.get(query Any, options Object) Promise`: resolves with a cache value if found or otherwise the computed value
- `options Object`: any options that should be carried along to implemented cache get functions

`NLevelCache.set(query Any, options Object) Promise`: resolves with computed value
- `options Object`: any options that should be carried along to implemented cache set functions

## Contributing

Contributions are incredibly welcome as long as they are standardly applicable and pass the tests (or break bad ones). Tests are written in Mocha and assertions are done with the Node.js core `assert` module.

```sh
# running tests
npm run test
```

Follow me on [Twitter](https://twitter.com/compooter) for updates or just for the lolz and please check out my other [repositories](https://github.com/andrejewski) if I have earned it. I thank you for reading.
