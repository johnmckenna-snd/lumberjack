/* eslint-disable no-console */
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';
import util from 'util';

import LokiCloudTransport from './lokiCloudTransport.js';

// this object will be locked the first time it's set by configureLogger()
export const globalEnv = {
  logLevel: null,
  logToConsole: false,
  lokiConfig: null,
  service: null,
  logToFiles: false,
};

/**
 * Sets the global options for the logger.
 * It can be called more than once, but you won't change anything!
 *
 * You should definitely call configureLogger() before beginLogging().
 * Haven't you seen Ax Men? This is dangerous work!
 *
 * The logger has a `gcp` option for type that logs to google cloud's standards.
 * https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
 *
 * @param {Object} args Arguments to configure the logger
 * @param {Object} args.logToConsole Should lumberjack log to the Console?
 * @param {Boolean} args.logToConsole.enabled Is logging to console enabled?
 * @param {enum} args.logToConsole.type What style should the logger use?
 * The `gcp` option is compatible with google cloud
 * <string | gcp | pretty>
 * @param {boolean} args.logToFiles
 *  Should lumberjack log to .json files ./combined.log and ./error.log
 * @param {enum} args.logLevel <silly | debug | verbose | http | info | warn | error>
 * @param {object} args.lokiConfig Loki transport config
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
  if (Object.isFrozen(globalEnv)) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nGlobal Configuration has been called twice. Don't worry you can't change it after it's been set, but I wanted to let you know you tried.\n`);
  }

  if (!Object.isFrozen(globalEnv)) {
    globalEnv.logLevel = logLevel;
    globalEnv.logToConsole = logToConsole || { type: 'string', enabled: true };
    globalEnv.logToFiles = logToFiles;
    globalEnv.service = service;

    let newLokiConfig = { ...lokiConfig };

    if (lokiConfig) {
    // the cache likes positive numbers
      if (lokiConfig.logCacheLimit <= 0 || typeof lokiConfig.logCacheLimit !== 'number') {
        console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\n lokiConfig.logCacheLimit is not a number greater than 0 setting to the default of 10.`);
        newLokiConfig = {
          ...newLokiConfig,
          logCacheLimit: 10,
        };
      }
      // we want to make sure this is false not some other falsy type
      if (!lokiConfig.sendLogs) {
        newLokiConfig = {
          ...newLokiConfig,
          sendLogs: false,
        };
      }

      // we can't log without the host, apiKey, and username
      // so we'll turn off loki transport
      if (!lokiConfig.apiKey || !lokiConfig.host || !lokiConfig.username) {
        newLokiConfig = {
          ...newLokiConfig,
          sendLogs: false,
        };
      }
    }

    globalEnv.lokiConfig = newLokiConfig;
  }

  // we only want to set the globalEnv values once
  Object.freeze(globalEnv);
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

export const gcpFormat = printf(({
  level,
  message,
  label,
  timestamp,
}) => {
  const jsonPayload = {
    level,
    message,
    label,
    timestamp,
  };

  const gcpLog = {
    jsonPayload,
    timestamp,
    logName: label,
    severity: level,
    labels: {
      label,
    },
    stringPayload: message,
  };

  return JSON.stringify(gcpLog);
});

/**
 * Logger middleware
 * Intercepts the message and adds an id to it.
 */

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
 * The logger has a `gcp` option for type that logs to google cloud's standards.
 * https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
 *
 * @param {object} args Arguments to configure the logger
 * @param {string} args.name Name of this logging instance i.e. server.js
 * @param {object} args.logToConsole Change local log to console
 * @param {boolean} args.logToConsole.enabled Is logging to console enabled?
 * @param {enum} args.logToConsole.type What style should the logger use?
 * The `gcp` option is compatible with google cloud
 * <string | gcp | pretty>
 * @param {enum} args.logLevel Change local log level
 *  <silly | debug | verbose | http | info | warn | error>
 * @param {boolean} args.logToFiles
 *  Should lumberjack log to .json files ./combined.log and ./error.log
 * @returns {Function}
 */
export function beginLogging ({
  name,
  logToConsole = {},
  logLevel,
  logToFiles,
}) {
  // You probably want to call configureLogger() before beginLogging()
  if (
    !globalEnv.logLevel
    || !globalEnv.logToConsole
    || !globalEnv.service
  ) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nGlobal Configuration has not been set by calling configureLogger()\nPlease set at least: \n   logLevel\n   logToConsole\nFor now defaults are being set of logToConsole=true, logLevel=silly, and service = 'my-saucy-logger'.\n`);
  }
  // default to silly in case there's no config
  const level = logLevel || globalEnv.logLevel || 'silly';

  // default to no log to files
  const toFiles = logToFiles || globalEnv.logToFiles || false;

  // default to true
  const toConsole = logToConsole.enabled || globalEnv.logToConsole.enabled || true;

  // pretty is annoying in production
  const type = logToConsole?.type || globalEnv.logToConsole.type || 'string';

  const service = globalEnv.service || 'my-saucy-logger';

  if (!toFiles && !globalEnv.lokiConfig && !toConsole) {
    console.error(`\n${chalk.redBright('----LUMBERJACK MISCONFIGURATION----')}\nPick one:\nlogToConsole must be true \nOr logToFiles as true \nOr have a lokiConfig\n\nOtherwise the winston doesn't know what to do with it's life. \n`);
  }

  const logger = createLogger({
    level,
    defaultMeta: { service },
  });

  if (toConsole) {
    if (type === 'pretty') {
      logger.add(new transports.Console({
        format: combine(
          label({ label: name }),
          timestamp(),
          splat(),
          hawtFormat,
        ),
      }));
    } else if (type === 'gcp') {
      logger.add(new transports.Console({
        format: combine(
          label({ label: name }),
          timestamp(),
          splat(),
          gcpFormat,
        ),
      }));
    } else {
      logger.add(new transports.Console({
        format: combine(
          label({ label: name }),
          timestamp(),
          splat(),
        ),
      }));
    }
  }

  // if we got toFiles log these bois
  if (toFiles) {
    logger.add(new DailyRotateFile({
      filename: 'log-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '10m',
      maxFiles: '7d',
    }));
  }

  if (globalEnv.lokiConfig && globalEnv.lokiConfig.sendLogs) {
    const {
      host,
      username,
      apiKey,
      logCacheLimit,
    } = globalEnv.lokiConfig;
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
      labels: { app: service },
    }));
  }

  return logger;
}
