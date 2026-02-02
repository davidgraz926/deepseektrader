# Test Coverage Analysis - DeepSeek Trader

## Executive Summary

**Current Test Coverage: 0%**

The DeepSeek Trader codebase currently has **no automated tests**, despite being a financial trading application that handles:
- Real cryptocurrency trading on Hyperliquid
- P&L calculations and risk management
- External API integrations (DeepSeek AI, Binance, Hyperliquid)

This represents a significant risk for a financial application.

---

## Current State

### What Exists
- ESLint for code quality
- Manual testing via paper trading mode
- Firebase emulator for local development

### What's Missing
- No testing framework installed (Jest, Vitest, Mocha)
- No test files (`*.test.js`, `*.spec.js`)
- No test scripts in `package.json`
- No mocking utilities
- No coverage reporting

---

## Priority Areas for Testing

### 1. **CRITICAL: Trade Executor** (`lib/tradeExecutor.js`)

This module handles real money. Functions requiring tests:

| Function | Risk | What to Test |
|----------|------|--------------|
| `enforceRiskLimits()` | HIGH | Ensures position sizing respects MAX_POSITION_RISK_PCT (5%) |
| `buildOrderPayload()` | HIGH | Correct order construction, limit price calculation |
| `normalizeSignal()` | MEDIUM | Handles array vs object formats, case normalization |
| `resolvePrice()` | MEDIUM | Binance fallback to CoinMarketCap |
| `executeAutoTrades()` | HIGH | End-to-end trade execution flow |

**Example Test Cases:**
```javascript
// enforceRiskLimits - should cap notional at 5% of account
test('caps notional at MAX_POSITION_RISK_PCT', () => {
  const accountValue = 10000;
  const notional = 1000; // 10% of account
  const result = enforceRiskLimits(notional, accountValue);
  expect(result).toBe(500); // 5% cap
});

// buildOrderPayload - should calculate correct limit price
test('LONG order has limit price 0.2% above market', () => {
  const payload = buildOrderPayload({ coin: 'BTC', side: 'LONG', size: 0.1, price: 50000 });
  expect(payload.limit_px).toBe(50100); // 50000 * 1.002
  expect(payload.is_buy).toBe(true);
});
```

---

### 2. **CRITICAL: Simulation Engine** (`lib/simulationEngine.js`)

Paper trading accuracy is essential for strategy validation.

| Function | Risk | What to Test |
|----------|------|--------------|
| `calculateUnrealizedPnL()` | HIGH | LONG/SHORT P&L math correctness |
| `executeSimulatedTrade()` | HIGH | Position open/close/modify logic |
| `updateTestPortfolioPrices()` | MEDIUM | Portfolio value calculations |

**Example Test Cases:**
```javascript
// calculateUnrealizedPnL - LONG position
test('LONG profit when price increases', () => {
  const position = { side: 'LONG', entryPrice: 100, notional: 1000 };
  const pnl = calculateUnrealizedPnL(position, 110); // price +10%
  expect(pnl).toBe(100); // $100 profit
});

// calculateUnrealizedPnL - SHORT position
test('SHORT profit when price decreases', () => {
  const position = { side: 'SHORT', entryPrice: 100, notional: 1000 };
  const pnl = calculateUnrealizedPnL(position, 90); // price -10%
  expect(pnl).toBe(100); // $100 profit
});

// Stop loss trigger
test('LONG position closes at stop loss', async () => {
  const signal = { BTC: { side: 'HOLD' } };
  const marketData = { binance: { BTC: { price: 45000 } } };
  // Position with SL at 46000
  const result = await executeSimulatedTrade(signal, marketData);
  expect(result.trades).toContainEqual(expect.objectContaining({
    type: 'CLOSE',
    reason: expect.stringContaining('Stop loss')
  }));
});
```

---

### 3. **HIGH: API Route Testing**

14 API routes need input validation and error handling tests:

| Endpoint | Priority | What to Test |
|----------|----------|--------------|
| `/api/generate-signal` | HIGH | DeepSeek response parsing, error handling |
| `/api/market-data` | HIGH | Binance API failure, data caching |
| `/api/positions` | HIGH | Hyperliquid API errors |
| `/api/settings/*` | MEDIUM | CRUD operations, validation |
| `/api/telegram/send` | LOW | Message formatting |

