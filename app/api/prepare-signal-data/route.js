import { NextResponse } from 'next/server';
import axios from 'axios';
import { DEFAULT_PROMPT } from '@/lib/config';
import { getTestModeSettings, getTestPortfolio } from '@/lib/simulationEngine';
import db from '@/lib/db';

// Fast endpoint that prepares data for DeepSeek (no API call)
export async function POST(request) {
  const startTime = Date.now();
  console.log('[Prepare Signal Data] API called');

  try {
    await db.ensureInit();

    const { walletAddress } = await request.json();

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
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
      const positionsUrl = `${baseUrl}/api/positions?address=${walletAddress}`;

      const positionsResponse = await axios.get(positionsUrl, {
        timeout: 10000,
      });

      if (!positionsResponse.data.success) {
        throw new Error(positionsResponse.data.error || 'Failed to fetch positions');
      }

      positionsData = positionsResponse.data.data;
      accountInfo = JSON.stringify(positionsData.account, null, 2);
      positions = JSON.stringify(positionsData.positions, null, 2);
    }

    // Fetch market data
    const marketDataModule = await import('@/app/api/market-data/route');
    const marketDataRequest = new Request('http://localhost:3001/api/market-data', {
      method: 'GET',
    });

    const marketDataResponse = await marketDataModule.GET(marketDataRequest);
    const marketDataResult = await marketDataResponse.json();

    if (!marketDataResult.success) {
      throw new Error(marketDataResult.error || 'Failed to fetch market data');
    }

    const marketData = marketDataResult.data;
    const marketInfo = JSON.stringify(marketData, null, 2);

    // Get prompt from settings or use default
    let prompt = DEFAULT_PROMPT;
    const savedPrompt = await db.getSetting('prompt');
    if (savedPrompt) {
      prompt = savedPrompt;
    }

    // Replace placeholders in prompt
    const formattedPrompt = prompt
      .replace('{account_info}', accountInfo)
      .replace('{positions}', positions)
      .replace('{market_data}', marketInfo);

    // System prompt
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
    console.log(`[Prepare Signal Data] Completed in ${duration}s`);

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
    console.error(`[Prepare Signal Data] Error after ${duration}s:`, error.message);
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
