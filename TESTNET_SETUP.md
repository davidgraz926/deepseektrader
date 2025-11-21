# Hyperliquid Testnet Setup Guide

## Step 1: Create a Testnet Wallet

### Option A: Using MetaMask (Recommended)

1. **Install MetaMask** (if you don't have it)
   - Chrome: https://chrome.google.com/webstore/detail/metamask
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/

2. **Add Hyperliquid Testnet to MetaMask**
   - Open MetaMask
   - Click the network dropdown (top left)
   - Click "Add Network" → "Add a network manually"
   - Enter these details:
     ```
     Network Name: Hyperliquid Testnet
     RPC URL: https://api.hyperliquid-testnet.xyz
     Chain ID: 998
     Currency Symbol: ETH
     Block Explorer: (leave blank or use https://explorer.hyperliquid-testnet.xyz)
     ```
   - Click "Save"

3. **Create/Import Wallet**
   - If new: MetaMask will create a wallet automatically
   - If existing: Import using your seed phrase or private key

4. **Get Your Private Key**
   - Click the three dots (⋮) next to your account name
   - Click "Account Details"
   - Click "Show Private Key"
   - Enter your password
   - **COPY THIS PRIVATE KEY** (starts with `0x...`)
   - ⚠️ **NEVER share this key publicly or commit it to git!**

### Option B: Using Bitget Wallet

1. Download Bitget Wallet: https://web3.bitget.com/
2. Use one-click feature to add HyperEVM testnet
3. Create wallet and export private key (same process as MetaMask)

## Step 2: Get Testnet Funds

### Official Hyperliquid Faucet
1. Visit: https://app.hyperliquid-testnet.xyz/faucet
2. Connect your testnet wallet
3. Request testnet USDC (available every 4 hours)

### Alternative Faucets (if official is slow)
- **QuickNode Faucet**: https://faucet.quicknode.com/hyperliquid
- **Community Faucet**: Search for "Hyperliquid testnet faucet" on Discord/Telegram

## Step 3: Configure Your App for Testnet

### Method 1: Environment Variables (Recommended for Production)

Create or update `.env.local` file in your project root:

```bash
# DeepSeek API Configuration
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# Hyperliquid Testnet Configuration
HYPERLIQUID_NETWORK=testnet
HYPERLIQUID_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
HYPERLIQUID_WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS_HERE  # Optional, auto-derived if not set

# Auto Trading Settings
AUTO_TRADING_ENABLED=true  # Set to 'true' to enable auto-trading
MAX_POSITION_RISK_PCT=0.05  # 5% max risk per trade
DAILY_DRAWDOWN_LIMIT_PCT=0.1  # 10% daily loss limit

# Base URL (for API calls)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Cron Secret (for securing cron endpoint)
CRON_SECRET=your-random-secret-here
```

**Important**: After creating/updating `.env.local`, restart your dev server:
```bash
npm run dev
```

### Method 2: Settings Page (For Quick Testing)

1. Go to your app's Settings page (`/settings`)
2. Enter your testnet wallet address in "Wallet Address" field
3. The app will use this address to fetch positions (read-only)

⚠️ **Note**: For auto-trading, you MUST set `HYPERLIQUID_PRIVATE_KEY` in environment variables. The Settings page wallet address is only for reading positions.

## Step 4: Verify Testnet Connection

1. **Check Wallet Address in Settings**
   - Go to `/settings`
   - Enter your testnet wallet address
   - Save settings

2. **Check Status Page**
   - Go to `/status`
   - You should see your testnet account data (positions, balance, etc.)
   - If you see errors, verify:
     - Wallet address is correct
     - You have some testnet funds
     - Network is set to testnet

3. **Test Signal Generation**
   - Click "Generate Signal Now" on Status page
   - Check if signal is generated successfully
   - Check Firebase for saved signals

4. **Test Auto-Trading (Optional)**
   - Make sure `AUTO_TRADING_ENABLED=true` in `.env.local`
   - Make sure `HYPERLIQUID_PRIVATE_KEY` is set
   - Generate a signal - it should attempt to place orders on testnet
   - Check Hyperliquid testnet explorer to see your orders

## Step 5: Monitor Testnet Activity

- **Hyperliquid Testnet Explorer**: https://explorer.hyperliquid-testnet.xyz
- **Testnet App**: https://app.hyperliquid-testnet.xyz
- Check your wallet address to see:
  - Orders placed
  - Positions opened/closed
  - Account balance changes

## Security Reminders

⚠️ **IMPORTANT**:
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Never share your private key
- Testnet funds have no real value, but still practice good security
- When switching to mainnet, use a different wallet and be extra careful

## Troubleshooting

### "Wallet address not configured" error
- Make sure you've saved the wallet address in Settings page
- Check Firebase to verify it's saved

### "Hyperliquid private key is not configured" error
- Set `HYPERLIQUID_PRIVATE_KEY` in `.env.local`
- Restart your dev server after adding env vars

### "Auto trading disabled" message
- Set `AUTO_TRADING_ENABLED=true` in `.env.local`
- Restart dev server

### No positions showing
- Make sure you have testnet funds
- Verify wallet address is correct
- Check if you're on testnet network in MetaMask

### Orders not executing
- Verify `HYPERLIQUID_PRIVATE_KEY` is correct
- Check if you have enough testnet balance
- Verify `AUTO_TRADING_ENABLED=true`
- Check server logs for error messages

## Next Steps

Once testnet is working:
1. Test the full flow: signal generation → auto-trading
2. Monitor positions and PnL
3. Adjust risk parameters if needed
4. When ready for mainnet, create a NEW wallet and update env vars

