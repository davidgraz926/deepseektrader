const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Configuration
const DEEPSEEK_API_KEY = functions.config().deepseek?.api_key || process.env.DEEPSEEK_API_KEY || 'sk-ba2ff135a0ab48218d88c776e41b32f0';
const DEEPSEEK_API_URL = functions.config().deepseek?.api_url || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const COINMARKETCAP_API_KEY = functions.config().coinmarketcap?.api_key || process.env.COINMARKETCAP_API_KEY || '';
const TELEGRAM_BOT_TOKEN = functions.config().telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN || '8201729537:AAHSy0aKp-xvOgRRrJtX62J9Nc-ziA4sj48';
const TELEGRAM_CHAT_ID = functions.config().telegram?.chat_id || process.env.TELEGRAM_CHAT_ID || '1528060909';

// Tradable coins
const TRADABLE_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'];
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get test mode settings from Firestore
 */
async function getTestModeSettings() {
  try {
    const [testModeDoc, testBalanceDoc] = await Promise.all([
      db.collection('settings').doc('test_mode').get(),
      db.collection('settings').doc('test_balance').get(),
    ]);

    const isTestMode = testModeDoc.exists() && (testModeDoc.data().value === true || testModeDoc.data().value === 'true');
    const initialBalance = testBalanceDoc.exists() ? parseFloat(testBalanceDoc.data().value) || 10000 : 10000;

    return { isTestMode, initialBalance };
  } catch (error) {
    console.error('Error getting test mode settings:', error);
    return { isTestMode: false, initialBalance: 10000 };
  }
}

/**
 * Get test portfolio from Firestore
 */
