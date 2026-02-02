# CLAUDE.md - AI Assistant Guidelines for DeepSeek Trader

This document provides essential context for AI assistants working with the DeepSeek Trader codebase.

## Project Overview

**DeepSeek Trader** is an AI-powered cryptocurrency trading assistant that:
- Integrates DeepSeek's reasoning API with Hyperliquid perpetual futures trading
- Analyzes market data every 5 minutes via Firebase Cloud Functions
- Generates automated trading signals using DeepSeek AI
- Supports both live trading and paper trading (test mode)
- Sends notifications via Telegram
- Provides a web dashboard for monitoring and configuration

## Architecture

### Directory Structure

```
deepseektrader/
├── app/                          # Next.js 16 app directory (React 19)
│   ├── api/                      # API route handlers
│   │   ├── deepseek/chat/        # Chat interface with DeepSeek
│   │   ├── generate-signal/      # Main trading signal generation
│   │   ├── positions/            # Hyperliquid positions fetcher
│   │   ├── market-data/          # Binance/CoinMarketCap data
│   │   ├── settings/             # Firestore settings CRUD
│   │   ├── signals/              # Signal history retrieval
│   │   ├── telegram/send/        # Telegram notifications
│   │   ├── test-mode/            # Paper trading endpoints
│   │   └── trades/               # Trade history
│   ├── page.js                   # Main dashboard with portfolio charts
│   ├── settings/page.js          # Configuration UI
│   ├── leaderboard/page.js       # Performance analytics
│   ├── layout.js                 # Root layout with fonts/metadata
│   └── globals.css               # Tailwind CSS global styles
├── lib/                          # Shared libraries
│   ├── config.js                 # App constants & DEFAULT_PROMPT
│   ├── firebase.js               # Firebase/Firestore initialization
│   ├── simulationEngine.js       # Paper trading simulation logic
│   └── tradeExecutor.js          # Real trade execution (Hyperliquid)
├── functions/                    # Firebase Cloud Functions
│   ├── index.js                  # Scheduled cron function (every 5 min)
│   └── package.json              # Cloud Functions dependencies
└── public/                       # Static assets (logos, SVGs)
```

### Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework with App Router |
| React | 19 | UI library |
| Firebase/Firestore | 12.6 | Database and Cloud Functions |
| Hyperliquid SDK | 1.7.7 | Perpetual futures trading |
| Tailwind CSS | 4 | Utility-first styling |
| Recharts | 3.4 | Data visualization |
| Axios | 1.13 | HTTP client |

### Data Flow

```
Firebase Cloud Function (*/5 * * * *)
    ↓
Fetch wallet settings from Firestore
    ↓
Check mode: Test → simulationEngine | Live → Hyperliquid API
    ↓
Fetch positions & account data
    ↓
Fetch market data from Binance API
    ↓
Format data into DEFAULT_PROMPT
    ↓
Send to DeepSeek Reasoner API
    ↓
Parse JSON trading decisions
    ↓
Execute trades (simulated or real)
    ↓
Save signal to Firestore
    ↓
Send Telegram notification
```

## Development Setup

### Prerequisites
- Node.js 20+
- npm 9+
- Firebase CLI (for Cloud Functions)

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# For Cloud Functions development
cd functions && npm install
npm run serve  # Local emulator
```

### Environment Variables

Create `.env.local` with:

```env
# AI API
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Optional
COINMARKETCAP_API_KEY=optional_api_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Trading (for live mode)
AUTO_TRADING_ENABLED=false
HYPERLIQUID_NETWORK=mainnet|testnet
HYPERLIQUID_PRIVATE_KEY=0x...
```

## Coding Conventions

### JavaScript Style

- **No TypeScript** - Project uses plain JavaScript with JSDoc comments where helpful
- **ES Modules** - Use `import/export` syntax
- **Path aliases** - Use `@/` prefix for imports from root (configured in `jsconfig.json`)
- **Async/await** - Preferred over promise chains
- **Console logging** - Use emoji prefixes for visibility:
  - `🚀` Start of operation
  - `✅` Success
  - `❌` Error
  - `📊` Data/metrics
  - `💾` Database operations
  - `⚠️` Warnings

### API Route Pattern

```javascript
// app/api/[endpoint]/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    // ... logic
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `settings/*` | User configuration (wallet, prompt, telegram, test_mode) |
| `signals/*` | Live trading signal history |
| `test_signals/*` | Paper trading signal history |
| `test_portfolio/current` | Current paper trading state |
| `test_trades/*` | Paper trading execution history |
| `trades/*` | Live trade execution history |
| `market_data/latest` | Cached market data (5-min TTL) |

