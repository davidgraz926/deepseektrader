#!/usr/bin/env node

/**
 * CLAWDBOT Startup Script
 *
 * Single entry point that:
 * 1. Checks if setup is complete
 * 2. Runs setup wizard if needed
 * 3. Starts the Next.js server + cron scheduler
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function printBanner() {
  console.log('');
  log('  ╔═══════════════════════════════════════╗', 'cyan');
  log('  ║         CLAWDBOT                      ║', 'cyan');
  log('  ║         AI Trading Bot                ║', 'cyan');
  log('  ╚═══════════════════════════════════════╝', 'cyan');
  console.log('');
}

async function checkSetup() {
  // Check for .env.local
  if (!fs.existsSync(ENV_FILE)) {
    return false;
  }

  // Check for DeepSeek API key
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  if (!envContent.includes('DEEPSEEK_API_KEY=')) {
    return false;
  }

  return true;
}

async function runSetup() {
  return new Promise((resolve, reject) => {
    const setup = spawn('node', [path.join(__dirname, 'setup.js')], {
      stdio: 'inherit',
      cwd: ROOT_DIR
    });

    setup.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Setup failed'));
      }
    });
  });
}

async function startApp() {
  const isDev = process.argv.includes('--dev') || process.argv.includes('-d');
  const command = isDev ? 'dev' : 'start';

  log(`  Starting CLAWDBOT in ${isDev ? 'development' : 'production'} mode...`, 'dim');

  // If production, check if build exists
  if (!isDev) {
    const nextDir = path.join(ROOT_DIR, '.next');
    if (!fs.existsSync(nextDir)) {
      log('  Building application first...', 'yellow');
      try {
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
      } catch (e) {
        log('  Build failed! Try running: npm run dev', 'red');
        process.exit(1);
      }
    }
  }

  // Start Next.js
  const next = spawn('npm', ['run', command], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      CLAWDBOT_CRON_ENABLED: 'true'
    }
  });

  next.on('close', (code) => {
    process.exit(code);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n  Shutting down CLAWDBOT...', 'yellow');
    next.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    next.kill('SIGTERM');
  });
}

async function main() {
  printBanner();

  const isSetup = await checkSetup();

  if (!isSetup) {
    log('  First time setup detected!', 'yellow');
    log('  Running setup wizard...', 'dim');
    console.log('');

    try {
      await runSetup();
    } catch (e) {
      log('  Setup cancelled or failed.', 'red');
      process.exit(1);
    }
  } else {
    log('  Configuration found', 'green');
  }

  console.log('');
  await startApp();
}

main().catch((err) => {
  log(`  Error: ${err.message}`, 'red');
  process.exit(1);
});
