package com.lumimei.assistant.ui.chat

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.util.Log
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.R
import com.lumimei.assistant.databinding.FragmentChatBinding
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.ui.chat.ChatAdapter
import kotlinx.coroutines.launch
import java.util.*

class ChatFragmentModern : Fragment() {
    
    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var chatAdapter: ChatAdapter
    private val messages = mutableListOf<ChatMessage>()
    private lateinit var app: LumiMeiApplication
    
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
        
        setupRecyclerView()
        setupMessageInput()
        setupVoiceAndTTSControls()
        
        // Welcome message
        addWelcomeMessage()
    }
    
    private fun setupRecyclerView() {
        try {
            chatAdapter = ChatAdapter(messages) { /* click listener */ }
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
            binding.btnSend.setOnClickListener {
                sendMessage()
            }
            
            binding.editTextMessage.setOnEditorActionListener { _, _, _ ->
                sendMessage()
                true
            }
        } catch (e: Exception) {
            // Handle input error gracefully
        }
    }
    
    private fun setupVoiceAndTTSControls() {
        try {
            // 音声入力ボタン（プッシュトゥトーク）
            binding.btnVoiceMain.setOnTouchListener { v, event ->
                when (event.action) {
                    android.view.MotionEvent.ACTION_DOWN -> {
                        startVoiceRecording()
                        true
                    }
                    android.view.MotionEvent.ACTION_UP -> {
                        stopVoiceRecording()
                        true
                    }
                    else -> false
                }
            }
            
            // TTS設定ボタン
            binding.btnTts.setOnClickListener {
                toggleTTSEnabled()
            }
            
            // 音声設定ボタン
            binding.btnVoiceSettings.setOnClickListener {
                openVoiceSettings()
            }
            
        } catch (e: Exception) {
            Log.e("ChatFragmentModern", "Error setting up voice controls", e)
        }
    }
    
    private fun startVoiceRecording() {
        try {
            // 録音権限チェック
            if (requireContext().checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) 
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), 1001)
                return
            }
            
            binding.voiceRecordingOverlay.visibility = View.VISIBLE
            binding.tvVoiceStatus.visibility = View.VISIBLE
            binding.tvVoiceStatus.text = "録音中... 離すと送信"
            
            // TODO: 実際の音声録音実装
            Log.d("ChatFragmentModern", "Voice recording started")
            
        } catch (e: Exception) {
            Log.e("ChatFragmentModern", "Error starting voice recording", e)
        }
    }
    
    private fun stopVoiceRecording() {
        try {
            binding.voiceRecordingOverlay.visibility = View.GONE
            binding.tvVoiceStatus.visibility = View.GONE
            
            // TODO: 音声データをSTTサービスに送信
            val mockTranscription = "音声入力のテストメッセージです"
            
            // 文字起こし結果をメッセージとして送信
            val userMessage = ChatMessage(
                id = generateMessageId(),
                text = "🎤 $mockTranscription",
                isFromUser = true,
                timestamp = System.currentTimeMillis(),
                messageType = "voice"
            )
            
            messages.add(userMessage)
            chatAdapter.notifyItemInserted(messages.size - 1)
            binding.recyclerViewChat.scrollToPosition(messages.size - 1)
            
            // AIに送信
            sendRealMessageToAPI(mockTranscription)
            
            Log.d("ChatFragmentModern", "Voice recording stopped")
            
        } catch (e: Exception) {
            Log.e("ChatFragmentModern", "Error stopping voice recording", e)
        }
    }
    
    private var ttsEnabled = true
    
    private fun toggleTTSEnabled() {
        ttsEnabled = !ttsEnabled
        binding.btnTts.alpha = if (ttsEnabled) 1.0f else 0.5f
        
        val message = if (ttsEnabled) "TTS有効" else "TTS無効"
        android.widget.Toast.makeText(requireContext(), message, android.widget.Toast.LENGTH_SHORT).show()
        
        // 設定を保存
        app.securePreferences.putUserBoolean("tts_enabled", ttsEnabled)
    }
    
    private fun openVoiceSettings() {
        try {
            // 音声設定画面を開く
            val intent = android.content.Intent(requireContext(), com.lumimei.assistant.ui.settings.SettingsActivity::class.java)
            intent.putExtra("focus_section", "voice_settings")
            startActivity(intent)
        } catch (e: Exception) {
            // フォールバック: 設定Fragment画面を開く
            try {
                val activity = requireActivity() as? com.lumimei.assistant.ui.MainActivity
                activity?.showSettingsFragment()
            } catch (e2: Exception) {
                android.widget.Toast.makeText(requireContext(), "設定画面を開けませんでした", android.widget.Toast.LENGTH_SHORT).show()
                Log.e("ChatFragmentModern", "Failed to open settings", e2)
            }
        }
    }
    
    private fun sendMessage() {
        try {
            val messageText = binding.editTextMessage.text.toString().trim()
            if (messageText.isNotEmpty()) {
                // Add user message
                val userMessage = ChatMessage(
                    id = generateMessageId(),
                    text = messageText,
                    isFromUser = true,
                    timestamp = System.currentTimeMillis(),
                    messageType = "text"
                )
                
                messages.add(userMessage)
                chatAdapter.notifyItemInserted(messages.size - 1)
                
                // Clear input
                binding.editTextMessage.text.clear()
                
                // Scroll to bottom
                binding.recyclerViewChat.scrollToPosition(messages.size - 1)
                
                // Send to AI (REAL API CALL - NO MOCK!)
                sendRealMessageToAPI(messageText)
            }
        } catch (e: Exception) {
            // Handle send error gracefully
        }
    }
    
    private fun sendRealMessageToAPI(userMessage: String) {
        try {
            lifecycleScope.launch {
                try {
                    val userId = app.securePreferences.userId ?: "user_${System.currentTimeMillis()}"
                    
                    val request = BackendCompatibleModels.MessageRequest(
                        userId = userId,
                        messageType = "text",
                        message = userMessage,
                        context = mapOf(
                            "sessionId" to "chat_${System.currentTimeMillis()}",
                            "locale" to "ja-JP"
                        ),
                        options = mapOf(
                            "stream" to false,
                            "model" to "gemma-3-12b-it@q4_k_m"
                        )
                    )
                    
                    val response = app.apiClient.apiService.sendMessage(request)
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val aiResponse = ChatMessage(
                            id = generateMessageId(),
                            text = response.body()?.response?.content ?: "申し訳ありません。応答を生成できませんでした。",
                            isFromUser = false,
                            timestamp = System.currentTimeMillis(),
                            messageType = "text"
                        )
                        
                        messages.add(aiResponse)
                        chatAdapter.notifyItemInserted(messages.size - 1)
                        binding.recyclerViewChat.scrollToPosition(messages.size - 1)
                        
                        // Save chat history to local storage
                        app.securePreferences.putString(
                            "chat_${System.currentTimeMillis()}",
                            "${userMessage}|${aiResponse.text}"
                        )
                        
                    } else {
                        showErrorMessage("API応答エラー: ${response.body()?.error ?: "不明なエラー"}")
                    }
                    
                } catch (e: Exception) {
                    showErrorMessage("通信エラー: ${e.message}")
                    Log.e("ChatFragmentModern", "Error sending message to API", e)
                }
            }
        } catch (e: Exception) {
            showErrorMessage("メッセージ送信に失敗しました: ${e.message}")
        }
    }
    
    private fun showErrorMessage(errorText: String) {
        val errorMessage = ChatMessage(
            id = generateMessageId(),
            text = "⚠️ $errorText",
            isFromUser = false,
            timestamp = System.currentTimeMillis(),
            messageType = "error"
        )
        
        messages.add(errorMessage)
        chatAdapter.notifyItemInserted(messages.size - 1)
        binding.recyclerViewChat.scrollToPosition(messages.size - 1)
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
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
