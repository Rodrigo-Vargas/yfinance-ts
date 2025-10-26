/// <reference types="jest" />

import { YFinanceError, YFinanceRateLimitError } from '../../src/utils/types';

describe('YFinanceError', () => {
  it('should create error with message', () => {
    const error = new YFinanceError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('YFinanceError');
    expect(error.code).toBeUndefined();
  });

  it('should create error with message and code', () => {
    const error = new YFinanceError('test message', 'TEST_CODE');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('YFinanceError');
    expect(error.code).toBe('TEST_CODE');
  });
});

describe('YFinanceRateLimitError', () => {
  it('should create rate limit error with default message', () => {
    const error = new YFinanceRateLimitError();
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.name).toBe('YFinanceRateLimitError');
    expect(error.code).toBe('RATE_LIMIT');
  });

  it('should create rate limit error with custom message', () => {
    const error = new YFinanceRateLimitError('Custom message');
    expect(error.message).toBe('Custom message');
    expect(error.name).toBe('YFinanceRateLimitError');
    expect(error.code).toBe('RATE_LIMIT');
  });
});