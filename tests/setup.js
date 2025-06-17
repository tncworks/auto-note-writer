// Jest テストセットアップファイル

// テスト環境で必要な環境変数を設定
process.env.NODE_ENV = 'test';

// 必須環境変数をテスト用の値で設定
process.env.AMAZON_ACCESS_KEY = 'test_amazon_access_key';
process.env.AMAZON_SECRET_KEY = 'test_amazon_secret_key';
process.env.AMAZON_ASSOCIATE_TAG = 'test-tag';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.NOTE_EMAIL = 'test@example.com';
process.env.NOTE_PASSWORD = 'test_password';
process.env.GCP_PROJECT_ID = 'test-project-id';

// ログレベルを警告以上に設定（テスト出力をクリーンに保つ）
process.env.LOG_LEVEL = 'warn';

// テスト用のモック関数
global.mockFetch = jest.fn();
global.fetch = global.mockFetch;

// 各テストの前にモックをリセット
beforeEach(() => {
  jest.clearAllMocks();
  global.mockFetch.mockClear();
});

// テスト後のクリーンアップ
afterEach(() => {
  // 必要に応じてクリーンアップ処理を追加
});

// 非同期操作のタイムアウトを設定
jest.setTimeout(30000);