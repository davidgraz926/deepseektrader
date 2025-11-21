# DeepSeek Trader

An AI-powered cryptocurrency trading assistant that uses DeepSeek API to analyze market data and generate trading signals, which are then sent to a Telegram bot for execution on Hyperliquid.

## Features

- 🤖 **DeepSeek AI Integration**: Chat interface with DeepSeek API
- 📊 **Status Dashboard**: View account information, positions, and market data
- ⚙️ **Settings Management**: Easy configuration of wallet address, prompts, and Telegram bot
- 🔄 **Automated Signal Generation**: Runs every 5 minutes to fetch data and generate trading signals
- 📱 **Telegram Integration**: Sends trading signals to Telegram bot
- 💰 **Hyperliquid Integration**: Fetches positions and account data from Hyperliquid

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
DEEPSEEK_API_KEY=sk-ba2ff135a0ab48218d88c776e41b32f0
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here (optional)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CRON_SECRET=your_random_secret_here
```

### 3. Firebase Setup

The Firebase configuration is already set up in `lib/firebase.js`. Make sure your Firebase project has Firestore enabled.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Configure Settings

1. Go to the **Settings** page
2. Enter your Hyperliquid wallet address
3. Configure your trading prompt (use `{account_info}`, `{positions}`, and `{market_data}` as placeholders)
4. Set up Telegram bot token and chat ID
5. Click **Save Settings**

### 2. View Status

Visit the **Status** page to see:
- Account summary (total return, available cash, account value)
- Current positions
- Market data for tradable coins

### 3. Chat with AI

Use the main chat interface to interact with the DeepSeek AI assistant.

### 4. Automated Signal Generation

The system automatically:
- Fetches account and position data from Hyperliquid
- Fetches market data from Binance/CoinMarketCap
- Sends the data to DeepSeek API with your configured prompt
- Receives trading signals in JSON format
- Sends signals to your Telegram bot

## Cron Job Setup

### ✅ Firebase Cloud Functions (Current Implementation)

**The cron job is now handled by Firebase Cloud Functions** and runs automatically every 5 minutes.

**Setup:**
1. See `FIREBASE_FUNCTIONS_SETUP.md` for complete setup instructions
2. Deploy the function: `firebase deploy --only functions:generateTradingSignal`
3. The function will automatically run every 5 minutes

**Benefits:**
- ✅ No Vercel cron needed
- ✅ Works independently
- ✅ Free tier covers ~8,640 invocations/month
- ✅ Easy monitoring in Firebase Console

### ⚠️ Deprecated Options

The following options are no longer needed but kept for reference:

- **Vercel Cron**: No longer used (moved to Firebase)
- **Local Cron Script**: `scripts/cron.js` - kept for reference only
- **External Cron Services**: No longer needed

## API Endpoints

- `POST /api/deepseek/chat` - Chat with DeepSeek API
- `GET /api/market-data` - Fetch market data from Binance/CoinMarketCap
- `GET /api/positions?address=WALLET_ADDRESS` - Get positions from Hyperliquid
- `POST /api/generate-signal` - Generate trading signal
- `POST /api/telegram/send` - Send message to Telegram
- `GET /api/cron` - ⚠️ Deprecated: Cron job endpoint (now handled by Firebase Cloud Functions)
- `GET /api/settings?key=KEY` - Get setting value
- `POST /api/settings` - Save setting value

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── status/           # Status page
│   ├── settings/         # Settings page
│   ├── page.js          # Home/chat page
│   └── layout.js        # Root layout
├── lib/
│   ├── firebase.js      # Firebase configuration
│   └── config.js        # App configuration
├── scripts/
│   └── cron.js          # Local cron job script
└── vercel.json          # Vercel cron configuration
```

## Technologies Used

- **Next.js 16** - React framework
- **Firebase** - Database and storage
- **DeepSeek API** - AI chat completions
- **Binance API** - Market data
- **Hyperliquid API** - Trading positions
- **Telegram Bot API** - Signal notifications
- **Tailwind CSS** - Styling

## Notes

- The system fetches data every 5 minutes automatically
- Make sure your Telegram bot has the necessary permissions
- The prompt can be customized in the Settings page
- All signals are saved to Firebase for historical tracking

## License

MIT
# deepseektrader
