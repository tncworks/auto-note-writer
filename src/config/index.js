const dotenv = require('dotenv');

// 環境変数を読み込み
dotenv.config();

const config = {
  // Amazon API設定
  amazon: {
    accessKey: process.env.AMAZON_ACCESS_KEY,
    secretKey: process.env.AMAZON_SECRET_KEY,
    associateTag: process.env.AMAZON_ASSOCIATE_TAG,
    region: process.env.AMAZON_REGION || 'us-east-1',
    endpoint: 'webservices.amazon.com',
    rateLimitPerSecond: parseInt(process.env.AMAZON_API_RATE_LIMIT) || 10
  },

  // OpenAI API設定
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    rateLimitPerMinute: parseInt(process.env.OPENAI_API_RATE_LIMIT) || 60
  },

  // note.com設定
  note: {
    email: process.env.NOTE_EMAIL,
    password: process.env.NOTE_PASSWORD,
    postIntervalHours: parseInt(process.env.NOTE_POST_INTERVAL) || 24
  },

  // GCP設定
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
  },

  // アプリケーション設定
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 8080,
    logLevel: process.env.LOG_LEVEL || 'info',
    postingTime: process.env.POSTING_TIME || '09:00',
    timezone: process.env.TIMEZONE || 'Asia/Tokyo'
  },

  // コンテンツ設定
  content: {
    maxProductsPerPost: parseInt(process.env.MAX_PRODUCTS_PER_POST) || 1,
    minReviewRating: parseFloat(process.env.MIN_REVIEW_RATING) || 4.0,
    preferredCategories: process.env.PREFERRED_CATEGORIES 
      ? process.env.PREFERRED_CATEGORIES.split(',') 
      : ['Home', 'Electronics', 'Fashion']
  },

  // キャラクター設定
  character: {
    personality: [
      'シンプルでおしゃれアイテムが好き',
      '仕事はプログラマっぽいなにかをしています',
      '日々のくらしの一部を文字起こししてみます'
    ],
    tone: 'AIっぽくない、自然で親しみやすい文章',
    structure: [
      'タイトル',
      '導入',
      '商品紹介',
      '感想や日常シーン',
      '締め＋CTA'
    ]
  }
};

// 必須の環境変数をチェック
const requiredEnvVars = [
  'AMAZON_ACCESS_KEY',
  'AMAZON_SECRET_KEY', 
  'AMAZON_ASSOCIATE_TAG',
  'OPENAI_API_KEY',
  'NOTE_EMAIL',
  'NOTE_PASSWORD',
  'GCP_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('必須の環境変数が設定されていません:');
  missingVars.forEach(varName => console.error(`- ${varName}`));
  process.exit(1);
}

module.exports = config;