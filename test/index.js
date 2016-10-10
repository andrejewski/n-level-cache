'use strict';

const NLevelCache = require('..');
const assert = require('assert');

function mockLevel(reporter, name, value) {
  return {
    get(key, options) {
      reporter.push({method: 'get', name, key, value});
      return Promise.resolve(value);
    },
    set(key, value, options) {
      reporter.push({method: 'set', name, key, value});
      return Promise.resolve();
    }
  };
}

function idRelation(x) {
  return x;
}

describe('n-level-cache', function() {
  it('should always build from the source if no caching levels are provided', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const options = {
      caches: [],
      keyForQuery: idRelation,
      compute(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.equal(value, myValue);
      });
  });

  it('should check all caching levels before building the value from source', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];
    const options = {
      caches: [
        mockLevel(reports, 'l1', null),
        mockLevel(reports, 'l2', null),
        mockLevel(reports, 'l3', null)
      ],
      keyForQuery: idRelation,
      compute(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.equal(value, myValue);

        [1, 2, 3].forEach(n => {
          const report = reports[n-1];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, null);
          assert.equal(report.method, 'get');
        });
      });
  });

  it('should write to all caching levels after building the value from source', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];
    const options = {
      caches: [
        mockLevel(reports, 'l1', null),
        mockLevel(reports, 'l2', null),
        mockLevel(reports, 'l3', null)
      ],
      keyForQuery: idRelation,
      compute(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.equal(value, myValue);

        [3, 2, 1].forEach(n => {
          const report = reports[reports.length-n];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, myValue);
          assert.equal(report.method, 'set');
        });
      });
  });

  it('should not write to any caching levels if shouldWrite returns false', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];
    const options = {
      caches: [
        mockLevel(reports, 'l1', null),
        mockLevel(reports, 'l2', null),
        mockLevel(reports, 'l3', null)
      ],
      keyForQuery: idRelation,
      shouldWrite(value) {
        assert.equal(value, null);
        return false;
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.equal(value, null);

        [1, 2, 3].forEach(n => {
          const report = reports[n-1];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, null);
          assert.equal(report.method, 'get');
        });
      });
  });

  it('should write entry to all caches using set', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];
    const options = {
      caches: [
        mockLevel(reports, 'l1', null),
        mockLevel(reports, 'l2', null),
        mockLevel(reports, 'l3', null)
      ],
      keyForQuery: idRelation,
      compute(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.set(myKey)
      .then(value => {
        assert.equal(value, myValue);

        [3, 2, 1].forEach(n => {
          const report = reports[reports.length-n];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, myValue);
          assert.equal(report.method, 'set');
        });
      });
  });

  it('should write entry to all caches as null if compute is empty', function() {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];
    const options = {
      caches: [
        mockLevel(reports, 'l1', null),
        mockLevel(reports, 'l2', null),
        mockLevel(reports, 'l3', null)
      ],
      keyForQuery: idRelation
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.set(myKey)
      .then(value => {
        assert.equal(value, null);

        [3, 2, 1].forEach(n => {
          const report = reports[reports.length-n];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, null);
          assert.equal(report.method, 'set');
        });
      });
  });

  it('should store reversed version of caches', () => {
    let caches = [
      {
        name: 'l1',
        set() {},
        get() {}
      },
      {
        name: 'l2',
        set() {},
        get() {}
      }
    ];

    const nLevelCache = new NLevelCache({
      caches: caches
    });

    assert.deepEqual(nLevelCache.caches, caches);
    assert.deepEqual(nLevelCache.readers, caches.map(cache => cache.get));
    assert.deepEqual(nLevelCache.writers, caches.reverse().map(cache => cache.set));
  });

  it('should not modify original caches after writing', () => {
    const myKey   = 'abc';
    const reports = [];

    let caches = [
      mockLevel(reports, 'l1', null),
      mockLevel(reports, 'l2', null),
      mockLevel(reports, 'l3', null)
    ];

    const options = {
      caches: caches,
      keyForQuery: idRelation
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.set(myKey)
      .then(value => {
        assert.deepEqual(nLevelCache.caches, caches);
        assert.deepEqual(nLevelCache.readers, caches.map(cache => cache.get));
        assert.deepEqual(nLevelCache.writers, caches.reverse().map(cache => cache.set));
      });
  });

  it('should not modify original caches after reading', () => {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];

    let caches = [
      mockLevel(reports, 'l1', null),
      mockLevel(reports, 'l2', null),
      mockLevel(reports, 'l3', null)
    ];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.deepEqual(nLevelCache.caches, caches);
        assert.deepEqual(nLevelCache.readers, caches.map(cache => cache.get));
        assert.deepEqual(nLevelCache.writers, caches.reverse().map(cache => cache.set));
      });
  });

  it('should write to lower level caches if found in highest caches', () => {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];

    let caches = [
      mockLevel(reports, 'l1', null),
      mockLevel(reports, 'l2', null),
      mockLevel(reports, 'l3', myValue)
    ];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      shouldWrite(cacheValue) {
        assert.equal(cacheValue.getCacheIndex(), 2);
        assert.equal(cacheValue.getValue(), myValue);
        return true;
      },
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.deepEqual(reports, [
          { method: 'get', name: 'l1', key: myKey, value: null },
          { method: 'get', name: 'l2', key: myKey, value: null },
          // l3 has the value, and should be written to l2 and l1.
          { method: 'get', name: 'l3', key: myKey, value: myValue },
          { method: 'set', name: 'l2', key: myKey, value: myValue },
          { method: 'set', name: 'l1', key: myKey, value: myValue }
        ]);
      });
  });

  it('should only write to lower level caches if found in non-highest', () => {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];

    let caches = [
      mockLevel(reports, 'l1', null),
      mockLevel(reports, 'l2', myValue),
      mockLevel(reports, 'l3', myValue)
    ];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      shouldWrite(cacheValue) {
        assert.equal(cacheValue.getCacheIndex(), 1);
        assert.equal(cacheValue.getValue(), myValue);
        return true;
      },
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.deepEqual(reports, [
          { method: 'get', name: 'l1', key: myKey, value: null },
          { method: 'get', name: 'l2', key: myKey, value: myValue },
          { method: 'set', name: 'l1', key: myKey, value: myValue }
        ]);
      });
  });

  it('should not write to any caches if found in any cache and shouldWrite returns false', () => {
    const myKey   = 'abc';
    const myValue = '123';
    const reports = [];

    let caches = [
      mockLevel(reports, 'l1', myValue),
      mockLevel(reports, 'l2', myValue),
      mockLevel(reports, 'l3', myValue)
    ];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      shouldWrite(cacheValue) {
        assert.equal(cacheValue.getCacheIndex(), 0);
        assert.equal(cacheValue.getValue(), myValue);
        return !cacheValue;
      },
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);

    return nLevelCache.get(myKey)
      .then(value => {
        assert.deepEqual(reports, [
          { method: 'get', name: 'l1', key: myKey, value: myValue }
        ]);
      });
  });

  it('should carry options to get', () => {
    const myKey   = 'abc';
    const myValue = '123';

    const fnOptions = {
      test: true
    };

    let caches = [{
      get(key, options) {
        assert.deepEqual(options, fnOptions);
        return Promise.resolve();
      }
    }];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      shouldWrite(cacheValue) {
        return false;
      },
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);
    return nLevelCache.get(myKey, fnOptions);
  });

  it('should carry options to set', () => {
    const myKey   = 'abc';
    const myValue = '123';

    const fnOptions = {
      test: true
    };

    let caches = [{
      set(key, value, options) {
        assert.deepEqual(options, fnOptions);
        return Promise.resolve(myValue);
      }
    }];

    const options = {
      caches: caches,
      keyForQuery: idRelation,
      shouldWrite(cacheValue) {
        return false;
      },
      compute(key) {
        return Promise.resolve(myValue);
      }
    };

    const nLevelCache = new NLevelCache(options);
    return nLevelCache.set(myKey, fnOptions);
  });
});
