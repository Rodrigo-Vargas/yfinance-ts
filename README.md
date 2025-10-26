# yfinance-ts

TypeScript port of [yfinance](https://github.com/ranaroussi/yfinance) - Download market data from Yahoo Finance API.

## Status

This is an early-stage port currently implementing:

- ✅ Project setup with TypeScript, Jest, ESLint, and Prettier
- ✅ HTTP client with retry logic, rate limiting, and error handling
- ✅ Core type definitions
- ✅ Error handling and logging
- ✅ Basic Ticker class with info, history, price, and validation methods
- ✅ Download function for bulk historical data retrieval
- ✅ Market class for market information and status
- ✅ WebSocket classes for real-time price data streaming
- ✅ Search class for finding tickers and securities
- ✅ Unit tests for all implemented functionality

## Installation

```bash
npm install
```

## Development

```bash
# Build the project
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

## Usage

```typescript
import { Ticker, download, Market, YahooWebSocket, AsyncYahooWebSocket, Search } from 'yfinance-ts';

// Single ticker usage
const ticker = new Ticker('AAPL');

// Get basic information
const info = await ticker.info();
console.log(info);

// Get current price
const price = await ticker.getPrice();
console.log(price);

// Check if ticker is valid
const isValid = await ticker.isValid();
console.log(isValid);

// Bulk download historical data
const data = await download(['AAPL', 'GOOGL'], {
  period: '1mo',
  interval: '1d'
});
console.log(data.AAPL.data.length); // Number of data points

// Market information
const market = new Market();

// Check if market is open
const isOpen = await market.isOpen();
console.log(`Market is ${isOpen ? 'open' : 'closed'}`);

// Get market status
const status = await market.getStatus();
console.log(`Market state: ${status.marketState}`);

// Get market summary for all major markets
const summary = await market.getSummary();
console.log(`Found ${summary.length} market summaries`);

// Real-time price data with WebSocket
const ws = new YahooWebSocket();

// Connect to WebSocket
await ws.connect();

// Subscribe to price updates
await ws.subscribe(['AAPL', 'GOOGL']);

// Listen for price updates
ws.on('price', (data) => {
  console.log(`${data.id}: $${data.price} (${data.changePercent}%)`);
});

// Listen for connection events
ws.on('connect', () => {
  console.log('Connected to WebSocket');
});

ws.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});

// Async WebSocket for promise-based operations
const asyncWs = new AsyncYahooWebSocket();
await asyncWs.connect();
await asyncWs.subscribe('AAPL');

// Use async generator for messages
for await (const message of asyncWs.messages()) {
  if (message.type === 'price') {
    console.log('Price update:', message.data);
  }
}

// Search for tickers
const searchResults = await Search.search('Apple');
console.log(`Found ${searchResults.length} results for "Apple"`);

// Get the first result
const firstResult = await Search.searchOne('Apple');
if (firstResult) {
  console.log(`Best match: ${firstResult.symbol} - ${firstResult.name}`);
}

// Get autocomplete suggestions
const suggestions = await Search.suggestions('app', 5);
console.log('Suggestions:', suggestions);
```

## API

### Ticker

- `new Ticker(symbol)` - Create a ticker instance
- `ticker.info()` - Get basic information about the ticker
- `ticker.history(options)` - Get historical market data
- `ticker.getPrice()` - Get current price
- `ticker.isValid()` - Check if ticker symbol is valid

### Download

- `download(tickers, options?)` - Download historical data for multiple tickers
  - `tickers`: Single ticker string or array of ticker strings
  - `options`: Configuration object with period, interval, start/end dates, etc.
  - Returns: Object with ticker symbols as keys and historical data as values

### Market

- `new Market()` - Create a market instance
- `market.getStatus()` - Get current market status and trading information
- `market.getSummary()` - Get summary data for all major markets
- `market.isOpen()` - Check if the market is currently open
- `market.getState()` - Get current market state (PRE, REGULAR, POST, CLOSED)
- `market.getData(symbol?)` - Get market data for a specific symbol (default: S&P 500)

### WebSocket

#### YahooWebSocket (EventEmitter-based)

- `new YahooWebSocket(options?)` - Create a WebSocket instance
  - `options`: Configuration object with autoReconnect, reconnectInterval, maxReconnectAttempts, heartbeatInterval
- `ws.connect()` - Connect to Yahoo Finance WebSocket
- `ws.disconnect()` - Disconnect from WebSocket
- `ws.subscribe(symbols)` - Subscribe to live price updates for symbols
- `ws.unsubscribe(symbols)` - Unsubscribe from live price updates for symbols
- `ws.getSubscribedSymbols()` - Get list of currently subscribed symbols
- `ws.isWebSocketConnected()` - Check if WebSocket is connected

**Events:**
- `connect` - Emitted when WebSocket connects
- `disconnect` - Emitted when WebSocket disconnects
- `price` - Emitted when price data is received
- `error` - Emitted when an error occurs

#### AsyncYahooWebSocket (Promise-based)

- `new AsyncYahooWebSocket(options?)` - Create an async WebSocket instance
- `asyncWs.connect()` - Connect to Yahoo Finance WebSocket
- `asyncWs.disconnect()` - Disconnect from WebSocket
- `asyncWs.subscribe(symbols)` - Subscribe to live price updates for symbols
- `asyncWs.unsubscribe(symbols)` - Unsubscribe from live price updates for symbols
- `asyncWs.messages()` - Async generator that yields WebSocket messages
- `asyncWs.getSubscribedSymbols()` - Get list of currently subscribed symbols
- `asyncWs.isWebSocketConnected()` - Check if WebSocket is connected

### Search

- `Search.search(query, options?)` - Search for tickers and securities by query string
  - `query`: Search string (company name, ticker symbol, etc.)
  - `options`: Configuration object with quotesCount, newsCount, enableFuzzyQuery, enableEnhancedTrivialQuery
  - Returns: Array of search results with symbol, name, type, exchange, market, country, sector, industry
- `Search.searchOne(query)` - Search for a single ticker and return the first result or null
- `Search.suggestions(query, limit?)` - Get autocomplete suggestions for a partial query
  - `query`: Partial search string
  - `limit`: Maximum number of suggestions (default: 10)
  - Returns: Array of symbol strings

## Contributing

This project is in early development. Contributions are welcome!

## License

Apache License 2.0