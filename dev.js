import { beginLogging, configureLogger } from './src/logger.js';

configureLogger({
  logToConsole: {
    enabled: true,
    type: 'gcp',
  },
  logToFiles: true,
  lokiConfig: {
    sendLogs: true,
    host: process.env.LOKI_HOST,
    username: process.env.LOKI_USERNAME,
    apiKey: process.env.LOKI_API_KEY,
    logCacheLimit: 1,
  },
  logLevel: 'silly',
  service: 'lumberjack-dev-test',
});

configureLogger({
  logToConsole: {
    enabled: true,
    type: 'pretty',
  },
  logToFiles: false,
  lokiConfig: {
    sendLogs: false,
    host: process.env.LOKI_HOST,
    username: process.env.LOKI_USERNAME,
    apiKey: process.env.LOKI_API_KEY,
    logCacheLimit: 10,
  },
  logLevel: 'silly',
  service: 'lumberjack-dev-test',
});

const logger = beginLogging({
  name: 'dev.js',
});

const bigObject = {
  key: {
    subKey: 'yeet',
    next: {
      subSubKey: 'woot',
    },
  },
};

logger.error('error! %o', bigObject);

logger.error({ bigObject });

logger.warn({ warn: 'warning!', x: bigObject });

logger.info('Pose purrfectly to show my beauty plan your travel or check cat door for ambush 10 times before coming in. Going to catch the red dot today going to catch the red dot today stare at ceiling, sleep on dog bed, force dog to sleep on floor, or lick butt. Scoot butt on the rug eat fish on floor. Licks paws dont wait for the storm to pass, dance in the rain for kitty kitty pussy cat doll. Scratch the box have my breakfast spaghetti yarn.');

logger.http('http! %o', { booty: 'this is a server message!' });

logger.verbose('verbose!');

logger.debug('debug!');

logger.silly('silly!');

logger.silly('silly!');

logger.silly('silly!');
