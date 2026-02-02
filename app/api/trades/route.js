import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTestModeSettings } from '@/lib/simulationEngine';

export async function GET(request) {
  try {
    await db.ensureInit();

    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '100');

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();

    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_trades' : 'trades';

    const snapshot = await db.getDocs(collectionName, {
      orderBy: { field: 'timestamp', direction: 'desc' },
      limit: limitCount
    });

    const trades = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      trades.push({
        id: doc.id,
        timestamp: data.timestamp || doc.id,
        ...data,
      });
    });

    // Sort manually if needed
    if (trades.length > 0 && typeof trades[0].timestamp === 'string') {
      trades.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
    }

    return NextResponse.json({
      success: true,
      data: trades,
      isTestMode,
    });
  } catch (error) {
    console.error('Trades API Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
