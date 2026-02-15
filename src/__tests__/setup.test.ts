import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('Project Setup', () => {
  it('should have axios available', () => {
    expect(axios).toBeDefined();
    expect(typeof axios.get).toBe('function');
    expect(typeof axios.post).toBe('function');
  });

  it('should have vitest working', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript imports', async () => {
    // Dynamic import to verify module system works
    const indexModule = await import('../index.js');
    expect(indexModule).toBeDefined();
  });
});
