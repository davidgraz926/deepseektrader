import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
  try {
    await db.ensureInit();

    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '10');

    // Check if test mode is enabled
    const isTestMode = await db.getSetting('test_mode');

    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    console.log(`Fetching signals from ${collectionName} collection (testMode: ${isTestMode})`);

    const snapshot = await db.getDocs(collectionName, {
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit: limitCount
    });

    const signals = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      signals.push({
        id: doc.id,
        ...data,
      });
    });

    console.log(`Found ${signals.length} signals in ${collectionName}`);

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
