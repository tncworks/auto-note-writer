# Auto Note Writer - 運用ガイド

このドキュメントでは、Auto Note Writerシステムの日常的な運用方法について説明します。

## 📅 日常運用

### 毎日の確認事項

#### 1. 投稿状況の確認
```bash
# 今日の投稿を確認
curl https://your-service-url/posts/history?limit=1

# スケジューラーの実行状況を確認
gcloud scheduler jobs describe daily-note-posting \
  --project=$GCP_PROJECT_ID
```

#### 2. システムヘルスチェック
```bash
# アプリケーションのヘルスチェック
curl https://your-service-url/health

# 詳細なヘルスチェック実行
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"health-check"}'
```

#### 3. エラーログの確認
```bash
# エラーレベルのログのみ表示
gcloud run services logs tail auto-note-writer \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID \
  --filter="severity>=ERROR"
```

### 週次の確認事項

#### 1. 投稿品質のレビュー
- note.com で実際に投稿された記事を確認
- コメントや反応をチェック
- 必要に応じてキャラクター設定や投稿スタイルを調整

#### 2. システムパフォーマンスの確認
```bash
# Cloud Run のメトリクスを確認
gcloud run services describe auto-note-writer \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID \
  --format="table(status.traffic[].percent,status.traffic[].latestRevision)"

# 費用の確認
gcloud billing budgets list --billing-account=YOUR_BILLING_ACCOUNT
```

#### 3. API使用量の確認
- Amazon Product Advertising API の使用量
- OpenAI API の使用量とコスト
- GCP サービスの使用量

### 月次の確認事項

#### 1. セキュリティ監査
```bash
# Secret Manager のアクセスログ確認
gcloud logging read "protoPayload.serviceName=secretmanager.googleapis.com" \
  --project=$GCP_PROJECT_ID \
  --format="table(timestamp,protoPayload.methodName)"
```

#### 2. バックアップの確認
```bash
# 設定のバックアップ
gcloud secrets list --project=$GCP_PROJECT_ID --format="json" > secrets-backup.json
gcloud scheduler jobs list --project=$GCP_PROJECT_ID --format="json" > scheduler-backup.json
```

#### 3. 依存関係の更新
```bash
# セキュリティ脆弱性のチェック
npm audit

# 依存関係の更新
npm update
```

## 🔧 メンテナンス作業

### シークレットの更新

#### Amazon API キーのローテーション
```bash
# 1. 新しいAPIキーを Amazon で生成
# 2. Secret Manager を更新
./cloud/manage-secrets.sh update amazon-access-key
./cloud/manage-secrets.sh update amazon-secret-key

# 3. アプリケーションを再デプロイ
./cloud/deploy.sh

# 4. 動作確認
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"health-check"}'

# 5. 古いAPIキーを Amazon で無効化
```

#### OpenAI API キーのローテーション
```bash
# 1. 新しいAPIキーを OpenAI で生成
# 2. Secret Manager を更新
./cloud/manage-secrets.sh update openai-api-key

# 3. アプリケーションを再デプロイ
./cloud/deploy.sh

# 4. 動作確認
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"generate-only"}'
```

#### note.com パスワードの更新
```bash
# 1. note.com でパスワードを変更
# 2. Secret Manager を更新
./cloud/manage-secrets.sh update note-password

# 3. アプリケーションを再デプロイ
./cloud/deploy.sh
```

### システムの更新

#### アプリケーションコードの更新
```bash
# 1. コード変更をコミット
git add .
git commit -m "Feature: 新機能の追加"

# 2. GitHub にプッシュ（自動デプロイが実行される）
git push origin main

# 3. デプロイ状況を確認
gcloud run revisions list --service=auto-note-writer \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID
```

#### スケジューラーの更新
```bash
# 投稿時間を変更（例：10時に変更）
gcloud scheduler jobs update pubsub daily-note-posting \
  --schedule="0 10 * * *" \
  --project=$GCP_PROJECT_ID
```

## 🚨 トラブルシューティング

### 投稿が実行されない場合

