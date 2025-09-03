クライアント選定ガイド

目的
- このリポジトリはLMOのAPIサーバーです。クライアント（Android / Windows / Web等）は別途実装します。
- ここでは、どの技術でクライアントを作るかの候補と推奨、簡単な開始手順をまとめます。

要件を整理
- リアルタイム通信（Socket.IO / WebSocket）
- 音声入出力（STT / TTS）
- 画像/カメラ入力（VLM連携）
- ネイティブデバイス制御（Bluetooth, ローカルデバイス検出 等）
- クロスプラットフォーム（なるべく一度で複数対応したいか）

主要候補（短評）

1) Flutter（推奨：クロスでAndroid＋Windowsも視野）
- 長所: 単一コードベースでAndroid/iOS/Windows/macOS/Linuxに対応。UIが速く美しく作れる。Web/デスクトップ対応も成熟してきた。
- 短所: ネイティブの細かい統合（特殊なローカルデバイス制御）はプラグイン作成が必要な場合がある。
- 備考: Socket.IOクライアント、WebRTC、ネイティブプラグインがあります。

2) Kotlin + Jetpack Compose（Androidネイティブ）
- 長所: Androidに最適化、OS連携や音声・BluetoothなどネイティブAPIが使いやすい。
- 短所: WindowsやiOSへは別実装が必要。

3) .NET MAUI / WPF（Windowsネイティブ）
- 長所: Windows向けネイティブ体験。C#で書けるのでWindowsハード連携が得意。
- 短所: モバイル対応はMAUIで可能だがエコシステムの差異がある。

4) React Native（モバイルクロス） + Electron/Tauri（デスクトップ）
- 長所: JavaScript/TypeScriptエコシステム。Webフロント開発経験が活きる。多くのライブラリあり。
- 短所: デスクトップ側はElectronが重め、Tauriは軽いが設定が増える。

5) Web（React / Next.js）
- 長所: どの端末でも使える最短ルート。クライアント配布が簡単。
- 短所: ネイティブ機能（Bluetoothなど）はブラウザ制限あり。音声やカメラはサポートされるが、ローカルデバイス制御は制約が多い。

推奨アプローチ（プロジェクト想定）
- もし「一つのコードベースでAndroidとWindowsを両方カバーしたい」なら：
  - Flutterを第1候補にする（開発速度と単一運用が有利）。
- もし「Windows向けの高度なネイティブ連携（デバイス制御）」が最優先なら：
  - Windowsネイティブ（.NET MAUI / WPF）を検討。
- まずは素早く試作して反復したい場合：
  - Web（React）でプロトタイプを作り、UXとAPIの流れを確かめる。次に必要に応じてネイティブ化。

プロトタイプの簡単な開始案

- Flutterで試す（推奨）:
  - インストール: https://flutter.dev
  - プロジェクト作成: `flutter create lumimei_client`
  - Socket.IO: `flutter_socket_io` または `socket_io_client` を追加
  - 音声: `speech_to_text`, `flutter_tts` などのパッケージを使用

- Androidネイティブで試す:
  - Android Studioでプロジェクト作成（Kotlin + Jetpack Compose）
  - Socket.IO:  `socket.io-client` for Java
  - 音声API: Android SpeechRecognizer / TextToSpeech

- Webで素早く試す:
  - Create React App または Next.js で `npx create-next-app@latest` を実行
  - Socket.IO クライアント: `socket.io-client`
  - ブラウザ音声: Web Speech API（制約あり）

実装時の注意点
- 認証: APIはJWTなどで保護。クライアント側は安全にトークンを管理する。
- リアルタイム: Socket.IO のネームスペースやイベント設計を最初に固める。
- オフライン: 音声やローカル処理はオフライン要件を検討。必要ならネイティブ実装で補う。
- プラグイン: ネイティブ機能が必要なら、Flutter/ReactNativeのネイティブプラグインを作る設計を予定する。

次の提案（選べます）
- A) すぐにFlutterのテンプレートを作る（簡単なチャットUIとSocket.IO接続）
- B) Androidネイティブの最小プロジェクト雛形を作る
- C) Web（React）でAPI連携だけのプロトタイプを作る

どれにしますか？選べば、該当する最小雛形（コード骨子）を作成します。
