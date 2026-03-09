/**
 * BTC Trend-Following Strategy for Kalshi
 * Monitors crypto markets and executes trades based on trend signals
 */

import { KalshiClient } from '../core/kalshi-client.js';

export interface StrategyConfig {
  maxPositionSize: number;
  riskRewardRatio: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  minConfidence: number;
  paperMode: boolean;
}

export interface MarketSignal {
  ticker: string;
  title: string;
  direction: 'long' | 'short' | 'none';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  message: string;
  signal?: MarketSignal;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  maxPositionSize: 10,
  riskRewardRatio: 2,
  stopLossPercent: 10,
  takeProfitPercent: 20,
  minConfidence: 60,
  paperMode: true,
};

interface PriceHistory {
  prices: number[];
  timestamps: number[];
}

export class BTCStrategy {
  private client: KalshiClient;
  private config: StrategyConfig;
  private priceHistory: Map<string, PriceHistory> = new Map();

  constructor(client: KalshiClient, config: Partial<StrategyConfig> = {}) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async findCryptoMarkets(): Promise<Array<{ ticker: string; title: string }>> {
    const markets = await this.client.getMarkets();
    
    return markets
      .filter(m => {
        const title = m.title?.toLowerCase() || '';
        const ticker = m.ticker.toLowerCase();
        return (
          title.includes('btc') || 
          title.includes('bitcoin') ||
          title.includes('crypto') ||
          ticker.includes('btc')
        );
      })
      .map(m => ({ ticker: m.ticker, title: m.title }));
  }

  async getCurrentPrice(ticker: string): Promise<number | null> {
    const orderBook = await this.client.getOrderBook(ticker);
    if (!orderBook) return null;
    
    const yesPrice = orderBook.yes_ask;
    const noPrice = orderBook.no_ask;
    
    if (yesPrice && noPrice) {
      return (yesPrice + noPrice) / 2;
    }
    return yesPrice || noPrice || null;
  }

  private async updatePriceHistory(ticker: string): Promise<void> {
    const currentPrice = await this.getCurrentPrice(ticker);
    if (currentPrice === null) return;

    let history = this.priceHistory.get(ticker);
    if (!history) {
      history = { prices: [], timestamps: [] };
      this.priceHistory.set(ticker, history);
    }

    history.prices.push(currentPrice);
    history.timestamps.push(Date.now());

    if (history.prices.length > 50) {
      history.prices.shift();
      history.timestamps.shift();
    }
  }

