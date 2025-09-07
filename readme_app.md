# どんなアプリを作るか

このドキュメントで扱うアプリは「LumiMei（ルミメイ）」という、個人向けのマルチモーダル・パーソナルデジタルアシスタントです。スマートフォン（主に Android）を中核に、音声・テキスト・カメラ・デバイス制御を統合して、ユーザーの日常タスク（スケジュール管理、学習支援、睡眠管理、メッセージ送信、スマートホーム制御など）を自然な会話やワークフローで補助します。

目的と価値提案:
- 日常の生産性向上: リマインダーや予定管理、通知の自動化でユーザーの手間を減らす。
- 継続的学習支援: ノート撮影→OCR→AI解析→学習プラン提示で勉強を習慣化する。
- パーソナルケア: 睡眠管理と賢いアラームで生活リズムを改善する。
- ハンズフリー操作: ウェイクワードと音声コマンドで安全に操作可能。

ターゲットユーザー:
- 忙しい社会人や学生（スケジュールとリマインドを手軽に管理したい）
- 一人暮らしの方（ロールを付けていつでも会話したい）
- スマートホーム利用者（スマホから複数デバイスをまとめて制御したい）
- プライバシー重視の個人（端末優先の処理や明示的同意を求める）

主要機能（ユーザーが直接体感する部分）:
- ウェイクワード検出（カスタマイズ可）で即時応答を開始
- Google Calendar 連携（予定確認・作成・リマインド）
- 音声ストリーミング（マイク→STT→逐次応答）と TTS 再生
- スマホ設定制御（DND、Wi‑Fi、Bluetooth、音量）
- LINE/Discord 連携によるメッセージ送信
- カメラによるノート解析（OCR + AI）と学習セッション管理
- 睡眠記録・アラーム管理・寝坊時の段階的アラート
- デバイス統合（Matter 等）によるシーン実行（例: おやすみモード）

代表的なユーザーフロー（具体例）:
1) 朝: アラームで起床 → 睡眠記録が保存され、改善提案を受信
2) 朝〜日中: "Hey ルミメイ、今日の予定は？" → カレンダー情報の読み上げとカード表示
3) 勉強: ノートを撮影 → OCR と AI で要点抽出 → 学習セッションを記録
4) 夜: "おやすみモード" を実行 → 照明・DND・通知を一括制御しアラームを設定

入出力の定義（API 契約の要旨）:
- 入力: 音声ストリーム（PCM16, 16kHz 推奨）、テキストメッセージ、画像（Base64 JPEG/PNG）、HTTP/JSON リクエスト
- 出力: テキスト応答（JSON）、TTS 音声チャンク（Base64, wav/pcm）、UI 用メタデータ（カード・イベントリスト）、WebSocket イベント

成功基準（受け入れ条件）:
- ウェイクワードでの起動が運用上問題ないレベル（誤検出率低、感度調整可能）
- Google Calendar の読み書きが OAuth で正しく動作すること
- 画像→解析→提案のフローが実用的なレイテンシで動作する（解析は非同期でも可）
- アラーム／睡眠記録が保存され統計表示が可能であること

主要なエッジケースと対策:
- オフライン: 端末内に最小限のキャッシュ（未送信イベント・トークン）を保持し、再接続時に同期
- ウェイクワード誤検出: 感度設定・二段確認（ポップアップで承認）を用意
- 権限未許可: 明示的ダイアログと機能フォールバック（読み取り専用 UI 等）を提供
- プライバシー: 音声/画像のアップロードはユーザー同意必須。端末内処理を優先可能にする設定

クライアント技術選定（推奨）:
- Android: Kotlin + AndroidX
- ネットワーク: Retrofit + OkHttp + Coroutines
- セキュアストレージ: EncryptedSharedPreferences
- リアルタイム: Socket.IO-client
- オーディオ: AudioRecord / AudioTrack
- 画像: CameraX または 標準 Intent

このセクションはドキュメント冒頭に配置し、開発者が実装方針を素早く共有できるようにするための要約です。以下本文で API 仕様や実装例を参照してください。

# LumiMei OS — Android クライアント開発ガイド (完全実装向け)

このドキュメントは、Android 開発者がサーバー側の追加参照なしで LumiMei の Android クライアントを実装できるように、必要なすべての情報（コード例、イベント仕様、OAuth/DeepLink、トークン管理、音声ストリーミング、TTS 再生、デバッグ手順）を正確にまとめた単体ガイドです。

対象: Kotlin（AndroidX）での実装を想定しています。Java 実装者は同等の API を利用してください。

前提
- Android Studio、Kotlin、AndroidX

目次
- 1) 認証フロー（Google OAuth → サーバー発行 JWT）
- 2) トークン保存・更新・ログアウト（EncryptedSharedPreferences）
- 3) REST API（Retrofit）実装例（client.py 互換 messages 形式）
- 4) Socket.IO 実装例（接続オプション、イベント定義、再接続戦略）
- 5) 音声入力のストリーミング（AudioRecord → Base64 chunk）
- 6) TTS 音声ストリーム再生（AudioTrack / MediaPlayer）
- 7) LLM タグプロトコルの扱い（フロントはタグ解析不要）
- 8) エラーハンドリングとデバッグ手順
- 9) テスト・CI のヒント

1) 認証フロー（Android 側） — 新仕様に合わせた確実な実装と検証手順

目的: サーバーで Google OAuth を実行し、サーバー側で生成したアクセストークン（access）とリフレッシュトークン（refresh）を Android クライアントが確実に受け取り、安全に保存・利用できるようにする。サーバーは標準の OAuth コールバックを受けて、モバイル向けにカスタムスキームへリダイレクトしますが、ブラウザ経由でのハンドオフ失敗に備えた HTML フォールバックも提供します。

重要な仕様ポイント（サーバー側の挙動）:
- OAuth 開始: GET /auth/google へブラウザで遷移すると Google OAuth フローへリダイレクトされる。
- OAuth コールバック: GET /auth/google/callback が呼ばれると、サーバーが access と refresh を生成してユーザー DB に保存する。次に以下のいずれかでクライアントへ返す。
  - 1) モバイル deep-link リダイレクト（推奨）: リダイレクト先は環境変数 `MOBILE_APP_CALLBACK_URL`（例: meimi://auth/callback）で、クエリ文字列に `access` と `refresh` を URL エンコードして付与する。例: meimi://auth/callback?access=<URLENCODED>&refresh=<URLENCODED>
  - 2) HTML フォールバック（ブラウザで受け取った場合）: サーバーは HTML ページを返し、ページ上にトークンを表示、コピー用ボタンと `meimi://...` を開く JS を提供する。これによりブラウザが deep link をブロックしてもユーザーがトークンをコピペできる。

