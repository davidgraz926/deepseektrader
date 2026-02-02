import { NextResponse } from 'next/server';
import { executeAutoTrades } from '@/lib/tradeExecutor';
import { getTestModeSettings, executeSimulatedTrade } from '@/lib/simulationEngine';
import db from '@/lib/db';

// Save signal after DeepSeek responds
export async function POST(request) {
  try {
    await db.ensureInit();

    const {
      walletAddress,
      signal,
      rawResponse,
      reasoningContent,
      content,
      userPrompt,
      accountInfo,
      positions,
      marketData,
      isTestMode: requestIsTestMode,
    } = await request.json();

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    const finalIsTestMode = requestIsTestMode !== undefined ? requestIsTestMode : isTestMode;

    // Execute trades
    let tradeExecution = { executed: false, reason: 'Auto trading disabled' };

    if (finalIsTestMode) {
      // Execute simulated trade
      try {
        const simulationResult = await executeSimulatedTrade(signal, marketData);
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
          signal,
          marketData,
          account: accountInfo,
        });
      } catch (tradeError) {
        console.error('Auto trade execution error:', tradeError.message);
        tradeExecution = { executed: false, error: tradeError.message };
      }
    }

    // Save to database
    const timestamp = new Date().toISOString();
    const collectionName = finalIsTestMode ? 'test_signals' : 'signals';
    const docId = timestamp.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');

    console.log(`Saving signal to ${collectionName} with ID: ${docId}`);

    const signalData = {
      timestamp: timestamp,
      timestampString: timestamp,
      walletAddress: finalIsTestMode ? 'TEST_MODE' : walletAddress,
      signal,
      rawResponse,
      reasoningContent: reasoningContent || null,
      content: content || null,
      userPrompt,
      accountInfo,
      positions,
      marketData,
      tradeExecution,
      isTestMode: finalIsTestMode,
      model: 'deepseek-reasoner',
    };

    await db.setDoc(collectionName, docId, signalData);
    console.log(`Signal saved successfully to ${collectionName}`);

    return NextResponse.json({
      success: true,
      data: {
        signalId: docId,
        timestamp,
        tradeExecution,
      },
    });
  } catch (error) {
    console.error('Save Signal Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
