const config = require('../src/config');

// テスト用の環境変数設定
process.env.AMAZON_ACCESS_KEY = 'test_access_key';
process.env.AMAZON_SECRET_KEY = 'test_secret_key';
process.env.AMAZON_ASSOCIATE_TAG = 'test_tag';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.NOTE_EMAIL = 'test@example.com';
process.env.NOTE_PASSWORD = 'test_password';
process.env.GCP_PROJECT_ID = 'test_project';

describe('Config', () => {
  test('should load configuration properly', () => {
    expect(config).toBeDefined();
    expect(config.amazon).toBeDefined();
    expect(config.openai).toBeDefined();
    expect(config.note).toBeDefined();
    expect(config.gcp).toBeDefined();
    expect(config.app).toBeDefined();
    expect(config.content).toBeDefined();
    expect(config.character).toBeDefined();
  });

  test('should have required Amazon API configuration', () => {
    expect(config.amazon.accessKey).toBe('test_access_key');
    expect(config.amazon.secretKey).toBe('test_secret_key');
    expect(config.amazon.associateTag).toBe('test_tag');
    expect(config.amazon.region).toBeDefined();
  });

  test('should have required OpenAI configuration', () => {
    expect(config.openai.apiKey).toBe('test_openai_key');
    expect(config.openai.model).toBeDefined();
  });

  test('should have required note.com configuration', () => {
    expect(config.note.email).toBe('test@example.com');
    expect(config.note.password).toBe('test_password');
  });

  test('should have character configuration', () => {
    expect(config.character.personality).toBeInstanceOf(Array);
    expect(config.character.personality.length).toBeGreaterThan(0);
    expect(config.character.tone).toBeDefined();
    expect(config.character.structure).toBeInstanceOf(Array);
  });

  test('should have content configuration with defaults', () => {
    expect(config.content.maxProductsPerPost).toBeGreaterThan(0);
    expect(config.content.minReviewRating).toBeGreaterThan(0);
    expect(config.content.preferredCategories).toBeInstanceOf(Array);
  });
});