Android 側の実装ガイド（確実に動くためのポイント）:
- Deep Link の intent-filter はクエリとフラグメントの両方を受け取るようにする（ブラウザによってはトークンをフラグメントで返す場合がある）。
- サーバーはトークンを URL エンコードして返す。Android 側で URL デコードを必ず行う。
- フラグメント（#...）に入る可能性があるため、Intent.data と Intent.extras 両方、さらに intent.data?.encodedFragment を確認する。
- 受け取ったトークンはすぐに EncryptedSharedPreferences に保存する。保存後、メイン画面へ遷移する。

AndroidManifest.xml (Deep Link) の推奨例:

```xml
<activity android:name=".auth.AuthCallbackActivity">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="meimi" android:host="auth" android:pathPrefix="/callback" />
  </intent-filter>
</activity>
```

AuthCallbackActivity の堅牢な実装例（クエリ/フラグメント/POSTMessage 対応）:

```kotlin
class AuthCallbackActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val intentUri = intent?.data

    // 1) クエリパラメータ
    var access = intentUri?.getQueryParameter("access")
    var refresh = intentUri?.getQueryParameter("refresh")

    // 2) フラグメント（ブラウザが#で返すケース）
    if (access.isNullOrBlank()) {
      val frag = intentUri?.encodedFragment
      if (!frag.isNullOrBlank()) {
        val fragUri = Uri.parse("?$frag") // ?key=val 形式にしてパース
        access = fragUri.getQueryParameter("access")
        refresh = fragUri.getQueryParameter("refresh")
      }
    }

    // 3) 追加フォールバック: サーバー HTML フォールバックは window.postMessage を使う可能性がある
    // （Chrome Custom Tab では未実装だが WebView 等で使うケースに備える）

    if (!access.isNullOrBlank()) {
      // URL デコード
      val accessDecoded = Uri.decode(access)
      val refreshDecoded = if (refresh != null) Uri.decode(refresh) else null
      TokenStore.saveTokens(this, accessDecoded, refreshDecoded)
      startActivity(Intent(this, MainActivity::class.java))
      finish()
      return
    }

    // 失敗時: HTML フォールバックページからコピーして手動入力するなどの対応へ誘導
    startActivity(Intent(this, AuthErrorActivity::class.java))
    finish()
  }
}
```


サーバー側で注意すべき実装上のポイント（開発者向け）:
- dotenv の読み込みは passport 等のモジュールを require する前に行う（環境変数が require 時点で必要になるため。過去の不具合原因）。
- OAuth のコールバック URL は環境変数から取得し、カンマ区切りで複数指定できる場合は最初の値を使う等の堅牢化をする。
- クライアント向け redirect に含めるトークンは URL エンコードして返す。
- ブラウザで deep-link が失敗した場合に備え、HTML にトークンを表示・コピー・自動で deep-link を試みるスクリプトを出す（既にサーバー実装に追加済み）。

---


2) トークン保存・更新・ログアウト

TokenStore（EncryptedSharedPreferences）ユーティリティ（簡潔版）:

```kotlin
object TokenStore {
  private const val PREF = "meimi_tokens"
  private const val KEY_ACCESS = "access"
  private const val KEY_REFRESH = "refresh"

  private fun prefs(context: Context): SharedPreferences {
    return EncryptedSharedPreferences.create(
      PREF,
      MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
      context,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  }

  fun saveTokens(context: Context, access: String, refresh: String?) {
    prefs(context).edit().apply {
      putString(KEY_ACCESS, access)
      if (refresh != null) putString(KEY_REFRESH, refresh)
      apply()
    }
  }

  fun getAccess(context: Context): String? = prefs(context).getString(KEY_ACCESS, null)
  fun getRefresh(context: Context): String? = prefs(context).getString(KEY_REFRESH, null)
  fun clear(context: Context) { prefs(context).edit().clear().apply() }
}
```

リフレッシュフロー（例）:
- サーバーに `POST /api/auth/refresh` を呼ぶ。ボディ/ヘッダはサーバー実装に従うが、一般的には refresh token を body で送るか、既存の access token を Authorization ヘッダで送る。
- 成功したら新しい access token を保存する。

ログアウト:
- `POST /api/auth/logout` を叩き、TokenStore.clear(context) を呼ぶ。

---

セッション管理（サーバー実装に合わせた説明）

チェックリスト（今回の実装で合わせた要件）:
- README のセッション管理節を実装済み (この節を追加しました) — Done
- サーバーが Google OAuth で識別し、再ログイン時にデータ保持できるかの確認 — Done（以下に詳細）

サーバー側の現在の挙動（実装に合わせた要約）:
- トークン発行: サーバーはログイン（email/password または Google OAuth 成功時）で短期の access token と長期の refresh token を生成します。
- DB 永続化: 発行した access/refresh はユーザー文書（User ドキュメントの accessToken / refreshToken 等）に保存されます。これによりサーバー側でリフレッシュトークンの正当性を検証できます。
- 認可ミドルウェア: `requireAuth` は Authorization ヘッダ中の Bearer access token を検証し、復号した userId を `req.user` にセットします。
- リフレッシュ: `POST /api/auth/refresh` は受け取った refresh を検証し（JWT 検証 + DB に保存されている refresh と照合）、新しい access（とオプションで refresh）を発行・保存します。
- ログアウト: `POST /api/auth/logout` はサーバー側で該当ユーザーの保存済み access/refresh をクリアし、クライアント側は TokenStore.clear() を呼びます。

クライアント側の責務（Android）:
- Deep-link で受け取った access/refresh を EncryptedSharedPreferences に保存する（既存の TokenStore を利用）。
- API 呼び出し前に access の有効期限をチェックして、期限切れなら `POST /api/auth/refresh` を呼ぶ。成功したら新しい access を保存しリクエストを再試行する。
- Socket.IO 接続時は常に最新の access を使う（トークン更新時は socket.disconnect() → 再接続、またはライブラリの auth 更新機能を利用）。

