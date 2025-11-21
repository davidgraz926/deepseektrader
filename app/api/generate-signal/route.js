import { NextResponse } from 'next/server';
import axios from 'axios';
import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, DEFAULT_PROMPT } from '@/lib/config';
import { executeAutoTrades } from '@/lib/tradeExecutor';
import { getTestModeSettings, executeSimulatedTrade, updateTestPortfolioPrices, getTestPortfolio } from '@/lib/simulationEngine';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

export async function POST(request) {
  const startTime = Date.now();
  console.log('🚀 Generate Signal API called');
  
  try {
    const { walletAddress, customPrompt } = await request.json();
    console.log('📥 Request received:', { walletAddress, hasCustomPrompt: !!customPrompt });

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    
    let positionsData;
    let accountInfo;
    let positions;

    if (isTestMode) {
      // Use test portfolio data
      const portfolio = await getTestPortfolio();
      if (!portfolio) {
        throw new Error('Failed to load test portfolio');
      }

      positionsData = {
        account: {
          accountValue: portfolio.accountValue,
          availableCash: portfolio.availableCash,
          totalReturn: portfolio.totalReturn,
        },
        positions: portfolio.positions || [],
      };
      accountInfo = JSON.stringify(positionsData.account, null, 2);
      positions = JSON.stringify(positionsData.positions, null, 2);
    } else {
      // Use real Hyperliquid data
      if (!walletAddress) {
        return NextResponse.json(
          { success: false, error: 'Wallet address is required' },
          { status: 400 }
        );
      }

      // Fetch positions
      const positionsResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/positions?address=${walletAddress}`
      );
      
      if (!positionsResponse.data.success) {
        throw new Error(positionsResponse.data.error || 'Failed to fetch positions');
      }
      
      positionsData = positionsResponse.data.data;
      accountInfo = JSON.stringify(positionsData.account, null, 2);
      positions = JSON.stringify(positionsData.positions, null, 2);
    }

    // Fetch market data
    const marketResponse = await axios.get(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/market-data`
    );
    
    if (!marketResponse.data.success) {
      throw new Error(marketResponse.data.error || 'Failed to fetch market data');
    }
    
    const marketData = marketResponse.data.data;

    // Format data for prompt (if not already formatted)
    if (!accountInfo || !positions) {
      accountInfo = JSON.stringify(positionsData.account, null, 2);
      positions = JSON.stringify(positionsData.positions, null, 2);
    }
    const marketInfo = JSON.stringify(marketData, null, 2);

    // Get prompt from Firebase or use default
    let prompt = DEFAULT_PROMPT;
    if (customPrompt) {
      prompt = customPrompt;
    } else {
      const settingsDoc = await getDoc(doc(db, 'settings', 'prompt'));
      if (settingsDoc.exists()) {
        prompt = settingsDoc.data().value || DEFAULT_PROMPT;
      }
    }

    // Replace placeholders in prompt
    const formattedPrompt = prompt
      .replace('{account_info}', accountInfo)
      .replace('{positions}', positions)
      .replace('{market_data}', marketInfo);

    // Enhanced system prompt based on nof1.ai structure
    const systemPrompt = `You are a rigorous QUANTITATIVE TRADER and interdisciplinary MATHEMATICIAN-ENGINEER optimizing risk-adjusted returns for perpetual futures on Hyperliquid.

Your role is to analyze market data, account information, and current positions to make optimal trading decisions.

CORE PRINCIPLES:
1. Minimize churn - only change positions when there's strong evidence
2. Respect exit plans - honor invalidation conditions and cooldowns
3. Risk management first - control downside while capturing upside
4. Detailed reasoning - provide step-by-step analysis for every decision

OUTPUT REQUIREMENTS:
- Always respond with valid JSON only
- Include detailed reasoning in your analysis
- Every position must have exit_plan with invalidation conditions
- Honor cooldown periods after position changes
- Use leverage responsibly (10x-20x range)

Be decisive but disciplined. Your decisions should be based on first-principles analysis of market structure, momentum, and risk/reward ratios.`;

    // Call DeepSeek API
    console.log('🤖 Calling DeepSeek API...');
    console.log(`📝 Prompt length: ${formattedPrompt.length} characters`);
    
    let deepseekResponse;
    try {
      deepseekResponse = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: formattedPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          timeout: 120000, // 120 seconds timeout
        }
      );
      
      console.log('✅ DeepSeek API response received');
      console.log('📊 Response status:', deepseekResponse.status);
      console.log('📊 Response data keys:', Object.keys(deepseekResponse.data || {}));
    } catch (deepseekError) {
      console.error('❌ DeepSeek API Error:', deepseekError.message);
      console.error('❌ Error details:', {
        code: deepseekError.code,
        response: deepseekError.response?.data,
        status: deepseekError.response?.status,
      });
      throw new Error(`DeepSeek API failed: ${deepseekError.message}`);
    }

    if (!deepseekResponse?.data?.choices?.[0]?.message?.content) {
      console.error('❌ Invalid DeepSeek response structure:', JSON.stringify(deepseekResponse.data, null, 2));
      throw new Error('Invalid response from DeepSeek API');
    }

    const aiResponse = deepseekResponse.data.choices[0].message.content;
    console.log(`📄 AI response length: ${aiResponse.length} characters`);

    // Try to extract JSON from response
    let jsonData;
    try {
      console.log('🔍 Attempting to parse JSON from AI response...');
      // Try to parse as-is
      jsonData = JSON.parse(aiResponse);
      console.log('✅ JSON parsed successfully (direct parse)');
    } catch (e) {
      console.log('⚠️ Direct parse failed, trying markdown extraction...');
      // Try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[1]);
          console.log('✅ JSON parsed successfully (from markdown)');
        } catch (parseError) {
          console.error('❌ Failed to parse JSON from markdown:', parseError.message);
          // Try to find JSON object in the text
          const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            try {
              jsonData = JSON.parse(objectMatch[0]);
              console.log('✅ JSON parsed successfully (from text match)');
            } catch (finalError) {
              console.error('❌ All JSON parsing attempts failed');
              console.error('📄 First 500 chars of response:', aiResponse.substring(0, 500));
              throw new Error(`Could not extract JSON from response: ${finalError.message}`);
            }
          } else {
            console.error('❌ No JSON object found in response');
            console.error('📄 First 500 chars of response:', aiResponse.substring(0, 500));
            throw new Error('Could not extract JSON from response - no JSON object found');
          }
        }
      } else {
        // Try to find JSON object in the text
        const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try {
            jsonData = JSON.parse(objectMatch[0]);
            console.log('✅ JSON parsed successfully (from text match)');
          } catch (finalError) {
            console.error('❌ Failed to parse JSON from text match');
            console.error('📄 First 500 chars of response:', aiResponse.substring(0, 500));
            throw new Error(`Could not extract JSON from response: ${finalError.message}`);
          }
        } else {
          console.error('❌ No JSON object found in response');
          console.error('📄 First 500 chars of response:', aiResponse.substring(0, 500));
          throw new Error('Could not extract JSON from response - no JSON object found');
        }
      }
    }
    
    console.log('✅ JSON data extracted successfully');
    console.log('📊 JSON keys:', Object.keys(jsonData || {}));

    let tradeExecution = { executed: false, reason: 'Auto trading disabled' };
    
    if (isTestMode) {
      // Execute simulated trade
      try {
        const simulationResult = await executeSimulatedTrade(jsonData, marketData);
        tradeExecution = {
          executed: true,
          mode: 'TEST',
          trades: simulationResult.trades,
          portfolio: simulationResult.portfolio,
        };
      } catch (tradeError) {
        console.error('Simulated trade execution error:', tradeError.message);
        tradeExecution = { executed: false, mode: 'TEST', error: tradeError.message };
      }
    } else {
      // Execute real trade (if enabled)
      try {
        tradeExecution = await executeAutoTrades({
          signal: jsonData,
          marketData,
          account: positionsData.account,
        });
      } catch (tradeError) {
        console.error('Auto trade execution error:', tradeError.message);
        tradeExecution = { executed: false, error: tradeError.message };
      }
    }

    // Save to Firebase - separate collections for test and live mode
    const timestamp = new Date().toISOString();
    const timestampObj = Timestamp.now();
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    
    // Use timestamp as document ID for uniqueness (replace invalid chars)
    const docId = timestamp.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');
    
    console.log(`💾 Attempting to save signal to ${collectionName} with ID: ${docId}`);
    console.log(`📊 Signal data size:`, {
      signal: JSON.stringify(jsonData).length,
      rawResponse: aiResponse.length,
      userPrompt: formattedPrompt.length,
    });
    
    try {
      const signalData = {
        timestamp: timestampObj, // Use Firestore Timestamp for proper querying
        timestampString: timestamp, // Keep ISO string for display
        walletAddress: isTestMode ? 'TEST_MODE' : walletAddress,
        signal: jsonData,
        rawResponse: aiResponse,
        userPrompt: formattedPrompt, // Save the formatted prompt for USER_PROMPT display
        accountInfo: positionsData.account,
        positions: positionsData.positions,
        marketData: marketData, // Save market data for display
        tradeExecution,
        isTestMode,
      };
      
      console.log(`📝 Saving document to Firestore...`);
      await setDoc(doc(db, collectionName, docId), signalData);
      console.log(`✅ Signal saved successfully to ${collectionName} collection with ID: ${docId}`);
      
      // Verify the save by reading it back
      const verifyDoc = await getDoc(doc(db, collectionName, docId));
      if (verifyDoc.exists()) {
        console.log(`✅ Verification: Document exists in ${collectionName} with ID: ${docId}`);
      } else {
        console.error(`❌ Verification failed: Document NOT found after save!`);
      }
    } catch (saveError) {
      console.error(`❌ Error saving signal to ${collectionName}:`, saveError);
      console.error(`❌ Error details:`, {
        message: saveError.message,
        code: saveError.code,
        stack: saveError.stack,
      });
      throw new Error(`Failed to save signal: ${saveError.message}`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ Signal generation completed successfully in ${duration}s`);
    
    return NextResponse.json({
      success: true,
      data: {
        signal: jsonData,
        rawResponse: aiResponse,
        timestamp,
        tradeExecution,
      },
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`❌ Generate Signal Error (after ${duration}s):`, error.message);
    console.error('❌ Error stack:', error.stack);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: `${duration}s`,
      },
      { status: 500 }
    );
  }
}

