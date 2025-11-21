import { NextResponse } from 'next/server';
import axios from 'axios';
import { TRADABLE_COINS } from '@/lib/config';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

async function fetchMarketDataFromAPI(coins) {
  let cmcData = null;
  
  // Try to fetch from CoinMarketCap only if API key is available
  const cmcApiKey = process.env.COINMARKETCAP_API_KEY;
  if (cmcApiKey && cmcApiKey.trim() !== '') {
    try {
      const cmcResponse = await axios.get(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
        {
          params: {
            symbol: coins.join(','),
            convert: 'USD',
          },
          headers: {
            'X-CMC_PRO_API_KEY': cmcApiKey,
          },
        }
      );
      cmcData = cmcResponse.data.data;
    } catch (cmcError) {
      // Silently fail if CoinMarketCap returns 401 or other errors
      if (cmcError.response?.status !== 401) {
        console.error('CoinMarketCap API Error:', cmcError.message);
      }
      // Continue with Binance-only data
    }
  }

  // Fetch from Binance (primary data source)
  const binanceData = {};
  for (const coin of coins) {
    try {
      const symbol = coin === 'BTC' ? 'BTCUSDT' : `${coin}USDT`;
      const binanceResponse = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        { timeout: 5000 } // 5 second timeout
      );
      binanceData[coin] = {
        price: parseFloat(binanceResponse.data.lastPrice),
        volume24h: parseFloat(binanceResponse.data.volume),
        change24h: parseFloat(binanceResponse.data.priceChangePercent),
        high24h: parseFloat(binanceResponse.data.highPrice),
        low24h: parseFloat(binanceResponse.data.lowPrice),
      };
    } catch (err) {
      console.error(`Error fetching ${coin} from Binance:`, err.message);
      // Continue with other coins even if one fails
    }
  }

  return {
    binance: binanceData,
    coinmarketcap: cmcData,
  };
}

async function getCachedMarketData() {
  try {
    const cacheDoc = await getDoc(doc(db, 'market_data', 'latest'));
    if (cacheDoc.exists()) {
      const cacheData = cacheDoc.data();
      const cacheTimestamp = cacheData.timestamp ? new Date(cacheData.timestamp).getTime() : 0;
      const now = Date.now();
      const age = now - cacheTimestamp;
      
      // If cache is less than 5 minutes old, return cached data
      if (age < CACHE_DURATION_MS) {
        console.log(`Using cached market data (age: ${Math.round(age / 1000)}s)`);
        return {
          data: cacheData.data,
          isCached: true,
        };
      } else {
        console.log(`Cache expired (age: ${Math.round(age / 1000)}s), fetching fresh data`);
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error.message);
  }
  
  return { data: null, isCached: false };
}

async function saveMarketDataToCache(marketData) {
  try {
    await setDoc(doc(db, 'market_data', 'latest'), {
      data: marketData,
      timestamp: new Date().toISOString(),
    });
    console.log('Market data saved to Firebase cache');
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const coins = searchParams.get('coins')?.split(',') || TRADABLE_COINS;
    const forceRefresh = searchParams.get('force') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedMarketData();
      if (cached.isCached && cached.data) {
        return NextResponse.json({
          success: true,
          data: cached.data,
          cached: true,
        });
      }
    }

    // Fetch fresh data from APIs
    console.log('Fetching fresh market data from APIs');
    const marketData = await fetchMarketDataFromAPI(coins);

    // Save to cache
    await saveMarketDataToCache(marketData);

    return NextResponse.json({
      success: true,
      data: marketData,
      cached: false,
    });
  } catch (error) {
    console.error('Market Data Error:', error.message);
    
    // Try to return cached data as fallback
    try {
      const cached = await getCachedMarketData();
      if (cached.data) {
        console.log('Returning cached data as fallback');
        return NextResponse.json({
          success: true,
          data: cached.data,
          cached: true,
          fallback: true,
        });
      }
    } catch (cacheError) {
      console.error('Error reading cache fallback:', cacheError.message);
    }
    
    // Final fallback - return empty data structure
    return NextResponse.json({
      success: true,
      data: {
        binance: {},
        coinmarketcap: null,
      },
      cached: false,
    });
  }
}