Google アカウントでの識別・再ログイン・データ保持について（回答）:
- 結論: はい。現在の実装で Google アカウントによりユーザーを識別でき、再ログインやデータ保持が可能です。
  - 理由: Passport の GoogleStrategy が Google の profile を受け取り、User を email/googleId 等で検索して既存ユーザーを更新または新規作成します。コールバック処理でサーバーは access/refresh を生成してユーザー文書に保存し、クライアントへ deep-link（または HTML フォールバック）でトークンを返します。
  - 再ログイン時のデータ保持: ユーザー固有データ（会話履歴、設定、統計等）は MongoDB の User ドキュメントや関連コレクションに紐付いているため、同一の Google アカウントでログインすれば同じユーザーデータにアクセスできます。
  - 注意点: Google 側で許可されるスコープ（カレンダー/Drive 等）が変わると追加の同意が必要になります。OAuth コールバック時に受け取る Google のアクセストークン/refresh（Google API 用）を別途保存・管理する設計が必要な API（カレンダー等）は既に実装箇所がありますが、実運用では Google トークンのライフサイクルも設計してください。

推奨される強化（本番向け、低リスクで効果的）:
- デバイス別セッション管理: User ドキュメント内に devices/sessions 配列を持たせ、refresh token をデバイス単位で保存・無効化できるようにする。
- リフレッシュトークン回転（rotation）: refresh を使うたびに新しい refresh を発行して DB を置換し、古い refresh を無効化する（jti を付与すると検証しやすい）。
- リフレッシュトークン無効化リスト/ブラックリスト: Redis 等に短期的な無効化リストを置いてログアウト直後や疑わしい操作で迅速に無効化する。
- ログイン通知と監査: 新しいデバイスでログインしたら通知を送り、ユーザーが不正ログインに気づけるようにする。
- テスト: login/refresh/logout のユニットと統合テストを追加（happy path + 401/invalid refresh のケース）。

---

3) REST API（Retrofit）実装例

依存: Retrofit, OkHttp, kotlinx-coroutines

Gradle 依存例:

```gradle
implementation "com.squareup.retrofit2:retrofit:2.9.0"
implementation "com.squareup.retrofit2:converter-moshi:2.9.0"
implementation "com.squareup.okhttp3:logging-interceptor:4.9.3"
implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4"
```

AuthInterceptor（先に示したもの）:

```kotlin
class AuthInterceptor(private val ctx: Context) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val token = TokenStore.getAccess(ctx) ?: return chain.proceed(chain.request())
    val newReq = chain.request().newBuilder()
      .addHeader("Authorization", "Bearer $token")
      .build()
    return chain.proceed(newReq)
  }
}
```

Retrofit と API インターフェース:

```kotlin
interface ApiService {
  @POST("/api/v1/communication/message")
  suspend fun sendMessage(@Body body: MessageRequest): MessageResponse

  @POST("/api/auth/refresh")
  suspend fun refresh(@Body body: RefreshRequest): TokenResponse
}

data class MessageRequest(
  val userId: String,
  val messages: List<MessageItem>, // client.py 互換
  val stream: Boolean = false,
  val options: Map<String, Any>? = null
)

data class MessageItem(val role: String, val content: String)

data class MessageResponse(val success: Boolean, val messageId: String?, val response: Any?, val metadata: Map<String,Any>?)

// refresh / token modelsはサーバー定義に合わせて調整
```

利用例（Coroutine 内）:

```kotlin
suspend fun sendText(api: ApiService, userId: String, text: String) : MessageResponse {
  val req = MessageRequest(
    userId = userId,
    messages = listOf(
      MessageItem("system", ""),
      MessageItem("user", text)
    ),
    stream = false,
    options = mapOf("locale" to "ja-JP")
  )
  return api.sendMessage(req)
}
```

注: レスポンスの `metadata` に `parsedTags` や `calendar` 情報が入る場合がありますが、クライアントは表示のみでタグ解析の必要はありません。

4) Socket.IO 実装例

依存: `io.socket:socket.io-client:2.0.1`（適切な最新版を使用）

接続戦略（Kotlin）:

```kotlin
fun createSocket(url: String, ctx: Context): Socket {
  val opts = IO.Options()
  // ライブラリによっては auth がサポートされる; 安定実装として query に token を付与
  val token = TokenStore.getAccess(ctx)
  opts.query = if (token != null) "token=$token" else null
  opts.reconnection = true
  opts.reconnectionAttempts = Int.MAX_VALUE
  opts.reconnectionDelay = 1000

  val socket = IO.socket(url, opts)

  socket.on(Socket.EVENT_CONNECT) {
    Log.d("Socket", "connected")
  }

  socket.on("partial_text") { args ->
    val json = args[0] as JSONObject
    // 部分テキストを表示
  }

  socket.on("ai_response") { args ->
    val json = args[0] as JSONObject
    // 完了応答を表示
  }

  socket.on("tts_audio_chunk") { args ->
    val data = args[0] as JSONObject
    // base64 audio を再生
  }

  socket.connect()
  return socket
}
```

イベント仕様（必須）:
- クライアント → サーバー
  - `join_user_room` : { userId: string }
  - `chat_message` : { userId: string, messages: [{role, content}], context?: {...}, options?: {...} }
  - `voice_stream_start` : { userId, format: "pcm16", sampleRate: 16000, channels: 1 }
  - `voice_chunk` : { userId, chunkIndex: Int, data: String(base64) }
  - `voice_stream_end` : { userId }

- サーバー → クライアント
  - `partial_text` : { sessionId, text }
  - `final_text` / `ai_response` : { sessionId, response: { content, type }, metadata }
  - `tts_audio_chunk` : { sessionId, data: String(base64), format: "wav" | "pcm16" }
  - `error` : { code, message }

Socket.IO の注意点:
- 接続時の JWT 期限切れ対策: 接続前にトークンが期限切れならリフレッシュを行う。
- 再接続時にもトークンは query に含める（更新を忘れずに）。

5) 音声入力のストリーミング

目的: マイク入力を逐次サーバーへ送り、サーバー側で STT/逐次応答を受ける。

推奨音声フォーマット:
- PCM 16-bit, 16 kHz, mono

AudioRecord を使ったサンプル（Base64 で chunks を送る例）:

```kotlin
class VoiceStreamer(private val socket: Socket, private val userId: String) {
  private val bufferSize = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
  private val recorder = AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize)

  fun start() {
    recorder.startRecording()
    socket.emit("voice_stream_start", JSONObject().put("userId", userId).put("format", "pcm16").put("sampleRate", 16000))
    GlobalScope.launch(Dispatchers.IO) {
      val buffer = ByteArray(1024)
      var idx = 0
      while (isRecording) {
        val read = recorder.read(buffer, 0, buffer.size)
        if (read > 0) {
          val chunk = Base64.encodeToString(buffer.copyOf(read), Base64.NO_WRAP)
          socket.emit("voice_chunk", JSONObject().put("userId", userId).put("chunkIndex", idx++).put("data", chunk))
        }
      }
      socket.emit("voice_stream_end", JSONObject().put("userId", userId))
      recorder.stop()
    }
  }
}
```

