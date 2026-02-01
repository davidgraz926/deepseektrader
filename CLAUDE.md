# CLAUDE.md - AI Assistant Guide for DeepSeek Trader

This document provides comprehensive guidance for AI assistants working on the DeepSeek Trader codebase.

## Project Overview

**DeepSeek Trader** is an AI-powered cryptocurrency trading signal generator that uses DeepSeek API to analyze market data and generate trading decisions for Hyperliquid perpetual futures. The system runs automated signal generation every 5 minutes via Firebase Cloud Functions.

### Core Functionality
- Automated trading signal generation using DeepSeek AI
- Real-time Hyperliquid position tracking
- Market data from Binance API
- Paper trading (test mode) simulation
- Telegram notifications for signals
- Firebase Firestore for data persistence

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Recharts |
| Backend | Next.js API Routes, Firebase Cloud Functions (Node 20) |
| Database | Firebase Firestore |
| External APIs | DeepSeek, Hyperliquid, Binance, Telegram |
| Package Manager | npm |

## Project Structure

```
deepseektrader/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (server-side)
│   │   ├── deepseek/chat/        # DeepSeek API proxy
│   │   ├── generate-signal/      # Main signal generation
│   │   ├── market-data/          # Binance price data
│   │   ├── positions/            # Hyperliquid positions
│   │   ├── settings/             # Firebase settings CRUD
│   │   ├── signals/              # Signal history + deletion
│   │   ├── telegram/send/        # Telegram notifications
│   │   ├── save-signal/          # Save signal to Firebase
│   │   ├── prepare-signal-data/  # Data preparation
│   │   ├── trades/               # Trade history
│   │   └── test-mode/            # Simulation control
│   ├── leaderboard/page.js       # Leaderboard page
│   ├── settings/page.js          # Settings configuration
│   ├── page.js                   # Main dashboard
│   ├── layout.js                 # Root layout
│   └── globals.css               # Global styles
├── lib/                          # Server utilities
│   ├── firebase.js               # Firebase initialization
│   ├── config.js                 # App config + AI prompts
│   ├── simulationEngine.js       # Paper trading logic
│   └── tradeExecutor.js          # Live trade execution
├── functions/                    # Firebase Cloud Functions
│   ├── index.js                  # 5-min cron job
│   └── package.json
├── public/                       # Static assets
├── package.json
├── jsconfig.json                 # Path alias: @/* → ./*
├── firebase.json                 # Firebase config
├── next.config.mjs
└── vercel.json
```

## Development Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm start         # Start production server
npm run lint      # Run ESLint
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `lib/config.js` | Trading configuration, prompts, tradable coins list |
| `lib/simulationEngine.js` | Paper trading simulation logic |
| `lib/tradeExecutor.js` | Live trading execution (disabled by default) |
| `lib/firebase.js` | Firebase initialization and exports |
| `app/api/generate-signal/route.js` | Main signal generation pipeline |
| `functions/index.js` | Firebase Cloud Function (5-min cron) |

## Environment Variables

```bash
# Required
DEEPSEEK_API_KEY                  # DeepSeek API key

# Telegram (optional but recommended)
TELEGRAM_BOT_TOKEN                # Telegram bot token
TELEGRAM_CHAT_ID                  # Telegram chat ID

# Optional
COINMARKETCAP_API_KEY             # CoinMarketCap API key
NEXT_PUBLIC_BASE_URL              # Application base URL

# Live Trading (disabled by default)
HYPERLIQUID_PRIVATE_KEY           # For live trading
HYPERLIQUID_WALLET_ADDRESS        # For live trading
HYPERLIQUID_NETWORK               # 'mainnet' or 'testnet'
AUTO_TRADING_ENABLED              # Enable live trading
```

## Firebase Collections

| Collection | Purpose |
|------------|---------|
| `settings/` | Key-value configuration (wallet, prompt, telegram config) |
| `signals/` | Live trading signal history |
| `test_signals/` | Test mode signal history |
| `test_portfolio/current` | Current paper trading portfolio state |
| `test_trades/` | Paper trading trade history |
| `market_data/latest` | Cached market data (5-min TTL) |

## Code Conventions

### File Organization
- API routes: `/app/api/[feature]/route.js`
- Pages: `/app/[page]/page.js`
- Server utilities: `/lib/`
- Client components must have `'use client'` directive

