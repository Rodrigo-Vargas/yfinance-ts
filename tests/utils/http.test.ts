/// <reference types="jest" />

import { CurlClient } from 'curl-cffi';

// Mock curl-cffi before importing HttpClient
jest.mock('curl-cffi');
const mockedCurlClient = CurlClient as jest.MockedClass<typeof CurlClient>;

import { HttpClient, defaultHttpClient } from '../../src/utils/http';

describe('HttpClient', () => {
  let client: HttpClient;
  let mockCurlInstance: jest.Mocked<CurlClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurlInstance = {
      request: jest.fn(),
      onRequest: jest.fn(),
    } as any;

    mockedCurlClient.mockImplementation(() => mockCurlInstance);
    client = new HttpClient();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new HttpClient();
      expect(client).toBeDefined();
      expect(mockedCurlClient).toHaveBeenCalledWith({
        timeout: 30000,
        impersonate: 'chrome124',
        headers: {
          'User-Agent': 'yfinance-ts/0.1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });
    });

    it('should create client with custom config', () => {
      const config = {
        baseURL: 'https://custom.api.com',
        timeout: 5000,
        retries: 5,
        retryDelay: 2000,
        rateLimitDelay: 200,
        userAgent: 'custom-agent/1.0',
        impersonate: 'chrome120',
      };
      const client = new HttpClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('HTTP methods', () => {
    const mockCurlResponse = {
      status: 200,
      dataRaw: Buffer.from('test data'),
      data: 'test data',
      headers: {},
      url: '',
      request: {},
      options: {},
      stacks: [],
      index: 0,
      redirects: [],
      curl: null,
      text: 'test data',
      jar: null,
    };

    beforeEach(() => {
      mockCurlInstance.request.mockResolvedValue(mockCurlResponse as any);
    });

    it('should make GET request', async () => {
      const result = await client.get('/test');
      expect(result).toEqual(mockCurlResponse);
      expect(mockCurlInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://finance.yahoo.com/test',
      });
    });

    it('should make POST request', async () => {
      const result = await client.post('/test', { data: 'test' });
      expect(result).toEqual(mockCurlResponse);
      expect(mockCurlInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://finance.yahoo.com/test',
        data: { data: 'test' },
      });
    });

    it('should make PUT request', async () => {
      const result = await client.put('/test', { data: 'test' });
      expect(result).toEqual(mockCurlResponse);
      expect(mockCurlInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: 'https://finance.yahoo.com/test',
        data: { data: 'test' },
      });
    });

    it('should make DELETE request', async () => {
      const result = await client.delete('/test');
      expect(result).toEqual(mockCurlResponse);
      expect(mockCurlInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: 'https://finance.yahoo.com/test',
      });
    });
  });

  describe('utility methods', () => {
    const mockCurlResponse = {
      status: 200,
      dataRaw: Buffer.from('test data'),
      data: 'test data',
      headers: {},
      url: '',
      request: {},
      options: {},
      stacks: [],
      index: 0,
      redirects: [],
      curl: null,
      text: 'test data',
      jar: null,
    };

    beforeEach(() => {
      mockCurlInstance.request.mockResolvedValue(mockCurlResponse as any);
    });

    it('should get text content', async () => {
      const result = await client.getText('/test');
      expect(result).toBe('test data');
    });

    it('should get JSON content', async () => {
      const jsonData = { key: 'value' };
      const jsonResponse = {
        ...mockCurlResponse,
        dataRaw: Buffer.from(JSON.stringify(jsonData)),
        text: JSON.stringify(jsonData),
      };
      mockCurlInstance.request.mockResolvedValue(jsonResponse as any);

      const result = await client.getJson('/test');
      expect(result).toEqual(jsonData);
    });
  });

  describe('retry logic', () => {
    it('should not retry on 4xx client errors (except 429)', async () => {
      const clientError = {
        response: { status: 404 },
      };

      mockCurlInstance.request.mockRejectedValue(clientError);

      const client = new HttpClient({ retries: 3 });
      await expect(client.get('/test')).rejects.toEqual(clientError);
      expect(mockCurlInstance.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('should add delay between requests', async () => {
      jest.useFakeTimers();
      const mockCurlResponse = {
        status: 200,
        dataRaw: Buffer.from('test data'),
        data: 'test data',
        headers: {},
        url: '',
        request: {},
        options: {},
        stacks: [],
        index: 0,
        redirects: [],
        curl: null,
        text: 'test data',
        jar: null,
      };

      mockCurlInstance.request.mockResolvedValue(mockCurlResponse as any);

      const client = new HttpClient({ rateLimitDelay: 100 });
      const promise = client.get('/test');

      // Fast-forward time
      jest.advanceTimersByTime(100);
      await promise;

      expect(mockCurlInstance.request).toHaveBeenCalledTimes(1);
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