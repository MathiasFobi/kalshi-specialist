# Kalshi Trading Specialist

A TypeScript-based trading specialist for the Kalshi prediction market exchange. Provides tools for market lookup, order execution, and order management using the Kalshi V2 API with RSA key authentication.

## Features

- 🔐 **Secure V2 API Authentication** - RSA-SHA256 request signing
- 📊 **Market Lookup** - Get real-time market data and pricing
- 💰 **Order Execution** - Place limit orders with validation
- 🚫 **Order Cancellation** - Cancel existing orders
- 🧪 **Demo/Prod Environments** - Paper trading support
- ✅ **Full Test Coverage** - Comprehensive test suite with Vitest

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- TypeScript >= 5.0
- Kalshi API credentials (key ID + RSA private key)

### Installation

```bash
# Clone the repository
cd kalshi-specialist

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Configuration

Create a `.env` file or set environment variables:

```bash
# Required
export KALSHI_KEY_PATH="/path/to/kalshi_key.pem"
export KALSHI_KEY_ID="your-key-id-from-kalshi"

# Optional (defaults to demo)
export KALSHI_ENVIRONMENT="demo"  # or "prod" for live trading
```

### Basic Usage

```typescript
import { KalshiClient } from 'kalshi-specialist';
import { getMarketInfo } from 'kalshi-specialist/cli/get_market_info.js';
import { executeOrder } from 'kalshi-specialist/cli/execute_order.js';

// Initialize the client (demo mode by default)
const client = new KalshiClient({
  environment: 'demo',  // Use 'prod' for live trading
  keyId: process.env.KALSHI_KEY_ID!,
  privateKeyPath: process.env.KALSHI_KEY_PATH!
});

// Check API status
const status = await client.getStatus();
console.log('API Status:', status);

// Look up a market
const market = await getMarketInfo(client, 'WILL-BIDEN-MENTION-TRUMP');
console.log(`Market: ${market.market.title}`);
console.log(`YES Ask: ${market.market.yes_ask}¢`);
console.log(`NO Ask: ${market.market.no_ask}¢`);

// Place a limit order (demo = no real money)
const order = await executeOrder(client, {
  ticker: 'WILL-BIDEN-MENTION-TRUMP',
  side: 'yes',      // Buy YES contracts
  count: 10,        // Buy 10 contracts
  price: 65         // Pay up to 65 cents per contract
});
console.log(`Order placed: ${order.orderId}`);
```

## API Reference

### KalshiClient

The main client class for API interaction.

```typescript
const client = new KalshiClient({
  environment: 'demo',           // 'demo' or 'prod'
  keyId: 'your-key-id',          // From Kalshi account
  privateKeyPath: '/path/to/key' // Path to RSA private key
});
```

**Methods:**
- `client.getStatus()` - Check API status (unauthenticated)
- `client.getBalance()` - Get account balance
- `client.getPositions()` - Get open positions
- `client.get(url, params?)` - Authenticated GET request
- `client.post(url, data?)` - Authenticated POST request
- `client.delete(url)` - Authenticated DELETE request

### get_market_info

Look up market details by ticker.

```typescript
import { getMarketInfo, MarketLookupError } from 'kalshi-specialist/cli/get_market_info.js';

try {
  const market = await getMarketInfo(client, 'TICKER-HERE');
  console.log(market.market.title);
  console.log(market.market.yes_ask, market.market.no_ask);
} catch (error) {
  if (error instanceof MarketLookupError) {
    console.error(`Market lookup failed for ${error.ticker}: ${error.message}`);
  }
}
```

### execute_order

Place a limit order.

```typescript
import { executeOrder, OrderExecutionError } from 'kalshi-specialist/cli/execute_order.js';

