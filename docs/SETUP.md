# Auto Note Writer - セットアップガイド

このドキュメントでは、Auto Note Writerシステムの完全なセットアップ手順を説明します。

## 📋 前提条件

### 必要なアカウント・サービス
- [ ] Google Cloud Platform アカウント
- [ ] Amazon Associates アカウント
- [ ] Amazon Product Advertising API アクセス
- [ ] OpenAI API アカウント
- [ ] note.com アカウント
- [ ] GitHub アカウント

### 必要なツール
- [ ] Node.js 18.x 以上
- [ ] npm または yarn
- [ ] Google Cloud SDK (gcloud)
- [ ] Docker
- [ ] Git

## 🚀 セットアップ手順

### 1. プロジェクトのクローン

```bash
git clone <your-repository-url>
cd auto-note-write
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
# 環境変数テンプレートを生成
node scripts/validate-env.js template > .env

# .envファイルを編集して実際の値を設定
vim .env
```

必要な環境変数:
- `AMAZON_ACCESS_KEY`: Amazon Product Advertising API アクセスキー
- `AMAZON_SECRET_KEY`: Amazon Product Advertising API シークレットキー
- `AMAZON_ASSOCIATE_TAG`: Amazon アソシエイトタグ
- `OPENAI_API_KEY`: OpenAI API キー
- `NOTE_EMAIL`: note.com ログインメールアドレス
- `NOTE_PASSWORD`: note.com ログインパスワード
- `GCP_PROJECT_ID`: Google Cloud Project ID

### 4. 環境変数の検証

```bash
# 環境変数が正しく設定されているかチェック
node scripts/validate-env.js validate
```

### 5. Google Cloud Platform セットアップ

```bash
# GCPプロジェクトの設定
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-northeast1"

# gcloud CLIでログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project $GCP_PROJECT_ID

# 必要なAPIとリソースを作成
./cloud/setup-gcp.sh
```

### 6. シークレットの設定

```bash
# Secret Managerにシークレットを設定
./cloud/setup-secrets.sh
```

### 7. アプリケーションのビルドとデプロイ

```bash
# DockerイメージをビルドしてCloud Runにデプロイ
./cloud/deploy.sh
```

### 8. 動作確認

```bash
# ヘルスチェック
curl https://your-service-url/health

# 手動実行テスト
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"daily-post"}'
```

### 9. スケジューラーの有効化

```bash
# Cloud Schedulerジョブを有効化
gcloud scheduler jobs resume daily-note-posting --project=$GCP_PROJECT_ID
```

## 🔧 GitHub Actions の設定

### 1. GitHubリポジトリシークレットの設定

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定:

- `GCP_PROJECT_ID`: Google Cloud Project ID
- `GCP_SA_KEY`: サービスアカウントキー（JSON形式）
- `SNYK_TOKEN`: Snyk トークン（オプション）

### 2. サービスアカウントキーの取得

```bash
# サービスアカウントキーを作成
gcloud iam service-accounts keys create key.json \
  --iam-account=auto-note-writer-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com

# キーの内容をコピーしてGitHubシークレットに設定
cat key.json
```

### 3. デプロイの確認

```bash
# mainブランチにプッシュして自動デプロイを確認
git add .
git commit -m "Initial deployment"
git push origin main
```

## 📊 運用・監視

### ログの確認

```bash
# Cloud Run のログを確認
gcloud run services logs tail auto-note-writer \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID
```

### 投稿履歴の確認

```bash
# 投稿履歴を確認
curl https://your-service-url/posts/history
```

### シークレットの管理

```bash
# シークレット一覧を確認
./cloud/manage-secrets.sh list

# 特定のシークレットを更新
./cloud/manage-secrets.sh update openai-api-key
```

### スケジューラーの管理

```bash
# スケジューラージョブの状態確認
gcloud scheduler jobs list --project=$GCP_PROJECT_ID

# ジョブの一時停止
gcloud scheduler jobs pause daily-note-posting --project=$GCP_PROJECT_ID

# ジョブの再開
gcloud scheduler jobs resume daily-note-posting --project=$GCP_PROJECT_ID
```

## 🛠 トラブルシューティング

### 一般的な問題

#### 1. 環境変数が設定されていない
```bash
# 環境変数の検証
node scripts/validate-env.js validate

# Secret Managerの確認
./cloud/manage-secrets.sh list
```

#### 2. note.com ログインエラー
```bash
# パスワードを更新
./cloud/manage-secrets.sh update note-password

# 2段階認証が有効になっていないか確認
```

#### 3. Amazon API エラー
```bash
# APIキーの確認
./cloud/manage-secrets.sh show amazon-access-key

# レート制限に達していないか確認
```

#### 4. OpenAI API エラー
```bash
# APIキーの確認
./cloud/manage-secrets.sh get openai-api-key

# 利用制限に達していないか確認
```

### デバッグ方法

#### ローカルでのテスト実行
```bash
# 環境変数を設定してローカル実行
source .env
npm start

# 別ターミナルでテスト
curl -X POST http://localhost:8080/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"generate-only"}'
```

#### ログレベルの変更
```bash
# より詳細なログを出力
export LOG_LEVEL=debug
npm start
```

## 🔒 セキュリティベストプラクティス

### 1. 定期的なシークレットローテーション
```bash
# 月1回程度の頻度で実行
./cloud/manage-secrets.sh rotate-all
```

### 2. アクセス権限の最小化
- サービスアカウントには必要最小限の権限のみ付与
- Cloud Runサービスは認証済みアクセスのみに制限（必要に応じて）

### 3. 監査ログの確認
```bash
# Cloud Auditログを確認
gcloud logging read "protoPayload.serviceName=secretmanager.googleapis.com" \
  --project=$GCP_PROJECT_ID \
  --format="table(timestamp,protoPayload.methodName,protoPayload.authenticationInfo.principalEmail)"
```

## 📈 パフォーマンス最適化

### 1. Cloud Run インスタンスの調整
```bash
# 最小インスタンス数を設定（コールドスタート対策）
gcloud run services update auto-note-writer \
  --min-instances=1 \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID
```

### 2. メモリ・CPU の調整
```bash
# リソースを調整
gcloud run services update auto-note-writer \
  --memory=4Gi \
  --cpu=2 \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID
```

## 📞 サポート

問題が発生した場合は、以下の情報を含めてIssueを作成してください：

1. エラーメッセージの全文
2. 実行したコマンド
3. 環境変数の設定状況（機密情報は除く）
4. ログの出力
5. 期待される動作と実際の動作

---

## 次のステップ

セットアップが完了したら、[運用ガイド](OPERATIONS.md) を確認して日常的な運用方法を学習してください。