注意: ライブラリ・サーバー実装によっては binary/octet-stream のバイナリ送信が使えるため、必要ならバイナリ送信に切替えてください（より効率的）。

6) TTS 音声ストリームの再生

サーバーが `tts_audio_chunk` を base64（wav か pcm16）で送る想定で再生例:

```kotlin
fun playTtsChunk(base64: String, format: String) {
  val bytes = Base64.decode(base64, Base64.DEFAULT)
  if (format == "pcm16") {
    val audioTrack = AudioTrack(AudioManager.STREAM_MUSIC, 16000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT, bytes.size, AudioTrack.MODE_STREAM)
    audioTrack.play()
    audioTrack.write(bytes, 0, bytes.size)
    audioTrack.stop()
    audioTrack.release()
  } else {
    // wav等は一時ファイルに書き MediaPlayer で再生するのが簡単
    val tmp = File.createTempFile("tts", ".wav", context.cacheDir)
    tmp.writeBytes(bytes)
    val mp = MediaPlayer()
    mp.setDataSource(tmp.absolutePath)
    mp.prepare()
    mp.start()
  }
}
```

7) LLM タグプロトコル（フロントの扱い）

サーバーは LLM からの応答を受けて先頭の `LLM-TAGS:` 行を解析し、必要なサーバーサイド処理（カレンダー呼び出し等）を行います。クライアントはタグを解析する必要はありません。クライアントの責務は:
- ユーザーにわかりやすくテキスト/カードを表示する
- サーバーが返す `response` と `metadata` を表示・再生する

例: サーバー応答に `metadata.calendar` が入っていれば、イベント一覧を UI で表示するだけでよい。

8) エラーハンドリングとデバッグ

ネットワーク層:
- Retrofit に `HttpLoggingInterceptor` を入れてリクエスト/レスポンスをログ出力（デバッグビルドのみ）。
- TLS 証明書エラーが出る場合は開発環境用の自己署名証明書を一時的に信頼させるか、プロキシで検証を行う。

認証エラー:
- 401 を受けたら自動で `refresh` を試み、それでも失敗したらログアウト画面へ遷移する。

Socket.IO デバッグ:
- `socket.io` クライアントのログを有効にしてハンドシェイクの query を確認する。
- サーバー側ログ（access logs）を確認して token のマスク化や認証結果を参照する。

UI 側の注意:
- 長い処理は ProgressIndicator を出す。
- 音声ストリーミング中はマイク録音インジケータを表示。

9) テスト・CI のヒント

- API レイヤーは Retrofit を用いたユニットテスト（MockWebServer）で検証。
- Socket.IO は統合テストでサーバーのテストインスタンスへ接続し、送受信を検証。
- 音声入出力はエミュレータより実機テストを推奨（マイク/再生のハード差異）。

付録: サンプル・デバッグ手順（ローカル）

1. サーバー担当者と協力してテスト用の `MOBILE_APP_CALLBACK_URL` を設定してもらう（例: meimi://auth/callback）。
2. Android エミュレータでアプリを起動し、Chrome Custom Tab で `/auth/google` を叩いてログインフローを確認。
3. Retrofit のログ、Socket.IO の接続ログを同時に確認して問題箇所を突き止める。

このファイルだけで Android 側を実装できるよう、実務で必要なコード例と設計決定を凝縮しました。追加で具体的なユーティリティクラスやテストコードを生成してほしい場合は、どの部分（例: VoiceStreamer の完全実装、Retrofit の DI 設定、WorkManager ベースのバックグラウンド同期）を優先するか指示してください。

---

Last Updated: 2025年9月4日

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

## クライアント向け技術仕様（Android に集中）

このドキュメントは Android クライアント実装に必要な内容に絞っています。バックエンドの具体的実装（使用言語や DB の詳細、サーバー起動手順など）は省略し、クライアントが安全かつ確実に連携するために必要な API 契約・ネットワーク仕様・ランタイム要件に限定しています。

重要なクライアント技術（推奨）:
- Kotlin + AndroidX
- ネットワーク: Retrofit + OkHttp + Coroutines
- セキュアストレージ: EncryptedSharedPreferences
- リアルタイム: Socket.IO-client（必要時）
- オーディオ: AudioRecord / AudioTrack / MediaPlayer
- 画像処理: Bitmap / Exif / Glide (利用時)

API の具体的なエンドポイントやレスポンスは本文の「API設計 — 完全仕様（バックエンド契約）」セクションに従ってください。サーバー実装の言語（Node.js 等）や DB（MongoDB 等）の詳細はクライアント実装に直接関係しないためここでは扱いません。

1) 認証 API (/api/auth)
- POST /api/auth/register
  - 説明: メール/パスワード登録。Google OAuth 登録は /auth/google を使用。
  - 認証: なし
  - Body:
    {
      "email": "user@example.com",
      "password": "...",
      "displayName": "...",
      "deviceInfo": { ... optional ... }
    }
  - 200 成功レスポンス:
    {
      "success": true,
      "userId": "user_123",
      "tokens": {"access":"...","refresh":"..."}
    }

- POST /api/auth/login
  - 説明: メール/パスワード ログイン
  - 認証: なし
  - Body: { email, password, deviceInfo? }
  - Response: 同上

- GET /auth/google
  - 説明: サーバー側で Google OAuth フローを開始。ブラウザを経由して利用する。
  - 認証: なし

- GET /auth/google/callback
  - 説明: Google のコールバック。サーバーは access/refresh を生成し DB に保存してから deep-link または HTML フォールバックでクライアントへ渡す。
  - 認証: なし

- POST /api/auth/refresh
  - 説明: リフレッシュトークンで新しい access を取得
  - 認証: 未認証（body に refresh を送るか Authorization: Bearer <access> を用いる実装もあり）
  - Body: { "refresh": "..." }
  - 200: { success: true, tokens: { access, refresh? } }

- POST /api/auth/logout
  - 説明: リフレッシュトークン無効化、サーバー側セッション破棄
  - 認証: Bearer required

-- GET /api/auth/profile
  - 説明: 現在認証中のユーザー情報
  - 認証: Bearer required
  - Response: { success: true, data: { user: { userId, email, displayName, ... } } }
  - 備考: userId が未発行の場合、クライアントは email を論理的なユーザーIDとしてフォールバック利用します（互換運用）。

2) ユーザー API (/api/users)
- GET /api/users/:userId
  - 認証: Bearer required（ユーザー自身か管理者）
