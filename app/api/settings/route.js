import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key parameter is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, 'settings', key);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return NextResponse.json({
        success: true,
        value: docSnap.data().value,
      });
    } else {
      return NextResponse.json({
        success: true,
        value: null,
      });
    }
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
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, 'settings', key);
    await setDoc(docRef, {
      value: value || '',
      updatedAt: new Date().toISOString(),
    });

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

