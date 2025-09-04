
# LumiMei OS

## 起動方法

### 1. MongoDB起動（Docker）
```powershell
docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest
```

### 2. サーバー起動
```powershell
npm install
npm start
```

サーバーは `http://localhost:3000` で起動します。

## クライアント互換API

### 認証レスポンス形式
```json
{
  "success": true,
  "accessToken": "<jwt_token>",
  "expiresAt": "<ISO8601>",
  "user": {
    "id": "user_001",
    "name": "...",
    "email": "..."
  },
  "metadata": {
    "timestamp": "..."
  }
}
```

### 主要エンドポイント
- `POST /api/auth/login` - identifier/password でログイン
- `POST /api/v1/communication/message` - メッセージ送信
- `POST /api/v1/vision/analyze` - 画像解析
- `GET /api/v1/devices/list` - デバイス一覧
- `GET /api/v1/status` - システム状態（LMO）

あなたの生活をまるごと最適化する「パーソナルAIインフラ」。
スマートフォン、PC、スマート家電、各種オンラインサービスをシームレスに連携し、
自然な会話だけで日々のタスクやデバイス操作をサポートします。

> 「OSのように生活全体を管理してくれる“AI〇〇”」


※ 本リポジトリはLumiMei OS（LMO）のAPIサーバーです。クライアント（AndroidアプリやWindowsアプリなど）は別途作成します。このサーバーを複数のユーザー、複数のクライアイアントガ使用できます

---


## 技術スタック

- Node.js / Express.js（RESTful API・リアルタイム通信）
- MongoDB（データベース）
- Socket.IO（リアルタイムイベント・通知）
- Python（AIコア拡張・モデル連携予定）
- 各種AIライブラリ（NLP, 音声, 画像, 感情分析など）
- OpenAPI（API仕様管理）

※ クライアント（Android/Windows/Web等）はAPI・Socket.IO経由で本サーバーと連携します。

## クライアント-サーバー通信プロトコル

### REST API エンドポイント
#### 基本メッセージ送信
```http
POST /api/v1/communication/message

{
  "userId": "user_001",
  "messageType": "text",
  "context": {
    "location": "Tokyo",
  },
  "options": {
    "includeActions": true,
    "personalityMode": "friendly",
  }
}
## v1 API 機能追加 (2025/09/03)

新たに追加されたv1 APIは、LumiMei OSのクライアント（Web/モバイル/デスクトップ/音声UI等）から直接利用可能なREST/Socket.IOエンドポイント群です。主な機能は以下：

- ストリーミング音声出力
- ユーザーコンテキスト更新・取得
- メモリ検索・保存
- 画像/映像解析（OCR/物体認識）
- 統一エラー処理
### APIエンドポイント一覧

- `POST /api/v1/assistant/reply`
  - 入力: { text, context, userId }
  - 出力: { tts, actions, context }
#### 2. ストリーミング音声出力
- `POST /api/v1/assistant/stream` (Socket.IO)

- `POST /api/v1/assistant/wakeword`
  - 入力: { audio, userId }
  - 出力: { detected: true/false, timestamp }

 POST `/api/auth/login` : ログイン（JWT発行）
 POST `/api/auth/register` : ユーザー登録
#### 4. ユーザーコンテキスト
- `POST /api/v1/context/update`
 POST `/api/v1/assistant/session` : セッション開始
  - Request: `{ userId, locale, model, options }`
  - Response: `{ sessionId, expiresAt }`
  - 入力: { userId, context }
  - 出力: { success, updatedContext }
 イベント: `start` / `stream_start` / `user_text` / `user_audio_chunk` / `end`
 サーバー送信: `partial_text` / `final_text` / `audio_chunk` / `function_call` / `function_result` / `stream_end` / `stream_error`
- `GET /api/v1/context/:userId`
  - 出力: { context }
 GET `/api/v1/assistant/tools` : ツール定義取得
  - Response: `[ { name, description, paramsSchema } ]`

#### 5. メモリ
 GET `/api/v1/tts?voice=meimei&text=こんにちは` : 音声データ取得（audio/pcm or audio/opus）
- `POST /api/v1/memory/query`
  - 入力: { query, userId }
 POST `/api/v1/assistant/wakeword/suggest` : 候補生成
  - Request: `{ locale, seedName }`
  - Response: `{ suggestions: [...] }`
  - 出力: { results }
- `POST /api/v1/memory/store`
 GET `/api/v1/users/{id}/profile` : プロファイル取得
  - 入力: { data, userId }
  - 出力: { success, memoryId }
 GET `/api/v1/assistant/history?userId=&limit=50` : 履歴検索
 POST `/api/v1/assistant/history` : 履歴保存
  - Request: `{ sessionId, transcript, latencyMs }`
- `GET /api/v1/memory/:memoryId`
  - 出力: { memory }
 POST `/api/v1/stt/async` : 音声アップロード
 GET `/api/v1/stt/async/{jobId}` : ジョブ結果取得

#### 6. デバイス
 GET `/api/v1/status` : モデル状況・稼働時間
  - Response: `{ models: { llm, tts, stt }, uptimeSec, timestamp }`
- `GET /api/v1/devices/list`
  - 出力: { devices }
 GET `/api/v1/voices` : 利用可能な音声・スタイル一覧
- `POST /api/v1/devices/command`
  - 出力: { success, result }
- `GET /api/v1/devices/:deviceId/capabilities`
  - 出力: { capabilities }

#### 7. 画像/映像解析
- `POST /api/v1/vision/analyze`
  - 入力: { image, userId }
  - 出力: { objects, ocr }
- `POST /api/v1/vision/batch`
  - 入力: { images, userId }
  - 出力: { results }

#### 8. エラー処理
- 全APIは `{ error: true, message: "..." }` 形式で統一エラー返却

### Socket.IO ストリーミング仕様
- `/api/v1/assistant/stream` でTTS音声データを逐次送信
- クライアントは `connect` → `stream` イベントで受信

### クライアント実装ガイド（例）
```js
// REST例
fetch('/api/v1/assistant/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'こんにちは', userId: 'user1' })
})
.then(res => res.json())
.then(data => console.log(data));

