import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('Config', () => {
  it('loads config with defaults', () => {
    expect(config.port).toBeDefined();
    expect(config.clientUrl).toBeDefined();
  });
  
  it('identifies environment correctly', () => {
    expect(config.isTest).toBe(true);
    expect(config.isProd).toBe(false);
  });
});
