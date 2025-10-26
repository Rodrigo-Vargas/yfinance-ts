import { Ticker } from '../../src/core/ticker';
import { defaultHttpClient } from '../../src/utils/http';
import { logger } from '../../src/utils/logger';

describe('Ticker', () => {
  let ticker: Ticker;

  beforeEach(() => {
    ticker = new Ticker('AAPL');
  });

  describe('constructor', () => {
    it('should create a ticker with uppercase symbol', () => {
      const ticker = new Ticker('aapl');
      expect(ticker.symbol).toBe('AAPL');
    });
  });

  describe('info', () => {
    it('should fetch and cache ticker info', async () => {
      const mockApiResponse = {
        quoteSummary: {
          result: [{
            financialData: {
              currentPrice: { raw: 150.25, fmt: '150.25' },
              targetHighPrice: { raw: 200, fmt: '200.00' },
            },
            quoteType: {
              symbol: 'AAPL',
              shortName: 'Apple Inc.',
              longName: 'Apple Inc.',
              exchangeName: 'NASDAQ',
              currency: 'USD',
            },
            defaultKeyStatistics: {
              marketCap: { raw: 2500000000000, fmt: '2.5T' },
              volume: { raw: 50000000, fmt: '50M' },
            },
            assetProfile: {
              industry: 'Technology',
            },
            summaryDetail: {
              regularMarketPrice: { raw: 150.25, fmt: '150.25' },
              previousClose: { raw: 149.50, fmt: '149.50' },
              fiftyTwoWeekLow: { raw: 124.17, fmt: '124.17' },
              fiftyTwoWeekHigh: { raw: 198.23, fmt: '198.23' },
            },
          }],
        },
      };

      const mockGetJson = jest.spyOn(defaultHttpClient, 'getJson').mockResolvedValue(mockApiResponse);

      const result = await ticker.info();

      expect(mockGetJson).toHaveBeenCalledWith('https://query1.finance.yahoo.com/v7/finance/quoteSummary/AAPL', {
        params: {
          modules: 'financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail',
          corsDomain: 'finance.yahoo.com',
          formatted: 'false',
        },
      });
      expect(result.symbol).toBe('AAPL');
      expect(result.shortName).toBe('Apple Inc.');
      expect(result.regularMarketPrice).toBe(150.25);

      // Second call should use cache
      const result2 = await ticker.info();
      expect(mockGetJson).toHaveBeenCalledTimes(1); // Should not call again
      expect(result2).toBe(result);

      mockGetJson.mockRestore();
    });

    it('should handle API errors', async () => {
      const mockGetJson = jest.spyOn(defaultHttpClient, 'getJson').mockRejectedValue(new Error('Network error'));

      await expect(ticker.info()).rejects.toThrow('Network error');

      mockGetJson.mockRestore();
    });
  });

  describe('history', () => {
    it('should fetch historical data with default options', async () => {
      const mockHtml = '<html><body>Mock historical data</body></html>';
      const mockGetText = jest.spyOn(defaultHttpClient, 'getText').mockResolvedValue(mockHtml);
      const mockParseHistory = jest.spyOn(ticker as any, '_parseHistoryFromHtml').mockReturnValue([
        {
          date: new Date('2023-01-01'),
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000000,
        },
      ]);
      const mockRepairData = jest.spyOn(ticker as any, '_repairData').mockImplementation(() => {});

      const result = await ticker.history();

      expect(mockGetText).toHaveBeenCalledWith('/quote/AAPL/history?range=1mo&interval=1d&filter=history&frequency=1d&events=div%2Csplits');
      expect(mockParseHistory).toHaveBeenCalledWith(mockHtml);
      expect(mockRepairData).toHaveBeenCalledWith([
        {
          date: new Date('2023-01-01'),
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000000,
        },
      ]);
      expect(result.symbol).toBe('AAPL');
      expect(result.data).toHaveLength(1);
      expect(result.timezone).toBe('America/New_York');

      mockGetText.mockRestore();
      mockParseHistory.mockRestore();
      mockRepairData.mockRestore();
    });

    it('should fetch historical data with custom options', async () => {
      const mockHtml = '<html><body>Mock historical data</body></html>';
      const mockGetText = jest.spyOn(defaultHttpClient, 'getText').mockResolvedValue(mockHtml);
      const mockParseHistory = jest.spyOn(ticker as any, '_parseHistoryFromHtml').mockReturnValue([]);
      const mockRepairData = jest.spyOn(ticker as any, '_repairData').mockImplementation(() => {});

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      await ticker.history({
        period: '1mo',
        interval: '1d',
        start: startDate,
        end: endDate,
        prepost: true,
        auto_adjust: false,
        repair: false,
      });

      expect(mockGetText).toHaveBeenCalledWith(
        `/quote/AAPL/history?period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}&interval=1d&filter=history&frequency=1d&includePrePost=true`
      );
      expect(mockRepairData).not.toHaveBeenCalled();

      mockGetText.mockRestore();
      mockParseHistory.mockRestore();
      mockRepairData.mockRestore();
    });

    it('should handle API errors', async () => {
      const mockGetText = jest.spyOn(defaultHttpClient, 'getText').mockRejectedValue(new Error('Network error'));

      await expect(ticker.history()).rejects.toThrow('Network error');

      mockGetText.mockRestore();
    });
  });

  describe('isValid', () => {
    it('should return true for valid ticker', async () => {
      // Mock the info method to avoid actual API calls
      const mockInfo = jest.spyOn(ticker, 'info').mockResolvedValue({
        symbol: 'AAPL',
        shortName: 'Apple Inc.',
        currency: 'USD',
      } as any);

      const result = await ticker.isValid();
      expect(result).toBe(true);
      expect(mockInfo).toHaveBeenCalled();

      mockInfo.mockRestore();
    });

    it('should return false for invalid ticker', async () => {
      const mockInfo = jest.spyOn(ticker, 'info').mockRejectedValue(new Error('Invalid ticker'));

      const result = await ticker.isValid();
      expect(result).toBe(false);
      expect(mockInfo).toHaveBeenCalled();

      mockInfo.mockRestore();
    });
  });

  describe('getPrice', () => {
    it('should return regular market price when available', async () => {
      const mockInfo = jest.spyOn(ticker, 'info').mockResolvedValue({
        symbol: 'AAPL',
        regularMarketPrice: 150.25,
      } as any);

      const price = await ticker.getPrice();
      expect(price).toBe(150.25);

      mockInfo.mockRestore();
    });

    it('should return previous close when regular market price is not available', async () => {
      const mockInfo = jest.spyOn(ticker, 'info').mockResolvedValue({
        symbol: 'AAPL',
        previousClose: 149.50,
      } as any);

      const price = await ticker.getPrice();
      expect(price).toBe(149.50);

      mockInfo.mockRestore();
    });

    it('should return null when no price data is available', async () => {
      const mockInfo = jest.spyOn(ticker, 'info').mockResolvedValue({
        symbol: 'AAPL',
      } as any);

      const price = await ticker.getPrice();
      expect(price).toBeNull();

      mockInfo.mockRestore();
    });
  });

  describe('_buildHistoryParams', () => {
    it('should build params with period', () => {
      const params = (ticker as any)._buildHistoryParams({
        period: '1mo',
        interval: '1d',
        auto_adjust: true,
      });

      expect(params).toBe('range=1mo&interval=1d&filter=history&frequency=1d&events=div%2Csplits');
    });

    it('should build params with date range', () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const params = (ticker as any)._buildHistoryParams({
        start: startDate,
        end: endDate,
        interval: '1d',
        auto_adjust: true,
      });

      const expectedStart = Math.floor(startDate.getTime() / 1000);
      const expectedEnd = Math.floor(endDate.getTime() / 1000);
      expect(params).toBe(`period1=${expectedStart}&period2=${expectedEnd}&interval=1d&filter=history&frequency=1d&events=div%2Csplits`);
    });

    it('should build params with prepost enabled', () => {
      const params = (ticker as any)._buildHistoryParams({
        period: '1d',
        interval: '1m',
        prepost: true,
        auto_adjust: true,
      });

      expect(params).toBe('range=1d&interval=1m&filter=history&frequency=1m&includePrePost=true&events=div%2Csplits');
    });

    it('should build params with auto_adjust disabled', () => {
      const params = (ticker as any)._buildHistoryParams({
        period: '1d',
        interval: '1d',
        auto_adjust: false,
      });

      expect(params).toBe('range=1d&interval=1d&filter=history&frequency=1d');
    });
  });

  describe('_parseInfoFromHtml', () => {
    it('should return basic ticker info structure', () => {
      const html = '<html><body>Some HTML content</body></html>';
      const result = (ticker as any)._parseInfoFromHtml(html);

      expect(result).toEqual({
        symbol: 'AAPL',
        shortName: 'AAPL',
        currency: 'USD',
        exchange: 'UNKNOWN',
      });
    });
  });

  describe('_parseHistoryFromHtml', () => {
    it('should return empty array for placeholder implementation', () => {
      const html = '<html><body>Historical data HTML</body></html>';
      const result = (ticker as any)._parseHistoryFromHtml(html);

      expect(result).toEqual([]);
    });
  });

  describe('_repairData', () => {
    it('should call logger debug with data length', () => {
      const loggerSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
      const data = [
        { date: new Date(), open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
        { date: new Date(), open: 102, high: 107, low: 98, close: 105, volume: 1200000 },
      ];

      (ticker as any)._repairData(data);

      expect(loggerSpy).toHaveBeenCalledWith('Repairing data for AAPL (2 points)');

      loggerSpy.mockRestore();
    });
  });
});