// Socket.IO例
const socket = io('/');
socket.emit('stream', { text: 'こんにちは', userId: 'user1' });
socket.on('tts', (data) => {
  // 音声データ受信
});
```

---
v1 APIの詳細仕様・サンプルは `backend/src/controllers/*-controller.js` および `v1_api_test.js` を参照してください。

#### 音声入力処理
```http
POST /api/v1/communication/voice/input
Content-Type: application/json

{
  "userId": "user_001",
  "audioData": "base64_encoded_audio_data",
  "format": "wav",
  "options": {
    "language": "ja-JP",
    "processAsMessage": true
  }
}
```

#### 画像解析
```http
POST /api/v1/communication/vision/analyze
Content-Type: application/json

{
  "userId": "user_001",
  "imageData": "base64_encoded_image_data",
  "prompt": "この画像について説明してください",
  "options": {
    "detailLevel": "medium",
    "includeObjects": true,
    "processAsMessage": true
  }
}
```

#### デバイス制御
```http
POST /api/v1/communication/command/device
Content-Type: application/json

{
  "userId": "user_001",
  "deviceId": "smart_light_001",
  "command": "turn_on",
  "parameters": {
    "brightness": 80,
    "color": "#FF6B6B"
  },
  "options": {
    "timeout": 30000,
    "retry": true
  }
}
```

### Socket.IO リアルタイム通信

#### 接続とルーム参加
```javascript
// クライアント側
const socket = io('http://localhost:3000');

// ユーザールームに参加
socket.emit('join_user_room', { userId: 'user_001' });
```

#### リアルタイムチャット
```javascript
// メッセージ送信
socket.emit('chat_message', {
  userId: 'user_001',
  message: 'こんにちは',
  context: { mood: 'happy' },
  options: { broadcastToDevices: true }
});

// AI応答受信
socket.on('ai_response', (response) => {
  console.log('AI:', response.response.content);
  // アクション実行
  if (response.response.actions) {
    response.response.actions.forEach(action => {
      console.log('Action:', action);
    });
  }
});
```

#### 音声ストリーミング
```javascript
// 音声ストリーミング開始
socket.emit('voice_stream_start', {
  userId: 'user_001',
  format: 'wav',
  sampleRate: 16000
});

// 音声チャンク送信
socket.emit('voice_chunk', { chunk: audioChunkData });

// ストリーミング終了
socket.emit('voice_stream_end');

// 音声応答受信
socket.on('voice_response', (response) => {
  console.log('Speech recognition:', response.speechRecognition.text);
  console.log('AI response:', response.response.content);
});
```

#### デバイス制御
```javascript
// デバイスコマンド送信
socket.emit('device_command', {
  userId: 'user_001',
  deviceId: 'smart_speaker_001',
  command: 'play_music',
  parameters: { playlist: 'chill' },
  broadcastStatus: true
});

// デバイス応答受信
socket.on('device_response', (response) => {
  console.log('Device result:', response.result);
});

// デバイス状態更新通知
socket.on('device_status_update', (update) => {
  console.log('Device status changed:', update);
});
```

### レスポンス形式

#### 標準レスポンス
```json
{
  "success": true,
  "messageId": "msg_1693567890123_abc123",
  "sessionId": "session_user_001_1693567890000_xyz789",
  "response": {
    "content": "今日の東京の天気は晴れです。気温は25度で、過ごしやすい一日になりそうですね。",
    "type": "text",
    "emotion": {
      "dominant": "neutral",
      "confidence": 0.85
    },
    "confidence": 0.92,
    "actions": [
      {
        "type": "weather_display",
        "data": { "temperature": 25, "condition": "sunny" }
      }
    ],
    "suggestions": ["外出の予定はありますか？", "服装のアドバイスが必要ですか？"]
  },
  "metadata": {
    "processingTime": 245,
    "modelUsed": "local-nlp-v1",
    "timestamp": "2023-09-01T12:04:50.123Z"
  }
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "userId",
      "message": "userId is required"
    }
  ]
}
```

### 認証
```http
Authorization: Bearer <jwt_token>
```

### レート制限
- チャットメッセージ: 100回/15分
- 音声入力: 50回/15分  
- 画像解析: 20回/15分
- デバイス制御: 200回/15分

## 主なファイル構造

```
Meimi/
├── backend/         # バックエンドAPI・サーバー
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── app.js
├── ai-core/         # AIコア（NLP, 音声, 画像, 感情分析）
├── api/             # API仕様・スキーマ
├── shared/          # 共通ライブラリ・型・定数
├── config/          # 設定ファイル
├── docs/            # ドキュメント
├── scripts/         # セットアップ・ビルドスクリプト
├── tests/           # テスト
├── package.json     # 依存関係・スクリプト
├── .env.example     # 環境変数サンプル
└── .gitignore
```


## 1. プロダクトコンセプト

**LumiMei OS**は、従来のAIアシスタントを超え、スマートフォン、PC、スマート家電、各種オンラインサービスをシームレスに連携し、生活全体を最適化する「パーソナルAIインフラ」です。
難しい操作やコマンドは不要。自然な会話だけで、さまざまなデバイスやサービスを操作し、日々のタスクをスムーズにこなせます。
このOSは個人のプライバシーを重視し、できる限りローカルでデータを処理。あなた専用のパートナーとして、生活に寄り添います。

---

## 2. メイン機能

### A. 総合操作ハブ
- **情報の一元管理**: スマートフォン、PC、IoTデバイス上の情報を一箇所に集約。
- **シームレスな操作連携**: スマホを触らずにSNSのメッセージを返信したり、PCから部屋の照明を調整したりできます。
- **先回りサポート**: 状況を判断し、必要に応じて自動でサポートを提供します。

### B. 生活サポート
- **パーソナルな管理**: 睡眠パターンや日々の行動を把握し、生活リズムを整えます。
- **タスク進捗の把握**: 予定や目標の進捗を追跡し、適切なタイミングでリマインドやアドバイスを行います。
- **忘れ物防止**: 外出前に必要なアイテムの確認を促します。

### C. 学習・仕事支援
- **リアルタイム情報処理**: カメラで映した資料の内容を解析し、要約や解説を提供します。
- **集中力サポート**: 学習や仕事の進捗を分析し、適切なタイミングで休憩や提案を行います。
- **情報収集の効率化**: 複雑なウェブページや資料を自動で要約し、調べ物やレポート作成を効率化します。

### D. コミュニケーションと感情サポート
- **感情認識**: 声や話し方、文章の内容から気分を推定し、それに合わせた会話を行います。
- **パーソナルな雑談**: 日々の出来事や興味のあることについて、あなたに合わせた形で会話ができます。

### E. カスタマイズ性
- **個性設定**: 性格や声など、AIキャラクターの設定を自由にカスタマイズできます。
- **ボイスモデル**: 将来的には、好みの声を学習させて独自のボイスモデルを作成できる機能も提供予定です。

### F. フレンド共有機能
- **情報共有**: 許可した範囲で、フレンドのAI同士が情報を共有し、スケジュール調整や伝言などをサポートします。
- **履歴検索**: AIとの全てのチャット履歴は保存され、いつでもキーワードで検索できます。

---

## 3. 技術的要件

- **複合AIモデル**: 自然言語処理（NLP）、音声認識、画像認識AI（VLM）を統合したAIモデルを構築します。
- **ハイブリッド動作**: 主要なデータ処理はローカルで実行し、必要な情報のみクラウドと連携してセキュリティとプライバシーを確保します。
- **包括的なAPI**: スマートフォン、PC、IoTデバイスを横断して操作できる統一API群を開発します。

**LumiMei OS**は、単なる便利なツールではなく、あなたの生活に深く根ざし、最適なパートナーとして機能する「生活のOS」です。

---

## プロジェクト開発進行状況

### ✅ 完了済み機能

#### 1. プロジェクト基盤 (100%)
- [x] ディレクトリ構造設計・作成
- [x] package.json設定・依存関係定義
- [x] 環境設定ファイル(.env.example)
- [x] Git設定(.gitignore)
- [x] セットアップスクリプト

#### 2. バックエンドAPI (90%)
- [x] Express.js サーバー基盤
- [x] RESTful API エンドポイント
- [x] Socket.IO リアルタイム通信
- [x] 通信プロトコル仕様
- [x] 検証ミドルウェア
- [x] セッション管理
- [x] エラーハンドリング
- [ ] JWT認証実装 (設計済み)
- [ ] MongoDB接続 (設定済み)

#### 3. AI コア機能 (70%)
- [x] NLP チャット処理基盤
- [x] 感情分析フレームワーク
- [x] 個性設定システム
- [x] メモリ・履歴管理
- [ ] 音声処理(STT/TTS)実装
- [ ] 画像認識実装
- [ ] 実際のAIモデル統合

#### 4. デバイス制御 (60%) 
- [x] デバイス検出フレームワーク
- [x] 制御コマンド送信システム
- [x] スマートホーム対応設計
- [ ] 実際のプロトコル実装(UPnP/mDNS/Bluetooth)
- [ ] デバイス種別対応

#### 5. クライアント連携 (85%)
- [x] 完全な通信プロトコル仕様
- [x] REST API + Socket.IO 対応
- [x] 音声・画像・テキスト入力対応
- [x] リアルタイムストリーミング
- [x] クライアント選定ガイド
- [ ] 実際のクライアントアプリ作成

### 🚧 開発中・次期予定

#### 短期 (1-2週間)
- [ ] JWT認証システム実装
- [ ] MongoDB データモデル・接続
- [ ] 基本的なTTS/STT機能
- [ ] 単体テスト作成
- [ ] クライアント試作(Flutter/Web)

#### 中期 (1-2ヶ月)
- [ ] 実際のAIモデル統合
- [ ] デバイス検出・制御の実装
- [ ] パフォーマンス最適化
- [ ] セキュリティ強化
- [ ] ドキュメント充実

#### 長期 (3-6ヶ月)
- [ ] カスタムAIモデル学習
- [ ] 高度なデバイス連携
- [ ] クラウド同期機能
- [ ] フレンド共有機能
- [ ] 本格運用・スケーリング

### 📊 全体進捗: 約 75% (設計・基盤構築完了)

現在の状況：**APIサーバーの基盤が完成し、クライアントアプリの開発に進める段階です。**