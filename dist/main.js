#!/usr/bin/env node
/**
 * Main executable for Kalshi Multi-Strategy Specialist
 *
 * Run with: node dist/main.js
 * Or: npm start
 */
import { config } from 'dotenv';
import { KalshiClient, MarketScout, TradeExecutor } from './index.js';
// Load environment variables
config();
// Configuration from env
const CONFIG = {
    // Trading
    maxTrade: parseFloat(process.env.MAX_TRADE_SIZE || '1.0'),
    maxPositions: parseInt(process.env.POSITION_LIMIT || '5'),
    paperMode: (process.env.MODE || 'paper') === 'paper',
    // Scanning
    minVolume: parseInt(process.env.MIN_VOLUME || '100'),
    scanCategories: (process.env.SCAN_CATEGORIES || 'mentions,econ,weather,crypto').split(','),
    scanInterval: parseInt(process.env.SCAN_INTERVAL || '30000'),
    // Strategy toggles
    enableSumToOne: (process.env.ENABLE_SUM_TO_ONE || 'true') === 'true',
    enableJunkBond: (process.env.ENABLE_JUNK_BOND || 'true') === 'true',
};
async function main() {
    console.log('='.repeat(60));
    console.log('🚀 KALSHI MULTI-STRATEGY SPECIALIST');
    console.log('='.repeat(60));
    console.log(`Mode: ${CONFIG.paperMode ? '📝 PAPER' : '💰 LIVE'}`);
    console.log(`Max Trade: $${CONFIG.maxTrade}`);
    console.log(`Max Positions: ${CONFIG.maxPositions}`);
    console.log(`Scan Interval: ${CONFIG.scanInterval}ms`);
    console.log(`Strategies: ${CONFIG.enableSumToOne ? 'Sum-to-One ' : ''}${CONFIG.enableJunkBond ? 'Junk-Bond' : ''}`);
    console.log('='.repeat(60));
    // Create Kalshi client
    const client = new KalshiClient({
        keyPath: process.env.KALSHI_KEY_PATH || './kalshi_key.pem',
        keyId: process.env.KALSHI_KEY_ID || 'ff721a25-d41f-47aa-a52a-3ff34667333b'
    });
    // Initialize scout and trader
    const scout = new MarketScout({
        kalshiClient: client,
        minVolume: CONFIG.minVolume,
        scanCategories: CONFIG.scanCategories,
        maxResults: 10
    });
    const trader = new TradeExecutor({
        maxTrade: CONFIG.maxTrade,
        maxPositions: CONFIG.maxPositions,
        paperMode: CONFIG.paperMode
    }, client);
    // Single scan mode (for testing)
    if (process.argv.includes('--once')) {
        console.log('\n🔍 Running single scan...\n');
        const results = await scout.scan();
        console.log('\n📊 Results:');
        console.log(`  Sum-to-One: ${results.sumToOne.length} opportunities`);
        if (results.sumToOne.length > 0) {
            console.log('\n  Top opportunity:');
            const top = results.sumToOne[0];
            console.log(`    ${top.title}`);
            console.log(`    YES: ${(top.yesPrice * 100).toFixed(0)}¢ + NO: ${(top.noPrice * 100).toFixed(0)}¢ = ${(top.sum * 100).toFixed(0)}¢`);
            console.log(`    Profit: ${top.profitPercent.toFixed(2)}% ($${top.potentialProfit.toFixed(3)})`);
        }
        console.log(`\n  Junk Bond: ${results.junkBond.length} opportunities`);
        if (results.junkBond.length > 0) {
            console.log('  Top opportunity:');
            const top = results.junkBond[0];
            console.log(`    ${top.title}`);
            console.log(`    Price: ${(top.yesPrice * 100).toFixed(0)}¢ (${top.conviction})`);
            console.log(`    Expected: ${top.expectedReturn.toFixed(1)}% annualized`);
        }
        if (results.best) {
            console.log(`\n🎯 BEST: ${results.best.type}`);
        }
        else {
            console.log('\n  No tradeable opportunities found');
        }
        console.log('\n💰 Balance:', await scout.getBalance());
        return;
    }
    // Continuous trading mode
    console.log('\n📡 Starting continuous scan loop...\n');
    let scanCount = 0;
    const runScan = async () => {
        scanCount++;
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`[${timestamp}] Scan #${scanCount}`);
        try {
            const results = await scout.scan();
            console.log(`  Sum-to-One: ${results.sumToOne.length} | Junk Bond: ${results.junkBond.length} | Positions: ${trader.getPositionCount()}/${CONFIG.maxPositions}`);
            if (results.best) {
                console.log(`  🎯 Best: ${results.best.type}`);
                // Only execute if not disabled
                if (results.best.type === 'sum-to-one' && CONFIG.enableSumToOne) {
                    console.log('  Executing Sum-to-One...');
                    // TODO: Type guard and execute
                }
                else if (results.best.type === 'junk-bond' && CONFIG.enableJunkBond) {
                    console.log('  Executing Junk Bond...');
                    // TODO: Type guard and execute
                }
            }
        }
        catch (error) {
            console.error('  Scan failed:', error);
        }
    };
    // Run first scan immediately
    await runScan();
    // Then schedule scans
    setInterval(runScan, CONFIG.scanInterval);
    console.log('\n✅ Trading system running. Press Ctrl+C to stop.\n');
}
// Run
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
