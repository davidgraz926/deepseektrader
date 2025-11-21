'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiActivity, FiSettings, FiMessageSquare, FiRefreshCw, FiTrendingUp, FiDollarSign, FiPieChart, FiChevronDown, FiChevronRight, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function StatusPage() {
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
  const [priceTicker, setPriceTicker] = useState({});
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [nextSignalTime, setNextSignalTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 5, seconds: 0 });

  const generateSignalNow = useCallback(async (silent = false) => {
    if (!silent) {
      setGeneratingSignal(true);
      setSignalMessage('');
    }
    
    // Reset timer when generating signal (manually or automatically)
    setNextSignalTime(new Date(Date.now() + 5 * 60 * 1000));
    
    try {
      // Use TEST_MODE if test mode is enabled, otherwise use wallet address
      const wallet = isTestMode ? 'TEST_MODE' : (walletAddress || 'TEST_MODE');
      console.log('🚀 Generating signal (client-side) with wallet:', wallet, 'testMode:', isTestMode);
      
      // Step 1: Prepare data (fast)
      console.log('📊 Step 1: Preparing signal data...');
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
      console.log('✅ Data prepared, calling DeepSeek API...');
      
      // Step 2: Call DeepSeek API from client (with progress updates)
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
      console.log('✅ DeepSeek response received, parsing JSON...');
      
      // Step 3: Parse JSON from response (use same logic as test endpoint)
      const textToParse = aiResponse;
      let jsonData;
      let parseSource = 'unknown';
      
      if (!textToParse) {
        throw new Error('Response is empty');
      }
      
      // Try multiple extraction methods (same as test endpoint)
      try {
        // Method 1: Direct JSON parse (THIS WORKS - tested!)
        jsonData = JSON.parse(textToParse);
        parseSource = 'direct';
        console.log('✅ JSON parsed successfully (direct parse)');
      } catch (e1) {
        try {
          // Method 2: Extract from markdown code blocks
          const jsonMatch = textToParse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            jsonData = JSON.parse(jsonMatch[1]);
            parseSource = 'markdown';
            console.log('✅ JSON parsed successfully (from markdown)');
          }
        } catch (e2) {
          // Continue
        }
        
        if (!jsonData) {
          try {
            // Method 3: Find ALL JSON-like objects and try each
            const jsonPattern = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
            const allMatches = textToParse.match(jsonPattern);
            if (allMatches && allMatches.length > 0) {
              console.log(`Found ${allMatches.length} potential JSON objects, trying from last...`);
              // Try from last match backwards
              for (let i = allMatches.length - 1; i >= 0; i--) {
                try {
                  const parsed = JSON.parse(allMatches[i]);
                  // Verify it's a trading signal object
                  const keys = Object.keys(parsed);
                  if (keys.length > 0 && keys.some(k => ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'].includes(k))) {
                    jsonData = parsed;
                    parseSource = `json-object-${i}`;
                    console.log(`✅ JSON parsed successfully (object match #${i})`);
                    break;
                  }
                } catch (parseErr) {
                  // Try next match
                }
              }
            }
          } catch (e3) {
            // Continue
          }
        }
        
        if (!jsonData) {
          // Method 4: Extract from last 2000 chars with brace matching
          const lastPart = textToParse.substring(Math.max(0, textToParse.length - 2000));
          const jsonStart = lastPart.indexOf('{');
          if (jsonStart !== -1) {
            const potentialJson = lastPart.substring(jsonStart);
            let braceCount = 0;
            let jsonEnd = -1;
            for (let i = 0; i < potentialJson.length; i++) {
              if (potentialJson[i] === '{') braceCount++;
              if (potentialJson[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
            if (jsonEnd > 0) {
              try {
                const extracted = potentialJson.substring(0, jsonEnd);
                jsonData = JSON.parse(extracted);
                parseSource = 'end-extraction';
                console.log('✅ JSON parsed successfully (end extraction)');
              } catch (e4) {
                // Continue
              }
            }
          }
        }
        
        if (!jsonData) {
          // Method 5: Extract between first { and last } with proper brace matching
          const firstBrace = textToParse.indexOf('{');
          const lastBrace = textToParse.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            try {
              const extracted = textToParse.substring(firstBrace, lastBrace + 1);
              jsonData = JSON.parse(extracted);
              parseSource = 'brace-extraction';
              console.log('✅ JSON parsed successfully (brace extraction)');
            } catch (e5) {
              // Final attempt failed
            }
          }
        }
      }
      
      if (!jsonData) {
        console.error('❌ Failed to parse JSON from response');
        console.error('Response:', textToParse.substring(0, 500));
        throw new Error('Could not extract valid JSON from response');
      }
      
      console.log(`✅ JSON extracted from: ${parseSource}`);
      
      console.log('✅ JSON parsed, saving signal...');
      
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
      console.log('📡 Save signal response:', saveData);
      
      if (saveData.success) {
        if (!silent) {
          setSignalMessage('✅ Signal generated successfully!');
        }
        console.log('✅ Signal generated and saved successfully, reloading status...');
        // Reload status after a short delay to show the new signal
        setTimeout(() => {
          loadStatus();
        }, 2000);
      } else {
        console.error('❌ Signal save failed:', saveData.error);
        if (!silent) {
          setSignalMessage(`❌ Error saving: ${saveData.error}`);
          setTimeout(() => setSignalMessage(''), 5000);
        }
      }
    } catch (error) {
      console.error('❌ Error generating signal:', error);
      if (!silent) {
        setSignalMessage(`❌ Error: ${error.message}`);
        setTimeout(() => setSignalMessage(''), 5000);
      }
    } finally {
      if (!silent) {
        setGeneratingSignal(false);
      }
    }
  }, [isTestMode, walletAddress]);

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
    
    // Auto-generate signal every 5 minutes (300000ms)
    const signalInterval = setInterval(() => {
      console.log('⏰ 5-minute interval: Auto-generating signal...');
      generateSignalNow(true); // Silent mode - no loading state
      // Reset timer for next 5-minute cycle
      setNextSignalTime(new Date(Date.now() + 5 * 60 * 1000));
    }, 300000); // 5 minutes
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(signalInterval);
    };
  }, [generateSignalNow]);
  
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

  // Auto-generate signal on first load if no signals exist
  useEffect(() => {
    let mounted = true;
    
    const autoGenerateSignal = async () => {
      // Wait for initial status load to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (!mounted) return;
      
      try {
        console.log('🔍 Checking for existing signals...');
        const signalsRes = await fetch('/api/signals?limit=1');
        const signalsData = await signalsRes.json();
        console.log('📊 Signals check result:', signalsData);
        
        if (signalsData.success && (!signalsData.data || signalsData.data.length === 0)) {
          // No signals exist, generate one immediately
          console.log('🚀 No signals found, generating initial signal...');
          await generateSignalNow(true); // Silent mode - no loading state
          
          // Wait a bit then reload to show the new signal
          setTimeout(() => {
            if (mounted) {
              console.log('🔄 Reloading status after signal generation...');
              loadStatus();
            }
          }, 5000);
        } else {
          console.log(`✅ Found ${signalsData.data?.length || 0} existing signals`);
        }
      } catch (error) {
        console.error('❌ Error checking for signals:', error);
      }
    };
    
    autoGenerateSignal();
    
    return () => {
      mounted = false;
    };
  }, [generateSignalNow]); // Include generateSignalNow in dependencies

  const loadPriceTicker = async () => {
    try {
      const marketRes = await fetch('/api/market-data');
      const marketDataRes = await marketRes.json();
      
      if (marketDataRes.success && marketDataRes.data.binance) {
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
    setLoading(true);
    try {
      const testModeRes = await fetch('/api/test-mode/status');
      const testModeData = await testModeRes.json();
      
      if (testModeData.success && testModeData.isTestMode) {
        setIsTestMode(true);
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
        const settingsRes = await fetch('/api/settings?key=wallet');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.value) {
          setWalletAddress(settingsData.value);
          const posRes = await fetch(`/api/positions?address=${settingsData.value}`);
          const posData = await posRes.json();
          if (posData.success) {
            setPositions(posData.data.positions || []);
            setStatus(posData.data.account);
          }
        }
      }

      const marketRes = await fetch('/api/market-data');
      const marketDataRes = await marketRes.json();
      if (marketDataRes.success) {
        setMarketData(marketDataRes.data);
      }

      const signalsRes = await fetch('/api/signals?limit=50');
      const signalsData = await signalsRes.json();
      console.log('📡 Signals API response:', signalsData);
      
      if (signalsData.success && signalsData.data) {
        // Filter out signals without rawResponse or signal data
        const validSignals = signalsData.data.filter(s => {
          const hasData = s && (s.rawResponse || s.signal);
          if (!hasData) {
            console.log('⚠️ Filtered out signal (no rawResponse or signal):', s.id);
          }
          return hasData;
        });
        console.log('✅ Loaded signals:', validSignals.length, 'out of', signalsData.data.length);
        
        if (validSignals.length > 0) {
          console.log('📊 First signal sample:', {
            id: validSignals[0].id,
            hasRawResponse: !!validSignals[0].rawResponse,
            hasSignal: !!validSignals[0].signal,
            timestamp: validSignals[0].timestamp || validSignals[0].timestampString,
          });
        }
        
        setSignals(validSignals);
        
        // Build chart data from signals - use accountInfo.accountValue or tradeExecution.portfolio.accountValue
        const chartPoints = [];
        
        validSignals.forEach(s => {
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
        if (validSignals.length > 0 && !selectedSignal) {
          setSelectedSignal(validSignals[0]);
          console.log('🎯 Set selected signal:', validSignals[0].id);
        }
      } else {
        console.log('❌ No signals found or API error:', signalsData);
        setSignals([]);
        
        // Auto-generate first signal if none exist
        if (signalsData.success && (!signalsData.data || signalsData.data.length === 0) && !autoGenerating) {
          console.log('🚀 No signals found in loadStatus, triggering auto-generation...');
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
              console.error('Error in auto-generation:', error);
              setAutoGenerating(false);
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (typeof value === 'number') {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    return '+0.00%';
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

  const formatTradingDecision = (signal) => {
    if (!signal.signal) return [];
    
    const decisions = [];
    const signalData = signal.signal;
    
    Object.keys(signalData).forEach(coin => {
      const decision = signalData[coin];
      if (decision && decision.trade_signal_args) {
        decisions.push({
          coin,
          ...decision.trade_signal_args,
        });
      }
    });
    
    return decisions;
  };

  const extractMainMessage = (rawResponse) => {
    if (!rawResponse || typeof rawResponse !== 'string') return 'No reasoning available';
    
    // Try to find the main trading decision summary (usually first paragraph)
    // Look for sentences that describe trading actions
    const lines = rawResponse.split('\n').filter(line => line.trim());
    
    // Find the first meaningful paragraph (usually contains trading actions)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip headers and empty lines
      if (line && !line.match(/^(USER_PROMPT|CHAIN_OF_THOUGHT|TRADING_DECISIONS|CURRENT STATE|NARRATIVE|ALPHA|THE "PAIN|▶|XYZ:|First,|I need|Looking at|From the)/i)) {
        // Check if it contains trading keywords and is a complete sentence
        if (line.match(/(holding|shorting|closing|entering|initiating|long|short|position|betting|targeting|I'm|I am)/i) && line.length > 30) {
          // Return the sentence, but limit length
          return line.length > 400 ? line.substring(0, 400) + '...' : line;
        }
      }
    }
    
    // Fallback: return first non-empty line that's not a header and is substantial
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && line.length > 50 && !line.match(/^(USER_PROMPT|CHAIN_OF_THOUGHT|TRADING_DECISIONS|▶|XYZ:|First,|I need|Looking at|From the|CURRENT|NARRATIVE)/i)) {
        return line.length > 400 ? line.substring(0, 400) + '...' : line;
      }
    }
    
    // Last resort: return first 300 chars before JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const beforeJson = rawResponse.substring(0, rawResponse.indexOf(jsonMatch[0])).trim();
      if (beforeJson.length > 0) {
        return beforeJson.length > 400 ? beforeJson.substring(0, 400) + '...' : beforeJson;
      }
    }
    
    // Final fallback: return first 300 chars
    return rawResponse.length > 400 ? rawResponse.substring(0, 400) + '...' : rawResponse;
  };

  const extractChainOfThought = (rawResponse) => {
    if (!rawResponse) return '';
    
    // Try to extract chain of thought section (look for CHAIN_OF_THOUGHT header)
    const chainMatch = rawResponse.match(/CHAIN_OF_THOUGHT[\s\S]*?(?=TRADING_DECISIONS|$)/i);
    if (chainMatch) {
      let chainText = chainMatch[0].replace(/CHAIN_OF_THOUGHT/i, '').trim();
      // Remove markdown code blocks if present
      chainText = chainText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      return chainText;
    }
    
    // Try to find JSON block and return everything before it
    const jsonMatch = rawResponse.match(/```(?:json)?\s*\{[\s\S]*?\}\s*```/);
    if (jsonMatch) {
      return rawResponse.substring(0, rawResponse.indexOf(jsonMatch[0])).trim();
    }
    
    // Try to find plain JSON object
    const plainJsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (plainJsonMatch) {
      const beforeJson = rawResponse.substring(0, rawResponse.indexOf(plainJsonMatch[0])).trim();
      if (beforeJson.length > 50) {
        return beforeJson;
      }
    }
    
    // Return full response if no JSON found
    return rawResponse;
  };

  const extractUserPrompt = (signal) => {
    return signal.userPrompt || signal.marketData || 'No user prompt available';
  };

  const extractTradingDecisions = (signal) => {
    if (!signal.signal) return [];
    
    const decisions = [];
    const signalData = signal.signal;
    
    Object.keys(signalData).forEach(coin => {
      const decision = signalData[coin];
      if (decision && typeof decision === 'object') {
        // Handle both nested trade_signal_args and flat structure
        const decisionData = decision.trade_signal_args || decision;
        
        // Map coin names to display format (remove xyz: prefix if present)
        const displayCoin = coin.replace(/^xyz:/i, '').toUpperCase();
        
        const side = decisionData.side || decisionData.signal || 'HOLD';
        const notional = decisionData.notional || 0;
        const leverage = decisionData.leverage || 0;
        const profitTarget = decisionData.profit_target || decisionData.profitTarget || null;
        const stopLoss = decisionData.stop_loss || decisionData.stopLoss || null;
        
        // Calculate quantity from notional and entry price (if available)
        // For display purposes, we'll calculate based on notional and a reference price
        let quantity = null;
        if (notional > 0 && side !== 'HOLD') {
          // Try to get current price from market data or use a reasonable estimate
          // Quantity = notional / entry_price, but we don't have entry price here
          // So we'll show notional instead, or calculate if we have profit target
          if (profitTarget && profitTarget > 0) {
            // Estimate quantity based on notional and target price
            quantity = (notional / profitTarget).toFixed(4);
          } else {
            // Just show notional value
            quantity = null; // Will show notional instead
          }
        }
        
        decisions.push({
          coin: displayCoin,
          signal: side,
          quantity: decisionData.quantity || quantity,
          notional: notional > 0 ? notional : null,
          leverage: leverage > 0 ? leverage : null,
          profit_target: profitTarget,
          stop_loss: stopLoss,
          confidence: decisionData.confidence !== undefined && decisionData.confidence !== null ? decisionData.confidence : null,
          risk_usd: decisionData.risk_usd || decisionData.riskUsd || null,
          is_add: decisionData.is_add || decisionData.isAdd || false,
          invalidation_condition: decisionData.invalidation_condition || decisionData.invalidationCondition || null,
          justification: decisionData.rationale || decisionData.justification || null,
        });
      }
    });
    
    return decisions;
  };

  const currentAccountValue = status?.accountValue || (chartData.length > 0 ? chartData[chartData.length - 1]?.value : 0);
  const initialValue = chartData.length > 0 ? chartData[0]?.value : (status?.accountValue || 1000);
  const accountChange = initialValue > 0 
    ? ((currentAccountValue - initialValue) / initialValue) * 100 
    : 0;
  
  // Calculate total return percentage from initial balance
  const totalReturnPercent = status?.accountValue && status?.totalReturn !== undefined
    ? (status.totalReturn / (status.accountValue - status.totalReturn)) * 100
    : accountChange;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="bg-white border-b sticky top-0 z-50">
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
                href="/"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium transition-all"
              >
                <FiMessageSquare className="w-4 h-4" />
                <span>Chat</span>
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
        {/* Portfolio Summary */}
        {status && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Return</div>
                <div className={`text-2xl font-bold ${totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(totalReturnPercent)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Since inception</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Available Cash</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(status.availableCash || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Ready to trade</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Account Value</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(status.accountValue || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total portfolio</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Layout - Chart Left, Chat Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Section - Chart (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Value Chart */}
            <div className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {isTestMode ? 'TEST MODE' : ''} TOTAL ACCOUNT VALUE
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setTimeframe('24H')}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      timeframe === '24H' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    24H
                  </button>
                  <button
                    onClick={() => setTimeframe('7D')}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      timeframe === '7D' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setTimeframe('ALL')}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      timeframe === 'ALL' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    ALL
                  </button>
                </div>
              </div>
              
              {chartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredChartData().filter(p => p && p.time && !p.time.includes('Invalid') && !p.time.includes('NaN'))}>
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
                        type="category"
                      />
                      <YAxis 
                        stroke="#6b7280"
                        style={{ fontSize: '11px' }}
                        tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        labelStyle={{ color: '#000' }}
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
                <div className="h-80 flex flex-col items-center justify-center text-gray-400">
                  <FiTrendingUp className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm">No Chart Data Yet</p>
                  <p className="text-xs mt-1">Generate signals to start tracking your account value over time.</p>
                </div>
              )}
              
              {currentAccountValue > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(currentAccountValue)}
                  </p>
                  {accountChange !== 0 && (
                    <p className={`text-sm mt-1 ${accountChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(accountChange)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Positions Table */}
            {positions.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">POSITIONS</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Symbol</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entry Price</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unrealized PnL</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Leverage</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Notional USD</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {positions.map((pos, idx) => {
                        // Calculate current price from market data
                        const symbol = pos.symbol?.replace(/^xyz:/i, '') || pos.symbol;
                        const currentPrice = marketData?.binance?.[symbol]?.price || pos.currentPrice || pos.entryPrice || 0;
                        
                        // Calculate unrealized PnL
                        let unrealizedPnL = pos.unrealizedPnL;
                        if (unrealizedPnL === undefined || unrealizedPnL === null) {
                          if (pos.side === 'LONG' || (pos.quantity && pos.quantity > 0)) {
                            unrealizedPnL = (currentPrice - (pos.entryPrice || 0)) * (pos.quantity || 0);
                          } else if (pos.side === 'SHORT' || (pos.quantity && pos.quantity < 0)) {
                            unrealizedPnL = ((pos.entryPrice || 0) - currentPrice) * Math.abs(pos.quantity || 0);
                          } else {
                            unrealizedPnL = 0;
                          }
                        }
                        
                        // Calculate notional USD
                        let notionalUSD = pos.notional;
                        if (!notionalUSD && pos.quantity && pos.entryPrice) {
                          notionalUSD = Math.abs(pos.quantity) * pos.entryPrice;
                        } else if (!notionalUSD && currentPrice && pos.quantity) {
                          notionalUSD = Math.abs(pos.quantity) * currentPrice;
                        }
                        
                        const side = pos.side || (pos.quantity >= 0 ? 'LONG' : 'SHORT');
                        const quantity = pos.quantity || 0;
                        
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{symbol}</td>
                            <td className={`px-4 py-3 text-sm font-medium ${side === 'LONG' || quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {side === 'LONG' || quantity >= 0 ? 'LONG' : 'SHORT'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(pos.entryPrice || 0)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(currentPrice)}</td>
                            <td className={`px-4 py-3 text-sm font-medium ${unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(unrealizedPnL)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{pos.leverage || 1}x</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(notionalUSD || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Section - MODEL CHAT (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-white border rounded-lg p-6 sticky top-20">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">MODELCHAT</h3>
                  <div className="flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    <FiClock className="w-3 h-3" />
                    <span>Next signal in:</span>
                    <span className="font-semibold text-blue-600">
                      {timeRemaining.minutes}m {timeRemaining.seconds.toString().padStart(2, '0')}s
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
                    <Image 
                      src="/deepseek_logo.png" 
                      alt="DeepSeek" 
                      width={24} 
                      height={24}
                      className="object-contain"
                    />
                  </div>
                  <select 
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white"
                    value="DEEPSEEK-CHAT-V3.1"
                  >
                    <option>DEEPSEEK-CHAT-V3.1</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {!signals || signals.length === 0 ? (
                  <div className="text-center py-16">
                    <FiAlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="font-medium mb-2 text-gray-900">No Signals Yet</p>
                    <p className="text-sm text-gray-600">Click 'Generate Signal' or wait for the automated 5-minute cycle</p>
                    <button
                      onClick={generateSignalNow}
                      disabled={generatingSignal}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {generatingSignal ? 'Generating...' : 'Generate Signal Now'}
                    </button>
                  </div>
                ) : (
                  signals.map((signal) => {
                    if (!signal || (!signal.timestamp && !signal.timestampString)) return null;
                    
                    try {
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
                      const chainOfThought = extractChainOfThought(signal.rawResponse || '');
                      const userPrompt = extractUserPrompt(signal);
                      const tradingDecisions = extractTradingDecisions(signal);
                      let mainMessage = extractMainMessage(signal.rawResponse || '');
                      
                      // If no main message, try to get from signal data or use fallback
                      if (!mainMessage || mainMessage === 'No reasoning available') {
                        if (signal.signal) {
                          mainMessage = 'Trading signal generated - click to expand for details';
                        } else {
                          mainMessage = 'Signal generated - no reasoning available';
                        }
                      }
                      
                      return (
                      <div 
                        key={signal.id} 
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedSignal?.id === signal.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedSignal(signal)}
                      >
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                            <Image 
                              src="/deepseek_logo.png" 
                              alt="DeepSeek" 
                              width={24} 
                              height={24}
                              className="object-contain"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-semibold text-blue-600">DEEPSEEK-CHAT-V3.1</span>
                              <span className="text-xs text-gray-500">{timeStr}</span>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                              <p className="text-sm text-gray-800 leading-relaxed">
                                {mainMessage}
                              </p>
                            </div>
                            <div className="text-right">
                              <button 
                                className="text-xs text-blue-600 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSection(signal.id, 'expand');
                                }}
                              >
                                {isSectionExpanded(signal.id, 'expand') ? 'click to collapse' : 'click to expand'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isSectionExpanded(signal.id, 'expand') && (
                          <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                            {/* USER_PROMPT */}
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSection(signal.id, 'user_prompt');
                                }}
                                className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-2 hover:text-gray-900"
                              >
                                <span>▶ USER_PROMPT</span>
                                {isSectionExpanded(signal.id, 'user_prompt') ? (
                                  <FiChevronDown className="w-4 h-4" />
                                ) : (
                                  <FiChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              {isSectionExpanded(signal.id, 'user_prompt') && (
                                <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto text-gray-800">
                                  {userPrompt}
                                </div>
                              )}
                            </div>

                            {/* CHAIN_OF_THOUGHT */}
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSection(signal.id, 'chain_of_thought');
                                }}
                                className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-2 hover:text-gray-900"
                              >
                                <span>▶ CHAIN_OF_THOUGHT</span>
                                {isSectionExpanded(signal.id, 'chain_of_thought') ? (
                                  <FiChevronDown className="w-4 h-4" />
                                ) : (
                                  <FiChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              {isSectionExpanded(signal.id, 'chain_of_thought') && (
                                <div className="mt-2 p-3 bg-blue-50 rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto text-gray-800 leading-relaxed">
                                  {chainOfThought}
                                </div>
                              )}
                            </div>

                            {/* TRADING_DECISIONS */}
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSection(signal.id, 'trading_decisions');
                                }}
                                className="w-full flex items-center justify-between text-left text-xs font-semibold text-gray-700 py-2 hover:text-gray-900"
                              >
                                <span>▶ TRADING_DECISIONS</span>
                                {isSectionExpanded(signal.id, 'trading_decisions') ? (
                                  <FiChevronDown className="w-4 h-4" />
                                ) : (
                                  <FiChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              {isSectionExpanded(signal.id, 'trading_decisions') && tradingDecisions.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {tradingDecisions.map((decision, idx) => {
                                    // Format values properly
                                    const formatValue = (value) => {
                                      if (value === null || value === undefined || value === '') return null;
                                      if (typeof value === 'number') {
                                        if (value === 0) return '0';
                                        if (Math.abs(value) < 0.01) return value.toFixed(6);
                                        if (Math.abs(value) < 1) return value.toFixed(4);
                                        if (Math.abs(value) < 1000) return value.toFixed(2);
                                        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
                                      }
                                      return String(value);
                                    };
                                    
                                    const formatCurrency = (value) => {
                                      if (value === null || value === undefined || value === '') return null;
                                      if (typeof value === 'number') {
                                        return new Intl.NumberFormat('en-US', {
                                          style: 'currency',
                                          currency: 'USD',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }).format(value);
                                      }
                                      return String(value);
                                    };
                                    
                                    // Calculate quantity from notional if not provided
                                    let displayQuantity = decision.quantity;
                                    if (!displayQuantity && decision.notional && decision.profit_target) {
                                      // Estimate quantity: notional / entry_price (use profit_target as proxy)
                                      displayQuantity = (decision.notional / decision.profit_target).toFixed(4);
                                    }
                                    
                                    return (
                                      <div key={idx} className="p-3 bg-gray-50 rounded text-xs border border-gray-200">
                                        <div className="font-semibold mb-2 text-gray-900">XYZ:{decision.coin}</div>
                                        <div className="space-y-1">
                                          <div>
                                            <span className="text-gray-600">SIGNAL:</span>{' '}
                                            <span className={`font-medium ${
                                              decision.signal === 'LONG' ? 'text-green-600' : 
                                              decision.signal === 'SHORT' ? 'text-red-600' : 
                                              'text-gray-900'
                                            }`}>
                                              {decision.signal || 'HOLD'}
                                            </span>
                                          </div>
                                          {displayQuantity !== null && displayQuantity !== undefined && (
                                            <div>
                                              <span className="text-gray-600">QUANTITY:</span>{' '}
                                              <span className="font-medium text-gray-900">{formatValue(displayQuantity)}</span>
                                            </div>
                                          )}
                                          {decision.notional !== null && decision.notional !== undefined && decision.notional > 0 && (
                                            <div>
                                              <span className="text-gray-600">NOTIONAL:</span>{' '}
                                              <span className="font-medium text-gray-900">{formatCurrency(decision.notional)}</span>
                                            </div>
                                          )}
                                          {decision.leverage !== null && decision.leverage !== undefined && decision.leverage > 0 && (
                                            <div>
                                              <span className="text-gray-600">LEVERAGE:</span>{' '}
                                              <span className="font-medium text-gray-900">{formatValue(decision.leverage)}x</span>
                                            </div>
                                          )}
                                          {decision.profit_target !== null && decision.profit_target !== undefined && (
                                            <div>
                                              <span className="text-gray-600">PROFIT TARGET:</span>{' '}
                                              <span className="font-medium text-green-600">{formatCurrency(decision.profit_target)}</span>
                                            </div>
                                          )}
                                          {decision.stop_loss !== null && decision.stop_loss !== undefined && (
                                            <div>
                                              <span className="text-gray-600">STOP LOSS:</span>{' '}
                                              <span className="font-medium text-red-600">{formatCurrency(decision.stop_loss)}</span>
                                            </div>
                                          )}
                                          {decision.confidence !== null && decision.confidence !== undefined && (
                                            <div>
                                              <span className="text-gray-600">CONFIDENCE:</span>{' '}
                                              <span className="font-medium text-gray-900">
                                                {typeof decision.confidence === 'number' ? (decision.confidence * 100).toFixed(1) + '%' : formatValue(decision.confidence)}
                                              </span>
                                            </div>
                                          )}
                                          {decision.risk_usd !== null && decision.risk_usd !== undefined && decision.risk_usd > 0 && (
                                            <div>
                                              <span className="text-gray-600">RISK USD:</span>{' '}
                                              <span className="font-medium text-gray-900">{formatCurrency(decision.risk_usd)}</span>
                                            </div>
                                          )}
                                          {decision.is_add !== undefined && decision.is_add && (
                                            <div>
                                              <span className="text-gray-600">IS_ADD:</span>{' '}
                                              <span className="font-medium text-gray-900">true</span>
                                            </div>
                                          )}
                                          {decision.invalidation_condition && (
                                            <div className="mt-2">
                                              <div className="text-gray-600 mb-1 font-semibold">INVALIDATION CONDITION</div>
                                              <div className="p-2 bg-yellow-50 rounded border border-yellow-200 text-gray-800">
                                                {decision.invalidation_condition}
                                              </div>
                                            </div>
                                          )}
                                          {(decision.justification || decision.rationale) && (
                                            <div className="mt-2">
                                              <div className="text-gray-600 mb-1 font-semibold">JUSTIFICATION:</div>
                                              <div className="p-2 bg-gray-100 rounded text-gray-800">
                                                {decision.justification || decision.rationale}
                                              </div>
                                            </div>
                                          )}
                                          {decision.exit_plan && decision.exit_plan !== 'N/A' && (
                                            <div className="mt-2">
                                              <div className="text-gray-600 mb-1 font-semibold">EXIT PLAN:</div>
                                              <div className="p-2 bg-blue-50 rounded text-gray-800">
                                                {decision.exit_plan}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    } catch (error) {
                      console.error('Error rendering signal:', error, signal);
                      return null;
                    }
                  }).filter(Boolean)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
