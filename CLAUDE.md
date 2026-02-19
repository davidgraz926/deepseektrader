# CLAUDE.md - AI Assistant Guidelines for DeepSeek Trader

This document provides essential context for AI assistants working with the DeepSeek Trader codebase.

## Project Overview

**DeepSeek Trader** is an AI-powered cryptocurrency trading assistant that:
- Integrates DeepSeek's reasoning API (`deepseek-reasoner` model) with Hyperliquid perpetual futures trading
- Analyzes market data every 5 minutes via Firebase Cloud Functions
- Generates automated trading signals using DeepSeek AI
- Supports both live trading and paper trading (test mode)
- Sends notifications via Telegram
- Provides a web dashboard for monitoring and configuration
- Deployed on Vercel (frontend) with Firebase Cloud Functions (scheduled jobs)

## Architecture

### Directory Structure

```
deepseektrader/
├── app/                              # Next.js 16 App Router (React 19)
│   ├── api/                          # API route handlers (14 endpoints)
│   │   ├── deepseek/chat/route.js    # Chat interface with DeepSeek
│   │   ├── firebasecloudtest/route.js # Firebase connectivity test
│   │   ├── generate-signal/route.js  # Main trading signal generation
│   │   ├── market-data/route.js      # Binance/CoinMarketCap data
│   │   ├── positions/route.js        # Hyperliquid positions fetcher
│   │   ├── prepare-signal-data/route.js # Format data for DeepSeek
│   │   ├── save-signal/route.js      # Save signals to Firestore
│   │   ├── settings/route.js         # Firestore settings CRUD
│   │   ├── signals/
│   │   │   ├── route.js              # Signal history retrieval
│   │   │   └── delete/route.js       # Delete signals
│   │   ├── telegram/send/route.js    # Telegram notifications
│   │   ├── test-mode/
│   │   │   ├── reset/route.js        # Reset test portfolio
│   │   │   └── status/route.js       # Get test mode status
│   │   └── trades/route.js           # Trade history
│   ├── page.js                       # Main dashboard (portfolio charts)
│   ├── settings/page.js              # Configuration UI
│   ├── leaderboard/page.js           # Performance analytics
│   ├── layout.js                     # Root layout (Geist fonts, metadata)
│   └── globals.css                   # Tailwind CSS global styles
├── lib/                              # Shared libraries
│   ├── config.js                     # App constants, env vars & DEFAULT_PROMPT
│   ├── firebase.js                   # Firebase/Firestore initialization
│   ├── simulationEngine.js           # Paper trading simulation logic
│   └── tradeExecutor.js              # Real trade execution (Hyperliquid)
├── functions/                        # Firebase Cloud Functions
│   ├── index.js                      # Scheduled cron function (every 5 min)
│   ├── package.json                  # Cloud Functions dependencies
│   └── .gitignore
├── public/                           # Static assets
│   ├── deepseek_logo.png
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
│   └── favicon.ico (in app/)
├── .firebaserc                       # Firebase project config (ai-crypto-97ae9)
├── eslint.config.mjs                 # ESLint (Next.js core-web-vitals)
├── firebase.json                     # Firebase config (Node 20 runtime)
├── jsconfig.json                     # Path aliases (@/*)
├── next.config.mjs                   # Next.js config (minimal)
├── package.json                      # Main project dependencies
├── postcss.config.mjs                # PostCSS with @tailwindcss/postcss
├── vercel.json                       # Vercel deployment config (v2)
└── *.md                              # Documentation files
```

### Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.3 | React framework with App Router |
| React | 19.2.0 | UI library |
| Firebase/Firestore | ^12.6.0 | Database and Cloud Functions |
| Firebase Admin | ^12.0.0 | Server-side Firebase (Cloud Functions) |
| Firebase Functions | ^5.0.0 | Cloud Functions runtime |
| Hyperliquid SDK | ^1.7.7 | Perpetual futures trading |
| Tailwind CSS | ^4 | Utility-first styling |
| @tailwindcss/postcss | ^4 | PostCSS plugin for Tailwind |
| Recharts | ^3.4.1 | Data visualization |
| Axios | ^1.13.2 | HTTP client |
| react-icons | ^5.5.0 | Icon library |
| node-cron | ^4.2.1 | Cron scheduling (legacy, replaced by Firebase) |

### Data Flow

