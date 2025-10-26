import { YahooWebSocket, AsyncYahooWebSocket } from '../../src/core/websocket';
import { logger } from '../../src/utils/logger';

// Mock WebSocket
const mockWebSocket = {
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
};

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => mockWebSocket);
});

let ws: YahooWebSocket;

describe('YahooWebSocket', () => {

  beforeEach(() => {
    ws = new YahooWebSocket();
  });

  afterEach(async () => {
    // Mock disconnect to avoid timeout
    jest.spyOn(ws as any, 'disconnect').mockResolvedValue(undefined);
    await ws.disconnect();
  });

  describe('constructor', () => {
    it('should create WebSocket with default options', () => {
      const websocket = new YahooWebSocket();
      expect(websocket).toBeDefined();
    });

    it('should create WebSocket with custom options', () => {
      const websocket = new YahooWebSocket({
        autoReconnect: false,
        reconnectInterval: 10000,
      });
      expect(websocket).toBeDefined();
    });
  });

  describe('subscription management', () => {
    it('should allow subscribing to symbols', async () => {
      // Mock the WebSocket connection
      const mockWsInstance = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      // Mock the connect method to set up the WebSocket
      jest.spyOn(ws as any, 'connect').mockImplementation(async () => {
        (ws as any).ws = mockWsInstance;
        (ws as any).isConnected = true;
        ws.emit('connect');
      });

      await ws.connect();
      await ws.subscribe('AAPL');
      expect(ws.getSubscribedSymbols()).toContain('AAPL');
    });

    it('should allow subscribing to multiple symbols', async () => {
      const mockWsInstance = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      jest.spyOn(ws as any, 'connect').mockImplementation(async () => {
        (ws as any).ws = mockWsInstance;
        (ws as any).isConnected = true;
        ws.emit('connect');
      });

      await ws.connect();
      await ws.subscribe(['AAPL', 'GOOGL']);
      expect(ws.getSubscribedSymbols()).toEqual(['AAPL', 'GOOGL']);
    });

    it('should allow unsubscribing from symbols', async () => {
      const mockWsInstance = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      jest.spyOn(ws as any, 'connect').mockImplementation(async () => {
        (ws as any).ws = mockWsInstance;
        (ws as any).isConnected = true;
        ws.emit('connect');
      });

      await ws.connect();
      await ws.subscribe(['AAPL', 'GOOGL']);
      await ws.unsubscribe('AAPL');

      expect(ws.getSubscribedSymbols()).toEqual(['GOOGL']);
    });

    it('should throw error when subscribing without connection', async () => {
      await expect(ws.subscribe('AAPL')).rejects.toThrow('WebSocket not connected');
    });

    it('should throw error when unsubscribing without connection', async () => {
      await expect(ws.unsubscribe('AAPL')).rejects.toThrow('WebSocket not connected');
    });

    it('should handle subscription when WebSocket send fails', async () => {
      const mockWsInstance = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        close: jest.fn(),
        readyState: 1,
      };

      jest.spyOn(ws as any, 'connect').mockImplementation(async () => {
        (ws as any).ws = mockWsInstance;
        (ws as any).isConnected = true;
        ws.emit('connect');
      });

      await ws.connect();

      await expect(ws.subscribe('AAPL')).rejects.toThrow('Send failed');

    });
  });

  describe('message handling', () => {
    it('should handle price messages', () => {
      const priceData = {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 1000000,
        marketCap: 2500000000000,
      };

      const mockEmit = jest.spyOn(ws, 'emit');
      (ws as any)._handleMessage(Buffer.from(JSON.stringify(priceData)));

      expect(mockEmit).toHaveBeenCalledWith('price', {
        id: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 1000000,
        marketCap: 2500000000000,
        timestamp: expect.any(Date),
      });

      mockEmit.mockRestore();
    });

    it('should handle error messages', () => {
      const errorData = {
        error: 'Connection lost',
      };

      const mockEmit = jest.spyOn(ws, 'emit');
      const mockLoggerError = jest.spyOn(logger, 'error').mockImplementation(() => {});

      (ws as any)._handleMessage(Buffer.from(JSON.stringify(errorData)));

      expect(mockLoggerError).toHaveBeenCalledWith('WebSocket message error:', 'Connection lost');
      expect(mockEmit).toHaveBeenCalledWith('error', new Error('Connection lost'));

      mockEmit.mockRestore();
      mockLoggerError.mockRestore();
    });

    it('should handle malformed JSON', () => {
      const mockLoggerError = jest.spyOn(logger, 'error').mockImplementation(() => {});

      (ws as any)._handleMessage(Buffer.from('invalid json'));

      expect(mockLoggerError).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));

      mockLoggerError.mockRestore();
    });

    it('should handle messages with missing fields', () => {
      const priceData = {
        symbol: 'AAPL',
        price: 150.25,
        // missing change, changePercent, etc.
      };

      const mockEmit = jest.spyOn(ws, 'emit');
      (ws as any)._handleMessage(Buffer.from(JSON.stringify(priceData)));

      expect(mockEmit).toHaveBeenCalledWith('price', {
        id: 'AAPL',
        price: 150.25,
        change: 0,
        changePercent: 0,
        volume: undefined,
        marketCap: undefined,
        timestamp: expect.any(Date),
      });

      mockEmit.mockRestore();
    });
  });

  describe('heartbeat mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      (ws as any).isConnected = true;
      (ws as any).ws = mockWebSocket;
      mockWebSocket.send.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
      (ws as any)._stopHeartbeat();
    });

    it('should start heartbeat timer', () => {
      (ws as any)._startHeartbeat();

      expect((ws as any).heartbeatTimer).toBeDefined();
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ heartbeat: true }));
    });

    it('should not send heartbeat when not connected', () => {
      (ws as any).isConnected = false;
      (ws as any)._startHeartbeat();

      jest.advanceTimersByTime(30000);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should not send heartbeat when WebSocket is null', () => {
      (ws as any).ws = null;
      (ws as any)._startHeartbeat();

      jest.advanceTimersByTime(30000);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should stop heartbeat timer', () => {
      (ws as any)._startHeartbeat();
      expect((ws as any).heartbeatTimer).toBeDefined();

      (ws as any)._stopHeartbeat();
      expect((ws as any).heartbeatTimer).toBeUndefined();

      // Fast-forward time - should not send heartbeat
      jest.advanceTimersByTime(30000);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(0);
    });
  });

  describe('reconnect logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      (ws as any).reconnectAttempts = 0;
    });

    afterEach(() => {
      jest.useRealTimers();
      (ws as any)._clearReconnectTimer();
    });

    it('should schedule reconnect with increasing delay', () => {
      const mockConnect = jest.spyOn(ws as any, 'connect').mockResolvedValue(undefined);
      const mockEmit = jest.spyOn(ws, 'emit');

      (ws as any)._scheduleReconnect();
      expect((ws as any).reconnectAttempts).toBe(1);

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      expect(mockConnect).toHaveBeenCalled();

      mockConnect.mockRestore();
      mockEmit.mockRestore();
    });

    it('should stop reconnecting after max attempts', () => {
      (ws as any).reconnectAttempts = 10; // Max attempts
      const mockEmit = jest.spyOn(ws, 'emit').mockReturnValue(true);
      const mockLoggerError = jest.spyOn(logger, 'error').mockImplementation(() => {});

      (ws as any)._scheduleReconnect();

      expect(mockEmit).toHaveBeenCalledWith('error', new Error('Max reconnect attempts reached'));
      expect((ws as any).reconnectTimer).toBeUndefined();

      mockEmit.mockRestore();
      mockLoggerError.mockRestore();
    });

    it('should clear reconnect timer', () => {
      (ws as any)._scheduleReconnect();
      expect((ws as any).reconnectTimer).toBeDefined();

      (ws as any)._clearReconnectTimer();
      expect((ws as any).reconnectTimer).toBeUndefined();
    });

    it('should reschedule reconnect on failure when autoReconnect is enabled', async () => {
      const mockConnect = jest.spyOn(ws as any, 'connect').mockRejectedValue(new Error('Connect failed'));
      const mockScheduleReconnect = jest.spyOn(ws as any, '_scheduleReconnect');

      (ws as any)._scheduleReconnect();

      // Fast-forward time to trigger first reconnect
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Allow promises to resolve

      expect(mockConnect).toHaveBeenCalled();
      expect(mockScheduleReconnect).toHaveBeenCalledTimes(2); // Original + reschedule

      mockConnect.mockRestore();
      mockScheduleReconnect.mockRestore();
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      (ws as any).isConnected = false;
      (ws as any).ws = null;
      (ws as any).reconnectAttempts = 0;
    });

    it('should connect successfully', async () => {
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl').mockResolvedValue('wss://test.com');
      const mockStartHeartbeat = jest.spyOn(ws as any, '_startHeartbeat').mockImplementation(() => {});

      // Mock the WebSocket event handlers
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          // Trigger the open event immediately
          setTimeout(() => callback(), 10);
        }
      });

      await ws.connect();

      expect(mockGetWebSocketUrl).toHaveBeenCalled();
      expect(mockStartHeartbeat).toHaveBeenCalled();
      expect(ws.isWebSocketConnected()).toBe(true);

      mockGetWebSocketUrl.mockRestore();
      mockStartHeartbeat.mockRestore();
    });

    it('should not connect if already connected', async () => {
      (ws as any).isConnected = true;
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl');

      await ws.connect();

      expect(mockGetWebSocketUrl).not.toHaveBeenCalled();
      expect(ws.isWebSocketConnected()).toBe(true);

      mockGetWebSocketUrl.mockRestore();
    });

    it('should handle connection timeout', async () => {
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl').mockResolvedValue('wss://test.com');

      // Mock WebSocket to not trigger open event
      mockWebSocket.on.mockImplementation(() => {});

      await expect(ws.connect()).rejects.toThrow('WebSocket connection timeout');

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(ws.isWebSocketConnected()).toBe(false);

      mockGetWebSocketUrl.mockRestore();
    }, 15000);

    it('should handle WebSocket URL fetch error', async () => {
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl').mockRejectedValue(new Error('URL fetch failed'));

      await expect(ws.connect()).rejects.toThrow('URL fetch failed');

      mockGetWebSocketUrl.mockRestore();
    });

    it('should handle WebSocket error event', async () => {
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl').mockResolvedValue('wss://test.com');
      const mockError = new Error('Connection failed');
      const mockEmit = jest.spyOn(ws, 'emit').mockReturnValue(true);

      // Mock the WebSocket event handlers
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          // Trigger the error event after a short delay
          setTimeout(() => callback(mockError), 50);
        }
      });

      await expect(ws.connect()).rejects.toThrow('Connection failed');

      mockGetWebSocketUrl.mockRestore();
      mockEmit.mockRestore();
    });

    it('should set up event handlers correctly', async () => {
      const mockGetWebSocketUrl = jest.spyOn(ws as any, '_getWebSocketUrl').mockResolvedValue('wss://test.com');
      const mockStartHeartbeat = jest.spyOn(ws as any, '_startHeartbeat').mockImplementation(() => {});

      // Mock the WebSocket event handlers
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          // Trigger the open event immediately
          setTimeout(() => callback(), 10);
        }
      });

      await ws.connect();

      // Check that event handlers were set up
      expect(mockWebSocket.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));

      mockGetWebSocketUrl.mockRestore();
      mockStartHeartbeat.mockRestore();
    });
  });

  describe('disconnect', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (ws as any).isConnected = false;
      (ws as any).ws = null;
    });

    it('should disconnect successfully', async () => {
      // Mock connected state
      (ws as any).ws = mockWebSocket;
      (ws as any).isConnected = true;

      const mockStopHeartbeat = jest.spyOn(ws as any, '_stopHeartbeat').mockImplementation(() => {});
      const mockClearReconnectTimer = jest.spyOn(ws as any, '_clearReconnectTimer').mockImplementation(() => {});

      // Mock close event
      mockWebSocket.once.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(), 10);
        }
      });

      await ws.disconnect();

      expect(mockStopHeartbeat).toHaveBeenCalled();
      expect(mockClearReconnectTimer).toHaveBeenCalled();
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(ws.isWebSocketConnected()).toBe(false);

      mockStopHeartbeat.mockRestore();
      mockClearReconnectTimer.mockRestore();
    });

    it('should handle disconnect when not connected', async () => {
      (ws as any).isConnected = false;

      await expect(ws.disconnect()).resolves.toBeUndefined();
    });
  });
});

describe('AsyncYahooWebSocket', () => {
  let asyncWs: AsyncYahooWebSocket;

  beforeEach(() => {
    asyncWs = new AsyncYahooWebSocket();
  });

  afterEach(async () => {
    // Mock disconnect to avoid timeout
    jest.spyOn(asyncWs as any, 'disconnect').mockResolvedValue(undefined);
    await asyncWs.disconnect();
  });

  describe('constructor', () => {
    it('should create AsyncWebSocket with default options', () => {
      const websocket = new AsyncYahooWebSocket();
      expect(websocket).toBeDefined();
    });

    it('should create AsyncWebSocket with custom options', () => {
      const websocket = new AsyncYahooWebSocket({
        autoReconnect: false,
        reconnectInterval: 10000,
      });
      expect(websocket).toBeDefined();
    });
  });

  describe('messages generator', () => {
    it('should yield messages from the async generator', async () => {
      const messages = asyncWs.messages();
      const messagePromise = messages.next();

      // Simulate a message being added
      (asyncWs as any)._addToQueue({ type: 'connect' });

      const result = await messagePromise;
      expect(result.value).toEqual({ type: 'connect' });
      expect(result.done).toBe(false);
    });
  });
});