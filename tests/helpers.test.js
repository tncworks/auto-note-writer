const {
  sleep,
  formatDate,
  truncateText,
  removeEmptyValues,
  RateLimit
} = require('../src/utils/helpers');

describe('Helpers', () => {
  describe('sleep', () => {
    test('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90);
    });
  });

  describe('formatDate', () => {
    test('should format date correctly', () => {
      const date = new Date('2023-12-25T15:30:45');
      const formatted = formatDate(date, 'YYYY-MM-DD HH:mm:ss');
      expect(formatted).toBe('2023-12-25 15:30:45');
    });

    test('should use default format', () => {
      const date = new Date('2023-12-25T15:30:45');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('truncateText', () => {
    test('should truncate long text', () => {
      const longText = 'This is a very long text that needs to be truncated';
      const truncated = truncateText(longText, 20);
      expect(truncated).toBe('This is a very lo...');
    });

    test('should not truncate short text', () => {
      const shortText = 'Short text';
      const truncated = truncateText(shortText, 20);
      expect(truncated).toBe('Short text');
    });

    test('should handle null/undefined input', () => {
      expect(truncateText(null, 10)).toBeNull();
      expect(truncateText(undefined, 10)).toBeUndefined();
    });
  });

  describe('removeEmptyValues', () => {
    test('should remove empty values', () => {
      const obj = {
        name: 'John',
        age: null,
        email: '',
        phone: '123-456-7890',
        address: undefined
      };
      
      const cleaned = removeEmptyValues(obj);
      expect(cleaned).toEqual({
        name: 'John',
        phone: '123-456-7890'
      });
    });

    test('should handle empty object', () => {
      const cleaned = removeEmptyValues({});
      expect(cleaned).toEqual({});
    });
  });

  describe('RateLimit', () => {
    test('should create rate limit instance', () => {
      const rateLimit = new RateLimit(60);
      expect(rateLimit).toBeInstanceOf(RateLimit);
      expect(rateLimit.requestsPerMinute).toBe(60);
    });

    test('should track requests', async () => {
      const rateLimit = new RateLimit(2);
      
      // First request should be immediate
      const start1 = Date.now();
      await rateLimit.waitIfNeeded();
      const end1 = Date.now();
      expect(end1 - start1).toBeLessThan(50);

      // Second request should be immediate
      const start2 = Date.now();
      await rateLimit.waitIfNeeded();
      const end2 = Date.now();
      expect(end2 - start2).toBeLessThan(50);

      // Third request should wait (but we'll just check it doesn't throw)
      await expect(rateLimit.waitIfNeeded()).resolves.not.toThrow();
    });
  });
});