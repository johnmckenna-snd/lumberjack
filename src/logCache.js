import { EventEmitter } from 'node:events';
import axios from 'axios';

class LogCacheEmitter extends EventEmitter {}

const logCacheEmitter = new LogCacheEmitter();

let logCache = [];
let globalLogCacheLimit = 10;
let globalURL = '';

async function addToCache (log) {
  logCache.push(log);

  if (logCache.length >= globalLogCacheLimit) {
    const toSend = logCache;

    // preemptively clear cache
    // if the async fails we will re-add the logs back to the cache array
    // order doesn't really matter since we include a timestamp
    logCache = [];

    const config = {
      'Content-Type': 'application/json',
    };

    const body = {
      streams: toSend,
    };

    try {
      await axios.post(globalURL, body, config);
    } catch (e) {
      console.error('woops pushin aint workin', e.response);
      // add copy back to the cache
      logCache.push(...toSend);
    }
  }
}

logCacheEmitter.on('instantiate', ({ logCacheLimit, url }) => {
  globalLogCacheLimit = logCacheLimit;
  globalURL = url;
});

// addToCache just runs as it will we don't wait for this promise to resolve
logCacheEmitter.on('log', addToCache);

// eslint-disable-next-line import/prefer-default-export
export { logCacheEmitter };
