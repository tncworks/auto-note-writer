#!/bin/bash

# Google Cloud Secret Manager セットアップスクリプト
# 実際のAPIキーをSecret Managerに安全に設定します

set -e

PROJECT_ID="${GCP_PROJECT_ID}"

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

log_info "Secret Manager へのシークレット設定を開始します"
log_info "プロジェクト: $PROJECT_ID"
log_warn "このスクリプトは機密情報を扱います。慎重に実行してください。"

# 確認プロンプト
read -p "続行しますか? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "キャンセルされました"
    exit 1
fi

# Amazon Product Advertising API設定
log_info "Amazon API設定..."
read -p "Amazon Access Key: " -s AMAZON_ACCESS_KEY
echo
read -p "Amazon Secret Key: " -s AMAZON_SECRET_KEY
echo
read -p "Amazon Associate Tag: " AMAZON_ASSOCIATE_TAG

# OpenAI API設定
log_info "OpenAI API設定..."
read -p "OpenAI API Key: " -s OPENAI_API_KEY
echo

# note.com設定
log_info "note.com設定..."
read -p "note.com Email: " NOTE_EMAIL
read -p "note.com Password: " -s NOTE_PASSWORD
echo

# Secret Managerに保存
log_info "Secret Manager にシークレットを保存中..."

save_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if [ -z "$secret_value" ]; then
        log_warn "シークレット $secret_name の値が空です。スキップします。"
        return
    fi
    
    echo -n "$secret_value" | gcloud secrets versions add $secret_name \
        --data-file=- \
        --project=$PROJECT_ID
    
    if [ $? -eq 0 ]; then
        log_info "✅ $secret_name を保存しました"
    else
        log_error "❌ $secret_name の保存に失敗しました"
    fi
}

save_secret "amazon-access-key" "$AMAZON_ACCESS_KEY"
save_secret "amazon-secret-key" "$AMAZON_SECRET_KEY"
save_secret "amazon-associate-tag" "$AMAZON_ASSOCIATE_TAG"
save_secret "openai-api-key" "$OPENAI_API_KEY"
save_secret "note-email" "$NOTE_EMAIL"
save_secret "note-password" "$NOTE_PASSWORD"

log_info "シークレットの設定が完了しました"
log_info ""
log_info "設定されたシークレット一覧:"
gcloud secrets list --project=$PROJECT_ID --format="table(name,createTime)"

log_info ""
log_info "次のステップ:"
log_info "1. アプリケーションをデプロイ: ./cloud/deploy.sh"
log_info "2. 手動テスト実行で動作確認"
log_info "3. Cloud Schedulerジョブを有効化"

# 変数をクリア（セキュリティ対策）
unset AMAZON_ACCESS_KEY
unset AMAZON_SECRET_KEY
unset AMAZON_ASSOCIATE_TAG
unset OPENAI_API_KEY
unset NOTE_EMAIL
unset NOTE_PASSWORD