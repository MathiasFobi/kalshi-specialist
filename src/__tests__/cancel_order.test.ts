/**
 * Order Cancellation Tool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cancelOrder,
  formatCancelOrderResponse,
  CancelOrderError,
} from '../cli/cancel_order.js';

// Mock the client module
vi.mock('../client.js', () => ({
  KalshiClient: vi.fn().mockImplementation(() => ({
    delete: vi.fn(),
  })),
}));

import { KalshiClient } from '../client.js';

describe('cancelOrder', () => {
  let mockClient: { delete: any };

  beforeEach(() => {
    mockClient = {
      delete: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('success cases', () => {
    it('should cancel an order successfully', async () => {
      mockClient.delete.mockResolvedValue({
        data: {
          order_id: 'ord_123456789',
          status: 'cancelled',
          message: 'Order cancelled successfully',
        },
      });

      const result = await cancelOrder(mockClient as any, 'ord_123456789');

      expect(mockClient.delete).toHaveBeenCalledWith('/portfolio/orders/ord_123456789');
      expect(result.orderId).toBe('ord_123456789');
      expect(result.status).toBe('cancelled');
      expect(result.message).toBe('Order cancelled successfully');
    });

    it('should handle order with status "canceled" (spelling variant)', async () => {
      mockClient.delete.mockResolvedValue({
        data: {
          order_id: 'ord_987654321',
          status: 'canceled',
          message: 'Order canceled',
        },
      });

      const result = await cancelOrder(mockClient as any, 'ord_987654321');

      expect(result.orderId).toBe('ord_987654321');
      expect(result.status).toBe('canceled');
    });

    it('should use order ID from parameter if not in response', async () => {
      mockClient.delete.mockResolvedValue({
        data: {
          status: 'cancelled',
        },
      });

      const result = await cancelOrder(mockClient as any, 'ord_custom_id');

      expect(result.orderId).toBe('ord_custom_id');
      expect(result.status).toBe('cancelled');
    });

    it('should handle different order ID formats', async () => {
      mockClient.delete.mockResolvedValue({
        data: {
          order_id: 'order_abc_123_xyz',
          status: 'cancelled',
        },
      });

      const result = await cancelOrder(mockClient as any, 'order_abc_123_xyz');

      expect(result.orderId).toBe('order_abc_123_xyz');
    });
  });

  describe('validation errors', () => {
    it('should throw CancelOrderError for empty order ID', async () => {
      await expect(cancelOrder(mockClient as any, '')).rejects.toThrow(
        CancelOrderError
      );
      await expect(cancelOrder(mockClient as any, '')).rejects.toThrow(
        'Order ID is required'
      );
    });

    it('should throw CancelOrderError for whitespace-only order ID', async () => {
      await expect(cancelOrder(mockClient as any, '   ')).rejects.toThrow(
        CancelOrderError
      );
      await expect(cancelOrder(mockClient as any, '   ')).rejects.toThrow(
        'Order ID is required'
      );
    });

    it('should throw CancelOrderError with BAD_REQUEST code for empty order ID', async () => {
      try {
        await cancelOrder(mockClient as any, '');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CancelOrderError);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.orderId).toBe('');
      }
    });
  });

  describe('API error handling', () => {
    it('should throw CancelOrderError with BAD_REQUEST code for 400', async () => {
      const error = new Error('Bad Request') as any;
      error.response = {
        status: 400,
        data: { error: { message: 'Invalid order ID format' } },
      };
      mockClient.delete.mockRejectedValue(error);

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CancelOrderError);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toContain('Invalid order ID format');
        expect(error.orderId).toBe('ord_123');
      }
    });

    it('should throw CancelOrderError with AUTH_ERROR code for 401', async () => {
      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Authentication failed: Invalid API credentials');

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error.code).toBe('AUTH_ERROR');
      }
    });

    it('should throw CancelOrderError with FORBIDDEN code for 403', async () => {
      const error = new Error('Forbidden') as any;
      error.response = { status: 403 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Permission denied: Unable to cancel order');

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error.code).toBe('FORBIDDEN');
      }
    });

    it('should throw CancelOrderError with ORDER_NOT_FOUND code for 404', async () => {
      const error = new Error('Not Found') as any;
      error.response = { status: 404 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_notfound')
      ).rejects.toThrow('Order not found: ord_notfound');

      try {
        await cancelOrder(mockClient as any, 'ord_notfound');
      } catch (error: any) {
        expect(error.code).toBe('ORDER_NOT_FOUND');
        expect(error.orderId).toBe('ord_notfound');
      }
    });

    it('should throw CancelOrderError with ALREADY_CLOSED code for 409', async () => {
      const error = new Error('Conflict') as any;
      error.response = {
        status: 409,
        data: { error: { message: 'Order already filled' } },
    };
    mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Conflict: Order already filled');

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error.code).toBe('ALREADY_CLOSED');
      }
    });

    it('should throw CancelOrderError with default message for 409 without message', async () => {
      const error = new Error('Conflict') as any;
      error.response = { status: 409 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Conflict: Order cannot be cancelled');
    });

    it('should throw CancelOrderError with RATE_LIMIT code for 429', async () => {
      const error = new Error('Too Many Requests') as any;
      error.response = { status: 429 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Rate limit exceeded: Please try again later');

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error.code).toBe('RATE_LIMIT');
      }
    });

    it('should throw CancelOrderError with CANCEL_ERROR code for network errors', async () => {
      mockClient.delete.mockRejectedValue(new Error('Network error'));

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CancelOrderError);
        expect(error.code).toBe('CANCEL_ERROR');
        expect(error.message).toContain('Network error');
      }
    });

    it('should throw CancelOrderError with default message for 400 without message', async () => {
      const error = new Error('Bad Request') as any;
      error.response = { status: 400 };
      mockClient.delete.mockRejectedValue(error);

      await expect(
        cancelOrder(mockClient as any, 'ord_123')
      ).rejects.toThrow('Bad request: Invalid order ID');
    });
  });

  describe('CancelOrderError properties', () => {
    it('should include orderId in error', async () => {
      const orderId = 'ord_test_123';

      try {
        await cancelOrder(mockClient as any, orderId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(CancelOrderError);
        expect(error.orderId).toBe(orderId);
      }
    });

    it('should include error code when provided', async () => {
      const error = new Error('Bad Request') as any;
      error.response = { status: 400 };
      mockClient.delete.mockRejectedValue(error);

      try {
        await cancelOrder(mockClient as any, 'ord_123');
      } catch (error: any) {
        expect(error.code).toBe('BAD_REQUEST');
      }
    });
  });
});

describe('formatCancelOrderResponse', () => {
  it('should format basic cancel response', () => {
    const response = {
      orderId: 'ord_123456',
      status: 'cancelled',
      message: 'Order cancelled successfully',
    };
    const formatted = formatCancelOrderResponse(response);

    expect(formatted).toContain('Order Cancelled Successfully');
    expect(formatted).toContain('Order ID: ord_123456');
    expect(formatted).toContain('Status: cancelled');
    expect(formatted).toContain('Message: Order cancelled successfully');
  });

  it('should handle different order IDs', () => {
    const response = {
      orderId: 'ord_abc_xyz_789',
      status: 'canceled',
      message: 'Order was canceled',
    };
    const formatted = formatCancelOrderResponse(response);

    expect(formatted).toContain('Order ID: ord_abc_xyz_789');
    expect(formatted).toContain('Status: canceled');
  });

  it('should handle different status values', () => {
    const response = {
      orderId: 'ord_123',
      status: 'pending_cancellation',
      message: 'Cancellation pending',
    };
    const formatted = formatCancelOrderResponse(response);

    expect(formatted).toContain('Status: pending_cancellation');
    expect(formatted).toContain('Message: Cancellation pending');
  });
});
