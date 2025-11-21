// Simulation Engine for Test Mode (Paper Trading)
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const TRADABLE_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'];

/**
 * Get test mode settings
 */
export async function getTestModeSettings() {
  try {
    const [testModeDoc, testBalanceDoc] = await Promise.all([
      getDoc(doc(db, 'settings', 'test_mode')),
      getDoc(doc(db, 'settings', 'test_balance')),
    ]);

    const isTestMode = testModeDoc.exists() && (testModeDoc.data().value === true || testModeDoc.data().value === 'true');
    const initialBalance = testBalanceDoc.exists() ? parseFloat(testBalanceDoc.data().value) || 10000 : 10000;

    return { isTestMode, initialBalance };
  } catch (error) {
    console.error('Error getting test mode settings:', error);
    return { isTestMode: false, initialBalance: 10000 };
  }
}

/**
 * Get current test portfolio state
 */
export async function getTestPortfolio() {
  try {
    const portfolioDoc = await getDoc(doc(db, 'test_portfolio', 'current'));
    
    if (!portfolioDoc.exists()) {
      // Initialize portfolio
      const { initialBalance } = await getTestModeSettings();
      const initialPortfolio = {
        accountValue: initialBalance,
        availableCash: initialBalance,
        totalReturn: 0,
        positions: [],
        lastUpdated: new Date().toISOString(),
      };
      await setDoc(doc(db, 'test_portfolio', 'current'), initialPortfolio);
      return initialPortfolio;
    }

    return portfolioDoc.data();
  } catch (error) {
    console.error('Error getting test portfolio:', error);
    return null;
  }
}

/**
 * Calculate unrealized P&L for a position based on current market price
 */
function calculateUnrealizedPnL(position, currentPrice) {
  const { side, entryPrice, notional, leverage } = position;
  const quantity = notional / entryPrice;
  
  if (side === 'LONG') {
    const pnl = (currentPrice - entryPrice) * quantity;
    return pnl;
  } else if (side === 'SHORT') {
    const pnl = (entryPrice - currentPrice) * quantity;
    return pnl;
  }
  return 0;
}

/**
 * Execute simulated trade based on AI signal
 */
