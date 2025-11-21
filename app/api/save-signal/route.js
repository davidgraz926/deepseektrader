import { NextResponse } from 'next/server';
import { executeAutoTrades } from '@/lib/tradeExecutor';
import { getTestModeSettings, executeSimulatedTrade } from '@/lib/simulationEngine';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

// Save signal to Firebase after DeepSeek responds
export async function POST(request) {
  try {
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

    // Save to Firebase
    const timestamp = new Date().toISOString();
    const timestampObj = Timestamp.now();
    const collectionName = finalIsTestMode ? 'test_signals' : 'signals';
    
    const docId = timestamp.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');
    
    console.log(`💾 Saving signal to ${collectionName} with ID: ${docId}`);
    
    const signalData = {
      timestamp: timestampObj,
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
    
    await setDoc(doc(db, collectionName, docId), signalData);
    console.log(`✅ Signal saved successfully to ${collectionName} collection with ID: ${docId}`);
    
    // Verify the save
    const verifyDoc = await getDoc(doc(db, collectionName, docId));
    if (verifyDoc.exists()) {
      console.log(`✅ Verification: Document exists in ${collectionName}`);
    } else {
      console.error(`❌ Verification failed: Document NOT found after save!`);
    }

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

