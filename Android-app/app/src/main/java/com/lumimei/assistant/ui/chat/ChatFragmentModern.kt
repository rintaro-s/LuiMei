package com.lumimei.assistant.ui.chat

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import android.content.Intent
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.MotionEvent
import android.media.MediaPlayer
import android.util.Base64
import java.io.File
import java.io.FileOutputStream
import androidx.core.content.ContextCompat
import androidx.cardview.widget.CardView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.R
import com.lumimei.assistant.databinding.FragmentChatModernBinding
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.ui.chat.ChatAdapter
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.utils.SmartLogger
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.*

class ChatFragmentModern : Fragment() {
    
    private var _binding: FragmentChatModernBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var chatAdapter: ChatAdapter
    private val messages = mutableListOf<ChatMessage>()
    private var speechRecognizer: SpeechRecognizer? = null
    private var isRecording = false
    private lateinit var app: LumiMeiApplication
    private lateinit var apiClient: ApiClient
    private lateinit var securePreferences: SecurePreferences
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentChatModernBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        app = requireActivity().application as LumiMeiApplication
        apiClient = ApiClient(requireContext(), app.securePreferences)
        securePreferences = app.securePreferences

        setupRecyclerView()
        setupMessageInput()
        setupTTSState()

        // Welcome message
        addWelcomeMessage()
    }

    private var isTTSEnabled = false

    private fun setupTTSState() {
        try {
            isTTSEnabled = securePreferences.getBoolean("tts_enabled", true)
            // Bind TTS toggle if present
            try {
                binding.btnTts.setOnClickListener {
                    isTTSEnabled = !isTTSEnabled
                    securePreferences.putBoolean("tts_enabled", isTTSEnabled)
                    if (isTTSEnabled) Toast.makeText(requireContext(), "読み上げを有効にしました", Toast.LENGTH_SHORT).show()
                    else Toast.makeText(requireContext(), "読み上げを無効にしました", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) { /* btnTts may not exist in some layouts */ }
        } catch (e: Exception) {
            // fallback default
            isTTSEnabled = true
        }
    }
    
    private fun setupRecyclerView() {
        try {
            chatAdapter = ChatAdapter(messages) { /* click listener */ }
            // Use view binding from fragment_chat_modern.xml
            binding.recyclerViewChat.apply {
                layoutManager = LinearLayoutManager(requireContext())
                adapter = chatAdapter
            }
        } catch (e: Exception) {
            // Handle setup error gracefully
        }
    }
    
    private fun setupMessageInput() {
        try {
            // Modern layout uses btn_send and btn_voice_input IDs
            binding.btnSend.setOnClickListener {
                // Read content and dispatch
                val edit = binding.editTextMessage
                val text = edit?.text?.toString()?.trim() ?: ""
                if (text.isNotEmpty()) {
                    sendMessage(text)
                    edit?.text?.clear()
                }
            }

            binding.btnVoiceInput.setOnClickListener {
                // Start a simple voice flow using device SpeechRecognizer
                if (!isRecording) startSpeechRecognition() else stopSpeechRecognition()
            }

            // If there's a TTS button, reflect saved state
            try {
                val ttsEnabled = securePreferences.getBoolean("tts_enabled", true)
                // color toggle
                if (ttsEnabled) binding.btnTts.setCardBackgroundColor(ContextCompat.getColor(requireContext(), R.color.colorPrimary))
                else binding.btnTts.setCardBackgroundColor(ContextCompat.getColor(requireContext(), R.color.secondary_color))
            } catch (e: Exception) { /* ignore */ }

            // Central main voice button (push-to-talk) is in fragment_chat.xml as btn_voice_main
            try {
                    val mainBtn = binding.root.findViewById<com.google.android.material.card.MaterialCardView>(R.id.btn_voice_main)
                    mainBtn?.setOnTouchListener { v, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            if (!isRecording) startSpeechRecognition()
                            true
                        }
                        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                            if (isRecording) stopSpeechRecognition()
                            true
                        }
                        else -> false
                    }
                }
            } catch (e: Exception) {
                // Some layouts may not include btn_voice_main; ignore if absent
            }
        } catch (e: Exception) {
            // Handle input error gracefully
        }
    }

    private fun startSpeechRecognition() {
        if (isRecording) return
        try {
            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(requireContext())
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) {
                        isRecording = false
                        Toast.makeText(requireContext(), "音声認識エラー: $error", Toast.LENGTH_SHORT).show()
                    }
                    override fun onResults(results: Bundle?) {
                        isRecording = false
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (!matches.isNullOrEmpty()) {
                            val text = matches[0]
                            sendMessage(text)
                        }
                    }
                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ja-JP")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }

            isRecording = true
            speechRecognizer?.startListening(intent)
            // update UI if present
            try {
                    binding.root.findViewById<com.google.android.material.card.MaterialCardView>(R.id.btn_voice_main)
                        ?.setCardBackgroundColor(ContextCompat.getColor(requireContext(), R.color.colorAccent))
                binding.voiceRecordingOverlay.visibility = View.VISIBLE
            } catch (_: Exception) {}
        } catch (e: Exception) {
            isRecording = false
        }
    }

    private fun stopSpeechRecognition() {
        try {
            isRecording = false
            speechRecognizer?.stopListening()
        } catch (e: Exception) {
            // ignore
        }
        try {
            binding.root.findViewById<com.google.android.material.card.MaterialCardView>(R.id.btn_voice_main)
                    ?.setCardBackgroundColor(ContextCompat.getColor(requireContext(), R.color.primary_color))
            binding.voiceRecordingOverlay.visibility = View.GONE
        } catch (_: Exception) {}
    }

    private fun sendMessage(text: String) {
        // Add user message
        val userMessage = ChatMessage(
            id = generateMessageId(),
            text = text,
            isFromUser = true,
            timestamp = System.currentTimeMillis(),
            messageType = "text"
        )
        messages.add(userMessage)
        chatAdapter.notifyItemInserted(messages.size - 1)

        // Send to server
        lifecycleScope.launch {
            try {
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: run {
                    withContext(Dispatchers.Main) { showToast("ユーザーIDが見つかりません。ログインしてください") }
                    return@launch
                }

                val request = BackendCompatibleModels.MessageRequest(
                    userId = userId,
                    messageType = "text",
                    message = text,
                    context = mapOf("sessionId" to (app.sessionManager.getCurrentSessionId() ?: "unknown")),
                    options = mapOf("sessionId" to (app.sessionManager.getCurrentSessionId() ?: "session_${System.currentTimeMillis()}"))
                )

                val response = apiClient.apiService.sendMessage(request)

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val body = response.body()
                        if (body?.success == true) {
                            // Android expects response to be an AssistantResponse object
                            val assistantResponse = body.response
                            val assistantText = if (assistantResponse is com.lumimei.assistant.data.models.BackendCompatibleModels.AssistantResponse) {
                                assistantResponse.content
                            } else {
                                // Fallback: attempt to stringify unknown response shapes
                                assistantResponse?.toString() ?: ""
                            }

                            val aiMessage = ChatMessage(
                                id = UUID.randomUUID().toString(),
                                text = assistantText,
                                isFromUser = false,
                                timestamp = System.currentTimeMillis(),
                                messageType = "text"
                            )
                            addMessage(aiMessage)

                            // Auto TTS if enabled
                            if (isTTSEnabled && assistantText.isNotBlank()) {
                                lifecycleScope.launch {
                                    try {
                                        val ttsReq = com.lumimei.assistant.data.models.BackendCompatibleModels.TTSRequest(text = assistantText)
                                        val ttsResp = app.apiClient.synthesizeSpeech(ttsReq)
                                        if (ttsResp != null && ttsResp.success && !ttsResp.audioData.isNullOrEmpty()) {
                                            playBase64Audio(ttsResp.audioData ?: "", ttsResp.format ?: "wav")
                                        } else {
                                            SmartLogger.e(requireContext(), "ChatFragmentModern", "TTS response empty or failed: ${'$'}{ttsResp?.error}")
                                        }
                                    } catch (e: Exception) {
                                        SmartLogger.e(requireContext(), "ChatFragmentModern", "TTS failed", e)
                                    }
                                }
                            }
                        } else {
                            showToast("送信失敗: ${body?.error}")
                        }
                    } else {
                        showToast("サーバーエラー: ${response.code()} ${response.message()}")
                    }
                }
            } catch (e: Exception) {
                SmartLogger.e(requireContext(), "ChatFragmentModern", "Error sending message", e)
                withContext(Dispatchers.Main) { showToast("送信中にエラー: ${e.message}") }
            }
        }
    }

    private fun showToast(msg: String) {
        Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
    }
    
    // Helper to add message to UI (keeps modern fragment self-contained)
    private fun simulateAIResponse(userMessage: String) {
        try {
            // Simple AI response simulation
            val responses = listOf(
                "こんにちは！どのようにお手伝いできますか？",
                "興味深いご質問ですね。詳しく教えてください。",
                "そのことについて考えてみますね。",
                "もう少し詳細を教えていただけますか？"
            )
            
            val aiResponse = ChatMessage(
                id = generateMessageId(),
                text = responses.random(),
                isFromUser = false,
                timestamp = System.currentTimeMillis(),
                messageType = "text"
            )
            
            messages.add(aiResponse)
            chatAdapter.notifyItemInserted(messages.size - 1)
            binding.recyclerViewChat.scrollToPosition(messages.size - 1)
        } catch (e: Exception) {
            // Handle AI response error gracefully
        }
    
    }

    private fun addMessage(message: ChatMessage) {
        try {
            messages.add(message)
            chatAdapter.notifyItemInserted(messages.size - 1)
            binding.recyclerViewChat.scrollToPosition(messages.size - 1)
        } catch (e: Exception) {
            // ignore UI update errors
        }
    }
    
    private fun addWelcomeMessage() {
        try {
            val welcomeMessage = ChatMessage(
                id = generateMessageId(),
                text = "こんにちは！LumiMeiアシスタントです。何かお手伝いできることはありますか？",
                isFromUser = false,
                timestamp = System.currentTimeMillis(),
                messageType = "text"
            )
            
            messages.add(welcomeMessage)
            chatAdapter.notifyItemInserted(messages.size - 1)
        } catch (e: Exception) {
            // Handle welcome message error gracefully
        }
    }
    
    private fun generateMessageId(): String {
        return "msg_${System.currentTimeMillis()}_${(0..999).random()}"
    }

    // Play base64-encoded audio (wav/pcm) using MediaPlayer by writing to a temp file
    private fun playBase64Audio(base64: String, format: String = "wav") {
        try {
            val audioBytes = Base64.decode(base64, Base64.DEFAULT)
            val suffix = if (format.contains("wav", true)) ".wav" else ".raw"
            val tempFile = File.createTempFile("tts_play", suffix, requireContext().cacheDir)
            FileOutputStream(tempFile).use { fos ->
                fos.write(audioBytes)
                fos.flush()
            }

            val mp = MediaPlayer()
            mp.setDataSource(tempFile.absolutePath)
            mp.prepare()
            mp.setOnCompletionListener { player ->
                try { player.release() } catch (_: Exception) {}
                try { tempFile.delete() } catch (_: Exception) {}
            }
            mp.start()
        } catch (e: Exception) {
            SmartLogger.e(requireContext(), "ChatFragmentModern", "TTS playback error", e)
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
