import { Market } from '../../src/core/market';
import { defaultHttpClient } from '../../src/utils/http';

jest.mock('../../src/utils/http');

describe('Market', () => {
  let market: Market;
  const mockGetText = jest.fn();
  const mockGetJson = jest.fn();

  beforeEach(() => {
    market = new Market();
    (defaultHttpClient as any).getText = mockGetText;
    (defaultHttpClient as any).getJson = mockGetJson;
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should fetch market status', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      const status = await market.getStatus();

      expect(status).toHaveProperty('marketState');
      expect(status).toHaveProperty('timezone');
      expect(mockGetText).toHaveBeenCalledWith('/quote/^GSPC');
    });
  });

  describe('getSummary', () => {
    it('should fetch market summary', async () => {
      const mockSummary = {
        marketSummaryResponse: {
          result: [
            {
              symbol: '^GSPC',
              shortName: 'S&P 500',
              regularMarketPrice: { raw: 4500, fmt: '4,500.00' },
              regularMarketChangePercent: { raw: 1.5, fmt: '+1.50%' },
            },
          ],
        },
      };

      mockGetJson.mockResolvedValue(mockSummary);

      const summary = await market.getSummary();

      expect(Array.isArray(summary)).toBe(true);
      expect(summary).toHaveLength(1);
      expect(summary[0].symbol).toBe('^GSPC');
      expect(mockGetJson).toHaveBeenCalledWith('/market/v2/get-summary');
    });
  });

  describe('isOpen', () => {
    it('should return true when market is open', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      // Mock the _parseMarketStatus to return open state
      const parseSpy = jest.spyOn(market as any, '_parseMarketStatus');
      parseSpy.mockReturnValue({ marketState: 'REGULAR' });

      const isOpen = await market.isOpen();
      expect(isOpen).toBe(true);

      parseSpy.mockRestore();
    });

    it('should return false when market is closed', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      const parseSpy = jest.spyOn(market as any, '_parseMarketStatus');
      parseSpy.mockReturnValue({ marketState: 'CLOSED' });

      const isOpen = await market.isOpen();
      expect(isOpen).toBe(false);

      parseSpy.mockRestore();
    });
  });

  describe('getState', () => {
    it('should return current market state', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      const parseSpy = jest.spyOn(market as any, '_parseMarketStatus');
      parseSpy.mockReturnValue({ marketState: 'PRE' });

      const state = await market.getState();
      expect(state).toBe('PRE');

      parseSpy.mockRestore();
    });
  });

  describe('getData', () => {
    it('should fetch market data for default symbol', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      const data = await market.getData();

      expect(data).toHaveProperty('marketState');
      expect(data).toHaveProperty('regularMarketTime');
      expect(data).toHaveProperty('charts');
      expect(mockGetText).toHaveBeenCalledWith('/quote/^GSPC');
    });

    it('should fetch market data for specified symbol', async () => {
      mockGetText.mockResolvedValue('<html>Market data</html>');

      const data = await market.getData('^DJI');

      expect(data).toHaveProperty('marketState');
      expect(mockGetText).toHaveBeenCalledWith('/quote/^DJI');
    });
  });
});