### Trading Signal Format

The AI returns JSON in this structure:

```json
{
  "COIN": {
    "side": "LONG|SHORT|HOLD",
    "leverage": 10-20,
    "notional": 1000,
    "profit_target": 50000,
    "stop_loss": 45000,
    "invalidation_condition": "price breaks below support",
    "exit_plan": "close if RSI > 80 or hit SL",
    "rationale": "bullish momentum confirmed"
  }
}
```

**Tradable coins**: BTC, ETH, SOL, XRP, DOGE, BNB (defined in `lib/config.js`)

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/config.js` | All configuration constants and DEFAULT_PROMPT |
| `lib/simulationEngine.js` | Paper trading logic with P&L calculation |
| `lib/tradeExecutor.js` | Real Hyperliquid trade execution |
| `app/api/generate-signal/route.js` | Main signal generation endpoint |
| `functions/index.js` | Firebase Cloud Function (runs every 5 min) |
| `app/page.js` | Dashboard with portfolio performance charts |
| `app/settings/page.js` | Configuration UI for wallet, prompts, Telegram |

## Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint check

# Firebase Functions
cd functions
npm run serve            # Local emulator
npm run deploy           # Deploy to Firebase
npm run logs             # View function logs
firebase deploy --only functions:generateTradingSignal
```

## Testing Modes

### Test Mode (Paper Trading)
- Enable via Settings page or Firestore `settings/test_mode`
- Uses `test_portfolio/current` for simulated balance
- Signals saved to `test_signals/*` collection
- No real trades executed

### Live Mode
- Requires `HYPERLIQUID_PRIVATE_KEY` environment variable
- `AUTO_TRADING_ENABLED=true` to execute trades
- Real positions via Hyperliquid SDK

## Important Constraints

1. **Risk Management**
   - Max position risk: 5% of account (`MAX_POSITION_RISK_PCT`)
   - Daily drawdown limit: 10% (`DAILY_DRAWDOWN_LIMIT_PCT`)
   - Leverage range: 10x-20x

2. **Rate Limits**
   - DeepSeek API: 120 second timeout per request
   - Signal generation runs every 5 minutes
   - Market data cached for 5 minutes

3. **API Dependencies**
   - Binance API for market data (primary)
   - CoinMarketCap API (optional fallback)
   - Hyperliquid API for positions/trading

## Debugging Tips

1. **Signal Generation Issues**
   - Check Firestore `signals/*` for saved signals
   - Review Cloud Function logs: `firebase functions:log`
   - Verify DeepSeek API key is valid

2. **Trade Execution Issues**
   - Confirm `test_mode` setting in Firestore
   - Check `tradeExecution` field in signal documents
   - Verify Hyperliquid private key for live trading

3. **Frontend Issues**
   - Dashboard polls data every 30 seconds
   - Check browser console for API errors
   - Verify `NEXT_PUBLIC_BASE_URL` is set correctly

## External Documentation

- [Hyperliquid API Docs](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [DeepSeek API Docs](https://platform.deepseek.com/api-docs)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Next.js App Router](https://nextjs.org/docs/app)

## Contributing Guidelines

1. Follow existing code patterns and emoji logging conventions
2. Test in paper trading mode before enabling live trading
3. Keep API routes consistent with existing error handling patterns
4. Update Firestore collections documentation when adding new data
5. Cloud Functions should be self-contained (no Vercel dependencies)
