# LumiMei OS - 多機能AIアシスタントアプリ要件書

## 📋 アプリケーション概要

### どんなアプリを作るか
LumiMei OSは、ユーザーの日常生活をサポートするパーソナルAIアシスタントシステムです。複数のユーザーとデバイスが同時に利用可能で、会話履歴を学習しながらパーソナライズされた応答を提供します。チャット、音声、画像入力に対応し、スマートホームデバイスとの連携も可能です。

**主な特徴:**
- 🤖 **AI会話**: 自然な対話と感情分析による賢い応答
- 👥 **マルチユーザー**: 各ユーザーのデータとセッションを完全に分離
- 📱 **マルチデバイス**: スマホ、タブレット、PCなど複数デバイス対応
- 🏠 **スマート統合**: 家電やIoTデバイスとの連携
- 🔒 **プライバシー重視**: ユーザーデータの完全保護と制御
- ⚡ **リアルタイム**: Socket.IOによる即時通信

**想定利用シーン:**
- 日常の質問応答（天気、ニュース、予定管理）
- 感情的な会話パートナー
- スマートホームの音声制御
- 画像分析による情報取得
- 複数デバイス間でのシームレスな会話継続

LumiMei OSは、既存のclient.pyクライアントとの互換性を保ちつつ、Web・モバイル・デスクトップアプリとして展開予定です。

## 🎯 主要機能要件

### 1. ユーザー管理・認証
- **マルチユーザー対応**: 独立したユーザーアカウントとデータ分離
- **JWT認証**: アクセストークン・リフレッシュトークンによる安全な認証
- **デバイス管理**: 1ユーザー複数デバイスの登録・管理
- **プロファイル管理**: 表示名、パーソナリティ設定、プライバシー設定

### 2. AIチャット・会話機能
- **client.py互換API**: 既存のクライアントとの互換性確保
- **パーソナライズ会話**: role_sheetとユーザーパーソナリティの統合
- **記憶機能**: 会話履歴の保存・圧縮・検索
- **感情分析**: メッセージ感情の分析と適切な応答生成
- **リアルタイム通信**: Socket.IOによるリアルタイムメッセージング

### 3. データ管理・記憶システム
- **MongoDB統合**: ユーザーデータ、会話履歴、圧縮記憶の永続化
- **メモリ圧縮**: 長期記憶のための会話データ圧縮
- **セッション管理**: ユーザー別セッション分離と状態管理
- **履歴検索**: 過去の会話内容の検索・取得

### 4. 多様な入力形式対応
- **テキスト入力**: 標準的なテキストメッセージ
- **音声入力**: 音声認識とテキスト変換
- **画像分析**: 画像アップロードと内容分析
- **音声出力**: テキスト音声変換（TTS）

### 5. デバイス統合・制御
- **デバイス発見**: ネットワーク上のデバイス自動検出
- **デバイス制御**: リモートコマンド実行
- **能力管理**: デバイス別機能・制約の管理
- **ステータス監視**: デバイス状態のリアルタイム監視

## 🏗️ 技術仕様

### バックエンド技術スタック
- **Node.js + Express.js**: RESTful API サーバー
- **Socket.IO**: リアルタイム双方向通信
- **MongoDB + Mongoose**: NoSQLデータベース
- **JWT**: JSON Web Token認証
- **bcrypt**: パスワードハッシュ化
- **Joi**: リクエストバリデーション

### API設計
```
認証: /api/auth/* (register, login, refresh, logout)
チャット: /api/chat/* (client.py互換エンドポイント)
ユーザー: /api/users/* (プロファイル、設定管理)
デバイス: /api/devices/* (デバイス登録・制御)
AI機能: /api/ai/* (モデル管理、設定)
通信: /api/communication/* (音声、画像処理)
タスク: /api/tasks/* (タスク管理)
```

### データベース設計
```javascript
// ユーザースキーマ
{
  userId: String,
  email: String,
  password: String (hashed),
  displayName: String,
  personality: Object,
  preferences: Object,
  privacy: Object,
  devices: [DeviceSchema],
  subscription: Object,
  usage: Object
}

// メモリ・会話履歴
{
  userId: String,
  userMessage: String,
  aiResponse: String,
  emotion: Object,
  importance: Number,
  timestamp: Date,
  sessionId: String
}
```

## 🔧 セットアップ・実行要件

### 環境要件
- **Node.js**: v18.0.0以上
- **MongoDB**: v6.0以上
- **npm**: v8.0.0以上

### 環境変数設定
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/lumimei
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=1h
```

### インストール・実行
```bash
# 依存関係インストール
npm install

# サーバー起動
npm start

# 開発モード（ホットリロード）
npm run dev

