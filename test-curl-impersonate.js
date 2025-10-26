import { CurlImpersonate } from 'node-curl-impersonate';

async function testYahooFinance() {
  try {
    console.log('Testing Yahoo Finance access with node-curl-impersonate...');

    // First visit fc.yahoo.com to get initial cookies
    console.log('Visiting fc.yahoo.com for initial cookies...');
    const fcCurl = new CurlImpersonate('https://fc.yahoo.com', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      impersonate: 'chrome-116',
      timeout: 30000,
      followRedirects: true,
      verbose: false,
    });

    const fcResponse = await fcCurl.makeRequest();
    console.log('fc.yahoo.com Status:', fcResponse.statusCode);

    // Now try to get crumb
    console.log('Getting crumb from Yahoo Finance...');
    const curl = new CurlImpersonate('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      impersonate: 'chrome-116',
      timeout: 30000,
      followRedirects: true,
      verbose: false,
    });

    const response = await curl.makeRequest();
    console.log('Crumb Status Code:', response.statusCode);
    console.log('Crumb Response:', response.response);

    if (response.statusCode === 200) {
      console.log('Success! Got crumb:', response.response.trim());
    } else {
      console.log('Failed to get crumb');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testYahooFinance();