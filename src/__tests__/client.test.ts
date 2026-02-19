/**
 * KalshiClient Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KalshiClient, KalshiClientConfig, KalshiStatus } from '../client.js';

// Mock axios
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(),
    },
  };
});

// Mock auth module
vi.mock('../auth.js', () => ({
  loadPrivateKey: vi.fn(() => '-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----'),
  signRequest: vi.fn(() => ({
    'KALSHI-ACCESS-KEY': 'test-key-id',
    'KALSHI-ACCESS-SIGNATURE': 'mock-signature-base64',
    'KALSHI-ACCESS-TIMESTAMP': '1234567890',
  })),
}));

import axios from 'axios';

describe('KalshiClient', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      defaults: { baseURL: '' },
    };
    (axios.create as any).mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createConfig = (env: 'demo' | 'prod' = 'demo'): KalshiClientConfig => ({
    environment: env,
    keyId: 'test-key-id',
    privateKeyPath: '/tmp/test-key.pem',
  });

  const createMockAxios = (baseURL: string) => {
    mockAxiosInstance.defaults.baseURL = baseURL;
    (axios.create as any).mockReturnValue(mockAxiosInstance);
  };

  describe('environment configuration', () => {
    it('should use demo API URL for demo environment', () => {
      createMockAxios('https://demo-api.kalshi.com/v2');
      
      const client = new KalshiClient(createConfig('demo'));
      expect(client.getEnvironment()).toBe('demo');
      expect(client.getBaseURL()).toBe('https://demo-api.kalshi.com/v2');
    });

    it('should use production API URL for prod environment', () => {
      createMockAxios('https://trading-api.kalshi.com/v2');
      
      const client = new KalshiClient(createConfig('prod'));
      expect(client.getEnvironment()).toBe('prod');
      expect(client.getBaseURL()).toBe('https://trading-api.kalshi.com/v2');
    });

    it('should have correct axios baseURL for demo', () => {
      createMockAxios('https://demo-api.kalshi.com/v2');
      
      const client = new KalshiClient(createConfig('demo'));
      expect(client.getBaseURL()).toBe('https://demo-api.kalshi.com/v2');
    });

    it('should have correct axios baseURL for prod', () => {
      createMockAxios('https://trading-api.kalshi.com/v2');
      
      const client = new KalshiClient(createConfig('prod'));
      expect(client.getBaseURL()).toBe('https://trading-api.kalshi.com/v2');
    });
  });

  describe('getStatus', () => {
    it('should call status endpoint without authentication', async () => {
      const mockStatus: KalshiStatus = { status: 'ok', timestamp: '1234567890' };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const client = new KalshiClient(createConfig('demo'));
      const result = await client.getStatus();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/status');
      expect(result).toEqual(mockStatus);
    });

    it('should return status data from response', async () => {
      const mockStatus: KalshiStatus = { 
        status: 'healthy', 
        version: 'v2.0',
        uptime: '99.9%' 
      };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const client = new KalshiClient(createConfig('demo'));
      const result = await client.getStatus();

      expect(result.status).toBe('healthy');
      expect(result.version).toBe('v2.0');
    });

    it('should work with demo environment', async () => {
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });

      const client = new KalshiClient(createConfig('demo'));
      await client.getStatus();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://demo-api.kalshi.com/v2',
        timeout: 30000,
      });
    });

    it('should work with prod environment', async () => {
      mockAxiosInstance.defaults.baseURL = 'https://trading-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });

      const client = new KalshiClient(createConfig('prod'));
      await client.getStatus();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://trading-api.kalshi.com/v2',
        timeout: 30000,
      });
    });
  });

  describe('authenticated GET requests', () => {
    it('should add authentication headers to GET request', async () => {
      const mockResponse = { data: { balance: 10000 } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.get('/portfolio/balance');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/portfolio/balance',
        expect.objectContaining({
          headers: expect.objectContaining({
            'KALSHI-ACCESS-KEY': 'test-key-id',
            'KALSHI-ACCESS-SIGNATURE': 'mock-signature-base64',
            'KALSHI-ACCESS-TIMESTAMP': '1234567890',
          }),
          params: undefined,
        })
      );
    });

    it('should include query params in URL for signing', async () => {
      const mockResponse = { data: { positions: [] } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const { signRequest } = await import('../auth.js');
      const client = new KalshiClient(createConfig('demo'));
      await client.get('/markets', { limit: '10', cursor: 'abc123' });

      // The path passed to signRequest should include query string
      expect(signRequest).toHaveBeenCalledWith(
        'GET',
        '/markets?limit=10&cursor=abc123',
        expect.any(String),
        'test-key-id',
        undefined
      );
    });

    it('should return response data', async () => {
      const mockData = { balance: 50000, available: 45000 };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const client = new KalshiClient(createConfig('demo'));
      const response = await client.getBalance();

      expect(response.data).toEqual(mockData);
    });
  });

  describe('authenticated POST requests', () => {
    it('should add authentication headers to POST request', async () => {
      const mockResponse = { data: { order_id: 'order-123' } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.post('/portfolio/orders', { market_id: 'MARKET-123', side: 'yes' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/portfolio/orders',
        { market_id: 'MARKET-123', side: 'yes' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'KALSHI-ACCESS-KEY': 'test-key-id',
            'KALSHI-ACCESS-SIGNATURE': 'mock-signature-base64',
            'KALSHI-ACCESS-TIMESTAMP': '1234567890',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should sign POST request with body', async () => {
      const mockResponse = { data: {} };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const { signRequest } = await import('../auth.js');
      const client = new KalshiClient(createConfig('demo'));
      const body = { market_id: 'MARKET-123', amount: 100 };
      await client.post('/portfolio/orders', body);

      expect(signRequest).toHaveBeenCalledWith(
        'POST',
        '/portfolio/orders',
        expect.any(String),
        'test-key-id',
        JSON.stringify(body)
      );
    });
  });

  describe('authenticated PUT requests', () => {
    it('should add authentication headers to PUT request', async () => {
      const mockResponse = { data: { success: true } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.put('/portfolio/orders/order-123', { status: 'cancelled' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/portfolio/orders/order-123',
        { status: 'cancelled' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should sign PUT request with body', async () => {
      const mockResponse = { data: {} };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const { signRequest } = await import('../auth.js');
      const client = new KalshiClient(createConfig('demo'));
      const body = { status: 'cancelled' };
      await client.put('/portfolio/orders/order-123', body);

      expect(signRequest).toHaveBeenCalledWith(
        'PUT',
        '/portfolio/orders/order-123',
        expect.any(String),
        'test-key-id',
        JSON.stringify(body)
      );
    });
  });

  describe('authenticated DELETE requests', () => {
    it('should add authentication headers to DELETE request', async () => {
      const mockResponse = { data: { deleted: true } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.delete('/portfolio/orders/order-123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/portfolio/orders/order-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'KALSHI-ACCESS-KEY': 'test-key-id',
            'KALSHI-ACCESS-SIGNATURE': 'mock-signature-base64',
            'KALSHI-ACCESS-TIMESTAMP': '1234567890',
          }),
        })
      );
    });

    it('should sign DELETE request with just the URL path', async () => {
      const mockResponse = { data: {} };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const { signRequest } = await import('../auth.js');
      const client = new KalshiClient(createConfig('demo'));
      await client.delete('/portfolio/orders/order-123');

      expect(signRequest).toHaveBeenCalledWith(
        'DELETE',
        '/portfolio/orders/order-123',
        expect.any(String),
        'test-key-id',
        undefined
      );
    });
  });

  describe('convenience methods', () => {
    it('should call getBalance with correct path', async () => {
      const mockResponse = { data: { balance: 10000 } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.getBalance();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/portfolio/balance',
        expect.any(Object)
      );
    });

    it('should call getPositions with correct path', async () => {
      const mockResponse = { data: { positions: [] } };
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const client = new KalshiClient(createConfig('demo'));
      await client.getPositions();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/portfolio/positions',
        expect.any(Object)
      );
    });
  });

  describe('lazy key loading', () => {
    it('should not load key on construction', async () => {
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      
      const { loadPrivateKey } = await import('../auth.js');
      
      new KalshiClient(createConfig('demo'));
      
      expect(loadPrivateKey).not.toHaveBeenCalled();
    });

    it('should load key on first authenticated request', async () => {
      const { loadPrivateKey } = await import('../auth.js');
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const client = new KalshiClient(createConfig('demo'));
      await client.get('/test');

      expect(loadPrivateKey).toHaveBeenCalledWith('/tmp/test-key.pem');
    });

    it('should cache key for subsequent requests', async () => {
      const { loadPrivateKey } = await import('../auth.js');
      mockAxiosInstance.defaults.baseURL = 'https://demo-api.kalshi.com/v2';
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const client = new KalshiClient(createConfig('demo'));
      await client.get('/test1');
      await client.get('/test2');

      expect(loadPrivateKey).toHaveBeenCalledTimes(1);
    });
  });
});