#### 1. スケジューラーの確認
```bash
# ジョブの状態を確認
gcloud scheduler jobs describe daily-note-posting \
  --project=$GCP_PROJECT_ID

# 最近の実行履歴を確認
gcloud scheduler jobs list --project=$GCP_PROJECT_ID
```

#### 2. Pub/Sub メッセージの確認
```bash
# メッセージが配信されているか確認
gcloud pubsub subscriptions pull auto-note-writer-subscription \
  --max-messages=1 \
  --project=$GCP_PROJECT_ID
```

#### 3. 手動実行でテスト
```bash
# 直接APIを呼び出してテスト
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"daily-post"}' \
  -v
```

### 記事生成に失敗する場合

#### 1. OpenAI API の確認
```bash
# APIキーの確認
./cloud/manage-secrets.sh get openai-api-key

# 手動で記事生成をテスト
curl -X POST https://your-service-url/generate-article \
  -H "Content-Type: application/json" \
  -d '{"theme":"テスト"}' \
  -v
```

#### 2. Amazon API の確認
```bash
# 商品情報取得のテスト
# （実際のテスト方法はAmazon APIの仕様に依存）
```

### note.com 投稿に失敗する場合

#### 1. ログイン状態の確認
```bash
# 詳細ログでログインプロセスを確認
export LOG_LEVEL=debug
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"daily-post"}'
```

#### 2. note.com のUI変更対応
- note.com のUIが変更された場合、Puppeteerのセレクターを更新する必要があります
- `src/services/note-poster.js` を確認して、セレクターを最新のUIに合わせて修正

## 📊 監視とアラート

### Cloud Monitoringの設定

#### 1. アラートポリシーの作成
```bash
# Cloud Runサービスのエラー率監視
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/error-rate-policy.yaml \
  --project=$GCP_PROJECT_ID
```

#### 2. メトリクスの確認
- リクエスト数
- エラー率
- レスポンス時間
- メモリ使用量

### ログベースのアラート

#### 1. エラーログのアラート
```bash
# エラーレベルのログが発生した場合にアラート
gcloud logging sinks create error-alert \
  bigquery.googleapis.com/projects/$GCP_PROJECT_ID/datasets/logs \
  --log-filter='severity>=ERROR'
```

## 💰 コスト管理

### 使用量の監視

#### 1. GCP コストの確認
```bash
# 請求情報の確認
gcloud billing accounts list
gcloud billing projects list --billing-account=YOUR_BILLING_ACCOUNT
```

#### 2. API使用量の確認
- Amazon Product Advertising API の無料利用枠の確認
- OpenAI API の使用量とコスト
- note.com への投稿頻度（アカウント制限の確認）

### コスト最適化

#### 1. Cloud Run インスタンス数の調整
```bash
# 最小インスタンス数を0に設定（コスト削減）
gcloud run services update auto-note-writer \
  --min-instances=0 \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID
```

#### 2. ログ保存期間の調整
```bash
# ログの保存期間を設定
gcloud logging sinks create limited-retention \
  storage.googleapis.com/your-log-bucket \
  --log-filter='resource.type="cloud_run_revision"'
```

## 🔄 災害復旧

### バックアップの作成

#### 1. 設定のバックアップ
```bash
# 全体的なバックアップスクリプト
./scripts/backup-all.sh
```

#### 2. データベース（該当する場合）
- Firestore のバックアップ
- ログデータのアーカイブ

### 復旧手順

#### 1. 緊急時の手動投稿
```bash
# システムが停止した場合の手動投稿
curl -X POST https://your-service-url/execute \
  -H "Content-Type: application/json" \
  -d '{"task":"daily-post","options":{"emergency":true}}'
```

#### 2. システムの完全復旧
1. 新しいGCPプロジェクトの作成
2. `./cloud/setup-gcp.sh` の実行
3. シークレットの復旧
4. アプリケーションのデプロイ
5. スケジューラーの設定

---

## 📞 エスカレーション

重大な問題が発生した場合の連絡先とエスカレーション手順：

1. **レベル1**: システムログとドキュメントで解決を試行
2. **レベル2**: GitHub Issues で技術的な質問
3. **レベル3**: 緊急時は該当するAPIプロバイダーのサポートに連絡

---

このガイドは定期的に更新し、新しい運用知見を反映していきます。