import { NextResponse } from 'next/server';
import axios from 'axios';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getTestModeSettings, getTestPortfolio, executeSimulatedTrade } from '@/lib/simulationEngine';
import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, TRADABLE_COINS } from '@/lib/config';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch market data from APIs
 */
async function fetchMarketDataFromAPI(coins) {
  const binanceData = {};
  
  for (const coin of coins) {
    try {
      const symbol = coin === 'BTC' ? 'BTCUSDT' : `${coin}USDT`;
      const binanceResponse = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        { timeout: 5000 }
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
    }
  }

  return {
    binance: binanceData,
    coinmarketcap: null,
  };
}

/**
 * Get cached market data from Firestore
 */
async function getCachedMarketData() {
  try {
    const cacheDoc = await getDoc(doc(db, 'market_data', 'latest'));
    if (cacheDoc.exists()) {
      const cacheData = cacheDoc.data();
      const cacheTimestamp = cacheData.timestamp ? new Date(cacheData.timestamp).getTime() : 0;
      const now = Date.now();
      const age = now - cacheTimestamp;
      
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
 * Save market data to cache
 */
async function saveMarketDataToCache(marketData) {
  try {
    await setDoc(doc(db, 'market_data', 'latest'), {
      data: marketData,
      timestamp: new Date().toISOString(),
    });
    console.log('✅ Market data cached');
  } catch (error) {
    console.error('Error saving cache:', error.message);
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
      const promptDoc = await getDoc(doc(db, 'settings', 'trading_prompt'));
      prompt = promptDoc.exists() ? promptDoc.data().value : '';
    } catch (e) {
      console.warn('Could not load prompt from Firestore, using default');
    }

    // Complete prompt - requests all fields for full trading decisions
    const DEFAULT_PROMPT = `Generate trading signals for BTC, ETH, SOL, XRP, DOGE, BNB.

Account: {account_info}
Positions: {positions}
Market: {market_data}

For each coin, provide complete trading decision with ALL fields:
- side: "LONG", "SHORT", or "HOLD"
- leverage: 10-20 (use 10 for HOLD)
- notional: position size in USD (0 for HOLD)
- profit_target: target price in USD (null for HOLD)
- stop_loss: stop loss price in USD (null for HOLD)
- confidence: 0.0-1.0 (your confidence in this trade, 0.0 for HOLD)
- risk_usd: USD amount at risk (calculate: abs(entry_price - stop_loss) * (notional/entry_price), 0 for HOLD)
- invalidation_condition: specific condition to invalidate the trade (REQUIRED, use "N/A" for HOLD)
- exit_plan: detailed exit strategy with cooldown and invalidation triggers (REQUIRED, use "N/A" for HOLD)
- rationale: brief explanation of decision (REQUIRED, use "No clear setup" for HOLD)

IMPORTANT: 
- For HOLD positions, set notional=0, profit_target=null, stop_loss=null, confidence=0.0, risk_usd=0
- For LONG/SHORT positions, ALL fields must have real values (no null except profit_target/stop_loss if not applicable)
- Calculate risk_usd based on stop_loss distance and position size
- confidence should reflect your conviction: 0.5-0.7 = moderate, 0.7-0.9 = high, 0.9+ = very high

Example JSON format:
{
  "BTC": {
    "side": "HOLD",
    "leverage": 10,
    "notional": 0,
    "profit_target": null,
    "stop_loss": null,
    "confidence": 0.0,
    "risk_usd": 0,
    "invalidation_condition": "N/A",
    "exit_plan": "N/A",
    "rationale": "No clear setup"
  },
  "SOL": {
    "side": "SHORT",
    "leverage": 15,
    "notional": 300,
    "profit_target": 118,
    "stop_loss": 135,
    "confidence": 0.75,
    "risk_usd": 35.1,
    "invalidation_condition": "Price closes above 135 on 4H chart",
    "exit_plan": "Hold until profit target 118 or stop loss 135. Close if invalidation condition met. Cooldown 15min after entry.",
    "rationale": "Bearish trend continuation, oversold bounce expected. Risk/reward favorable."
  }
}

CRITICAL: Output ONLY valid JSON. No text before or after. Include ALL coins: BTC, ETH, SOL, XRP, DOGE, BNB. Every field must be present.`;

    // Replace placeholders in prompt
    const basePrompt = prompt || DEFAULT_PROMPT;
    const userPrompt = basePrompt
      .replace('{account_info}', JSON.stringify(accountInfo, null, 2))
      .replace('{positions}', JSON.stringify(positions, null, 2))
      .replace('{market_data}', JSON.stringify(marketData, null, 2));

    console.log('🤖 Calling DeepSeek Reasoner API...');
    
    // Call DeepSeek API with reasoner model
    const deepseekResponse = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: 'You are a quantitative trading AI. After analyzing, you MUST output ONLY a valid JSON object. The JSON must be the very last thing in your response. No text after the JSON.',
          },
          {
            role: 'user',
            content: userPrompt + '\n\nCRITICAL INSTRUCTIONS:\n1. Think through your analysis in the reasoning\n2. At the END, output ONLY the JSON object\n3. The JSON must be complete and valid\n4. Do NOT add any text after the JSON\n5. The JSON must be the absolute last thing in your response',
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 8000, // Increased tokens significantly - reasoner needs more room
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000, // 3 minutes timeout
      }
    );

    const choice = deepseekResponse.data.choices[0];
    const aiContent = choice.message.content || '';
    const reasoningContent = choice.message.reasoning_content || '';
    
    console.log('📝 Response structure:', {
      hasContent: !!aiContent,
      hasReasoning: !!reasoningContent,
      contentLength: aiContent.length,
      reasoningLength: reasoningContent.length,
    });
    
    // Combine content and reasoning for display
    const fullResponse = reasoningContent 
      ? `${reasoningContent}\n\n${aiContent}`.trim()
      : aiContent;
    
    // Parse JSON from response
    let jsonData;
    let parseSource = 'unknown';
    
    // If reasoning model returns empty content, extract JSON from reasoning_content
    const textToParse = aiContent || reasoningContent;
    
    if (!textToParse) {
      throw new Error('Both content and reasoning_content are empty');
    }
    
    // Try multiple extraction methods
    try {
      // Method 1: Direct JSON parse
      jsonData = JSON.parse(textToParse);
      parseSource = 'direct';
      console.log('✅ JSON parsed successfully (direct parse)');
    } catch (e1) {
      try {
        // Method 2: Extract from markdown code blocks
        const jsonMatch = textToParse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[1]);
          parseSource = 'markdown';
          console.log('✅ JSON parsed successfully (from markdown)');
        }
      } catch (e2) {
        // Continue
      }
      
      if (!jsonData) {
        try {
          // Method 3: Find ALL JSON-like objects and try each (reasoning model might have JSON anywhere)
          // Use a more flexible regex that handles nested objects
          const jsonPattern = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
          const allMatches = textToParse.match(jsonPattern);
          if (allMatches && allMatches.length > 0) {
            console.log(`Found ${allMatches.length} potential JSON objects, trying from last...`);
            // Try from last match backwards (reasoning model typically puts final answer at end)
            for (let i = allMatches.length - 1; i >= 0; i--) {
              try {
                const parsed = JSON.parse(allMatches[i]);
                // Verify it's a trading signal object (should have coin keys)
                const keys = Object.keys(parsed);
                if (keys.length > 0 && keys.some(k => ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'].includes(k))) {
                  jsonData = parsed;
                  parseSource = `json-object-${i}`;
                  console.log(`✅ JSON parsed successfully (object match #${i}, keys: ${keys.join(', ')})`);
                  break;
                }
              } catch (parseErr) {
                // Try next match
              }
            }
          }
        } catch (e3) {
          // Continue
        }
      }
      
      if (!jsonData) {
        // Method 4: Look for JSON pattern in the last 2000 chars (where final answer should be)
        const lastPart = textToParse.substring(Math.max(0, textToParse.length - 2000));
        const jsonStart = lastPart.indexOf('{');
        if (jsonStart !== -1) {
          // Try to extract from this point to end
          const potentialJson = lastPart.substring(jsonStart);
          // Try to find complete JSON by matching braces
          let braceCount = 0;
          let jsonEnd = -1;
          for (let i = 0; i < potentialJson.length; i++) {
            if (potentialJson[i] === '{') braceCount++;
            if (potentialJson[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          if (jsonEnd > 0) {
            try {
              const extracted = potentialJson.substring(0, jsonEnd);
              jsonData = JSON.parse(extracted);
              parseSource = 'end-extraction';
              console.log('✅ JSON parsed successfully (end extraction)');
            } catch (e4) {
              // Try without complete matching
            }
          }
        }
      }
      
      if (!jsonData) {
        // Method 5: Extract everything between first { and last } and try to parse
        const firstBrace = textToParse.indexOf('{');
        const lastBrace = textToParse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const extracted = textToParse.substring(firstBrace, lastBrace + 1);
            jsonData = JSON.parse(extracted);
            parseSource = 'brace-extraction';
            console.log('✅ JSON parsed successfully (brace extraction)');
          } catch (e4) {
            // Final attempt failed
          }
        }
      }
    }
    
    if (!jsonData) {
      console.error('❌ Failed to parse JSON from response');
      console.error('Content (first 2000 chars):', aiContent.substring(0, 2000));
      console.error('Reasoning (first 2000 chars):', reasoningContent.substring(0, 2000));
      console.error('Reasoning (last 3000 chars):', reasoningContent.substring(Math.max(0, reasoningContent.length - 3000)));
      
      // Try to find if there's an incomplete JSON at the end
      const lastPart = reasoningContent.substring(Math.max(0, reasoningContent.length - 1000));
      const jsonStart = lastPart.indexOf('{');
      if (jsonStart !== -1) {
        console.error('Found potential JSON start at position:', reasoningContent.length - 1000 + jsonStart);
        console.error('Incomplete JSON:', lastPart.substring(jsonStart));
      }
      
      throw new Error('Could not extract valid JSON from response');
    }
    
    console.log(`✅ JSON extracted from: ${parseSource}`);

    return { 
      signal: jsonData, 
      rawResponse: fullResponse,
      reasoningContent: reasoningContent,
      content: aiContent,
      parseSource: parseSource
    };
  } catch (error) {
    console.error('Error generating signal:', error.message);
    throw error;
  }
}

