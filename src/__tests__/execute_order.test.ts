/**
 * Order Execution Tool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeOrder,
  formatOrderResponse,
  OrderExecutionError,
  OrderRequest,
  OrderResponse,
} from '../cli/execute_order.js';

// Mock the client module
vi.mock('../client.js', () => ({
  KalshiClient: vi.fn().mockImplementation(() => ({
    post: vi.fn(),
  })),
}));

import { KalshiClient } from '../client.js';

describe('executeOrder', () => {
  let mockClient: { post: any };

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockOrderResponse = (overrides?: Partial<any>): any => ({
    order_id: 'ord_123456789',
    status: 'pending',
    side: 'yes',
    ticker: 'KXTRUMPWIN-2024',
    count: 10,
    price: 55,
    ...overrides,
  });

  describe('success cases', () => {
    it('should place a buy order successfully', async () => {
      const mockOrder = createMockOrderResponse();
      mockClient.post.mockResolvedValue({ data: { order: mockOrder } });

      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 55,
      };

      const result = await executeOrder(mockClient as any, order);

      expect(mockClient.post).toHaveBeenCalledWith('/portfolio/orders', {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 55,
      });
      expect(result.orderId).toBe('ord_123456789');
      expect(result.status).toBe('pending');
      expect(result.side).toBe('yes');
      expect(result.ticker).toBe('KXTRUMPWIN-2024');
      expect(result.count).toBe(10);
      expect(result.price).toBe(55);
    });

    it('should place a sell order successfully', async () => {
      const mockOrder = createMockOrderResponse({
        side: 'no',
        order_id: 'ord_sell_987',
        status: 'open',
        ticker: 'KXBTC-2024',
      });
      mockClient.post.mockResolvedValue({ data: { order: mockOrder } });

      const order: OrderRequest = {
        ticker: 'KXBTC-2024',
        side: 'no',
        count: 5,
        price: 75,
      };

      const result = await executeOrder(mockClient as any, order);

      expect(result.orderId).toBe('ord_sell_987');
      expect(result.status).toBe('open');
      expect(result.side).toBe('no');
      expect(result.ticker).toBe('KXBTC-2024');
    });

    it('should include created timestamp', async () => {
      const mockOrder = createMockOrderResponse();
      mockClient.post.mockResolvedValue({ data: { order: mockOrder } });

      const before = Date.now();
      const result = await executeOrder(mockClient as any, {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 55,
      });
      const after = Date.now();

      const createdAt = new Date(result.createdAt).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(after);
    });

    it('should handle order with status "filled"', async () => {
      const mockOrder = createMockOrderResponse({ status: 'filled' });
      mockClient.post.mockResolvedValue({ data: { order: mockOrder } });

      const result = await executeOrder(mockClient as any, {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 55,
      });

      expect(result.status).toBe('filled');
    });

    it('should handle order with status "rejected"', async () => {
      const mockOrder = createMockOrderResponse({ status: 'rejected' });
      mockClient.post.mockResolvedValue({ data: { order: mockOrder } });

      const result = await executeOrder(mockClient as any, {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 55,
      });

      expect(result.status).toBe('rejected');
    });
  });

  describe('validation errors', () => {
    it('should throw OrderExecutionError for empty ticker', async () => {
      const order: OrderRequest = {
        ticker: '',
        side: 'yes',
        count: 10,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Ticker is required'
      );
    });

    it('should throw OrderExecutionError for whitespace-only ticker', async () => {
      const order: OrderRequest = {
        ticker: '   ',
        side: 'yes',
        count: 10,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Ticker is required'
      );
    });

    it('should throw OrderExecutionError for invalid side', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'maybe' as any,
        count: 10,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        "Invalid side: maybe. Must be 'yes' or 'no'"
      );
    });

    it('should throw OrderExecutionError for missing side', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: '' as any,
        count: 10,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
    });

    it('should throw OrderExecutionError for zero count', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 0,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid count: 0. Must be a positive integer'
      );
    });

    it('should throw OrderExecutionError for negative count', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: -5,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid count: -5. Must be a positive integer'
      );
    });

    it('should throw OrderExecutionError for non-integer count', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 5.5,
        price: 55,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid count: 5.5. Must be a positive integer'
      );
    });

    it('should throw OrderExecutionError for price below 1', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 0,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid price: 0. Must be an integer between 1 and 99 (cents)'
      );
    });

    it('should throw OrderExecutionError for price above 99', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 100,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid price: 100. Must be an integer between 1 and 99 (cents)'
      );
    });

    it('should throw OrderExecutionError for non-integer price', async () => {
      const order: OrderRequest = {
        ticker: 'KXTRUMPWIN-2024',
        side: 'yes',
        count: 10,
        price: 50.5,
      };

      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        OrderExecutionError
      );
      await expect(executeOrder(mockClient as any, order)).rejects.toThrow(
        'Invalid price: 50.5. Must be an integer between 1 and 99 (cents)'
      );
    });
  });

  describe('API error handling', () => {
    it('should throw OrderExecutionError when order data is missing', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow(OrderExecutionError);
      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow('Order failed: No order data returned for KXTRUMPWIN-2024');
    });

    it('should throw OrderExecutionError with BAD_REQUEST code for 400', async () => {
      const error = new Error('Bad Request') as any;
      error.response = {
        status: 400,
        data: { error: { message: 'Insufficient balance' } },
      };
      mockClient.post.mockRejectedValue(error);

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error).toBeInstanceOf(OrderExecutionError);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toContain('Insufficient balance');
        expect(error.ticker).toBe('KXTRUMPWIN-2024');
      }
    });

    it('should throw OrderExecutionError with AUTH_ERROR code for 401', async () => {
      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      mockClient.post.mockRejectedValue(error);

      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow('Authentication failed: Invalid API credentials');

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error.code).toBe('AUTH_ERROR');
      }
    });

    it('should throw OrderExecutionError with FORBIDDEN code for 403', async () => {
      const error = new Error('Forbidden') as any;
      error.response = { status: 403 };
      mockClient.post.mockRejectedValue(error);

      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow('Permission denied: Unable to place order');

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error.code).toBe('FORBIDDEN');
      }
    });

    it('should throw OrderExecutionError with MARKET_NOT_FOUND code for 404', async () => {
      const error = new Error('Not Found') as any;
      error.response = { status: 404 };
      mockClient.post.mockRejectedValue(error);

      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXINVALID',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow('Market not found: KXINVALID');

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXINVALID',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error.code).toBe('MARKET_NOT_FOUND');
      }
    });

    it('should throw OrderExecutionError with RATE_LIMIT code for 429', async () => {
      const error = new Error('Too Many Requests') as any;
      error.response = { status: 429 };
      mockClient.post.mockRejectedValue(error);

      await expect(
        executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        })
      ).rejects.toThrow('Rate limit exceeded: Please try again later');

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error.code).toBe('RATE_LIMIT');
      }
    });

    it('should throw OrderExecutionError with EXECUTION_ERROR code for network errors', async () => {
      mockClient.post.mockRejectedValue(new Error('Network error'));

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error).toBeInstanceOf(OrderExecutionError);
        expect(error.code).toBe('EXECUTION_ERROR');
        expect(error.message).toContain('Network error');
      }
    });
  });

  describe('OrderExecutionError properties', () => {
    it('should include ticker in error', async () => {
      const order: OrderRequest = {
        ticker: '',
        side: 'yes',
        count: 10,
        price: 55,
      };

      try {
        await executeOrder(mockClient as any, order);
      } catch (error: any) {
        expect(error).toBeInstanceOf(OrderExecutionError);
        expect(error.ticker).toBe('');
      }
    });

    it('should include error code when provided', async () => {
      const error = new Error('Bad Request') as any;
      error.response = { status: 400 };
      mockClient.post.mockRejectedValue(error);

      try {
        await executeOrder(mockClient as any, {
          ticker: 'KXTRUMPWIN-2024',
          side: 'yes',
          count: 10,
          price: 55,
        });
      } catch (error: any) {
        expect(error.code).toBe('BAD_REQUEST');
      }
    });
  });
});

describe('formatOrderResponse', () => {
  const createMockResponse = (overrides?: Partial<OrderResponse>): OrderResponse => ({
    orderId: 'ord_123456',
    status: 'pending',
    side: 'yes',
    ticker: 'KXTRUMPWIN-2024',
    count: 10,
    price: 55,
    createdAt: '2024-01-01T12:00:00Z',
    ...overrides,
  });

  it('should format basic order response', () => {
    const response = createMockResponse();
    const formatted = formatOrderResponse(response);

    expect(formatted).toContain('Order Placed Successfully');
    expect(formatted).toContain('Order ID: ord_123456');
    expect(formatted).toContain('Status: pending');
    expect(formatted).toContain('Ticker: KXTRUMPWIN-2024');
    expect(formatted).toContain('Side: YES');
  });

  it('should format order details correctly', () => {
    const response = createMockResponse({
      count: 25,
      price: 60,
    });
    const formatted = formatOrderResponse(response);

    expect(formatted).toContain('Count: 25 contracts');
    expect(formatted).toContain('Price: 60¢ per contract');
    expect(formatted).toContain('Total: 1500¢ ($15.00)');
  });

  it('should calculate total cost correctly', () => {
    const response = createMockResponse({
      count: 100,
      price: 99,
    });
    const formatted = formatOrderResponse(response);

    expect(formatted).toContain('Total: 9900¢ ($99.00)');
  });

  it('should handle no side correctly', () => {
    const response = createMockResponse({ side: 'no' });
    const formatted = formatOrderResponse(response);

    expect(formatted).toContain('Side: NO');
  });

  it('should include timestamp', () => {
    const response = createMockResponse();
    const formatted = formatOrderResponse(response);

    expect(formatted).toContain('Timestamp:');
  });
});
