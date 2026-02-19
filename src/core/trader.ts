/**
 * Trade Executor
 * Handles execution of different strategy types
 */

import { SumToOneOpportunity } from '../strategies/sum-to-one.js';
import { JunkBondOpportunity } from '../strategies/junk-bond.js';
import { KalshiClient } from './kalshi-client.js';

export interface TradeResult {
  success: boolean;
  orders: TradeOrder[];
  profit?: number;
  expectedReturn?: number;
  error?: string;
}

export interface TradeOrder {
  ticker: string;
  side: 'yes' | 'no';
  count: number;
  price: number;
  status: 'pending' | 'filled' | 'failed';
  orderId?: string;
}

export interface TradeConfig {
  maxTrade: number;
  maxPositions: number;
  paperMode: boolean;
}

export class TradeExecutor {
  private activePositions: Map<string, any> = new Map();
  private client: KalshiClient;
  
  constructor(
    private config: TradeConfig,
    client: KalshiClient
  ) {
    this.client = client;
  }
  
  /**
   * Execute a sum-to-one arbitrage trade
   * Buys both YES and NO sides
   */
  async executeSumToOne(
    opportunity: SumToOneOpportunity
  ): Promise<TradeResult> {
    if (this.activePositions.size >= this.config.maxPositions) {
      return { success: false, orders: [], error: 'Max positions reached' };
    }
    
    try {
      const contracts = this.calculatePositionSize(opportunity.sum);
      const orders: TradeOrder[] = [];
      
      // Buy YES
      const yesOrder: TradeOrder = {
        ticker: opportunity.ticker,
        side: 'yes',
        count: contracts,
        price: opportunity.yesPrice * 100,
        status: 'pending'
      };
      
      // Buy NO
      const noOrder: TradeOrder = {
        ticker: opportunity.ticker,
        side: 'no',
        count: contracts,
        price: opportunity.noPrice * 100,
        status: 'pending'
      };
      
      if (this.config.paperMode) {
        // Paper trade - just log
        console.log(`[PAPER] Sum-to-One trade:`);
        console.log(`  Buy ${contracts} YES @ ${(opportunity.yesPrice * 100).toFixed(0)}¢`);
        console.log(`  Buy ${contracts} NO @ ${(opportunity.noPrice * 100).toFixed(0)}¢`);
        console.log(`  Expected profit: $${(opportunity.potentialProfit * contracts).toFixed(2)}`);
        
        yesOrder.status = 'filled';
        noOrder.status = 'filled';
        orders.push(yesOrder, noOrder);
        
        // Track position
        this.activePositions.set(opportunity.ticker, {
          type: 'sum-to-one',
          orders,
          profit: opportunity.potentialProfit * contracts
        });
        
        return {
          success: true,
          orders,
          profit: opportunity.potentialProfit * contracts
        };
      }
      
      // Live trade
      // Execute YES order
      const yesResult = await this.client.placeOrder({
        ticker: opportunity.ticker,
        side: 'yes',
        count: contracts,
        price: Math.floor(opportunity.yesPrice * 100)
      });
      
      yesOrder.status = yesResult.success ? 'filled' : 'failed';
      yesOrder.orderId = yesResult.orderId;
      orders.push(yesOrder);
      
      // Execute NO order
      if (yesOrder.status === 'filled') {
        const noResult = await this.client.placeOrder({
          ticker: opportunity.ticker,
          side: 'no',
          count: contracts,
          price: Math.floor(opportunity.noPrice * 100)
        });
        
        noOrder.status = noResult.success ? 'filled' : 'failed';
        noOrder.orderId = noResult.orderId;
        orders.push(noOrder);
      }
      
      // Track position if both succeeded
      if (yesOrder.status === 'filled' && noOrder.status === 'filled') {
        this.activePositions.set(opportunity.ticker, {
          type: 'sum-to-one',
          orders,
          profit: opportunity.potentialProfit * contracts
        });
      }
      
      return {
        success: yesOrder.status === 'filled' && noOrder.status === 'filled',
        orders,
        profit: opportunity.potentialProfit * contracts
      };
      
    } catch (error) {
      console.error('Sum-to-One execution error:', error);
      return {
        success: false,
        orders: [],
        error: String(error)
      };
    }
  }
  
  /**
   * Execute a junk bond trade
   * Buys YES side only
   */
  async executeJunkBond(
    opportunity: JunkBondOpportunity
  ): Promise<TradeResult> {
    if (this.activePositions.size >= this.config.maxPositions) {
      return { success: false, orders: [], error: 'Max positions reached' };
    }
    
    try {
      const contracts = this.calculateJunkBondSize(opportunity.yesPrice);
      const orders: TradeOrder[] = [];
      
      const order: TradeOrder = {
        ticker: opportunity.ticker,
        side: 'yes',
        count: contracts,
        price: opportunity.yesPrice * 100,
        status: 'pending'
      };
      
      if (this.config.paperMode) {
        console.log(`[PAPER] Junk Bond trade:`);
        console.log(`  Buy ${contracts} YES @ ${(opportunity.yesPrice * 100).toFixed(0)}¢ (${opportunity.title})`);
        console.log(`  Expected return: ${opportunity.expectedReturn.toFixed(1)}%`);
        
        order.status = 'filled';
        orders.push(order);
        
        this.activePositions.set(opportunity.ticker, {
          type: 'junk-bond',
          orders,
          expectedReturn: opportunity.expectedReturn
        });
        
        return {
          success: true,
          orders,
          expectedReturn: opportunity.expectedReturn
        };
      }
      
      // Live trade
      const result = await this.client.placeOrder({
        ticker: opportunity.ticker,
        side: 'yes',
        count: contracts,
        price: Math.floor(opportunity.yesPrice * 100)
      });
      
      order.status = result.success ? 'filled' : 'failed';
      order.orderId = result.orderId;
      orders.push(order);
      
      if (order.status === 'filled') {
        this.activePositions.set(opportunity.ticker, {
          type: 'junk-bond',
          orders,
          expectedReturn: opportunity.expectedReturn
        });
      }
      
      return {
        success: order.status === 'filled',
        orders,
        expectedReturn: opportunity.expectedReturn
      };
      
    } catch (error) {
      console.error('Junk Bond execution error:', error);
      return {
        success: false,
        orders: [],
        error: String(error)
      };
    }
  }
  
  /**
   * Calculate position size for sum-to-one
   */
  private calculatePositionSize(totalPrice: number): number {
    const maxByTrade = Math.floor(this.config.maxTrade / totalPrice);
    return Math.min(maxByTrade, 10);  // Cap at 10 contracts
  }
  
  /**
   * Calculate position size for junk bond
   */
  private calculateJunkBondSize(price: number): number {
    const maxByTrade = Math.floor(this.config.maxTrade / price);
    return Math.min(maxByTrade, 10);
  }
  
  /**
   * Get active positions
   */
  getActivePositions(): Map<string, any> {
    return this.activePositions;
  }
  
  /**
   * Close a position
   */
  async closePosition(ticker: string): Promise<boolean> {
    const position = this.activePositions.get(ticker);
    if (!position) return false;
    
    this.activePositions.delete(ticker);
    return true;
  }
  
  /**
   * Get position count
   */
  getPositionCount(): number {
    return this.activePositions.size;
  }
}
