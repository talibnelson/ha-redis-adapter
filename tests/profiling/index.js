/**
 * Script to run the app for 2 minutes with a steady debit of queries
 * Useful for running profilers
 */

/* Init ----------------------------------------------------------------------*/

const crypto = require('crypto');
const redis = require('../../src');
const store = require('../../../rest-batcher/src')({
    getter: {
        method: require('../integration/utils/dao').getAssets,
    },
    uniqueOptions: ['language'],
    cache: { ttl: 3600000, step: 60000 },
    batch: { tick: 25, limit: 100 },
    retry: { scale: 2, base: 5, limit: 10 },
    store: redis('//0.0.0.0:6379'),
});
const testDuration = 60000;
const requestDelay = 2;
const sampleRange = 2;
let completed = 0;
let cacheHits = 0;
let timeouts = 0;
let batches = 0;
const startHeap = process.memoryUsage().heapUsed;

const languages = ['fr', 'en', 'pr', 'it', 'ge'];
const now = Date.now();

// store.on('cacheBump', console.log.bind(console, 'cacheBump'));
// store.on('cacheClear', console.log.bind(console, 'cacheClear'));
// store.on('retryCancelled', console.log.bind(console, 'retryCancelled'));
store.on('batch', () => { batches++; });
// store.on('batchSuccess', console.log.bind(console, 'batchSuccess'));
// store.on('batchFailed', console.log.bind(console, 'batchFailed'));
store.on('cacheHit', () => { cacheHits++; });
// store.on('cacheMiss', console.log.bind(console, 'cacheMiss'));

function hitStore() {
  if (Date.now() - now < testDuration) {
    setTimeout(hitStore, requestDelay);
    let finished = false;
    setTimeout(() => {
      if (finished === false) timeouts++;
    }, 500);
    const id = crypto.randomBytes(sampleRange).toString('hex');
    const language = languages[Math.floor(Math.random()*languages.length)];
    store.get(id, { language })
      .then((result) => {
        if (!result || result.id !== id || result.language !== language) {
          console.log(`After ${completed} calls, ${result} was returned while requesting ${id} - ${language}`);
          throw new Error('result mismatch');
        }
        finished = true;
        completed++;
      })
      .catch((err) => {
        console.error(err);
        process.exit(1)
      });
  }
  else {
    console.log(`${completed} completed requests\n${cacheHits} cache hits\n${JSON.stringify(store.size())}\n${timeouts} timed out\n${batches} batches sent\n${((process.memoryUsage().heapUsed - startHeap) / 1024).toFixed(2)} Kbytes allocated`)
    process.exit(0);
  }
}
process.on('uncaughtException', console.error)

hitStore();

