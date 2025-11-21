'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiSettings, FiActivity, FiMessageSquare, FiSave, FiSend, FiCreditCard, FiFileText, FiCheckCircle, FiAlertCircle, FiTrendingUp, FiDollarSign, FiRefreshCw, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export default function SettingsPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [prompt, setPrompt] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [testBalance, setTestBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [walletRes, promptRes, telegramTokenRes, telegramChatRes, testModeRes, testBalanceRes] = await Promise.all([
        fetch('/api/settings?key=wallet'),
        fetch('/api/settings?key=prompt'),
        fetch('/api/settings?key=telegram_bot_token'),
        fetch('/api/settings?key=telegram_chat_id'),
        fetch('/api/settings?key=test_mode'),
        fetch('/api/settings?key=test_balance'),
      ]);

      const walletData = await walletRes.json();
      const promptData = await promptRes.json();
      const telegramTokenData = await telegramTokenRes.json();
      const telegramChatData = await telegramChatRes.json();
      const testModeData = await testModeRes.json();
      const testBalanceData = await testBalanceRes.json();

      if (walletData.success && walletData.value) {
        setWalletAddress(walletData.value);
      }
      if (promptData.success && promptData.value) {
        setPrompt(promptData.value);
      }
      if (telegramTokenData.success && telegramTokenData.value) {
        setTelegramBotToken(telegramTokenData.value);
      }
      if (telegramChatData.success && telegramChatData.value) {
        setTelegramChatId(telegramChatData.value);
      }
      if (testModeData.success && testModeData.value !== undefined) {
        setTestMode(testModeData.value === true || testModeData.value === 'true');
      }
      if (testBalanceData.success && testBalanceData.value) {
        setTestBalance(testBalanceData.value);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    setSaved(false);
    setError('');

    try {
      const responses = await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'wallet', value: walletAddress }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'prompt', value: prompt }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'telegram_bot_token', value: telegramBotToken }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'telegram_chat_id', value: telegramChatId }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'test_mode', value: testMode }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'test_balance', value: testBalance }),
        }),
      ]);

      // Check if any requests failed
      const failedResponse = responses.find(r => !r.ok);
      if (failedResponse) {
        const errorData = await failedResponse.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error.message || 'Failed to save settings');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    if (!confirm('Are you sure you want to reset the simulation? This will clear all test trades and reset your balance.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/test-mode/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to reset simulation');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      setError(error.message || 'Failed to reset simulation');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const testTelegram = async () => {
    // Validate both fields are filled
    if (!telegramBotToken || !telegramChatId) {
      setError('Please enter both Telegram bot token and chat ID before testing');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Trim whitespace
    const token = telegramBotToken.trim();
    const chatId = telegramChatId.trim();

    if (!token || !chatId) {
      setError('Please enter both Telegram bot token and chat ID before testing');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First save the settings to Firebase so the API can use them
      await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'telegram_bot_token', value: token }),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'telegram_chat_id', value: chatId }),
        }),
      ]);

      // Now send test message
      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '✅ Test message from DeepSeek Trader - Connection successful!',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setError('');
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to send test message. Please check your bot token and chat ID.');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      setError(error.message || 'Failed to send test message. Please check your bot token and chat ID.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <FiSettings className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold" style={{ color: 'black' }}>DeepSeek Trader</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href="/"
                className="flex items-center space-x-2 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ color: 'black' }}
              >
                <FiActivity className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center space-x-2 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ color: 'black' }}
              >
                <FiTrendingUp className="w-4 h-4" />
                <span>Leaderboard</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center space-x-2" style={{ color: 'black' }}>
            <FiSettings className="w-7 h-7 text-blue-600" />
            <span>Configuration</span>
          </h2>
          <p className="text-sm mt-1" style={{ color: 'black' }}>Configure your trading bot settings and API connections</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 space-y-8">
          <div>
            <label className="block text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: 'black' }}>
              <FiCreditCard className="w-5 h-5 text-blue-600" />
              <span>Wallet Address (Hyperliquid)</span>
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ color: 'black' }}
            />
            <div className="mt-2 space-y-1">
              <p className="text-sm" style={{ color: 'black' }}>
                <strong>What is this?</strong> Your Ethereum wallet address (0x...) that you use on Hyperliquid exchange.
              </p>
              <p className="text-sm" style={{ color: 'black' }}>
                <strong>What does it do?</strong> The system uses this address to automatically fetch:
              </p>
              <ul className="text-sm ml-4 list-disc space-y-1" style={{ color: 'black' }}>
                <li>Your current trading positions (BTC, ETH, SOL, etc.)</li>
                <li>Account balance and available cash</li>
                <li>Profit/loss (PnL) for each position</li>
                <li>Account value and total returns</li>
              </ul>
              <p className="text-sm mt-2" style={{ color: 'black' }}>
                <strong>How to find it:</strong> Log into your Hyperliquid account → Go to your profile/settings → Copy your wallet address (starts with 0x...)
              </p>
              <p className="text-sm text-slate-600 italic mt-1">
                This data is sent to DeepSeek AI every 5 minutes to generate trading signals.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: 'black' }}>
              <FiFileText className="w-5 h-5 text-blue-600" />
              <span>Trading Prompt</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={15}
              placeholder="Enter your trading prompt here. Use {account_info}, {positions}, and {market_data} as placeholders."
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              style={{ color: 'black' }}
            />
            <p className="mt-2 text-sm" style={{ color: 'black' }}>
              This prompt will be sent to DeepSeek API every 5 minutes. Variables: <code className="bg-slate-100 px-2 py-1 rounded">{'{account_info}'}</code>, <code className="bg-slate-100 px-2 py-1 rounded">{'{positions}'}</code>, <code className="bg-slate-100 px-2 py-1 rounded">{'{market_data}'}</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: 'black' }}>
              <FiSend className="w-5 h-5 text-blue-600" />
              <span>Telegram Bot Token</span>
            </label>
            <input
              type="text"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ color: 'black' }}
            />
            <p className="mt-2 text-sm" style={{ color: 'black' }}>
              Get this from @BotFather on Telegram
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: 'black' }}>
              <FiMessageSquare className="w-5 h-5 text-blue-600" />
              <span>Telegram Chat ID</span>
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="123456789"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ color: 'black' }}
            />
            <p className="mt-2 text-sm" style={{ color: 'black' }}>
              Your Telegram chat ID where signals will be sent
            </p>
          </div>

          {/* Test Mode Section */}
          <div className="border-t border-slate-200 pt-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2" style={{ color: 'black' }}>
              <FiDollarSign className="w-5 h-5 text-green-600" />
              <span>Test Mode (Simulation)</span>
            </h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold flex items-center space-x-2" style={{ color: 'black' }}>
                    <span>Enable Test Mode</span>
                  </label>
                  <button
                    onClick={() => setTestMode(!testMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      testMode ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        testMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  {testMode 
                    ? '✅ Test Mode is ON - All trades will be simulated (no real money used)'
                    : '❌ Test Mode is OFF - Trades will execute on Hyperliquid (real money)'}
                </p>
                <p className="text-sm mt-2" style={{ color: 'black' }}>
                  <strong>How it works:</strong> In Test Mode, the AI analyzes real market data and makes real trading decisions, 
                  but trades are simulated. You can see performance, P&L, and AI reasoning without risking real funds.
                </p>
              </div>

              {testMode && (
                <div>
                  <label className="block text-sm font-semibold mb-3 flex items-center space-x-2" style={{ color: 'black' }}>
                    <FiDollarSign className="w-5 h-5 text-green-600" />
                    <span>Initial Test Balance (USD)</span>
                  </label>
                  <input
                    type="number"
                    value={testBalance}
                    onChange={(e) => setTestBalance(e.target.value)}
                    placeholder="10000"
                    min="100"
                    step="100"
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    style={{ color: 'black' }}
                  />
                  <p className="mt-2 text-sm" style={{ color: 'black' }}>
                    Starting balance for simulation (e.g., $10,000). This is "fake money" used to track performance.
                  </p>
                </div>
              )}

              {testMode && (
                <div>
                  <button
                    onClick={resetSimulation}
                    disabled={loading}
                    className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    <span>Reset Simulation</span>
                  </button>
                  <p className="mt-2 text-sm text-slate-600">
                    Clear all test trades and reset balance to initial amount
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              onClick={saveSettings}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <FiSave className="w-5 h-5" />
              <span>{loading ? 'Saving...' : 'Save Settings'}</span>
            </button>
            <button
              onClick={testTelegram}
              disabled={loading || !telegramBotToken.trim() || !telegramChatId.trim()}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <FiSend className="w-5 h-5" />
              <span>Test Telegram</span>
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center space-x-3 shadow-sm">
              <FiCheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-medium">Settings saved successfully!</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center space-x-3 shadow-sm">
              <FiAlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