# テスト実行
npm test
```

## 📱 クライアント対応

### サポート予定プラットフォーム
- **Web**: React/Vue.js Webアプリケーション
- **Android**: React Native/Flutter
- **iOS**: React Native/Flutter
- **Desktop**: Electron
- **API**: client.py等既存クライアント

### クライアント開発の詳細要件

#### 1. ユーザー登録・認証システム
**必須実装機能:**
- ユーザー登録フォーム
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "displayName": "山田太郎",
    "personality": {
      "mode": "friendly",
      "voice": { "language": "ja-JP", "gender": "neutral" },
      "responseStyle": { "formality": "polite", "emoji": true }
    },
    "preferences": {
      "theme": "auto",
      "language": "ja",
      "notifications": { "push": true, "email": true }
    },
    "deviceInfo": {
      "deviceId": "device_12345",
      "deviceName": "iPhone 15",
      "deviceType": "mobile",
      "platform": "ios",
      "capabilities": {
        "hasCamera": true,
        "hasMicrophone": true,
        "hasSpeaker": true,
        "supportsNotifications": true
      }
    }
  }
  ```

- ログイン機能
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "deviceInfo": {
      "deviceId": "device_12345",
      "deviceName": "iPhone 15"
    }
  }
  ```

- トークン管理（自動リフレッシュ）
- セキュアストレージでのトークン保存

#### 2. API通信仕様

**BASE URL:** `http://localhost:3000` (開発時)

**認証ヘッダー:**
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

**主要エンドポイント:**

**認証API:**
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/refresh` - トークンリフレッシュ
- `GET /api/auth/profile` - プロフィール取得
- `GET /api/auth/devices` - デバイス一覧

**チャットAPI (readme.md準拠):**
- `POST /api/v1/communication/message` - テキストメッセージ
- `POST /api/v1/communication/voice/input` - 音声入力
- `POST /api/v1/communication/vision/analyze` - 画像解析
- `POST /api/v1/communication/command/device` - デバイス制御

#### 3. レスポンス処理

**成功レスポンス例:**
```json
{
  "success": true,
  "messageId": "msg_1693567890123_abc123",
  "sessionId": "session_user_001_1693567890000_xyz789",
  "response": {
    "content": "今日の東京の天気は晴れです。",
    "type": "text",
    "emotion": { "dominant": "neutral", "confidence": 0.85 },
    "actions": [
      { "type": "weather_display", "data": { "temperature": 25 } }
    ],
    "suggestions": ["外出の予定はありますか？"]
  },
  "metadata": {
    "processingTime": 245,
    "timestamp": "2023-09-01T12:04:50.123Z"
  }
}
```

**エラーハンドリング:**
```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Invalid or expired token",
  "code": 401
}
```

#### 4. Socket.IO リアルタイム通信

**接続とイベント:**
```javascript
const socket = io('http://localhost:3000');

// ユーザールームに参加
socket.emit('join_user_room', { userId: 'user_001' });

// メッセージ送信
socket.emit('chat_message', {
  userId: 'user_001',
  message: 'こんにちは',
  context: { mood: 'happy' }
});

