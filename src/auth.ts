/**
 * Kalshi Authentication Utilities
 * Handles RSA private key loading and validation
 */

import * as fs from 'fs';
import * as path from 'path';

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
export function loadPrivateKey(keyPath: string): string {
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
  let keyContent: string;
  try {
    keyContent = fs.readFileSync(absolutePath, 'utf8');
  } catch (error: any) {
    throw new Error(`Failed to read private key file: ${keyPath} - ${error.message}`);
  }
  
  // Trim whitespace for validation
  const trimmedContent = keyContent.trim();
  
  // Validate PEM format
  const hasValidHeader = PEM_HEADER_PATTERNS.some(pattern => 
    trimmedContent.startsWith(pattern)
  );
  
  if (!hasValidHeader) {
    throw new Error(
      `Invalid PEM format: ${keyPath} - file does not start with a recognized PEM header. ` +
      `Expected one of: ${PEM_HEADER_PATTERNS.join(', ')}`
    );
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
export function isValidPEM(keyContent: string): boolean {
  const trimmed = keyContent.trim();
  return PEM_HEADER_PATTERNS.some(pattern => trimmed.startsWith(pattern));
}
