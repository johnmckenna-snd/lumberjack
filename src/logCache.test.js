/* eslint-disable no-undef */
import { EventEmitter } from 'node:events';
import http from 'node:http';

import { getLogCache, logCacheEmitter } from './logCache.js';

class ServerEmitter extends EventEmitter {}

const serverEmitter = new ServerEmitter();

async function waitForRequest () {
  return new Promise((resolve, reject) => {
    serverEmitter.on('message', (req) => {
      const chunks = [];

      req.on('data', (chunk) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      });

      req.on('error', reject);
    });
  });
}

function requestHandler (req, res) {
  serverEmitter.emit('message', req);
  res.writeHead(200);
  res.end('yeet');
}

const server = http.createServer(requestHandler);

const url = 'http://localhost:3080';

beforeAll(() => {
  server.listen(3080);
  logCacheEmitter.emit('instantiate', { url, logCacheLimit: 10 });
});

afterAll(() => {
  server.close();
});

const testLog = {
  stream: { service: 'test', level: 'info', label: 'test' },
  values: ['1683769662427000000', 'test1'],
};

test('cache should have one item in it', () => {
  logCacheEmitter.emit('log', testLog);

  const logCache = getLogCache();

  expect(logCache).toMatchObject([testLog]);
});

const testRequest = {
  streams: [
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
    {
      stream: { service: 'test', level: 'info', label: 'test' },
      values: ['1683769662427000000', 'test1'],
    },
  ],
};

test('cache should send logs after 10', async () => {
  for (let i = 0; i < 10; i += 1) {
    if (i < 9) {
      logCacheEmitter.emit('log', testLog);
    } else {
      // send the last one after we call waitForRequest()
      setTimeout(() => logCacheEmitter.emit('log', testLog), 100);
    }
  }

  const request = await waitForRequest();

  expect(request).toMatchObject(testRequest);
});
