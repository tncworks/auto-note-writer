const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const { logger, retryWithBackoff, RateLimit, getErrorMessage } = require('../utils/helpers');

class AmazonAPI {
  constructor() {
    this.accessKey = config.amazon.accessKey;
    this.secretKey = config.amazon.secretKey;
    this.associateTag = config.amazon.associateTag;
    this.region = config.amazon.region;
    this.endpoint = `https://${config.amazon.endpoint}`;
    this.rateLimit = new RateLimit(config.amazon.rateLimitPerSecond * 60);
  }

  /**
   * Amazon APIリクエストの署名を生成
   */
  generateSignature(method, host, path, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const stringToSign = `${method}\n${host}\n${path}\n${sortedParams}`;
    
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('base64');
  }

  /**
   * Amazon APIリクエストを実行
   */
  async makeRequest(operation, params = {}) {
    await this.rateLimit.waitIfNeeded();

    const baseParams = {
      'Service': 'AWSECommerceService',
      'Operation': operation,
      'AWSAccessKeyId': this.accessKey,
      'AssociateTag': this.associateTag,
      'Timestamp': new Date().toISOString(),
      'SignatureMethod': 'HmacSHA256',
      'SignatureVersion': '2',
      'Version': '2013-08-01',
      ...params
    };

    const host = config.amazon.endpoint;
    const path = '/onca/xml';
    const signature = this.generateSignature('GET', host, path, baseParams);
    
    baseParams.Signature = signature;

    const queryString = Object.keys(baseParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(baseParams[key])}`)
      .join('&');

    const url = `${this.endpoint}${path}?${queryString}`;

    try {
      const response = await retryWithBackoff(async () => {
        return await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'AutoNoteWriter/1.0'
          }
        });
      });

      return response.data;
    } catch (error) {
      logger.error(`Amazon API request failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * ベストセラー商品を取得
   */
  async getBestSellers(category = 'All', page = 1) {
    try {
      logger.info(`Fetching bestsellers for category: ${category}`);
      
      const params = {
        'BrowseNodeId': this.getCategoryNodeId(category),
        'ResponseGroup': 'ItemAttributes,Images,Reviews,EditorialReview'
      };

      const response = await this.makeRequest('BrowseNodeLookup', params);
      return this.parseProductResponse(response);
    } catch (error) {
      logger.error(`Failed to get bestsellers: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 商品検索（キーワード）
   */
  async searchProducts(keywords, category = 'All', minRating = 4.0) {
    try {
      logger.info(`Searching products: ${keywords}`);
      
      const params = {
        'Keywords': keywords,
        'SearchIndex': category,
        'ResponseGroup': 'ItemAttributes,Images,Reviews,EditorialReview',
        'Sort': 'salesrank'
      };

      const response = await this.makeRequest('ItemSearch', params);
      const products = this.parseProductResponse(response);
      
      // レビュー評価でフィルタリング
      return products.filter(product => 
        !product.rating || product.rating >= minRating
      );
    } catch (error) {
      logger.error(`Failed to search products: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 商品詳細情報を取得
   */
  async getProductDetails(asin) {
    try {
      logger.info(`Fetching product details for ASIN: ${asin}`);
      
      const params = {
        'ItemId': asin,
        'ResponseGroup': 'ItemAttributes,Images,Reviews,EditorialReview,SalesRank'
      };

      const response = await this.makeRequest('ItemLookup', params);
      return this.parseProductResponse(response)[0];
    } catch (error) {
      logger.error(`Failed to get product details: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * おしゃれ・シンプル系商品を取得
   */
  async getStylishProducts(limit = 10) {
    try {
      logger.info('Fetching stylish products');
      
      const categories = ['Home', 'Kitchen', 'Electronics', 'Fashion'];
      const keywords = [
        'ミニマル',
        'シンプル',
        'おしゃれ',
        'モダン',
        'スタイリッシュ',
        '北欧',
        'デザイン'
      ];

      const allProducts = [];

      for (const category of categories) {
        for (const keyword of keywords.slice(0, 2)) { // レート制限対策
          try {
            const products = await this.searchProducts(
              keyword, 
              category, 
              config.content.minReviewRating
            );
            allProducts.push(...products);
            
            if (allProducts.length >= limit * 2) break;
          } catch (error) {
            logger.warn(`Failed to search ${keyword} in ${category}: ${error.message}`);
          }
        }
        if (allProducts.length >= limit * 2) break;
      }

      // 重複除去とソート
      const uniqueProducts = this.removeDuplicateProducts(allProducts);
      const sortedProducts = this.sortProductsByRelevance(uniqueProducts);
      
      return sortedProducts.slice(0, limit);
    } catch (error) {
      logger.error(`Failed to get stylish products: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 商品レスポンスをパース
   */
  parseProductResponse(response) {
    // Amazon APIのXMLレスポンスをパースして商品情報を抽出
    // 実際の実装では xml2js などを使用してXMLをパース
    
    const products = [];
    
    // デモ用のダミーデータ（実際はXMLパースが必要）
    if (response) {
      const dummyProduct = {
        asin: 'B08N5WRWNW',
        title: 'シンプルモダンデスクランプ',
        price: '¥4,980',
        image: 'https://example.com/lamp.jpg',
        rating: 4.5,
        reviewCount: 127,
        description: 'ミニマルデザインのLEDデスクランプ。調光機能付きで作業に最適。',
        category: 'Home',
        features: [
          'LED照明で省エネ',
          '無段階調光機能',
          'ミニマルデザイン',
          'USB充電ポート付き'
        ],
        affiliateUrl: `https://www.amazon.co.jp/dp/B08N5WRWNW?tag=${this.associateTag}`
      };
      
      products.push(dummyProduct);
    }
    
    return products;
  }

  /**
   * カテゴリのノードIDを取得
   */
  getCategoryNodeId(category) {
    const nodeIds = {
      'All': '465392',
      'Electronics': '3210981',
      'Home': '2016926051',
      'Kitchen': '2016929051',
      'Fashion': '2016930051'
    };
    
    return nodeIds[category] || nodeIds['All'];
  }

  /**
   * 重複商品を除去
   */
  removeDuplicateProducts(products) {
    const seen = new Set();
    return products.filter(product => {
      if (seen.has(product.asin)) {
        return false;
      }
      seen.add(product.asin);
      return true;
    });
  }

  /**
   * 商品を関連度でソート
   */
  sortProductsByRelevance(products) {
    return products.sort((a, b) => {
      // レビュー評価 * レビュー数でスコア計算
      const scoreA = (a.rating || 0) * Math.log(a.reviewCount || 1);
      const scoreB = (b.rating || 0) * Math.log(b.reviewCount || 1);
      return scoreB - scoreA;
    });
  }

  /**
   * アフィリエイトリンクを生成
   */
  generateAffiliateLink(asin, additionalParams = {}) {
    const baseUrl = `https://www.amazon.co.jp/dp/${asin}`;
    const params = new URLSearchParams({
      tag: this.associateTag,
      ...additionalParams
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
}

module.exports = AmazonAPI;