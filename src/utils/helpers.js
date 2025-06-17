const crypto = require('crypto');
const winston = require('winston');

// ロガーを設定
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * 遅延実行用のユーティリティ関数
 * @param {number} ms - 遅延時間（ミリ秒）
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ランダムな遅延を追加（レート制限対策）
 * @param {number} min - 最小遅延時間（ミリ秒）
 * @param {number} max - 最大遅延時間（ミリ秒）
 */
const randomDelay = async (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(delay);
};

/**
 * リトライ機能付きの関数実行
 * @param {Function} fn - 実行する関数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} baseDelay - 基本遅延時間（ミリ秒）
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 指数バックオフ
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
};

/**
 * Amazon APIの署名を生成
 * @param {string} method - HTTPメソッド
 * @param {string} host - ホスト名
 * @param {string} path - パス
 * @param {Object} params - パラメータ
 * @param {string} secretKey - シークレットキー
 */
const generateAmazonSignature = (method, host, path, params, secretKey) => {
  // パラメータをソート
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // 署名文字列を作成
  const stringToSign = `${method}\n${host}\n${path}\n${sortedParams}`;
  
  // HMAC-SHA256で署名
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign)
    .digest('base64');

  return signature;
};

/**
 * エラーメッセージを安全に取得
 * @param {Error} error - エラーオブジェクト
 */
const getErrorMessage = (error) => {
  if (error.response) {
    return `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`;
  }
  return error.message || 'Unknown error';
};

/**
 * 日付を指定フォーマットで取得
 * @param {Date} date - 日付オブジェクト
 * @param {string} format - フォーマット
 */
const formatDate = (date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 日本時間を取得
 */
const getJapanTime = () => {
  return new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo'
  });
};

/**
 * 文字列を安全にトリミング
 * @param {string} text - 対象文字列
 * @param {number} maxLength - 最大長
 */
const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * オブジェクトから空の値を削除
 * @param {Object} obj - 対象オブジェクト
 */
const removeEmptyValues = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
  );
};

/**
 * レート制限管理クラス
 */
class RateLimit {
  constructor(requestsPerMinute = 60) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 1分以内のリクエスト数を計算
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + 60000 - now;
      
      if (waitTime > 0) {
        logger.info(`Rate limit reached. Waiting ${waitTime}ms`);
        await sleep(waitTime);
      }
    }
    
    this.requests.push(now);
  }
}

module.exports = {
  logger,
  sleep,
  randomDelay,
  retryWithBackoff,
  generateAmazonSignature,
  getErrorMessage,
  formatDate,
  getJapanTime,
  truncateText,
  removeEmptyValues,
  RateLimit
};