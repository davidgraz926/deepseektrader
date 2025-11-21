import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getTestModeSettings } from '@/lib/simulationEngine';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '100');

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    
    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_trades' : 'trades';
    
    const tradesRef = collection(db, collectionName);
    
    // Try to query with timestamp ordering, fallback to all docs if it fails
    let querySnapshot;
    try {
      const q = query(tradesRef, orderBy('timestamp', 'desc'), limit(limitCount));
      querySnapshot = await getDocs(q);
    } catch (error) {
      // If timestamp ordering fails (no index), get all and sort manually
      console.warn('Timestamp ordering failed, fetching all and sorting manually:', error.message);
      const q = query(tradesRef, limit(limitCount * 2)); // Get more to account for filtering
      querySnapshot = await getDocs(q);
    }

    const trades = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      trades.push({
        id: doc.id,
        timestamp: data.timestamp || doc.id, // Use doc ID as fallback timestamp
        ...data,
      });
    });
    
    // Sort manually if timestamp ordering failed
    if (trades.length > 0 && typeof trades[0].timestamp === 'string') {
      trades.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA; // Descending order
      });
    }
    
    // Limit results
    const limitedTrades = trades.slice(0, limitCount);

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

