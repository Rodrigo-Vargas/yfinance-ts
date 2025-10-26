import { CurlClient, CurlResponse, CurlError } from 'curl-cffi';
import { logger } from './logger';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  userAgent?: string;
  impersonate?: string;
  cookieJar?: boolean;
  cookieJarPath?: string;
  proxy?: string | ProxyConfig;
}

export interface ProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  type?: 'http' | 'https' | 'socks4' | 'socks5';
}

export class HttpClient {
  private client: CurlClient;
  private config: Required<Omit<HttpClientConfig, 'proxy'>> & { proxy?: string | ProxyConfig };
  private cookieJar: any = null;
  private csrfToken: string | null = null;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || 'https://finance.yahoo.com',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      userAgent: config.userAgent || 'yfinance-ts/0.1.0',
      impersonate: config.impersonate || 'chrome124', // Default browser impersonation
      cookieJar: config.cookieJar !== false, // Enable by default
      cookieJarPath: config.cookieJarPath || './cookies.txt', // Default cookie jar path
      proxy: config.proxy || undefined, // Proxy configuration
    };

    // Initialize curl-cffi client with browser impersonation
    this.client = new CurlClient({
      timeout: this.config.timeout,
      impersonate: (this.config.impersonate as any), // chrome124
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

    // Initialize cookie jar if enabled
    if (this.config.cookieJar) {
      this.initializeCookieJar();
    }
  }

  private initializeCookieJar(): void {
    // Load existing cookies if file exists
    this.loadCookies();
  }

  private async loadCookies(): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      const cookiePath = path.resolve(this.config.cookieJarPath);
      const exists = await fs.access(cookiePath).then(() => true).catch(() => false);

      if (exists) {
        const cookieData = await fs.readFile(cookiePath, 'utf8');
        // Parse Netscape cookie format and store in memory
        this.cookieJar = this.parseCookieFile(cookieData);
        logger.debug(`Loaded ${Object.keys(this.cookieJar).length} cookies from ${cookiePath}`);
      } else {
        this.cookieJar = {};
        logger.debug(`Cookie jar initialized at ${cookiePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to load cookies: ${error}`);
      this.cookieJar = {};
    }
  }

  private parseCookieFile(cookieData: string): any {
    const cookies: any = {};
    const lines = cookieData.split('\n');

    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('\t');
        if (parts.length >= 7) {
          const domain = parts[0];
          const flag = parts[1];
          const path = parts[2];
          const secure = parts[3] === 'TRUE';
          const expiration = parseInt(parts[4]);
          const name = parts[5];
          const value = parts[6];

          if (!cookies[domain]) {
            cookies[domain] = {};
          }
          cookies[domain][name] = {
            value,
            path,
            secure,
            expiration,
            httpOnly: flag === 'TRUE',
          };
        }
      }
    }

    return cookies;
  }

  private async saveCookies(): Promise<void> {
    if (!this.config.cookieJar || !this.cookieJar) return;

    try {
      const fs = require('fs').promises;
      const path = require('path');

      const cookiePath = path.resolve(this.config.cookieJarPath);
      const cookieDir = path.dirname(cookiePath);

      // Ensure directory exists
      await fs.mkdir(cookieDir, { recursive: true });

      const cookieData = this.serializeCookies();
      await fs.writeFile(cookiePath, cookieData, 'utf8');
      logger.debug(`Saved ${Object.keys(this.cookieJar).length} cookies to ${cookiePath}`);
    } catch (error) {
      logger.warn(`Failed to save cookies: ${error}`);
    }
  }

  private serializeCookies(): string {
    let output = '# Netscape HTTP Cookie File\n';

    for (const [domain, domainCookies] of Object.entries(this.cookieJar)) {
      for (const [name, cookie] of Object.entries(domainCookies as any)) {
        const c = cookie as any;
        const flag = c.httpOnly ? 'TRUE' : 'FALSE';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expiration = c.expiration || 0;

        output += `${domain}\t${flag}\t${c.path}\t${secure}\t${expiration}\t${name}\t${c.value}\n`;
      }
    }

    return output;
  }

  private getCookiesForUrl(url: string): string[] {
    if (!this.cookieJar) return [];

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;

      const cookies: string[] = [];

      // Check for domain matches (including subdomains)
      for (const [cookieDomain, domainCookies] of Object.entries(this.cookieJar)) {
        if (domain === cookieDomain || domain.endsWith('.' + cookieDomain)) {
          for (const [name, cookie] of Object.entries(domainCookies as any)) {
            const c = cookie as any;
            // Check if cookie is not expired and path matches
            if ((!c.expiration || c.expiration > Date.now() / 1000) &&
                path.startsWith(c.path)) {
              cookies.push(`${name}=${c.value}`);
            }
          }
        }
      }

      return cookies;
    } catch (error) {
      return [];
    }
  }

  private updateCookiesFromResponse(url: string, response: CurlResponse): void {
    if (!this.cookieJar || !response.headers) return;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Extract Set-Cookie headers
      const setCookies = this.extractSetCookies(response.headers);

      for (const setCookie of setCookies) {
        const cookie = this.parseSetCookie(setCookie);
        if (cookie) {
          if (!this.cookieJar[domain]) {
            this.cookieJar[domain] = {};
          }
          this.cookieJar[domain][cookie.name] = {
            value: cookie.value,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            expiration: cookie.expiration,
          };
        }
      }
    } catch (error) {
      logger.debug(`Failed to update cookies from response: ${error}`);
    }
  }

  private extractCsrfTokenFromResponse(response: CurlResponse): void {
    try {
      // Try to extract CSRF token from response headers
      if (response.headers) {
        const csrfHeaders = ['x-csrf-token', 'csrf-token', 'x-xsrf-token'];
        for (const header of csrfHeaders) {
          const token = this.getHeaderValue(response.headers, header);
          if (token) {
            this.csrfToken = token;
            logger.debug(`Extracted CSRF token from header: ${header}`);
            return;
          }
        }
      }

      // Try to extract CSRF token from response body (HTML/JSON)
      if (response.dataRaw && Buffer.isBuffer(response.dataRaw)) {
        const content = response.dataRaw.toString('utf8');

        // Look for common CSRF token patterns in HTML
        const csrfPatterns = [
          /name="csrf_token"\s+value="([^"]+)"/i,
          /csrf_token["\s]*:[\s]*"([^"]+)"/i,
          /"csrf"[\s]*:[\s]*"([^"]+)"/i,
          /_csrf["\s]*:[\s]*"([^"]+)"/i,
          /token["\s]*:[\s]*"([^"]+)"/i,
        ];

        for (const pattern of csrfPatterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            this.csrfToken = match[1];
            logger.debug(`Extracted CSRF token from response body`);
            return;
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to extract CSRF token: ${error}`);
    }
  }

  private getHeaderValue(headers: any, headerName: string): string | null {
    if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === headerName.toLowerCase()) {
          return Array.isArray(value) ? value[0] : String(value);
        }
      }
    }
    return null;
  }

  private extractSetCookies(headers: any): string[] {
    const setCookies: string[] = [];

    // Handle different header formats
    if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'set-cookie') {
          if (Array.isArray(value)) {
            setCookies.push(...value);
          } else {
            setCookies.push(String(value));
          }
        }
      }
    }

    return setCookies;
  }

  private parseSetCookie(setCookie: string): any {
    try {
      const parts = setCookie.split(';').map(p => p.trim());
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      const cookie: any = { name, value };

      for (let i = 1; i < parts.length; i++) {
        const [key, val] = parts[i].split('=');
        const lowerKey = key.toLowerCase();

        switch (lowerKey) {
          case 'path':
            cookie.path = val || '/';
            break;
          case 'domain':
            cookie.domain = val;
            break;
          case 'secure':
            cookie.secure = true;
            break;
          case 'httponly':
            cookie.httpOnly = true;
            break;
          case 'max-age':
            if (val) {
              cookie.expiration = Date.now() / 1000 + parseInt(val);
            }
            break;
          case 'expires':
            if (val) {
              cookie.expiration = new Date(val).getTime() / 1000;
            }
            break;
        }
      }

      return cookie;
    } catch (error) {
      return null;
    }
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.onRequest(async (request) => {
      // Simple rate limiting - add delay between requests
      logger.debug(`Making request to: ${request.url}`);
      await this.delay(this.config.rateLimitDelay);
      return request;
    });
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

  async get(url: string, config?: any): Promise<CurlResponse> {
    return this.makeRequest('GET', url, undefined, config);
  }

  async post(url: string, data?: any, config?: any): Promise<CurlResponse> {
    return this.makeRequest('POST', url, data, config);
  }

  async put(url: string, data?: any, config?: any): Promise<CurlResponse> {
    return this.makeRequest('PUT', url, data, config);
  }

  async delete(url: string, config?: any): Promise<CurlResponse> {
    return this.makeRequest('DELETE', url, undefined, config);
  }

  private async makeRequest(
    method: string,
    url: string,
    data?: any,
    config?: any
  ): Promise<CurlResponse> {
    // Handle relative URLs by prepending base URL
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;

    let retries = 0;
    const maxRetries = this.config.retries;

    while (retries <= maxRetries) {
      try {
        // Prepare request options
        const requestOptions: any = {
          method,
          url: fullUrl,
          data,
          ...config,
        };

        // Add cookies to request if cookie jar is enabled
        if (this.config.cookieJar && this.cookieJar) {
          const cookies = this.getCookiesForUrl(fullUrl);
          if (cookies.length > 0) {
            requestOptions.headers = {
              ...requestOptions.headers,
              'Cookie': cookies.join('; '),
            };
          }
        }

        // Add proxy configuration if specified
        if (this.config.proxy) {
          if (typeof this.config.proxy === 'string') {
            requestOptions.proxy = this.config.proxy;
          } else {
            // Handle ProxyConfig object
            const proxyConfig = this.config.proxy;
            let proxyUrl = `${proxyConfig.type || 'http'}://${proxyConfig.host}:${proxyConfig.port}`;
            
            if (proxyConfig.auth) {
              proxyUrl = `${proxyConfig.type || 'http'}://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`;
            }
            
            requestOptions.proxy = proxyUrl;
          }
        }

        const response = await this.client.request(requestOptions);

        // Update cookies from response if cookie jar is enabled
        if (this.config.cookieJar && this.cookieJar) {
          this.updateCookiesFromResponse(fullUrl, response);
          // Save cookies to file after each request
          await this.saveCookies();
        }

        // Extract CSRF token from response
        this.extractCsrfTokenFromResponse(response);

        return response;
      } catch (error) {
        retries++;

        if (retries <= maxRetries && this.shouldRetry(error as any)) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn(`Request failed, retrying (${retries}/${maxRetries}): ${errorMessage}`);
          await this.delay(this.config.retryDelay * retries);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Utility method for downloading content as text
  async getText(url: string, config?: any): Promise<string> {
    const response = await this.get(url, config);
    if (Buffer.isBuffer(response.dataRaw)) {
      return response.dataRaw.toString('utf8');
    }
    return String(response.dataRaw || '');
  }

  // Utility method for downloading JSON
  async getJson<T = any>(url: string, config?: any): Promise<T> {
    const text = await this.getText(url, config);
    return JSON.parse(text);
  }

  // Cookie management methods
  getCookies(domain?: string): any {
    if (!this.cookieJar) return {};

    if (domain) {
      return this.cookieJar[domain] || {};
    }

    return { ...this.cookieJar };
  }

  setCookie(domain: string, name: string, value: string, options: any = {}): void {
    if (!this.cookieJar) return;

    if (!this.cookieJar[domain]) {
      this.cookieJar[domain] = {};
    }

    this.cookieJar[domain][name] = {
      value,
      path: options.path || '/',
      secure: options.secure || false,
      httpOnly: options.httpOnly || false,
      expiration: options.expiration,
    };
  }

  clearCookies(domain?: string): void {
    if (!this.cookieJar) return;

    if (domain) {
      delete this.cookieJar[domain];
    } else {
      this.cookieJar = {};
    }
  }

  async forceSaveCookies(): Promise<void> {
    await this.saveCookies();
  }

  // CSRF token management methods
  getCsrfToken(): string | null {
    return this.csrfToken;
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  clearCsrfToken(): void {
    this.csrfToken = null;
  }
}

// Default instance
export const defaultHttpClient = new HttpClient();