import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger, withErrorHandling } from '../utils/logger';
import { YFinanceError } from '../utils/types';

export interface WebSocketOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface LivePriceData {
  id: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'price' | 'error' | 'connect' | 'disconnect';
  data?: any;
  error?: string;
}

export class YahooWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketOptions>;
  private reconnectAttempts = 0;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private subscribedSymbols = new Set<string>();
  private isConnected = false;

  constructor(options: WebSocketOptions = {}) {
    super();

    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 5000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
    };
  }

  /**
   * Connect to Yahoo Finance WebSocket
   */
  async connect(): Promise<void> {
    return withErrorHandling(async () => {
      if (this.isConnected) {
        logger.warn('WebSocket is already connected');
        return;
      }

      logger.info('Connecting to Yahoo Finance WebSocket...');

      // Get WebSocket URL from Yahoo Finance
      const wsUrl = await this._getWebSocketUrl();

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'yfinance-ts/0.1.0',
        },
      });

      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'));

        this.ws.on('open', () => {
          logger.info('WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this._startHeartbeat();
          this.emit('connect');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this._handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          logger.info(`WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this._stopHeartbeat();
          this.emit('disconnect', { code, reason: reason.toString() });

          if (this.options.autoReconnect && code !== 1000) {
            this._scheduleReconnect();
          }
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });
    }, 'connecting to WebSocket');
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws || !this.isConnected) {
        resolve();
        return;
      }

      logger.info('Disconnecting WebSocket...');
      this._stopHeartbeat();
      this._clearReconnectTimer();

      this.ws.once('close', () => {
        this.isConnected = false;
        this.emit('disconnect', { code: 1000, reason: 'Client disconnect' });
        resolve();
      });

      this.ws.close(1000, 'Client disconnect');
    });
  }

  /**
   * Subscribe to live price updates for symbols
   */
  async subscribe(symbols: string | string[]): Promise<void> {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];

    if (!this.isConnected || !this.ws) {
      throw new YFinanceError('WebSocket not connected');
    }

    for (const symbol of symbolList) {
      if (!this.subscribedSymbols.has(symbol)) {
        logger.debug(`Subscribing to ${symbol}`);

        // Send subscription message
        const message = {
          subscribe: [symbol],
        };

        this.ws.send(JSON.stringify(message));
        this.subscribedSymbols.add(symbol);
      }
    }
  }

  /**
   * Unsubscribe from live price updates for symbols
   */
  async unsubscribe(symbols: string | string[]): Promise<void> {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];

    if (!this.isConnected || !this.ws) {
      throw new YFinanceError('WebSocket not connected');
    }

    for (const symbol of symbolList) {
      if (this.subscribedSymbols.has(symbol)) {
        logger.debug(`Unsubscribing from ${symbol}`);

        // Send unsubscription message
        const message = {
          unsubscribe: [symbol],
        };

        this.ws.send(JSON.stringify(message));
        this.subscribedSymbols.delete(symbol);
      }
    }
  }

  /**
   * Get list of subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  private async _getWebSocketUrl(): Promise<string> {
    // This is a placeholder - real implementation would fetch the WebSocket URL
    // from Yahoo Finance's API endpoints

    // For now, return a mock URL
    // TODO: Implement actual WebSocket URL discovery
    return 'wss://streamer.finance.yahoo.com';
  }

  private _handleMessage(data: Buffer): void {
    try {
      // Parse the incoming message
      // This would typically be protocol buffer data in the real implementation
      const message = JSON.parse(data.toString());

      if (message.price) {
        // Handle price update
        const priceData: LivePriceData = {
          id: message.symbol,
          price: message.price,
          change: message.change || 0,
          changePercent: message.changePercent || 0,
          volume: message.volume,
          marketCap: message.marketCap,
          timestamp: new Date(),
        };

        this.emit('price', priceData);
      } else if (message.error) {
        // Handle error message
        logger.error('WebSocket message error:', message.error);
        this.emit('error', new Error(message.error));
      }

    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error as Error);
    }
  }

  private _startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.isConnected) {
        // Send heartbeat message
        const heartbeat = { heartbeat: true };
        this.ws.send(JSON.stringify(heartbeat));
      }
    }, this.options.heartbeatInterval);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval * this.reconnectAttempts;

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnect failed:', error as Error);
        if (this.options.autoReconnect) {
          this._scheduleReconnect();
        }
      }
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}

// AsyncWebSocket class for promise-based operations
export class AsyncYahooWebSocket {
  private ws: YahooWebSocket;
  private messageQueue: WebSocketMessage[] = [];
  private resolveQueue: Array<(value: WebSocketMessage) => void> = [];

  constructor(options: WebSocketOptions = {}) {
    this.ws = new YahooWebSocket(options);

    this.ws.on('connect', () => {
      this._addToQueue({ type: 'connect' });
    });

    this.ws.on('disconnect', (data) => {
      this._addToQueue({ type: 'disconnect', data });
    });

    this.ws.on('price', (data) => {
      this._addToQueue({ type: 'price', data });
    });

    this.ws.on('error', (error) => {
      this._addToQueue({ type: 'error', error: error.message });
    });
  }

  async connect(): Promise<void> {
    return this.ws.connect();
  }

  async disconnect(): Promise<void> {
    return this.ws.disconnect();
  }

  async subscribe(symbols: string | string[]): Promise<void> {
    return this.ws.subscribe(symbols);
  }

  async unsubscribe(symbols: string | string[]): Promise<void> {
    return this.ws.unsubscribe(symbols);
  }

  async *messages(): AsyncGenerator<WebSocketMessage, void, unknown> {
    while (true) {
      if (this.messageQueue.length > 0) {
        yield this.messageQueue.shift()!;
      } else {
        // Wait for next message
        yield new Promise<WebSocketMessage>((resolve) => {
          this.resolveQueue.push(resolve);
        });
      }
    }
  }

  getSubscribedSymbols(): string[] {
    return this.ws.getSubscribedSymbols();
  }

  isWebSocketConnected(): boolean {
    return this.ws.isWebSocketConnected();
  }

  private _addToQueue(message: WebSocketMessage): void {
    if (this.resolveQueue.length > 0) {
      const resolve = this.resolveQueue.shift()!;
      resolve(message);
    } else {
      this.messageQueue.push(message);
    }
  }
}

// Default WebSocket instances
export const websocket = new YahooWebSocket();
export const asyncWebsocket = new AsyncYahooWebSocket();