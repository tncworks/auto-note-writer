const OpenAI = require('openai');
const config = require('../config');
const { logger, retryWithBackoff, RateLimit, getErrorMessage, formatDate } = require('../utils/helpers');

class ContentGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.model = config.openai.model;
    this.rateLimit = new RateLimit(config.openai.rateLimitPerMinute);
    this.character = config.character;
  }

  /**
   * 商品記事を生成
   */
  async generateProductArticle(product, options = {}) {
    try {
      await this.rateLimit.waitIfNeeded();
      
      logger.info(`Generating article for product: ${product.title}`);

      const prompt = this.buildPrompt(product, options);
      
      const response = await retryWithBackoff(async () => {
        return await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        });
      });

      const article = response.choices[0].message.content;
      
      // 記事を構造化
      const structuredArticle = this.parseArticle(article, product);
      
      logger.info('Article generated successfully');
      return structuredArticle;
      
    } catch (error) {
      logger.error(`Failed to generate article: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * システムプロンプトを取得
   */
  getSystemPrompt() {
    return `あなたは以下のキャラクター設定で note.com に投稿する記事を書くライターです：

## キャラクター設定
- シンプルでおしゃれアイテムが好き
- 仕事はプログラマっぽいなにかをしています
- 日々のくらしの一部を文字起こししてみます

## 文体・トーンの特徴
- AIっぽくない、自然で親しみやすい文章
- 日常的で親近感のある表現
- 過度に宣伝的にならない、自然な商品紹介
- 実体験があるかのような具体的な描写

## 記事構成
1. **タイトル** - 魅力的で自然、30文字以内
2. **導入** - 日常的なシーンから自然に始まる
3. **商品紹介** - 特徴や魅力を自然に説明
4. **感想や使用場面** - 実際に使っているような具体的な描写
5. **締め + CTA** - 自然な流れで紹介、最後にアソシエイト開示

## 注意事項
- 毎日投稿しても違和感のない一貫性を保つ
- 商品の良さを自然に伝える（過度な褒め言葉は避ける）
- 読者との距離感を適切に保つ
- Amazonアソシエイトリンクであることを必ず明記

記事はMarkdown形式で出力してください。`;
  }

  /**
   * ユーザープロンプトを構築
   */
  buildPrompt(product, options) {
    const currentDate = formatDate(new Date(), 'YYYY年MM月DD日');
    const timeContext = this.getTimeContext();
    
    return `以下の商品について、今日（${currentDate}）の記事を書いてください。

## 商品情報
- **商品名**: ${product.title}
- **価格**: ${product.price}
- **評価**: ${product.rating}/5 (${product.reviewCount}件のレビュー)
- **カテゴリ**: ${product.category}
- **説明**: ${product.description}
- **特徴**: ${product.features ? product.features.join(', ') : 'なし'}

## 時期的な文脈
${timeContext}

## 要件
- 記事の長さ: 800-1200文字程度
- 自然で親しみやすい文章
- 実際に使用しているような具体的な描写を含める
- 商品の魅力を自然に伝える
- 最後にAmazonアソシエイトリンクであることを明記

## 出力形式
\`\`\`markdown
# [記事タイトル]

[導入部分]

[商品紹介部分]

[感想・使用シーン部分]

[締めくくり + CTA]

---
※この記事に含まれるリンクはAmazonアソシエイトリンクです
\`\`\`

自然で読みやすい記事をお願いします。`;
  }

  /**
   * 時期的な文脈を取得
   */
  getTimeContext() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const season = this.getSeason(month);
    
    const contexts = {
      春: 'カフェやテラスでの作業時間が気持ちいい季節。新生活に向けて部屋の模様替えを考える時期。',
      夏: '暑い日が続くので、涼しい室内でのデスクワークが中心。シンプルで機能的なアイテムが重宝する季節。',
      秋: '読書の季節、集中して作業に取り組みたい時期。落ち着いた雰囲気のアイテムが恋しくなる。',
      冬: '家で過ごす時間が長くなる季節。暖かく快適な空間作りを意識したくなる時期。'
    };
    
    return contexts[season] || contexts['春'];
  }

  /**
   * 季節を取得
   */
  getSeason(month) {
    if (month >= 3 && month <= 5) return '春';
    if (month >= 6 && month <= 8) return '夏';
    if (month >= 9 && month <= 11) return '秋';
    return '冬';
  }

  /**
   * 記事を構造化してパース
   */
  parseArticle(article, product) {
    const lines = article.split('\n').filter(line => line.trim());
    
    let title = '';
    let content = '';
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) {
        if (line.startsWith('# ')) {
          title = line.replace('# ', '').trim();
        } else if (line.trim() && !line.startsWith('※') && !line.startsWith('---')) {
          content += line + '\n';
        }
      }
    }

    // タイトルが見つからない場合はデフォルトを生成
    if (!title) {
      title = this.generateDefaultTitle(product);
    }

    // アフィリエイトリンクを挿入
    const finalContent = this.insertAffiliateLink(content, product);
    
    return {
      title: title,
      content: finalContent,
      product: {
        asin: product.asin,
        title: product.title,
        price: product.price,
        affiliateUrl: product.affiliateUrl
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        characterVersion: '1.0',
        model: this.model
      }
    };
  }

  /**
   * デフォルトタイトルを生成
   */
  generateDefaultTitle(product) {
    const templates = [
      `${product.title}を使ってみた感想`,
      `最近気になっている${product.category}アイテム`,
      `シンプルで使いやすい${product.title}`,
      `デスクまわりに加えた新しいアイテム`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * アフィリエイトリンクを挿入
   */
  insertAffiliateLink(content, product) {
    // 商品名が出てくる最初の箇所にリンクを挿入
    const productNameRegex = new RegExp(product.title, 'i');
    const linkedContent = content.replace(
      productNameRegex, 
      `[${product.title}](${product.affiliateUrl})`
    );
    
    // 最後にCTAとアソシエイト開示を追加
    const cta = `\n\n商品の詳細は[こちら](${product.affiliateUrl})からご確認いただけます。\n\n---\n※この記事に含まれるリンクはAmazonアソシエイトリンクです`;
    
    return linkedContent + cta;
  }

  /**
   * 複数商品の記事を生成
   */
  async generateMultiProductArticle(products, theme = 'おすすめアイテム') {
    try {
      if (products.length === 0) {
        throw new Error('No products provided');
      }

      logger.info(`Generating multi-product article for ${products.length} products`);

      const prompt = this.buildMultiProductPrompt(products, theme);
      
      const response = await retryWithBackoff(async () => {
        return await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7
        });
      });

      const article = response.choices[0].message.content;
      return this.parseMultiProductArticle(article, products);
      
    } catch (error) {
      logger.error(`Failed to generate multi-product article: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 複数商品記事のプロンプトを構築
   */
  buildMultiProductPrompt(products, theme) {
    const currentDate = formatDate(new Date(), 'YYYY年MM月DD日');
    const productList = products.map((product, index) => 
      `${index + 1}. **${product.title}** (${product.price}) - ${product.description}`
    ).join('\n');

    return `以下の複数商品について、「${theme}」というテーマで今日（${currentDate}）の記事を書いてください。

## 商品一覧
${productList}

各商品について簡潔に紹介し、全体として統一感のある記事にしてください。
記事の長さ: 1000-1500文字程度`;
  }

  /**
   * 複数商品記事をパース
   */
  parseMultiProductArticle(article, products) {
    const parsed = this.parseArticle(article, products[0]);
    
    // 全商品のアフィリエイトリンクを最後に追加
    const allLinks = products.map(product => 
      `- [${product.title}](${product.affiliateUrl})`
    ).join('\n');
    
    parsed.content += `\n\n## 紹介した商品\n${allLinks}`;
    
    return parsed;
  }
}

module.exports = ContentGenerator;