/**
 * Main entry point for Kalshi Multi-Strategy Specialist
 * Re-exports strategies and core functionality
 */
// Strategies
export { SumToOneStrategy } from './strategies/sum-to-one.js';
export { JunkBondStrategy } from './strategies/junk-bond.js';
// Core
export { MarketScout } from './core/scout.js';
export { TradeExecutor } from './core/trader.js';
export { KalshiClient, createClientFromEnv } from './core/kalshi-client.js';
// Version
export const VERSION = '2.0.0';
export const NAME = 'Kalshi Multi-Strategy Specialist';
