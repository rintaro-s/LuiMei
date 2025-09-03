# LumiMei OS プロジェクト構成

## ディレクトリ構造

```
Meimi/
├── backend/                    # バックエンドサーバー
│   ├── src/
│   │   ├── controllers/        # APIコントローラー
│   │   ├── models/            # データモデル
│   │   ├── services/          # ビジネスロジック
│   │   ├── middleware/        # ミドルウェア
│   │   ├── routes/            # APIルート定義
│   │   ├── utils/             # ユーティリティ関数
│   │   └── app.js            # メインアプリケーション
│   └── database/              # データベース関連
│
├── ai-core/                   # AIコア機能
│   ├── nlp/                  # 自然言語処理
│   ├── speech/               # 音声処理（TTS/STT）
│   ├── vision/               # 画像・動画認識
│   ├── emotion/              # 感情分析
│   ├── personality/          # 個性・キャラクター設定
│   ├── memory/               # 記憶・学習機能
│   └── models/               # 学習済みモデル
│
├── api/                      # API定義
│   └── v1/
│       ├── endpoints/        # エンドポイント定義
│       └── schemas/          # APIスキーマ
│
├── shared/                   # 共通ライブラリ
│   ├── types/               # 型定義
│   ├── utils/               # 共通ユーティリティ
│   └── constants/           # 定数定義
│
├── config/                   # 設定ファイル
├── docs/                     # ドキュメント
├── scripts/                  # ビルド・デプロイスクリプト
├── tests/                    # テストファイル
└── logs/                     # ログファイル（自動生成）
```

## 主要コンポーネント

### 1. バックエンド (`backend/`)
- Express.jsベースのRESTful API
- Socket.IOによるリアルタイム通信
- データベース連携（MongoDB）
- 認証・認可機能

### 2. AIコア (`ai-core/`)
- **NLP**: チャット処理、意図解析、応答生成
- **Speech**: 音声認識・音声合成
- **Vision**: 画像認識・解析
- **Emotion**: 感情分析・認識
- **Personality**: 個性設定・キャラクター管理
- **Memory**: 会話履歴・学習データ管理

### 3. API (`api/`)
- RESTful API仕様
- OpenAPI/Swagger準拠
- バージョン管理対応

### 4. 共通ライブラリ (`shared/`)
- 型定義（TypeScript対応予定）
- 共通ユーティリティ関数
- 定数・設定値

## 技術スタック

### バックエンド
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: MongoDB
- **Authentication**: JWT
- **Security**: Helmet, CORS

### AI・機械学習
- **NLP**: Transformers.js, OpenAI API
- **Speech**: Web Speech API, 音声合成ライブラリ
- **Vision**: OpenCV.js, MediaPipe
- **ML Framework**: TensorFlow.js, ONNX.js

## クライアント連携

クライアントアプリ（Android/Windows）は以下のAPIを通じて連携：

1. **RESTful API**: 基本的なデータ操作
2. **Socket.IO**: リアルタイム通信（チャット、音声通話）
3. **WebRTC**: 直接的な音声・映像通信

## 開発・実行手順

### 1. 環境設定
```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集
```

### 2. 開発モード実行
```bash
npm run dev
```

### 3. プロダクション実行
```bash
npm start
```

### 4. テスト実行
```bash
npm test
```

## セキュリティ・プライバシー

### データ保護
- ローカル優先のデータ処理
- 暗号化によるデータ保護
- 最小限のクラウド連携

### プライバシー機能
- データ保持期間の制限
- ユーザー制御可能な設定
- 匿名化オプション

## 拡張性

### 新機能追加
1. `ai-core/` 配下に新しい機能モジュールを追加
2. `backend/src/routes/` に対応するAPIエンドポイントを追加
3. `api/v1/` に仕様を定義

### カスタムAIモデル
- `ai-core/models/` 配下に学習済みモデルを配置
- 設定ファイルでモデルパスを指定

## 今後の予定

- [ ] TypeScript化
- [ ] Docker対応
- [ ] CI/CD パイプライン
- [ ] マイクロサービス化
- [ ] 分散処理対応
