# Node.js公式イメージを使用
FROM node:18-alpine

# Puppeteerの依存関係をインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Puppeteerがインストール済みのChromiumを使用するよう設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 作業ディレクトリを作成
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production && npm cache clean --force

# アプリケーションのソースコードをコピー
COPY src/ ./src/

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# ファイルの所有権を変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# ポートを公開
EXPOSE 8080

# アプリケーションを起動
CMD ["node", "src/main.js"]