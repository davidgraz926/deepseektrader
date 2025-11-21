import { NextResponse } from 'next/server';
import axios from 'axios';
import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL } from '@/lib/config';

export async function POST(request) {
  try {
    const { messages } = await request.json();

    console.log('🤖 Calling DeepSeek API (proxy)...');
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        timeout: 180000, // 3 minutes timeout (DeepSeek can take 60-80 seconds)
      }
    );
    console.log('✅ DeepSeek API response received (proxy)');

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      },
      { status: 500 }
    );
  }
}

