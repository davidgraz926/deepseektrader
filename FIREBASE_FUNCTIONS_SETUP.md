# Firebase Cloud Functions Setup

This guide explains how to move the cron job from Vercel to Firebase Cloud Functions while keeping your Vercel app running.

## Prerequisites

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project (if not already done):
```bash
firebase init functions
```

## Setup Steps

### 1. Install Dependencies

Navigate to the functions directory and install dependencies:

```bash
cd functions
npm install
cd ..
```

### 2. Configure Environment Variables

Set Firebase Functions configuration:

```bash
# Set DeepSeek API credentials
firebase functions:config:set deepseek.api_key="your-deepseek-api-key"
firebase functions:config:set deepseek.api_url="https://api.deepseek.com/v1/chat/completions"

# Set CoinMarketCap API key (optional)
firebase functions:config:set coinmarketcap.api_key="your-coinmarketcap-api-key"

# Set Telegram credentials (optional)
firebase functions:config:set telegram.bot_token="your-telegram-bot-token"
firebase functions:config:set telegram.chat_id="your-telegram-chat-id"
```

Or use environment variables in `.env` file (for local development):
```env
NEXT_PUBLIC_BASE_URL=https://your-vercel-app.vercel.app
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
```

### 3. Deploy the Function

Deploy the scheduled function:

```bash
firebase deploy --only functions:generateTradingSignal
```

Or deploy all functions:
```bash
firebase deploy --only functions
```

### 4. Verify Deployment

Check that the function is deployed:

```bash
firebase functions:list
```

View logs:
```bash
firebase functions:log --only generateTradingSignal
```

## How It Works

1. **Scheduled Execution**: The function runs automatically every 5 minutes via Firebase Pub/Sub scheduler
2. **Data Fetching**: 
   - Gets test mode settings and portfolio from Firestore
   - Fetches market data directly from Binance/CoinMarketCap APIs (with caching)
   - Gets positions (from Firestore for test mode, or Hyperliquid API for live mode)
3. **Signal Generation**: Calls DeepSeek API directly
4. **Trade Execution**: 
   - For test mode: Executes simulated trades directly in Firebase
   - For live mode: Currently disabled (can be enabled with Hyperliquid integration)
5. **Notifications**: Sends Telegram notifications directly via Telegram API
6. **Data Storage**: Saves signals and trade history directly to Firestore

**No Vercel API calls required** - The function works completely independently!

## Schedule Configuration

The function is scheduled to run every 5 minutes using cron syntax:
- `*/5 * * * *` = Every 5 minutes
- Timezone: UTC

To change the schedule, edit `functions/index.js`:
```javascript
exports.generateTradingSignal = functions.pubsub
  .schedule('*/5 * * * *') // Change this
  .timeZone('UTC')
  .onRun(async (context) => {
    // ...
  });
```

## Local Testing

Test the function locally:

```bash
# Start Firebase emulators
firebase emulators:start --only functions

# In another terminal, trigger the function
firebase functions:shell
> generateTradingSignal()
```

## Monitoring

View function logs in Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Functions
4. Click on `generateTradingSignal`
5. View logs and execution history

## Cost Considerations

Firebase Cloud Functions pricing:
- **Free Tier**: 2 million invocations/month, 400,000 GB-seconds/month
- **Paid**: $0.40 per million invocations + compute time

For a function running every 5 minutes:
- 12 invocations/hour
- 288 invocations/day
- ~8,640 invocations/month

This is well within the free tier.

## Disabling Vercel Cron

Once Firebase Functions is working, you can disable Vercel Cron:

1. Remove or comment out the cron job in `vercel.json`
2. Or keep it as a backup/fallback

## Troubleshooting

### Function not running
- Check Firebase Console for errors
- Verify the schedule is enabled
- Check function logs: `firebase functions:log`

### API errors
- Verify `BASE_URL` is set correctly
- Check that your Vercel app is accessible
- Ensure API endpoints are working

### Authentication errors
- Verify DeepSeek API key is set correctly
- Check Firebase Functions config: `firebase functions:config:get`

## Support

For issues, check:
- Firebase Functions logs
- Vercel API logs
- Firebase Console dashboard

