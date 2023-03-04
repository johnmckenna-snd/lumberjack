/* eslint-disable no-console */
import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';
import util from 'util';

import LokiCloudTransport from './lokiCloudTransport.js';

// These variables are mutated by configureLogger() and beginLogging() if
// configureLogger() hasn't been called.
let globalLogLevel = null;
let globalLogToConsole = false;
let globalLokiConfig = null;
let globalService = null;
let globalLogToFiles = false;

/**
 * Sets the global options for the logger.
 * It can be called more than once, but you are mutating your global config!
 *
 * You should definitely call configureLogger() before beginLogging().
 * Haven't you seen Ax Men? This is dangerous work!
 *
 * @param {Object} args Arguments to configure the logger
 * @param {boolean} args.logToConsole Should lumberjack log to the Console?
 * @param {boolean} args.logToFiles
 *  Should lumberjack log to .json files ./combined.log and ./error.log
 * @param {enum} args.logLevel <silly | debug | verbose | http | info | warn | error>
 * @param {Object} args.lokiConfig Loki transport config
 * @param {string} args.lokiConfig.host Loki host URL
 * @param {string} args.lokiConfig.username Grafana Loki Username
 * @param {string} args.lokiConfig.apiKey Grafana Loki API Key
 * @param {number} args.lokiConfig.logCacheLimit The number of logs the cache holds. Default of 10
 * @param {boolean} args.lokiConfig.sendLogs Send logs to Grafana Loki or Not
 */
export function configureLogger ({
  logToConsole,
  logLevel,
  lokiConfig,
  service,
  logToFiles,
}) {
  // You may not want to call configureLogger twice!
  if (
    globalLogLevel
    || globalLogToConsole
    || globalLokiConfig
    || globalService
    || globalLogToFiles
  ) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nGlobal Configuration has been set twice. Beware stuff is changing!\n`);
  }
  // Set Global config. I know I know it's a function mutating state.
  globalLogLevel = logLevel;
  globalLogToConsole = logToConsole;
  globalLokiConfig = lokiConfig;
  globalService = service;
  globalLogToFiles = logToFiles;
}

const { printf } = format;

export const hawtFormat = printf(({
  level,
  message,
  label,
  timestamp,
}) => {
  function messageBuilder (levelMessage) {
    return `${chalk.gray('|')} ${levelMessage} ${chalk.grey('at')} ${chalk.green(`${timestamp}`)} ${chalk.grey('in')} ${chalk.bold(label)}
  ${util.inspect(message, { showHidden: true, depth: null })} \n`;
  }

  if (level === 'error') {
    return messageBuilder(chalk.red(`${level.toUpperCase()}`));
  }

  if (level === 'warn') {
    return messageBuilder(chalk.yellowBright(`${level.toUpperCase()}`));
  }

  if (level === 'info') {
    return messageBuilder(chalk.cyanBright(`${level.toUpperCase()}`));
  }

  if (level === 'http') {
    return messageBuilder(chalk.magenta(`${level.toUpperCase()}`));
  }

  if (level === 'verbose') {
    return messageBuilder(chalk.blueBright(`${level.toUpperCase()}`));
  }

  if (level === 'debug') {
    return messageBuilder(chalk.greenBright(`${level.toUpperCase()}`));
  }

  if (level === 'silly') {
    return messageBuilder(chalk.black.bgWhiteBright(`${level.toUpperCase()} `));
  }

  return message;
});

const {
  combine,
  label,
  timestamp,
  splat,
} = format;

/**
 * Instantiates an individual logger. You can specify options here that override globals
 *
 * You should definitely call configureLogger() before beginLogging().
 * Or don't then I get to pick what gets logged where!
 *
 * @param {Object} args Arguments to configure the logger
 * @param {string} args.name Name of this logging instance i.e. server.js
 * @param {boolean} args.logToConsole Change local log to console
 * @param {enum} args.logLevel Change local log level
 *  <silly | debug | verbose | http | info | warn | error>
 * @param {Boolean} args.logToFiles
 *  Should lumberjack log to .json files ./combined.log and ./error.log
 * @returns {Function}
 */
export function beginLogging ({
  name,
  logToConsole,
  logLevel,
  logToFiles,
}) {
  // You probably want to call configureLogger() before beginLogging()
  if (
    !globalLogLevel
    || !globalLogToConsole
    || !globalService
  ) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nGlobal Configuration has not been set by calling configureLogger()\nPlease set at least: \n   logLevel\n   logToConsole\nFor now defaults are being set of logToConsole=true and logLevel=silly.\n`);
  }
  // default to silly in case there's no config
  const level = logLevel || globalLogLevel || 'silly';

  // default to no log to files
  const toFiles = logToFiles || globalLogToFiles || false;

  // default to true
  const toConsole = logToConsole || globalLogToConsole || true;

  if (!toFiles && !globalLokiConfig && !toConsole) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nPick one:\nlogLevel must be !production \nOr logToFiles as true \nOr have a lokiConfig\n\nOtherwise the winston doesn't know what to do with it's life. \n`);
  }

  const logger = createLogger({
    level,
    defaultMeta: { service: globalService },
  });

  // deliberately not using NODE_ENV to eliminate unwanted consequences
  if (toConsole) {
    logger.add(new transports.Console({
      format: combine(
        label({ label: name }),
        timestamp(),
        splat(),
        hawtFormat,
      ),
    }));
  }

  // if we got toFiles log these bois
  if (toFiles) {
    logger.add(new transports.File({ filename: 'error.log', level: 'error' }));
    logger.add(new transports.File({ filename: 'combined.log' }));
  }

  if (globalLokiConfig && globalLokiConfig.sendLogs) {
    const {
      host,
      username,
      apiKey,
      logCacheLimit,
    } = globalLokiConfig;
    logger.add(new LokiCloudTransport({
      host,
      username,
      apiKey,
      logCacheLimit,
      level,
      format: combine(
        label({ label: name }),
        timestamp(),
        splat(),
        format.json(),
      ),
      labels: { app: globalService },
    }));
  }

  return logger;
}
