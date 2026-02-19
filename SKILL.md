# Kalshi Trading Specialist

Use the Kalshi Trading Specialist to interact with the Kalshi Exchange API (V2) for prediction market trading.

## Overview

This skill provides tools for:
- **Market Discovery**: Look up market details and pricing information
- **Order Execution**: Place buy/sell orders on Kalshi markets
- **Order Management**: Cancel existing orders
- **Account Monitoring**: Check balances and positions

## Tools

### `get_market_info`

Look up detailed market information by ticker symbol.

**Parameters:**
- `ticker` (string, required): Market ticker symbol (e.g., "KXTRUMPWIN-2024", "WILL-BIDEN-MENTION-TRUMP")

**Returns:**
- Market details including:
  - `ticker`: Market identifier
  - `title`: Human-readable market name
  - `category`: Inferred category (politics, crypto, sports, weather, econ, mentions, other)
  - `yes_ask` / `yes_bid`: Current YES side prices in cents
  - `no_ask` / `no_bid`: Current NO side prices in cents
  - `volume`: Trading volume
  - `open_interest`: Open interest
  - `status`: Market status (open, closed, etc.)
  - `close_time`: Market close time (if available)
  - `description`: Market description (if available)

**Example:**
```typescript
import { KalshiClient } from 'kalshi-specialist';
import { getMarketInfo } from 'kalshi-specialist/cli/get_market_info.js';

const client = new KalshiClient({
  environment: 'demo',
  keyId: 'your-key-id',
  privateKeyPath: '/path/to/kalshi_key.pem'
});

const market = await getMarketInfo(client, 'WILL-BIDEN-MENTION-TRUMP');
console.log(market.market.title);  // "Will Biden mention Trump?"
console.log(market.market.yes_ask); // Current YES ask price in cents
```

### `execute_order`

Place a limit order on a Kalshi market.

**Parameters:**
- `ticker` (string, required): Market ticker symbol
- `side` (string, required): Order side - either `"yes"` or `"no"`
- `count` (number, required): Number of contracts to buy (positive integer)
- `price` (number, required): Limit price in cents (1-99)

**Returns:**
- `orderId`: Unique order identifier
- `status`: Order status (pending, filled, rejected, etc.)
- `side`: Executed side (yes/no)
- `ticker`: Market ticker
- `count`: Number of contracts
- `price`: Executed price in cents
- `createdAt`: Timestamp

**Example:**
```typescript
import { executeOrder } from 'kalshi-specialist/cli/execute_order.js';

const order = await executeOrder(client, {
  ticker: 'WILL-BIDEN-MENTION-TRUMP',
  side: 'yes',
  count: 10,
  price: 65  // 65 cents = $0.65 per contract
});
console.log(`Order placed: ${order.orderId} - Status: ${order.status}`);
```

**Error Codes:**
- `BAD_REQUEST`: Invalid order parameters
- `AUTH_ERROR`: Authentication failed
- `FORBIDDEN`: Permission denied
- `MARKET_NOT_FOUND`: Market doesn't exist
- `RATE_LIMIT`: API rate limit exceeded
- `EXECUTION_ERROR`: General execution failure

### `cancel_order`

Cancel an existing order on Kalshi.

**Parameters:**
- `orderId` (string, required): The order ID to cancel

**Returns:**
- `orderId`: Order identifier
- `status`: Cancellation status
- `message`: Human-readable confirmation message

**Example:**
```typescript
import { cancelOrder } from 'kalshi-specialist/cli/cancel_order.js';

const result = await cancelOrder(client, 'order-id-12345');
console.log(`Order ${result.orderId} cancelled: ${result.message}`);
```

**Error Codes:**
- `BAD_REQUEST`: Invalid order ID
- `AUTH_ERROR`: Authentication failed
- `FORBIDDEN`: Permission denied
- `ORDER_NOT_FOUND`: Order doesn't exist
- `ALREADY_CLOSED`: Order already filled or cancelled (409)
- `RATE_LIMIT`: API rate limit exceeded
- `CANCEL_ERROR`: General cancellation failure

### `get_balance`

Check account balance and portfolio information.

**Returns:**
- Account balance information from `/portfolio/balance` endpoint

**Example:**
```typescript
const balance = await client.getBalance();
console.log(balance.data);
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `KALSHI_KEY_PATH` | Path to the RSA private key PEM file | Yes |
| `KALSHI_KEY_ID` | Your Kalshi API key ID | Yes |
| `KALSHI_ENVIRONMENT` | API environment: `"demo"` or `"prod"` | No (defaults to `"demo"`) |

### API Environments

- **demo**: `https://demo-api.kalshi.com/v2` - Paper trading, no real money
- **prod**: `https://trading-api.kalshi.com/v2` - Live trading with real funds

**⚠️ Warning**: Always test with `demo` environment first before using `prod`.

### Private Key Setup

1. Generate an RSA key pair from your Kalshi account settings
2. Download the private key (PEM format)
3. Save it securely and set `KALSHI_KEY_PATH` to the file location

The key file should look like:
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----
```

## Project Structure

```
src/
├── auth.ts                    # RSA key loading and V2 request signing
├── client.ts                  # KalshiClient class (HTTP wrapper)
├── cli/
│   ├── get_market_info.ts     # Market lookup tool
│   ├── execute_order.ts       # Order placement tool
│   └── cancel_order.ts        # Order cancellation tool
└── __tests__/                 # Test files
```

## Installation

```bash
npm install
npm run build
```

## Usage Quick Start

```typescript
import { KalshiClient } from 'kalshi-specialist';
import { getMarketInfo } from 'kalshi-specialist/cli/get_market_info.js';
import { executeOrder } from 'kalshi-specialist/cli/execute_order.js';

// Initialize client
const client = new KalshiClient({
  environment: 'demo',  // Use 'demo' for paper trading
  keyId: process.env.KALSHI_KEY_ID!,
  privateKeyPath: process.env.KALSHI_KEY_PATH!
});

// Look up a market
const market = await getMarketInfo(client, 'WILL-BIDEN-MENTION-TRUMP');
console.log(`${market.market.title}: YES=${market.market.yes_ask}¢ NO=${market.market.no_ask}¢`);

// Place an order (demo mode - no real money)
const order = await executeOrder(client, {
  ticker: 'WILL-BIDEN-MENTION-TRUMP',
  side: 'yes',
  count: 5,
  price: 60  // 60 cents per contract
});
```

## Authentication

This skill uses Kalshi V2 API authentication with RSA-SHA256 request signing:

1. Load the private key from `KALSHI_KEY_PATH`
2. For each authenticated request, generate headers:
   - `KALSHI-ACCESS-KEY`: Your key ID
   - `KALSHI-ACCESS-TIMESTAMP`: Current timestamp (seconds since epoch)
   - `KALSHI-ACCESS-SIGNATURE`: RSA-SHA256 signature of the request

The signature format is:
```
timestamp + METHOD.toUpperCase() + path + body
```

Example:
```
1708368000GET/portfolio/balance
```

## Error Handling

All tools throw specialized error classes with context:

```typescript
try {
  await executeOrder(client, order);
} catch (error) {
  if (error instanceof OrderExecutionError) {
    console.log(`Order failed for ${error.ticker}: ${error.message}`);
    console.log(`Error code: ${error.code}`);
  }
}
```

## Rate Limits

Kalshi API has rate limits. If you receive a `RATE_LIMIT` error, wait before retrying.

## Dependencies

- `axios`: HTTP client for API requests
- `dotenv`: Environment variable loading
- Node.js built-in `crypto` module for RSA signing

## License

ISC
