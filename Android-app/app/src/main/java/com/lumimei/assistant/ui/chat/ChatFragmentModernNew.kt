package com.lumimei.assistant.ui.chat

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.ChatMessage
import java.util.UUID
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.databinding.FragmentChatBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.models.BackendCompatibleModels
import kotlinx.coroutines.*

class ChatFragmentModernNew : Fragment() {
    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var securePreferences: SecurePreferences
    private lateinit var apiClient: ApiClient
    private var speechRecognizer: SpeechRecognizer? = null
    private var recordingAnimatorSet: AnimatorSet? = null
    private var isRecording = false
    private var isProcessing = false
    private var isTTSEnabled = false
    
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
        
    securePreferences = SecurePreferences(requireContext())
    apiClient = ApiClient(requireContext(), securePreferences)
        
        setupRecyclerView()
        setupVoiceInput()
        setupTTSState()
        
        // 引数から初期メッセージを取得
        arguments?.getString("initial_message")?.let { message ->
            if (message.isNotBlank()) {
                sendMessage(message)
            }
        }
    }
    
    private fun setupRecyclerView() {
        binding.recyclerViewChat.apply {
            layoutManager = LinearLayoutManager(context).apply {
                stackFromEnd = true
            }
            adapter = ChatAdapter(mutableListOf()) { message ->
                // メッセージクリック時のアクション
                if (message.isFromUser) {
                    Toast.makeText(context, "ユーザーメッセージ", Toast.LENGTH_SHORT).show()
                } else {
                    // アシスタントメッセージを読み上げ
                    if (isTTSEnabled) {
                        readAloud(message.text)
                    }
                }
            }.also { chatAdapter = it }
        }
    }
    
    private fun setupVoiceInput() {
        binding.buttonVoice.setOnClickListener {
            toggleVoiceInput()
        }
        
            binding.btnTts.setOnClickListener {
            toggleTTS()
        }
        
        // Long press for continuous recording
        binding.buttonVoice.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    if (!isRecording) {
                        startSpeechRecognition()
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (isRecording) {
                        stopSpeechRecognition()
                    }
                    true
                }
                else -> false
            }
        }
    }
    
    private fun toggleVoiceInput() {
        if (isRecording) {
            stopSpeechRecognition()
        } else {
            startSpeechRecognition()
        }
    }
    
    private fun setupTTSState() {
        isTTSEnabled = securePreferences.getBoolean("tts_enabled", false)
        updateTTSButtonState()
    }
    
    private fun toggleTTS() {
        isTTSEnabled = !isTTSEnabled
        securePreferences.putBoolean("tts_enabled", isTTSEnabled)
        updateTTSButtonState()
        
        Toast.makeText(
            context,
            if (isTTSEnabled) "TTS有効" else "TTS無効",
            Toast.LENGTH_SHORT
        ).show()
    }
    
    private fun updateTTSButtonState() {
        val colorRes = if (isTTSEnabled) R.color.colorPrimary else R.color.colorSecondary
            binding.btnTts.backgroundTintList = ContextCompat.getColorStateList(
            requireContext(), colorRes
        )
    }
    
    private fun startSpeechRecognition() {
        if (isRecording) return
        
        isRecording = true
        
        // Start recording animation
        startRecordingAnimation()
        
        // Initialize speech recognizer
        initializeSpeechRecognizer()
        
        // Start recognition
        speechRecognizer?.startListening(createSpeechRecognizerIntent())
        
            binding.btnVoiceMain.backgroundTintList = ContextCompat.getColorStateList(
            requireContext(), R.color.colorAccent
        )
    }
    
    private fun stopSpeechRecognition() {
        isRecording = false
        stopRecordingAnimation()
        speechRecognizer?.stopListening()
        
            binding.btnVoiceMain.backgroundTintList = ContextCompat.getColorStateList(
            requireContext(), R.color.colorPrimary
        )
        
        Toast.makeText(context, "音声入力停止", Toast.LENGTH_SHORT).show()
    }
    
    private fun initializeSpeechRecognizer() {
        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(requireContext())
            speechRecognizer?.setRecognitionListener(createRecognitionListener())
        }
    }
    
    private fun createSpeechRecognizerIntent(): Intent {
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ja-JP")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
    }
    
    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d("SpeechRecognition", "Ready for speech")
            }
            
            override fun onBeginningOfSpeech() {
                Log.d("SpeechRecognition", "Beginning of speech")
            }
            
            override fun onRmsChanged(rmsdB: Float) {
                // Update recording animation based on volume
            }
            
            override fun onBufferReceived(buffer: ByteArray?) {}
            
            override fun onEndOfSpeech() {
                Log.d("SpeechRecognition", "End of speech")
            }
            
            override fun onError(error: Int) {
                isRecording = false
                stopRecordingAnimation()
                
                binding.btnVoiceMain.backgroundTintList = ContextCompat.getColorStateList(
                    requireContext(), R.color.colorPrimary
                )
                
                Toast.makeText(context, "音声認識エラー", Toast.LENGTH_SHORT).show()
            }
            
            override fun onResults(results: Bundle?) {
                isRecording = false
                stopRecordingAnimation()
                
                binding.btnVoiceMain.backgroundTintList = ContextCompat.getColorStateList(
                    requireContext(), R.color.colorPrimary
                )
                
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val recognizedText = matches[0]
                    sendMessage(recognizedText)
                }
            }
            
            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    // Update UI with partial results if needed
                    Log.d("SpeechRecognition", "Partial: ${matches[0]}")
                }
            }
            
            override fun onEvent(eventType: Int, params: Bundle?) {}
        }
    }
    
    private fun startRecordingAnimation() {
    val scaleX = ObjectAnimator.ofFloat(binding.btnVoiceMain, "scaleX", 1f, 1.2f, 1f)
    val scaleY = ObjectAnimator.ofFloat(binding.btnVoiceMain, "scaleY", 1f, 1.2f, 1f)
        
        recordingAnimatorSet = AnimatorSet().apply {
            playTogether(scaleX, scaleY)
            duration = 1000
            start()
        }
    }
    
    private fun stopRecordingAnimation() {
        recordingAnimatorSet?.cancel()
        recordingAnimatorSet = null
        
    binding.btnVoiceMain.scaleX = 1f
    binding.btnVoiceMain.scaleY = 1f
    }
    
    private fun sendMessage(message: String) {
        if (message.isBlank() || isProcessing) return
        
        isProcessing = true
        
        // Add user message
                val userMessage = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = message,
                    isFromUser = true,
                    timestamp = System.currentTimeMillis(),
                    messageType = "text"
                )
        chatAdapter.addMessage(userMessage)
        binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
        
        // Send to API
        lifecycleScope.launch {
            try {
                val request = BackendCompatibleModels.ChatRequest(
                    message = message,
                    sessionId = "default_session"
                )
                
                val response = apiClient.sendChatMessage(request)
                
                // Add assistant message
                val assistantMessage = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = response.response,
                    isFromUser = false,
                    timestamp = System.currentTimeMillis(),
                    messageType = "text"
                )
                chatAdapter.addMessage(assistantMessage)
                binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
                
                // Read aloud if TTS is enabled
                if (isTTSEnabled) {
                    readAloud(response.response)
                }
                
            } catch (e: Exception) {
                Log.e("ChatFragment", "Error sending message", e)
                val errorMessage = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = "エラーが発生しました: ${e.message}",
                    isFromUser = false,
                    timestamp = System.currentTimeMillis(),
                    messageType = "text"
                )
                chatAdapter.addMessage(errorMessage)
            } finally {
                isProcessing = false
            }
        }
    }
    
    private fun readAloud(text: String) {
        if (!isTTSEnabled) return
        
        lifecycleScope.launch {
            try {
                val request = BackendCompatibleModels.TTSRequest(text = text)
                apiClient.synthesizeSpeech(request)
            } catch (e: Exception) {
                Log.e("ChatFragment", "TTS error", e)
                Toast.makeText(context, "音声合成に失敗しました", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        recordingAnimatorSet?.cancel()
        _binding = null
    }
    
    companion object {
        fun newInstance(): ChatFragmentModernNew {
            return ChatFragmentModernNew()
        }
        
        fun newInstance(initialMessage: String): ChatFragmentModernNew {
            return ChatFragmentModernNew().apply {
                arguments = Bundle().apply {
                    putString("initial_message", initialMessage)
                }
            }
        }
    }
}
