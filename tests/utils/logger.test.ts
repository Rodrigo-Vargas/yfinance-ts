/// <reference types="jest" />

import { Logger, LogLevel, logger, handleApiError, withErrorHandling } from '../../src/utils/logger';
import { YFinanceError, YFinanceRateLimitError } from '../../src/utils/types';

// Mock console methods
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default INFO level', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should create logger with specified level', () => {
      const logger = new Logger(LogLevel.DEBUG);
      expect(logger).toBeDefined();
    });
  });

  describe('logging methods', () => {
    describe('with INFO level (default)', () => {
      beforeEach(() => {
        testLogger = new Logger(LogLevel.INFO);
      });

      it('should log debug messages when level allows', () => {
        testLogger = new Logger(LogLevel.DEBUG);
        testLogger.debug('test debug');
        expect(mockConsoleDebug).toHaveBeenCalledWith('[DEBUG] test debug');
      });

      it('should not log debug messages when level does not allow', () => {
        testLogger.debug('test debug');
        expect(mockConsoleDebug).not.toHaveBeenCalled();
      });

      it('should log info messages', () => {
        testLogger.info('test info');
        expect(mockConsoleInfo).toHaveBeenCalledWith('[INFO] test info');
      });

      it('should log warn messages', () => {
        testLogger.warn('test warn');
        expect(mockConsoleWarn).toHaveBeenCalledWith('[WARN] test warn');
      });

      it('should log error messages', () => {
        testLogger.error('test error');
        expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] test error', undefined);
      });

      it('should log error messages with error object', () => {
        const error = new Error('test error');
        testLogger.error('test error', error);
        expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] test error', error);
      });

      it('should log error messages with additional args', () => {
        testLogger.error('test error', undefined, 'arg1', 'arg2');
        expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] test error', undefined, 'arg1', 'arg2');
      });
    });

    describe('with ERROR level', () => {
      beforeEach(() => {
        testLogger = new Logger(LogLevel.ERROR);
      });

      it('should not log debug messages', () => {
        testLogger.debug('test debug');
        expect(mockConsoleDebug).not.toHaveBeenCalled();
      });

      it('should not log info messages', () => {
        testLogger.info('test info');
        expect(mockConsoleInfo).not.toHaveBeenCalled();
      });

      it('should not log warn messages', () => {
        testLogger.warn('test warn');
        expect(mockConsoleWarn).not.toHaveBeenCalled();
      });

      it('should log error messages', () => {
        testLogger.error('test error');
        expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] test error', undefined);
      });
    });
  });

  describe('default logger instance', () => {
    it('should export default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});

describe('handleApiError', () => {
  it('should throw YFinanceRateLimitError for 429 status', () => {
    const error = { response: { status: 429 } };
    expect(() => handleApiError(error)).toThrow(YFinanceRateLimitError);
    expect(() => handleApiError(error)).toThrow('Rate limit exceeded. Please try again later.');
  });

  it('should throw YFinanceError for 4xx client errors', () => {
    const error = { response: { status: 404, data: { message: 'Not found' } } };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Client error: 404 - Not found');
  });

  it('should throw YFinanceError for 4xx client errors without message', () => {
    const error = { response: { status: 400, data: {} } };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Client error: 400 - Unknown error');
  });

  it('should throw YFinanceError for 5xx server errors', () => {
    const error = { response: { status: 500, data: { message: 'Internal server error' } } };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Server error: 500 - Internal server error');
  });

  it('should throw YFinanceError for 5xx server errors without message', () => {
    const error = { response: { status: 503, data: {} } };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Server error: 503 - Internal server error');
  });

  it('should throw YFinanceError for network errors (ENOTFOUND)', () => {
    const error = { code: 'ENOTFOUND' };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Network error: Unable to connect to Yahoo Finance servers');
  });

  it('should throw YFinanceError for network errors (ECONNREFUSED)', () => {
    const error = { code: 'ECONNREFUSED' };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Network error: Unable to connect to Yahoo Finance servers');
  });

  it('should throw YFinanceError for timeout errors', () => {
    const error = { code: 'ETIMEDOUT' };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Request timeout: Yahoo Finance servers are not responding');
  });

  it('should throw YFinanceError for unknown errors with message', () => {
    const error = { message: 'Custom error message' };
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('Custom error message');
  });

  it('should throw YFinanceError for unknown errors without message', () => {
    const error = {};
    expect(() => handleApiError(error)).toThrow(YFinanceError);
    expect(() => handleApiError(error)).toThrow('An unknown error occurred');
  });
});

describe('withErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result when function succeeds', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await withErrorHandling(mockFn, 'test operation');
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle errors and re-throw with proper logging', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
    const promise = withErrorHandling(mockFn, 'test operation');

    await expect(promise).rejects.toThrow(YFinanceError);
  });

  it('should use default context when not provided', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
    const promise = withErrorHandling(mockFn);

    await expect(promise).rejects.toThrow(YFinanceError);
  });
});