'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSettings, FiActivity, FiMessageSquare, FiSave, FiSend, FiCreditCard, FiFileText, FiCheckCircle, FiAlertCircle, FiTrendingUp, FiDollarSign, FiRefreshCw, FiToggleLeft, FiToggleRight, FiPieChart } from 'react-icons/fi';

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

  // Dashboard State moved to Settings
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const [generatingSignal, setGeneratingSignal] = useState(false);
  const [signalMessage, setSignalMessage] = useState('');

  useEffect(() => {
    loadSettings();
    // Refresh status every 30 seconds
    const statusInterval = setInterval(() => {
      loadStatus();
    }, 30000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  useEffect(() => {
    if (walletAddress || testMode) {
      loadStatus();
    }
  }, [walletAddress, testMode]);

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

  const loadStatus = async () => {
    try {
      // Check if test mode is enabled
      const testModeRes = await fetch('/api/test-mode/status');
      const testModeData = await testModeRes.json();

      if (testModeData.success && testModeData.isTestMode) {
        // Load test portfolio
        if (testModeData.portfolio) {
          setStatus({
            accountValue: testModeData.portfolio.accountValue,
            availableCash: testModeData.portfolio.availableCash,
            totalReturn: testModeData.portfolio.totalReturn,
          });
          setPositions(testModeData.portfolio.positions || []);
        }
      } else {
        // Load positions if wallet is set
        if (walletAddress) {
          try {
            const posRes = await fetch(`/api/positions?address=${walletAddress}`);
            const posData = await posRes.json();
            if (posData.success) {
              setPositions(posData.data.positions || []);
              setStatus(posData.data.account);
            }
          } catch (err) {
            console.error('Error loading positions:', err);
          }
        }
      }

      // Load market data
      try {
        const marketRes = await fetch('/api/market-data');
        const marketDataRes = await marketRes.json();
        if (marketDataRes.success) {
          setMarketData(marketDataRes.data);
        }
      } catch (err) {
        console.error('Error loading market data:', err);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const generateSignalNow = useCallback(async (silent = false) => {
    // In live mode, wallet address is required
    if (!testMode && !walletAddress) {
      if (!silent) {
        setSignalMessage('⚠️ Please set wallet address first');
        setTimeout(() => setSignalMessage(''), 3000);
      }
      return;
    }

    if (!silent) {
      setGeneratingSignal(true);
      setSignalMessage('');
    }

    try {
      const wallet = testMode ? 'TEST_MODE' : walletAddress || 'TEST_MODE';

      // Step 1: Prepare data
      const prepareRes = await fetch('/api/prepare-signal-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet }),
      });

      const prepareData = await prepareRes.json();
      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare signal data');
      }

      const { systemPrompt, userPrompt, accountInfo, positions, marketData, isTestMode: dataIsTestMode } = prepareData.data;

      // Step 2: Call DeepSeek API
      if (!silent) setSignalMessage('🤖 Calling DeepSeek AI...');

      const deepseekRes = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      const deepseekData = await deepseekRes.json();
      if (!deepseekData.success) {
        throw new Error(deepseekData.error || 'DeepSeek API failed');
      }

      const choice = deepseekData.data.choices[0];
      const aiContent = choice.message.content || '';
      const reasoningContent = choice.message.reasoning_content || '';
      const fullResponse = reasoningContent ? `${reasoningContent}\n\n${aiContent}`.trim() : aiContent;

      // Step 3: Parse JSON
      let jsonData;
      try {
        // Try direct parse
        jsonData = JSON.parse(aiContent);
      } catch (e) {
        // Try markdown extraction
        const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[1]);
        } else {
          // Try finding first { and last }
          const firstBrace = aiContent.indexOf('{');
          const lastBrace = aiContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            jsonData = JSON.parse(aiContent.substring(firstBrace, lastBrace + 1));
          }
        }
      }

      if (!jsonData) throw new Error('Could not extract valid JSON from response');

      // Step 4: Save signal
      if (!silent) setSignalMessage('💾 Saving signal...');

      const saveRes = await fetch('/api/save-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet,
          signal: jsonData,
          rawResponse: fullResponse,
          reasoningContent,
          content: aiContent,
          userPrompt,
          accountInfo,
          positions,
          marketData,
          isTestMode: dataIsTestMode,
        }),
      });

      const saveData = await saveRes.json();

      if (saveData.success) {
        if (!silent) setSignalMessage('✅ Signal generated successfully!');
        setTimeout(() => loadStatus(), 2000);
      } else {
        if (!silent) setSignalMessage(`❌ Error: ${saveData.error}`);
      }
    } catch (error) {
      console.error('Error generating signal:', error);
      if (!silent) setSignalMessage(`❌ Error: ${error.message}`);
    } finally {
      if (!silent) {
        setGeneratingSignal(false);
        setTimeout(() => setSignalMessage(''), 5000);
      }
    }
  }, [testMode, walletAddress]);

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (!value && value !== 0) return '0.00%';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src="/deepseek_logo.png"
                  alt="DeepSeek"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <h1 className="text-xl font-bold text-gray-900">DeepSeek Trader</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href="/leaderboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium transition-all"
              >
                <FiTrendingUp className="w-4 h-4" />
                <span>Leaderboard</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium transition-all"
              >
                <FiSettings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
          <p className="text-gray-500">Manage your trading configuration and API connections</p>
        </div>

        {/* Account Overview Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Account Overview</h2>
              <p className="text-sm text-gray-500">Real-time trading performance and statistics</p>
            </div>
            <button
              onClick={() => generateSignalNow(false)}
              disabled={generatingSignal || (!testMode && !walletAddress)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105"
            >
              {generatingSignal ? (
                <>
                  <FiRefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <FiTrendingUp className="w-5 h-5" />
                  <span>Generate Signal</span>
                </>
              )}
            </button>
          </div>

          {!walletAddress && !testMode && (
            <div className="mb-6 bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start space-x-3">
              <FiAlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-900 mb-1">Wallet Not Configured</p>
                <p className="text-sm text-orange-800">
                  Please configure your wallet address below to start tracking.
                </p>
              </div>
            </div>
          )}

          {signalMessage && (
            <div className={`rounded-xl p-4 mb-6 flex items-center space-x-3 border ${signalMessage.includes('✅')
              ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
              : signalMessage.includes('⚠️')
                ? 'bg-amber-50 border-amber-100 text-amber-900'
                : 'bg-red-50 border-red-100 text-red-900'
              }`}>
              {signalMessage.includes('✅') ? (
                <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <p className="font-medium text-sm">{signalMessage}</p>
            </div>
          )}

          {status ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="group relative bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-6 transition-all hover:shadow-lg hover:border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiTrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${status.totalReturn >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {status.totalReturn >= 0 ? 'PROFIT' : 'LOSS'}
                  </span>
                </div>
                <p className="text-sm font-bold text-emerald-900/60 uppercase tracking-wide mb-1">Total Return</p>
                <p className={`text-4xl font-black ${status.totalReturn >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPercent(status.totalReturn || 0)}
                </p>
              </div>

              <div className="group relative bg-gradient-to-br from-blue-50 via-blue-50/50 to-white border border-blue-100 rounded-2xl p-6 transition-all hover:shadow-lg hover:border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiDollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-700">
                    LIQUIDITY
                  </span>
                </div>
                <p className="text-sm font-bold text-blue-900/60 uppercase tracking-wide mb-1">Available Cash</p>
                <p className="text-4xl font-black text-blue-700">
                  {formatCurrency(status.availableCash || 0)}
                </p>
              </div>

              <div className="group relative bg-gradient-to-br from-purple-50 via-purple-50/50 to-white border border-purple-100 rounded-2xl p-6 transition-all hover:shadow-lg hover:border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiPieChart className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-purple-100 text-purple-700">
                    PORTFOLIO
                  </span>
                </div>
                <p className="text-sm font-bold text-purple-900/60 uppercase tracking-wide mb-1">Account Value</p>
                <p className="text-4xl font-black text-purple-700">
                  {formatCurrency(status.accountValue || 0)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mb-8">
              <FiAlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-base font-bold text-gray-900 mb-1">No Account Data</p>
              <p className="text-sm text-gray-500">Configure your wallet address below to view account information</p>
            </div>
          )}

          {/* Current Positions Table */}
          {positions.length > 0 && (
            <div className="mt-8">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Current Positions</h3>
                <p className="text-sm text-gray-500">Active trades and their performance</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Entry Price</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Unrealized PnL</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Leverage</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Notional USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {positions.map((pos, idx) => {
                      // Calculate current price from market data
                      const symbol = pos.symbol?.replace(/^xyz:/i, '') || pos.symbol;
                      const currentPrice = marketData?.binance?.[symbol]?.price || pos.currentPrice || pos.entryPrice || 0;

                      // Calculate unrealized PnL
                      let unrealizedPnL = pos.unrealizedPnl;
                      if (unrealizedPnL === undefined || unrealizedPnL === null) {
                        unrealizedPnL = pos.unrealizedPnL;
                      }

                      if (unrealizedPnL === undefined || unrealizedPnL === null || unrealizedPnL === 0) {
                        if (pos.side === 'LONG' || (pos.quantity && pos.quantity > 0)) {
                          unrealizedPnL = (currentPrice - (pos.entryPrice || 0)) * (pos.quantity || 0);
                        } else if (pos.side === 'SHORT' || (pos.quantity && pos.quantity < 0)) {
                          unrealizedPnL = ((pos.entryPrice || 0) - currentPrice) * Math.abs(pos.quantity || 0);
                        } else {
                          unrealizedPnL = 0;
                        }
                      }

                      // Calculate notional USD
                      let notionalUSD = pos.notionalUsd;
                      if (!notionalUSD && pos.quantity && pos.entryPrice) {
                        notionalUSD = Math.abs(pos.quantity) * pos.entryPrice;
                      } else if (!notionalUSD && currentPrice && pos.quantity) {
                        notionalUSD = Math.abs(pos.quantity) * currentPrice;
                      }

                      return (
                        <tr key={idx} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-xs text-gray-600">
                                {pos.symbol?.substring(0, 1)}
                              </div>
                              <span className="text-sm font-bold text-gray-900">{pos.symbol}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{pos.quantity.toFixed(4)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{formatCurrency(pos.entryPrice)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold ${unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(unrealizedPnL)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100">{pos.leverage}x</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{formatCurrency(notionalUSD)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Wallet Configuration */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <FiCreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Wallet Configuration</h3>
                <p className="text-sm text-gray-500">Connect your Hyperliquid wallet</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                />
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-sm font-bold text-blue-900 mb-2">Why do we need this?</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Fetch real-time positions and PnL</li>
                  <li>Track account value and performance</li>
                  <li>Generate accurate trading signals based on your portfolio</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Trading Logic */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <FiFileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Trading Logic</h3>
                <p className="text-sm text-gray-500">Customize the AI's behavior</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                System Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={12}
                placeholder="Enter your trading prompt here..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono text-sm leading-relaxed"
              />
              <p className="mt-2 text-xs text-gray-500 flex items-center space-x-2">
                <span>Available variables:</span>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{'{account_info}'}</code>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{'{positions}'}</code>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{'{market_data}'}</code>
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <FiMessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
                <p className="text-sm text-gray-500">Configure Telegram alerts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bot Token
                </label>
                <input
                  type="text"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-mono text-sm"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={testTelegram}
                disabled={loading || !telegramBotToken.trim() || !telegramChatId.trim()}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
              >
                <FiSend className="w-4 h-4" />
                <span>Send Test Message</span>
              </button>
            </div>
          </div>

          {/* Test Mode */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <FiActivity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Test Mode</h3>
                  <p className="text-sm text-gray-500">Simulate trades without real money</p>
                </div>
              </div>

              <button
                onClick={() => setTestMode(!testMode)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${testMode ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${testMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {testMode && (
              <div className="bg-orange-50 rounded-xl p-6 border border-orange-100 animate-fadeIn">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-orange-900 mb-2">
                    Initial Test Balance (USD)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-orange-500 font-bold">$</span>
                    </div>
                    <input
                      type="number"
                      value={testBalance}
                      onChange={(e) => setTestBalance(e.target.value)}
                      placeholder="10000"
                      className="w-full bg-white border border-orange-200 rounded-xl pl-8 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-orange-800">
                    <strong>Status:</strong> <span className="font-bold">Active</span> • Trades are simulated
                  </p>
                  <button
                    onClick={resetSimulation}
                    disabled={loading}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    <span>Reset Simulation</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="sticky bottom-6 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {saved && (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg animate-fadeIn">
                  <FiCheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Settings saved!</span>
                </div>
              )}
              {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg animate-fadeIn">
                  <FiAlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>

            <button
              onClick={saveSettings}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 flex items-center space-x-2"
            >
              {loading ? (
                <FiRefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <FiSave className="w-5 h-5" />
              )}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

