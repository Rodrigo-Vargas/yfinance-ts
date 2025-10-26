import { defaultHttpClient } from '../utils/http';
import { logger, withErrorHandling } from '../utils/logger';
import {
  TickerInfo,
  HistoricalData,
  HistoricalDataPoint,
  Interval,
  Period,
  Prepost,
  AutoAdjust,
  Repair,
} from '../utils/types';

export interface TickerHistoryOptions {
  period?: Period;
  interval?: Interval;
  start?: Date | string;
  end?: Date | string;
  prepost?: Prepost;
  auto_adjust?: AutoAdjust;
  repair?: Repair;
  keepna?: boolean;
}

export class Ticker {
  public symbol: string;
  private _info: TickerInfo | null = null;
  private _history: HistoricalData | null = null;

  constructor(symbol: string) {
    this.symbol = symbol.toUpperCase();
  }

  /**
   * Get basic information about the ticker
   */
  async info(): Promise<TickerInfo> {
    return withErrorHandling(async () => {
      if (this._info) {
        return this._info;
      }

      logger.debug(`Fetching info for ${this.symbol}`);

      // Try Yahoo Finance API first
      try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quoteSummary/${this.symbol}`;
        const params = {
          modules: 'financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail',
          corsDomain: 'finance.yahoo.com',
          formatted: 'false',
        };

        const response = await defaultHttpClient.getJson(url, { params });

        if (!response || !response.quoteSummary || !response.quoteSummary.result || response.quoteSummary.result.length === 0) {
          throw new Error(`No data found for ticker: ${this.symbol}`);
        }

        const result = response.quoteSummary.result[0];
        if (!result) {
          throw new Error(`No data found for ticker: ${this.symbol}`);
        }

        // Extract data from API response - flatten nested structures like Python does
        const processedInfo: any = {};

        // Helper function to flatten nested dicts
        const flatten = (obj: any) => {
          for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === 'object' && 'raw' in v && 'fmt' in v) {
              // Handle Yahoo's {raw, fmt} format
              processedInfo[k] = (k === 'maxAge' && v.raw === 1) ? 86400 : v.raw;
            } else if (v && typeof v === 'object' && !Array.isArray(v)) {
              // Recursively flatten nested objects
              flatten(v);
            } else if (v !== null && v !== undefined) {
              processedInfo[k] = v;
            }
          }
        };

        // Process all modules
        for (const module of ['financialData', 'quoteType', 'defaultKeyStatistics', 'assetProfile', 'summaryDetail']) {
          if (result[module]) {
            flatten(result[module]);
          }
        }

        // Also process any additional quote data
        if (result.symbol) {
          processedInfo.symbol = result.symbol;
        }

        this._info = {
          symbol: this.symbol,
          shortName: processedInfo.shortName || processedInfo.longName || this.symbol,
          longName: processedInfo.longName || processedInfo.shortName,
          currency: processedInfo.currency || 'USD',
          exchange: processedInfo.exchangeName || processedInfo.exchange || processedInfo.fullExchangeName || 'UNKNOWN',
          regularMarketPrice: processedInfo.regularMarketPrice,
          previousClose: processedInfo.previousClose || processedInfo.regularMarketPreviousClose,
          marketCap: processedInfo.marketCap,
          volume: processedInfo.regularMarketVolume || processedInfo.volume,
          averageVolume: processedInfo.averageVolume || processedInfo.averageDailyVolume10Day?.raw || processedInfo.averageDailyVolume3Month?.raw,
          fiftyTwoWeekLow: processedInfo.fiftyTwoWeekLow,
          fiftyTwoWeekHigh: processedInfo.fiftyTwoWeekHigh,
          fiftyDayAverage: processedInfo.fiftyDayAverage,
          twoHundredDayAverage: processedInfo.twoHundredDayAverage,
        };

        return this._info;
      } catch (apiError) {
        logger.debug(`API call failed for ${this.symbol}, falling back to HTML scraping:`, apiError);

        // Fallback to HTML scraping
        const url = `https://finance.yahoo.com/quote/${this.symbol}`;
        const html = await defaultHttpClient.getText(url);
        this._info = await this._parseInfoFromHtml(html);
        return this._info;
      }
    }, `fetching info for ${this.symbol}`);
  }

  /**
   * Get historical market data
   */
  async history(options: TickerHistoryOptions = {}): Promise<HistoricalData> {
    return withErrorHandling(async () => {
      const {
        period = '1mo',
        interval = '1d',
        start,
        end,
        prepost = false,
        auto_adjust = true,
        repair = true,
      } = options;

      logger.debug(`Fetching history for ${this.symbol} with period: ${period}, interval: ${interval}`);

      const params = this._buildHistoryParams({
        period,
        interval,
        start,
        end,
        prepost,
        auto_adjust,
      });

      const url = `/quote/${this.symbol}/history?${params}`;
      const response = await defaultHttpClient.getText(url);

      const data = this._parseHistoryFromHtml(response);

      if (repair) {
        // Apply data repair logic here
        this._repairData(data);
      }

      this._history = {
        symbol: this.symbol,
        data,
        timezone: 'America/New_York', // Default, would be parsed from response
      };

      return this._history;
    }, `fetching history for ${this.symbol}`);
  }

  /**
   * Get current price
   */
  async getPrice(): Promise<number | null> {
    const info = await this.info();
    return info.regularMarketPrice || info.previousClose || null;
  }

  /**
   * Check if ticker is valid
   */
  async isValid(): Promise<boolean> {
    try {
      await this.info();
      return true;
    } catch (error) {
      return false;
    }
  }

  private _buildHistoryParams(options: {
    period?: Period;
    interval?: Interval;
    start?: Date | string;
    end?: Date | string;
    prepost?: boolean;
    auto_adjust?: boolean;
  }): string {
    const params = new URLSearchParams();

    if (options.start) {
      const startDate = options.start instanceof Date ? options.start : new Date(options.start);
      params.append('period1', Math.floor(startDate.getTime() / 1000).toString());
    }

    if (options.end) {
      const endDate = options.end instanceof Date ? options.end : new Date(options.end);
      params.append('period2', Math.floor(endDate.getTime() / 1000).toString());
    }

    if (options.period && !options.start && !options.end) {
      params.append('range', options.period);
    }

    params.append('interval', options.interval || '1d');
    params.append('filter', 'history');
    params.append('frequency', options.interval || '1d');

    if (options.prepost) {
      params.append('includePrePost', 'true');
    }

    if (options.auto_adjust) {
      params.append('events', 'div,splits');
    }

    return params.toString();
  }

  private async _parseInfoFromHtml(html: string): Promise<TickerInfo> {
    // Check if the ticker is invalid by looking for error indicators in the HTML
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('symbol not found') ||
        lowerHtml.includes('no results for') ||
        lowerHtml.includes('quote not found') ||
        lowerHtml.includes('will be right back')) {

      // If ticker contains a dot and is not found, try the ticker without dot
      if (this.symbol.includes('.')) {
        const tickerWithoutDot = this.symbol.replace(/\./g, '');
        logger.warn(`Ticker "${this.symbol}" not found. Trying "${tickerWithoutDot}" instead.`);

        try {
          // Try to fetch data for the corrected ticker
          const correctedUrl = `https://finance.yahoo.com/quote/${tickerWithoutDot}`;
          const correctedHtml = await defaultHttpClient.getText(correctedUrl);

          // Check if the corrected ticker exists
          const correctedLowerHtml = correctedHtml.toLowerCase();
          if (!correctedLowerHtml.includes('symbol not found') &&
              !correctedLowerHtml.includes('no results for') &&
              !correctedLowerHtml.includes('quote not found') &&
              !correctedLowerHtml.includes('will be right back')) {

            logger.warn(`Successfully found data for "${tickerWithoutDot}". Using corrected ticker.`);
            // Parse the corrected HTML directly using the same logic but with corrected symbol
            const correctedInfo = this._parseTickerInfoFromHtml(correctedHtml, tickerWithoutDot);
            if (correctedInfo) {
              // Update the symbol to the original requested symbol for consistency
              correctedInfo.symbol = this.symbol;
              return correctedInfo;
            } else {
              throw new Error(`Failed to parse data for corrected ticker: ${tickerWithoutDot}`);
            }
          }
        } catch (correctedError) {
          logger.debug(`Corrected ticker "${tickerWithoutDot}" also failed:`, correctedError);
        }

        logger.warn(`Neither "${this.symbol}" nor "${tickerWithoutDot}" found.`);
      }

      throw new Error(`Invalid ticker symbol: ${this.symbol}`);
    }

    // Try to extract JSON data from the HTML
    // Yahoo Finance embeds quote data as JSON strings in script tags or data attributes
    const info: TickerInfo = {
      symbol: this.symbol,
      shortName: this.symbol, // Default fallback
      currency: 'USD',
      exchange: 'UNKNOWN',
    };

    try {
      // Look for quote data in the HTML - it might be in script tags or data attributes
      // First, try to find JSON data containing the symbol
      const jsonMatches = html.match(new RegExp(`"symbol"\\s*:\\s*"${this.symbol}"[^}]*}`, 'g'));
      if (jsonMatches && jsonMatches.length > 0) {
        // Parse the JSON data
        const jsonStr = jsonMatches[0];
        try {
          const quoteData = JSON.parse(jsonStr);
          if (quoteData) {
            info.shortName = quoteData.shortName || quoteData.longName || this.symbol;
            info.longName = quoteData.longName;
            info.regularMarketPrice = quoteData.regularMarketPrice?.raw;
            info.previousClose = quoteData.previousClose?.raw || quoteData.chartPreviousClose?.raw;
            info.currency = quoteData.currency || 'USD';
            info.exchange = quoteData.exchange || quoteData.fullExchangeName || 'UNKNOWN';
            info.marketCap = quoteData.marketCap?.raw;
            info.volume = quoteData.regularMarketVolume?.raw;
            info.averageVolume = quoteData.averageVolume?.raw;
            info.fiftyTwoWeekLow = quoteData.fiftyTwoWeekLow?.raw;
            info.fiftyTwoWeekHigh = quoteData.fiftyTwoWeekHigh?.raw;
            info.fiftyDayAverage = quoteData.fiftyDayAverage?.raw;
            info.twoHundredDayAverage = quoteData.twoHundredDayAverage?.raw;
          }
        } catch (parseError) {
          console.warn(`Failed to parse quote data for ${this.symbol}:`, parseError);
        }
      }

      // If we didn't find structured data, try parsing embedded JSON strings
      // Yahoo Finance embeds data as escaped JSON in script tags
      if (!info.regularMarketPrice) {
        // Look for embedded JSON data that contains price info for this specific symbol
        // Pattern: "symbol":"ATEN"[^}]*"regularMarketPrice\":123.45
        const symbolPricePattern = new RegExp(`"symbol"\\s*:\\s*"${this.symbol}"[^}]*regularMarketPrice\\":([0-9.]+)`, 'i');
        const symbolPriceMatch = html.match(symbolPricePattern);

        if (symbolPriceMatch && symbolPriceMatch[1]) {
          info.regularMarketPrice = parseFloat(symbolPriceMatch[1]);

          // Try to extract company name from the same embedded data
          const namePattern = new RegExp(`"symbol"\\s*:\\s*"${this.symbol}"[^}]*longName\\":\\"([^"]+)\\"`, 'i');
          const nameMatch = html.match(namePattern);
          if (nameMatch && nameMatch[1]) {
            info.longName = nameMatch[1].replace(/\\/g, '');
            info.shortName = info.longName;
          }

          // Try to extract previousClose
          const prevClosePattern = new RegExp(`"symbol"\\s*:\\s*"${this.symbol}"[^}]*previousClose\\":([0-9.]+)`, 'i');
          const prevCloseMatch = html.match(prevClosePattern);
          if (prevCloseMatch && prevCloseMatch[1]) {
            info.previousClose = parseFloat(prevCloseMatch[1]);
          }
        } else {
          // Fallback to the old pattern if symbol-specific pattern doesn't work
          const pricePattern = /regularMarketPrice\\":([0-9.]+)/;
          const priceMatch = html.match(pricePattern);

          if (priceMatch && priceMatch[1]) {
            info.regularMarketPrice = parseFloat(priceMatch[1]);

            // Try to extract company name from the same embedded data
            const namePattern = /longName\\":\\"([^"]+)\\"/;
            const nameMatch = html.match(namePattern);
            if (nameMatch && nameMatch[1]) {
              info.longName = nameMatch[1].replace(/\\/g, '');
              info.shortName = info.longName;
            }

            // Try to extract previousClose
            const prevClosePattern = /previousClose\\":([0-9.]+)/;
            const prevCloseMatch = html.match(prevClosePattern);
            if (prevCloseMatch && prevCloseMatch[1]) {
              info.previousClose = parseFloat(prevCloseMatch[1]);
            }
          }
        }
      }

      // If we didn't find structured data, try regex extraction as fallback
      if (!info.regularMarketPrice) {
        // Look for regularMarketPrice in the HTML
        const priceMatch = html.match(new RegExp(`"regularMarketPrice"\\s*:\\s*{\\s*"raw"\\s*:\\s*([0-9.]+)`));
        if (priceMatch && priceMatch[1]) {
          info.regularMarketPrice = parseFloat(priceMatch[1]);
        }

        // Look for previousClose
        const prevCloseMatch = html.match(new RegExp(`"previousClose"\\s*:\\s*{\\s*"raw"\\s*:\\s*([0-9.]+)`));
        if (prevCloseMatch && prevCloseMatch[1]) {
          info.previousClose = parseFloat(prevCloseMatch[1]);
        }

        // Look for shortName
        const shortNameMatch = html.match(new RegExp(`"shortName"\\s*:\\s*"([^"]+)"`));
        if (shortNameMatch && shortNameMatch[1]) {
          info.shortName = shortNameMatch[1];
        }
      }

    } catch (error) {
      console.warn(`Error parsing HTML for ${this.symbol}:`, error);
      // Fall back to basic info
    }

    return info;
  }

  private _parseTickerInfoFromHtml(html: string, symbol: string): TickerInfo | null {
    // Try to extract JSON data from the HTML
    // Yahoo Finance embeds quote data as JSON strings in script tags or data attributes
    const info: TickerInfo = {
      symbol: symbol,
      shortName: symbol, // Default fallback
      currency: 'USD',
      exchange: 'UNKNOWN',
    };

    try {
      // Look for quote data in the HTML - it might be in script tags or data attributes
      // First, try to find JSON data containing the symbol
      const jsonMatches = html.match(new RegExp(`"symbol"\\s*:\\s*"${symbol}"[^}]*}`, 'g'));
      if (jsonMatches && jsonMatches.length > 0) {
        // Parse the JSON data
        const jsonStr = jsonMatches[0];
        try {
          const quoteData = JSON.parse(jsonStr);
          if (quoteData) {
            info.shortName = quoteData.shortName || quoteData.longName || symbol;
            info.longName = quoteData.longName;
            info.regularMarketPrice = quoteData.regularMarketPrice?.raw;
            info.previousClose = quoteData.previousClose?.raw || quoteData.chartPreviousClose?.raw;
            info.currency = quoteData.currency || 'USD';
            info.exchange = quoteData.exchange || quoteData.fullExchangeName || 'UNKNOWN';
            info.marketCap = quoteData.marketCap?.raw;
            info.volume = quoteData.regularMarketVolume?.raw;
            info.averageVolume = quoteData.averageVolume?.raw;
            info.fiftyTwoWeekLow = quoteData.fiftyTwoWeekLow?.raw;
            info.fiftyTwoWeekHigh = quoteData.fiftyTwoWeekHigh?.raw;
            info.fiftyDayAverage = quoteData.fiftyDayAverage?.raw;
            info.twoHundredDayAverage = quoteData.twoHundredDayAverage?.raw;
          }
        } catch (parseError) {
          console.warn(`Failed to parse quote data for ${symbol}:`, parseError);
        }
      }

      // If we didn't find structured data, try parsing embedded JSON strings
      // Yahoo Finance embeds data as escaped JSON in script tags
      if (!info.regularMarketPrice) {
        // Look for embedded JSON data that contains price info for this specific symbol
        // Pattern: "symbol":"ATEN"[^}]*"regularMarketPrice\":123.45
        const symbolPricePattern = new RegExp(`"symbol"\\s*:\\s*"${symbol}"[^}]*regularMarketPrice\\":([0-9.]+)`, 'i');
        const symbolPriceMatch = html.match(symbolPricePattern);

        if (symbolPriceMatch && symbolPriceMatch[1]) {
          info.regularMarketPrice = parseFloat(symbolPriceMatch[1]);

          // Try to extract company name from the same embedded data
          const namePattern = new RegExp(`"symbol"\\s*:\\s*"${symbol}"[^}]*longName\\":\\"([^"]+)\\"`, 'i');
          const nameMatch = html.match(namePattern);
          if (nameMatch && nameMatch[1]) {
            info.longName = nameMatch[1].replace(/\\/g, '');
            info.shortName = info.longName;
          }

          // Try to extract previousClose
          const prevClosePattern = new RegExp(`"symbol"\\s*:\\s*"${symbol}"[^}]*previousClose\\":([0-9.]+)`, 'i');
          const prevCloseMatch = html.match(prevClosePattern);
          if (prevCloseMatch && prevCloseMatch[1]) {
            info.previousClose = parseFloat(prevCloseMatch[1]);
          }
        } else {
          // Fallback to the old pattern if symbol-specific pattern doesn't work
          const pricePattern = /regularMarketPrice\\":([0-9.]+)/;
          const priceMatch = html.match(pricePattern);

          if (priceMatch && priceMatch[1]) {
            info.regularMarketPrice = parseFloat(priceMatch[1]);

            // Try to extract company name from the same embedded data
            const namePattern = /longName\\":\\"([^"]+)\\"/;
            const nameMatch = html.match(namePattern);
            if (nameMatch && nameMatch[1]) {
              info.longName = nameMatch[1].replace(/\\/g, '');
              info.shortName = info.longName;
            }

            // Try to extract previousClose
            const prevClosePattern = /previousClose\\":([0-9.]+)/;
            const prevCloseMatch = html.match(prevClosePattern);
            if (prevCloseMatch && prevCloseMatch[1]) {
              info.previousClose = parseFloat(prevCloseMatch[1]);
            }
          }
        }
      }

      // If we didn't find structured data, try regex extraction as fallback
      if (!info.regularMarketPrice) {
        // Look for regularMarketPrice in the HTML
        const priceMatch = html.match(new RegExp(`"regularMarketPrice"\\s*:\\s*{\\s*"raw"\\s*:\\s*([0-9.]+)`));
        if (priceMatch && priceMatch[1]) {
          info.regularMarketPrice = parseFloat(priceMatch[1]);
        }

        // Look for previousClose
        const prevCloseMatch = html.match(new RegExp(`"previousClose"\\s*:\\s*{\\s*"raw"\\s*:\\s*([0-9.]+)`));
        if (prevCloseMatch && prevCloseMatch[1]) {
          info.previousClose = parseFloat(prevCloseMatch[1]);
        }

        // Look for shortName
        const shortNameMatch = html.match(new RegExp(`"shortName"\\s*:\\s*"([^"]+)"`));
        if (shortNameMatch && shortNameMatch[1]) {
          info.shortName = shortNameMatch[1];
        }
      }

    } catch (error) {
      console.warn(`Error parsing HTML for ${symbol}:`, error);
      return null;
    }

    return info;
  }

  private _parseHistoryFromHtml(_html: string): HistoricalDataPoint[] {
    // This is a placeholder implementation
    // Real implementation would parse CSV or JSON data from Yahoo Finance

    const data: HistoricalDataPoint[] = [];

    // TODO: Implement actual data parsing
    // This would involve parsing the CSV response and converting to HistoricalDataPoint[]

    return data;
  }

  private _repairData(data: HistoricalDataPoint[]): void {
    // Implement data repair logic similar to Python yfinance
    // Handle missing data, adjust for splits/dividends, etc.

    // This is a complex function that would need to:
    // 1. Fill missing values
    // 2. Adjust prices for splits
    // 3. Handle dividends
    // 4. Ensure data consistency

    // Placeholder for now
    logger.debug(`Repairing data for ${this.symbol} (${data.length} points)`);
  }
}