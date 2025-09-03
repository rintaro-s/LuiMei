#!/usr/bin/env node

/**
 * LumiMei OS Setup Script
 * 初回セットアップ用のスクリプト
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 LumiMei OS セットアップを開始します...\n');

// 1. 必要なディレクトリの作成
const requiredDirs = [
  'logs',
  'database/data',
  'ai-core/models/downloaded',
  'backend/uploads',
  'user_data',
  'cache'
];

console.log('📁 必要なディレクトリを作成中...');
requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`  ✓ ${dir}`);
  }
});

// 2. 環境変数ファイルの確認
console.log('\n⚙️  環境設定を確認中...');
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('  ✓ .envファイルを作成しました');
  console.log('  ⚠️  .envファイルを編集して設定を調整してください');
} else {
  console.log('  ✓ .envファイルが存在します');
}

// 3. 依存関係のインストール確認
console.log('\n📦 依存関係を確認中...');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('  🔄 npm install を実行中...');
  try {
    execSync('npm install', { cwd: path.dirname(packageJsonPath), stdio: 'inherit' });
    console.log('  ✓ 依存関係のインストールが完了しました');
  } catch (error) {
    console.error('  ❌ 依存関係のインストールに失敗しました');
    console.error(error.message);
  }
} else {
  console.log('  ✓ 依存関係は既にインストールされています');
}

// 4. 基本設定ファイルの作成
console.log('\n🔧 基本設定ファイルを作成中...');

const defaultUserConfig = {
  userId: 'user_001',
  personality: {
    name: 'default',
    traits: ['friendly', 'helpful', 'casual'],
    voiceStyle: 'warm',
    responseStyle: 'casual'
  },
  preferences: {
    language: 'ja-JP',
    timezone: 'Asia/Tokyo',
    voiceMode: true,
    notifications: true
  },
  privacy: {
    dataRetention: 365,
    shareData: false,
    analytics: false
  }
};

const userConfigPath = path.join(__dirname, '..', 'user_data', 'default_config.json');
if (!fs.existsSync(userConfigPath)) {
  fs.writeFileSync(userConfigPath, JSON.stringify(defaultUserConfig, null, 2));
  console.log('  ✓ デフォルトユーザー設定を作成しました');
}

// 5. セットアップ完了
console.log('\n🎉 セットアップが完了しました！');
console.log('\n次のステップ:');
console.log('1. .envファイルを編集して必要な設定を行ってください');
console.log('2. npm run dev でサーバーを起動できます');
console.log('3. http://localhost:3000/health でサーバーの状態を確認できます');
console.log('\n詳細なドキュメントは docs/ フォルダをご確認ください。');
