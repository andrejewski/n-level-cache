'use strict';

const nLevelCache = require('..');
const assert = require('assert');

function mockLevel(reporter, name, value) {
  return {
    get(key) {
      reporter.push({method: 'get', name: name, key: key, value: value});
      return Promise.resolve(value);
    },
    set(key, newValue) {
      reporter.push({method: 'set', name: name, key: key, value: newValue});
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
      compute: function(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    return nLevelCache(options, myKey)
      .then(function(value) {
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
      compute: function(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    return nLevelCache(options, myKey)
      .then(function(value) {
        assert.equal(value, myValue);

        [1, 2, 3].forEach(function(n) {
          const report = reports[n-1];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, null);
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
      compute: function(key) {
        assert.equal(key, myKey);
        return Promise.resolve(myValue);
      }
    };

    return nLevelCache(options, myKey)
      .then(function(value) {
        assert.equal(value, myValue);

        [3, 2, 1].forEach(function(n) {
          const report = reports[reports.length-n];
          assert.equal(report.name, `l${n}`);
          assert.equal(report.key, myKey);
          assert.equal(report.value, myValue);
        });
      });
  });
});
