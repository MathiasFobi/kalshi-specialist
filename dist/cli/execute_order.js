/**
 * Order Execution Tool
 * Place limit orders on Kalshi V2 API
 */
export class OrderExecutionError extends Error {
    ticker;
    code;
    constructor(message, ticker, code) {
        super(message);
        this.ticker = ticker;
        this.code = code;
        this.name = 'OrderExecutionError';
    }
}
/**
 * Execute a limit order on Kalshi
 * @param client - KalshiClient instance
 * @param order - Order request details
 * @returns OrderResponse with order ID and status
 */
export async function executeOrder(client, order) {
    validateOrder(order);
    try {
        // Kalshi V2 /portfolio/orders endpoint
        const response = await client.post('/portfolio/orders', {
            ticker: order.ticker,
            side: order.side,
            count: order.count,
            price: order.price,
        });
        const orderData = response.data.order;
        if (!orderData) {
            throw new OrderExecutionError(`Order failed: No order data returned for ${order.ticker}`, order.ticker);
        }
        return {
            orderId: orderData.order_id,
            status: orderData.status,
            side: orderData.side,
            ticker: orderData.ticker,
            count: orderData.count,
            price: orderData.price,
            createdAt: new Date().toISOString(),
        };
    }
    catch (error) {
        if (error instanceof OrderExecutionError) {
            throw error;
        }
        // Handle specific HTTP errors
        if (error.response?.status === 400) {
            const errorMsg = error.response?.data?.error?.message || 'Invalid order parameters';
            throw new OrderExecutionError(`Bad request: ${errorMsg}`, order.ticker, 'BAD_REQUEST');
        }
        if (error.response?.status === 401) {
            throw new OrderExecutionError('Authentication failed: Invalid API credentials', order.ticker, 'AUTH_ERROR');
        }
        if (error.response?.status === 403) {
            throw new OrderExecutionError('Permission denied: Unable to place order', order.ticker, 'FORBIDDEN');
        }
        if (error.response?.status === 404) {
            throw new OrderExecutionError(`Market not found: ${order.ticker}`, order.ticker, 'MARKET_NOT_FOUND');
        }
        if (error.response?.status === 429) {
            throw new OrderExecutionError('Rate limit exceeded: Please try again later', order.ticker, 'RATE_LIMIT');
        }
        throw new OrderExecutionError(`Order execution failed: ${error.message || 'Unknown error'}`, order.ticker, 'EXECUTION_ERROR');
    }
}
/**
 * Validate order parameters
 */
function validateOrder(order) {
    if (!order.ticker || order.ticker.trim() === '') {
        throw new OrderExecutionError('Ticker is required', order.ticker || '');
    }
    if (!order.side || (order.side !== 'yes' && order.side !== 'no')) {
        throw new OrderExecutionError(`Invalid side: ${order.side}. Must be 'yes' or 'no'`, order.ticker);
    }
    if (!Number.isInteger(order.count) || order.count < 1) {
        throw new OrderExecutionError(`Invalid count: ${order.count}. Must be a positive integer`, order.ticker);
    }
    if (!Number.isInteger(order.price) || order.price < 1 || order.price > 99) {
        throw new OrderExecutionError(`Invalid price: ${order.price}. Must be an integer between 1 and 99 (cents)`, order.ticker);
    }
}
/**
 * Format order response for CLI output
 */
export function formatOrderResponse(response) {
    const lines = [
        `Order Placed Successfully`,
        ``,
        `ORDER DETAILS:`,
        `  Order ID: ${response.orderId}`,
        `  Status: ${response.status}`,
        `  Ticker: ${response.ticker}`,
        `  Side: ${response.side.toUpperCase()}`,
        `  Count: ${response.count} contracts`,
        `  Price: ${response.price}¢ per contract`,
        `  Total: ${response.count * response.price}¢ ($${(response.count * response.price / 100).toFixed(2)})`,
        ``,
        `Timestamp: ${new Date(response.createdAt).toLocaleString()}`,
    ];
    return lines.join('\n');
}
/**
 * CLI entry point for executing orders
 */
export async function executeOrderCLI(client, ticker, side, count, price) {
    const response = await executeOrder(client, { ticker, side, count, price });
    console.log(formatOrderResponse(response));
    // Output JSON for programmatic use
    console.log('\nJSON_OUTPUT:', JSON.stringify({
        orderId: response.orderId,
        status: response.status,
        side: response.side,
    }));
}
