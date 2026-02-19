# Kalshi Multi-Strategy Specialist

Enhanced trading system with Sum-to-One and Junk Bond strategies.

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import { MarketScout, TradeExecutor } from 'kalshi-specialist';

// Initialize
const scout = new MarketScout({
  kalshiClient: yourClient,
  minVolume: 100,
  scanCategories: ['mentions', 'econ', 'weather', 'crypto'],
  maxResults: 10
});

const trader = new TradeExecutor({
  maxTrade: 1.0,
  maxPositions: 5,
  paperMode: true  // Start in paper mode!
});

// Scan for opportunities
const results = await scout.scan();

// Execute best opportunity
if (results.best) {
  if (results.best.type === 'sum-to-one') {
    await trader.executeSumToOne(client, results.best.data);
  } else if (results.best.type === 'junk-bond') {
    await trader.executeJunkBond(client, results.best.data);
  }
}
```

## Strategies

### Sum-to-One Arbitrage
Finds YES+NO markets where combined price < 0.95. Risk-free profit at resolution.

### Junk Bond Holds
Targets 70-95¢ markets in mentions/econ/weather categories. Compounding small edges.

## Configuration

See `MIGRATION_GUIDE.md` for full details.