- PATCH /api/users/:userId
  - 認証: Bearer required
  - Body: partial update（displayName, preferences, personality 等）

3) セッション / ワークフロー (/api/sessions)
- POST /api/sessions
  - 説明: 新しい対話セッションを作成
  - 認証: Bearer required
  - Body: { userId, sessionType?: "chat"|"voice", metadata?: {...} }
  - Response: { sessionId }

- GET /api/sessions/:sessionId
  - 認証: Bearer required

4) Communication / Chat / LLM API (client.py 互換)
- POST /api/v1/communication/message
  - 説明: テキストメッセージを送信し即時応答を得る（LLM 呼び出し）
  - 認証: Bearer required
  - Body (client.py 互換):
    {
      "userId": "user_123",
      "messages": [{"role":"system|user|assistant","content":"..."}],
      "stream": false,
      "options": { "sessionId":"...", "locale":"ja-JP", "modelOverride":"..." }
    }
  - Response (200):
    {
      "success": true,
      "messageId": "msg_...",
      "sessionId": "session_...",
      "response": { "content": "...", "type":"text", "metadata": {...} },
      "metadata": { "processingTime": 123 }
    }

  - サーバー側処理: 受信した messages を LLM_API_URL に送信。LLM の出力で先頭に "LLM-TAGS:" 行があればサーバーが解析して行動（カレンダー呼出し等）を実行し、最終的に client に返す。client はタグ解析不要。

- POST /api/v1/communication/message?stream=true
  - 説明: ストリーミング希望（短時間ポーリングまたは Socket.IO を併用）。HTTP SSE や chunked 応答の実装も可能だが、推奨は Socket.IO。

5) 音声入力 / STT
- Socket.IO ベース（推奨）: イベント `voice_stream_start`, `voice_chunk`, `voice_stream_end`（下方イベント定義参照）。
- POST /api/v1/communication/voice/input
  - 説明: 非同期でアップロードして STT ジョブを作る API
  - Auth: Bearer required
  - Body: multipart/form-data file=wav|pcm, metadata={...}
  - Response: { jobId }

- GET /api/v1/communication/voice/status/:jobId
  - 認証: Bearer required
  - Response: { status: "pending"|"processing"|"done"|"failed", resultText?: "..." }

6) 画像解析 / VLM（LMStudio 経由）
- POST /api/v1/communication/vision/analyze
  - 説明: 画像を受け取り LMStudio へ変換して解析指示を送る
  - 認証: Bearer required
  - Body (multipart/form-data): file=image (jpeg/png) または JSON { imageBase64: "data:image/jpeg;base64,..." }
  - Optional query/body fields: model (例: gemma-3-12b-it@q4_k_m), instructions/systemPrompt
  - Server behavior: 画像をバイナリから data URI に変換し、LMStudio の messages schema で POST する。LMStudio 応答をそのままクライアントへ返す（サーバーで追加処理可）。
  - Response: { success: true, response: { content: "...", metadata: {...} } }

  - LMStudio 呼び出し（参考）:
    POST ${LMSTUDIO_API_URL:-http://127.0.0.1:8080/v1/generate}
    Body: { model: "gemma-3-12b-it@q4_k_m", messages: [{ role: "user", content: "<instructions>" }, { role: "input_image", data: "data:image/jpeg;base64,..." }] }

7) TTS（音声合成）
- POST /api/v1/communication/tts/speak
  - 説明: テキストを TTS で合成してストリーミングまたは一括返却
  - 認証: Bearer required
  - Body: { text: "...", voice: "ja-JP-Wavenet-A", format: "wav" }
  - Response: { success: true, jobId } または base64 の audio による直接応答

- Socket.IO: サーバーは `tts_audio_chunk` イベントで base64 拡張チャンクを送る。

8) ツール登録 / 外部サービス連携 (/api/tools)
- POST /api/tools/register
  - 説明: 外部ツール（カレンダー、メール送信、デバイスコントロール）をサーバーに登録
  - 認証: Bearer required
  - Body: { name, type, config }

- GET /api/tools
  - 認証: Bearer required

9) 履歴 / メモリ (/api/history, /api/memory)
- GET /api/history?userId=...
  - 認証: Bearer required (自分の履歴)
  - Response: list of messages/interactions

- POST /api/memory/compress
  - 説明: 履歴圧縮ジョブを実行（サーバー側で断片を統合）

10) デバイス (/api/devices)
- POST /api/devices/register
  - 認証: Bearer required
  - Body: { deviceId, deviceName, platform, capabilities }

- POST /api/devices/:deviceId/command
  - 認証: Bearer required
  - Body: { command, params }

11) 管理用エンドポイント（制限付き）
- GET /api/admin/stats
  - 認証: 管理者のみ

Socket.IO 仕様（リアルタイム）
- 接続時の認証: クライアントは接続時に query または auth にトークンを渡す
  - 推奨: auth: { token: "Bearer <access>" } が可能なクライアントライブラリを使うか、query=token=<access>

- イベント一覧（クライアント → サーバー）
  - join_user_room: { userId }
  - chat_message: { userId, sessionId?, messages: [{role, content}], options? }
  - voice_stream_start: { userId, format: "pcm16", sampleRate: 16000, channels: 1 }
  - voice_chunk: { userId, chunkIndex, data: base64 }
  - voice_stream_end: { userId }
  - tts_request: { userId, text, voice, sessionId? }

- イベント一覧（サーバー → クライアント）
  - partial_text: { sessionId, text }
  - ai_response: { sessionId, response: { content, type }, metadata }
  - tts_audio_chunk: { sessionId, data: base64, format }
  - stt_result: { jobId, text }
  - error: { code, message }

LLM タグプロトコル（サーバー側の処理責任）
- 受信: LLM 応答は最初の行に LLM-TAGS: を置く（済）
- サーバーはタグを解析して必要な外部 API を呼ぶ（例: calendar_api=true → Google Calendar 呼び出し）
- 権限チェックはサーバー側で行う（ユーザーが calendar の権限を持つか確認）
- クライアントはタグを解釈しない。サーバーは UI 向けに `response` と `metadata` を整形して返す。

注意事項と運用ガイダンス
- dotenv はアプリ起動前に読み込むこと（passport 等の require 前）。
- OAuth deep-link の失敗に備え HTML フォールバックを常に用意すること。
- トークンは URL で返す場合必ず URL エンコードすること。
- Socket.IO 認証では再接続時に常に最新のトークンを渡すこと（トークン更新時に reconnect させるか auth 更新を行う）。

