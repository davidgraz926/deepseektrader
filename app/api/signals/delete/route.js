import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(request) {
  try {
    await db.ensureInit();

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
    const isTestMode = await db.getSetting('test_mode');

    // Use appropriate collection based on mode
    const collectionName = isTestMode ? 'test_signals' : 'signals';
    console.log(`Deleting signal ${signalId} from ${collectionName} collection`);

    // Delete the document
    await db.deleteDoc(collectionName, signalId);

    console.log(`Signal ${signalId} deleted successfully from ${collectionName}`);

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
