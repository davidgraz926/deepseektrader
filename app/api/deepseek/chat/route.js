import { NextResponse } from 'next/server';
import axios from 'axios';
import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL } from '@/lib/config';

export async function POST(request) {
  try {
    const { messages } = await request.json();

    console.log('🤖 Calling DeepSeek Reasoner API (proxy)...');
    
    // Enhance messages to ensure JSON output
    const enhancedMessages = messages.map((msg, idx) => {
      if (idx === 0 && msg.role === 'system') {
        return {
          ...msg,
          content: msg.content + ' Your final answer MUST be valid JSON only, with no additional text.'
        };
      }
      if (msg.role === 'user') {
        return {
          ...msg,
          content: msg.content + '\n\nIMPORTANT: Return your final trading decisions as a JSON object. Do not include any text before or after the JSON.'
        };
      }
      return msg;
    });
    
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-reasoner',
        messages: enhancedMessages,
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

