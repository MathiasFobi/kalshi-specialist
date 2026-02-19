/**
 * Sum-to-One Arbitrage Strategy
 * Finds YES+NO markets where combined price < 0.95
 * Buys both sides for risk-free profit at resolution
 */
export class SumToOneStrategy {
    config;
    constructor(config = {}) {
        this.config = {
            minSum: 0.50,
            maxSum: 0.95,
            minVolume: 100,
            ...config
        };
    }
    /**
     * Find sum-to-one arbitrage opportunities
     * @param markets Array of market data from Kalshi
     * @returns Array of opportunities sorted by profit potential
     */
    findOpportunities(markets) {
        const opportunities = [];
        for (const market of markets) {
            // Skip if not binary (no YES/NO sides)
            if (!market.yes_ask || !market.no_ask)
                continue;
            // Skip if no volume
            if ((market.volume || 0) < this.config.minVolume)
                continue;
            const yesPrice = market.yes_ask / 100; // Convert cents to dollars
            const noPrice = market.no_ask / 100;
            const sum = yesPrice + noPrice;
            // Calculate fees (~0.5% per side = ~1% total)
            const fees = sum * 0.01;
            const profit = 1.00 - sum - fees;
            const profitPercent = (profit / sum) * 100;
            // Check if opportunity exists
            if (sum >= this.config.minSum && sum < this.config.maxSum && profit > 0) {
                opportunities.push({
                    ticker: market.ticker,
                    title: market.title || market.ticker,
                    yesPrice,
                    noPrice,
                    sum,
                    potentialProfit: profit,
                    fees,
                    profitPercent
                });
            }
        }
        // Sort by profit potential (highest first)
        return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
    }
    /**
     * Calculate position size for sum-to-one trade
     * @param balance Current account balance
     * @param maxTrade Maximum trade size
     * @param opportunity The opportunity to size for
     * @returns Number of contracts to buy on each side
     */
    calculatePositionSize(balance, maxTrade, opportunity) {
        // Risk-free trade, but still respect max trade size
        const totalCost = opportunity.yesPrice + opportunity.noPrice;
        const maxByTrade = Math.floor(maxTrade / totalCost);
        // Conservative: don't spend more than 20% of balance
        const maxByBalance = Math.floor((balance * 0.20) / totalCost);
        // Take the smaller of the two
        return Math.min(maxByTrade, maxByBalance, 10); // Cap at 10 contracts
    }
    /**
     * Check if opportunity is still valid
     * @param opportunity Previous opportunity
     * @param currentYes Current YES ask price
     * @param currentNo Current NO ask price
     */
    isStillValid(opportunity, currentYes, currentNo) {
        const currentSum = (currentYes + currentNo) / 100;
        return currentSum < this.config.maxSum && currentSum > this.config.minSum;
    }
}