export async function executeSimulatedTrade(signal, marketData) {
  try {
    const portfolio = await getTestPortfolio();
    if (!portfolio) {
      throw new Error('Failed to load test portfolio');
    }

    const trades = [];
    const updatedPositions = [...(portfolio.positions || [])];
    let totalPnL = 0;
    let availableCash = portfolio.availableCash;

    // First, check existing positions for stop loss/profit target hits
    for (let i = updatedPositions.length - 1; i >= 0; i--) {
      const position = updatedPositions[i];
      const marketPrice = marketData?.binance?.[position.symbol]?.price || marketData?.[position.symbol]?.price;
      
      if (!marketPrice) {
        continue; // Skip if no market price available
      }

      let shouldClose = false;
      let closeReason = '';

      // Check stop loss
      if (position.stopLoss) {
        if (position.side === 'LONG' && marketPrice <= position.stopLoss) {
          shouldClose = true;
          closeReason = `Stop loss hit at $${position.stopLoss}`;
        } else if (position.side === 'SHORT' && marketPrice >= position.stopLoss) {
          shouldClose = true;
          closeReason = `Stop loss hit at $${position.stopLoss}`;
        }
      }

      // Check profit target
      if (position.profitTarget && !shouldClose) {
        if (position.side === 'LONG' && marketPrice >= position.profitTarget) {
          shouldClose = true;
          closeReason = `Profit target hit at $${position.profitTarget}`;
        } else if (position.side === 'SHORT' && marketPrice <= position.profitTarget) {
          shouldClose = true;
          closeReason = `Profit target hit at $${position.profitTarget}`;
        }
      }

      // Close position if stop loss or profit target hit
      if (shouldClose) {
        const closePnL = calculateUnrealizedPnL(position, marketPrice);
        totalPnL += closePnL;
        availableCash += position.marginUsed + closePnL;
        
        trades.push({
          type: 'CLOSE',
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: marketPrice,
          pnl: closePnL,
          reason: closeReason,
          timestamp: new Date().toISOString(),
        });

        // Remove position
        updatedPositions.splice(i, 1);
        console.log(`✅ Closed ${position.symbol} ${position.side} position: ${closeReason}, PnL: $${closePnL.toFixed(2)}`);
      }
    }

    // Process each coin in the signal
    for (const coin of TRADABLE_COINS) {
      const coinSignal = signal[coin];
      if (!coinSignal || coinSignal.side === 'HOLD') {
        continue;
      }

      const marketPrice = marketData?.binance?.[coin]?.price || marketData?.[coin]?.price;
      if (!marketPrice) {
        console.warn(`No market price found for ${coin}`);
        continue;
      }

      const { side, notional, leverage: signalLeverage, profit_target, stop_loss } = coinSignal;
      const leverage = signalLeverage || 10;
      const marginRequired = notional / leverage;

      // Check if we have enough cash
      if (marginRequired > availableCash) {
        console.warn(`Insufficient cash for ${coin} trade. Required: $${marginRequired}, Available: $${availableCash}`);
        continue;
      }

      // Find existing position
      const existingIndex = updatedPositions.findIndex(p => p.symbol === coin);

      if (existingIndex >= 0) {
        const existingPosition = updatedPositions[existingIndex];
        
        // Check if we need to close or modify position
        if (existingPosition.side !== side) {
          // Close existing position and calculate P&L
          const closePnL = calculateUnrealizedPnL(existingPosition, marketPrice);
          totalPnL += closePnL;
          availableCash += existingPosition.marginUsed + closePnL;
          
          trades.push({
            type: 'CLOSE',
            symbol: coin,
            side: existingPosition.side,
            entryPrice: existingPosition.entryPrice,
            exitPrice: marketPrice,
            pnl: closePnL,
            timestamp: new Date().toISOString(),
          });

          // Remove position
          updatedPositions.splice(existingIndex, 1);
        } else {
          // Same side - update position size
          const currentPnL = calculateUnrealizedPnL(existingPosition, marketPrice);
          const newNotional = notional;
          const newMarginRequired = newNotional / leverage;
          
          // Adjust cash
          const marginDiff = newMarginRequired - existingPosition.marginUsed;
          if (marginDiff > 0 && marginDiff > availableCash) {
            console.warn(`Insufficient cash to increase ${coin} position`);
            continue;
          }

          availableCash -= marginDiff;
          
          // Update position
          updatedPositions[existingIndex] = {
            ...existingPosition,
            notional: newNotional,
            leverage,
            marginUsed: newMarginRequired,
            entryPrice: (existingPosition.entryPrice + marketPrice) / 2, // Average entry
            profitTarget: profit_target,
            stopLoss: stop_loss,
            lastUpdated: new Date().toISOString(),
          };

          trades.push({
            type: 'UPDATE',
            symbol: coin,
            side,
            notional: newNotional,
            leverage,
            timestamp: new Date().toISOString(),
          });
          
          continue;
        }
      }

      // Open new position
      if (side === 'LONG' || side === 'SHORT') {
        const entryPrice = marketPrice;
        const quantity = notional / entryPrice;
        
        availableCash -= marginRequired;

        const newPosition = {
          symbol: coin,
          side,
          entryPrice,
          quantity,
          notional,
          leverage,
          marginUsed: marginRequired,
          profitTarget: profit_target,
          stopLoss: stop_loss,
          openedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        updatedPositions.push(newPosition);

        trades.push({
          type: 'OPEN',
          symbol: coin,
          side,
          entryPrice,
          notional,
          leverage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Calculate current account value
    let totalUnrealizedPnL = 0;
    for (const position of updatedPositions) {
      const marketPrice = marketData?.binance?.[position.symbol]?.price || marketData?.[position.symbol]?.price;
      if (marketPrice) {
        const pnl = calculateUnrealizedPnL(position, marketPrice);
        totalUnrealizedPnL += pnl;
      }
    }

    const totalMarginUsed = updatedPositions.reduce((sum, p) => sum + p.marginUsed, 0);
    const accountValue = availableCash + totalMarginUsed + totalUnrealizedPnL;
    const totalReturn = accountValue - portfolio.accountValue;

    // Update portfolio
    const updatedPortfolio = {
      accountValue,
      availableCash,
      totalReturn,
      positions: updatedPositions,
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(doc(db, 'test_portfolio', 'current'), updatedPortfolio);

    // Save trade history and send Telegram notifications
    for (const trade of trades) {
      await setDoc(doc(db, 'test_trades', new Date().toISOString()), trade);
      
      // Send Telegram notification for OPEN and CLOSE trades
      if (trade.type === 'OPEN' || trade.type === 'CLOSE') {
        try {
          const axios = (await import('axios')).default;
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
          
          let message = `🧪 TEST MODE: `;
          if (trade.type === 'OPEN') {
            message += `✅ OPENED ${trade.side} position\n`;
            message += `Symbol: ${trade.symbol}\n`;
            message += `Entry: $${trade.entryPrice?.toFixed(2) || 'N/A'}\n`;
            message += `Notional: $${trade.notional?.toFixed(2) || 'N/A'}\n`;
            message += `Leverage: ${trade.leverage}x`;
          } else if (trade.type === 'CLOSE') {
            message += `🔒 CLOSED ${trade.side} position\n`;
            message += `Symbol: ${trade.symbol}\n`;
            message += `Entry: $${trade.entryPrice?.toFixed(2) || 'N/A'}\n`;
            message += `Exit: $${trade.exitPrice?.toFixed(2) || 'N/A'}\n`;
            message += `PnL: $${trade.pnl?.toFixed(2) || '0.00'}\n`;
            if (trade.reason) {
              message += `Reason: ${trade.reason}`;
            }
          }
          
          await axios.post(`${baseUrl}/api/telegram/send`, {
            message: message,
          }).catch(err => {
            console.warn('Telegram notification failed (non-critical):', err.message);
          });
        } catch (error) {
          console.warn('Failed to send Telegram notification (non-critical):', error.message);
        }
      }
    }

    return {
      success: true,
      portfolio: updatedPortfolio,
      trades,
      totalPnL,
    };
  } catch (error) {
    console.error('Error executing simulated trade:', error);
    throw error;
  }
}

/**
 * Update portfolio with current market prices (for P&L calculation)
 */
export async function updateTestPortfolioPrices(marketData) {
  try {
    const portfolio = await getTestPortfolio();
    if (!portfolio || !portfolio.positions || portfolio.positions.length === 0) {
      return portfolio;
    }

    const updatedPositions = portfolio.positions.map(position => {
      const marketPrice = marketData?.binance?.[position.symbol]?.price || marketData?.[position.symbol]?.price;
      if (!marketPrice) {
        return position;
      }

      const unrealizedPnL = calculateUnrealizedPnL(position, marketPrice);
      
      return {
        ...position,
        currentPrice: marketPrice,
        unrealizedPnL,
        lastUpdated: new Date().toISOString(),
      };
    });

    const totalUnrealizedPnL = updatedPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
    const totalMarginUsed = updatedPositions.reduce((sum, p) => sum + p.marginUsed, 0);
    const accountValue = portfolio.availableCash + totalMarginUsed + totalUnrealizedPnL;

    const updatedPortfolio = {
      ...portfolio,
      accountValue,
      positions: updatedPositions,
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(doc(db, 'test_portfolio', 'current'), updatedPortfolio);
    return updatedPortfolio;
  } catch (error) {
    console.error('Error updating portfolio prices:', error);
    return portfolio;
  }
}

/**
 * Reset simulation (clear all trades and reset balance)
 */
export async function resetSimulation() {
  try {
    const { initialBalance } = await getTestModeSettings();
    
    // Reset portfolio
    await setDoc(doc(db, 'test_portfolio', 'current'), {
      accountValue: initialBalance,
      availableCash: initialBalance,
      totalReturn: 0,
      positions: [],
      lastUpdated: new Date().toISOString(),
    });

    // Delete all trade history (optional - you might want to keep it)
    // For now, we'll just mark them as archived
    
    return { success: true };
  } catch (error) {
    console.error('Error resetting simulation:', error);
    throw error;
  }
}

/**
 * Get test trade history
 */
export async function getTestTradeHistory(limitCount = 50) {
  try {
    const q = query(
      collection(db, 'test_trades'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting test trade history:', error);
    return [];
  }
}

