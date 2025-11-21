import { NextResponse } from 'next/server';
import axios from 'axios';

// Hyperliquid API endpoint for getting user state
const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Fetch user state from Hyperliquid
    const response = await axios.post(HYPERLIQUID_API, {
      type: 'clearinghouseState',
      user: walletAddress,
    });

    const userState = response.data;

    // Parse positions
    const positions = userState?.assetPositions || [];
    const parsedPositions = positions.map((pos) => {
      const position = pos.position;
      return {
        symbol: position.coin,
        quantity: parseFloat(position.szi),
        entryPrice: parseFloat(position.entryPx),
        leverage: parseFloat(position.leverage) || 1,
        liquidationPrice: parseFloat(position.liquidationPx) || 0,
        unrealizedPnl: parseFloat(position.unrealizedPnl) || 0,
        notionalUsd: Math.abs(parseFloat(position.szi) * parseFloat(position.entryPx)),
      };
    });

    // Calculate account summary
    const accountValue = parseFloat(userState?.marginSummary?.accountValue || 0);
    const availableCash = parseFloat(userState?.marginSummary?.freeCollateral || 0);
    const totalReturn = userState?.marginSummary?.totalReturn || 0;

    return NextResponse.json({
      success: true,
      data: {
        account: {
          accountValue,
          availableCash,
          totalReturn: parseFloat(totalReturn) || 0,
        },
        positions: parsedPositions,
      },
    });
  } catch (error) {
    console.error('Positions API Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

