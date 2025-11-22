'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiActivity, FiSettings, FiTrendingUp, FiTrendingDown, FiBarChart2, FiRefreshCw, FiAward, FiTarget, FiDollarSign } from 'react-icons/fi';

export default function Leaderboard() {
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    biggestWin: 0,
    biggestLoss: 0,
  });

  useEffect(() => {
    loadLeaderboardData();
    const interval = setInterval(loadLeaderboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);

      // Load trades for stats calculation
      const tradesRes = await fetch('/api/trades?limit=1000');
      const tradesData = await tradesRes.json();

      // Load signals for the table
      const signalsRes = await fetch('/api/signals?limit=100');
      const signalsData = await signalsRes.json();

      if (signalsData.success && signalsData.data) {
        setSignals(signalsData.data);
      }

      if (tradesData.success && tradesData.data) {
        calculateStats(tradesData.data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tradesData) => {
    // Filter only CLOSE trades (which have PnL)
    const closedTrades = tradesData.filter(t => t.type === 'CLOSE' && t.pnl !== undefined);

    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let wins = [];
    let losses = [];

    closedTrades.forEach(trade => {
      const pnl = trade.pnl || 0;
      totalPnL += pnl;

      if (pnl > 0) {
        winningTrades++;
        wins.push(pnl);
      } else if (pnl < 0) {
        losingTrades++;
        losses.push(pnl);
      }
    });

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const biggestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const biggestLoss = losses.length > 0 ? Math.min(...losses) : 0;

    setStats({
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      biggestWin,
      biggestLoss,
    });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                href="/"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium transition-all"
              >
                <FiActivity className="w-4 h-4" />
                <span>Dashboard</span>
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
              <FiAward className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-black text-gray-900">Leaderboard</h2>
          </div>
          <p className="text-gray-500 ml-13">Performance rankings and trading statistics</p>
        </div>

        {/* Performance Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total PnL */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total P&L</p>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                <FiDollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className={`text-3xl font-black ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(stats.totalPnL)}
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">All-time earnings</p>
          </div>

          {/* Win Rate */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Win Rate</p>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <FiTarget className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-blue-600">
              {stats.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              {stats.winningTrades}W / {stats.losingTrades}L
            </p>
          </div>

          {/* Biggest Win */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Biggest Win</p>
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <FiTrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-green-600">
              {formatCurrency(stats.biggestWin)}
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">Best single trade</p>
          </div>

          {/* Biggest Loss */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Biggest Loss</p>
              <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center">
                <FiTrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-red-600">
              {formatCurrency(stats.biggestLoss)}
            </p>
            <p className="text-xs text-gray-500 mt-2 font-medium">Worst single trade</p>
          </div>
        </div>

        {/* Model Performance */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Model Performance</h3>
              <p className="text-sm text-gray-500">DEEPSEEK-CHAT-V3.1 Trading Statistics</p>
            </div>
            <button
              onClick={loadLeaderboardData}
              disabled={loading}
              className={`flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-sm text-gray-600 font-semibold mb-3">Average Metrics</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Avg Win:</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(stats.avgWin)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Avg Loss:</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(stats.avgLoss)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Risk/Reward:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {stats.avgLoss !== 0 ? (Math.abs(stats.avgWin / stats.avgLoss)).toFixed(2) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 font-semibold mb-3">Trade Distribution</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Total Trades:</span>
                  <span className="text-sm font-bold text-gray-900">{stats.totalTrades}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm text-green-700 font-medium">Winning:</span>
                  <span className="text-sm font-bold text-green-700">{stats.winningTrades}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm text-red-700 font-medium">Losing:</span>
                  <span className="text-sm font-bold text-red-700">{stats.losingTrades}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 font-semibold mb-3">Performance Grade</p>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-black text-white">
                    {stats.winRate >= 70 ? 'A' : stats.winRate >= 60 ? 'B' : stats.winRate >= 50 ? 'C' : 'D'}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {stats.winRate >= 70 ? 'Excellent' : stats.winRate >= 60 ? 'Good' : stats.winRate >= 50 ? 'Fair' : 'Needs Work'}
                </p>
                <p className="text-xs text-gray-600">Based on win rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Signals Table */}
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Recent Signals</h3>
            <p className="text-sm text-gray-500">Latest AI trading decisions and analysis</p>
          </div>

          {signals.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <FiBarChart2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-base font-semibold text-gray-700 mb-1">No Signals Yet</p>
              <p className="text-sm text-gray-500">Generate signals to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                      Account Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                      Return
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                      Positions
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {signals.slice(0, 20).map((signal, idx) => {
                    // Handle timestamp parsing
                    let timestamp;
                    try {
                      if (signal.timestamp?.toDate) {
                        timestamp = signal.timestamp.toDate();
                      } else if (signal.timestampString) {
                        timestamp = new Date(signal.timestampString);
                      } else if (signal.timestamp) {
                        timestamp = new Date(signal.timestamp);
                      } else {
                        timestamp = new Date();
                      }

                      if (isNaN(timestamp.getTime())) {
                        timestamp = new Date();
                      }
                    } catch (e) {
                      timestamp = new Date();
                    }

                    // Calculate return percentage
                    const accountValue = signal.accountInfo?.accountValue || 0;
                    const totalReturn = signal.accountInfo?.totalReturn || 0;
                    const returnPercent = accountValue > 0 ? (totalReturn / (accountValue - totalReturn)) * 100 : 0;

                    // Count positions
                    const positionsCount = signal.positions?.length || signal.accountInfo?.positions?.length || 0;

                    return (
                      <tr key={signal.id || idx} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {timestamp.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {accountValue > 0 ? formatCurrency(accountValue) : formatCurrency(1000)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {returnPercent !== 0 ? formatPercent(returnPercent) : '0.00%'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {positionsCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            Executed
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

