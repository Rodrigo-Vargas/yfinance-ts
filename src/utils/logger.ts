import { YFinanceError, YFinanceRateLimitError } from './types';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Error handling utilities
export function handleApiError(error: any): never {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    if (status === 429) {
      throw new YFinanceRateLimitError('Rate limit exceeded. Please try again later.');
    }

    if (status >= 400 && status < 500) {
      throw new YFinanceError(`Client error: ${status} - ${data?.message || 'Unknown error'}`);
    }

    if (status >= 500) {
      throw new YFinanceError(`Server error: ${status} - ${data?.message || 'Internal server error'}`);
    }
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    throw new YFinanceError('Network error: Unable to connect to Yahoo Finance servers');
  }

  if (error.code === 'ETIMEDOUT') {
    throw new YFinanceError('Request timeout: Yahoo Finance servers are not responding');
  }

  throw new YFinanceError(error.message || 'An unknown error occurred');
}

// Utility to wrap async functions with error handling
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string = 'operation'
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`Error in ${context}:`, error as Error);
    handleApiError(error);
  }
}