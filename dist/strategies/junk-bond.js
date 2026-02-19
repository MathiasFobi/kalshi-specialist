/**
 * Junk Bond Strategy
 * Targets 70-95¢ markets with high probability of resolving YES
 * "Nothing ever happened" markets - compounding small edges
 */
export class JunkBondStrategy {
    config;
    constructor(config = {}) {
        this.config = {
            minPrice: 0.70,
            maxPrice: 0.95,
            minVolume: 100,
            targetCategories: [
                'mentions', // Social media mentions - crowd overreacts
                'daily', // Daily economic indicators
                'weather', // Weather markets
                'crypto', // Crypto established ranges
                'econ' // Economic events
            ],
            ...config
        };
    }
    /**
     * Find junk bond opportunities
     * @param markets Array of market data from Kalshi
     * @returns Array of opportunities sorted by expected return
     */
    findOpportunities(markets) {
        const opportunities = [];
        for (const market of markets) {
            const yesPrice = (market.yes_ask || 0) / 100;
            const category = (market.category || '').toLowerCase();
            const volume = market.volume || 0;
            // Skip if not in target categories
            const isTargetCategory = this.config.targetCategories.some(tc => category.includes(tc));
            if (!isTargetCategory)
                continue;
            // Skip if price outside junk bond range
            if (yesPrice < this.config.minPrice || yesPrice > this.config.maxPrice)
                continue;
            // Skip if insufficient volume
            if (volume < this.config.minVolume)
                continue;
            // Calculate expected returns
            const investment = yesPrice;
            const payout = 1.00;
            const fees = 0.01; // ~1% total fees
            const expectedReturn = (payout - investment - fees);
            const returnPercent = (expectedReturn / investment) * 100;
            // Estimate days to resolution (from market close time)
            const daysToResolution = this.estimateDaysToResolution(market);
            // Annualized return (for comparison)
            const annualizedReturn = daysToResolution > 0
                ? (returnPercent / daysToResolution) * 365
                : returnPercent;
            opportunities.push({
                ticker: market.ticker,
                title: market.title || market.ticker,
                yesPrice,
                category,
                conviction: this.calculateConviction(yesPrice, category),
                expectedReturn: returnPercent,
                annualizedReturn,
                daysToResolution
            });
        }
        // Sort by expected return
        return opportunities.sort((a, b) => b.annualizedReturn - a.annualizedReturn);
    }
    /**
     * Calculate position size based on conviction and price
     */
    calculatePositionSize(balance, maxTrade, opportunity) {
        // Base size on conviction
        const convictionMultipliers = {
            'VERY_HIGH': 1.0,
            'HIGH': 0.75,
            'MEDIUM': 0.5,
            'LOW': 0.25
        };
        const multiplier = convictionMultipliers[opportunity.conviction] || 0.5;
        const maxByTrade = maxTrade / opportunity.yesPrice;
        const maxByBalance = (balance * 0.15 * multiplier) / opportunity.yesPrice;
        return Math.floor(Math.min(maxByTrade, maxByBalance));
    }
    /**
     * Determine conviction level based on price and category
     */
    calculateConviction(price, category) {
        // Price-based scoring
        if (price >= 0.90)
            return 'VERY_HIGH';
        if (price >= 0.85)
            return 'HIGH';
        if (price >= 0.80)
            return 'MEDIUM';
        if (price >= 0.70)
            return 'LOW';
        return 'LOW';
    }
    /**
     * Estimate days until market resolution
     */
    estimateDaysToResolution(market) {
        // Use close time if available
        if (market.close_time) {
            const closeDate = new Date(market.close_time);
            const now = new Date();
            const diffMs = closeDate.getTime() - now.getTime();
            return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
        // Default: assume 7 days for typical markets
        return 7;
    }
    /**
     * Check if we should exit a position early
     * (e.g., if price spikes unexpectedly)
     */
    shouldExit(currentPrice, entryPrice) {
        // Exit if price drops below 60% (unusual event happened)
        if (currentPrice < 0.60)
            return true;
        // Exit if price spikes above 98% (take profit)
        if (currentPrice > 0.98)
            return true;
        return false;
    }
}
