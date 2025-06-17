#!/bin/bash

# Google Cloud Secret Manager 管理スクリプト
# シークレットの表示、更新、削除を行います

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
COMMAND="$1"
SECRET_NAME="$2"

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

show_usage() {
    echo "使用方法: $0 <command> [secret-name]"
    echo ""
    echo "Commands:"
    echo "  list                    - 全シークレットを一覧表示"
    echo "  show <secret-name>      - 指定したシークレットの詳細を表示"
    echo "  get <secret-name>       - 指定したシークレットの値を取得"
    echo "  update <secret-name>    - 指定したシークレットの値を更新"
    echo "  delete <secret-name>    - 指定したシークレットを削除"
    echo "  rotate-all              - 全シークレットのローテーション準備"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 show amazon-access-key"
    echo "  $0 get openai-api-key"
    echo "  $0 update note-password"
    echo "  $0 delete old-secret"
}

# プロジェクトIDの確認
if [ -z "$PROJECT_ID" ]; then
    log_error "GCP_PROJECT_ID環境変数が設定されていません"
    exit 1
fi

case "$COMMAND" in
    "list")
        log_info "プロジェクト $PROJECT_ID のシークレット一覧:"
        gcloud secrets list --project=$PROJECT_ID --format="table(name,createTime,updateTime)"
        ;;
    
    "show")
        if [ -z "$SECRET_NAME" ]; then
            log_error "シークレット名を指定してください"
            show_usage
            exit 1
        fi
        
        log_info "シークレット $SECRET_NAME の詳細:"
        gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID
        
        log_info "バージョン履歴:"
        gcloud secrets versions list $SECRET_NAME --project=$PROJECT_ID
        ;;
    
    "get")
        if [ -z "$SECRET_NAME" ]; then
            log_error "シークレット名を指定してください"
            show_usage
            exit 1
        fi
        
        log_warn "シークレットの値を表示します。注意して取り扱ってください。"
        read -p "続行しますか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "キャンセルされました"
            exit 1
        fi
        
        gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT_ID
        ;;
    
    "update")
        if [ -z "$SECRET_NAME" ]; then
            log_error "シークレット名を指定してください"
            show_usage
            exit 1
        fi
        
        log_info "シークレット $SECRET_NAME を更新します"
        read -p "新しい値を入力してください: " -s NEW_VALUE
        echo
        
        if [ -z "$NEW_VALUE" ]; then
            log_error "値が空です。キャンセルします。"
            exit 1
        fi
        
        echo -n "$NEW_VALUE" | gcloud secrets versions add $SECRET_NAME \
            --data-file=- \
            --project=$PROJECT_ID
        
        log_info "✅ シークレット $SECRET_NAME を更新しました"
        
        # 変数をクリア
        unset NEW_VALUE
        ;;
    
    "delete")
        if [ -z "$SECRET_NAME" ]; then
            log_error "シークレット名を指定してください"
            show_usage
            exit 1
        fi
        
        log_warn "シークレット $SECRET_NAME を削除します。この操作は取り消せません。"
        read -p "本当に削除しますか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "キャンセルされました"
            exit 1
        fi
        
        gcloud secrets delete $SECRET_NAME --project=$PROJECT_ID
        log_info "✅ シークレット $SECRET_NAME を削除しました"
        ;;
    
    "rotate-all")
        log_info "全シークレットのローテーション準備を開始します"
        
        SECRETS=(
            "amazon-access-key"
            "amazon-secret-key"
            "amazon-associate-tag"
            "openai-api-key"
            "note-email"
            "note-password"
        )
        
        log_info "以下のシークレットのローテーションが推奨されます:"
        for secret in "${SECRETS[@]}"; do
            echo "  - $secret"
        done
        
        log_info ""
        log_info "ローテーション手順:"
        log_info "1. 各サービスで新しいAPIキーを生成"
        log_info "2. このスクリプトの update コマンドで新しい値を設定"
        log_info "3. アプリケーションを再デプロイして新しいキーを適用"
        log_info "4. 古いAPIキーを各サービスで無効化"
        ;;
    
    *)
        log_error "不明なコマンド: $COMMAND"
        show_usage
        exit 1
        ;;
esac