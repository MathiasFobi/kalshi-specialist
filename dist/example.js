/**
 * Example usage of the Multi-Strategy Specialist
 *
 * Copy this file and adapt to your Kalshi client
 */
import { MarketScout, TradeExecutor, KalshiClient } from './index.js';
// Configuration
const CONFIG = {
    // Trading parameters
    maxTrade: 1.0, // Maximum $ per trade
    maxPositions: 5, // Maximum concurrent positions
    paperMode: true, // Start in paper mode for testing
    // Scanning parameters
    minVolume: 100,
    scanCategories: ['mentions', 'econ', 'weather', 'crypto'],
    scanInterval: 30000, // 30 seconds
};
/**
 * Initialize and run the trading system
 */
async function runTradingSystem() {
    console.log('🚀 Starting Kalshi Multi-Strategy Specialist');
    console.log(`   Mode: ${CONFIG.paperMode ? 'PAPER' : 'LIVE'}`);
    console.log(`   Max Trade: $${CONFIG.maxTrade}`);
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
    // Main trading loop
    console.log('📡 Starting scan loop...\n');
    setInterval(async () => {
        try {
            // Scan for opportunities
            const results = await scout.scan();
            console.log('\n--- Scan Results ---');
            console.log(`Sum-to-One: ${results.sumToOne.length} opportunities`);
            console.log(`Junk Bond: ${results.junkBond.length} opportunities`);
            console.log(`Active Positions: ${trader.getPositionCount()}/${CONFIG.maxPositions}`);
            // Print opportunities
            if (results.sumToOne.length > 0) {
                const opp = results.sumToOne[0];
                console.log(`  Top Sum-to-One: ${opp.title}`);
                console.log(`    YES: ${(opp.yesPrice * 100).toFixed(0)}¢ + NO: ${(opp.noPrice * 100).toFixed(0)}¢`);
            }
            if (results.junkBond.length > 0) {
                const opp = results.junkBond[0];
                console.log(`  Top Junk Bond: ${opp.title}`);
            }
        }
        catch (error) {
            console.error('Scan error:', error);
        }
    }, CONFIG.scanInterval);
}
// Example: Standalone test
async function testClient() {
    const client = new KalshiClient({
        keyPath: './kalshi_key.pem',
        keyId: 'ff721a25-d41f-47aa-a52a-3ff34667333b'
    });
    console.log('Testing client...');
    // Note: Requires key file
}
// Export for use
export { runTradingSystem, testClient, CONFIG };
