import { NextResponse } from 'next/server';
import axios from 'axios';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getTestModeSettings, updateTestPortfolioPrices } from '@/lib/simulationEngine';

// This endpoint will be called by a cron job (e.g., Vercel Cron, or external service)
export async function GET(request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    
    let walletAddress = null;
    if (!isTestMode) {
      // Get wallet address from Firebase (only needed for live mode)
      const settingsDoc = await getDoc(doc(db, 'settings', 'wallet'));
      walletAddress = settingsDoc.exists() ? settingsDoc.data().value : null;

      if (!walletAddress) {
        return NextResponse.json({
          success: false,
          error: 'Wallet address not configured',
        });
      }
    }

    // Generate signal
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const signalResponse = await axios.post(`${baseUrl}/api/generate-signal`, {
      walletAddress: walletAddress || 'TEST_MODE',
    });

    if (!signalResponse.data.success) {
      throw new Error(signalResponse.data.error);
    }

    const { signal, tradeExecution } = signalResponse.data.data;

    // Fetch and cache market data (force refresh every 5 minutes)
    try {
      const marketResponse = await axios.get(`${baseUrl}/api/market-data?force=true`);
      if (marketResponse.data.success) {
        console.log('Market data refreshed and cached');
        
        // If test mode, update portfolio prices
        if (isTestMode) {
          try {
            await updateTestPortfolioPrices(marketResponse.data.data);
          } catch (error) {
            console.error('Error updating test portfolio prices:', error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing market data:', error.message);
    }

    // Send to Telegram
    try {
      await axios.post(`${baseUrl}/api/telegram/send`, {
        message: isTestMode ? '🧪 TEST MODE: New trading signal generated' : 'New trading signal generated',
        signal,
      });
    } catch (telegramError) {
      console.error('Telegram send failed:', telegramError.message);
      // Don't fail the whole request if Telegram fails
    }

    return NextResponse.json({
      success: true,
      message: 'Signal generated and processed',
      tradeExecution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron Job Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

