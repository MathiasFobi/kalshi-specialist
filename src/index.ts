/**
 * Main entry point for Kalshi Multi-Strategy Specialist
 * Re-exports strategies and core functionality
 */

// Strategies
export { SumToOneStrategy, SumToOneOpportunity, SumToOneConfig } from './strategies/sum-to-one.js';
export { JunkBondStrategy, JunkBondOpportunity, JunkBondConfig } from './strategies/junk-bond.js';
export { BTCStrategy, MarketSignal, TradeResult as BTCTradeResult, StrategyConfig, DEFAULT_CONFIG, runBTCStrategy } from './strategies/btc-trend.js';

// Core
export { MarketScout, ScoutResults, ScoutConfig } from './core/scout.js';
export { TradeExecutor, TradeResult, TradeConfig, TradeOrder } from './core/trader.js';
export { KalshiClient, KalshiCredentials, KalshiMarket, createClientFromEnv } from './core/kalshi-client.js';

// Version
export const VERSION = '2.0.0';
export const NAME = 'Kalshi Multi-Strategy Specialist';
