/* eslint-disable no-undef */
import { jest } from '@jest/globals';
import { configureLogger, beginLogging } from './logger.js';

const config = {
  logToConsole: {
    enabled: true,
    type: 'string',
  },
  logLevel: 'silly',
  service: 'test-string',
  logToFiles: false,
};

let writeSpy;
const captured = [];

beforeAll(() => {
  configureLogger(config);
  // Winston's Console transport writes to `console._stdout.write` (see
  // node_modules/winston/lib/winston/transports/console.js). Under Jest,
  // `console._stdout` is the buffered console, not `process.stdout`.
  writeSpy = jest.spyOn(console._stdout, 'write').mockImplementation((chunk) => {
    captured.push(chunk.toString());
    return true;
  });
});

afterAll(() => {
  writeSpy.mockRestore();
});

test('string console type writes parseable JSON to stdout', () => {
  const logger = beginLogging({ name: 'string-test' });

  logger.info('hello string mode');

  expect(captured.length).toBeGreaterThan(0);

  const line = captured.find((c) => c.includes('hello string mode'));
  expect(line).toBeDefined();

  const parsed = JSON.parse(line.trim());
  expect(parsed).toMatchObject({
    message: 'hello string mode',
    level: 'info',
    label: 'string-test',
    service: 'test-string',
  });
  expect(typeof parsed.timestamp).toBe('string');
});
