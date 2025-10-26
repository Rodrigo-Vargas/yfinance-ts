// Core data types for yfinance-ts

export interface TickerInfo {
  symbol: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  exchange?: string;
  market?: string;
  country?: string;
  industry?: string;
  sector?: string;
  website?: string;
  logo_url?: string;
  // Financial data
  marketCap?: number;
  enterpriseValue?: number;
  forwardPE?: number;
  trailingPE?: number;
  priceToBook?: number;
  enterpriseToRevenue?: number;
  enterpriseToEbitda?: number;
  // Trading info
  previousClose?: number;
  open?: number;
  dayLow?: number;
  dayHigh?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayLow?: number;
  regularMarketDayHigh?: number;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  volume?: number;
  averageVolume?: number;
  averageVolume10days?: number;
  // Dates
  regularMarketTime?: Date;
  preMarketTime?: Date;
  postMarketTime?: Date;
  // Other
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  sharesOutstanding?: number;
  sharesShort?: number;
  sharesShortPriorMonth?: number;
  shortRatio?: number;
  shortPercentOfFloat?: number;
  heldPercentInsiders?: number;
  heldPercentInstitutions?: number;
  beta?: number;
  pegRatio?: number;
  bookValue?: number;
  priceToSalesTrailing12Months?: number;
  trailingEps?: number;
  forwardEps?: number;
  lastDividendValue?: number;
  lastDividendDate?: Date;
  dividendRate?: number;
  dividendYield?: number;
  payoutRatio?: number;
  fiveYearAvgDividendYield?: number;
  // Analyst data
  targetMeanPrice?: number;
  targetMedianPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numberOfAnalystOpinions?: number;
  // Earnings
  earningsQuarterlyGrowth?: number;
  earningsDate?: Date[];
  // Other metrics
  totalCash?: number;
  totalCashPerShare?: number;
  totalDebt?: number;
  totalRevenue?: number;
  revenuePerShare?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  grossProfits?: number;
  freeCashflow?: number;
  operatingCashflow?: number;
  revenueGrowth?: number;
  grossMargins?: number;
  ebitdaMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
}

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
  dividends?: number;
  stockSplits?: number;
}

export interface HistoricalData {
  symbol: string;
  data: HistoricalDataPoint[];
  timezone: string;
}

export interface FinancialStatement {
  [key: string]: any; // This would be more detailed based on actual data structure
}

export interface BalanceSheet extends FinancialStatement {}
export interface IncomeStatement extends FinancialStatement {}
export interface CashFlow extends FinancialStatement {}

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  currency: string;
  lastPrice: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  bid: number;
  ask: number;
  contractSize: string;
  expiration: Date;
  lastTradeDate: Date;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsData {
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingSymbol: string;
  expirationDates: Date[];
  strikes: number[];
}

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: Date;
  type: string;
  relatedTickers?: string[];
  thumbnail?: {
    resolutions: Array<{
      url: string;
      width: number;
      height: number;
      tag: string;
    }>;
  };
  summary?: string;
}

export interface MarketData {
  marketState: string;
  regularMarketTime: Date;
  charts: HistoricalDataPoint[];
}

export interface SearchResult {
  symbol: string;
  shortname: string;
  longname: string;
  type: string;
  exchange: string;
  market: string;
  quoteType: string;
  score: number;
}

export interface ScreenerResult {
  [key: string]: any; // Would be more specific based on screener criteria
}

// Error types
export class YFinanceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'YFinanceError';
  }
}

export class YFinanceRateLimitError extends YFinanceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT');
    this.name = 'YFinanceRateLimitError';
  }
}

// Utility types
export type Interval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';
export type Period = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';
export type Prepost = boolean;
export type AutoAdjust = boolean;
export type BackAdjust = boolean;
export type Repair = boolean;