```
Firebase Cloud Function (*/5 * * * * UTC)
    ↓
Fetch test_mode & wallet settings from Firestore
    ↓
Check mode: Test → simulationEngine | Live → Hyperliquid API
    ↓
Fetch positions & account data
    ↓
Fetch market data from Binance API (5-min cache)
    ↓
Format data into DEFAULT_PROMPT (from lib/config.js)
    ↓
Send to DeepSeek Reasoner API (deepseek-reasoner model)
    ↓
Parse JSON trading decisions (4 extraction methods)
    ↓
Execute trades (simulated or real)
    ↓
Save signal to Firestore (signals/* or test_signals/*)
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
HYPERLIQUID_WALLET_ADDRESS=0x...

# Risk management (optional, defaults shown)
MAX_POSITION_RISK_PCT=0.05
DAILY_DRAWDOWN_LIMIT_PCT=0.1
```

For Cloud Functions, set config via Firebase CLI:
```bash
firebase functions:config:set deepseek.api_key="..." deepseek.api_url="..."
firebase functions:config:set telegram.bot_token="..." telegram.chat_id="..."
firebase functions:config:set coinmarketcap.api_key="..."
```

## Coding Conventions

### JavaScript Style

- **No TypeScript** - Project uses plain JavaScript with JSDoc comments where helpful
- **ES Modules** - Use `import/export` syntax in Next.js app; `require()` in Cloud Functions
- **Path aliases** - Use `@/` prefix for imports from root (configured in `jsconfig.json`)
- **Async/await** - Preferred over promise chains
- **Console logging** - Use emoji prefixes for visibility:
  - `🚀` Start of operation
  - `✅` Success
  - `❌` Error
  - `📊` Data/metrics
  - `💾` Database operations
  - `⚠️` Warnings
  - `🧪` Test mode operations
  - `🤖` AI processing
  - `💼` Trade execution
  - `📱` Telegram notifications
  - `📝` Response structure

### API Route Pattern

All API routes follow this consistent pattern:

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

| Collection | Document(s) | Purpose |
|------------|-------------|---------|
| `settings/test_mode` | `{ value: boolean }` | Test mode toggle |
| `settings/test_balance` | `{ value: number }` | Initial test portfolio balance |
| `settings/wallet` | `{ value: string }` | Hyperliquid wallet address |
| `settings/trading_prompt` | `{ value: string }` | Custom trading prompt override |
| `signals/*` | Timestamped docs | Live trading signal history |
| `test_signals/*` | Timestamped docs | Paper trading signal history |
| `test_portfolio/current` | Single doc | Current paper trading state |
| `test_trades/*` | Timestamped docs | Paper trading execution history |
| `trades/*` | Timestamped docs | Live trade execution history |
| `market_data/latest` | Single doc (5-min TTL) | Cached market data |