**Example Test Cases:**
```javascript
// /api/generate-signal - handles malformed AI response
test('returns error for invalid JSON in AI response', async () => {
  // Mock DeepSeek to return invalid JSON
  const response = await POST(new Request('/api/generate-signal'));
  expect(response.status).toBe(500);
  expect(await response.json()).toHaveProperty('error');
});

// /api/market-data - handles Binance failure
test('falls back to CoinMarketCap when Binance fails', async () => {
  // Mock Binance to fail
  const response = await GET(new Request('/api/market-data'));
  expect(response.ok).toBe(true);
  // Should still return data from CoinMarketCap
});
```

---

### 4. **HIGH: Firebase Cloud Function** (`functions/index.js`)

The main orchestration logic runs every 5 minutes.

| Area | What to Test |
|------|--------------|
| Data flow | Signal generation → Trade execution → Notification |
| Mode switching | Test mode vs Live mode behavior |
| Error handling | Graceful degradation on API failures |
| Idempotency | Same signal doesn't trigger duplicate trades |

---

### 5. **MEDIUM: Configuration** (`lib/config.js`)

| What to Test |
|--------------|
| Environment variable defaults |
| TRADABLE_COINS list accuracy |
| DEFAULT_PROMPT structure |

---

## Recommended Testing Stack

### For Next.js App (Frontend + API Routes)
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react jsdom
```

### For Firebase Cloud Functions
```bash
cd functions
npm install -D jest firebase-functions-test
```

### Mocking Libraries
```bash
npm install -D msw  # Mock Service Worker for API mocking
```

---

## Proposed Test Structure

```
deepseektrader/
├── __tests__/
│   ├── lib/
│   │   ├── tradeExecutor.test.js
│   │   ├── simulationEngine.test.js
│   │   └── config.test.js
│   ├── api/
│   │   ├── generate-signal.test.js
│   │   ├── market-data.test.js
│   │   └── positions.test.js
│   └── mocks/
│       ├── hyperliquid.js
│       ├── firebase.js
│       └── marketData.js
├── functions/
│   ├── __tests__/
│   │   └── index.test.js
│   └── mocks/
│       └── fixtures.js
├── vitest.config.js
└── package.json (with test scripts)
```

---

## Package.json Updates Needed

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^24.0.0",
    "msw": "^2.0.0"
  }
}
```

---

## Implementation Roadmap

### Phase 1: Setup (1-2 hours)
- [ ] Install Vitest and testing libraries
- [ ] Configure vitest.config.js
- [ ] Add test scripts to package.json
- [ ] Create basic mock structure

### Phase 2: Critical Unit Tests (4-6 hours)
- [ ] `tradeExecutor.js` - All pure functions
- [ ] `simulationEngine.js` - P&L calculations
- [ ] Risk limit enforcement tests

### Phase 3: Integration Tests (4-6 hours)
- [ ] API route tests with mocked dependencies
- [ ] Firebase Cloud Function tests
- [ ] End-to-end paper trading flow

### Phase 4: Coverage & CI (2-3 hours)
- [ ] Add coverage reporting
- [ ] Set up GitHub Actions for CI
- [ ] Add pre-commit hooks for tests

---

## Minimum Viable Test Suite

If time is limited, prioritize these 10 tests:

1. `enforceRiskLimits()` - caps notional correctly
2. `enforceRiskLimits()` - handles edge cases (0, null, NaN)
3. `buildOrderPayload()` - LONG order construction
4. `buildOrderPayload()` - SHORT order construction
5. `calculateUnrealizedPnL()` - LONG profit calculation
6. `calculateUnrealizedPnL()` - SHORT profit calculation
7. `normalizeSignal()` - array format normalization
8. `normalizeSignal()` - object format normalization
9. `resolvePrice()` - Binance primary source
10. `resolvePrice()` - CoinMarketCap fallback

These 10 tests cover the most critical financial calculations.

---

## Risk Assessment

| Risk | Impact | Likelihood Without Tests |
|------|--------|--------------------------|
| Incorrect P&L calculation | HIGH - Financial loss | MEDIUM |
| Risk limits not enforced | HIGH - Excessive exposure | LOW |
| Order payload malformed | HIGH - Failed trades | MEDIUM |
| Stop loss not triggered | HIGH - Larger losses | MEDIUM |
| Position sizing errors | MEDIUM - Suboptimal trades | MEDIUM |

---

## Conclusion

Adding even a minimal test suite covering the core financial calculations would significantly reduce risk. The recommended approach:

1. **Start small**: Test pure functions first (`enforceRiskLimits`, `calculateUnrealizedPnL`, `buildOrderPayload`)
2. **Mock external services**: Hyperliquid, DeepSeek, Binance, Firebase
3. **Add coverage gradually**: Target 80% coverage for `lib/` modules
4. **CI integration**: Run tests on every push

The investment in testing infrastructure will pay dividends in preventing costly trading errors.