// AI応答受信
socket.on('ai_response', (response) => {
  console.log('AI:', response.response.content);
});
```

#### 5. 必須UI/UX要件

**登録画面:**
- [x] メールアドレス入力
- [x] パスワード入力（強度表示）
- [x] 表示名入力
- [x] パーソナリティ設定（簡易版）
- [x] 利用規約・プライバシーポリシー同意
- [x] デバイス情報自動取得

**ログイン画面:**
- [x] メールアドレス/パスワード入力
- [x] ログイン状態保持オプション
- [x] パスワードリセット機能
- [x] 登録画面への導線

**メイン画面:**
- [x] チャット履歴表示
- [x] メッセージ入力エリア
- [x] 音声入力ボタン
- [x] 画像添付ボタン
- [x] 設定アクセス

**設定画面:**
- [x] プロフィール編集
- [x] パーソナリティ調整
- [x] 通知設定
- [x] プライバシー設定
- [x] デバイス管理
- [x] ログアウト

#### 6. セキュリティ要件

**データ保護:**
- アクセストークンはメモリまたはセキュアストレージに保存
- リフレッシュトークンは暗号化して保存
- パスワードはクライアント側で保存しない
- HTTPS通信必須（本番環境）

**入力検証:**
- クライアント側でも基本的なバリデーション実装
- サーバー側バリデーションに依存
- XSS対策（入力値のサニタイズ）

#### 7. エラーハンドリング

**ネットワークエラー:**
- オフライン検知
- 再接続ロジック
- エラーメッセージ表示

**認証エラー:**
- 自動トークンリフレッシュ
- ログイン画面への自動遷移
- エラー状態の明確な表示

#### 8. パフォーマンス要件

**レスポンス時間:**
- 認証: 2秒以内
- チャット送信: 1秒以内
- 画面遷移: 0.5秒以内

**メモリ使用量:**
- モバイル: 100MB以下
- Web: ブラウザメモリの10%以下

#### 9. 開発推奨事項

**技術スタック推奨:**
- **Web**: React + TypeScript + Axios + Socket.IO-client
- **Mobile**: React Native + TypeScript + AsyncStorage
- **State Management**: Redux Toolkit または Zustand
- **UI Components**: Material-UI, Chakra-UI, または Native Base

**コード構成例:**
```
src/
├── components/          # 再利用可能コンポーネント
├── screens/            # 画面コンポーネント
├── services/           # API通信ロジック
├── store/              # 状態管理
├── utils/              # ユーティリティ関数
├── types/              # TypeScript型定義
└── constants/          # 定数定義
```

**API Service実装例:**
```typescript
class AuthService {
  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await axios.post('/api/auth/register', userData);
    this.setTokens(response.data.tokens);
    return response.data;
  }

  async login(credentials: LoginData): Promise<AuthResponse> {
    const response = await axios.post('/api/auth/login', credentials);
    this.setTokens(response.data.tokens);
    return response.data;
  }

  private setTokens(tokens: Tokens) {
    AsyncStorage.setItem('accessToken', tokens.accessToken);
    AsyncStorage.setItem('refreshToken', tokens.refreshToken);
  }
}
```

### client.py互換性
```python
# 既存のclient.pyでの使用例
response = requests.post("http://localhost:3000/api/v1/communication/message", {
    "userId": "user_001",
    "message": "こんにちは",
    "messageType": "text",
    "options": {
      "responseFormat": "text",
      "personalityMode": "friendly"
    }
})
```

## 🔒 セキュリティ・プライバシー

### セキュリティ対策
- **JWT認証**: トークンベース認証
- **パスワードハッシュ化**: bcryptによる安全なハッシュ化
- **レート制限**: API呼び出し頻度制限
- **入力検証**: Joiによる包括的バリデーション
- **CORS設定**: 適切なクロスオリジン設定

### プライバシー保護
- **ユーザーデータ分離**: 完全なマルチテナント設計
- **データ暗号化**: 機密データの暗号化保存
- **プライバシー設定**: ユーザー制御可能なプライバシーレベル
- **データ削除**: ユーザー要求によるデータ完全削除

## 🚀 拡張性・スケーラビリティ

### 水平スケーリング対応
- **ロードバランサー**: 複数インスタンス対応
- **データベースクラスタリング**: MongoDB レプリカセット
- **セッション外部化**: Redis等外部セッションストア
- **マイクロサービス化**: 機能別サービス分離

### AI・機械学習統合
- **外部AIサービス**: OpenAI、Google AI等の統合
- **ローカルモデル**: プライバシー重視のローカル処理
- **カスタムモデル**: ユーザー固有の学習モデル
- **感情エンジン**: 高度な感情分析・応答生成

## 📈 ロードマップ

### Phase 1: 基盤構築 ✅
- ユーザー認証システム
- 基本チャット機能
- MongoDB統合
- API基盤

### Phase 2: 機能拡張 🔄
- 音声・画像処理
- デバイス統合
- 高度なメモリ管理
- リアルタイム通信

### Phase 3: クライアント開発
- Webアプリケーション
- モバイルアプリ
- デスクトップアプリ
- 既存クライアント統合

### Phase 4: 高度機能
- AI学習機能
- スマートホーム統合
- マルチモーダル対応
- エンタープライズ機能

## 🧪 テスト・品質保証

### テスト戦略
- **ユニットテスト**: Jest
- **統合テスト**: Supertest
- **APIテスト**: 全エンドポイントのテスト
- **負荷テスト**: 大量ユーザー対応確認

### 品質メトリクス
- **コードカバレッジ**: 80%以上
- **応答時間**: 平均200ms以下
- **稼働率**: 99.9%以上
- **セキュリティ**: 定期的な脆弱性スキャン

## 🤝 開発・貢献

### 開発環境
```bash
# 開発用データベースセットアップ
docker run -d -p 27017:27017 --name lumimei-mongo mongo

# 開発サーバー起動（ホットリロード）
npm run dev

# ESLintチェック
npm run lint

# コードフォーマット
npm run format
```

### 貢献ガイドライン
- **コーディング規約**: ESLint + Prettier
- **コミット規約**: Conventional Commits
- **ドキュメント**: 新機能は必ずドキュメント更新
- **テスト**: 新機能には対応するテスト追加

---

*Last Updated: 2025年9月2日*
*Version: 1.0.0*
*Author: LumiMei Development Team*