Signal document IDs use format: `YYYY-MM-DD-HH-MM-SS-mmm`

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
    "rationale": "bullish momentum confirmed",
    "unrealized_pnl": 150.25
  }
}
```

**Tradable coins**: BTC, ETH, SOL, XRP, DOGE, BNB (defined in `lib/config.js`)

### Firestore Signal Document Structure

```javascript
{
  id: "2025-01-15-14-30-45-123",
  walletAddress: "0x..." | "TEST_MODE",
  signal: { /* parsed trading decisions */ },
  rawResponse: "...",
  reasoningContent: "...",
  content: "...",
  userPrompt: "...",
  accountInfo: { /* account state */ },
  positions: [ /* current positions */ ],
  marketData: { /* market snapshot */ },
  isTestMode: boolean,
  timestamp: Firestore.Timestamp,
  timestampString: "ISO string",
  tradeExecution: { /* execution results */ },
  model: "deepseek-reasoner"
}
```

## API Routes Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/deepseek/chat` | POST | Chat interface with DeepSeek AI |
| `/api/generate-signal` | POST | Main signal generation (120s timeout) |
| `/api/prepare-signal-data` | POST | Format data for DeepSeek prompt |
| `/api/save-signal` | POST | Save signal to Firestore |
| `/api/market-data` | GET | Fetch market data (Binance/CMC) |
| `/api/positions` | POST | Get Hyperliquid positions |
| `/api/settings` | GET/POST | Firestore settings CRUD |
| `/api/signals` | GET | Retrieve signal history |
| `/api/signals/delete` | DELETE | Delete signals |
| `/api/telegram/send` | POST | Send Telegram notification |
| `/api/test-mode/status` | GET | Get test mode status |
| `/api/test-mode/reset` | POST | Reset test portfolio |
| `/api/trades` | GET | Fetch trade history |
| `/api/firebasecloudtest` | GET | Firebase connectivity test |

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/config.js` | All configuration constants, env vars, and DEFAULT_PROMPT (~107 lines) |
| `lib/firebase.js` | Firebase initialization (project: `ai-crypto-97ae9`) |
| `lib/simulationEngine.js` | Paper trading logic with P&L calculation (~15K) |
| `lib/tradeExecutor.js` | Real Hyperliquid trade execution with risk checks (~6.5K) |
| `app/api/generate-signal/route.js` | Main signal generation endpoint |
| `app/api/prepare-signal-data/route.js` | Data preparation for DeepSeek |
| `app/api/save-signal/route.js` | Signal persistence to Firestore |
| `functions/index.js` | Firebase Cloud Function (~873 lines, runs every 5 min) |
| `app/page.js` | Dashboard with portfolio performance charts (~565 lines) |
| `app/settings/page.js` | Configuration UI (~863 lines) |
| `app/leaderboard/page.js` | Performance analytics (~401 lines) |
| `app/layout.js` | Root layout with Geist fonts and metadata |

## Cloud Function Details

The `generateTradingSignal` function in `functions/index.js`:

- **Schedule**: `*/5 * * * *` (every 5 minutes, UTC)
- **Timeout**: 540 seconds (9 minutes)
- **Memory**: 512MB
- **Runtime**: Node.js 20
- **Model**: `deepseek-reasoner`
- **API Timeout**: 180 seconds (3 minutes)
- **Module system**: CommonJS (`require()`)
- **Dependencies**: `firebase-admin`, `firebase-functions`, `axios`

The function uses 4 JSON extraction methods for robustness when parsing DeepSeek responses:
1. Direct `content` field parsing
2. Extraction from `reasoning_content`
3. Last complete JSON object search (reasoner puts final answer at end)
4. Regex-based fallback extraction

## Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint check (core-web-vitals config)

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
- Uses `test_portfolio/current` for simulated balance (default: $10,000)
- Signals saved to `test_signals/*` collection
- Trades saved to `test_trades/*` collection
- Wallet address set to `"TEST_MODE"` in signal documents
- No real trades executed

### Live Mode
- Requires `HYPERLIQUID_PRIVATE_KEY` environment variable
- `AUTO_TRADING_ENABLED=true` to execute trades
- Real positions via Hyperliquid SDK
- Trades saved to `trades/*` collection

## Important Constraints

1. **Risk Management**
   - Max position risk: 5% of account (`MAX_POSITION_RISK_PCT`)
   - Daily drawdown limit: 10% (`DAILY_DRAWDOWN_LIMIT_PCT`)
   - Leverage range: 10x-20x (min 3x in high volatility)
   - Max 20x total leverage across all positions

2. **Rate Limits & Timeouts**
   - DeepSeek API: 120s timeout (generate-signal route), 180s (chat route and Cloud Function)
   - Signal generation runs every 5 minutes via Cloud Function
   - Market data cached for 5 minutes (`CACHE_DURATION_MS = 5 * 60 * 1000`)
   - Dashboard polls data every 30 seconds

3. **API Dependencies**
   - Binance API for market data (primary, `api.binance.com`)
   - CoinMarketCap API (optional fallback)
   - Hyperliquid API for positions/trading (`api.hyperliquid.xyz`)
   - DeepSeek API for AI reasoning (`api.deepseek.com`)
   - Telegram Bot API for notifications

## Debugging Tips

1. **Signal Generation Issues**
   - Check Firestore `signals/*` or `test_signals/*` for saved signals
   - Review Cloud Function logs: `firebase functions:log`
   - Verify DeepSeek API key is valid
   - Check the 4 JSON parsing methods in `functions/index.js` if parsing fails

2. **Trade Execution Issues**
   - Confirm `test_mode` setting in Firestore
   - Check `tradeExecution` field in signal documents
   - Verify Hyperliquid private key for live trading
   - Check risk management limits (position size, daily drawdown)

3. **Frontend Issues**
   - Dashboard polls data every 30 seconds
   - Check browser console for API errors
   - Verify `NEXT_PUBLIC_BASE_URL` is set correctly

4. **Cloud Function Issues**
   - Use `firebase functions:log` to check execution logs
   - Test connectivity via `/api/firebasecloudtest` endpoint
   - Firebase project: `ai-crypto-97ae9` (see `.firebaserc`)
   - Functions use `firebase-admin` (CommonJS), app uses `firebase` client SDK (ES Modules)

## Project Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant guidelines (this file) |
| `README.md` | Main project documentation |
| `SETUP.md` | Initial setup instructions |
| `FIREBASE_FUNCTIONS_SETUP.md` | Cloud Functions setup guide |
| `IMPLEMENTATION_SUMMARY.md` | Implementation details |
| `PROJECT_STATUS.md` | Current project status |
| `TESTNET_SETUP.md` | Hyperliquid testnet configuration |
| `VERCEL_CRON_REMOVED.md` | Migration notes (Vercel cron → Firebase) |

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
5. Cloud Functions use CommonJS (`require`); the Next.js app uses ES Modules (`import`)
6. Cloud Functions should be self-contained (no Vercel/Next.js dependencies)
7. Use `@/` path alias for all imports in the Next.js app
