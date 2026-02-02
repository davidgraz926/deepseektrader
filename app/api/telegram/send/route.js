import { NextResponse } from 'next/server';
import axios from 'axios';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '@/lib/config';
import db from '@/lib/db';

export async function POST(request) {
  try {
    await db.ensureInit();

    const { message, signal } = await request.json();

    // Try to get from environment variables first, then settings
    let botToken = TELEGRAM_BOT_TOKEN;
    let chatId = TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Try to get from settings
      const [savedToken, savedChatId] = await Promise.all([
        db.getSetting('telegram_bot_token'),
        db.getSetting('telegram_chat_id'),
      ]);

      if (savedToken) botToken = savedToken;
      if (savedChatId) chatId = savedChatId;
    }

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Telegram bot not configured. Please set bot token and chat ID in Settings or environment variables.' },
        { status: 400 }
      );
    }

    // Check if test mode is enabled
    const isTestMode = await db.getSetting('test_mode');

    const modePrefix = isTestMode ? 'TEST MODE: ' : '';
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
