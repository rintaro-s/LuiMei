package com.lumimei.assistant.ui.chat

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.R
import com.lumimei.assistant.ui.chat.ChatAdapter
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.data.models.*
import com.lumimei.assistant.utils.SmartLogger
import java.util.UUID
import com.lumimei.assistant.data.models.*
import com.lumimei.assistant.data.models.BackendCompatibleModels.MessageRequest
import com.lumimei.assistant.data.models.BackendCompatibleModels.VoiceInputRequest
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.databinding.FragmentChatBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.network.SocketManager
import com.lumimei.assistant.session.SessionState
import com.lumimei.assistant.data.storage.ChatHistoryStore
import io.socket.client.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class ChatFragment : Fragment() {
    
    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var app: LumiMeiApplication
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var apiClient: ApiClient
    private lateinit var securePreferences: SecurePreferences
    private lateinit var socketManager: SocketManager
    private val messages = mutableListOf<ChatMessage>()
    private lateinit var historyStore: ChatHistoryStore
    private var currentSessionId: String = ""
    
    // Audio recording
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    
    // Processing state
    private var isProcessing = false
    
    // Animation objects
    private var recordingAnimator: ValueAnimator? = null
    
    companion object {
        private const val TAG = "ChatFragment"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentChatBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        app = requireActivity().application as LumiMeiApplication
        apiClient = ApiClient(requireContext(), app.securePreferences)
        securePreferences = app.securePreferences
        socketManager = app.socketManager
    historyStore = ChatHistoryStore(requireContext(), securePreferences)
        
        // Ensure effective userId exists (fallback to email)
        if (securePreferences.userId.isNullOrEmpty() && !securePreferences.userEmail.isNullOrEmpty()) {
            securePreferences.userId = securePreferences.userEmail
        }

        setupRecyclerView()
        setupClickListeners()
        setupSocket()
        setupSessionObserver()
        
        // Start a new session if not already active
        if (app.sessionManager.getCurrentSessionId() == null) {
            app.sessionManager.startNewSession()
        }
        
        // Load history for current session
        app.sessionManager.getCurrentSessionId()?.let { sid ->
            val past = historyStore.load(sid)
            if (past.isNotEmpty()) {
                messages.addAll(past)
                chatAdapter.notifyDataSetChanged()
                binding.recyclerViewChat.scrollToPosition(messages.size - 1)
            }
        }
        if (messages.isEmpty()) {
            addSystemMessage("こんにちは、LumiMeiです。何かお手伝いできることはありますか？")
        }
    }
    
    private fun setupRecyclerView() {
        chatAdapter = ChatAdapter(messages)
        binding.recyclerViewChat.apply {
            layoutManager = LinearLayoutManager(context).apply {
                stackFromEnd = true
            }
            adapter = chatAdapter
        }
    }
    
    private fun setupClickListeners() {
        binding.buttonSend.setOnClickListener {
            if (isProcessing) {
                Toast.makeText(context, "処理中です。しばらくお待ちください", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            val message = binding.editTextMessage.text.toString().trim()
            if (message.isNotEmpty()) {
                sendTextMessage(message)
                binding.editTextMessage.text.clear()
            }
        }
        
        binding.buttonVoice.setOnTouchListener { v, event ->
            if (isProcessing) {
                Toast.makeText(context, "処理中です。しばらくお待ちください", Toast.LENGTH_SHORT).show()
                return@setOnTouchListener false
            }
            
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    if (!isRecording) {
                        startRecording()
                        v.performClick()
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (isRecording) {
                        stopRecording()
                    }
                    true
                }
                else -> false
            }
        }
        
        binding.btnNewSession.setOnClickListener {
            startNewSession()
        }
        
        binding.btnHistory.setOnClickListener {
            showSessionHistory()
        }
    }
    
    private fun setupSocket() {
        val socket = socketManager.getSocket()
        
    // Join user room (fallback to email as userId if userId is missing)
    val effectiveUserIdForSocket = securePreferences.userId ?: securePreferences.userEmail
    effectiveUserIdForSocket?.let { userId ->
            socket.emit("join_user_room", JSONObject().put("userId", userId))
        }
        
        // Listen for AI responses
    socket.on("ai_response") { args: Array<Any?> ->
            if (args.isNotEmpty()) {
                val response = args[0] as JSONObject
                val content = response.optString("response", "")
                
                activity?.runOnUiThread {
                    if (content.isNotEmpty()) {
                        val message = ChatMessage(
                            id = UUID.randomUUID().toString(),
                            text = content,
                            isFromUser = false,
                            timestamp = System.currentTimeMillis(),
                            conversationId = app.sessionManager.getCurrentSessionId(),
                            messageType = "text"
                        )
                        addMessage(message)
                    }
                }
            }
        }
        
        // Listen for partial responses
    socket.on("partial_text") { args: Array<Any?> ->
            if (args.isNotEmpty()) {
                val response = args[0] as JSONObject
                val text = response.optString("text", "")
                
                activity?.runOnUiThread {
                    updateLastBotMessage(text)
                }
            }
        }
        
        // Listen for TTS stream and server audio chunk events (compatibility)
        socket.on("tts_stream") { args: Array<Any?> ->
            activity?.runOnUiThread {
                handleTTSStream(args)
            }
        }

        // Some server implementations emit 'audio_chunk' or 'tts_audio_chunk'
        socket.on("audio_chunk") { args: Array<Any?> ->
            activity?.runOnUiThread {
                handleTTSStream(args)
            }
        }

        socket.on("tts_audio_chunk") { args: Array<Any?> ->
            activity?.runOnUiThread {
                handleTTSStream(args)
            }
        }
        
        // Listen for function calls
        socket.on("function_call") { args: Array<Any?> ->
            activity?.runOnUiThread {
                handleFunctionCall(args)
            }
        }
        
        // Listen for errors
        socket.on("error") { args: Array<Any?> ->
            if (args.isNotEmpty()) {
                val error = args[0] as JSONObject
                val message = error.optString("message", "Unknown error")
                
                activity?.runOnUiThread {
                    showError("Socket Error: $message")
                }
            }
        }
    }
    
    private fun sendTextMessage(text: String) {
        // Add user message to chat
        val userMessage = ChatMessage(
            id = UUID.randomUUID().toString(),
            text = text,
            isFromUser = true,
            timestamp = System.currentTimeMillis(),
            conversationId = app.sessionManager.getCurrentSessionId(),
            messageType = "text"
        )
        addMessage(userMessage)
        persistMessage(userMessage)
        
        // Send via REST API using new backend models
        lifecycleScope.launch {
            try {
                showLoading(true)
                
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: run {
                    showError("ユーザーIDが見つかりません。ログインし直してください")
                    return@launch
                }
                
                val recentHistory = app.sessionManager.getCurrentSessionId()?.let { sid ->
                    historyStore.getRecentConversationMessages(sid, 10)
                } ?: emptyList()

                val request = MessageRequest(
                    userId = userId,
                    messageType = "text",
                    message = text,
                    context = mapOf(
                        "mood" to "neutral",
                        "sessionId" to (app.sessionManager.getCurrentSessionId() ?: "unknown"),
                        "history" to recentHistory
                    ),
                    options = mapOf(
                        "sessionId" to (app.sessionManager.getCurrentSessionId() ?: "session_${System.currentTimeMillis()}"),
                        "tone" to securePreferences.chatTone,
                        "history" to recentHistory
                    )
                )
                
                val response = apiClient.apiService.sendMessage(request)
                
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val messageResponse = response.body()
                        if (messageResponse?.success == true) {
                            messageResponse.response?.let { assistantResponse ->
                                val aiMessage = ChatMessage(
                                    id = UUID.randomUUID().toString(),
                                    text = assistantResponse.content,
                                    isFromUser = false,
                                    timestamp = System.currentTimeMillis(),
                                    conversationId = app.sessionManager.getCurrentSessionId(),
                                    messageType = "text"
                                )
                                addMessage(aiMessage)
                                persistMessage(aiMessage)
                                
                                // Increment message count in session
                                app.sessionManager.incrementMessageCount()
                            }
                        } else {
                            showError("メッセージの送信に失敗しました: ${messageResponse?.error}")
                        }
                    } else {
                        showError("サーバーエラー: ${response.code()} ${response.message()}")
                    }
                }
            } catch (e: Exception) {
                    SmartLogger.e(requireContext(), TAG, "Error sending message", e)
                withContext(Dispatchers.Main) {
                    showError("メッセージの送信に失敗しました: ${e.message}")
                }
            } finally {
                withContext(Dispatchers.Main) {
                    showLoading(false)
                }
            }
        }
    }
    
    private fun sendMessageViaAPI(text: String) {
        // This method is now integrated into sendTextMessage
        // Keeping for backward compatibility if needed
    }
    
    private fun startRecording() {
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 100)
            return
        }
        
        try {
            val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * BUFFER_SIZE_FACTOR
            )
            
            audioRecord?.startRecording()
            isRecording = true
            
            binding.buttonVoice.text = "🔴 録音中"
            binding.buttonVoice.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.error))
            binding.buttonVoice.isEnabled = true
            
            // 録音インジケーターを表示
            binding.recordingIndicator.visibility = View.VISIBLE
            startRecordingAnimation()
            
            recordingThread = Thread {
                recordAudioForProcessing()
            }
            recordingThread?.start()
            
                SmartLogger.d(requireContext(), TAG, "Recording started")
            
        } catch (e: Exception) {
                SmartLogger.e(requireContext(), TAG, "Error starting recording", e)
            Toast.makeText(context, "録音を開始できませんでした", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun stopRecording() {
        isRecording = false
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        
        binding.buttonVoice.text = "🎤 長押しで音声入力"
        binding.buttonVoice.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.primary_color))
        
        // 録音インジケーターを非表示
        binding.recordingIndicator.visibility = View.GONE
        stopRecordingAnimation()
        
        recordingThread?.interrupt()
        recordingThread = null
        
        SmartLogger.d(requireContext(), TAG, "Recording stopped")
    }
    
    private fun recordAudioForProcessing() {
        val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
        val buffer = ShortArray(bufferSize)
        val audioData = ByteArrayOutputStream()
        
        while (isRecording && audioRecord != null) {
            val readSize = audioRecord?.read(buffer, 0, bufferSize) ?: 0
            
            if (readSize > 0) {
                val byteArray = shortArrayToByteArray(buffer, readSize)
                audioData.write(byteArray)
            }
        }
        
        // Process complete audio when recording stops
        if (audioData.size() > 0) {
            processVoiceInput(audioData.toByteArray())
        }
    }
    
    private fun processVoiceInput(audioBytes: ByteArray) {
        lifecycleScope.launch {
            try {
                showVoiceProcessing()
                
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: run {
                    showError("ユーザーIDが見つかりません")
                    binding.loadingOverlay.visibility = View.GONE
                    return@launch
                }
                
                val base64Audio = Base64.encodeToString(audioBytes, Base64.NO_WRAP)
                
                val request = VoiceInputRequest(
                    userId = userId,
                    audioData = base64Audio,
                    format = "pcm16",
                    options = mapOf(
                        "language" to "ja-JP",
                        "tone" to securePreferences.chatTone,
                        "sampleRate" to SAMPLE_RATE
                    )
                )
                
                val response = apiClient.apiService.processVoiceInput(request)
                
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val voiceResponse = response.body()
                        if (voiceResponse?.success == true) {
                            // Add transcription as user message
                            voiceResponse.transcription?.let { transcription ->
                                if (transcription.isNotEmpty()) {
                                    val userMessage = ChatMessage(
                                        id = UUID.randomUUID().toString(),
                                        text = transcription,
                                        isFromUser = true,
                                        timestamp = System.currentTimeMillis(),
                                        conversationId = app.sessionManager.getCurrentSessionId(),
                                        messageType = "voice"
                                    )
                                    addMessage(userMessage)
                                    persistMessage(userMessage)
                                    
                                    // Add AI response if available
                                    voiceResponse.response?.let { assistantResponse ->
                                        val aiMessage = ChatMessage(
                                            id = UUID.randomUUID().toString(),
                                            text = assistantResponse.content,
                                            isFromUser = false,
                                            timestamp = System.currentTimeMillis(),
                                            conversationId = app.sessionManager.getCurrentSessionId(),
                                            messageType = "text"
                                        )
                                        addMessage(aiMessage)
                                        persistMessage(aiMessage)
                                    }
                                }
                            }
                        } else {
                            showError("音声認識に失敗しました: ${voiceResponse?.error}")
                        }
                    } else {
                        showError("音声処理エラー: ${response.code()} ${response.message()}")
                    }
                }
            } catch (e: Exception) {
                    SmartLogger.e(requireContext(), TAG, "Error processing voice input", e)
                withContext(Dispatchers.Main) {
                    showError("音声処理に失敗しました: ${e.message}")
                }
            } finally {
                withContext(Dispatchers.Main) {
                    showLoading(false)
                }
            }
        }
    }
    
    private fun shortArrayToByteArray(shortArray: ShortArray, length: Int): ByteArray {
        val byteBuffer = ByteBuffer.allocate(length * 2)
        byteBuffer.order(ByteOrder.LITTLE_ENDIAN)
        
        for (i in 0 until length) {
            byteBuffer.putShort(shortArray[i])
        }
        
        return byteBuffer.array()
    }
    
    private fun handleMessageResponse(data: Any?) {
        // This method is now handled by Socket.IO listeners in setupSocket()
    }
    
    private fun updateLastBotMessage(text: String) {
        if (messages.isNotEmpty() && !messages.last().isFromUser) {
            val lastIndex = messages.size - 1
            messages[lastIndex] = messages[lastIndex].copy(text = text)
            chatAdapter.notifyItemChanged(lastIndex)
        } else {
            val message = ChatMessage(
                id = UUID.randomUUID().toString(),
                text = text,
                isFromUser = false,
                timestamp = System.currentTimeMillis(),
                conversationId = app.sessionManager.getCurrentSessionId(),
                messageType = "text"
            )
            addMessage(message)
        }
    }
    
    private fun handleTTSStream(data: Any?) {
        // Handle TTS audio stream: expect either a JSONObject or array with fields
        Log.d(TAG, "TTS stream received: $data")

        try {
            val json = when (data) {
                is Array<*> -> (data.getOrNull(0) as? JSONObject)
                is JSONObject -> data
                else -> null
            }

            val base64Audio = json?.optString("audioData") ?: json?.optString("data") ?: json?.optString("chunk")
            val format = json?.optString("format") ?: "pcm16"

            if (base64Audio.isNullOrEmpty()) {
                addSystemMessage("音声チャンクを受信しました (データ無し)")
                return
            }

            // Decode base64 to bytes
            val audioBytes = Base64.decode(base64Audio, Base64.DEFAULT)

            // If WAV header present, strip header to get PCM16
            val pcmBytes = if (isWav(audioBytes)) {
                stripWavHeader(audioBytes)
            } else {
                audioBytes
            }

            // Play PCM16 via AudioTrack
            playPcm16(pcmBytes)

        } catch (e: Exception) {
            Log.e(TAG, "Error handling TTS stream", e)
            addSystemMessage("音声応答の再生に失敗しました: ${e.message}")
        }
    }

    private fun isWav(bytes: ByteArray): Boolean {
        if (bytes.size < 12) return false
        val header = String(bytes, 0, 4)
        return header == "RIFF"
    }

    private fun stripWavHeader(wav: ByteArray): ByteArray {
        // Minimal WAV header parsing to find 'data' chunk
        var offset = 12
        while (offset + 8 < wav.size) {
            val chunkId = String(wav, offset, 4)
            val chunkSize = java.nio.ByteBuffer.wrap(wav, offset + 4, 4).order(java.nio.ByteOrder.LITTLE_ENDIAN).int
            if (chunkId == "data") {
                val dataStart = offset + 8
                return wav.copyOfRange(dataStart, dataStart + chunkSize.coerceAtMost(wav.size - dataStart))
            }
            offset += 8 + chunkSize
        }
        // Fallback: return original
        return wav
    }

    private fun playPcm16(pcm: ByteArray) {
        try {
            val minBuf = android.media.AudioTrack.getMinBufferSize(SAMPLE_RATE, android.media.AudioFormat.CHANNEL_OUT_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT)
            val track = android.media.AudioTrack(android.media.AudioManager.STREAM_MUSIC, SAMPLE_RATE, android.media.AudioFormat.CHANNEL_OUT_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuf, pcm.size), android.media.AudioTrack.MODE_STREAM)
            track.play()
            track.write(pcm, 0, pcm.size)
            // Allow the track to finish playing
            track.stop()
            track.release()
        } catch (e: Exception) {
            Log.e(TAG, "AudioTrack playback failed", e)
        }
    }
    
    private fun handleFunctionCall(data: Any?) {
        try {
            val arr = data as? Array<*>
            if (arr != null && arr.isNotEmpty()) {
                val jsonData = arr[0] as? JSONObject
                val functionName = jsonData?.optString("function")
                val parameters = jsonData?.optJSONObject("parameters")

                    SmartLogger.d(requireContext(), TAG, "Function call: $functionName with parameters: $parameters")

                // Add system message about function execution
                addSystemMessage("機能を実行中: $functionName")
            }
        } catch (e: Exception) {
                SmartLogger.e(requireContext(), TAG, "Error handling function call", e)
        }
    }
    
    private fun showLoading(show: Boolean) {
        activity?.runOnUiThread {
            isProcessing = show
            binding.buttonSend.isEnabled = !show
            binding.buttonVoice.isEnabled = !show
            
            if (show) {
                binding.buttonSend.text = "処理中..."
                binding.loadingOverlay.visibility = View.VISIBLE
                binding.loadingText.text = "メッセージを処理中..."
            } else {
                binding.buttonSend.text = "送信"
                binding.loadingOverlay.visibility = View.GONE
            }
        }
    }
    
    private fun startRecordingAnimation() {
        val dots = listOf(
            binding.recordingDot1,
            binding.recordingDot2, 
            binding.recordingDot3
        )
        
        recordingAnimator = ValueAnimator.ofFloat(0.3f, 1.0f).apply {
            duration = 600
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            
            addUpdateListener { animator ->
                val alpha = animator.animatedValue as Float
                dots.forEachIndexed { index, dot ->
                    // 各ドットを順次アニメーション
                    val delay = index * 200L
                    val currentTime = (animator.currentPlayTime + delay) % (duration * 2)
                    val phase = (currentTime.toFloat() / (duration * 2)) * 2
                    
                    dot.alpha = if (phase <= 1) {
                        0.3f + (phase * 0.7f)
                    } else {
                        1.0f - ((phase - 1) * 0.7f)
                    }
                }
            }
            start()
        }
    }
    
    private fun stopRecordingAnimation() {
        recordingAnimator?.cancel()
        recordingAnimator = null
    }
    
    private fun showVoiceProcessing() {
        binding.loadingOverlay.visibility = View.VISIBLE
        binding.loadingText.text = "音声を処理中..."
    }
    
    private fun showSessionHistory() {
        val sessions = historyStore.getAllSessions()
        if (sessions.isEmpty()) {
            Toast.makeText(context, "履歴がありません", Toast.LENGTH_SHORT).show()
            return
        }
        
        val sessionNames = sessions.map { session ->
            "${session.id} (${session.messages.size}件) - ${
                java.text.SimpleDateFormat("MM/dd HH:mm", java.util.Locale.getDefault())
                    .format(java.util.Date(session.timestamp))
            }"
        }.toTypedArray()
        
        val builder = androidx.appcompat.app.AlertDialog.Builder(requireContext())
        builder.setTitle("チャット履歴を選択")
        builder.setItems(sessionNames) { _, which: Int ->
            val selectedSession = sessions[which]
            loadSession(selectedSession)
        }
        builder.setNegativeButton("キャンセル", null)
        builder.show()
    }
    
    private fun loadSession(session: com.lumimei.assistant.data.storage.ChatSession) {
        // 現在のメッセージをクリア
        messages.clear()
        
        // セッションのメッセージを復元
        session.messages.forEach { message: ChatMessage ->
            messages.add(message)
        }
        
        // UIを更新
        chatAdapter.notifyDataSetChanged()
        if (messages.isNotEmpty()) {
            binding.recyclerViewChat.scrollToPosition(messages.size - 1)
        }
        
        // セッション情報を更新
        currentSessionId = session.id
        updateSessionInfo()
        
        Toast.makeText(context, "履歴を復元しました", Toast.LENGTH_SHORT).show()
    }
    
    private fun showError(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        SmartLogger.e(requireContext(), TAG, message)
    }
    
    private fun addMessage(message: ChatMessage) {
        messages.add(message)
        chatAdapter.notifyItemInserted(messages.size - 1)
        binding.recyclerViewChat.scrollToPosition(messages.size - 1)
        
        // Update session info with message count
        updateSessionInfo()
    }

    private fun persistMessage(message: ChatMessage) {
        app.sessionManager.getCurrentSessionId()?.let { sid ->
            historyStore.append(sid, message)
        }
    }
    
    private fun addSystemMessage(content: String) {
        val systemMessage = ChatMessage(
            id = UUID.randomUUID().toString(),
            text = content,
            isFromUser = false,
            timestamp = System.currentTimeMillis(),
            conversationId = app.sessionManager.getCurrentSessionId(),
            messageType = "system"
        )
        addMessage(systemMessage)
    }
    
    private fun setupSessionObserver() {
        app.sessionManager.currentSession.observe(viewLifecycleOwner) { sessionState ->
            when (sessionState) {
                is SessionState.Starting -> {
                    addSystemMessage("セッションを開始しています...")
                }
                is SessionState.Active -> {
                    addSystemMessage("セッションが開始されました: ${sessionState.session.title}")
                }
                is SessionState.Ending -> {
                    addSystemMessage("セッションを終了しています...")
                }
                is SessionState.Disconnected -> {
                    addSystemMessage("セッションが終了されました")
                }
                is SessionState.Error -> {
                    addSystemMessage("セッションエラー: ${sessionState.message}")
                }
            }
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        
        if (isRecording) {
            stopRecording()
        }
        
        // Remove socket listeners
        socketManager.getSocket().off("ai_response")
        socketManager.getSocket().off("partial_text")
        socketManager.getSocket().off("tts_stream")
        socketManager.getSocket().off("function_call")
        socketManager.getSocket().off("error")
        
        _binding = null
    }
    
    private fun startNewSession() {
        // Save current chat history before starting new session
        app.sessionManager.getCurrentSessionId()?.let { currentSessionId ->
            historyStore.save(currentSessionId, messages)
        }
        
        // Clear current messages
        messages.clear()
        chatAdapter.notifyDataSetChanged()
        
        // Start new session
        app.sessionManager.startNewSession()
        
        // Update UI
        updateSessionInfo()
        
        // Add welcome message
        addSystemMessage("新しいセッションを開始しました。何かお手伝いできることはありますか？")
    }
    
    private fun updateSessionInfo() {
        val sessionId = app.sessionManager.getCurrentSessionId()
        val shortId = sessionId?.takeLast(8) ?: "不明"
        binding.tvSessionInfo.text = "セッション: $shortId (${messages.size}件のメッセージ)"
    }
}
