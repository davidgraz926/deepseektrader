import { NextResponse } from 'next/server';
import { getTestPortfolio, getTestModeSettings } from '@/lib/simulationEngine';

export async function GET(request) {
  try {
    const { isTestMode, initialBalance } = await getTestModeSettings();
    
    if (!isTestMode) {
      return NextResponse.json({
        success: true,
        isTestMode: false,
      });
    }

    const portfolio = await getTestPortfolio();
    
    return NextResponse.json({
      success: true,
      isTestMode: true,
      initialBalance,
      portfolio,
    });
  } catch (error) {
    console.error('Test Mode Status Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

