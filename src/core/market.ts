import { defaultHttpClient } from '../utils/http';
import { logger, withErrorHandling } from '../utils/logger';
import { MarketData } from '../utils/types';

export interface MarketStatus {
  marketState: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' | 'PREPRE' | 'POSTPOST';
  regularMarketTime?: Date;
  preMarketTime?: Date;
  postMarketTime?: Date;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  shortName?: string;
  longName?: string;
  timezone?: string;
  gmtoffset?: number;
}

export interface MarketSummary {
  marketSummaryResponse: {
    result: MarketSummaryItem[];
    error?: any;
  };
}

export interface MarketSummaryItem {
  fullExchangeName: string;
  exchangeTimezoneName: string;
  symbol: string;
  gmtOffSetMilliseconds: number;
  language: string;
  regularMarketTime: {
    raw: number;
    fmt: string;
  };
  regularMarketChangePercent: {
    raw: number;
    fmt: string;
  };
  regularMarketPreviousClose: {
    raw: number;
    fmt: string;
  };
  regularMarketPrice: {
    raw: number;
    fmt: string;
  };
  spark: {
    symbol: string;
    dataGranularity: number;
    data: number[];
    timestamp: number[];
  };
  shortName: string;
  exchange: string;
  market: string;
  quoteType: string;
  marketState: string;
  region: string;
  regularMarketChange: {
    raw: number;
    fmt: string;
  };
  regularMarketDayRange: {
    raw: string;
    fmt: string;
  };
  regularMarketDayHigh: {
    raw: number;
    fmt: string;
  };
  regularMarketDayLow: {
    raw: number;
    fmt: string;
  };
  regularMarketVolume: {
    raw: number;
    fmt: string;
  };
  fiftyTwoWeekRange: {
    raw: string;
    fmt: string;
  };
  fiftyTwoWeekHigh: {
    raw: number;
    fmt: string;
  };
  fiftyTwoWeekLow: {
    raw: number;
    fmt: string;
  };
  sourceInterval: number;
  exchangeDataDelayedBy: number;
  tradeable: boolean;
  cryptoTradeable: boolean;
  marketCap?: {
    raw: number;
    fmt: string;
    longFmt: string;
  };
}

export class Market {
  /**
   * Get market status and summary information
   */
  async getStatus(): Promise<MarketStatus> {
    return withErrorHandling(async () => {
      logger.debug('Fetching market status');

      // Get market status from a major index like ^GSPC (S&P 500)
      const url = '/quote/^GSPC';
      const response = await defaultHttpClient.getText(url);

      return this._parseMarketStatus(response);
    }, 'fetching market status');
  }

  /**
   * Get market summary for all major markets
   */
  async getSummary(): Promise<MarketSummaryItem[]> {
    return withErrorHandling(async () => {
      logger.debug('Fetching market summary');

      const url = '/market/v2/get-summary';
      const response = await defaultHttpClient.getJson<MarketSummary>(url);

      return response.marketSummaryResponse.result;
    }, 'fetching market summary');
  }

  /**
   * Check if market is currently open
   */
  async isOpen(): Promise<boolean> {
    const status = await this.getStatus();
    return status.marketState === 'REGULAR' || status.marketState === 'PRE' || status.marketState === 'POST';
  }

  /**
   * Get current market state
   */
  async getState(): Promise<string> {
    const status = await this.getStatus();
    return status.marketState;
  }

  /**
   * Get market data for a specific symbol
   */
  async getData(symbol: string = '^GSPC'): Promise<MarketData> {
    return withErrorHandling(async () => {
      logger.debug(`Fetching market data for ${symbol}`);

      const url = `/quote/${symbol}`;
      const response = await defaultHttpClient.getText(url);

      return this._parseMarketData(response, symbol);
    }, `fetching market data for ${symbol}`);
  }

  private _parseMarketStatus(_html: string): MarketStatus {
    // This is a placeholder implementation
    // Real implementation would parse the HTML/JSON response from Yahoo Finance
    // to extract market status information

    const status: MarketStatus = {
      marketState: 'CLOSED', // Default to closed
      timezone: 'America/New_York',
      gmtoffset: -18000, // UTC-5
    };

    // TODO: Implement actual HTML parsing
    // This would involve parsing the JSON response and extracting market status

    return status;
  }

  private _parseMarketData(_html: string, _symbol: string): MarketData {
    // This is a placeholder implementation
    // Real implementation would parse the HTML/JSON response from Yahoo Finance

    const data: MarketData = {
      marketState: 'CLOSED',
      regularMarketTime: new Date(),
      charts: [],
    };

    // TODO: Implement actual data parsing
    // This would involve parsing the JSON response and extracting chart data

    return data;
  }
}

// Default market instance
export const market = new Market();