### Import Paths
Use the `@/` alias for imports from project root:
```javascript
import { db } from '@/lib/firebase';
import { config } from '@/lib/config';
```

### API Response Format
```javascript
{
  success: boolean,
  data: {...} | null,
  error: string | undefined,
  message: string | undefined
}
```

### Signal JSON Format
```javascript
{
  "BTC": {
    "side": "LONG" | "SHORT" | "HOLD",
    "leverage": 10-20,
    "notional": number,      // USD amount
    "profit_target": number | null,
    "stop_loss": number | null,
    "invalidation_condition": string,
    "exit_plan": string,
    "rationale": string
  }
}
```

### Tradable Coins
Defined in `lib/config.js`:
```javascript
['ETH', 'SOL', 'XRP', 'BTC', 'DOGE', 'BNB']
```

## Application Flow

### Automated Signal Generation (Every 5 Minutes)
1. Firebase Cloud Function triggers
2. Check test mode status from Firestore
3. Fetch wallet address from settings
4. Get account positions (Hyperliquid or test portfolio)
5. Fetch market data from Binance (with 5-min cache)
6. Format prompt with real data + system prompt
7. Call DeepSeek API (`deepseek-reasoner` model)
8. Parse JSON trading decisions
9. Execute simulated trades (test mode) or log (live mode)
10. Save signal to Firestore
11. Send Telegram notification

### Manual Signal Generation
1. User clicks "Generate Signal" on Settings page
2. `/api/prepare-signal-data` formats the prompt
3. `/api/deepseek/chat` calls DeepSeek API
4. `/api/save-signal` stores result and executes trades

## Testing

### Test Mode (Paper Trading)
- Enable via Settings page toggle
- Uses separate collections (`test_signals`, `test_portfolio`)
- Simulates trades without real money
- Can reset portfolio anytime

### Manual Testing
- "Generate Signal" button triggers immediate signal generation
- "Send Test Message" validates Telegram configuration
- Check browser console and terminal for debug output

## Safety Features

1. **Live trading disabled by default** - Requires `AUTO_TRADING_ENABLED=true`
2. **Risk limits** - Max 5% per trade, 20x leverage cap
3. **Test mode** - Paper trading with no real money
4. **Price slippage tolerance** - 0.2% max

## Common Tasks

### Adding a New API Route
1. Create folder: `app/api/[route-name]/`
2. Add `route.js` with exported HTTP methods
3. Use try-catch for error handling
4. Return consistent JSON response format

### Modifying Trading Logic
1. Edit `lib/config.js` for prompt changes
2. Edit `lib/simulationEngine.js` for simulation logic
3. Edit `lib/tradeExecutor.js` for live trading logic

### Adding New Tradable Coins
1. Update `TRADABLE_COINS` array in `lib/config.js`
2. Update prompt examples if needed

### Deploying Cloud Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

## Debugging Tips

1. **Check Firestore** - View signals, settings, portfolio in Firebase Console
2. **Console logs** - API routes log to terminal, client logs to browser
3. **Telegram errors** - Cloud Function sends error notifications
4. **Test mode first** - Always test changes in paper trading mode

## Documentation Files

| File | Content |
|------|---------|
| `README.md` | Project overview and setup |
| `SETUP.md` | Quick setup guide |
| `IMPLEMENTATION_SUMMARY.md` | Detailed feature breakdown |
| `PROJECT_STATUS.md` | Current status and checklist |
| `FIREBASE_FUNCTIONS_SETUP.md` | Cloud Functions deployment |
| `TESTNET_SETUP.md` | Testnet configuration |

## Important Notes for AI Assistants

1. **Never expose API keys** - Use environment variables
2. **Test changes in test mode first** - Avoid real money losses
3. **Preserve risk management logic** - Don't remove safety limits
4. **Follow existing patterns** - Match code style and conventions
5. **Update Firebase rules cautiously** - Security implications
6. **The cron job runs in Firebase** - Not Vercel (see `VERCEL_CRON_REMOVED.md`)
7. **DeepSeek model** - Uses `deepseek-reasoner` for chain-of-thought reasoning
8. **Client vs Server** - API routes are server-side; pages with `'use client'` are client-side