async function getTestPortfolio() {
  try {
    const portfolioDoc = await db.collection('test_portfolio').doc('current').get();
    
    if (!portfolioDoc.exists()) {
      const { initialBalance } = await getTestModeSettings();
      const initialPortfolio = {
        accountValue: initialBalance,
        availableCash: initialBalance,
        totalReturn: 0,
        positions: [],
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('test_portfolio').doc('current').set(initialPortfolio);
      return initialPortfolio;
    }

    return portfolioDoc.data();
  } catch (error) {
    console.error('Error getting test portfolio:', error);
    return null;
  }
}

/**
 * Get wallet address from Firestore
 */
async function getWalletAddress() {
  try {
    const settingsDoc = await db.collection('settings').doc('wallet').get();
    return settingsDoc.exists() ? settingsDoc.data().value : null;
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return null;
  }
}

/**
 * Fetch market data directly from Binance and CoinMarketCap APIs
 */
async function fetchMarketDataFromAPI(coins) {
  let cmcData = null;
  
  // Try to fetch from CoinMarketCap only if API key is available
  if (COINMARKETCAP_API_KEY && COINMARKETCAP_API_KEY.trim() !== '') {
    try {
      const cmcResponse = await axios.get(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
        {
          params: {
            symbol: coins.join(','),
            convert: 'USD',
          },
          headers: {
            'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
          },
          timeout: 10000,
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

/**
 * Get cached market data from Firestore
 */
async function getCachedMarketData() {
  try {
    const cacheDoc = await db.collection('market_data').doc('latest').get();
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

/**
 * Save market data to Firestore cache
 */
async function saveMarketDataToCache(marketData) {
  try {
    await db.collection('market_data').doc('latest').set({
      data: marketData,
      timestamp: new Date().toISOString(),
    });
    console.log('Market data saved to Firebase cache');
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

/**
 * Get market data (with caching)
 */
async function getMarketData(forceRefresh = false) {
  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedMarketData();
      if (cached.isCached && cached.data) {
        return cached.data;
      }
    }

    // Fetch fresh data from APIs
    console.log('Fetching fresh market data from APIs');
    const marketData = await fetchMarketDataFromAPI(TRADABLE_COINS);

    // Save to cache
    await saveMarketDataToCache(marketData);

    return marketData;
  } catch (error) {
    console.error('Error fetching market data:', error.message);
    
    // Try to return cached data as fallback
    try {
      const cached = await getCachedMarketData();
      if (cached.data) {
        console.log('Returning cached data as fallback');
        return cached.data;
      }
    } catch (cacheError) {
      console.error('Error reading cache fallback:', cacheError.message);
    }
    
    // Final fallback - return empty data structure
    return {
      binance: {},
      coinmarketcap: null,
    };
  }
}

/**
 * Generate signal using DeepSeek API
 */
async function generateSignal(accountInfo, positions, marketData, isTestMode) {
  try {
    // Get prompt from Firestore or use default
    let prompt = '';
    try {
      const promptDoc = await db.collection('settings').doc('trading_prompt').get();
      prompt = promptDoc.exists() ? promptDoc.data().value : '';
    } catch (e) {
      console.warn('Could not load prompt from Firestore, using default');
    }

    // Default prompt template
    const DEFAULT_PROMPT = `You are a rigorous QUANTITATIVE TRADER and interdisciplinary MATHEMATICIAN-ENGINEER optimizing risk-adjusted returns for perpetual futures on Hyperliquid under real execution, margin, and funding constraints.

You will receive market + account context for multiple assets (BTC, ETH, SOL, XRP, DOGE, BNB), including:
- Account Information: {account_info}
- Current Positions: {positions}
- Market Data: {market_data}

Your goal: make decisive, first-principles decisions per asset that minimize churn while capturing edge.

Aggressively pursue setups where calculated risk is outweighed by expected edge; size positions so downside is controlled while upside remains meaningful.

CORE POLICY (Low-Churn, Position-Aware):
1) RESPECT PRIOR PLANS: If an active trade has an exit_plan with explicit invalidation, DO NOT close or flip early unless that invalidation has occurred.
2) HYSTERESIS: Require stronger evidence to CHANGE a decision than to keep it.
3) COOLDOWN: After opening, adding, reducing, or flipping a position, impose a self-cooldown of at least 15 minutes before another direction change.
4) FUNDING IS A TILT, NOT A TRIGGER: Do NOT open/close/flip solely due to funding.
5) OVERBOUGHT/OVERSOLD ≠ REVERSAL: Treat extreme RSI/indicators as risk-of-pullback signals.
6) PREFER ADJUSTMENTS OVER EXITS: If the thesis weakens but is not invalidated, first consider tightening stops or reducing size.

DECISION DISCIPLINE (Per Asset):
- Choose one: LONG / SHORT / HOLD
- Control position size via notional USD
- TP/SL Sanity: LONG: profit_target > current_price, stop_loss < current_price. SHORT: profit_target < current_price, stop_loss > current_price.
- exit_plan must include at least ONE explicit invalidation trigger

LEVERAGE POLICY: Use leverage between 10x-20x to optimize returns. Never exceed 20x total leverage across all positions.

RISK MANAGEMENT: Maximum position size: Never risk more than 5% of account value on a single trade.

OUTPUT FORMAT: For each coin (BTC, ETH, SOL, XRP, DOGE, BNB), provide your trading decision in JSON format:
{
  "COIN": {
    "side": "LONG" or "SHORT" or "HOLD",
    "leverage": 10-20,
    "notional": position size in USD,
    "profit_target": target price (or null),
    "stop_loss": stop loss price (or null),
    "invalidation_condition": specific condition to invalidate the trade (REQUIRED),
    "exit_plan": detailed exit strategy with cooldown and invalidation triggers (REQUIRED),
    "rationale": brief explanation of the decision,
    "unrealized_pnl": current unrealized P&L if position exists
  }
}

Return only valid JSON, no additional text or markdown.`;

    // Replace placeholders in prompt
    const basePrompt = prompt || DEFAULT_PROMPT;
    const userPrompt = basePrompt
      .replace('{account_info}', JSON.stringify(accountInfo, null, 2))
      .replace('{positions}', JSON.stringify(positions, null, 2))
      .replace('{market_data}', JSON.stringify(marketData, null, 2));

    // Call DeepSeek API
    const deepseekResponse = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a quantitative trading AI. Return only valid JSON with trading signals.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000, // 3 minutes timeout
      }
    );

    const aiResponse = deepseekResponse.data.choices[0].message.content;
    
    // Parse JSON from response
    let jsonData;
    try {
      jsonData = JSON.parse(aiResponse);
    } catch (e) {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonData = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not extract JSON from response');
        }
      }
    }

    return { signal: jsonData, rawResponse: aiResponse };
  } catch (error) {
    console.error('Error generating signal:', error.message);
    throw error;
  }
}

/**
 * Save signal to Firestore
 */
async function saveSignal(signal, rawResponse, userPrompt, accountInfo, positions, marketData, isTestMode, tradeExecution = null) {
  try {
    const now = new Date();
    const timestamp = admin.firestore.Timestamp.fromDate(now);
    const timestampString = now.toISOString();
    
    // Create document ID from timestamp (format: YYYY-MM-DD-HH-MM-SS-mmm)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const docId = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}-${milliseconds}`;
    
    const signalData = {
      id: docId,
      walletAddress: isTestMode ? 'TEST_MODE' : null,
      signal,
      rawResponse,
      userPrompt,
      accountInfo,
      positions,
      marketData,
      isTestMode,
      timestamp,
      timestampString,
      tradeExecution: tradeExecution || { executed: false },
    };

    // Save to appropriate collection
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    await db.collection(collectionName).doc(docId).set(signalData);

    console.log(`✅ Signal saved to ${collectionName}/${docId}`);
    return signalData;
  } catch (error) {
    console.error('Error saving signal:', error.message);
    throw error;
  }
}

/**
 * Calculate unrealized P&L for a position
 */
function calculateUnrealizedPnL(position, currentPrice) {
  const { side, entryPrice, notional } = position;
  const quantity = notional / entryPrice;
  
  if (side === 'LONG') {
    return (currentPrice - entryPrice) * quantity;
  } else if (side === 'SHORT') {
    return (entryPrice - currentPrice) * quantity;
  }
  return 0;
}

/**
 * Execute simulated trades (test mode)
 */
async function executeSimulatedTrade(signal, marketData) {
  try {
    const portfolio = await getTestPortfolio();
    if (!portfolio) {
      throw new Error('Failed to load test portfolio');
    }

    const trades = [];
    const updatedPositions = [...(portfolio.positions || [])];
    let totalPnL = 0;
    let availableCash = portfolio.availableCash;

    // First, check existing positions for stop loss/profit target hits
    for (let i = updatedPositions.length - 1; i >= 0; i--) {
      const position = updatedPositions[i];
      const marketPrice = marketData?.binance?.[position.symbol]?.price;
      
      if (!marketPrice) continue;

      let shouldClose = false;
      let closeReason = '';

      // Check stop loss
      if (position.stopLoss) {
        if (position.side === 'LONG' && marketPrice <= position.stopLoss) {
          shouldClose = true;
          closeReason = `Stop loss hit at $${position.stopLoss}`;
        } else if (position.side === 'SHORT' && marketPrice >= position.stopLoss) {
          shouldClose = true;
          closeReason = `Stop loss hit at $${position.stopLoss}`;
        }
      }

      // Check profit target
      if (position.profitTarget && !shouldClose) {
        if (position.side === 'LONG' && marketPrice >= position.profitTarget) {
          shouldClose = true;
          closeReason = `Profit target hit at $${position.profitTarget}`;
        } else if (position.side === 'SHORT' && marketPrice <= position.profitTarget) {
          shouldClose = true;
          closeReason = `Profit target hit at $${position.profitTarget}`;
        }
      }

      // Close position if stop loss or profit target hit
      if (shouldClose) {
        const closePnL = calculateUnrealizedPnL(position, marketPrice);
        totalPnL += closePnL;
        availableCash += position.marginUsed + closePnL;
        
        trades.push({
          type: 'CLOSE',
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: marketPrice,
          pnl: closePnL,
          reason: closeReason,
          timestamp: new Date().toISOString(),
        });

        // Send Telegram notification
        await sendTelegramNotification(
          `🧪 TEST MODE: 🔒 CLOSED ${position.side} ${position.symbol} at ${closeReason}: $${marketPrice.toFixed(2)} (PnL: $${closePnL.toFixed(2)})`
        );

        updatedPositions.splice(i, 1);
        console.log(`✅ Closed ${position.symbol} ${position.side} position: ${closeReason}, PnL: $${closePnL.toFixed(2)}`);
      }
    }

    // Process each coin in the signal
    for (const coin of TRADABLE_COINS) {
      const coinSignal = signal[coin];
      if (!coinSignal || coinSignal.side === 'HOLD') {
        continue;
      }

      const marketPrice = marketData?.binance?.[coin]?.price;
      if (!marketPrice) {
        console.warn(`No market price found for ${coin}`);
        continue;
      }

      const { side, notional, leverage: signalLeverage, profit_target, stop_loss } = coinSignal;
      const leverage = signalLeverage || 10;
      const marginRequired = notional / leverage;

      // Check if we have enough cash
      if (marginRequired > availableCash) {
        console.warn(`Insufficient cash for ${coin} trade. Required: $${marginRequired}, Available: $${availableCash}`);
        continue;
      }

      // Find existing position
      const existingIndex = updatedPositions.findIndex(p => p.symbol === coin);

      if (existingIndex >= 0) {
        const existingPosition = updatedPositions[existingIndex];
        
        // Check if we need to close or modify position
        if (existingPosition.side !== side) {
          // Close existing position and calculate P&L
          const closePnL = calculateUnrealizedPnL(existingPosition, marketPrice);
          totalPnL += closePnL;
          availableCash += existingPosition.marginUsed + closePnL;
          
          trades.push({
            type: 'CLOSE',
            symbol: coin,
            side: existingPosition.side,
            entryPrice: existingPosition.entryPrice,
            exitPrice: marketPrice,
            pnl: closePnL,
            timestamp: new Date().toISOString(),
          });

          updatedPositions.splice(existingIndex, 1);
        } else {
          // Same side - update position size
          const newNotional = notional;
          const newMarginRequired = newNotional / leverage;
          const marginDiff = newMarginRequired - existingPosition.marginUsed;
          
          if (marginDiff > 0 && marginDiff > availableCash) {
            console.warn(`Insufficient cash to increase ${coin} position`);
            continue;
          }

          availableCash -= marginDiff;
          
          updatedPositions[existingIndex] = {
            ...existingPosition,
            notional: newNotional,
            leverage,
            marginUsed: newMarginRequired,
            entryPrice: (existingPosition.entryPrice + marketPrice) / 2,
            profitTarget: profit_target,
            stopLoss: stop_loss,
            lastUpdated: new Date().toISOString(),
          };

          trades.push({
            type: 'UPDATE',
            symbol: coin,
            side,
            notional: newNotional,
            leverage,
            timestamp: new Date().toISOString(),
          });
          
          continue;
        }
      }

      // Open new position
      if (side === 'LONG' || side === 'SHORT') {
        const entryPrice = marketPrice;
        const quantity = notional / entryPrice;
        
        availableCash -= marginRequired;

        const newPosition = {
          symbol: coin,
          side,
          entryPrice,
          quantity,
          notional,
          leverage,
          marginUsed: marginRequired,
          profitTarget: profit_target,
          stopLoss: stop_loss,
          openedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        updatedPositions.push(newPosition);

        trades.push({
          type: 'OPEN',
          symbol: coin,
          side,
          entryPrice,
          notional,
          leverage,
          timestamp: new Date().toISOString(),
        });

        // Send Telegram notification
        await sendTelegramNotification(
          `🧪 TEST MODE: ✅ OPENED ${side} ${coin} position\nEntry: $${entryPrice.toFixed(2)}\nNotional: $${notional.toFixed(2)}\nLeverage: ${leverage}x`
        );
      }
    }

    // Calculate current account value
    let totalUnrealizedPnL = 0;
    for (const position of updatedPositions) {
      const marketPrice = marketData?.binance?.[position.symbol]?.price;
      if (marketPrice) {
        const pnl = calculateUnrealizedPnL(position, marketPrice);
        totalUnrealizedPnL += pnl;
      }
    }

    const totalMarginUsed = updatedPositions.reduce((sum, p) => sum + p.marginUsed, 0);
    const accountValue = availableCash + totalMarginUsed + totalUnrealizedPnL;
    const totalReturn = accountValue - portfolio.accountValue;

    // Update portfolio
    const updatedPortfolio = {
      accountValue,
      availableCash,
      totalReturn,
      positions: updatedPositions,
      lastUpdated: new Date().toISOString(),
    };

    await db.collection('test_portfolio').doc('current').set(updatedPortfolio);

    // Save trade history
    for (const trade of trades) {
      const tradeId = new Date().toISOString().replace(/[:.]/g, '-');
      await db.collection('test_trades').doc(tradeId).set(trade);
    }

    return {
      executed: trades.length > 0,
      portfolio: updatedPortfolio,
      trades,
      totalPnL,
    };
  } catch (error) {
    console.error('Error executing simulated trade:', error);
    throw error;
  }
}

/**
 * Send Telegram notification directly
 */
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured, skipping notification');
    return;
  }

  try {
    // Get test mode status
    const { isTestMode } = await getTestModeSettings();
    const modePrefix = isTestMode ? '🧪 TEST MODE: ' : '';
    const text = modePrefix + message;

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown',
      },
      { timeout: 10000 }
    );
    console.log('✅ Telegram notification sent');
  } catch (error) {
    console.error('Telegram notification failed:', error.message);
    // Don't throw - Telegram is optional
  }
}

/**
 * Scheduled Cloud Function - Runs every 5 minutes
 */
exports.generateTradingSignal = functions.pubsub
  .schedule('*/5 * * * *') // Every 5 minutes
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🚀 [Firebase Cron] Starting scheduled signal generation...');
    
    try {
      // Get settings
      const { isTestMode } = await getTestModeSettings();
      console.log(`✅ [Firebase Cron] Test mode: ${isTestMode}`);

      let walletAddress = null;
      if (!isTestMode) {
        walletAddress = await getWalletAddress();
        if (!walletAddress) {
          console.error('❌ [Firebase Cron] Wallet address not configured');
          return null;
        }
      }

      // Get account data
      let accountInfo, positions;
      if (isTestMode) {
        const portfolio = await getTestPortfolio();
        if (!portfolio) {
          throw new Error('Failed to load test portfolio');
        }
        accountInfo = {
          accountValue: portfolio.accountValue,
          availableCash: portfolio.availableCash,
          totalReturn: portfolio.totalReturn,
        };
        positions = portfolio.positions || [];
      } else {
        // For live mode, fetch from Hyperliquid API directly
        try {
          const hyperliquidResponse = await axios.post(
            'https://api.hyperliquid.xyz/info',
            {
              type: 'clearinghouseState',
              user: walletAddress,
            },
            { timeout: 30000 }
          );

          const userState = hyperliquidResponse.data;
          const assetPositions = userState?.assetPositions || [];
          
          positions = assetPositions.map((pos) => {
            const position = pos.position;
            return {
              symbol: position.coin,
              quantity: parseFloat(position.szi),
              entryPrice: parseFloat(position.entryPx),
              leverage: parseFloat(position.leverage) || 1,
              liquidationPrice: parseFloat(position.liquidationPx) || 0,
              unrealizedPnl: parseFloat(position.unrealizedPnl) || 0,
              notionalUsd: Math.abs(parseFloat(position.szi) * parseFloat(position.entryPx)),
            };
          });

          accountInfo = {
            accountValue: parseFloat(userState?.marginSummary?.accountValue || 0),
            availableCash: parseFloat(userState?.marginSummary?.freeCollateral || 0),
            totalReturn: parseFloat(userState?.marginSummary?.totalReturn || 0),
          };
        } catch (error) {
          console.error('Error fetching positions from Hyperliquid:', error.message);
          throw error;
        }
      }

      // Get market data
      console.log('📊 [Firebase Cron] Fetching market data...');
      const marketData = await getMarketData();
      if (!marketData) {
        throw new Error('Failed to fetch market data');
      }

      // Generate signal
      console.log('🤖 [Firebase Cron] Generating signal with DeepSeek...');
      const { signal, rawResponse } = await generateSignal(accountInfo, positions, marketData, isTestMode);
      console.log('✅ [Firebase Cron] Signal generated');

      // Prepare user prompt for saving
      const userPrompt = `Account: ${JSON.stringify(accountInfo)}\nPositions: ${JSON.stringify(positions)}\nMarket: ${JSON.stringify(marketData)}`;

      // Execute trades
      let tradeExecution = { executed: false, reason: 'Auto trading disabled' };
      if (isTestMode) {
        console.log('💼 [Firebase Cron] Executing simulated trades...');
        tradeExecution = await executeSimulatedTrade(signal, marketData);
        console.log('✅ [Firebase Cron] Simulated trades executed:', tradeExecution.executed);
      } else {
        // For live mode, trades would be executed via Hyperliquid API
        // This is disabled by default for safety
        console.log('⚠️ [Firebase Cron] Live trading is disabled. Signal saved but no trades executed.');
        tradeExecution = { executed: false, reason: 'Live trading disabled in Firebase function' };
      }

      // Save signal to Firestore with trade execution data
      await saveSignal(signal, rawResponse, userPrompt, accountInfo, positions, marketData, isTestMode, tradeExecution);

      // Send Telegram notification
      console.log('📱 [Firebase Cron] Sending Telegram notification...');
      await sendTelegramNotification(
        isTestMode 
          ? '🧪 TEST MODE: New trading signal generated' 
          : '✅ New trading signal generated'
      );

      console.log('✅ [Firebase Cron] Signal generation completed successfully');
      return null;
    } catch (error) {
      console.error('❌ [Firebase Cron] Error:', error.message);
      console.error(error.stack);
      
      // Send error notification
      try {
        await sendTelegramNotification(`❌ Error generating signal: ${error.message}`);
      } catch (e) {
        // Ignore Telegram errors
      }
      
      throw error;
    }
  });

