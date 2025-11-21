import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getTestModeSettings } from '@/lib/simulationEngine';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '10');

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    
    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    console.log(`📡 Fetching signals from ${collectionName} collection (testMode: ${isTestMode})`);
    
    const signalsRef = collection(db, collectionName);
    const q = query(signalsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);

    const signals = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      signals.push({
        id: doc.id,
        ...data,
      });
    });

    console.log(`✅ Found ${signals.length} signals in ${collectionName}`);

    return NextResponse.json({
      success: true,
      data: signals,
      isTestMode,
    });
  } catch (error) {
    console.error('Signals API Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

