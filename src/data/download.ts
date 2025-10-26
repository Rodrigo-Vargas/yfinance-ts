import { defaultHttpClient } from '../utils/http';
import { logger, withErrorHandling } from '../utils/logger';
import {
  HistoricalData,
  HistoricalDataPoint,
  Interval,
  Period,
  Prepost,
  AutoAdjust,
  Repair,
} from '../utils/types';

export interface DownloadOptions {
  period?: Period;
  interval?: Interval;
  start?: Date | string;
  end?: Date | string;
  prepost?: Prepost;
  auto_adjust?: AutoAdjust;
  repair?: Repair;
  keepna?: boolean;
  threads?: number;
  group_by?: 'ticker' | 'column';
  proxy?: string;
}

export interface DownloadResult {
  [ticker: string]: HistoricalData;
}

/**
 * Download historical market data for multiple tickers
 */
export async function download(
  tickers: string | string[],
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  return withErrorHandling(async () => {
    const tickerList = Array.isArray(tickers) ? tickers : [tickers];

    logger.info(`Downloading data for ${tickerList.length} ticker(s): ${tickerList.join(', ')}`);

    const {
      period = '1mo',
      interval = '1d',
      start,
      end,
      prepost = false,
      auto_adjust = true,
      repair = true,
    } = options;

    // For now, implement sequential downloading
    // TODO: Implement concurrent downloading with threads
    const results: DownloadResult = {};

    for (const ticker of tickerList) {
      try {
        const data = await downloadSingleTicker(ticker, {
          period,
          interval,
          start,
          end,
          prepost,
          auto_adjust,
          repair,
        });

        results[ticker] = data;
        logger.debug(`Downloaded data for ${ticker}: ${data.data.length} points`);
      } catch (error) {
        logger.error(`Failed to download data for ${ticker}:`, error as Error);
        // Continue with other tickers instead of failing completely
        results[ticker] = {
          symbol: ticker,
          data: [],
          timezone: 'UTC',
        };
      }
    }

    return results;
  }, 'bulk download');
}

/**
 * Download data for a single ticker
 */
async function downloadSingleTicker(
  ticker: string,
  options: {
    period?: Period;
    interval?: Interval;
    start?: Date | string;
    end?: Date | string;
    prepost?: boolean;
    auto_adjust?: boolean;
    repair?: boolean;
  }
): Promise<HistoricalData> {
  const params = buildDownloadParams(options);
  const url = `/quote/${ticker}/history?${params}`;

  logger.debug(`Fetching data for ${ticker} from: ${url}`);

  const response = await defaultHttpClient.getText(url);
  const data = parseHistoricalData(response, ticker);

  // Apply data repair if requested
  if (options.repair) {
    repairData(data);
  }

  return {
    symbol: ticker,
    data,
    timezone: 'America/New_York', // Default, should be parsed from response
  };
}

/**
 * Build URL parameters for the download request
 */
function buildDownloadParams(options: {
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

/**
 * Parse historical data from Yahoo Finance response
 */
function parseHistoricalData(response: string, ticker: string): HistoricalDataPoint[] {
  // This is a placeholder implementation
  // Real implementation would parse the CSV or JSON response from Yahoo Finance
  // The response typically contains CSV data with columns: Date,Open,High,Low,Close,Adj Close,Volume

  const data: HistoricalDataPoint[] = [];

  // TODO: Implement actual CSV parsing
  // For now, return empty array as parsing is not implemented yet

  logger.debug(`Parsed ${data.length} data points for ${ticker}`);
  return data;
}

/**
 * Apply data repair logic to historical data
 */
function repairData(data: HistoricalDataPoint[]): void {
  if (data.length === 0) return;

  // Sort data by date
  data.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Fill missing values
  // This is a simplified implementation - real repair would be much more complex
  // involving interpolation, handling splits, dividends, etc.

  logger.debug(`Applied data repair to ${data.length} points`);
}

/**
 * Download data and return as a formatted table (similar to pandas DataFrame)
 */
export async function downloadAsTable(
  tickers: string | string[],
  options: DownloadOptions = {}
): Promise<any> {
  const data = await download(tickers, options);

  // Convert to table format
  // This would create a structure similar to pandas DataFrame
  // with MultiIndex columns for multi-ticker data

  // For now, return the raw data
  return data;
}