# LumiMei OS 開発ガイド

## はじめに

LumiMei OSは、個人の生活を包括的にサポートするAIインフラシステムです。このガイドでは、開発環境のセットアップから基本的な機能の実装まで説明します。

## クイックスタート

### 1. 環境要件

- Node.js 16.0.0 以上
- npm 8.0.0 以上
- MongoDB 4.4 以上（ローカル or クラウド）
- Python 3.8+ （AI機能用）

### 2. セットアップ

```bash
# リポジトリのクローン（既に完了している場合はスキップ）
git clone <repository-url>
cd Meimi

# 自動セットアップスクリプトの実行
node scripts/setup.js

# または手動セットアップ
npm install
cp .env.example .env
# .envファイルを編集
```

### 3. 開発サーバーの起動

```bash
# 開発モード（ホットリロード有効）
npm run dev

# または本番モード
npm start
```

### 4. 動作確認

- ヘルスチェック: http://localhost:3000/health
- API情報: http://localhost:3000/api/v1

## アーキテクチャ

### システム構成

```
クライアント (Android/Windows)
    ↓ (REST API / Socket.IO)
バックエンドサーバー (Express.js)
    ↓
AIコア (NLP/Speech/Vision/Emotion)
    ↓
データベース (MongoDB)
```

### データフロー

1. **ユーザー入力**: クライアントからテキスト/音声/画像入力
2. **前処理**: 入力データの正規化・検証
3. **AI処理**: NLP/感情分析/個性適用
4. **レスポンス生成**: パーソナライズされた応答生成
5. **後処理**: デバイス制御等のアクション実行
6. **出力**: クライアントへの応答送信

## 主要機能の実装

### 1. チャット機能

```javascript
// チャットメッセージの送信
POST /api/v1/chat/message
{
  "userId": "user_001",
  "message": "今日の天気を教えて",
  "context": {}
}
```

### 2. デバイス制御

```javascript
// デバイス一覧の取得
GET /api/v1/device/discover

// デバイスへのコマンド送信
POST /api/v1/device/{deviceId}/command
{
  "command": "turn_on",
  "parameters": {}
}
```

### 3. AI個性設定

```javascript
// ユーザーの個性設定
PUT /api/v1/user/{userId}/personality
{
  "traits": ["friendly", "helpful"],
  "voiceStyle": "warm",
  "responseStyle": "casual"
}
```

## 開発ワークフロー

### 1. 新機能の追加

1. **計画**: 機能要件の定義
2. **設計**: API仕様の作成
3. **実装**: バックエンド→AIコア→テストの順
4. **テスト**: 単体テスト→統合テスト
5. **ドキュメント**: API文書の更新

### 2. ディレクトリ構成

```
新機能 "example" の場合:

backend/src/
├── controllers/example-controller.js
├── services/example-service.js
├── routes/example.js
└── models/example-model.js

ai-core/
└── example/
    ├── example-processor.js
    └── example-utils.js

tests/
├── backend/example.test.js
└── ai-core/example.test.js
```

### 3. テスト

```bash
# 全テストの実行
npm test

# 特定のテスト
npm test -- --grep "chat"

# テストカバレッジ
npm run test:coverage
```

## AI機能の開発

### 1. NLP（自然言語処理）

```javascript
// ai-core/nlp/custom-processor.js
class CustomProcessor {
  async processMessage(message, context) {
    // 1. 意図解析
    const intent = await this.analyzeIntent(message);
    
    // 2. エンティティ抽出
    const entities = await this.extractEntities(message);
    
    // 3. 応答生成
    const response = await this.generateResponse(intent, entities, context);
    
    return response;
  }
}
```

### 2. 感情分析

```javascript
// ai-core/emotion/emotion-analyzer.js
class EmotionAnalyzer {
  async analyzeText(text) {
    // テキストから感情を分析
    return {
      dominant: 'joy',
      confidence: 0.85,
      emotions: {
        joy: 0.85,
        sadness: 0.10,
        anger: 0.05
      }
    };
  }
}
```

### 3. 個性エンジン

```javascript
// ai-core/personality/personality-service.js
class PersonalityService {
  async applyPersonality(response, personality) {
    // 個性設定に基づいて応答を調整
    return this.adjustTone(response, personality.traits);
  }
}
```

## セキュリティ・プライバシー

### 1. データ保護

- **暗号化**: 機密データの暗号化保存
- **アクセス制御**: JWT認証による保護
- **ローカル処理**: 可能な限りローカルでの処理

### 2. プライバシー設定

```javascript
// ユーザーのプライバシー設定例
{
  "dataRetention": 365,        // データ保持期間（日）
  "shareData": false,         // データ共有の可否
  "cloudSync": false,         // クラウド同期の可否
  "telemetry": false         // テレメトリ送信の可否
}
```

## デプロイメント

### 1. 本番環境用設定

```bash
# 本番用環境変数の設定
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_TELEMETRY=false
```

### 2. Docker化（予定）

```dockerfile
# Dockerfile例
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## トラブルシューティング

### よくある問題

1. **ポート3000が使用中**
   ```bash
   # 別のポートを使用
   PORT=3001 npm run dev
   ```

2. **MongoDB接続エラー**
   ```bash
   # MongoDBの起動確認
   sudo systemctl status mongod
   ```

3. **AIモデルが見つからない**
   ```bash
   # モデルパスの確認
   ls -la ai-core/models/
   ```

## 貢献・開発参加

### 1. コードスタイル

- ESLint設定に従う
- コミットメッセージは日本語OK
- プルリクエスト前にテスト実行

### 2. 開発フロー

1. Feature branchの作成
2. 実装・テスト
3. プルリクエスト作成
4. コードレビュー
5. マージ

## リソース

- [API仕様書](./api-reference.md)
- [設定リファレンス](./configuration.md)
- [FAQ](./faq.md)

## サポート

質問や問題がある場合は、GitHubのIssuesまたはDiscussionsをご利用ください。