/**
 * Test endpoint for Firebase Cloud Function logic
 * NOTE: This endpoint does NOT send Telegram notifications - it's for testing only
 */
export async function GET(request) {
  try {
    console.log('🧪 [Firebase Cloud Test] Starting test (no Telegram notifications)...');
    
    // Get settings
    const { isTestMode } = await getTestModeSettings();
    console.log(`✅ [Firebase Cloud Test] Test mode: ${isTestMode}`);

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
      return NextResponse.json({
        success: false,
        error: 'Live mode not supported in test endpoint',
      }, { status: 400 });
    }

    console.log('📊 [Firebase Cloud Test] Account info:', accountInfo);
    console.log('📊 [Firebase Cloud Test] Positions:', positions.length);

    // Fetch market data
    console.log('📊 [Firebase Cloud Test] Fetching market data...');
    const cached = await getCachedMarketData();
    let marketData;
    
    if (cached.isCached && cached.data) {
      marketData = cached.data;
      console.log('✅ [Firebase Cloud Test] Using cached market data');
    } else {
      marketData = await fetchMarketDataFromAPI(TRADABLE_COINS);
      await saveMarketDataToCache(marketData);
      console.log('✅ [Firebase Cloud Test] Fetched fresh market data');
    }

    // Generate signal
    console.log('🤖 [Firebase Cloud Test] Generating signal with DeepSeek Reasoner...');
    const { signal, rawResponse, reasoningContent, content, parseSource } = await generateSignal(
      accountInfo, 
      positions, 
      marketData, 
      isTestMode
    );
    console.log('✅ [Firebase Cloud Test] Signal generated');

    // Execute trades (disabled in test endpoint)
    // NOTE: This endpoint does NOT execute trades or send Telegram notifications - testing only
    let tradeExecution = { executed: false, reason: 'Test endpoint - trades and notifications disabled' };
    
    // Prepare user prompt for saving
    const userPrompt = `Account: ${JSON.stringify(accountInfo)}\nPositions: ${JSON.stringify(positions)}\nMarket: ${JSON.stringify(marketData)}`;

    return NextResponse.json({
      success: true,
      data: {
        signal,
        rawResponse,
        reasoningContent,
        content,
        parseSource,
        accountInfo,
        positions,
        marketData,
        tradeExecution,
        userPrompt,
        isTestMode,
      },
    });
  } catch (error) {
    console.error('❌ [Firebase Cloud Test] Error:', error.message);
    console.error(error.stack);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

