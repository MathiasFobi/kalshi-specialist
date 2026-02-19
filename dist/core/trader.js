/**
 * Trade Executor
 * Handles execution of different strategy types
 */
export class TradeExecutor {
    config;
    activePositions = new Map();
    client;
    constructor(config, client) {
        this.config = config;
        this.client = client;
    }
    /**
     * Execute a sum-to-one arbitrage trade
     * Buys both YES and NO sides
     */
    async executeSumToOne(opportunity) {
        if (this.activePositions.size >= this.config.maxPositions) {
            return { success: false, orders: [], error: 'Max positions reached' };
        }
        try {
            const contracts = this.calculatePositionSize(opportunity.sum);
            const orders = [];
            // Buy YES
            const yesOrder = {
                ticker: opportunity.ticker,
                side: 'yes',
                count: contracts,
                price: opportunity.yesPrice * 100,
                status: 'pending'
            };
            // Buy NO
            const noOrder = {
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
        }
        catch (error) {
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
    async executeJunkBond(opportunity) {
        if (this.activePositions.size >= this.config.maxPositions) {
            return { success: false, orders: [], error: 'Max positions reached' };
        }
        try {
            const contracts = this.calculateJunkBondSize(opportunity.yesPrice);
            const orders = [];
            const order = {
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
        }
        catch (error) {
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
    calculatePositionSize(totalPrice) {
        const maxByTrade = Math.floor(this.config.maxTrade / totalPrice);
        return Math.min(maxByTrade, 10); // Cap at 10 contracts
    }
    /**
     * Calculate position size for junk bond
     */
    calculateJunkBondSize(price) {
        const maxByTrade = Math.floor(this.config.maxTrade / price);
        return Math.min(maxByTrade, 10);
    }
    /**
     * Get active positions
     */
    getActivePositions() {
        return this.activePositions;
    }
    /**
     * Close a position
     */
    async closePosition(ticker) {
        const position = this.activePositions.get(ticker);
        if (!position)
            return false;
        this.activePositions.delete(ticker);
        return true;
    }
    /**
     * Get position count
     */
    getPositionCount() {
        return this.activePositions.size;
    }
}
