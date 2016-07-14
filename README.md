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
  get(key) {
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

nLevelCache({
  caches: [
    new RedisCache(redisClientL1),
    new RedisCache(redisClientL2),
    // ...
  ],
  compute(key) {
    // optional last report: if the cached value
    // is not found it will be computed, cached,
    // and returned to the caller
    return myDatabase.users.findById(key);
  }
}, userId).then(user => {
  console.log(user);
});
```

```js
// example: Local/SessionStorage (in browser only)
class LocalCache {
  constructor(storage) {
    this.storage = storage;
  },
  get(key) {
    return Promise.resolve(JSON.parse(this.storage.getItem(key)));
  },
  set(key, value) {
    this.storage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
}

const browserCaches = [
  new LocalCache(window.localStorage),
  new LocalCache(window.sessionStorage),
];

nLevelCache({caches: browserCaches}, myKey).then(value => {
  console.log(value);
  // ^ will print the value if it is found in localStorage or
  // sessionStorage, otherwise value is null
});
```

## Documentation

`nLevelCache(options Object, query Any) Promise` accepts these options
- `options.caches Array`: caches to check for the given key, checked from first to last. Every cache needs:        
  - `get(key String, options Object) Promise`
  - `set(key String, value Any, options Object) Promise`
- `options.compute (query Any) -> Promise`: function that computes the value if it is not found in any cache
- `options.keyForQuery (query Any) -> String`: function that maps a query of any type to a string used as the lookup key for the caches

All options will also be passed to the caches.

## Contributing

Contributions are incredibly welcome as long as they are standardly applicable and pass the tests (or break bad ones). Tests are written in Mocha and assertions are done with the Node.js core `assert` module.

```sh
# running tests
npm run test
```

Follow me on [Twitter](https://twitter.com/compooter) for updates or just for the lolz and please check out my other [repositories](https://github.com/andrejewski) if I have earned it. I thank you for reading.
