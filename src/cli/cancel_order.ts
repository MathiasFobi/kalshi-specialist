/**
 * Order Cancellation Tool
 * Cancel existing orders on Kalshi V2 API
 */

import { KalshiClient } from '../client.js';

export interface CancelOrderResponse {
  orderId: string;
  status: string;
  message: string;
}

export class CancelOrderError extends Error {
  constructor(
    message: string,
    public orderId: string,
    public code?: string
  ) {
    super(message);
    this.name = 'CancelOrderError';
  }
}

/**
 * Cancel an existing order on Kalshi
 * @param client - KalshiClient instance
 * @param orderId - The order ID to cancel
 * @returns CancelOrderResponse with confirmation
 */
export async function cancelOrder(
  client: KalshiClient,
  orderId: string
): Promise<CancelOrderResponse> {
  validateOrderId(orderId);

  try {
    // Kalshi V2 /portfolio/orders/{order_id} DELETE endpoint
    const response = await client.delete<{
      order_id?: string;
      status?: string;
      message?: string;
    }>(`/portfolio/orders/${orderId}`);

    const data = response.data;

    return {
      orderId: data.order_id || orderId,
      status: data.status || 'cancelled',
      message: data.message || 'Order cancelled successfully',
    };
  } catch (error: any) {
    if (error instanceof CancelOrderError) {
      throw error;
    }

    // Handle specific HTTP errors
    if (error.response?.status === 400) {
      const errorMsg = error.response?.data?.error?.message || 'Invalid order ID';
      throw new CancelOrderError(
        `Bad request: ${errorMsg}`,
        orderId,
        'BAD_REQUEST'
      );
    }

    if (error.response?.status === 401) {
      throw new CancelOrderError(
        'Authentication failed: Invalid API credentials',
        orderId,
        'AUTH_ERROR'
      );
    }

    if (error.response?.status === 403) {
      throw new CancelOrderError(
        'Permission denied: Unable to cancel order',
        orderId,
        'FORBIDDEN'
      );
    }

    if (error.response?.status === 404) {
      throw new CancelOrderError(
        `Order not found: ${orderId}`,
        orderId,
        'ORDER_NOT_FOUND'
      );
    }

    if (error.response?.status === 409) {
      const errorMsg = error.response?.data?.error?.message || 'Order cannot be cancelled';
      throw new CancelOrderError(
        `Conflict: ${errorMsg}`,
        orderId,
        'ALREADY_CLOSED'
      );
    }

    if (error.response?.status === 429) {
      throw new CancelOrderError(
        'Rate limit exceeded: Please try again later',
        orderId,
        'RATE_LIMIT'
      );
    }

    throw new CancelOrderError(
      `Order cancellation failed: ${error.message || 'Unknown error'}`,
      orderId,
      'CANCEL_ERROR'
    );
  }
}

/**
 * Validate order ID parameter
 */
function validateOrderId(orderId: string): void {
  if (!orderId || orderId.trim() === '') {
    throw new CancelOrderError('Order ID is required', '', 'BAD_REQUEST');
  }
}

/**
 * Format cancel order response for CLI output
 */
export function formatCancelOrderResponse(response: CancelOrderResponse): string {
  const lines: string[] = [
    `Order Cancelled Successfully`,
    ``,
    `CANCELLATION DETAILS:`,
    `  Order ID: ${response.orderId}`,
    `  Status: ${response.status}`,
    ``,
    `Message: ${response.message}`,
  ];

  return lines.join('\n');
}

/**
 * CLI entry point for cancelling orders
 */
export async function cancelOrderCLI(
  client: KalshiClient,
  orderId: string
): Promise<void> {
  const response = await cancelOrder(client, orderId);
  console.log(formatCancelOrderResponse(response));

  // Output JSON for programmatic use
  console.log('\nJSON_OUTPUT:', JSON.stringify({
    orderId: response.orderId,
    status: response.status,
    success: true,
  }));
}
