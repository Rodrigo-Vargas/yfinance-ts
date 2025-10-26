/// <reference types="jest" />

import { Search, SearchResult } from '../../src/data/search';
import { defaultHttpClient } from '../../src/utils/http';

// Mock the HTTP client
jest.mock('../../src/utils/http', () => ({
  defaultHttpClient: {
    get: jest.fn(),
  },
}));

const mockHttpClient = defaultHttpClient as jest.Mocked<typeof defaultHttpClient>;

// Helper to create mock response
const createMockResponse = (data: any): any => ({
  status: 200,
  dataRaw: Buffer.from(JSON.stringify(data)),
  data: data,
  headers: {},
  url: '',
  request: {},
  options: {},
  stacks: [],
  index: 0,
  redirects: [],
  curl: null,
  text: JSON.stringify(data),
  jar: null,
});

describe('Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should search for tickers successfully', async () => {
      const mockData = {
        quotes: [
          {
            symbol: 'AAPL',
            shortname: 'Apple Inc.',
            typeDisp: 'Equity',
            exchange: 'NMS',
            market: 'us_market',
            country: 'United States',
            sector: 'Technology',
            industry: 'Consumer Electronics',
          },
          {
            symbol: 'AAPL.MX',
            shortname: 'Apple Inc.',
            typeDisp: 'Equity',
            exchange: 'MEX',
            market: 'mx_market',
            country: 'Mexico',
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(createMockResponse(mockData));

      const results = await Search.search('Apple');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://query2.finance.yahoo.com/v1/finance/search',
        {
          params: {
            q: 'Apple',
            quotesCount: '10',
            newsCount: '0',
            enableFuzzyQuery: 'true',
            enableEnhancedTrivialQuery: 'true',
          },
        }
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'Equity',
        exchange: 'NMS',
        market: 'us_market',
        country: 'United States',
        sector: 'Technology',
        industry: 'Consumer Electronics',
      });
    });

    it('should handle empty search results', async () => {
      mockHttpClient.get.mockResolvedValue(createMockResponse({ quotes: [] }));

      const results = await Search.search('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should handle missing quotes in response', async () => {
      mockHttpClient.get.mockResolvedValue(createMockResponse({}));

      const results = await Search.search('test');

      expect(results).toHaveLength(0);
    });

    it('should throw error for empty query', async () => {
      await expect(Search.search('')).rejects.toThrow('Search query cannot be empty');
      await expect(Search.search('   ')).rejects.toThrow('Search query cannot be empty');
    });

    it('should handle custom search options', async () => {
      const mockData = {
        quotes: [
          {
            symbol: 'AAPL',
            shortname: 'Apple Inc.',
            typeDisp: 'Equity',
            exchange: 'NMS',
            market: 'us_market',
            country: 'United States',
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(createMockResponse(mockData));

      await Search.search('Apple', {
        quotesCount: 5,
        newsCount: 2,
        enableFuzzyQuery: false,
        enableEnhancedTrivialQuery: false,
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://query2.finance.yahoo.com/v1/finance/search',
        {
          params: {
            q: 'Apple',
            quotesCount: '5',
            newsCount: '2',
            enableFuzzyQuery: 'false',
            enableEnhancedTrivialQuery: 'false',
          },
        }
      );
    });

    it('should handle network errors', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));

      await expect(Search.search('Apple')).rejects.toThrow('Failed to search for "Apple"');
    });
  });

  describe('searchOne', () => {
    it('should return first result', async () => {
      const mockData = {
        quotes: [
          {
            symbol: 'AAPL',
            shortname: 'Apple Inc.',
            typeDisp: 'Equity',
            exchange: 'NMS',
            market: 'us_market',
            country: 'United States',
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(createMockResponse(mockData));

      const result = await Search.searchOne('Apple');

      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'Equity',
        exchange: 'NMS',
        market: 'us_market',
        country: 'United States',
        sector: undefined,
        industry: undefined,
      });
    });

    it('should return null when no results found', async () => {
      mockHttpClient.get.mockResolvedValue(createMockResponse({ quotes: [] }));

      const result = await Search.searchOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('suggestions', () => {
    it('should return symbol suggestions', async () => {
      const mockData = {
        quotes: [
          { symbol: 'AAPL', shortname: 'Apple Inc.' },
          { symbol: 'AAPL.MX', shortname: 'Apple Inc.' },
          { symbol: 'APPL', shortname: 'Applied Materials' },
        ],
      };

      mockHttpClient.get.mockResolvedValue(createMockResponse(mockData));

      const suggestions = await Search.suggestions('app', 3);

      expect(suggestions).toEqual(['AAPL', 'AAPL.MX', 'APPL']);
    });

    it('should return empty array for empty query', async () => {
      const suggestions = await Search.suggestions('');

      expect(suggestions).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));

      const suggestions = await Search.suggestions('test');

      expect(suggestions).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockData = {
        quotes: [
          { symbol: 'AAPL' },
          { symbol: 'GOOGL' },
          { symbol: 'MSFT' },
        ],
      };

      mockHttpClient.get.mockResolvedValue(createMockResponse(mockData));

      const suggestions = await Search.suggestions('a', 3);

      expect(suggestions).toHaveLength(3);
      expect(suggestions).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    });
  });
});