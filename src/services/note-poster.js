const puppeteer = require('puppeteer');
const config = require('../config');
const { logger, retryWithBackoff, sleep, getErrorMessage } = require('../utils/helpers');

class NotePoster {
  constructor() {
    this.email = config.note.email;
    this.password = config.note.password;
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  /**
   * ブラウザを初期化
   */
  async initBrowser() {
    try {
      logger.info('Initializing browser');
      
      this.browser = await puppeteer.launch({
        headless: config.app.env === 'production',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // ユーザーエージェントを設定
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // ビューポートを設定
      await this.page.setViewport({ width: 1280, height: 800 });
      
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize browser: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * note.comにログイン
   */
  async login() {
    try {
      if (this.isLoggedIn) {
        logger.info('Already logged in');
        return;
      }

      logger.info('Logging in to note.com');
      
      await this.page.goto('https://note.com/login', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // ログインフォームが表示されるまで待機
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // メールアドレスを入力
      await this.page.type('input[type="email"]', this.email, { delay: 100 });
      
      // パスワードを入力
      await this.page.type('input[type="password"]', this.password, { delay: 100 });
      
      // ログインボタンをクリック
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('button[type="submit"]')
      ]);

      // ログイン成功の確認
      await this.page.waitForSelector('.p-headerUser', { timeout: 10000 });
      
      this.isLoggedIn = true;
      logger.info('Login successful');
      
    } catch (error) {
      logger.error(`Login failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 記事を投稿
   */
  async postArticle(article, options = {}) {
    try {
      if (!this.browser || !this.page) {
        await this.initBrowser();
      }

      if (!this.isLoggedIn) {
        await this.login();
      }

      logger.info(`Posting article: ${article.title}`);

      // 記事作成ページに移動
      await this.page.goto('https://note.com/new', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // エディターが読み込まれるまで待機
      await this.page.waitForSelector('.p-entryEditor', { timeout: 15000 });
      
      // タイトルを入力
      await this.page.waitForSelector('.p-entryEditor-title textarea', { timeout: 10000 });
      await this.page.click('.p-entryEditor-title textarea');
      await this.page.keyboard.selectAll();
      await this.page.type('.p-entryEditor-title textarea', article.title, { delay: 50 });

      // 本文を入力
      await this.page.waitForSelector('.p-entryEditor-body', { timeout: 10000 });
      await this.page.click('.p-entryEditor-body');
      await sleep(1000);

      // Markdownから本文を抽出
      const bodyText = this.extractBodyText(article.content);
      await this.page.type('.p-entryEditor-body', bodyText, { delay: 30 });

      // 少し待機してから次の処理へ
      await sleep(2000);

      // 記事設定を行う（もしオプションがあれば）
      if (options.publishNow !== false) {
        await this.publishArticle(options);
      }

      logger.info('Article posted successfully');
      
      // 投稿URLを取得
      const currentUrl = this.page.url();
      
      return {
        success: true,
        url: currentUrl,
        title: article.title,
        postedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to post article: ${getErrorMessage(error)}`);
      
      // スクリーンショットを保存（デバッグ用）
      if (this.page) {
        try {
          await this.page.screenshot({ 
            path: `error-screenshot-${Date.now()}.png`,
            fullPage: true 
          });
        } catch (screenshotError) {
          logger.warn('Failed to take screenshot');
        }
      }
      
      throw error;
    }
  }

  /**
   * 記事を公開
   */
  async publishArticle(options = {}) {
    try {
      logger.info('Publishing article');

      // 公開設定ボタンをクリック
      await this.page.waitForSelector('.p-entryEditor-publishButton', { timeout: 10000 });
      await this.page.click('.p-entryEditor-publishButton');

      // 公開設定モーダルが表示されるまで待機
      await this.page.waitForSelector('.p-publishModal', { timeout: 10000 });

      // 有料記事設定（デフォルトは無料）
      if (options.isPaid) {
        await this.page.click('.p-publishModal-priceType input[value="paid"]');
        
        if (options.price) {
          await this.page.type('.p-publishModal-price input', options.price.toString());
        }
      }

      // ハッシュタグ設定
      if (options.hashtags && options.hashtags.length > 0) {
        const hashtagInput = await this.page.$('.p-publishModal-hashtags input');
        if (hashtagInput) {
          for (const hashtag of options.hashtags) {
            await this.page.type('.p-publishModal-hashtags input', hashtag);
            await this.page.keyboard.press('Enter');
            await sleep(500);
          }
        }
      }

      // 公開ボタンをクリック
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('.p-publishModal-publishButton')
      ]);

      logger.info('Article published successfully');
      
    } catch (error) {
      logger.error(`Failed to publish article: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 下書きを保存
   */
  async saveDraft(article) {
    try {
      logger.info('Saving draft');

      // Ctrl+S または Cmd+S で保存
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('s');
      await this.page.keyboard.up('Control');

      // 保存完了まで少し待機
      await sleep(2000);

      logger.info('Draft saved successfully');
      
    } catch (error) {
      logger.error(`Failed to save draft: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Markdownから本文テキストを抽出
   */
  extractBodyText(markdownContent) {
    // 基本的なMarkdownを変換
    let text = markdownContent
      .replace(/^#{1,6}\s+/gm, '') // ヘッダーを削除
      .replace(/\*\*(.*?)\*\*/g, '$1') // 太字を削除
      .replace(/\*(.*?)\*/g, '$1') // 斜体を削除
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // リンクをテキストのみに
      .replace(/^[-*+]\s+/gm, '• ') // リストマーカーを変更
      .replace(/^>\s+/gm, '') // 引用を削除
      .replace(/`([^`]+)`/g, '$1') // インラインコードを削除
      .replace(/```[\s\S]*?```/g, '') // コードブロックを削除
      .replace(/^\s*$/gm, '') // 空行を削除
      .trim();

    return text;
  }

  /**
   * 記事一覧を取得（投稿履歴確認用）
   */
  async getArticleList(limit = 10) {
    try {
      if (!this.browser || !this.page) {
        await this.initBrowser();
      }

      if (!this.isLoggedIn) {
        await this.login();
      }

      logger.info('Fetching article list');

      // プロフィールページに移動
      await this.page.goto('https://note.com/settings', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // 記事一覧を取得
      const articles = await this.page.evaluate((limit) => {
        const articleElements = document.querySelectorAll('.p-noteList-item');
        const articleList = [];

        for (let i = 0; i < Math.min(articleElements.length, limit); i++) {
          const element = articleElements[i];
          const titleElement = element.querySelector('.p-noteList-title');
          const linkElement = element.querySelector('a');
          const dateElement = element.querySelector('.p-noteList-date');

          if (titleElement && linkElement) {
            articleList.push({
              title: titleElement.textContent.trim(),
              url: linkElement.href,
              date: dateElement ? dateElement.textContent.trim() : null
            });
          }
        }

        return articleList;
      }, limit);

      logger.info(`Retrieved ${articles.length} articles`);
      return articles;

    } catch (error) {
      logger.error(`Failed to get article list: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * ブラウザを閉じる
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.error(`Failed to close browser: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 投稿制限チェック
   */
  async checkPostingLimits() {
    try {
      const recentArticles = await this.getArticleList(5);
      const today = new Date().toDateString();
      
      const todayPosts = recentArticles.filter(article => {
        const articleDate = new Date(article.date).toDateString();
        return articleDate === today;
      });

      const canPost = todayPosts.length === 0; // 1日1回の制限
      
      return {
        canPost,
        todayPostCount: todayPosts.length,
        recentArticles
      };
      
    } catch (error) {
      logger.warn(`Failed to check posting limits: ${getErrorMessage(error)}`);
      return { canPost: true, todayPostCount: 0, recentArticles: [] };
    }
  }
}

module.exports = NotePoster;