const order = await executeOrder(client, {
  ticker: 'MARKET-TICKER',
  side: 'yes',    // or 'no'
  count: 5,       // number of contracts
  price: 70       // limit price in cents (1-99)
});
// Returns: { orderId, status, side, ticker, count, price, createdAt }
```

**Validation:**
- `ticker`: Required, non-empty
- `side`: Must be `"yes"` or `"no"`
- `count`: Positive integer
- `price`: Integer between 1-99 cents

### cancel_order

Cancel an existing order.

```typescript
import { cancelOrder, CancelOrderError } from 'kalshi-specialist/cli/cancel_order.js';

const result = await cancelOrder(client, 'order-id-here');
// Returns: { orderId, status, message }
```

**Note:** Orders that are already filled or cancelled will return an error with code `ALREADY_CLOSED`.

## Project Structure

```
src/
├── auth.ts                    # RSA key loading and request signing
├── client.ts                  # KalshiClient class
├── cli/
│   ├── get_market_info.ts     # Market lookup tool
│   ├── execute_order.ts       # Order execution tool
│   └── cancel_order.ts        # Order cancellation tool
└── __tests__/
    ├── auth.test.ts           # Auth module tests
    ├── client.test.ts         # Client tests
    ├── get_market_info.test.ts
    ├── execute_order.test.ts
    └── cancel_order.test.ts
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run all tests with Vitest |
| `npm start` | Run the compiled main.js |

## Testing

Run the full test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npx vitest
```

Tests cover:
- RSA key loading and validation
- Request signing with V2 API format
- Client HTTP methods
- Market lookup functionality
- Order execution validation and errors
- Order cancellation handling

## Authentication Details

This package uses Kalshi's V2 API authentication with RSA-SHA256 signing:

1. **Private Key**: Load from PEM file
2. **Key ID**: Provided by Kalshi
3. **Request Signing**: Each authenticated request is signed

Signature format:
```
timestamp + METHOD.toUpperCase() + path + body
```

Example:
```
1708368000GET/portfolio/orders/abc-123
```

The client automatically handles signing for all authenticated requests.

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| `demo` | `https://demo-api.kalshi.com/v2` | Paper trading, test with fake money |
| `prod` | `https://trading-api.kalshi.com/v2` | Live trading with real funds |

**Always test with `demo` before using `prod`!**

## Error Codes

### execute_order Error Codes

- `BAD_REQUEST` - Invalid order parameters
- `AUTH_ERROR` - Authentication failed (check key)
- `FORBIDDEN` - Permission denied
- `MARKET_NOT_FOUND` - Market doesn't exist
- `RATE_LIMIT` - Too many requests
- `EXECUTION_ERROR` - General execution failure

### cancel_order Error Codes

- `BAD_REQUEST` - Invalid order ID
- `AUTH_ERROR` - Authentication failed
- `FORBIDDEN` - Permission denied
- `ORDER_NOT_FOUND` - Order doesn't exist
- `ALREADY_CLOSED` - Order already filled/cancelled
- `RATE_LIMIT` - Too many requests
- `CANCEL_ERROR` - General cancellation failure

## Troubleshooting

### "Private key file not found"
- Check that `KALSHI_KEY_PATH` points to the correct file
- Ensure the file exists and is readable

### "Invalid PEM format"
- Verify the key file starts with `-----BEGIN RSA PRIVATE KEY-----`
- Ensure the key file is not truncated

### "Authentication failed"
- Verify your `KALSHI_KEY_ID` is correct
- Ensure you're using the correct environment (demo vs prod)
- Check the private key matches the key ID in your Kalshi account

### Rate Limit Errors
- Kalshi API has rate limits
- Add delays between requests if you're making many calls

## License

ISC

## Contributing

This project follows standard TypeScript/Node conventions:

- Use `.js` extensions in imports (for NodeNext module resolution)
- Keep tests alongside source files in `__tests__/`
- Follow existing error handling patterns with custom error classes

## See Also

- [Kalshi API Documentation](https://trading-api.readme.io/)
- [Kalshi Trading Rules](https://kalshi.com/rules)
