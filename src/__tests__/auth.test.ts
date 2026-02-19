/**
 * Tests for auth.ts - Private Key Loading
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadPrivateKey, isValidPEM } from '../auth.js';

const TEST_DIR = '/tmp/kalshi-auth-test';
const VALID_KEY_PATH = path.join(TEST_DIR, 'valid_key.pem');
const INVALID_KEY_PATH = path.join(TEST_DIR, 'invalid_key.pem');
const NONEXISTENT_PATH = path.join(TEST_DIR, 'nonexistent.pem');

const VALID_RSA_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0GmxERXx+Ju/KdUB81YI87FUziQse+NqpFgSfnaKJLQJ47sH
/ZGcAqwOSXIke8uggJjB2Go+vi1BV8yWfTMQdmANCnJaakrNcGdkAcStJiMI6aej
QOEjqrSAcOBQZF9eCxSGOp9YzE+8Vwk2ImuR5t5k5Oj938W+fxQAhynkQ3ebGBw2
vENDXBZEylWnf/PSh1NoPDYOQIP4GPO6QQxDsOZ5XiYxMPaJSnrKrdU6qOhxEGXJ
-----END RSA PRIVATE KEY-----`;

const VALID_GENERIC_KEY = `-----BEGIN PRIVATE KEY-----
MIIEowIBAAKCAQEA0GmxERXx+Ju/KdUB81YI87FUziQse+NqpFgSfnaKJLQJ47sH
-----END PRIVATE KEY-----`;

const INVALID_KEY = `This is not a valid key file`;

const MINIMAL_EC_KEY = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBhJ
g4iO4N+9X7Z6a8bC1a9aYQ6xD5a8zQ4Q
-----END EC PRIVATE KEY-----`;

describe('loadPrivateKey', () => {
  beforeAll(() => {
    // Create test directory and files
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Valid RSA key
    fs.writeFileSync(VALID_KEY_PATH, VALID_RSA_KEY);
    
    // Invalid key file
    fs.writeFileSync(INVALID_KEY_PATH, INVALID_KEY);
  });
  
  afterAll(() => {
    // Cleanup
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });
  
  describe('success cases', () => {
    it('should load a valid RSA private key', () => {
      const key = loadPrivateKey(VALID_KEY_PATH);
      expect(key).toBeDefined();
      expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(key).toContain('-----END RSA PRIVATE KEY-----');
    });
    
    it('should handle relative paths', () => {
      // Use a relative path from the current directory
      const relativePath = path.relative(process.cwd(), VALID_KEY_PATH);
      const key = loadPrivateKey(relativePath);
      expect(key).toBeDefined();
      expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
    });
    
    it('should handle absolute paths', () => {
      const key = loadPrivateKey(VALID_KEY_PATH);
      expect(key).toBeDefined();
      expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
    });
  });
  
  describe('error handling - missing file', () => {
    it('should throw error for non-existent file', () => {
      expect(() => loadPrivateKey(NONEXISTENT_PATH)).toThrow(/Private key file not found/);
    });
    
    it('should throw error with file path in message', () => {
      expect(() => loadPrivateKey(NONEXISTENT_PATH)).toThrow(/nonexistent\.pem/);
    });
    
    it('should throw error for directory path', () => {
      expect(() => loadPrivateKey(TEST_DIR)).toThrow(/not a file/);
    });
  });
  
  describe('error handling - invalid format', () => {
    it('should throw error for file without PEM header', () => {
      expect(() => loadPrivateKey(INVALID_KEY_PATH)).toThrow(/Invalid PEM format/);
    });
    
    it('should throw error for empty file', () => {
      const emptyPath = path.join(TEST_DIR, 'empty.pem');
      fs.writeFileSync(emptyPath, '');
      expect(() => loadPrivateKey(emptyPath)).toThrow(/Invalid PEM format/);
      fs.unlinkSync(emptyPath);
    });
    
    it('should throw error for truncated key', () => {
      const truncatedPath = path.join(TEST_DIR, 'truncated.pem');
      fs.writeFileSync(truncatedPath, '-----BEGIN RSA PRIVATE KEY-----\nshort');
      expect(() => loadPrivateKey(truncatedPath)).toThrow(/truncated or empty/);
      fs.unlinkSync(truncatedPath);
    });
  });
  
  describe('PEM format variations', () => {
    it('should accept RSA private key format', () => {
      const rsaPath = path.join(TEST_DIR, 'rsa.pem');
      fs.writeFileSync(rsaPath, VALID_RSA_KEY);
      const key = loadPrivateKey(rsaPath);
      expect(isValidPEM(key)).toBe(true);
      fs.unlinkSync(rsaPath);
    });
    
    it('should accept generic PRIVATE KEY format', () => {
      const genericPath = path.join(TEST_DIR, 'generic.pem');
      fs.writeFileSync(genericPath, VALID_GENERIC_KEY);
      const key = loadPrivateKey(genericPath);
      expect(isValidPEM(key)).toBe(true);
      fs.unlinkSync(genericPath);
    });
    
    it('should accept EC private key format', () => {
      const ecPath = path.join(TEST_DIR, 'ec.pem');
      const validECKey = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBhjG/gpPjJRxYfky3uQ1YXG39XWGz8Zd0P3w6U5K8FgoAcGBSuBBAAK
oUQDQgAExVJJqSxPSwnw8Epm9B6pHJ8cB+Y+8sL9sPq3
-----END EC PRIVATE KEY-----`;
      fs.writeFileSync(ecPath, validECKey);
      const key = loadPrivateKey(ecPath);
      expect(isValidPEM(key)).toBe(true);
      fs.unlinkSync(ecPath);
    });
  });
});

describe('isValidPEM', () => {
  it('should return true for RSA private key', () => {
    expect(isValidPEM(VALID_RSA_KEY)).toBe(true);
  });
  
  it('should return true for generic PRIVATE KEY', () => {
    expect(isValidPEM(VALID_GENERIC_KEY)).toBe(true);
  });
  
  it('should return true for EC private key', () => {
    expect(isValidPEM(MINIMAL_EC_KEY)).toBe(true);
  });
  
  it('should return false for invalid key', () => {
    expect(isValidPEM(INVALID_KEY)).toBe(false);
  });
  
  it('should return false for empty string', () => {
    expect(isValidPEM('')).toBe(false);
  });
  
  it('should return false for whitespace string', () => {
    expect(isValidPEM('   \n\t   ')).toBe(false);
  });
  
  it('should return false for certificate header', () => {
    expect(isValidPEM('-----BEGIN CERTIFICATE-----')).toBe(false);
  });
});
