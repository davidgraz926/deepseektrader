'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiActivity, FiSettings, FiRefreshCw, FiTrendingUp, FiDollarSign, FiPieChart, FiChevronDown, FiChevronRight, FiCheckCircle, FiAlertCircle, FiClock } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [generatingSignal, setGeneratingSignal] = useState(false);
  const [signalMessage, setSignalMessage] = useState('');
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('ALL');
  const [isTestMode, setIsTestMode] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [nextSignalTime, setNextSignalTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 5, seconds: 0 });
  const [priceTicker, setPriceTicker] = useState({
    TSLA: { price: 400.25, change: 0.5 },
    NDX: { price: 24250.50, change: 0.3 },
    NVDA: { price: 182.30, change: -0.2 },
    MSFT: { price: 479.60, change: 0.4 },
    AMZN: { price: 218.44, change: 0.1 },
    GOOGL: { price: 292.34, change: -0.1 },
  });

  // Initial load - no dependency on generateSignalNow
  useEffect(() => {
    loadStatus();
    loadPriceTicker();
    
    // Initialize next signal time (5 minutes from now)
    const initialNextTime = new Date(Date.now() + 5 * 60 * 1000);
    setNextSignalTime(initialNextTime);
    
    // Refresh status every 30 seconds
    const statusInterval = setInterval(() => {
      loadStatus();
      loadPriceTicker();
    }, 30000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, []);
  
  // Countdown timer effect - updates every second
  useEffect(() => {
    if (!nextSignalTime) return;
    
    const updateTimer = () => {
      const now = new Date();
      const diff = nextSignalTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        // Timer expired, reset to 5 minutes
        setNextSignalTime(new Date(now.getTime() + 5 * 60 * 1000));
        setTimeRemaining({ minutes: 5, seconds: 0 });
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds });
      }
    };
    
    // Update immediately
    updateTimer();
    
    // Update every second
    const timerInterval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timerInterval);
  }, [nextSignalTime]);

  const loadPriceTicker = async () => {
    try {
      const marketRes = await fetch('/api/market-data');
      const marketDataRes = await marketRes.json();
      
      if (marketDataRes.success && marketDataRes.data.binance) {
        // Keep placeholder prices for now (would need stock API for real data)
        setPriceTicker({
          TSLA: { price: 400.25, change: 0.5 },
          NDX: { price: 24250.50, change: 0.3 },
          NVDA: { price: 182.30, change: -0.2 },
          MSFT: { price: 479.60, change: 0.4 },
          AMZN: { price: 218.44, change: 0.1 },
          GOOGL: { price: 292.34, change: -0.1 },
        });
      }
    } catch (error) {
      console.error('Error loading price ticker:', error);
    }
  };

  const loadStatus = async () => {
    try {
      setLoading(true);
      
      // Check if test mode is enabled
      const testModeRes = await fetch('/api/test-mode/status');
      const testModeData = await testModeRes.json();
      
      if (testModeData.success && testModeData.isTestMode) {
        setIsTestMode(true);
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
        setIsTestMode(false);
        // Get wallet address from settings
        const settingsRes = await fetch('/api/settings?key=wallet');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.value) {
          setWalletAddress(settingsData.value);
        }

        // Load positions if wallet is set
        if (settingsData.success && settingsData.value) {
          try {
            const posRes = await fetch(`/api/positions?address=${settingsData.value}`);
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

      // Load recent signals
      try {
        const signalsRes = await fetch('/api/signals?limit=50');
        const signalsData = await signalsRes.json();
        if (signalsData.success) {
          setSignals(signalsData.data);
          
          // Build chart data from signals - use tradeExecution.portfolio.accountValue or accountInfo.accountValue
          const chartPoints = [];
          
          signalsData.data.forEach(s => {
            try {
              // Get timestamp
              let timestamp;
              if (s.timestamp?.toDate) {
                timestamp = s.timestamp.toDate();
              } else if (s.timestampString) {
                timestamp = new Date(s.timestampString);
              } else if (s.timestamp) {
                timestamp = new Date(s.timestamp);
              } else {
                return; // Skip if no timestamp
              }
              
              // Validate timestamp
              if (isNaN(timestamp.getTime())) {
                console.warn('Invalid timestamp for signal:', s.id);
                return; // Skip invalid timestamps
              }
              
              // Get account value - prefer tradeExecution.portfolio.accountValue, then accountInfo.accountValue
              const accountValue = s.tradeExecution?.portfolio?.accountValue || 
                                   s.accountInfo?.accountValue || 
                                   null;
              
              if (!accountValue || accountValue <= 0) {
                return; // Skip if no valid account value
              }
              
              // Format time string
              const month = timestamp.getMonth() + 1;
              const day = timestamp.getDate();
              const hours = timestamp.getHours().toString().padStart(2, '0');
              const minutes = timestamp.getMinutes().toString().padStart(2, '0');
              const timeStr = `${month}/${day} ${hours}:${minutes}`;
              
              chartPoints.push({
                time: timeStr,
                value: accountValue,
                timestamp: timestamp.getTime(),
              });
            } catch (e) {
              console.warn('Error processing signal for chart:', s.id, e);
            }
          });
          
          // Sort by timestamp ascending
          chartPoints.sort((a, b) => a.timestamp - b.timestamp);
          
          // Add current portfolio value if available and different from last point
          if (isTestMode && status?.accountValue && chartPoints.length > 0) {
            const lastPoint = chartPoints[chartPoints.length - 1];
            if (Math.abs(lastPoint.value - status.accountValue) > 0.01) {
              const now = new Date();
              const month = now.getMonth() + 1;
              const day = now.getDate();
              const hours = now.getHours().toString().padStart(2, '0');
              const minutes = now.getMinutes().toString().padStart(2, '0');
              chartPoints.push({
                time: `${month}/${day} ${hours}:${minutes}`,
                value: status.accountValue,
                timestamp: now.getTime(),
              });
            }
          }
          
          setChartData(chartPoints);
          
          // Auto-generate first signal if none exist
          if ((!signalsData.data || signalsData.data.length === 0) && !autoGenerating) {
            console.log('[Dashboard] No signals found in loadStatus, triggering auto-generation...');
            setAutoGenerating(true);
            // Trigger generation after a short delay to avoid race conditions
            setTimeout(async () => {
              try {
                await generateSignalNow(true); // Silent mode
                // Reload after generation completes (DeepSeek takes ~60-80 seconds)
                setTimeout(() => {
                  setAutoGenerating(false);
                  loadStatus();
                }, 90000); // Wait 90 seconds for DeepSeek to complete
              } catch (error) {
                console.error('[Dashboard] Error in auto-generation:', error);
                setAutoGenerating(false);
              }
            }, 2000);
          }
        } else {
          // API error but still try to generate if no signals
          console.log('[Dashboard] Signals API error, checking if we should generate...');
          setTimeout(async () => {
            try {
              const checkRes = await fetch('/api/signals?limit=1');
              const checkData = await checkRes.json();
              if (checkData.success && (!checkData.data || checkData.data.length === 0) && !autoGenerating) {
                console.log('[Dashboard] Confirmed 0 signals, generating first signal...');
                setAutoGenerating(true);
                await generateSignalNow(true);
                setTimeout(() => {
                  setAutoGenerating(false);
                  loadStatus();
                }, 90000);
              }
            } catch (error) {
              console.error('[Dashboard] Error checking signals:', error);
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Error loading signals:', err);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const toggleSection = (signalId, section) => {
    const key = `${signalId}-${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isSectionExpanded = (signalId, section) => {
    return expandedSections[`${signalId}-${section}`] || false;
  };

  const formatTradingDecision = (signal) => {
    if (!signal.signal || typeof signal.signal !== 'object') return null;
    
    const decisions = [];
    Object.entries(signal.signal).forEach(([coin, data]) => {
      if (data && typeof data === 'object') {
        decisions.push({ coin, ...data });
      }
    });
    return decisions;
  };

  const generateSignalNow = useCallback(async (silent = false) => {
    // In live mode, wallet address is required
    if (!isTestMode && !walletAddress) {
      if (!silent) {
        setSignalMessage('⚠️ Please set wallet address in Settings first');
        setTimeout(() => setSignalMessage(''), 3000);
      }
      return;
    }

    if (!silent) {
      setGeneratingSignal(true);
      setSignalMessage('');
    }
    
    // Reset timer when generating signal (manually or automatically)
    setNextSignalTime(new Date(Date.now() + 5 * 60 * 1000));

    try {
      // Use TEST_MODE if test mode is enabled, otherwise use wallet address
      const wallet = isTestMode ? 'TEST_MODE' : walletAddress || 'TEST_MODE';
      console.log('[Dashboard] 🚀 Generating signal (client-side) with wallet:', wallet);
      
      // Step 1: Prepare data (fast)
      console.log('[Dashboard] 📊 Step 1: Preparing signal data...');
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
      console.log('[Dashboard] ✅ Data prepared, calling DeepSeek API...');
      
      // Step 2: Call DeepSeek API from client
      if (!silent) {
        setSignalMessage('🤖 Calling DeepSeek AI...');
      }
      
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
      
      const aiResponse = deepseekData.data.choices[0].message.content;
      console.log('[Dashboard] ✅ DeepSeek response received, parsing JSON...');
      
      // Step 3: Parse JSON from response
      let jsonData;
      try {
        jsonData = JSON.parse(aiResponse);
      } catch (e) {
        const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[1]);
        } else {
          const objectMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            jsonData = JSON.parse(objectMatch[0]);
          } else {
            throw new Error('Could not extract JSON from response');
          }
        }
      }
      
      console.log('[Dashboard] ✅ JSON parsed, saving signal...');
      
      // Step 4: Save to Firebase
      if (!silent) {
        setSignalMessage('💾 Saving signal...');
      }
      
      const saveRes = await fetch('/api/save-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet,
          signal: jsonData,
          rawResponse: aiResponse,
          userPrompt,
          accountInfo,
          positions,
          marketData,
          isTestMode: dataIsTestMode,
        }),
      });
      
      const saveData = await saveRes.json();
      console.log('[Dashboard] 📡 Save signal response:', saveData);

      if (saveData.success) {
        if (!silent) {
          setSignalMessage('✅ Signal generated successfully!');
        }
        // Reset timer for next 5-minute cycle
        setNextSignalTime(new Date(Date.now() + 5 * 60 * 1000));
        setTimeout(() => loadStatus(), 2000);
      } else {
        if (!silent) {
          setSignalMessage(`❌ Error: ${saveData.error}`);
        }
      }
    } catch (error) {
      console.error('Error generating signal (dashboard):', error);
      if (!silent) {
        setSignalMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      if (!silent) {
        setGeneratingSignal(false);
        setTimeout(() => setSignalMessage(''), 5000);
      }
    }
  }, [isTestMode, walletAddress]);

    // Auto-generate signal every 5 minutes (300000ms)
  useEffect(() => {
    if (!generateSignalNow) return;
    
    const signalInterval = setInterval(() => {
      console.log('⏰ 5-minute interval: Auto-generating signal...');
      generateSignalNow(true); // Silent mode - no loading state
      // Reset timer for next 5-minute cycle
      setNextSignalTime(new Date(Date.now() + 5 * 60 * 1000));
    }, 300000); // 5 minutes
    
    return () => {
      clearInterval(signalInterval);
    };
  }, [generateSignalNow]);

  // Auto-generate initial signal if none exist
  useEffect(() => {
    let mounted = true;

    const autoGenerateSignal = async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (!mounted) return;

      try {
        console.log('[Dashboard] Checking for existing signals...');
        const signalsRes = await fetch('/api/signals?limit=1');
        const signalsData = await signalsRes.json();
        console.log('[Dashboard] Signals check result:', signalsData);

        if (signalsData.success && (!signalsData.data || signalsData.data.length === 0)) {
          console.log('[Dashboard] No signals found, generating first signal immediately...');
          await generateSignalNow(true);
          setTimeout(() => {
            if (mounted) {
              loadStatus();
            }
          }, 5000);
        }
      } catch (error) {
        console.error('[Dashboard] Error checking signals:', error);
      }
    };

    autoGenerateSignal();

    return () => {
      mounted = false;
    };
  }, [generateSignalNow]);

  const filteredChartData = () => {
    if (chartData.length === 0) return [];
    if (timeframe === 'ALL') return chartData;
    
    const now = Date.now();
    let cutoffTime;
    
    switch (timeframe) {
      case '24H':
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7D':
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        return chartData;
    }
    
    return chartData.filter(point => point.timestamp >= cutoffTime);
  };

  const currentAccountValue = status?.accountValue || (chartData.length > 0 ? chartData[chartData.length - 1]?.value : 0);
  const accountChange = chartData.length >= 2 
    ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100 
    : 0;


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Price Ticker */}
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
              {isTestMode && (
                <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                  <span>🧪</span>
                  <span>TEST MODE</span>
                </div>
              )}
              {!isTestMode && (
                <div className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">
                  <span>🔴</span>
                  <span>LIVE MODE</span>
                </div>
              )}
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

      {/* Stock Ticker Bar */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center space-x-6 py-3 overflow-x-auto">
            {Object.entries(priceTicker).map(([symbol, data]) => (
              <div key={symbol} className="flex items-center space-x-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-700">{symbol}:</span>
                <span className="text-sm font-bold text-gray-900">${data.price.toFixed(2)}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${data.change >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                  {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Account Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Account Overview</h2>
              <p className="text-sm text-gray-500">Real-time trading performance and statistics</p>
            </div>
            <button
              onClick={generateSignalNow}
              disabled={generatingSignal || (!isTestMode && !walletAddress)}
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
          
          {!walletAddress && (
            <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FiAlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-900 mb-1">Wallet Not Configured</p>
                  <p className="text-sm text-yellow-800">
                    Please configure your wallet address in{' '}
                    <Link href="/settings" className="underline font-bold hover:text-yellow-900">Settings</Link> to start tracking.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group relative bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-2xl p-6 transition-all hover:shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Total Return</p>
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiTrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <p className={`text-4xl font-black mb-1 ${status.totalReturn >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPercent(status.totalReturn || 0)}
                </p>
                <p className="text-xs text-emerald-600 font-medium">Since inception</p>
              </div>
              
              <div className="group relative bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-2xl p-6 transition-all hover:shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Available Cash</p>
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiDollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-4xl font-black text-blue-700 mb-1">
                  {formatCurrency(status.availableCash || 0)}
                </p>
                <p className="text-xs text-blue-600 font-medium">Ready to trade</p>
              </div>
              
              <div className="group relative bg-gradient-to-br from-purple-50 via-violet-50 to-purple-100 rounded-2xl p-6 transition-all hover:shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-purple-800 uppercase tracking-wide">Account Value</p>
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiPieChart className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-4xl font-black text-purple-700 mb-1">
                  {formatCurrency(status.accountValue || 0)}
                </p>
                {accountChange !== 0 && chartData.length > 0 ? (
                  <p className={`text-xs font-semibold ${accountChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPercent(accountChange)} change
                  </p>
                ) : (
                  <p className="text-xs text-purple-600 font-medium">Total portfolio</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <FiAlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-base font-semibold text-gray-700 mb-1">No Account Data</p>
              <p className="text-sm text-gray-500">Configure your wallet address in Settings to view account information</p>
            </div>
          )}
        </div>

        {signalMessage && (
          <div className={`rounded-xl p-4 mb-6 flex items-center space-x-3 ${
            signalMessage.includes('✅') 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-900' 
              : signalMessage.includes('⚠️')
              ? 'bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-900'
              : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-900'
          }`}>
            {signalMessage.includes('✅') ? (
              <FiCheckCircle className="w-6 h-6 flex-shrink-0" />
            ) : (
              <FiAlertCircle className="w-6 h-6 flex-shrink-0" />
            )}
            <p className="font-semibold text-sm">{signalMessage}</p>
          </div>
        )}

        {/* Main Dashboard - 60/40 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Section - Performance Chart (60%) */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Account Value</h3>
                <p className="text-sm text-gray-500">Performance over time</p>
              </div>
              <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setTimeframe('24H')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    timeframe === '24H' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  24H
                </button>
                <button
                  onClick={() => setTimeframe('7D')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    timeframe === '7D' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setTimeframe('ALL')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    timeframe === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ALL
                </button>
              </div>
            </div>
            
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredChartData()}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#6b7280"
                      style={{ fontSize: '11px' }}
                      tick={{ fill: '#6b7280' }}
                      type="category"
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '11px' }}
                      tick={{ fill: '#6b7280' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      labelStyle={{ color: '#000', fontWeight: 'bold' }}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                <div className="text-center px-6">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                    <FiTrendingUp className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 mb-2">No Chart Data Yet</p>
                  <p className="text-sm text-gray-500 max-w-xs">Generate signals to start tracking your account value over time.</p>
                </div>
              </div>
            )}
            
            {currentAccountValue > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-center">
                  <p className="text-sm text-gray-500 font-medium mb-2">Current Account Value</p>
                  <p className="text-4xl font-black text-gray-900">
                    {formatCurrency(currentAccountValue)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Section - MODEL CHAT (40%) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
            <div className="mb-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center space-x-2 text-gray-900">
                  <span className="text-2xl">⭐</span>
                  <span>MODELCHAT</span>
                </h3>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    <FiClock className="w-3 h-3" />
                    <span>Next signal in:</span>
                    <span className="font-semibold text-blue-600">
                      {timeRemaining.minutes}m {timeRemaining.seconds.toString().padStart(2, '0')}s
                    </span>
                  </div>
                  <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                    DEEPSEEK-CHAT-V3.1
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {signals.length === 0 ? (
                <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                    <FiAlertCircle className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 mb-2">No Signals Yet</p>
                  <p className="text-sm text-gray-500 px-6">Click "Generate Signal" or wait for the automated 5-minute cycle</p>
                </div>
              ) : (
                signals.map((signal) => {
                  const decisions = formatTradingDecision(signal);
                  
                  // Handle both Firestore Timestamp and ISO string
                  let timestamp;
                  if (signal.timestamp?.toDate) {
                    timestamp = signal.timestamp.toDate();
                  } else if (signal.timestampString) {
                    timestamp = new Date(signal.timestampString);
                  } else if (signal.timestamp) {
                    timestamp = new Date(signal.timestamp);
                  } else {
                    // Fallback to current time if no timestamp
                    timestamp = new Date();
                  }
                  
                  // Validate timestamp
                  if (isNaN(timestamp.getTime())) {
                    console.warn('Invalid timestamp for signal:', signal.id, 'using current time');
                    timestamp = new Date();
                  }
                  
                  const timeStr = `${timestamp.getMonth() + 1}/${timestamp.getDate()} ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;
                  
                  return (
                    <div key={signal.id} className="rounded-lg p-4 bg-white hover:shadow-md transition-all mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">AI</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-blue-600">DEEPSEEK-CHAT-V3.1</div>
                            <div className="text-xs text-gray-500">{timeStr}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* USER_PROMPT Section */}
                      <div className="mb-2">
                        <button
                          onClick={() => toggleSection(signal.id, 'user_prompt')}
                          className="w-full flex items-center text-left font-bold text-xs p-2 hover:bg-gray-50 rounded transition-colors text-gray-700 uppercase tracking-wider"
                        >
                          <span className="mr-2">{isSectionExpanded(signal.id, 'user_prompt') ? '▼' : '▶'}</span>
                          <span>USER_PROMPT</span>
                        </button>
                        {isSectionExpanded(signal.id, 'user_prompt') && signal.userPrompt && (
                          <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto custom-scrollbar text-gray-800">
                            {signal.userPrompt}
                          </div>
                        )}
                      </div>

                      {/* CHAIN_OF_THOUGHT Section */}
                      <div className="mb-2">
                        <button
                          onClick={() => toggleSection(signal.id, 'chain_of_thought')}
                          className="w-full flex items-center text-left font-bold text-xs p-2 hover:bg-gray-50 rounded transition-colors text-gray-700 uppercase tracking-wider"
                        >
                          <span className="mr-2">{isSectionExpanded(signal.id, 'chain_of_thought') ? '▼' : '▶'}</span>
                          <span>CHAIN_OF_THOUGHT</span>
                        </button>
                        {isSectionExpanded(signal.id, 'chain_of_thought') && signal.rawResponse && (
                          <div className="mt-2 p-3 bg-blue-50 rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar text-gray-800">
                            {signal.rawResponse}
                          </div>
                        )}
                      </div>

                      {/* TRADING_DECISIONS Section */}
                      <div>
                        <button
                          onClick={() => toggleSection(signal.id, 'trading_decisions')}
                          className="w-full flex items-center text-left font-bold text-xs p-2 hover:bg-gray-50 rounded transition-colors text-gray-700 uppercase tracking-wider"
                        >
                          <span className="mr-2">{isSectionExpanded(signal.id, 'trading_decisions') ? '▼' : '▶'}</span>
                          <span>TRADING_DECISIONS</span>
                        </button>
                        {isSectionExpanded(signal.id, 'trading_decisions') && decisions && decisions.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {decisions.map((decision, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded text-xs">
                                <div className="font-bold mb-2 text-gray-900 text-sm pb-2">
                                  XYZ:{decision.coin}
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">SIGNAL:</span>
                                    <span className={`font-bold ${
                                      decision.side === 'LONG' || decision.signal === 'buy_to_enter' ? 'text-green-600' :
                                      decision.side === 'SHORT' || decision.signal === 'sell_to_enter' ? 'text-red-600' :
                                      'text-gray-700'
                                    }`}>
                                      {decision.signal || decision.side || 'HOLD'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">QUANTITY:</span>
                                    <span className="font-bold text-gray-900">{decision.quantity || 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">LEVERAGE:</span>
                                    <span className="font-bold text-gray-900">{decision.leverage || 'N/A'}x</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">PROFIT TARGET:</span>
                                    <span className="font-bold text-gray-900">{decision.profit_target ? formatCurrency(decision.profit_target) : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">STOP LOSS:</span>
                                    <span className="font-bold text-gray-900">{decision.stop_loss ? formatCurrency(decision.stop_loss) : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">CONFIDENCE:</span>
                                    <span className="font-bold text-gray-900">{decision.confidence !== undefined ? decision.confidence : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">RISK USD:</span>
                                    <span className="font-bold text-gray-900">{decision.risk_usd !== undefined ? formatCurrency(decision.risk_usd) : 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-semibold">IS_ADD:</span>
                                    <span className="font-bold text-gray-900">{decision.add !== undefined ? String(decision.add) : 'false'}</span>
                                  </div>
                                </div>
                                {decision.invalidation_condition && (
                                  <div className="mt-3 pt-2">
                                    <div className="text-gray-600 font-bold mb-1 text-xs">INVALIDATION CONDITION</div>
                                    <div className="p-2 bg-yellow-50 rounded text-gray-800">
                                      {decision.invalidation_condition}
                                    </div>
                                  </div>
                                )}
                                {decision.justification && (
                                  <div className="mt-3 pt-2">
                                    <div className="text-gray-600 font-bold mb-1 text-xs">JUSTIFICATION</div>
                                    <div className="p-2 bg-white rounded text-gray-800">
                                      {decision.justification}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Current Positions Table */}
        {positions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Current Positions</h3>
              <p className="text-sm text-gray-500">Active trades and their performance</p>
            </div>
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Symbol</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Quantity</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Entry Price</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Unrealized PnL</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Leverage</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Notional USD</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {positions.map((pos, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{pos.symbol}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{pos.quantity.toFixed(4)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatCurrency(pos.entryPrice)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(pos.unrealizedPnl)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">{pos.leverage}x</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{formatCurrency(pos.notionalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
