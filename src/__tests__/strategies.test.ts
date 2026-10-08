import { describe, it, expect, beforeEach } from 'vitest';
import { SumToOneStrategy } from '../strategies/sum-to-one.js';
import { JunkBondStrategy } from '../strategies/junk-bond.js';

describe('Sum-to-One Strategy', () => {
  let strategy: SumToOneStrategy;
  
  beforeEach(() => {
    strategy = new SumToOneStrategy({
      minSum: 0.50,
      maxSum: 0.95,
      minVolume: 100
    });
  });
  
  it('should find opportunities when YES + NO < 0.95', () => {
    const markets = [
      {
        ticker: 'TEST-1',
        title: 'Test Market',
        yes_ask: 45,  // 45¢
        no_ask: 48,   // 48¢
        volume: 500
      }
    ];
    
    const opportunities = strategy.findOpportunities(markets);
    
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].sum).toBeCloseTo(0.93, 2);  // 45¢ + 48¢ = 93¢
    expect(opportunities[0].potentialProfit).toBeGreaterThan(0);
  });
  
  it('should skip markets where sum >= 0.95', () => {
    const markets = [
      {
        ticker: 'TEST-2',
        title: 'Efficient Market',
        yes_ask: 60,  // 60¢
        no_ask: 40,   // 40¢
        volume: 500
      }
    ];
    
    const opportunities = strategy.findOpportunities(markets);
    
    expect(opportunities.length).toBe(0);  // Sum = 100¢, no profit
  });
  
  it('should calculate position size correctly', () => {
    const opportunity = {
      ticker: 'TEST-1',
      title: 'Test',
      yesPrice: 0.45,
      noPrice: 0.48,
      sum: 0.93,
      potentialProfit: 0.06,
      fees: 0.01,
      profitPercent: 6.45
    };
    
    const contracts = strategy.calculatePositionSize(100, 1.0, opportunity);
    
    expect(contracts).toBeGreaterThan(0);
    expect(contracts).toBeLessThanOrEqual(10);  // Max cap
  });
});

describe('Junk Bond Strategy', () => {
  let strategy: JunkBondStrategy;
  
  beforeEach(() => {
    strategy = new JunkBondStrategy({
      minPrice: 0.70,
      maxPrice: 0.95,
      minVolume: 100,
      targetCategories: ['mentions', 'econ', 'weather']
    });
  });
  
  it('should find junk bond opportunities in target categories', () => {
    const markets = [
      {
        ticker: 'MENTIONS-1',
        title: 'Twitter Mentions',
        yes_ask: 85,  // 85¢
        category: 'mentions',
        volume: 200
      }
    ];
    
    const opportunities = strategy.findOpportunities(markets);
    
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].yesPrice).toBe(0.85);
    expect(opportunities[0].conviction).toBe('HIGH');
  });
  
  it('should skip non-target categories', () => {
    const markets = [
      {
        ticker: 'SPORTS-1',
        title: 'Sports Market',
        yes_ask: 85,
        category: 'sports',
        volume: 200
      }
    ];
    
    const opportunities = strategy.findOpportunities(markets);
    
    expect(opportunities.length).toBe(0);  // Sports not in target categories
  });
  
  it('should skip prices outside 70-95¢ range', () => {
    const markets = [
      {
        ticker: 'TOO_LOW',
        title: 'Low Price',
        yes_ask: 50,  // 50¢ - too low
        category: 'mentions',
        volume: 200
      },
      {
        ticker: 'TOO_HIGH',
        title: 'High Price',
        yes_ask: 98,  // 98¢ - too high
        category: 'mentions',
        volume: 200
      }
    ];
    
    const opportunities = strategy.findOpportunities(markets);
    
    expect(opportunities.length).toBe(0);
  });
  
  it('should calculate VERY_HIGH conviction for 90¢+', () => {
    const opportunities = strategy.findOpportunities([
      {
        ticker: 'HIGH-1',
        title: 'High Conviction',
        yes_ask: 92,  // 92¢
        category: 'mentions',
        volume: 200
      }
    ]);
    
    expect(opportunities[0].conviction).toBe('VERY_HIGH');
  });
});
