const { createLogger } = require('../../shared/debug-logging');

describe('markSnip logger', () => {
  test('debug, info, warn, and error write through to console', () => {
    const consoleRef = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    const logger = createLogger({ console: consoleRef });

    logger.debug('diag');
    logger.info('lifecycle');
    logger.warn('careful');
    logger.error('boom');

    expect(consoleRef.debug).toHaveBeenCalledWith('diag');
    expect(consoleRef.info).toHaveBeenCalledWith('lifecycle');
    expect(consoleRef.warn).toHaveBeenCalledWith('careful');
    expect(consoleRef.error).toHaveBeenCalledWith('boom');
  });

  test('falls back to console.log when a method is missing', () => {
    const consoleRef = { log: jest.fn() };
    const logger = createLogger({ console: consoleRef });
    logger.info('hello');
    logger.debug('noisy');
    expect(consoleRef.log).toHaveBeenCalledWith('hello');
    expect(consoleRef.log).toHaveBeenCalledWith('noisy');
  });
});
