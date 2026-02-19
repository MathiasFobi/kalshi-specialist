/**
 * Kalshi API Client
 * Handles authentication, environment selection, and HTTP requests
 */
import axios from 'axios';
import { signRequest, loadPrivateKey } from './auth.js';
export class KalshiClient {
    http;
    config;
    privateKey = null;
    constructor(config) {
        this.config = config;
        const baseURL = config.environment === 'prod'
            ? 'https://trading-api.kalshi.com/v2'
            : 'https://demo-api.kalshi.com/v2';
        this.http = axios.create({
            baseURL,
            timeout: 30000,
        });
    }
    /**
     * Get the private key (lazy-loaded and cached)
     */
    getPrivateKey() {
        if (this.privateKey === null) {
            this.privateKey = loadPrivateKey(this.config.privateKeyPath);
        }
        return this.privateKey;
    }
    /**
     * Create authentication headers for a request
     */
    createAuthHeaders(method, path, body) {
        return signRequest(method, path, this.getPrivateKey(), this.config.keyId, body);
    }
    /**
     * Get the full URL path including query string for signing
     */
    getPathForSigning(url, params) {
        if (!params || Object.keys(params).length === 0) {
            return url;
        }
        const queryString = new URLSearchParams(params).toString();
        return `${url}?${queryString}`;
    }
    /**
     * Make an authenticated GET request
     */
    async get(url, params) {
        const path = this.getPathForSigning(url, params);
        const authHeaders = this.createAuthHeaders('GET', path);
        const config = {
            headers: authHeaders,
            params,
        };
        return this.http.get(url, config);
    }
    /**
     * Make an authenticated POST request
     */
    async post(url, data) {
        const body = data ? JSON.stringify(data) : '';
        const authHeaders = this.createAuthHeaders('POST', url, body);
        const config = {
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
            },
        };
        return this.http.post(url, data, config);
    }
    /**
     * Make an authenticated PUT request
     */
    async put(url, data) {
        const body = data ? JSON.stringify(data) : '';
        const authHeaders = this.createAuthHeaders('PUT', url, body);
        const config = {
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
            },
        };
        return this.http.put(url, data, config);
    }
    /**
     * Make an authenticated DELETE request
     */
    async delete(url) {
        const authHeaders = this.createAuthHeaders('DELETE', url);
        const config = {
            headers: authHeaders,
        };
        return this.http.delete(url, config);
    }
    /**
     * Check API status
     */
    async getStatus() {
        // Status endpoint doesn't require authentication
        const response = await this.http.get('/status');
        return response.data;
    }
    /**
     * Get account balance
     */
    async getBalance() {
        return this.get('/portfolio/balance');
    }
    /**
     * Get open positions
     */
    async getPositions() {
        return this.get('/portfolio/positions');
    }
    /**
     * Get the configured environment
     */
    getEnvironment() {
        return this.config.environment;
    }
    /**
     * Get the base URL being used
     */
    getBaseURL() {
        return this.http.defaults.baseURL ?? '';
    }
}
export default KalshiClient;
