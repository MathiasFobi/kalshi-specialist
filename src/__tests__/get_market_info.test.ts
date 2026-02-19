/**
 * Market Lookup Tool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMarketInfo,
  formatMarketInfo,
  MarketLookupError,
  MarketInfo,
  MarketInfoResponse,
} from '../cli/get_market_info.js';

// Mock the client module
vi.mock('../client.js', () => ({
  KalshiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
  })),
}));

import { KalshiClient } from '../client.js';

describe('getMarketInfo', () => {
  let mockClient: { get: any };

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockMarket = (overrides?: Partial<MarketInfo>): any => ({
    ticker: 'KXTRUMPWIN-2024',
    title: 'Will Trump win the 2024 election?',
    yes_ask: 55,
    no_ask: 45,
    yes_bid: 54,
    no_bid: 44,
    volume: 1000000,
    open_interest: 500000,
    status: 'open',
    close_time: '2024-11-05T23:59:59Z',
    settlement_value: undefined,
    description: 'Test market description',
    // Note: category is computed from title/ticker, not from API response
    ...overrides,
  });

  describe('success cases', () => {
    it('should return market info for valid ticker', async () => {
      const mockMarket = createMockMarket();
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTRUMPWIN-2024');

      expect(mockClient.get).toHaveBeenCalledWith('/markets/KXTRUMPWIN-2024');
      expect(result.market.ticker).toBe('KXTRUMPWIN-2024');
      expect(result.market.title).toBe('Will Trump win the 2024 election?');
      expect(result.market.status).toBe('open');
    });

    it('should map all market fields correctly', async () => {
      const mockMarket = createMockMarket({
        ticker: 'KXBTC-2024',
        title: 'Will Bitcoin hit $100k?',
        yes_ask: 65,
        no_ask: 35,
        yes_bid: 64,
        no_bid: 34,
        volume: 500000,
        open_interest: 250000,
        status: 'closed',
        close_time: '2024-12-31T23:59:59Z',
        settlement_value: 100,
      });
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXBTC-2024');

      expect(result.market.yes_ask).toBe(65);
      expect(result.market.no_ask).toBe(35);
      expect(result.market.yes_bid).toBe(64);
      expect(result.market.no_bid).toBe(34);
      expect(result.market.volume).toBe(500000);
      expect(result.market.open_interest).toBe(250000);
      expect(result.market.status).toBe('closed');
      expect(result.market.settlement_value).toBe(100);
    });

    it('should include retrieval timestamp', async () => {
      const mockMarket = createMockMarket();
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const before = Date.now();
      const result = await getMarketInfo(mockClient as any, 'KXTRUMPWIN-2024');
      const after = Date.now();

      const retrievedAt = new Date(result.retrievedAt).getTime();
      expect(retrievedAt).toBeGreaterThanOrEqual(before);
      expect(retrievedAt).toBeLessThanOrEqual(after);
    });

    it('should handle markets with missing optional fields', async () => {
      const mockMarket = {
        ticker: 'KXMINIMAL',
        title: 'Minimal market',
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXMINIMAL');

      expect(result.market.yes_ask).toBe(0);
      expect(result.market.no_ask).toBe(0);
      expect(result.market.yes_bid).toBe(0);
      expect(result.market.no_bid).toBe(0);
      expect(result.market.volume).toBe(0);
      expect(result.market.open_interest).toBe(0);
      expect(result.market.close_time).toBeUndefined();
      expect(result.market.settlement_value).toBeUndefined();
    });

    it('should infer politics category from title', async () => {
      const mockMarket = {
        ticker: 'KXTEST',
        title: 'Will Trump win?',
        yes_ask: 55,
        no_ask: 45,
        yes_bid: 54,
        no_bid: 44,
        volume: 1000000,
        open_interest: 500000,
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTEST');
      expect(result.market.category).toBe('politics');
    });

    it('should infer crypto category from title', async () => {
      const mockMarket = {
        ticker: 'KXTEST',
        title: 'Will Bitcoin hit $100k?',
        yes_ask: 55,
        no_ask: 45,
        yes_bid: 54,
        no_bid: 44,
        volume: 1000000,
        open_interest: 500000,
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTEST');
      expect(result.market.category).toBe('crypto');
    });

    it('should infer sports category from title', async () => {
      const mockMarket = {
        ticker: 'KXTEST',
        title: 'Will Lakers win NBA championship?',
        yes_ask: 55,
        no_ask: 45,
        yes_bid: 54,
        no_bid: 44,
        volume: 1000000,
        open_interest: 500000,
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTEST');
      expect(result.market.category).toBe('sports');
    });

    it('should infer weather category from title', async () => {
      const mockMarket = {
        ticker: 'KXTEST',
        title: 'Will it be cold weather tomorrow?',
        yes_ask: 55,
        no_ask: 45,
        yes_bid: 54,
        no_bid: 44,
        volume: 1000000,
        open_interest: 500000,
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTEST');
      expect(result.market.category).toBe('weather');
    });

    it('should infer econ category from title', async () => {
      const mockMarket = {
        ticker: 'KXTEST',
        title: 'Will CPI exceed 3%?',
        yes_ask: 55,
        no_ask: 45,
        yes_bid: 54,
        no_bid: 44,
        volume: 1000000,
        open_interest: 500000,
        status: 'open',
      };
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXTEST');
      expect(result.market.category).toBe('econ');
    });

    it('should default to other category when no pattern matches', async () => {
      const mockMarket = createMockMarket({
        title: 'Some random market',
        ticker: 'KXGENERIC',
      });
      mockClient.get.mockResolvedValue({ data: { market: mockMarket } });

      const result = await getMarketInfo(mockClient as any, 'KXGENERIC');
      expect(result.market.category).toBe('other');
    });
  });

  describe('error handling', () => {
    it('should throw MarketLookupError for empty ticker', async () => {
      await expect(getMarketInfo(mockClient as any, '')).rejects.toThrow(
        MarketLookupError
      );
      await expect(getMarketInfo(mockClient as any, '')).rejects.toThrow(
        'Ticker is required'
      );
    });

    it('should throw MarketLookupError for whitespace-only ticker', async () => {
      await expect(getMarketInfo(mockClient as any, '   ')).rejects.toThrow(
        MarketLookupError
      );
    });

    it('should throw MarketLookupError when market not found (404)', async () => {
      const error = new Error('Not found') as any;
      error.response = { status: 404 };
      mockClient.get.mockRejectedValue(error);

      await expect(getMarketInfo(mockClient as any, 'KXINVALID')).rejects.toThrow(
        MarketLookupError
      );
      await expect(getMarketInfo(mockClient as any, 'KXINVALID')).rejects.toThrow(
        'Market not found: KXINVALID'
      );
    });

    it('should throw MarketLookupError when market data is missing', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      await expect(getMarketInfo(mockClient as any, 'KXEMPTY')).rejects.toThrow(
        'Market not found: KXEMPTY'
      );
    });

    it('should throw MarketLookupError with ticker in error', async () => {
      mockClient.get.mockResolvedValue({ data: {} });

      try {
        await getMarketInfo(mockClient as any, 'KXBAD');
      } catch (error: any) {
        expect(error).toBeInstanceOf(MarketLookupError);
        expect(error.ticker).toBe('KXBAD');
      }
    });

    it('should wrap other errors as MarketLookupError', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(getMarketInfo(mockClient as any, 'KXFAIL')).rejects.toThrow(
        MarketLookupError
      );
      await expect(getMarketInfo(mockClient as any, 'KXFAIL')).rejects.toThrow(
        'Failed to fetch market info: Network error'
      );
    });
  });
});

describe('formatMarketInfo', () => {
  const createMockResponse = (overrides?: Partial<MarketInfo>): MarketInfoResponse => ({
    market: {
      ticker: 'KXTEST',
      title: 'Test Market',
      category: 'politics',
      yes_ask: 55,
      no_ask: 45,
      yes_bid: 54,
      no_bid: 44,
      volume: 1000000,
      open_interest: 500000,
      status: 'open',
      close_time: '2024-11-05T23:59:59Z',
      settlement_value: undefined,
      description: 'Test description',
      ...overrides,
    } as MarketInfo,
    retrievedAt: '2024-01-01T12:00:00Z',
  });

  it('should format basic market info', () => {
    const response = createMockResponse();
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Ticker: KXTEST');
    expect(formatted).toContain('Title: Test Market');
    expect(formatted).toContain('Category: politics');
    expect(formatted).toContain('Status: open');
  });

  it('should format prices correctly', () => {
    const response = createMockResponse();
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Yes: bid=54¢ ask=55¢');
    expect(formatted).toContain('No:  bid=44¢ ask=45¢');
  });

  it('should format volume with locale', () => {
    const response = createMockResponse({ volume: 1234567 });
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Volume: 1,234,567 contracts');
  });

  it('should include close time when present', () => {
    const response = createMockResponse();
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Closes:');
  });

  it('should include settlement value when present', () => {
    const response = createMockResponse({ settlement_value: 100 });
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Settlement Value: 100');
  });

  it('should not include settlement value when undefined', () => {
    const response = createMockResponse({ settlement_value: undefined });
    const formatted = formatMarketInfo(response);

    expect(formatted).not.toContain('Settlement Value');
  });

  it('should include retrieval timestamp', () => {
    const response = createMockResponse();
    const formatted = formatMarketInfo(response);

    expect(formatted).toContain('Retrieved:');
  });
});
