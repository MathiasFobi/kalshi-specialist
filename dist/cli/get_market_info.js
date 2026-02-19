/**
 * Market Lookup Tool
 * Look up market information by ticker using Kalshi V2 API
 */
export class MarketLookupError extends Error {
    ticker;
    constructor(message, ticker) {
        super(message);
        this.ticker = ticker;
        this.name = 'MarketLookupError';
    }
}
/**
 * Get market information by ticker
 * @param client - KalshiClient instance
 * @param ticker - Market ticker symbol (e.g., "KXTRUMPWIN-2024")
 * @returns MarketInfoResponse with market data
 */
export async function getMarketInfo(client, ticker) {
    if (!ticker || ticker.trim() === '') {
        throw new MarketLookupError('Ticker is required', ticker);
    }
    try {
        // Use the Kalshi V2 /markets/{ticker} endpoint
        const response = await client.get(`/markets/${ticker}`);
        const marketData = response.data.market;
        if (!marketData) {
            throw new MarketLookupError(`Market not found: ${ticker}`, ticker);
        }
        // Map the Kalshi API response to our MarketInfo interface
        const market = {
            ticker: marketData.ticker,
            title: marketData.title || marketData.ticker,
            category: inferCategory(marketData.title, marketData.ticker),
            yes_ask: marketData.yes_ask ?? 0,
            no_ask: marketData.no_ask ?? 0,
            yes_bid: marketData.yes_bid ?? 0,
            no_bid: marketData.no_bid ?? 0,
            volume: marketData.volume || 0,
            open_interest: marketData.open_interest || 0,
            status: marketData.status || 'unknown',
            close_time: marketData.close_time,
            settlement_value: marketData.settlement_value,
            description: marketData.description,
        };
        return {
            market,
            retrievedAt: new Date().toISOString(),
        };
    }
    catch (error) {
        if (error.response?.status === 404) {
            throw new MarketLookupError(`Market not found: ${ticker}`, ticker);
        }
        if (error instanceof MarketLookupError) {
            throw error;
        }
        throw new MarketLookupError(`Failed to fetch market info: ${error.message || 'Unknown error'}`, ticker);
    }
}
/**
 * Infer category from title and ticker
 */
function inferCategory(title, ticker) {
    const titleLower = (title || '').toLowerCase();
    const tickerLower = (ticker || '').toLowerCase();
    console.log(`DEBUG inferCategory: title="${title}" ticker="${ticker}"`);
    console.log(`DEBUG titleLower="${titleLower}" tickerLower="${tickerLower}"`);
    console.log(`DEBUG includes('trump') in titleLower:`, titleLower.includes('trump'));
    console.log(`DEBUG includes('trump') in tickerLower:`, tickerLower.includes('trump'));
    if (titleLower.includes('mention') || tickerLower.includes('mention')) {
        console.log('DEBUG: matched mentions');
        return 'mentions';
    }
    if (titleLower.includes('weather') || tickerLower.includes('weather')) {
        console.log('DEBUG: matched weather');
        return 'weather';
    }
    if (titleLower.includes('crypto') || tickerLower.includes('btc') || tickerLower.includes('eth') || tickerLower.includes('bitcoin')) {
        console.log('DEBUG: matched crypto');
        return 'crypto';
    }
    if (titleLower.includes('econom') || tickerLower.includes('econ') || tickerLower.includes('fed') || tickerLower.includes('cpi')) {
        console.log('DEBUG: matched econ');
        return 'econ';
    }
    if (titleLower.includes('sport') || tickerLower.includes('sport') || tickerLower.includes('nba') || tickerLower.includes('nfl')) {
        console.log('DEBUG: matched sports');
        return 'sports';
    }
    if (titleLower.includes('politic') || tickerLower.includes('trump') || tickerLower.includes('biden')) {
        console.log('DEBUG: matched politics');
        return 'politics';
    }
    console.log('DEBUG: no match, returning other');
    return 'other';
}
/**
 * Format market info for CLI output
 */
export function formatMarketInfo(response) {
    const m = response.market;
    const lines = [
        `Ticker: ${m.ticker}`,
        `Title: ${m.title}`,
        `Category: ${m.category}`,
        `Status: ${m.status}`,
        ``,
        `PRICES:`,
        `  Yes: bid=${m.yes_bid}¢ ask=${m.yes_ask}¢`,
        `  No:  bid=${m.no_bid}¢ ask=${m.no_ask}¢`,
        ``,
        `VOLUME:`,
        `  Volume: ${m.volume.toLocaleString()} contracts`,
        `  Open Interest: ${m.open_interest.toLocaleString()}`,
    ];
    if (m.close_time) {
        lines.push(`  Closes: ${new Date(m.close_time).toLocaleString()}`);
    }
    if (m.settlement_value !== undefined) {
        lines.push(`  Settlement Value: ${m.settlement_value}`);
    }
    lines.push(`  Retrieved: ${new Date(response.retrievedAt).toLocaleString()}`);
    return lines.join('\n');
}
/**
 * CLI entry point for getting market info
 */
export async function getMarketInfoCLI(client, ticker) {
    const response = await getMarketInfo(client, ticker);
    console.log(formatMarketInfo(response));
}
