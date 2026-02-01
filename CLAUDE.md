# CLAUDE.md - AI Assistant Guide for DeepSeek Trader

This document provides guidance for AI assistants working with the DeepSeek Trader codebase.

## Project Overview

**DeepSeek Trader** is an AI-powered cryptocurrency trading assistant that uses the DeepSeek Reasoner model to analyze market data and generate trading signals for perpetual futures on Hyperliquid.

### Core Purpose
- Generate quantitative trading signals every 5 minutes using AI analysis
- Display real-time trading signals with full model reasoning
- Support paper trading simulation in test mode
- Send trading notifications via Telegram
- Provide a dashboard for monitoring AI trading decisions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Backend | Next.js API Routes |
| Database | Firebase Firestore |
| Automation | Firebase Cloud Functions (5-minute schedule) |
| Deployment | Vercel (frontend), Firebase (functions) |
| AI Model | DeepSeek Reasoner (deepseek-reasoner) |
| Trading | Hyperliquid API |
| Market Data | Binance API, CoinMarketCap API |

## Directory Structure

```
/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── deepseek/chat/        # DeepSeek AI chat endpoint
│   │   ├── market-data/          # Binance/CoinMarketCap data
│   │   ├── positions/            # Hyperliquid positions
│   │   ├── prepare-signal-data/  # Signal data preparation
│   │   ├── save-signal/          # Save signals to Firestore
│   │   ├── settings/             # Settings CRUD
│   │   ├── signals/              # Fetch/delete signals
│   │   ├── telegram/send/        # Telegram notifications
│   │   ├── test-mode/            # Test mode management
│   │   └── trades/               # Trade history
│   ├── page.js                   # Main dashboard
│   ├── settings/page.js          # Settings page
│   ├── leaderboard/page.js       # Performance stats
│   └── globals.css               # Tailwind styles
├── lib/                          # Shared utilities
│   ├── firebase.js               # Firebase initialization
│   ├── config.js                 # App constants
│   ├── simulationEngine.js       # Paper trading logic
│   └── tradeExecutor.js          # Trade execution
├── functions/                    # Firebase Cloud Functions
│   └── index.js                  # Cron job (*/5 * * * *)
├── public/                       # Static assets
└── [config files]                # package.json, firebase.json, etc.
```

## Development Commands

```bash
# Local development
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint

# Firebase Functions
cd functions
npm run serve            # Local emulator
npm run deploy           # Deploy to Firebase
npm run logs             # View function logs
```

## Key Conventions

### Code Style
- **JavaScript only** - No TypeScript in this project
- **camelCase** for variables and functions
- **UPPER_CASE** for constants
- **kebab-case** for API route directories
- Use `'use client'` directive for client-side React components

### API Response Format
All API endpoints return this structure:
```javascript
{
  success: boolean,
  data: any,        // Response payload
  error?: string    // Error message if success is false
}
```

### Error Handling Pattern
```javascript
try {
  // operation
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('Error description:', error);
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
```

### Async Operations
- Use `async/await` throughout
- Parallel operations with `Promise.all()`
- 3-minute timeout for DeepSeek API calls

## Firestore Database Schema

### Collections

**`settings`** - Key-value configuration
- `wallet` - Hyperliquid wallet address
- `prompt` - Custom trading system prompt
- `telegram_bot_token` - Telegram bot token
- `telegram_chat_id` - Telegram chat ID
- `test_mode` - Boolean for paper trading
- `test_balance` - Initial simulation balance

**`signals` / `test_signals`** - Trading signals
- Document ID: Timestamp format (YYYY-MM-DD-HH-MM-SS-mmm)
- Fields: signal, rawResponse, reasoningContent, userPrompt, accountInfo, positions, marketData, timestamp, model, isTestMode

**`test_portfolio`** - Paper trading state
- Document: `current`
- Fields: accountValue, availableCash, totalReturn, positions[], lastUpdated

**`test_trades`** - Simulated trade history
- Document ID: ISO timestamp
- Fields: type, symbol, side, entryPrice, exitPrice, pnl, reason, timestamp

