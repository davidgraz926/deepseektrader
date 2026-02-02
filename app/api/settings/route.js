import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
  try {
    await db.ensureInit();

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key parameter is required' },
        { status: 400 }
      );
    }

    const value = await db.getSetting(key);

    return NextResponse.json({
      success: true,
      value: value,
    });
  } catch (error) {
    console.error('Settings GET Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await db.ensureInit();

    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      );
    }

    await db.setSetting(key, value || '');

    return NextResponse.json({
      success: true,
      message: 'Setting saved successfully',
    });
  } catch (error) {
    console.error('Settings POST Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
