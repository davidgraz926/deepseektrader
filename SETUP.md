# Quick Setup Guide

## Step 1: Environment Variables

Create a `.env.local` file in the root directory with:

```env
DEEPSEEK_API_KEY=sk-ba2ff135a0ab48218d88c776e41b32f0
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CRON_SECRET=your_random_secret_here
```

## Step 2: Get Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow instructions
3. Copy the bot token
4. Send `/start` to your bot to get your chat ID (or use @userinfobot)

## Step 3: Run the Application

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Step 4: Configure Settings

1. Go to Settings page
2. Enter your Hyperliquid wallet address
3. Configure your trading prompt (or use default)
4. Enter Telegram bot token and chat ID
5. Click "Save Settings"

## Step 5: Set Up Cron Job

### For Local Development:

Run in a separate terminal:
```bash
npm run cron
```

### For Production (Vercel):

1. Deploy to Vercel
2. Add environment variables in Vercel dashboard
3. The `vercel.json` file will automatically set up cron jobs

### For Other Hosting:

Use a service like:
- GitHub Actions (scheduled workflows)
- EasyCron
- Cron-job.org

Set it to call: `https://your-domain.com/api/cron` every 5 minutes with header:
```
Authorization: Bearer YOUR_CRON_SECRET
```

## Testing

1. **Test Chat**: Go to home page and send a message
2. **Test Status**: Go to Status page to see account info
3. **Test Telegram**: Click "Test Telegram" button in Settings
4. **Test Signal Generation**: Manually call `/api/generate-signal` or wait for cron

## Troubleshooting

- **Firebase errors**: Make sure Firestore is enabled in your Firebase project
- **API errors**: Check that all environment variables are set
- **Telegram errors**: Verify bot token and chat ID are correct
- **Cron not working**: Check that the cron endpoint is accessible and secret is correct

