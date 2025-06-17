const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const config = require('./config');
const { logger, getErrorMessage } = require('./utils/helpers');
const AmazonAPI = require('./services/amazon-api');
const ContentGenerator = require('./services/content-generator');
const NotePoster = require('./services/note-poster');

class AutoNoteWriter {
  constructor() {
    this.app = express();
    this.port = config.app.port;
    this.pubsub = new PubSub({ projectId: config.gcp.projectId });
    
    // サービスインスタンス
    this.amazonAPI = new AmazonAPI();
    this.contentGenerator = new ContentGenerator();
    this.notePoster = new NotePoster();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * ミドルウェアをセットアップ
   */
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // ログ用ミドルウェア
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // エラーハンドリング
    this.app.use((err, req, res, next) => {
      logger.error('Express error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: config.app.env === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  /**
   * ルートをセットアップ
   */
  setupRoutes() {
    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Pub/Subメッセージ受信用エンドポイント
    this.app.post('/pubsub/trigger', async (req, res) => {
      try {
        const message = req.body.message;
        
        if (!message || !message.data) {
          logger.warn('Invalid Pub/Sub message received');
          return res.status(400).json({ error: 'Invalid message format' });
        }

        // Base64デコード
        const data = Buffer.from(message.data, 'base64').toString();
        const taskData = JSON.parse(data);

        logger.info('Received Pub/Sub message:', taskData);

        // タスクを実行
        await this.executeTask(taskData);

        res.json({ status: 'success', message: 'Task executed' });
      } catch (error) {
        logger.error(`Pub/Sub handler error: ${getErrorMessage(error)}`);
        res.status(500).json({ error: 'Task execution failed' });
      }
    });

    // 手動実行用エンドポイント
    this.app.post('/execute', async (req, res) => {
      try {
        const { task = 'daily-post', ...options } = req.body;
        
        const result = await this.executeTask({ task, options });
        
        res.json({
          status: 'success',
          result
        });
      } catch (error) {
        logger.error(`Manual execution error: ${getErrorMessage(error)}`);
        res.status(500).json({
          error: 'Execution failed',
          message: error.message
        });
      }
    });

    // 記事生成のみ（テスト用）
    this.app.post('/generate-article', async (req, res) => {
      try {
        const { productId, theme } = req.body;
        
        let product;
        if (productId) {
          product = await this.amazonAPI.getProductDetails(productId);
        } else {
          const products = await this.amazonAPI.getStylishProducts(1);
          product = products[0];
        }

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const article = await this.contentGenerator.generateProductArticle(product, { theme });
        
        res.json({
          status: 'success',
          article,
          product: {
            asin: product.asin,
            title: product.title,
            price: product.price
          }
        });
      } catch (error) {
        logger.error(`Article generation error: ${getErrorMessage(error)}`);
        res.status(500).json({
          error: 'Article generation failed',
          message: error.message
        });
      }
    });

    // 投稿履歴確認
    this.app.get('/posts/history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 10;
        const articles = await this.notePoster.getArticleList(limit);
        
        res.json({
          status: 'success',
          articles
        });
      } catch (error) {
        logger.error(`History fetch error: ${getErrorMessage(error)}`);
        res.status(500).json({
          error: 'Failed to fetch history',
          message: error.message
        });
      }
    });
  }

  /**
   * タスクを実行
   */
  async executeTask(taskData) {
    const { task, options = {} } = taskData;

    switch (task) {
      case 'daily-post':
        return await this.executeDailyPost(options);
      case 'generate-only':
        return await this.executeGenerateOnly(options);
      case 'health-check':
        return await this.executeHealthCheck();
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  /**
   * 毎日の投稿を実行
   */
  async executeDailyPost(options = {}) {
    try {
      logger.info('Starting daily post execution');

      // 投稿制限をチェック
      const limitCheck = await this.notePoster.checkPostingLimits();
      if (!limitCheck.canPost) {
        logger.warn('Daily posting limit reached, skipping');
        return { 
          status: 'skipped', 
          reason: 'Daily limit reached',
          todayPostCount: limitCheck.todayPostCount 
        };
      }

      // 商品を取得
      const products = await this.amazonAPI.getStylishProducts(
        options.productCount || config.content.maxProductsPerPost
      );

      if (products.length === 0) {
        throw new Error('No products found');
      }

      const selectedProduct = products[0];
      logger.info(`Selected product: ${selectedProduct.title}`);

      // 記事を生成
      const article = await this.contentGenerator.generateProductArticle(
        selectedProduct,
        options
      );

      // 投稿
      const postResult = await this.notePoster.postArticle(article, {
        publishNow: options.publishNow !== false,
        hashtags: options.hashtags || ['シンプル', 'おしゃれ', 'アイテム']
      });

      logger.info('Daily post completed successfully');

      return {
        status: 'success',
        article: {
          title: article.title,
          productTitle: selectedProduct.title,
          productASIN: selectedProduct.asin
        },
        postResult
      };

    } catch (error) {
      logger.error(`Daily post execution failed: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      // リソースをクリーンアップ
      await this.notePoster.close();
    }
  }

  /**
   * 記事生成のみを実行
   */
  async executeGenerateOnly(options = {}) {
    try {
      logger.info('Starting article generation only');

      const products = await this.amazonAPI.getStylishProducts(1);
      if (products.length === 0) {
        throw new Error('No products found');
      }

      const article = await this.contentGenerator.generateProductArticle(
        products[0],
        options
      );

      return {
        status: 'success',
        article,
        product: products[0]
      };

    } catch (error) {
      logger.error(`Article generation failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * ヘルスチェックを実行
   */
  async executeHealthCheck() {
    const checks = {
      amazonAPI: false,
      openaiAPI: false,
      noteLogin: false
    };

    try {
      // Amazon API テスト
      await this.amazonAPI.getStylishProducts(1);
      checks.amazonAPI = true;
    } catch (error) {
      logger.warn('Amazon API health check failed:', error.message);
    }

    try {
      // OpenAI API テスト
      await this.contentGenerator.generateProductArticle({
        title: 'Test Product',
        description: 'Test Description',
        price: '¥1,000',
        features: ['Test feature']
      });
      checks.openaiAPI = true;
    } catch (error) {
      logger.warn('OpenAI API health check failed:', error.message);
    }

    try {
      // Note.com ログインテスト
      await this.notePoster.initBrowser();
      await this.notePoster.login();
      await this.notePoster.close();
      checks.noteLogin = true;
    } catch (error) {
      logger.warn('Note.com login health check failed:', error.message);
    }

    const allHealthy = Object.values(checks).every(check => check === true);

    return {
      status: allHealthy ? 'healthy' : 'partial',
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * サーバーを起動
   */
  start() {
    this.app.listen(this.port, () => {
      logger.info(`Auto Note Writer server started on port ${this.port}`);
      logger.info(`Environment: ${config.app.env}`);
    });
  }

  /**
   * グレースフルシャットダウン
   */
  async shutdown() {
    logger.info('Shutting down gracefully...');
    
    try {
      await this.notePoster.close();
      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// メイン実行
if (require.main === module) {
  const app = new AutoNoteWriter();
  app.start();

  // グレースフルシャットダウン
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received');
    await app.shutdown();
    process.exit(0);
  });
}

module.exports = AutoNoteWriter;