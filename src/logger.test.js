/* eslint-disable no-undef */
import { readFile } from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import { createReadStream } from 'node:fs';
import { globSync } from 'glob';

import { configureLogger, beginLogging, globalEnv } from './logger.js';

let logger;

const config = {
  logToConsole: {
    enabled: true,
    type: 'pretty',
  },
  logLevel: 'silly',
  service: 'test',
  logToFiles: true,
  lokiConfig: {
    host: 'test_host',
    username: 'username',
    apiKey: 'apiKey',
    logCacheLimit: 15,
    sendLogs: true,
  },
};

const [errorPath] = globSync(['*.log']);

const errorUrl = new URL(`../${errorPath}`, import.meta.url);

beforeAll(async () => {
  configureLogger(config);

  logger = beginLogging({ name: 'test' });

  logger.error('test1');
  logger.error('test2');

  logger.info('test3');
  logger.info('test4');

  // when in doubt setTimeout
  // this gives winston some time to write some files
  return new Promise((resolve) => { setTimeout(resolve, 2000); });
});

test('logger should be configured', () => {
  expect(globalEnv).toMatchObject(config);
});

test('logger should have levels property and it should be an object', () => {
  const expectedLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  };

  expect(logger).toHaveProperty('levels');
  expect(logger.levels).toMatchObject(expectedLevels);
});

test('logger should have logging functions', () => {
  expect(logger).toHaveProperty('error');
  expect(typeof logger.error).toBe('function');

  expect(logger).toHaveProperty('warn');
  expect(typeof logger.warn).toBe('function');

  expect(logger).toHaveProperty('info');
  expect(typeof logger.info).toBe('function');

  expect(logger).toHaveProperty('http');
  expect(typeof logger.http).toBe('function');

  expect(logger).toHaveProperty('verbose');
  expect(typeof logger.verbose).toBe('function');

  expect(logger).toHaveProperty('debug');
  expect(typeof logger.debug).toBe('function');

  expect(logger).toHaveProperty('silly');
  expect(typeof logger.silly).toBe('function');
});

test('logger should have written a error.log file', async () => {
  await readFile(errorUrl);
});

async function readFileByLine (stream, test) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    function checkLine (line) {
      test(line);
    }

    rl.on('line', checkLine);

    rl.on('close', resolve);

    rl.on('error', reject);
  });
}

test('error.log lines should be json', async () => {
  const stream = createReadStream(errorUrl);

  await readFileByLine(stream, (line) => expect(typeof JSON.parse(line)).toBe('object'));
});
