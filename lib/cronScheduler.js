/**
 * Built-in Cron Scheduler
 *
 * Replaces Firebase Cloud Functions with a simple in-process scheduler.
 * Uses node-cron (already in dependencies).
 */

import cron from 'node-cron';

let scheduledTask = null;
let isRunning = false;

/**
 * Generate a trading signal by calling the internal API
 */
async function generateSignal() {
  if (isRunning) {
    console.log('[CRON] Signal generation already in progress, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || '';

    console.log(`[CRON] ${new Date().toISOString()} - Generating trading signal...`);

    const response = await fetch(`${baseUrl}/api/generate-signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      },
      body: JSON.stringify({
        source: 'internal-cron'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[CRON] Signal generated in ${duration}s`);

    // Log a summary of the signal
    if (result.signal) {
      const coins = Object.keys(result.signal);
      const summary = coins.map(coin => {
        const s = result.signal[coin];
        return `${coin}:${s.side}`;
      }).join(' ');
      console.log(`[CRON] Signals: ${summary}`);
    }

  } catch (error) {
    console.error(`[CRON] Error generating signal:`, error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the cron scheduler
 * @param {number} intervalMinutes - How often to run (default: 5)
 */
export function startScheduler(intervalMinutes = 5) {
  // Stop existing task if any
  stopScheduler();

  // Validate interval
  const interval = Math.max(1, Math.min(60, parseInt(intervalMinutes) || 5));

  // Create cron expression (every N minutes)
  const cronExpression = `*/${interval} * * * *`;

  console.log(`[CRON] Starting scheduler - running every ${interval} minutes`);
  console.log(`[CRON] Cron expression: ${cronExpression}`);

  scheduledTask = cron.schedule(cronExpression, generateSignal, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Run once immediately on start (optional - uncomment if desired)
  // generateSignal();

  return {
    interval,
    expression: cronExpression,
    status: 'running'
  };
}

/**
 * Stop the cron scheduler
 */
export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[CRON] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: scheduledTask !== null,
    generatingSignal: isRunning
  };
}

/**
 * Trigger a manual signal generation
 */
export async function triggerManualSignal() {
  return generateSignal();
}

export default {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerManualSignal
};