**`market_data`** - Cached market prices
- Document: `latest`
- Fields: data, timestamp (5-minute cache)

## Signal Generation Flow

1. Firebase Cloud Function triggers every 5 minutes
2. Calls `/api/prepare-signal-data` to gather:
   - Account info (positions, cash, value)
   - Market data (Binance prices)
   - System prompt with placeholders
3. Sends data to DeepSeek Reasoner model
4. Parses JSON response from AI
5. Saves signal to Firestore with full reasoning
6. Updates test portfolio (if test mode)
7. Sends Telegram notification

## Environment Variables

Required in `.env.local`:
```env
# DeepSeek API (required)
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# Firebase (embedded in lib/firebase.js, but can override)
# Project: ai-crypto-97ae9

# Optional - can set via Settings UI
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
COINMARKETCAP_API_KEY=your_api_key

# For production
NEXT_PUBLIC_BASE_URL=https://your-vercel-url.vercel.app
```

## Important Files to Know

| File | Purpose |
|------|---------|
| `app/page.js` | Main dashboard with chart and signals panel |
| `app/api/prepare-signal-data/route.js` | Assembles data for AI analysis |
| `app/api/deepseek/chat/route.js` | DeepSeek API integration |
| `lib/simulationEngine.js` | Paper trading simulation logic |
| `lib/config.js` | Centralized constants and config |
| `lib/firebase.js` | Firebase SDK initialization |
| `functions/index.js` | Cron job Cloud Function |

## Supported Coins

The system tracks these perpetual futures:
- BTC, ETH, SOL, XRP, DOGE, BNB

## Testing

### Test Mode
- Toggle via Settings page (`/settings`)
- Paper trading with virtual balance
- Separate Firestore collections (`test_signals`, `test_trades`)
- Reset via `/api/test-mode/reset`

### Local Firebase Emulator
```bash
cd functions
firebase emulators:start --only functions
```

## Common Tasks for AI Assistants

### Adding a New API Route
1. Create directory in `app/api/[route-name]/`
2. Add `route.js` with GET/POST handlers
3. Follow the standard response format
4. Add error handling with try-catch

### Modifying the Dashboard
1. Edit `app/page.js` (main dashboard)
2. Use Tailwind classes for styling
3. Add `'use client'` for client-side features
4. Use React hooks for state management

### Adding a New Coin
1. Update coin list in `lib/config.js`
2. Ensure Binance API supports the symbol
3. Update prompts if needed

### Debugging Signal Generation
1. Check Firebase Functions logs: `firebase functions:log`
2. Review saved signal in Firestore console
3. Check `reasoningContent` field for AI reasoning
4. Verify market data freshness

## Architecture Decisions

1. **Firebase over Vercel Cron**: Vercel cron deprecated; Firebase provides reliable scheduling
2. **DeepSeek Reasoner**: Chosen for step-by-step reasoning in trading decisions
3. **Paper Trading First**: Test mode allows validation before live trading
4. **Firestore Caching**: 5-minute market data cache reduces API calls
5. **Modular API Routes**: Each feature isolated for maintainability

## Performance Notes

- DeepSeek API: 60-180 seconds response time (reasoning model)
- Market data fetch: ~500ms cached, 2-3s fresh
- Cloud Function timeout: 9 minutes (configured for DeepSeek)
- Signal documents: ~100KB each (includes full reasoning)

## Documentation Files

- `README.md` - Project overview and features
- `SETUP.md` - Quick start guide
- `PROJECT_STATUS.md` - Feature checklist
- `IMPLEMENTATION_SUMMARY.md` - Detailed implementation mapping
- `FIREBASE_FUNCTIONS_SETUP.md` - Cloud Functions deployment
- `TESTNET_SETUP.md` - Hyperliquid testnet config

## Git Workflow

- Main branch: `main`
- Feature branches: `claude/[feature-name]-[session-id]`
- Commit messages: Descriptive, prefixed with type (fix:, feat:, chore:, docs:)

---

*Last updated: 2026-02-01*
