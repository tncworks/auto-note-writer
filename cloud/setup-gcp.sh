#!/bin/bash

# GCP セットアップスクリプト
# このスクリプトは必要なGCPリソースを作成します

set -e

# 設定変数
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="auto-note-writer"
TOPIC_NAME="auto-note-writer-tasks"
SUBSCRIPTION_NAME="auto-note-writer-subscription"
SERVICE_ACCOUNT_NAME="auto-note-writer-sa"

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

log_info "GCPプロジェクト: $PROJECT_ID"
log_info "リージョン: $REGION"

# 必要なAPIを有効化
log_info "必要なAPIを有効化中..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    cloudscheduler.googleapis.com \
    pubsub.googleapis.com \
    secretmanager.googleapis.com \
    --project=$PROJECT_ID

# サービスアカウントを作成
log_info "サービスアカウントを作成中..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Auto Note Writer Service Account" \
    --description="Service account for Auto Note Writer application" \
    --project=$PROJECT_ID \
    || log_warn "サービスアカウントは既に存在します"

# サービスアカウントに必要な権限を付与
log_info "サービスアカウントに権限を付与中..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter"

# Pub/Subトピックを作成
log_info "Pub/Subトピックを作成中..."
gcloud pubsub topics create $TOPIC_NAME \
    --project=$PROJECT_ID \
    || log_warn "トピックは既に存在します"

# Pub/Subサブスクリプションを作成
log_info "Pub/Subサブスクリプションを作成中..."
gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
    --topic=$TOPIC_NAME \
    --project=$PROJECT_ID \
    || log_warn "サブスクリプションは既に存在します"

# Secret Managerでシークレットを作成（空の値で初期化）
log_info "Secret Managerでシークレットを作成中..."

create_secret() {
    local secret_name=$1
    local description=$2
    
    gcloud secrets create $secret_name \
        --replication-policy="automatic" \
        --project=$PROJECT_ID \
        || log_warn "シークレット $secret_name は既に存在します"
    
    # 空の値で初期化
    echo -n "PLEASE_SET_ACTUAL_VALUE" | gcloud secrets versions add $secret_name --data-file=- --project=$PROJECT_ID
}

create_secret "amazon-access-key" "Amazon API Access Key"
create_secret "amazon-secret-key" "Amazon API Secret Key"
create_secret "amazon-associate-tag" "Amazon Associate Tag"
create_secret "openai-api-key" "OpenAI API Key"
create_secret "note-email" "Note.com Email"
create_secret "note-password" "Note.com Password"

# Cloud Schedulerジョブを作成
log_info "Cloud Schedulerジョブを作成中..."

# 毎日の投稿ジョブ
gcloud scheduler jobs create pubsub daily-note-posting \
    --schedule="0 9 * * *" \
    --topic=$TOPIC_NAME \
    --message-body='{"task":"daily-post","options":{"publishNow":true,"hashtags":["シンプル","おしゃれ","アイテム"]}}' \
    --time-zone="Asia/Tokyo" \
    --description="毎日note.comに商品記事を自動投稿" \
    --project=$PROJECT_ID \
    || log_warn "スケジューラージョブは既に存在します"

# 週次ヘルスチェックジョブ
gcloud scheduler jobs create pubsub weekly-health-check \
    --schedule="0 8 * * 1" \
    --topic=$TOPIC_NAME \
    --message-body='{"task":"health-check"}' \
    --time-zone="Asia/Tokyo" \
    --description="システムのヘルスチェックを実行" \
    --project=$PROJECT_ID \
    || log_warn "ヘルスチェックジョブは既に存在します"

log_info "GCPリソースの作成が完了しました"
log_info ""
log_info "次のステップ:"
log_info "1. Secret Managerで実際のAPIキーを設定してください"
log_info "2. アプリケーションをビルドしてCloud Runにデプロイしてください"
log_info "3. Cloud Schedulerジョブを有効化してください"
log_info ""
log_info "Secret Managerの設定例:"
log_info "gcloud secrets versions add amazon-access-key --data-file=- --project=$PROJECT_ID"
log_info "gcloud secrets versions add amazon-secret-key --data-file=- --project=$PROJECT_ID"
log_info "gcloud secrets versions add amazon-associate-tag --data-file=- --project=$PROJECT_ID"
log_info "gcloud secrets versions add openai-api-key --data-file=- --project=$PROJECT_ID"
log_info "gcloud secrets versions add note-email --data-file=- --project=$PROJECT_ID"
log_info "gcloud secrets versions add note-password --data-file=- --project=$PROJECT_ID"