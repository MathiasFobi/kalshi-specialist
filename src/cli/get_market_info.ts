/**
 * Market Lookup Tool
 * Look up market information by ticker using Kalshi V2 API
 */

import { KalshiClient } from '../client.js';

export interface MarketInfo {
  ticker: string;
  title: string;
  category: string;
  yes_ask: number;
  no_ask: number;
  yes_bid: number;
  no_bid: number;
  volume: number;
  open_interest: number;
  status: string;
  close_time?: string;
  settlement_value?: number;
  description?: string;
}

export interface MarketInfoResponse {
  market: MarketInfo;
  retrievedAt: string;
}

export class MarketLookupError extends Error {
  constructor(message: string, public ticker: string) {
    super(message);
    this.name = 'MarketLookupError';
  }
}

/**
 * Get market information by ticker
 * @param client - KalshiClient instance
 * @param ticker - Market ticker symbol (e.g., "KXTRUMPWIN-2024")
 * @returns MarketInfoResponse with market data
 */
export async function getMarketInfo(
  client: KalshiClient,
  ticker: string
): Promise<MarketInfoResponse> {
  if (!ticker || ticker.trim() === '') {
    throw new MarketLookupError('Ticker is required', ticker);
  }

  try {
    // Use the Kalshi V2 /markets/{ticker} endpoint
    const response = await client.get<any>(`/markets/${ticker}`);
    const marketData = response.data.market;

    if (!marketData) {
      throw new MarketLookupError(`Market not found: ${ticker}`, ticker);
    }

    // Map the Kalshi API response to our MarketInfo interface
    const market: MarketInfo = {
      ticker: marketData.ticker,
      title: marketData.title || marketData.ticker,
      category: inferCategory(marketData.title, marketData.ticker),
      yes_ask: marketData.yes_ask ?? 0,
      no_ask: marketData.no_ask ?? 0,
      yes_bid: marketData.yes_bid ?? 0,
      no_bid: marketData.no_bid ?? 0,
      volume: marketData.volume || 0,
      open_interest: marketData.open_interest || 0,
      status: marketData.status || 'unknown',
      close_time: marketData.close_time,
      settlement_value: marketData.settlement_value,
      description: marketData.description,
    };

    return {
      market,
      retrievedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new MarketLookupError(`Market not found: ${ticker}`, ticker);
    }
    if (error instanceof MarketLookupError) {
      throw error;
    }
    throw new MarketLookupError(
      `Failed to fetch market info: ${error.message || 'Unknown error'}`,
      ticker
    );
  }
}

/**
 * Infer category from title and ticker
 */
function inferCategory(title: string, ticker: string): string {
  const titleLower = (title || '').toLowerCase();
  const tickerLower = (ticker || '').toLowerCase();

  if (titleLower.includes('mention') || tickerLower.includes('mention')) {
    return 'mentions';
  }
  if (titleLower.includes('weather') || tickerLower.includes('weather')) {
    return 'weather';
  }
  if (titleLower.includes('crypto') || titleLower.includes('btc') || titleLower.includes('eth') || titleLower.includes('bitcoin')) {
    return 'crypto';
  }
  if (titleLower.includes('econom') || titleLower.includes('econ') || titleLower.includes('fed') || titleLower.includes('cpi')) {
    return 'econ';
  }
  if (titleLower.includes('sport') || titleLower.includes('nba') || titleLower.includes('nfl')) {
    return 'sports';
  }
  if (titleLower.includes('politic') || titleLower.includes('trump') || titleLower.includes('biden')) {
    return 'politics';
  }

  return 'other';
}

/**
 * Format market info for CLI output
 */
export function formatMarketInfo(response: MarketInfoResponse): string {
  const m = response.market;
  const lines: string[] = [
    `Ticker: ${m.ticker}`,
    `Title: ${m.title}`,
    `Category: ${m.category}`,
    `Status: ${m.status}`,
    ``,
    `PRICES:`,
    `  Yes: bid=${m.yes_bid}¢ ask=${m.yes_ask}¢`,
    `  No:  bid=${m.no_bid}¢ ask=${m.no_ask}¢`,
    ``,
    `VOLUME:`,
    `  Volume: ${m.volume.toLocaleString()} contracts`,
    `  Open Interest: ${m.open_interest.toLocaleString()}`,
  ];

  if (m.close_time) {
    lines.push(`  Closes: ${new Date(m.close_time).toLocaleString()}`);
  }

  if (m.settlement_value !== undefined) {
    lines.push(`  Settlement Value: ${m.settlement_value}`);
  }

  lines.push(`  Retrieved: ${new Date(response.retrievedAt).toLocaleString()}`);

  return lines.join('\n');
}

/**
 * CLI entry point for getting market info
 */
export async function getMarketInfoCLI(
  client: KalshiClient,
  ticker: string
): Promise<void> {
  const response = await getMarketInfo(client, ticker);
  console.log(formatMarketInfo(response));
}
