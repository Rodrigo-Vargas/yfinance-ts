import { download, downloadAsTable } from '../../src/data/download';
import { defaultHttpClient } from '../../src/utils/http';

jest.mock('../../src/utils/http');

describe('download', () => {
  const mockGetText = jest.fn();

  beforeEach(() => {
    (defaultHttpClient as any).getText = mockGetText;
    jest.clearAllMocks();
  });

  describe('download function', () => {
    it('should download data for a single ticker', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download('AAPL', { period: '1d' });

      expect(result).toHaveProperty('AAPL');
      expect(result.AAPL).toHaveProperty('symbol', 'AAPL');
      expect(result.AAPL).toHaveProperty('data');
      expect(Array.isArray(result.AAPL.data)).toBe(true);
      expect(mockGetText).toHaveBeenCalledWith('/quote/AAPL/history?range=1d&interval=1d&filter=history&frequency=1d&events=div%2Csplits');
    });

    it('should download data for multiple tickers', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download(['AAPL', 'GOOGL'], { period: '1d' });

      expect(result).toHaveProperty('AAPL');
      expect(result).toHaveProperty('GOOGL');
      expect(result.AAPL.symbol).toBe('AAPL');
      expect(result.GOOGL.symbol).toBe('GOOGL');
      expect(mockGetText).toHaveBeenCalledTimes(2);
    });

    it('should handle string ticker input', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download('AAPL');

      expect(result).toHaveProperty('AAPL');
      expect(mockGetText).toHaveBeenCalledWith('/quote/AAPL/history?range=1mo&interval=1d&filter=history&frequency=1d&events=div%2Csplits');
    });

    it('should use default options when none provided', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download('AAPL');

      expect(mockGetText).toHaveBeenCalledWith('/quote/AAPL/history?range=1mo&interval=1d&filter=history&frequency=1d&events=div%2Csplits');
      expect(result).toHaveProperty('AAPL');
    });

    it('should handle errors gracefully for individual tickers', async () => {
      mockGetText
        .mockResolvedValueOnce('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000')
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await download(['AAPL', 'GOOGL']);

      expect(result.AAPL.data).toBeDefined(); // Successful ticker has data
      expect(result.GOOGL.data).toEqual([]); // Failed ticker gets empty array
    });
  });

  describe('downloadAsTable function', () => {
    it('should return data in table format', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await downloadAsTable('AAPL', { period: '1d' });

      expect(result).toHaveProperty('AAPL');
      expect(result.AAPL).toHaveProperty('symbol', 'AAPL');
      expect(result.AAPL).toHaveProperty('data');
    });

    it('should handle multiple tickers in table format', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await downloadAsTable(['AAPL', 'GOOGL'], { period: '1d' });

      expect(result).toHaveProperty('AAPL');
      expect(result).toHaveProperty('GOOGL');
    });
  });

  describe('data repair functionality', () => {
    it('should apply data repair when repair option is enabled', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download('AAPL', { period: '1d', repair: true });

      expect(result).toHaveProperty('AAPL');
      expect(result.AAPL).toHaveProperty('data');
    });

    it('should skip data repair when repair option is disabled', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      const result = await download('AAPL', { period: '1d', repair: false });

      expect(result).toHaveProperty('AAPL');
      expect(result.AAPL).toHaveProperty('data');
    });
  });

  describe('parameter building', () => {
    it('should build params with date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      await download('AAPL', {
        start: startDate,
        end: endDate,
        interval: '1d',
      });

      const expectedStart = Math.floor(startDate.getTime() / 1000);
      const expectedEnd = Math.floor(endDate.getTime() / 1000);
      expect(mockGetText).toHaveBeenCalledWith(
        `/quote/AAPL/history?period1=${expectedStart}&period2=${expectedEnd}&interval=1d&filter=history&frequency=1d&events=div%2Csplits`
      );
    });

    it('should build params with prepost enabled', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      await download('AAPL', {
        period: '1d',
        interval: '1m',
        prepost: true,
      });

      expect(mockGetText).toHaveBeenCalledWith(
        '/quote/AAPL/history?range=1d&interval=1m&filter=history&frequency=1m&includePrePost=true&events=div%2Csplits'
      );
    });

    it('should build params with auto_adjust disabled', async () => {
      mockGetText.mockResolvedValue('Date,Open,High,Low,Close,Adj Close,Volume\n2023-01-01,100,105,95,102,102,1000000');

      await download('AAPL', {
        period: '1d',
        interval: '1d',
        auto_adjust: false,
      });

      expect(mockGetText).toHaveBeenCalledWith(
        '/quote/AAPL/history?range=1d&interval=1d&filter=history&frequency=1d'
      );
    });
  });
});