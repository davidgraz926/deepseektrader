import { NextResponse } from 'next/server';
import axios from 'axios';
import { DEFAULT_PROMPT } from '@/lib/config';
import { getTestModeSettings, getTestPortfolio } from '@/lib/simulationEngine';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Fast endpoint that prepares data for DeepSeek (no API call)
export async function POST(request) {
  const startTime = Date.now();
  console.log('🚀 [Prepare Signal Data] API called');
  
  try {
    console.log('📥 [Prepare Signal Data] Parsing request body...');
    const { walletAddress } = await request.json();
    console.log('✅ [Prepare Signal Data] Request parsed, walletAddress:', walletAddress);

    // Check if test mode is enabled
    console.log('🔧 [Prepare Signal Data] Checking test mode settings...');
    const { isTestMode } = await getTestModeSettings();
    console.log('✅ [Prepare Signal Data] Test mode:', isTestMode);
    
    let positionsData;
    let accountInfo;
    let positions;

    if (isTestMode) {
      console.log('📊 [Prepare Signal Data] Loading test portfolio...');
      // Use test portfolio data
      const portfolio = await getTestPortfolio();
      console.log('✅ [Prepare Signal Data] Test portfolio loaded:', {
        accountValue: portfolio?.accountValue,
        availableCash: portfolio?.availableCash,
        positionsCount: portfolio?.positions?.length || 0,
      });
      
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
      console.log('✅ [Prepare Signal Data] Test portfolio data formatted');
    } else {
      console.log('📊 [Prepare Signal Data] Loading live Hyperliquid data...');
      // Use real Hyperliquid data
      if (!walletAddress) {
        console.error('❌ [Prepare Signal Data] Wallet address required but not provided');
        return NextResponse.json(
          { success: false, error: 'Wallet address is required' },
          { status: 400 }
        );
      }

      // Fetch positions
      console.log('🌐 [Prepare Signal Data] Fetching positions from Hyperliquid...');
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
      const positionsUrl = `${baseUrl}/api/positions?address=${walletAddress}`;
      console.log('🌐 [Prepare Signal Data] Positions URL:', positionsUrl);
      
      const positionsResponse = await axios.get(positionsUrl, {
        timeout: 10000, // 10 second timeout
      });
      console.log('✅ [Prepare Signal Data] Positions fetched, success:', positionsResponse.data.success);
      
      if (!positionsResponse.data.success) {
        throw new Error(positionsResponse.data.error || 'Failed to fetch positions');
      }
      
      positionsData = positionsResponse.data.data;
      accountInfo = JSON.stringify(positionsData.account, null, 2);
      positions = JSON.stringify(positionsData.positions, null, 2);
      console.log('✅ [Prepare Signal Data] Live positions data formatted');
    }

    // Fetch market data - call route handler directly to avoid HTTP overhead
    console.log('📈 [Prepare Signal Data] Fetching market data...');
    
    // Import and call the market data route handler directly (no HTTP call)
    const marketDataModule = await import('@/app/api/market-data/route');
    const marketDataRequest = new Request('http://localhost:3001/api/market-data', {
      method: 'GET',
    });
    
    console.log('🌐 [Prepare Signal Data] Calling market-data route handler directly...');
    const marketDataResponse = await marketDataModule.GET(marketDataRequest);
    const marketDataResult = await marketDataResponse.json();
    console.log('✅ [Prepare Signal Data] Market data fetched, success:', marketDataResult.success);
    
    if (!marketDataResult.success) {
      throw new Error(marketDataResult.error || 'Failed to fetch market data');
    }
    
    const marketData = marketDataResult.data;
    const marketInfo = JSON.stringify(marketData, null, 2);
    console.log('✅ [Prepare Signal Data] Market data formatted');

    // Get prompt from Firebase or use default
    console.log('📝 [Prepare Signal Data] Loading prompt from Firebase...');
    let prompt = DEFAULT_PROMPT;
    const settingsDoc = await getDoc(doc(db, 'settings', 'prompt'));
    if (settingsDoc.exists()) {
      prompt = settingsDoc.data().value || DEFAULT_PROMPT;
      console.log('✅ [Prepare Signal Data] Custom prompt loaded from Firebase');
    } else {
      console.log('✅ [Prepare Signal Data] Using default prompt');
    }

    // Replace placeholders in prompt
    console.log('🔄 [Prepare Signal Data] Replacing placeholders in prompt...');
    const formattedPrompt = prompt
      .replace('{account_info}', accountInfo)
      .replace('{positions}', positions)
      .replace('{market_data}', marketInfo);
    console.log('✅ [Prepare Signal Data] Prompt formatted, length:', formattedPrompt.length);

    // Enhanced system prompt
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

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ [Prepare Signal Data] All data prepared successfully in ${duration}s`);
    console.log('📤 [Prepare Signal Data] Returning response...');

    return NextResponse.json({
      success: true,
      data: {
        systemPrompt,
        userPrompt: formattedPrompt,
        accountInfo: positionsData.account,
        positions: positionsData.positions,
        marketData,
        isTestMode,
      },
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`❌ [Prepare Signal Data] Error after ${duration}s:`, error.message);
    console.error('❌ [Prepare Signal Data] Error stack:', error.stack);
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