この API 契約に従えば、Android クライアントは Retrofit + Socket.IO で完全に動作するはずです。仕様で抜けがあればどのエンドポイントを詳細化するか指示してください。

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
- **Android (プライマリ)**: Kotlin + AndroidX
- **iOS / 他**: 別途プラットフォームガイドを参照してください（本ドキュメントは Android 向け）

## 🎯 デジタルアシスタント新機能仕様（追加実装）

### Google Assistant風の機能群

#### 1. ウェイクワード検出（"Hey ルミメイ"）
**実装機能:**
- 音声でのアシスタント起動（"Hey ルミメイ"、"ねえ、ルミメイ"等）
- バックグラウンド音声検出
- 検出後のポップアップ表示
- カスタマイズ可能なウェイクワード

**API エンドポイント:**
```javascript
// ウェイクワード設定取得
GET /api/v1/wake-word/settings
Response: {
  "wakeWords": ["Hey ルミメイ", "ねえ、ルミメイ"],
  "sensitivity": 0.7,
  "enabled": true,
  "popupDuration": 3000
}

// ウェイクワード設定更新
POST /api/v1/wake-word/settings
Body: {
  "wakeWords": ["Hey ルミメイ"],
  "sensitivity": 0.8,
  "enabled": true
}

// ウェイクワード検出処理
POST /api/v1/wake-word/detect
Body: {
  "audioData": "base64_audio_data",
  "confidence": 0.85
}
```

**Android実装ガイド:**
```kotlin
// ウェイクワード検出サービス
class WakeWordDetectionService : Service() {
  private lateinit var audioRecord: AudioRecord
  private lateinit var detector: WakeWordDetector
  
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startListening()
    return START_STICKY
  }
  
  private fun startListening() {
    // バックグラウンド音声監視
    GlobalScope.launch(Dispatchers.IO) {
      while (isListening) {
        val audioData = recordAudioChunk()
        val confidence = detector.detect(audioData)
        
        if (confidence > threshold) {
          showWakeWordPopup()
          sendDetectionEvent(audioData, confidence)
        }
      }
    }
  }
  
  private fun showWakeWordPopup() {
    // ポップアップ表示
    val intent = Intent(this, WakeWordPopupActivity::class.java)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    startActivity(intent)
  }
}
```

#### 2. Google Calendar連携
**実装機能:**
- 今日・明日・1週間の予定確認
- 新規イベント作成
- 進捗管理・リマインダー
- 予定変更・削除

**API エンドポイント:**
```javascript
// 今日の予定取得
GET /api/v1/calendar/today
Response: {
  "events": [
    {
      "id": "event_123",
      "title": "チーム会議",
      "startTime": "2025-09-04T10:00:00Z",
      "endTime": "2025-09-04T11:00:00Z",
      "location": "会議室A",
      "attendees": ["user@example.com"]
    }
  ]
}

// 週間予定取得
GET /api/v1/calendar/week
Query: { "startDate": "2025-09-04", "endDate": "2025-09-10" }

// イベント作成
POST /api/v1/calendar/events
Body: {
  "title": "プロジェクト会議",
  "startTime": "2025-09-05T14:00:00Z",
  "endTime": "2025-09-05T15:00:00Z",
  "description": "新機能の仕様検討"
}

// 進捗確認
POST /api/v1/calendar/progress
Body: {
  "taskId": "task_123",
  "status": "completed",
  "notes": "予定通り完了"
}
```

**Android実装例:**
```kotlin
class CalendarManager(private val apiService: ApiService) {
  
  suspend fun getTodayEvents(): List<CalendarEvent> {
    val response = apiService.getTodayEvents()
    return response.events.map { event ->
      CalendarEvent(
        id = event.id,
        title = event.title,
        startTime = LocalDateTime.parse(event.startTime),
        endTime = LocalDateTime.parse(event.endTime),
        location = event.location
      )
    }
  }
  
  suspend fun createEvent(event: CalendarEvent): Boolean {
    val request = CreateEventRequest(
      title = event.title,
      startTime = event.startTime.toString(),
      endTime = event.endTime.toString(),
      description = event.description
    )
    return apiService.createEvent(request).success
  }
}
```

#### 3. デバイス制御・メッセージング統合
**実装機能:**
- スマホ設定制御（DND、Wi-Fi、Bluetooth、音量）
- LINE・Discordメッセージ送信
- IoT・Matter対応デバイス制御
- 統合アクション（"おやすみモード"等）

**API エンドポイント:**
```javascript
// スマホ設定制御
POST /api/v1/device/phone/settings
Body: {
  "action": "set_dnd",
  "value": true,
  "duration": 3600  // 1時間
}

// LINEメッセージ送信
POST /api/v1/device/line/message
Body: {
  "recipient": "友達の名前",
  "message": "お疲れ様です！",
  "type": "text"
}

// Discordメッセージ送信
POST /api/v1/device/discord/message
Body: {
  "channel": "general",
  "message": "開発完了しました！",
  "embed": {
    "title": "進捗報告",
    "color": "#00ff00"
  }
}

// 統合アクション実行
POST /api/v1/device/integrated/action
Body: {
  "actionType": "goodnight_mode",
  "settings": {
    "dnd": true,
    "alarm": "07:00",
    "lights": "off",
    "notifications": false
  }
}
```

#### 4. 睡眠・アラーム管理
**実装機能:**
- カスタムアラーム設定
- 睡眠記録・分析
- 寝坊対応（"妹からの鬼電"スタイル）
- 睡眠統計・改善提案

**API エンドポイント:**
```javascript
// アラーム設定
POST /api/v1/sleep/alarms
Body: {
  "time": "07:00",
  "label": "仕事の準備",
  "recurring": {
    "enabled": true,
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  },
  "sounds": ["gentle_bell", "nature_sounds"],
  "snoozeMinutes": 5
}

// 睡眠記録
POST /api/v1/sleep/records
Body: {
  "bedtime": "23:30",
  "wakeTime": "07:00",
  "quality": 8,
  "notes": "良く眠れた"
}

// 寝坊対応
POST /api/v1/sleep/oversleep
Body: {
  "alarmId": "alarm_123",
  "snoozeCount": 3
}
Response: {
  "responseLevel": "serious",
  "message": "もう起きてください！遅刻しますよ！",
  "actions": [
    {"type": "sound", "action": "play_loud_alarm"},
    {"type": "vibration", "action": "strong_vibrate"}
  ]
}
```

#### 5. カメラベース学習アシスタント
**実装機能:**
- ノート・資料のカメラ撮影・分析
- OCR＋AI による内容理解
- 学習進捗記録・統計
- 勉強セッション管理
- パーソナライズドアドバイス

