// Local cron job script - run this with node-cron or a process manager
// For production, use Vercel Cron, GitHub Actions, or a similar service

const axios = require('axios');
const cron = require('node-cron');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running cron job at', new Date().toISOString());
  
  try {
    const response = await axios.get(`${BASE_URL}/api/cron`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    
    console.log('Cron job completed:', response.data);
  } catch (error) {
    console.error('Cron job error:', error.message);
  }
});

console.log('Cron job scheduler started. Running every 5 minutes...');

