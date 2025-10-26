/// <reference types="jest" />

import axios from 'axios';

// Mock axios before importing HttpClient
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Setup default mock for axios.create
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

import { HttpClient, defaultHttpClient } from '../../src/utils/http';

describe('HttpClient', () => {
  let client: HttpClient;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new HttpClient();
    mockResponse = {
      data: 'test data',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new HttpClient();
      expect(client).toBeDefined();
    });

    it('should create client with custom config', () => {
      const config = {
        baseURL: 'https://custom.api.com',
        timeout: 5000,
        retries: 5,
        retryDelay: 2000,
        rateLimitDelay: 200,
        userAgent: 'custom-agent/1.0',
      };
      const client = new HttpClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        post: jest.fn().mockResolvedValue(mockResponse),
        put: jest.fn().mockResolvedValue(mockResponse),
        delete: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);
    });

    it('should make GET request', async () => {
      const client = new HttpClient();
      const result = await client.get('/test');
      expect(result).toEqual(mockResponse);
    });

    it('should make POST request', async () => {
      const client = new HttpClient();
      const result = await client.post('/test', { data: 'test' });
      expect(result).toEqual(mockResponse);
    });

    it('should make PUT request', async () => {
      const client = new HttpClient();
      const result = await client.put('/test', { data: 'test' });
      expect(result).toEqual(mockResponse);
    });

    it('should make DELETE request', async () => {
      const client = new HttpClient();
      const result = await client.delete('/test');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);
    });

    it('should get text content', async () => {
      const client = new HttpClient();
      const result = await client.getText('/test');
      expect(result).toBe('test data');
    });

    it('should get JSON content', async () => {
      const jsonData = { key: 'value' };
      mockResponse.data = jsonData;
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const client = new HttpClient();
      const result = await client.getJson('/test');
      expect(result).toEqual(jsonData);
    });
  });

  describe('retry logic', () => {
    it('should not retry on 4xx client errors (except 429)', async () => {
      const clientError = {
        response: { status: 404 },
        config: { _retry: 0 },
      };

      // Create a fresh mock instance for this test
      const noRetryMockInstance = {
        get: jest.fn().mockRejectedValue(clientError),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockedAxios.create.mockReturnValueOnce(noRetryMockInstance as any);

      const client = new HttpClient({ retries: 3 });
      await expect(client.get('/test')).rejects.toEqual(clientError);
      expect(noRetryMockInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('should add delay between requests', async () => {
      jest.useFakeTimers();
      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new HttpClient({ rateLimitDelay: 100 });
      const promise = client.get('/test');

      // Fast-forward time
      jest.advanceTimersByTime(100);
      await promise;

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  describe('default instance', () => {
    it('should export default http client', () => {
      expect(defaultHttpClient).toBeDefined();
      expect(defaultHttpClient).toBeInstanceOf(HttpClient);
    });
  });
});