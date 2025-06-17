#!/usr/bin/env node

/**
 * 環境変数検証スクリプト
 * 必要な環境変数が設定されているかチェックします
 */

const fs = require('fs');
const path = require('path');

// 色付きログ出力
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 必須環境変数の定義
const requiredEnvVars = [
  {
    name: 'AMAZON_ACCESS_KEY',
    description: 'Amazon Product Advertising API アクセスキー',
    sensitive: true,
    validation: (value) => value && value.length >= 10
  },
  {
    name: 'AMAZON_SECRET_KEY',
    description: 'Amazon Product Advertising API シークレットキー',
    sensitive: true,
    validation: (value) => value && value.length >= 20
  },
  {
    name: 'AMAZON_ASSOCIATE_TAG',
    description: 'Amazon アソシエイトタグ',
    sensitive: false,
    validation: (value) => value && value.length >= 3
  },
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API キー',
    sensitive: true,
    validation: (value) => value && value.startsWith('sk-')
  },
  {
    name: 'NOTE_EMAIL',
    description: 'note.com ログインメールアドレス',
    sensitive: false,
    validation: (value) => value && value.includes('@')
  },
  {
    name: 'NOTE_PASSWORD',
    description: 'note.com ログインパスワード',
    sensitive: true,
    validation: (value) => value && value.length >= 6
  },
  {
    name: 'GCP_PROJECT_ID',
    description: 'Google Cloud Project ID',
    sensitive: false,
    validation: (value) => value && /^[a-z][-a-z0-9]{5,29}$/.test(value)
  }
];

// オプション環境変数の定義
const optionalEnvVars = [
  {
    name: 'AMAZON_REGION',
    description: 'Amazon API リージョン',
    defaultValue: 'us-east-1'
  },
  {
    name: 'OPENAI_MODEL',
    description: 'OpenAI モデル名',
    defaultValue: 'gpt-4'
  },
  {
    name: 'NODE_ENV',
    description: 'Node.js 環境',
    defaultValue: 'development'
  },
  {
    name: 'PORT',
    description: 'サーバーポート',
    defaultValue: '8080'
  },
  {
    name: 'LOG_LEVEL',
    description: 'ログレベル',
    defaultValue: 'info'
  }
];

/**
 * 環境変数をチェック
 */
function validateEnvironmentVariables() {
  log('🔍 環境変数の検証を開始します...', 'blue');
  log('');

  let isValid = true;
  const issues = [];

  // 必須環境変数のチェック
  log('📋 必須環境変数のチェック:', 'blue');
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    const status = checkEnvVar(envVar, value);
    
    if (status.isValid) {
      const displayValue = envVar.sensitive ? '****' : value;
      log(`  ✅ ${envVar.name}: ${displayValue}`, 'green');
    } else {
      log(`  ❌ ${envVar.name}: ${status.message}`, 'red');
      issues.push(`${envVar.name}: ${status.message}`);
      isValid = false;
    }
  }

  log('');

  // オプション環境変数のチェック
  log('⚙️  オプション環境変数のチェック:', 'blue');
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar.name] || envVar.defaultValue;
    log(`  ℹ️  ${envVar.name}: ${value}`, 'yellow');
  }

  log('');

  // .env.example との比較
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envExamplePath)) {
    log('📝 .env.example との比較:', 'blue');
    try {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      const exampleVars = envExample
        .split('\n')
        .filter(line => line.includes('=') && !line.startsWith('#'))
        .map(line => line.split('=')[0]);

      for (const varName of exampleVars) {
        if (!process.env[varName]) {
          log(`  ⚠️  ${varName}: .env.exampleに存在しますが環境変数が未設定`, 'yellow');
        }
      }
    } catch (error) {
      log(`  ⚠️  .env.exampleの読み込みに失敗: ${error.message}`, 'yellow');
    }
  }

  log('');

  // 結果表示
  if (isValid) {
    log('🎉 全ての必須環境変数が正しく設定されています！', 'green');
    return true;
  } else {
    log('❌ 環境変数に問題があります:', 'red');
    for (const issue of issues) {
      log(`   - ${issue}`, 'red');
    }
    log('');
    log('💡 解決方法:', 'yellow');
    log('   1. 足りない環境変数を設定してください', 'yellow');
    log('   2. .env ファイルを作成するか、システム環境変数を設定してください', 'yellow');
    log('   3. GCP Secret Manager を使用している場合は、シークレットが正しく設定されているか確認してください', 'yellow');
    return false;
  }
}

/**
 * 個別の環境変数をチェック
 */
function checkEnvVar(envVar, value) {
  if (!value) {
    return {
      isValid: false,
      message: '未設定'
    };
  }

  if (envVar.validation && !envVar.validation(value)) {
    return {
      isValid: false,
      message: '形式が正しくありません'
    };
  }

  return {
    isValid: true,
    message: 'OK'
  };
}

/**
 * 環境変数テンプレートを生成
 */
function generateEnvTemplate() {
  log('📄 環境変数テンプレートを生成します:', 'blue');
  log('');

  const template = [
    '# Auto Note Writer - 環境変数設定',
    '# このファイルをコピーして .env として使用してください',
    '',
    '# ====== 必須設定 ======',
    ''
  ];

  for (const envVar of requiredEnvVars) {
    template.push(`# ${envVar.description}`);
    template.push(`${envVar.name}=your_${envVar.name.toLowerCase()}_here`);
    template.push('');
  }

  template.push('# ====== オプション設定 ======');
  template.push('');

  for (const envVar of optionalEnvVars) {
    template.push(`# ${envVar.description}`);
    template.push(`${envVar.name}=${envVar.defaultValue}`);
    template.push('');
  }

  const templateContent = template.join('\n');
  console.log(templateContent);
}

// コマンドライン引数の処理
const command = process.argv[2];

switch (command) {
  case 'validate':
  case undefined:
    const isValid = validateEnvironmentVariables();
    process.exit(isValid ? 0 : 1);
    break;
  
  case 'template':
    generateEnvTemplate();
    break;
  
  case 'help':
    log('使用方法:', 'blue');
    log('  node scripts/validate-env.js [command]');
    log('');
    log('コマンド:');
    log('  validate (default) - 環境変数を検証');
    log('  template          - 環境変数テンプレートを生成');
    log('  help             - このヘルプを表示');
    break;
  
  default:
    log(`不明なコマンド: ${command}`, 'red');
    log('使用方法: node scripts/validate-env.js [validate|template|help]', 'yellow');
    process.exit(1);
}