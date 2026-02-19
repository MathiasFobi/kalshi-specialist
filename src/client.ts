/**
 * Kalshi API Client
 * Handles authentication, environment selection, and HTTP requests
 */

import axios, { AxiosInstance, AxiosResponse, RawAxiosRequestConfig } from 'axios';
import { signRequest, loadPrivateKey, KalshiAuthHeaders } from './auth.js';

export type KalshiEnvironment = 'demo' | 'prod';

export interface KalshiClientConfig {
  environment: KalshiEnvironment;
  keyId: string;
  privateKeyPath: string;
}

export interface KalshiStatus {
  status: string;
  [key: string]: unknown;
}

export class KalshiClient {
  private readonly http: AxiosInstance;
  private readonly config: KalshiClientConfig;
  private privateKey: string | null = null;

  constructor(config: KalshiClientConfig) {
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
  private getPrivateKey(): string {
    if (this.privateKey === null) {
      this.privateKey = loadPrivateKey(this.config.privateKeyPath);
    }
    return this.privateKey;
  }

  /**
   * Create authentication headers for a request
   */
  private createAuthHeaders(method: string, path: string, body?: string): KalshiAuthHeaders {
    return signRequest(
      method,
      path,
      this.getPrivateKey(),
      this.config.keyId,
      body
    );
  }

  /**
   * Get the full URL path including query string for signing
   */
  private getPathForSigning(url: string, params?: Record<string, string>): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }
    const queryString = new URLSearchParams(params).toString();
    return `${url}?${queryString}`;
  }

  /**
   * Make an authenticated GET request
   */
  async get<T>(url: string, params?: Record<string, string>): Promise<AxiosResponse<T>> {
    const path = this.getPathForSigning(url, params);
    const authHeaders = this.createAuthHeaders('GET', path);
    
    const config: RawAxiosRequestConfig = {
      headers: authHeaders as Record<string, string>,
      params,
    };
    
    return this.http.get<T>(url, config);
  }

  /**
   * Make an authenticated POST request
   */
  async post<T>(url: string, data?: unknown): Promise<AxiosResponse<T>> {
    const body = data ? JSON.stringify(data) : '';
    const authHeaders = this.createAuthHeaders('POST', url, body);
    
    const config: RawAxiosRequestConfig = {
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      } as Record<string, string>,
    };
    
    return this.http.post<T>(url, data, config);
  }

  /**
   * Make an authenticated PUT request
   */
  async put<T>(url: string, data?: unknown): Promise<AxiosResponse<T>> {
    const body = data ? JSON.stringify(data) : '';
    const authHeaders = this.createAuthHeaders('PUT', url, body);
    
    const config: RawAxiosRequestConfig = {
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      } as Record<string, string>,
    };
    
    return this.http.put<T>(url, data, config);
  }

  /**
   * Make an authenticated DELETE request
   */
  async delete<T>(url: string): Promise<AxiosResponse<T>> {
    const authHeaders = this.createAuthHeaders('DELETE', url);
    
    const config: RawAxiosRequestConfig = {
      headers: authHeaders as Record<string, string>,
    };
    
    return this.http.delete<T>(url, config);
  }

  /**
   * Check API status
   */
  async getStatus(): Promise<KalshiStatus> {
    // Status endpoint doesn't require authentication
    const response = await this.http.get<KalshiStatus>('/status');
    return response.data;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<AxiosResponse<unknown>> {
    return this.get('/portfolio/balance');
  }

  /**
   * Get open positions
   */
  async getPositions(): Promise<AxiosResponse<unknown>> {
    return this.get('/portfolio/positions');
  }

  /**
   * Get the configured environment
   */
  getEnvironment(): KalshiEnvironment {
    return this.config.environment;
  }

  /**
   * Get the base URL being used
   */
  getBaseURL(): string {
    return this.http.defaults.baseURL ?? '';
  }
}

export default KalshiClient;