**API エンドポイント:**
```javascript
// 学習素材分析
POST /api/v1/study/analyze
Body: {
  "imageData": "base64_image_data",
  "analysisType": "general",  // "math", "language", "science"
  "subject": "数学"
}
Response: {
  "extractedText": "解析されたテキスト",
  "detectedElements": [
    {"type": "math", "content": "数式が検出されました"},
    {"type": "keywords", "content": ["微分", "積分", "関数"]}
  ],
  "suggestions": [
    "数式の解法手順を整理してみましょう",
    "類似問題を探して練習することをお勧めします"
  ]
}

// 学習進捗記録
POST /api/v1/study/progress
Body: {
  "subject": "数学",
  "topic": "微分積分",
  "duration": 90,  // 分
  "completedTasks": ["問題1", "問題2"],
  "difficulty": 7,
  "understanding": 8
}

// 学習セッション開始
POST /api/v1/study/sessions/start
Body: {
  "subject": "英語",
  "goal": "TOEIC対策",
  "estimatedDuration": 60
}

// 学習アドバイス取得
GET /api/v1/study/advice
Query: { "subject": "数学", "currentTopic": "微分", "difficulty": "5" }
Response: {
  "advice": [
    "朝の集中力を活かして、難しい内容から取り組みましょう",
    "もう少し長めの学習時間を設定してみましょう"
  ],
  "learningPattern": {
    "preferredStudyTime": "morning",
    "averageSessionLength": 75,
    "strongSubjects": ["数学", "物理"],
    "improvementAreas": ["英語"]
  }
}
```

**Android実装例（カメラ撮影・分析）:**
```kotlin
class StudyAssistantFragment : Fragment() {
  
  private fun captureAndAnalyze() {
    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
    startActivityForResult(takePictureIntent, REQUEST_IMAGE_CAPTURE)
  }
  
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == REQUEST_IMAGE_CAPTURE && resultCode == RESULT_OK) {
      val imageBitmap = data?.extras?.get("data") as Bitmap
      analyzeImage(imageBitmap)
    }
  }
  
  private fun analyzeImage(bitmap: Bitmap) {
    lifecycleScope.launch {
      try {
        showProgress("画像を分析中...")
        
        val base64Image = convertToBase64(bitmap)
        val request = AnalyzeRequest(
          imageData = base64Image,
          analysisType = "general",
          subject = selectedSubject
        )
        
        val result = apiService.analyzeStudyMaterial(request)
        displayAnalysisResult(result)
        
      } catch (e: Exception) {
        showError("分析に失敗しました: ${e.message}")
      } finally {
        hideProgress()
      }
    }
  }
  
  private fun displayAnalysisResult(result: AnalysisResponse) {
    binding.extractedText.text = result.extractedText
    
    // 検出要素の表示
    result.detectedElements.forEach { element ->
      when (element.type) {
        "math" -> showMathElements(element.content)
        "keywords" -> showKeywords(element.content)
      }
    }
    
    // 提案の表示
    displaySuggestions(result.suggestions)
  }
}

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

**BASE URL:** 開発時は `http://localhost:3000`。本リポ内の Android 実装は `https://b2555199e39b.ngrok-free.app` を BuildConfig 経由で使用。

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
-- ブラウザメモリに関する制限はクライアント実装に依存します。モバイルでは実機でメモリ挙動を確認してください。

#### 9. 開発推奨事項

**技術スタック推奨（モバイル）:**
- Kotlin + AndroidX
- Retrofit + OkHttp + Coroutines
- EncryptedSharedPreferences
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

**API Service 実装例（Kotlin / Retrofit 推奨）:**

クライアントは Retrofit と Coroutines を使用して API 呼び出しを行います。上で示した `ApiService` インターフェースを実装し、`AuthInterceptor` を OkHttp クライアントに登録してください。トークン永続化は `EncryptedSharedPreferences` を使い、更新時に OkHttp のインターセプタを通じて Authorization ヘッダを付与します。

### チャット送信方法（REST / Socket.IO）

フロントは基本的に REST でメッセージをサーバーへ送信し、即時応答は HTTP レスポンスで受け取ります。長時間処理や音声ストリーミング、逐次応答を受けたい場合は Socket.IO を併用します。

1) REST（シンプル、即時応答）

POST /api/v1/communication/message

Headers:

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

Body (client.py 互換の例):

```json
{
  "userId": "user_001",
  "messages": [
    { "role": "system", "content": "" },
    { "role": "user", "content": "明日の予定を教えて" }
  ],
  "stream": false,
  "options": { "sessionId": "session_123", "locale": "ja-JP" }
}
```

成功時のレスポンスは以下のような形になります（全文は `readme.md` を参照）。

2) Socket.IO（ストリーミング／逐次応答）

- クライアントは JWT を `auth.accessToken` または `query.token` に渡して接続します。
  - ユーザー識別は `userId ?: email` のフォールバックで安定化しています。Socket の `join_user_room` でも同様に適用。
- 接続後、`voice_stream_start` / `voice_chunk` / `voice_stream_end` などを送信します。
- サーバーは `partial_text`, `final_text`, `tts_audio_chunk` などで逐次配信します。

### LLM タグプロトコル（フロントは気にしなくて良いが仕様を理解しておく）

サーバーはクライアントから受け取ったメッセージを LLM に渡して応答を生成します。LLM には「応答本文の先頭にタグ行を付ける」慣習（自然言語に混ぜたメタ情報）を指定します。重要事項:

- 形式はプレーンテキストで、最初の行に `LLM-TAGS:` を置き、その後に `key=value` 形式を `;` 区切りで列挙します。
- 例: `LLM-TAGS: calendar_api=true; calendar_action=list_events; date=2025-09-04`
- その下に人間向けの自然文（自由文）を続ける。JSONは使用しない。

サーバー側の挙動:

1. LLM の出力を受け取る。
2. 最初の行 `LLM-TAGS:` を解析してタグを抽出。
3. `calendar_api=true` のようなタグがあれば、サーバーがユーザーの Google 資格情報を使ってカレンダー API を呼び出す。
4. カレンダー結果を人間向けテキストに付与してクライアントに返す。クライアントは追加処理不要。

利点:

- LLM は自然言語で制御情報を返せるので、サーバー側で多様なAPIトリガー（カレンダー、メール、デバイス制御など）を柔軟に追加可能。
- フロントはタグ解析の実装不要。タグはすべてサーバーで処理される。

注意:

