import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { getTestModeSettings } from '@/lib/simulationEngine';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const signalId = searchParams.get('id');

    if (!signalId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Signal ID is required',
        },
        { status: 400 }
      );
    }

    // Check if test mode is enabled
    const { isTestMode } = await getTestModeSettings();
    
    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    console.log(`🗑️ Deleting signal ${signalId} from ${collectionName} collection`);
    
    // Delete the document
    const signalRef = doc(db, collectionName, signalId);
    await deleteDoc(signalRef);

    console.log(`✅ Signal ${signalId} deleted successfully from ${collectionName}`);

    return NextResponse.json({
      success: true,
      message: 'Signal deleted successfully',
      signalId,
      collectionName,
    });
  } catch (error) {
    console.error('Delete Signal Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

