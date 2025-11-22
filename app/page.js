'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiActivity, FiSettings, FiTrendingUp, FiTrash2, FiChevronDown, FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 p-3 rounded-lg shadow-xl">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-white text-lg font-bold font-mono">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
          }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [signals, setSignals] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('ALL');
  const [isTestMode, setIsTestMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadStatus();
    const statusInterval = setInterval(() => {
      loadStatus();
    }, 30000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  const loadStatus = async () => {
    try {
      // Check if test mode is enabled
      const testModeRes = await fetch('/api/test-mode/status');
      const testModeData = await testModeRes.json();

      if (testModeData.success && testModeData.isTestMode) {
        setIsTestMode(true);
        if (testModeData.portfolio) {
          setStatus({
            accountValue: testModeData.portfolio.accountValue,
          });
        }
      } else {
        setIsTestMode(false);
        const settingsRes = await fetch('/api/settings?key=wallet');
        const settingsData = await settingsRes.json();

        if (settingsData.success && settingsData.value) {
          try {
            const posRes = await fetch(`/api/positions?address=${settingsData.value}`);
            const posData = await posRes.json();
            if (posData.success) {
              setStatus(posData.data.account);
            }
          } catch (err) {
            console.error('Error loading positions:', err);
          }
        }
      }

      // Load recent signals
      try {
        const signalsRes = await fetch('/api/signals?limit=50');
        const signalsData = await signalsRes.json();
        if (signalsData.success) {
          setSignals(signalsData.data);

          // Build chart data
          const chartPoints = [];
          signalsData.data.forEach(s => {
            try {
              let timestamp;
              if (s.timestamp?.toDate) timestamp = s.timestamp.toDate();
              else if (s.timestampString) timestamp = new Date(s.timestampString);
              else if (s.timestamp) timestamp = new Date(s.timestamp);
              else return;

              if (isNaN(timestamp.getTime())) return;

              const accountValue = s.tradeExecution?.portfolio?.accountValue || s.accountInfo?.accountValue;
              if (!accountValue || accountValue <= 0) return;

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

          chartPoints.sort((a, b) => a.timestamp - b.timestamp);
          setChartData(chartPoints);
        }
      } catch (err) {
        console.error('Error loading signals:', err);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const filteredChartData = () => {
    if (chartData.length === 0) return [];

    let data = chartData;

    if (timeframe !== 'ALL') {
      const now = Date.now();
      let cutoffTime;

      switch (timeframe) {
        case '24H':
          cutoffTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7D':
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
      }

      if (cutoffTime) {
        data = chartData.filter(point => point.timestamp >= cutoffTime);
      }
    }

    if (data.length === 0) return [];

    // Add padding to center the line (add 50% more time as empty space)
    const lastPoint = data[data.length - 1];
    const firstPoint = data[0];
    const duration = lastPoint.timestamp - firstPoint.timestamp;
    const padding = Math.max(duration * 0.5, 3600000); // Minimum 1 hour padding
    const futureTime = lastPoint.timestamp + padding;

    // Create a future point with null value to break the line
    return [
      ...data,
      { time: '', value: null, timestamp: futureTime }
    ];
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

  const deleteSignal = async (signalId) => {
    if (!confirm('Are you sure you want to delete this signal?')) return;
    try {
      await fetch(`/api/signals/delete?id=${signalId}`, { method: 'DELETE' });
      setSignals(prev => prev.filter(s => s.id !== signalId));
      loadStatus();
    } catch (error) {
      console.error('Error deleting signal:', error);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b h-16 flex-shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full">
          <div className="flex justify-between h-full items-center">
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

      {/* Main Content - Split View */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-[1920px] mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Left Column: Chart (70%) */}
          <div className="lg:col-span-8 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {/* Chart Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Account Performance</h2>
                <p className="text-sm text-gray-500">Net Asset Value over time</p>
              </div>
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                {['24H', '7D', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === tf
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 w-full relative">
              {chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredChartData()} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                      <defs>
                        <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset={(() => {
                            const data = filteredChartData().filter(d => d.value !== null);
                            if (!data.length) return 0;
                            const max = Math.max(...data.map(d => d.value));
                            const min = Math.min(...data.map(d => d.value));
                            const baseline = data[0].value;
                            if (max === min) return 0;
                            return (max - baseline) / (max - min);
                          })()} stopColor="#dcfce7" stopOpacity={0.5} />
                          <stop offset={(() => {
                            const data = filteredChartData().filter(d => d.value !== null);
                            if (!data.length) return 0;
                            const max = Math.max(...data.map(d => d.value));
                            const min = Math.min(...data.map(d => d.value));
                            const baseline = data[0].value;
                            if (max === min) return 0;
                            return (max - baseline) / (max - min);
                          })()} stopColor="#fee2e2" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={true}
                        tick={{ fill: '#000000', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}
                        dy={10}
                        minTickGap={50}
                        tickFormatter={(val) => {
                          // Assuming val is "MM/DD HH:MM"
                          // Convert to "Nov 20 02:07" format if possible, or just keep as is
                          return val;
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#000000', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}
                        tickFormatter={(value) => `$${new Intl.NumberFormat('en-US').format(value)}`}
                        dx={-10}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#000000', strokeWidth: 1, strokeDasharray: '2 2' }} />
                      <ReferenceLine
                        y={filteredChartData()[0]?.value}
                        stroke="#000000"
                        strokeDasharray="3 3"
                        strokeOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#splitColor)"
                        activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#3b82f6' }}
                        dot={(props) => {
                          const { cx, cy, index, payload } = props;
                          // Check if this is the last valid point (has value)
                          // We can check if the next point has no value or if it's the last point in the dataset
                          // But since we pad with nulls, we look for the point where value is not null
                          if (payload.value === null) return <></>;

                          // We need to know if it's the *last* valid point.
                          // We can pass the full data to check
                          const data = filteredChartData();
                          const isLastValid = index === data.findIndex(d => d.value === null) - 1 || (index === data.length - 1 && data[index].value !== null);

                          if (isLastValid) {
                            return (
                              <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24" className="overflow-visible">
                                <circle cx="12" cy="12" r="12" fill="#3b82f6" stroke="white" strokeWidth="2" />
                                <image href="/deepseek_logo.png" x="4" y="4" height="16" width="16" />
                              </svg>
                            );
                          }
                          return <></>;
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div className="absolute bottom-2 left-4 flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded">
                    <div className="w-3 h-3 bg-[#3b82f6] border border-black"></div>
                    <span className="text-xs font-bold font-mono text-black">
                      deepseek-chat-v3.1 ${(() => {
                        const data = filteredChartData().filter(d => d.value !== null);
                        return data.length > 0 ? data[data.length - 1].value.toFixed(2) : '0.00';
                      })()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <FiTrendingUp className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">No Chart Data</p>
                  <p className="text-xs text-gray-500 mt-1">Generate signals in Settings to see data</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Model Chat (30%) */}
          <div className="lg:col-span-4 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>MODEL CHAT</span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {signals.length === 0 ? (
                <div className="text-center py-12">
                  <FiAlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No signals yet</p>
                </div>
              ) : (
                signals.map((signal) => {
                  const decisions = formatTradingDecision(signal);
                  let timestamp;
                  if (signal.timestamp?.toDate) timestamp = signal.timestamp.toDate();
                  else if (signal.timestampString) timestamp = new Date(signal.timestampString);
                  else timestamp = new Date();

                  const dateStr = `${timestamp.getMonth() + 1}/${timestamp.getDate()}`;
                  const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;

                  return (
                    <div key={signal.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">DS</span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-blue-600">_____DEEPSEEK-CHAT-V3.1</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{dateStr} {timeStr}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteSignal(signal.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                      </div>



                      {/* Expandable Sections */}
                      <div className="space-y-2 pl-7">
                        {/* USER_PROMPT */}
                        <div>
                          <button
                            onClick={() => toggleSection(signal.id, 'user_prompt')}
                            className="flex items-center space-x-2 text-[10px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
                          >
                            <span className="text-[8px]">{isSectionExpanded(signal.id, 'user_prompt') ? '▼' : '▶'}</span>
                            <span>USER_PROMPT</span>
                          </button>
                          {isSectionExpanded(signal.id, 'user_prompt') && (
                            <div className="mt-2 pl-3 border-l-2 border-gray-100 text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
                              {signal.userPrompt}
                            </div>
                          )}
                        </div>

                        {/* CHAIN_OF_THOUGHT */}
                        <div>
                          <button
                            onClick={() => toggleSection(signal.id, 'chain_of_thought')}
                            className="flex items-center space-x-2 text-[10px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
                          >
                            <span className="text-[8px]">{isSectionExpanded(signal.id, 'chain_of_thought') ? '▼' : '▶'}</span>
                            <span>CHAIN_OF_THOUGHT</span>
                          </button>
                          {isSectionExpanded(signal.id, 'chain_of_thought') && (
                            <div className="mt-2 pl-3 border-l-2 border-blue-100 text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
                              {signal.reasoningContent || signal.rawResponse}
                            </div>
                          )}
                        </div>

                        {/* TRADING_DECISIONS */}
                        <div>
                          <button
                            onClick={() => toggleSection(signal.id, 'trading_decisions')}
                            className="flex items-center space-x-2 text-[10px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
                          >
                            <span className="text-[8px]">{isSectionExpanded(signal.id, 'trading_decisions') ? '▼' : '▶'}</span>
                            <span>TRADING_DECISIONS</span>
                          </button>
                          {isSectionExpanded(signal.id, 'trading_decisions') && decisions && (
                            <div className="mt-2 space-y-4 pl-3 border-l-2 border-gray-100">
                              {decisions.map((d, idx) => (
                                <div key={idx} className="space-y-2 font-mono text-[10px]">
                                  <div className="font-bold text-gray-900">XYZ:{d.coin}</div>

                                  {d.invalidation_condition && (
                                    <div>
                                      <div className="text-gray-400 uppercase">INVALIDATION CONDITION</div>
                                      <div className="text-gray-700">{d.invalidation_condition}</div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="text-gray-400 uppercase">RISK USD</div>
                                    <div className="text-gray-700">{d.risk_usd || 0}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">CONFIDENCE</div>
                                    <div className="text-gray-700">{d.confidence || 'N/A'}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">IS ADD</div>
                                    <div className="text-gray-700">{String(d.add || false)}</div>
                                  </div>

                                  {(d.justification || d.rationale) && (
                                    <div>
                                      <div className="text-gray-400 uppercase">JUSTIFICATION</div>
                                      <div className="text-gray-700">{d.justification || d.rationale}</div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="text-gray-400 uppercase">PROFIT TARGET</div>
                                    <div className="text-gray-700">{d.profit_target}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">COIN</div>
                                    <div className="text-gray-700">xyz:{d.coin}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">LEVERAGE</div>
                                    <div className="text-gray-700">{d.leverage}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">SIGNAL</div>
                                    <div className="text-gray-700">{d.signal || d.side}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">QUANTITY</div>
                                    <div className="text-gray-700">{d.quantity}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-400 uppercase">STOP LOSS</div>
                                    <div className="text-gray-700">{d.stop_loss}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