  private calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const recent = prices.slice(-period);
    let sum = 0;
    for (const p of recent) sum += p;
    return sum / recent.length;
  }

  private calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateVolatility(prices: number[], period: number = 20): number | null {
    if (prices.length < period) return null;
    
    const recent = prices.slice(-period);
    let mean = 0;
    for (const p of recent) mean += p;
    mean = mean / recent.length;
    
    let variance = 0;
    for (const p of recent) {
      variance += Math.pow(p - mean, 2);
    }
    variance = variance / period;
    
    return Math.sqrt(variance);
  }

  async generateSignal(ticker: string, title: string): Promise<MarketSignal | null> {
    await this.updatePriceHistory(ticker);
    
    const history = this.priceHistory.get(ticker);
    if (!history || history.prices.length < 20) {
      console.log(`[BTC Strategy] Not enough data for ${ticker} (${history?.prices.length || 0} prices)`);
      return null;
    }

    const prices = history.prices;
    const currentPrice = prices[prices.length - 1];
    
    const sma9 = this.calculateSMA(prices, 9);
    const sma21 = this.calculateSMA(prices, 21);
    const rsi = this.calculateRSI(prices);
    const volatility = this.calculateVolatility(prices);

    if (!sma9 || !sma21 || !rsi || !volatility) {
      return null;
    }

    let direction: 'long' | 'short' | 'none' = 'none';
    let confidence = 0;
    const reasons: string[] = [];

    if (sma9 > sma21 * 1.02) {
      direction = 'long';
      confidence += 30;
      reasons.push('SMA 9 > SMA 21 (uptrend)');
    } else if (sma9 < sma21 * 0.98) {
      direction = 'short';
      confidence += 30;
      reasons.push('SMA 9 < SMA 21 (downtrend)');
    }

    if (rsi < 35) {
      if (direction === 'long') confidence += 25;
      reasons.push(`RSI oversold (${rsi.toFixed(1)})`);
    } else if (rsi > 65) {
      if (direction === 'short') confidence += 25;
      reasons.push(`RSI overbought (${rsi.toFixed(1)})`);
    }

    const recentVolatility = this.calculateVolatility(prices, 5) || 0;
    if (recentVolatility > volatility * 1.5) {
      confidence += 20;
      reasons.push('Volatility breakout detected');
    }

    const momentum = prices[prices.length - 1] - prices[prices.length - 5];
    if (direction === 'long' && momentum > 0) {
      confidence += 15;
      reasons.push('Positive momentum');
    } else if (direction === 'short' && momentum < 0) {
      confidence += 15;
      reasons.push('Negative momentum');
    }

    if (confidence < this.config.minConfidence) {
      return null;
    }

    const stopLossPercent = this.config.stopLossPercent / 100;
    const takeProfitPercent = this.config.takeProfitPercent / 100;
    
    const stopLoss = direction === 'long'
      ? currentPrice * (1 - stopLossPercent)
      : currentPrice * (1 + stopLossPercent);
    
    const takeProfit = direction === 'long'
      ? currentPrice * (1 + takeProfitPercent * this.config.riskRewardRatio)
      : currentPrice * (1 - takeProfitPercent * this.config.riskRewardRatio);

    return {
      ticker,
      title,
      direction,
      confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reason: reasons.join('; '),
    };
  }

  async executeTrade(signal: MarketSignal): Promise<TradeResult> {
    if (this.config.paperMode) {
      console.log(`[BTC Strategy] PAPER MODE: Would execute ${signal.direction} on ${signal.ticker}`);
      console.log(`  Entry: ${signal.entryPrice}, Stop: ${signal.stopLoss}, Target: ${signal.takeProfit}`);
      return {
        success: true,
        message: `Paper trade: ${signal.direction.toUpperCase()} ${signal.ticker} at ${signal.entryPrice}`,
        signal,
      };
    }

    const side = signal.direction === 'long' ? 'yes' : 'no';

    const result = await this.client.placeOrder({
      ticker: signal.ticker,
      side,
      count: this.config.maxPositionSize,
      price: Math.round(signal.entryPrice),
    });

    if (result.success) {
      console.log(`[BTC Strategy] Executed ${side} on ${signal.ticker}, order ID: ${result.orderId}`);
    } else {
      console.error(`[BTC Strategy] Trade failed: ${result.error}`);
    }

    return {
      success: result.success,
      orderId: result.orderId,
      message: result.success 
        ? `Executed ${side} on ${signal.ticker}`
        : `Trade failed: ${result.error}`,
      signal,
    };
  }

  async run(): Promise<TradeResult[]> {
    const results: TradeResult[] = [];
    
    console.log('\n=== BTC Strategy Iteration ===');
    
    const cryptoMarkets = await this.findCryptoMarkets();
    console.log(`Found ${cryptoMarkets.length} crypto markets`);
    
    if (cryptoMarkets.length === 0) {
      console.log('[BTC Strategy] No crypto markets available');
      return results;
    }

    for (const market of cryptoMarkets) {
      const signal = await this.generateSignal(market.ticker, market.title);
      
      if (signal) {
        console.log(`\n[Signal] ${signal.ticker}: ${signal.direction.toUpperCase()} (confidence: ${signal.confidence}%)`);
        console.log(`  Reason: ${signal.reason}`);
        
        const result = await this.executeTrade(signal);
        results.push(result);
      }
    }

    return results;
  }

  async getPositions() {
    return this.client.getPositions();
  }

  async getBalance() {
    return this.client.getBalance();
  }
}

export async function runBTCStrategy(paperMode: boolean = true): Promise<void> {
  const client = new KalshiClient({
    keyPath: process.env.KALSHI_KEY_PATH || './kalshi_key.pem',
    keyId: process.env.KALSHI_KEY_ID || 'ff721a25-d41f-47aa-a52a-3ff34667333b',
  });

  const auth = await client.authenticate();
  if (!auth) {
    console.error('Failed to authenticate with Kalshi');
    process.exit(1);
  }

  console.log('Authenticated with Kalshi');

  const strategy = new BTCStrategy(client, {
    paperMode,
    maxPositionSize: 10,
    riskRewardRatio: 2,
    stopLossPercent: 10,
    takeProfitPercent: 20,
    minConfidence: 60,
  });

  const results = await strategy.run();
  
  console.log(`\n=== Summary ===`);
  console.log(`Trades executed: ${results.length}`);
  
  const balance = await strategy.getBalance();
  console.log(`Account balance: $${balance.balance}`);
}