- LLM側からのタグは常にプレーンテキスト行で返すこと。JSONは LLM 出力の一部として使わないでください（既存の LLM サーバーと衝突するため）。
- サーバーはタグに対する認可チェック（例えば calendar.read 権限）を行います。

### サーバー用 System Prompt テンプレート（参考）

サーバー実装は LLM に必ず system プロンプトを付与してください。以下は推奨テンプレートです。サーバー側では環境変数 `LLM_SYSTEM_PROMPT` に設定し、クライアントからの `messages` に含まれる system ロールは補助的に扱うようにしてください（サーバー側テンプレトが優先されます）。

```
You are LumiMei assistant.
Language: Detect the user language and reply in the same language (Japanese preferred for ja-JP inputs).
Response format: ALWAYS begin the whole response with a single line that starts with exactly 'LLM-TAGS:' followed by semicolon-separated key=value pairs if applicable. Do NOT return JSON or wrap tags in code blocks.
Behavior rules:
 - If the user asks for calendar information, include 'calendar_api=true' and set 'calendar_action' to 'list_events' or 'create_event' as appropriate, and include 'date=YYYY-MM-DD' when relevant.
 - If the LLM decides no server-side action is needed, emit 'LLM-TAGS:' with no key/value pairs and then the human-readable response.
 - For device control suggestions, use 'device_command=...' and keep commands concise.
Tone: polite, concise, helpful. Prefer short Japanese sentences for ja-JP inputs.
```

サーバーはこの system プロンプトで LLM の出力形式を安定化させ、先頭行の `LLM-TAGS:` を解析して必要なサーバーサイド処理（カレンダー呼び出し等）を行います。クライアント側は通常通り応答テキストを表示すれば良く、タグ解析は不要です。


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
- モバイルアプリ（Android が優先）
- iOS や Web は別ガイドを用意予定（本書は Android 向け）

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

### 開発環境（Android 開発者向け）
Android 実機またはエミュレータでの開発フローに絞っています。バックエンドの起動はサーバー担当が行う想定です。

基本ツール:
- Android Studio
- adb
- Kotlin + Gradle

よく使うコマンド例:

```powershell
# エミュレータ起動（Android Studio の AVD Manager を推奨）
adb devices

# アプリのインストールと起動
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.your.app.package/.MainActivity

# deep-link をテスト
adb shell am start -a android.intent.action.VIEW -d "meimi://auth/callback?access=<URLENCODED>&refresh=<URLENCODED>" com.your.app.package
```

バックエンドの起動や DB の管理はサーバー担当と連携して行ってください。クライアントは API 契約に従いネットワーク呼び出しと認証を実装します。

### 貢献ガイドライン
- **コーディング規約**: ESLint + Prettier
- **コミット規約**: Conventional Commits
- **ドキュメント**: 新機能は必ずドキュメント更新
- **テスト**: 新機能には対応するテスト追加

---

---

## 検証手順とトラブルシューティング（重要 — 同様の問題を防ぐために必ず参照する）

このプロジェクトで過去に発生した問題（dotenv 読み込み順、OAuth の clientID 欠落、deep-link がブラウザで渡らない等）を踏まえ、再現テストと防止策を明確にします。

1) dotenv とモジュール読み込み順
- 問題: passport が require 時に process.env の値を参照すると "OAuth2Strategy requires a clientID option" の例外になる。
- 検証: `node -e "require('dotenv').config({ path: './backend/.env' }); console.log(process.env.GCP_OAUTH2_CLIENT_ID)"` で値が出ることを確認。
- 防止策: アプリのエントリーポイント（`backend/src/app.js` 等）で最初に dotenv.config() を実行する。Passport 設定は後で require する。

2) OAuth deep-link がブラウザからアプリへ渡らない場合の切り分け
- 手順:
  - a) ブラウザでサーバーの `/auth/google` を実行 → Google でログイン → サーバーが HTML フォールバックを返すか deep-link へリダイレクトする。
  - b) ブラウザ上でトークンが表示される場合、まずトークンをコピーして adb でインテントを投げてみる（下のコマンド参照）。
  - c) adb インテントで成功するなら、ブラウザ→アプリのハンドオフが原因（Chrome の外部アプリブロックや OS の意図的な制限）。HTML フォールバックや手動コピペの UX を改善する。
  - d) adb インテントで失敗する場合はアプリ側の `AuthCallbackActivity` の intent 解析ロジックを修正する。

adb 検証コマンド（PowerShell 用）:

```powershell
adb shell am start -a android.intent.action.VIEW -d "meimi://auth/callback?access=<URLENCODED>&refresh=<URLENCODED>" com.your.app.package
```

3) トークンの URL エンコード / デコード
- 問題: トークンに `+` や `/` が含まれるとクエリ文字列で欠損することがある。
- 対応: サーバーは `encodeURIComponent(token)` を使って返す。クライアントは `Uri.decode()` で復元する。

4) Socket.IO 認証トラブル
- 問題: reconnection 時に古いトークンで接続し続ける。
- 対応: アクセストークンを更新したら socket.disconnect() → 新しい auth で socket.connect() を行うか、socket の auth オブジェクトを更新できるライブラリ機能を使う。

5) LLM/LMStudio の互換性テスト
- ショートテスト: 簡単な POST を `LLM_API_URL` と `LMSTUDIO_API_URL` に対して投げ、期待する schema（messages 配列, model フィールド）に対する 200 を返すかを確認する。

6) ログの出力と機密情報
- 本番ログにはトークンを出さないこと（masking）。開発ではログにトークンを出すと便利だが、漏洩リスクを忘れない。

7) デバッグ・チェックリスト（ログを読むときの優先順位）
 - a) サーバー起動時に dotenv が読み込まれているか
 - b) Passport が clientID/clientSecret を正しく受け取っているか
 - c) OAuth コールバックでサーバーが token を生成し DB に保存しているか
 - d) ブラウザで deep-link が正しいクエリを持って返されているか
 - e) adb インテントでアプリが token を受け取り保存できるか
 - f) /api/auth/profile に Authorization ヘッダを付けて 200 が返るか

このチェックリストを CI テストや PR テンプレートの一部にすると、似た問題の再発をほぼ防げます。

## よくある問題と即時対処（短い手順）
- OAuth2Strategy requires a clientID option → dotenv を先に読み込む
- Deep-link がブラウザから渡らない → HTML フォールバックの token をコピーして adb で intent 試験
- Socket.IO が認証エラー → クライアントの auth/query に最新トークンを付与しているか確認

---

*Last Updated: 2025年9月5日*
*Version: 1.1.0*
*Author: LumiMei Development Team*