import { defaultHttpClient } from '../utils/http';
import { withErrorHandling, logger } from '../utils/logger';
import { YFinanceError } from '../utils/types';

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  market: string;
  country: string;
  sector?: string;
  industry?: string;
}

export interface SearchOptions {
  quotesCount?: number;
  newsCount?: number;
  enableFuzzyQuery?: boolean;
  enableEnhancedTrivialQuery?: boolean;
}

export class Search {
  /**
   * Search for tickers and securities by query string
   * @param query - Search query (company name, ticker symbol, etc.)
   * @param options - Search options
   * @returns Array of search results
   */
  static async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    return withErrorHandling(async () => {
      if (!query || query.trim().length === 0) {
        throw new YFinanceError('Search query cannot be empty');
      }

      const {
        quotesCount = 10,
        newsCount = 0,
        enableFuzzyQuery = true,
        enableEnhancedTrivialQuery = true,
      } = options;

      logger.debug(`Searching for: ${query}`);

      try {
        // Yahoo Finance search API endpoint
        const url = 'https://query2.finance.yahoo.com/v1/finance/search';

        const params = {
          q: query,
          quotesCount: quotesCount.toString(),
          newsCount: newsCount.toString(),
          enableFuzzyQuery: enableFuzzyQuery.toString(),
          enableEnhancedTrivialQuery: enableEnhancedTrivialQuery.toString(),
        };

        const response = await defaultHttpClient.get(url, { params });

        if (!response.data || !response.data.quotes) {
          logger.warn(`No search results found for query: ${query}`);
          return [];
        }

        const results: SearchResult[] = response.data.quotes.map((quote: any) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || '',
          type: quote.typeDisp || quote.type || '',
          exchange: quote.exchange || '',
          market: quote.market || '',
          country: quote.country || '',
          sector: quote.sector,
          industry: quote.industry,
        }));

        logger.info(`Found ${results.length} search results for: ${query}`);
        return results;

      } catch (error) {
        logger.error(`Search failed for query "${query}":`, error as Error);
        throw new YFinanceError(`Failed to search for "${query}": ${(error as Error).message}`);
      }
    }, `search for "${query}"`);
  }

  /**
   * Search for a single ticker by symbol or name
   * @param query - Search query
   * @returns First search result or null if not found
   */
  static async searchOne(query: string): Promise<SearchResult | null> {
    return withErrorHandling(async () => {
      const results = await this.search(query, { quotesCount: 1 });
      return results.length > 0 ? results[0] : null;
    }, `searchOne for "${query}"`);
  }

  /**
   * Get suggestions for autocomplete
   * @param query - Partial query string
   * @param limit - Maximum number of suggestions
   * @returns Array of suggestion strings
   */
  static async suggestions(query: string, limit: number = 10): Promise<string[]> {
    return withErrorHandling(async () => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      try {
        const results = await this.search(query, { quotesCount: limit });
        return results.map(result => result.symbol);
      } catch (error) {
        logger.error(`Failed to get suggestions for "${query}":`, error as Error);
        return [];
      }
    }, `suggestions for "${query}"`);
  }
}