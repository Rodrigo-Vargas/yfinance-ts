import { Ticker } from '../src/core/ticker';
import { download } from '../src/data/download';
import { Market } from '../src/core/market';

// Example usage of the yfinance-ts library

async function main() {
  console.log('yfinance-ts Example');

  // Create a ticker instance
  const ticker = new Ticker('AAPL');

  try {
    // Check if ticker is valid
    const isValid = await ticker.isValid();
    console.log(`Is AAPL valid? ${isValid}`);

    // Get current price
    const price = await ticker.getPrice();
    console.log(`Current AAPL price: $${price}`);

    // Get basic info
    const info = await ticker.info();
    console.log('AAPL Info:', {
      symbol: info.symbol,
      shortName: info.shortName,
      currency: info.currency,
    });

    // Bulk download historical data
    console.log('\nDownloading historical data...');
    const data = await download(['AAPL'], {
      period: '5d',
      interval: '1d'
    });

    console.log(`Downloaded ${data.AAPL.data.length} data points for AAPL`);
    if (data.AAPL.data.length > 0) {
      console.log('Sample data point:', data.AAPL.data[0]);
    }

    // Market information
    console.log('\nChecking market status...');
    const market = new Market();

    const isOpen = await market.isOpen();
    console.log(`Market is ${isOpen ? 'open' : 'closed'}`);

    const marketState = await market.getState();
    console.log(`Market state: ${marketState}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error);