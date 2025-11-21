import { NextResponse } from 'next/server';
import axios from 'axios';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '@/lib/config';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { message, signal } = await request.json();

    // Try to get from environment variables first, then Firebase
    let botToken = TELEGRAM_BOT_TOKEN;
    let chatId = TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Try to get from Firebase
      const [tokenDoc, chatDoc] = await Promise.all([
        getDoc(doc(db, 'settings', 'telegram_bot_token')),
        getDoc(doc(db, 'settings', 'telegram_chat_id')),
      ]);

      if (tokenDoc.exists()) {
        botToken = tokenDoc.data().value;
      }
      if (chatDoc.exists()) {
        chatId = chatDoc.data().value;
      }
    }

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Telegram bot not configured. Please set bot token and chat ID in Settings or environment variables.' },
        { status: 400 }
      );
    }

    // Check if test mode is enabled
    const testModeDoc = await getDoc(doc(db, 'settings', 'test_mode'));
    const isTestMode = testModeDoc.exists() && (testModeDoc.data().value === true || testModeDoc.data().value === 'true');
    
    const modePrefix = isTestMode ? '🧪 TEST MODE: ' : '';
    let text = modePrefix + (message || 'New trading signal received:');
    
    if (signal) {
      text += '\n\n' + JSON.stringify(signal, null, 2);
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Telegram Send Error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.description || error.message,
      },
      { status: 500 }
    );
  }
}

