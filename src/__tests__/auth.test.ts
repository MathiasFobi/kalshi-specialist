/**
 * Tests for auth.ts - Private Key Loading
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { loadPrivateKey, isValidPEM, signRequest, createStringToSign } from '../auth.js';

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

// Generate a real RSA key pair for testing signing
const TEST_KEY_PAIR = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const TEST_SIGNING_KEY = TEST_KEY_PAIR.privateKey;

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

describe('signRequest', () => {
  const TEST_KEY_ID = 'test-key-id-123';
  const TEST_TIMESTAMP = '1234567890';
  const TEST_METHOD = 'GET';
  const TEST_PATH = '/v0/portfolio/balance';

  beforeEach(() => {
    // Mock Date.now() to return consistent timestamp
    vi.useFakeTimers();
    vi.setSystemTime(parseInt(TEST_TIMESTAMP) * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GET requests', () => {
    it('should generate all required headers', () => {
      const headers = signRequest(TEST_METHOD, TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);

      expect(headers).toHaveProperty('KALSHI-ACCESS-KEY');
      expect(headers).toHaveProperty('KALSHI-ACCESS-SIGNATURE');
      expect(headers).toHaveProperty('KALSHI-ACCESS-TIMESTAMP');
    });

    it('should set KALSHI-ACCESS-KEY to the provided keyId', () => {
      const headers = signRequest(TEST_METHOD, TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);
      expect(headers['KALSHI-ACCESS-KEY']).toBe(TEST_KEY_ID);
    });

    it('should set KALSHI-ACCESS-TIMESTAMP to current timestamp in seconds', () => {
      const headers = signRequest(TEST_METHOD, TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);
      expect(headers['KALSHI-ACCESS-TIMESTAMP']).toBe(TEST_TIMESTAMP);
    });

    it('should generate base64-encoded signature', () => {
      const headers = signRequest(TEST_METHOD, TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);
      // Base64 strings only contain valid base64 characters
      expect(headers['KALSHI-ACCESS-SIGNATURE']).toMatch(/^[A-Za-z0-9+/=]+$/);
      // Should be reasonable length for RSA-SHA256 signature
      expect(headers['KALSHI-ACCESS-SIGNATURE'].length).toBeGreaterThan(50);
    });

    it('should produce valid signature that can be verified', () => {
      const headers = signRequest(TEST_METHOD, TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);
      const signature = headers['KALSHI-ACCESS-SIGNATURE'];
      const stringToSign = `${TEST_TIMESTAMP}GET${TEST_PATH}`;

      // Verify the signature with the public key
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(stringToSign);
      verify.end();

      const isValid = verify.verify(TEST_KEY_PAIR.publicKey, signature, 'base64');
      expect(isValid).toBe(true);
    });

    it('should handle lowercase method by uppercasing it', () => {
      const headers = signRequest('get', TEST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);
      const signature = headers['KALSHI-ACCESS-SIGNATURE'];
      const stringToSign = `${TEST_TIMESTAMP}GET${TEST_PATH}`;

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(stringToSign);
      verify.end();

      const isValid = verify.verify(TEST_KEY_PAIR.publicKey, signature, 'base64');
      expect(isValid).toBe(true);
    });
  });

  describe('POST requests', () => {
    const POST_PATH = '/v0/portfolio/orders';
    const POST_BODY = '{"market_id":"ABC-123","amount":100}';

    it('should include body in signature calculation', () => {
      const headers = signRequest('POST', POST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID, POST_BODY);
      const signature = headers['KALSHI-ACCESS-SIGNATURE'];
      const stringToSign = `${TEST_TIMESTAMP}POST${POST_PATH}${POST_BODY}`;

      // Verify the signature includes the body
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(stringToSign);
      verify.end();

      const isValid = verify.verify(TEST_KEY_PAIR.publicKey, signature, 'base64');
      expect(isValid).toBe(true);
    });

    it('should generate different signature with body vs without', () => {
      const withBody = signRequest('POST', POST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID, POST_BODY);
      const withoutBody = signRequest('POST', POST_PATH, TEST_SIGNING_KEY, TEST_KEY_ID);

      expect(withBody['KALSHI-ACCESS-SIGNATURE']).not.toBe(withoutBody['KALSHI-ACCESS-SIGNATURE']);
    });
  });

  describe('different HTTP methods', () => {
    it('should handle PUT requests', () => {
      const headers = signRequest('PUT', '/v0/test', TEST_SIGNING_KEY, TEST_KEY_ID, '{"data":1}');
      expect(headers['KALSHI-ACCESS-KEY']).toBe(TEST_KEY_ID);
      expect(headers['KALSHI-ACCESS-SIGNATURE']).toBeDefined();
    });

    it('should handle DELETE requests', () => {
      const headers = signRequest('DELETE', '/v0/test/123', TEST_SIGNING_KEY, TEST_KEY_ID);
      expect(headers['KALSHI-ACCESS-KEY']).toBe(TEST_KEY_ID);
      expect(headers['KALSHI-ACCESS-SIGNATURE']).toBeDefined();
    });
  });
});

describe('createStringToSign', () => {
  it('should create string to sign for GET request without body', () => {
    const result = createStringToSign('1234567890', 'GET', '/v0/portfolio/balance');
    expect(result).toBe('1234567890GET/v0/portfolio/balance');
  });

  it('should create string to sign for POST request with body', () => {
    const result = createStringToSign('1234567890', 'POST', '/v0/orders', '{"amount":100}');
    expect(result).toBe('1234567890POST/v0/orders{"amount":100}');
  });

  it('should uppercase the HTTP method', () => {
    const result = createStringToSign('1234567890', 'post', '/v0/test');
    expect(result).toBe('1234567890POST/v0/test');
  });

  it('should handle empty body as empty string', () => {
    const result = createStringToSign('1234567890', 'GET', '/v0/test');
    expect(result).toBe('1234567890GET/v0/test');
  });

  it('should handle undefined body as empty string', () => {
    const result = createStringToSign('1234567890', 'GET', '/v0/test', undefined);
    expect(result).toBe('1234567890GET/v0/test');
  });
});
