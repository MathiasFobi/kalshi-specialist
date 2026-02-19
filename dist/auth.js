/**
 * Kalshi Authentication Utilities
 * Handles RSA private key loading and validation
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
const PEM_HEADER_PATTERNS = [
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----',
];
/**
 * Load and validate an RSA private key from a PEM file
 * @param keyPath - Path to the PEM file (relative or absolute)
 * @returns The validated private key content as a string
 * @throws Error if file doesn't exist or is not a valid PEM key
 */
export function loadPrivateKey(keyPath) {
    // Resolve to absolute path
    const absolutePath = path.resolve(keyPath);
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Private key file not found: ${keyPath} (resolved to ${absolutePath})`);
    }
    // Check if it's a file (not a directory)
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
        throw new Error(`Private key path is not a file: ${keyPath}`);
    }
    // Read the file
    let keyContent;
    try {
        keyContent = fs.readFileSync(absolutePath, 'utf8');
    }
    catch (error) {
        throw new Error(`Failed to read private key file: ${keyPath} - ${error.message}`);
    }
    // Trim whitespace for validation
    const trimmedContent = keyContent.trim();
    // Validate PEM format
    const hasValidHeader = PEM_HEADER_PATTERNS.some(pattern => trimmedContent.startsWith(pattern));
    if (!hasValidHeader) {
        throw new Error(`Invalid PEM format: ${keyPath} - file does not start with a recognized PEM header. ` +
            `Expected one of: ${PEM_HEADER_PATTERNS.join(', ')}`);
    }
    // Validate that there's some content after the header
    if (trimmedContent.length < 50) {
        throw new Error(`Private key file appears to be truncated or empty: ${keyPath}`);
    }
    return keyContent;
}
/**
 * Validate that a string is a valid-looking PEM private key
 * @param keyContent - The key content to validate
 * @returns true if valid PEM format
 */
export function isValidPEM(keyContent) {
    const trimmed = keyContent.trim();
    return PEM_HEADER_PATTERNS.some(pattern => trimmed.startsWith(pattern));
}
/**
 * Sign a request for Kalshi V2 API
 * Creates the required authentication headers using RSA-SHA256
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param path - The API path (e.g., /v0/portfolio/balance)
 * @param privateKey - The PEM-encoded RSA private key
 * @param keyId - The key ID (from the Kalshi dashboard key pair name)
 * @param body - Optional request body (for POST/PUT requests)
 * @returns Authentication headers object
 */
export function signRequest(method, path, privateKey, keyId, body) {
    // Generate timestamp in seconds (UTC)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // Build the string to sign following Kalshi V2 spec
    // Format: timestamp + method + path + body (body is empty string for GETs)
    const bodyString = body ?? '';
    const stringToSign = `${timestamp}${method.toUpperCase()}${path}${bodyString}`;
    // Create RSA-SHA256 signature
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(stringToSign);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');
    return {
        'KALSHI-ACCESS-KEY': keyId,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };
}
/**
 * Get the current timestamp in seconds (UTC)
 * Useful for testing or when exact timestamp control is needed
 * @returns Current timestamp as string
 */
export function getTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
}
/**
 * Create the string to sign for Kalshi V2 API
 * @param timestamp - Timestamp in seconds
 * @param method - HTTP method
 * @param path - API path
 * @param body - Request body (if any)
 * @returns The string to sign
 */
export function createStringToSign(timestamp, method, path, body) {
    const bodyString = body ?? '';
    return `${timestamp}${method.toUpperCase()}${path}${bodyString}`;
}
