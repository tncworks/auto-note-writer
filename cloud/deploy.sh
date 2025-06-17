#!/bin/bash

# デプロイスクリプト
# Cloud Runにアプリケーションをデプロイします

set -e

# 設定変数
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="auto-note-writer"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# 色付きログ出力
log_info() {
    echo -e "\e[32m[INFO]\e[0m $1"
}

log_warn() {
    echo -e "\e[33m[WARN]\e[0m $1"
}

log_error() {
    echo -e "\e[31m[ERROR]\e[0m $1"
}

# プロジェクトIDの確認
if [ -z "$PROJECT_ID" ]; then
    log_error "GCP_PROJECT_ID環境変数が設定されていません"
    exit 1
fi

log_info "デプロイ開始 - プロジェクト: $PROJECT_ID"
log_info "リージョン: $REGION"
log_info "サービス名: $SERVICE_NAME"

# プロジェクトルートディレクトリに移動
cd "$(dirname "$0")/.."

# Docker イメージをビルド
log_info "Dockerイメージをビルド中..."
docker build -f docker/Dockerfile -t $IMAGE_NAME .

# Google Container Registry にプッシュ
log_info "Container Registry にイメージをプッシュ中..."
docker push $IMAGE_NAME

# Cloud Run にデプロイ
log_info "Cloud Run にデプロイ中..."
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE_NAME \
    --platform=managed \
    --region=$REGION \
    --service-account=$SERVICE_ACCOUNT_EMAIL \
    --set-env-vars="NODE_ENV=production,PORT=8080,GCP_PROJECT_ID=${PROJECT_ID}" \
    --set-secrets="AMAZON_ACCESS_KEY=amazon-access-key:latest,AMAZON_SECRET_KEY=amazon-secret-key:latest,AMAZON_ASSOCIATE_TAG=amazon-associate-tag:latest,OPENAI_API_KEY=openai-api-key:latest,NOTE_EMAIL=note-email:latest,NOTE_PASSWORD=note-password:latest" \
    --memory=2Gi \
    --cpu=1 \
    --timeout=900 \
    --max-instances=10 \
    --min-instances=0 \
    --allow-unauthenticated \
    --project=$PROJECT_ID

# サービスのURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.url)")

log_info "デプロイが完了しました!"
log_info "サービスURL: $SERVICE_URL"
log_info ""

# ヘルスチェックを実行
log_info "ヘルスチェックを実行中..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health" || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    log_info "✅ ヘルスチェック成功"
else
    log_warn "⚠️  ヘルスチェック失敗 (HTTP $HEALTH_RESPONSE)"
fi

log_info ""
log_info "便利なコマンド:"
log_info "ログ確認: gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
log_info "手動実行: curl -X POST $SERVICE_URL/execute -H 'Content-Type: application/json' -d '{\"task\":\"daily-post\"}'"
log_info "投稿履歴: curl $SERVICE_URL/posts/history"
log_info ""
log_info "次のステップ:"
log_info "1. Secret Managerで実際のAPIキーが設定されていることを確認"
log_info "2. Cloud Schedulerジョブを有効化"
log_info "3. 手動実行でテスト"