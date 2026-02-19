/**
 * Enhanced Market Scout
 * Scans for multiple strategy opportunities
 */
import { SumToOneStrategy } from '../strategies/sum-to-one.js';
import { JunkBondStrategy } from '../strategies/junk-bond.js';
export class MarketScout {
    config;
    sumToOne;
    junkBond;
    client;
    constructor(config) {
        this.config = config;
        this.sumToOne = new SumToOneStrategy({
            minSum: 0.50,
            maxSum: 0.95,
            minVolume: config.minVolume
        });
        this.junkBond = new JunkBondStrategy({
            minPrice: 0.70,
            maxPrice: 0.95,
            minVolume: config.minVolume,
            targetCategories: config.scanCategories
        });
        // Use provided client or fail gracefully
        if (!config.kalshiClient) {
            throw new Error('KalshiClient is required');
        }
        this.client = config.kalshiClient;
    }
    /**
     * Scan all markets for opportunities
     */
    async scan() {
        try {
            // Ensure authentication
            const authenticated = await this.client.authenticate();
            if (!authenticated) {
                console.error('❌ Failed to authenticate with Kalshi');
                return {
                    sumToOne: [],
                    junkBond: [],
                    best: null,
                    timestamp: new Date().toISOString()
                };
            }
            // Fetch markets from Kalshi
            const markets = await this.client.getMarkets();
            console.log(`📊 Fetched ${markets.length} markets`);
            // Filter by categories
            const filtered = this.filterByCategories(markets);
            // Run strategies
            const sumToOneResults = this.sumToOne.findOpportunities(filtered);
            const junkBondResults = this.junkBond.findOpportunities(filtered);
            // Select best opportunity
            const best = this.selectBest(sumToOneResults, junkBondResults);
            return {
                sumToOne: sumToOneResults.slice(0, this.config.maxResults),
                junkBond: junkBondResults.slice(0, this.config.maxResults),
                best,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Scan error:', error);
            return {
                sumToOne: [],
                junkBond: [],
                best: null,
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Filter markets by target categories
     */
    filterByCategories(markets) {
        if (!this.config.scanCategories || this.config.scanCategories.length === 0) {
            return markets;
        }
        return markets.filter(market => {
            const category = (market.category || '').toLowerCase();
            return this.config.scanCategories.some(sc => category.includes(sc.toLowerCase()));
        });
    }
    /**
     * Select the best opportunity across all strategies
     */
    selectBest(sumToOne, junkBond) {
        const candidates = [];
        // Add sum-to-one candidates (higher priority - risk free)
        if (sumToOne.length > 0) {
            candidates.push({
                type: 'sum-to-one',
                data: sumToOne[0],
                score: sumToOne[0].profitPercent * 2 // Bonus for risk-free
            });
        }
        // Add junk bond candidates
        if (junkBond.length > 0) {
            const bestJunk = junkBond[0];
            candidates.push({
                type: 'junk-bond',
                data: bestJunk,
                score: bestJunk.annualizedReturn
            });
        }
        // Return highest score
        if (candidates.length === 0)
            return null;
        return candidates.sort((a, b) => b.score - a.score)[0];
    }
    /**
     * Quick scan - just check if any opportunities exist
     */
    async hasOpportunities() {
        const results = await this.scan();
        return results.sumToOne.length > 0 || results.junkBond.length > 0;
    }
    /**
     * Get current balance
     */
    async getBalance() {
        const balance = await this.client.getBalance();
        return balance.balance || 0;
    }
}
