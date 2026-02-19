/**
 * Kalshi API Client - Production-grade with RSA-SHA256 signing
 * Matches the implementation in ultimate-dashboard/api/kalshi/prod/route.ts
 */

import axios from 'axios';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface KalshiCredentials {
  keyPath: string;
  keyId: string;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  yes_ask: number;
  no_ask: number;
  volume: number;
  close_time?: string;
  status?: string;
  [key: string]: any;
}

export interface KalshiBalance {
  balance: number;
  available_balance?: number;
  total_balance?: number;
}

export interface KalshiOrder {
  order_id?: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy';
  count: number;
  type: 'limit';
  yes_price?: number;
  no_price?: number;
  status?: string;
}

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export class KalshiClient {
  private credentials: KalshiCredentials;
  private privateKey?: string;
  
  constructor(credentials: KalshiCredentials) {
    this.credentials = credentials;
    this.loadKey();
  }
  
  /**
   * Load private key from file
   */
  private loadKey(): void {
    try {
      this.privateKey = fs.readFileSync(this.credentials.keyPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to load Kalshi key from ${this.credentials.keyPath}`);
    }
  }
  
  /**
   * Generate RSA-SHA256 signature for Kalshi API
   */
  private generateSignature(method: string, path: string, timestampMs: string): string {
    if (!this.privateKey) {
      throw new Error('Private key not loaded');
    }
    
    // Kalshi format: timestamp + method + path (no query params)
    const pathWithoutQuery = path.split('?')[0];
    const message = `${timestampMs}${method}${pathWithoutQuery}`;
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();
    
    // RSA-PSS padding as per Kalshi docs
    return sign.sign({
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, 'base64');
  }
  
  /**
   * Make authenticated request to Kalshi API
   */
  private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    const timestampMs = Date.now().toString();
    const path = `/trade-api/v2${endpoint}`;
    const signature = this.generateSignature(method, path, timestampMs);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.credentials.keyId,
      'KALSHI-ACCESS-TIMESTAMP': timestampMs,
      'KALSHI-ACCESS-SIGNATURE': signature,
    };

    const bodyString = body ? JSON.stringify(body) : '';
    
    const url = `${KALSHI_API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        ...(bodyString && { body: bodyString }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kalshi API error: ${response.status} ${errorText}`);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      console.error(`Kalshi API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }
  
  /**
   * Test authentication
   */
  async authenticate(): Promise<boolean> {
    try {
      // Try to get balance as auth test
      await this.getBalance();
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }
  
  /**
   * Get all active markets
   */
  async getMarkets(): Promise<KalshiMarket[]> {
    const response = await this.request<{ markets: any[] }>('/markets?status=open&limit=100');
    
    // Transform to our format
    return (response.markets || []).map((m: any) => ({
      ticker: m.ticker,
      title: m.title || m.ticker,
      category: this.inferCategory(m.title, m.ticker),
      yes_ask: m.yes_ask || 0,
      no_ask: m.no_ask || 0,
      volume: m.volume || 0,
      close_time: m.close_time,
      status: m.status,
    }));
  }
  
  /**
   * Get account balance
   */
  async getBalance(): Promise<KalshiBalance> {
    const response = await this.request<KalshiBalance>('/portfolio/balance');
    return {
      balance: response.balance || 0,
      available_balance: response.available_balance || response.balance,
      total_balance: response.total_balance || response.balance,
    };
  }
  
  /**
   * Get current positions
   */
  async getPositions(): Promise<any[]> {
    const response = await this.request<{ positions: any[] }>('/portfolio/positions');
    return response.positions || [];
  }
  
  /**
   * Get open orders
   */
  async getOrders(): Promise<any[]> {
    const response = await this.request<{ orders: any[] }>('/portfolio/orders');
    return response.orders || [];
  }
  
  /**
   * Place an order
   */
  async placeOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    count: number;
    price: number;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const priceField = params.side === 'yes' ? 'yes_price' : 'no_price';
      
      const orderData = {
        Ticker: params.ticker,
        Action: 'buy',
        Side: params.side,
        Count: Math.min(params.count, 100),
        Type: 'limit',
        [priceField]: params.price,
      };
      
      const response = await this.request<{ order: any }>('/portfolio/orders', 'POST', orderData);
      
      return {
        success: true,
        orderId: response.order?.order_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Order failed',
      };
    }
  }
  
  /**
   * Get market order book
   */
  async getOrderBook(ticker: string): Promise<{ yes_ask?: number; no_ask?: number } | null> {
    try {
      const response = await this.request<any>(`/markets/${ticker}/orderbook`);
      
      return {
        yes_ask: response.yes?.[0]?.price,
        no_ask: response.no?.[0]?.price,
      };
    } catch (error) {
      console.error(`Failed to get orderbook for ${ticker}:`, error);
      return null;
    }
  }
  
  /**
   * Infer category from title/ticker
   */
  private inferCategory(title: string, ticker: string): string {
    const titleLower = (title || '').toLowerCase();
    const tickerLower = (ticker || '').toLowerCase();
    
    if (titleLower.includes('mention') || tickerLower.includes('mention')) {
      return 'mentions';
    }
    if (titleLower.includes('weather') || tickerLower.includes('weather')) {
      return 'weather';
    }
    if (titleLower.includes('crypto') || tickerLower.includes('btc') || tickerLower.includes('eth') || tickerLower.includes('bitcoin')) {
      return 'crypto';
    }
    if (titleLower.includes('econom') || tickerLower.includes('econ') || tickerLower.includes('fed') || tickerLower.includes('cpi')) {
      return 'econ';
    }
    if (titleLower.includes('sport') || tickerLower.includes('sport') || tickerLower.includes('nba') || tickerLower.includes('nfl')) {
      return 'sports';
    }
    if (titleLower.includes('politic') || tickerLower.includes('trump') || tickerLower.includes('biden')) {
      return 'politics';
    }
    
    return 'other';
  }
}

/**
 * Create client from environment variables
 */
export function createClientFromEnv(): KalshiClient {
  const keyPath = process.env.KALSHI_KEY_PATH || './kalshi_key.pem';
  const keyId = process.env.KALSHI_KEY_ID || 'ff721a25-d41f-47aa-a52a-3ff34667333b';
  
  return new KalshiClient({ keyPath, keyId });
}
