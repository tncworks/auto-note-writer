# Auto Note Writer

毎日note.comに自動投稿するシステム。シンプルでおしゃれなAmazonアソシエイト商品を紹介する記事を自動生成・投稿します。

## システムアーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cloud Scheduler │───▶│    Pub/Sub      │───▶│   Cloud Run     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Amazon API     │◀───┤  Main Service   │───▶│   note.com API  │
│  (商品情報)      │    │  (記事生成)      │    │  (記事投稿)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                      ┌─────────────────┐
                      │   OpenAI API    │
                      │   (記事生成)     │
                      └─────────────────┘
```

## 主要機能

### 1. 商品選定 (Amazon Product Advertising API)
- ベストセラー商品の取得
- レビュー評価の高い商品の抽出
- 「シンプル・おしゃれ」カテゴリの商品選定

### 2. 記事生成 (OpenAI GPT)
- 自然で親しみやすい文章生成
- 一貫したキャラクター設定
- Amazonアソシエイトリンク付与

### 3. 自動投稿 (note.com)
- 毎日定時投稿
- 適切な開示文の自動付与
- 投稿エラーハンドリング

## 技術スタック

- **言語**: Node.js (JavaScript)
- **API**: Amazon Product Advertising API, OpenAI API, note.com API
- **インフラ**: Google Cloud Platform
  - Cloud Run (メインアプリケーション)
  - Cloud Scheduler (定時実行)
  - Pub/Sub (メッセージキュー)
  - Secret Manager (認証情報管理)
- **CI/CD**: GitHub Actions
  - 自動テスト
  - 自動デプロイ
- **管理画面**: Firebase (Hosting + Firestore)

## ディレクトリ構成

```
auto-note-writer/
├── src/
│   ├── services/
│   │   ├── amazon-api.js      # Amazon API連携
│   │   ├── content-generator.js # GPT記事生成
│   │   └── note-poster.js     # note投稿
│   ├── config/
│   │   └── index.js          # 設定管理
│   ├── utils/
│   │   └── helpers.js        # ユーティリティ
│   └── main.js               # メインエントリーポイント
├── cloud/
│   ├── cloud-run/            # Cloud Run設定
│   └── cloud-functions/      # Cloud Functions設定
├── dashboard/                # Firebase管理画面
├── .github/
│   └── workflows/           # GitHub Actions
├── docker/
│   └── Dockerfile
├── package.json
├── .env.example
└── README.md
```

## セットアップ

### 必要な API キー
- Amazon Product Advertising API
- OpenAI API Key
- note.com API (または認証情報)

### 環境変数
```
AMAZON_ACCESS_KEY=
AMAZON_SECRET_KEY=
AMAZON_ASSOCIATE_TAG=
OPENAI_API_KEY=
NOTE_EMAIL=
NOTE_PASSWORD=
GCP_PROJECT_ID=
```

## 注意事項

### 利用規約・倫理的配慮
- Amazon アソシエイトプログラムの利用規約を遵守
- note.com の利用規約を遵守（自動投稿に関する規約確認が必要）
- 適切な開示文の表示義務

### APIレート制限
- Amazon API: 1日のリクエスト数制限
- OpenAI API: 分あたりのリクエスト数制限
- note.com: 投稿頻度制限

### セキュリティ
- API キーは環境変数で管理
- GCP Secret Manager での認証情報管理
- 定期的なキーローテーション

## 投稿スタイル

### キャラクター設定
- 「シンプルでおしゃれアイテムが好き」
- 「仕事はプログラマっぽいなにかをしています」
- 「日々のくらしの一部を文字起こししてみます」

### 記事構成
1. タイトル（魅力的で自然）
2. 導入（日常的なシーン）
3. 商品紹介（特徴・魅力）
4. 感想や使用場面
5. 締め + CTA + アソシエイト開示

## デプロイ・運用

### 手動デプロイ
```bash
# 環境変数設定
cp .env.example .env
# 依存関係インストール
npm install
# ローカル実行
npm start
```

### 自動デプロイ
- GitHub Actions による自動デプロイ
- mainブランチへのプッシュで自動デプロイ実行

## ライセンス
MIT License