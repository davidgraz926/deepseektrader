import { Hyperliquid } from 'hyperliquid';
import {
  AUTO_TRADING_ENABLED,
  HYPERLIQUID_PRIVATE_KEY,
  HYPERLIQUID_WALLET_ADDRESS,
  HYPERLIQUID_IS_TESTNET,
  MAX_POSITION_RISK_PCT,
} from './config';

let hyperliquidClient = null;

function ensureServerEnvironment() {
  if (typeof window !== 'undefined') {
    throw new Error('Hyperliquid trading can only run on the server.');
  }
}

function getHyperliquidClient() {
  ensureServerEnvironment();

  if (!hyperliquidClient) {
    if (!HYPERLIQUID_PRIVATE_KEY) {
      throw new Error('Hyperliquid private key is not configured.');
    }

    hyperliquidClient = new Hyperliquid({
      privateKey: HYPERLIQUID_PRIVATE_KEY,
      walletAddress: HYPERLIQUID_WALLET_ADDRESS || undefined,
      testnet: HYPERLIQUID_IS_TESTNET,
      enableWs: false,
      disableAssetMapRefresh: true,
    });
  }

  return hyperliquidClient;
}

function normalizeSignal(signal) {
  if (!signal) {
    return {};
  }

  if (Array.isArray(signal)) {
    return signal.reduce((acc, entry) => {
      const key = entry?.coin || entry?.asset || entry?.symbol;
      if (key) {
        acc[key.toUpperCase()] = entry;
      }
      return acc;
    }, {});
  }

  return Object.entries(signal).reduce((acc, [key, value]) => {
    if (value) {
      acc[key.toUpperCase()] = value;
    }
    return acc;
  }, {});
}

function resolvePrice(coin, marketData) {
  const upper = coin.toUpperCase();
  const binancePrice = marketData?.binance?.[upper]?.price;
  if (binancePrice) {
    return Number(binancePrice);
  }

  const cmcPrice = marketData?.coinmarketcap?.[upper]?.quote?.USD?.price;
  if (cmcPrice) {
    return Number(cmcPrice);
  }

  return null;
}

function enforceRiskLimits(notional, accountValue) {
  const numericNotional = Number(notional);
  if (!accountValue || accountValue <= 0 || !numericNotional || Number.isNaN(numericNotional)) {
    return numericNotional;
  }

  const perTradeCap = Number(MAX_POSITION_RISK_PCT) > 0 ? accountValue * MAX_POSITION_RISK_PCT : null;
  if (!perTradeCap) {
    return numericNotional;
  }

  return Math.min(numericNotional, perTradeCap);
}

function buildOrderPayload({ coin, side, size, price }) {
  const isBuy = side === 'LONG';
  const limitPx = isBuy ? price * 1.002 : price * 0.998;

  return {
    coin: `${coin}-PERP`,
    is_buy: isBuy,
    sz: Number(size.toFixed(4)),
    limit_px: Number(limitPx.toFixed(2)),
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: false,
  };
}

export async function executeAutoTrades({ signal, marketData, account }) {
  if (!AUTO_TRADING_ENABLED) {
    return { executed: false, reason: 'Auto trading disabled' };
  }

  if (!HYPERLIQUID_PRIVATE_KEY) {
    return { executed: false, reason: 'Hyperliquid credentials missing' };
  }

  const normalizedSignal = normalizeSignal(signal);
  if (!Object.keys(normalizedSignal).length) {
    return { executed: false, reason: 'No actionable signals in payload' };
  }

  const client = getHyperliquidClient();
  const accountValue = Number(account?.accountValue || 0);

  const results = [];
  let successfulOrders = 0;

  for (const [coinKey, decision] of Object.entries(normalizedSignal)) {
    const coin = coinKey.replace('-PERP', '').toUpperCase();
    const side = (decision?.side || decision?.action || decision?.direction || '').toUpperCase();

    if (!['LONG', 'SHORT'].includes(side)) {
      results.push({ coin, status: 'skipped', reason: 'No trade side provided' });
      continue;
    }

    const rawNotional =
      decision?.notional ||
      decision?.allocation_usd ||
      decision?.notional_usd ||
      decision?.position_size_usd ||
      decision?.size;

    const notional = enforceRiskLimits(rawNotional, accountValue);

    if (!notional || Number.isNaN(notional) || notional <= 0) {
      results.push({ coin, status: 'skipped', reason: 'Invalid or zero notional' });
      continue;
    }

    const price = resolvePrice(coin, marketData);
    if (!price) {
      results.push({ coin, status: 'skipped', reason: 'Missing reference price' });
      continue;
    }

    const size = Number((notional / price).toFixed(4));
    if (!size || Number.isNaN(size) || size <= 0) {
      results.push({ coin, status: 'skipped', reason: 'Computed size invalid' });
      continue;
    }

    const payload = buildOrderPayload({ coin, side, size, price });

    try {
      const response = await client.exchange.placeOrder(payload);
      successfulOrders += 1;
      results.push({
        coin,
        status: 'success',
        side,
        size: payload.sz,
        limit_px: payload.limit_px,
        response,
      });
    } catch (error) {
      console.error(`Hyperliquid order error (${coin}):`, error.message);
      results.push({
        coin,
        status: 'error',
        message: error.message,
      });
    }
  }

  return {
    executed: successfulOrders > 0,
    results,
  };
}

