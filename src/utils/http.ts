import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  userAgent?: string;
}

export class HttpClient {
  private client: AxiosInstance;
  private config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || 'https://finance.yahoo.com',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      userAgent: config.userAgent || 'yfinance-ts/0.1.0',
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      // Simple rate limiting - add delay between requests
      logger.debug(`Making request to: ${config.url}`);
      await this.delay(this.config.rateLimitDelay);
      return config;
    });

    // Response interceptor for retries
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as AxiosRequestConfig & { _retry?: number };

        if (!config || !config._retry) {
          config._retry = 0;
        }

        if (config._retry < this.config.retries && this.shouldRetry(error)) {
          config._retry += 1;
          logger.warn(`Request failed, retrying (${config._retry}/${this.config.retries}): ${config.url}`);
          await this.delay(this.config.retryDelay * config._retry);
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, 5xx status codes, or specific 4xx that might be temporary
    if (!error.response) {
      return true; // Network error
    }

    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408 || status === 503;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // Utility method for downloading content as text
  async getText(url: string, config?: AxiosRequestConfig): Promise<string> {
    const response = await this.get(url, config);
    return response.data;
  }

  // Utility method for downloading JSON
  async getJson<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.get<T>(url, config);
    return response.data;
  }
}

// Default instance
export const defaultHttpClient = new HttpClient();