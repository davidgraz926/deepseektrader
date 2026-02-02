#!/usr/bin/env node

/**
 * CLAWDBOT Setup Wizard
 *
 * Interactive CLI to configure CLAWDBOT in seconds.
 * Run with: node cli/setup.js
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const DATA_DIR = path.join(ROOT_DIR, '.clawdbot-data');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function color(text, c) {
  return `${colors[c]}${text}${colors.reset}`;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question, defaultValue = '') {
  const defaultHint = defaultValue ? color(` (${defaultValue})`, 'dim') : '';
  return new Promise((resolve) => {
    rl.question(`${question}${defaultHint}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function confirm(question) {
  const answer = await ask(`${question} (y/n)`, 'y');
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

function printBanner() {
  console.log('');
  console.log(color('  ╔═══════════════════════════════════════╗', 'cyan'));
  console.log(color('  ║', 'cyan') + color('     CLAWDBOT Setup Wizard', 'bright') + color('              ║', 'cyan'));
  console.log(color('  ║', 'cyan') + color('     AI-Powered Trading Bot', 'dim') + color('             ║', 'cyan'));
  console.log(color('  ╚═══════════════════════════════════════╝', 'cyan'));
  console.log('');
}

function printStep(num, total, text) {
  console.log('');
  console.log(color(`  [${num}/${total}] ${text}`, 'yellow'));
  console.log(color('  ' + '─'.repeat(40), 'dim'));
}

async function main() {
  printBanner();

  // Check if already configured
  const existingEnv = fs.existsSync(ENV_FILE);
  if (existingEnv) {
    console.log(color('  Found existing configuration (.env.local)', 'dim'));
    const reconfigure = await confirm('  Reconfigure?');
    if (!reconfigure) {
      console.log('');
      console.log(color('  Keeping existing config. Run `npm start` to begin!', 'green'));
      rl.close();
      process.exit(0);
    }
  }

  const config = {};

  // Step 1: DeepSeek API Key
  printStep(1, 4, 'DeepSeek API Key');
  console.log(color('  Get your API key from: https://platform.deepseek.com/', 'dim'));
  config.DEEPSEEK_API_KEY = await askSecret('  API Key');

  if (!config.DEEPSEEK_API_KEY) {
    console.log(color('  DeepSeek API key is required!', 'red'));
    rl.close();
    process.exit(1);
  }

  // Step 2: Telegram (optional)
  printStep(2, 4, 'Telegram Notifications (Optional)');
  console.log(color('  Get a bot token from @BotFather on Telegram', 'dim'));
  const setupTelegram = await confirm('  Set up Telegram notifications?');

  if (setupTelegram) {
    config.TELEGRAM_BOT_TOKEN = await askSecret('  Bot Token');
    config.TELEGRAM_CHAT_ID = await ask('  Chat ID');
  }

  // Step 3: Trading Mode
  printStep(3, 4, 'Trading Mode');
  console.log(color('  Test mode uses paper trading with fake money', 'dim'));
  console.log(color('  Live mode requires Hyperliquid credentials', 'dim'));
  const testMode = await confirm('  Use test mode? (recommended for starting)');

  config.TEST_MODE = testMode ? 'true' : 'false';

  if (!testMode) {
    console.log('');
    console.log(color('  Live trading setup:', 'yellow'));
    config.HYPERLIQUID_PRIVATE_KEY = await askSecret('  Hyperliquid Private Key');
    config.HYPERLIQUID_NETWORK = await ask('  Network (testnet/mainnet)', 'testnet');
  }

  // Step 4: Cron interval
  printStep(4, 4, 'Signal Generation');
  console.log(color('  How often should the bot generate trading signals?', 'dim'));
  const interval = await ask('  Interval in minutes', '5');
  config.CRON_INTERVAL_MINUTES = interval;

  // Generate random cron secret
  config.CRON_SECRET = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  // Write config
  console.log('');
  console.log(color('  Writing configuration...', 'dim'));

  const envContent = Object.entries(config)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  fs.writeFileSync(ENV_FILE, envContent + '\n');

  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Initialize default data
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    const defaultSettings = {
      test_mode: { value: testMode, updatedAt: new Date().toISOString() },
      test_balance: { value: 10000, updatedAt: new Date().toISOString() }
    };
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
  }

  const portfolioPath = path.join(DATA_DIR, 'test_portfolio.json');
  if (!fs.existsSync(portfolioPath)) {
    const defaultPortfolio = {
      current: {
        accountValue: 10000,
        availableCash: 10000,
        totalReturn: 0,
        positions: [],
        lastUpdated: new Date().toISOString()
      }
    };
    fs.writeFileSync(portfolioPath, JSON.stringify(defaultPortfolio, null, 2));
  }

  // Done!
  console.log('');
  console.log(color('  ╔═══════════════════════════════════════╗', 'green'));
  console.log(color('  ║', 'green') + color('     Setup Complete!', 'bright') + color('                    ║', 'green'));
  console.log(color('  ╚═══════════════════════════════════════╝', 'green'));
  console.log('');
  console.log(color('  Your data is stored in:', 'dim'));
  console.log(color(`    ${DATA_DIR}`, 'cyan'));
  console.log('');
  console.log(color('  To start CLAWDBOT, run:', 'bright'));
  console.log(color('    npm start', 'cyan'));
  console.log('');
  console.log(color('  Or for development:', 'dim'));
  console.log(color('    npm run dev', 'dim'));
  console.log('');

  rl.close();
}

main().catch((err) => {
  console.error(color(`  Error: ${err.message}`, 'red'));
  rl.close();
  process.exit(1);
});
