package com.lumimei.assistant.ui.chat

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.os.Bundle
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
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.databinding.FragmentChatBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.models.BackendCompatibleModels
import kotlinx.coroutines.*

class ChatFragmentModern : Fragment() {
    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var securePreferences: SecurePreferences
    private lateinit var apiClient: ApiClient
    
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
        setupClickListeners()
        setupTTSState()
        
        // デジタルアシスタントモードの場合、音声認識を自動開始
        if (arguments?.getBoolean("auto_start_voice", false) == true) {
            startVoiceRecognition()
        }
    }
    
    private fun setupRecyclerView() {
        chatAdapter = ChatAdapter(mutableListOf())
        
        binding.recyclerViewChat.apply {
            layoutManager = LinearLayoutManager(context).apply {
                stackFromEnd = true
            }
            adapter = chatAdapter
        }
    }
    
    private fun setupClickListeners() {
        // Send button
        binding.btnSend.setOnClickListener {
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
        
        // Central voice button (Push-to-Talk)
        binding.btnVoiceMain.setOnTouchListener { v, event ->
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
        
        // TTS button
        binding.btnTts.setOnClickListener {
            toggleTTS()
        }
        
        // Voice settings button
        binding.btnVoiceSettings?.setOnClickListener {
            showVoiceSelectionDialog()
        }
        
        // Recording overlay click to stop
        binding.voiceRecordingOverlay.setOnClickListener {
            if (isRecording) {
                stopRecording()
            }
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
            if (isTTSEnabled) "音声読み上げをオンにしました" else "音声読み上げをオフにしました",
            Toast.LENGTH_SHORT
        ).show()
    }
    
    private fun updateTTSButtonState() {
        if (isTTSEnabled) {
            binding.btnTts.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.success_color)
            )
        } else {
            binding.btnTts.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.secondary_color)
            )
        }
    }
    
    private fun startVoiceRecognition() {
        if (isRecording) return
        startRecording()
    }
    
    private fun startRecording() {
        try {
            isRecording = true
            
            // Show recording overlay
            binding.voiceRecordingOverlay.visibility = View.VISIBLE
            binding.tvVoiceStatus.apply {
                text = "録音中..."
                visibility = View.VISIBLE
            }
            
            // Change main button color
            binding.btnVoiceMain.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.error_color)
            )
            
            // Start recording animation
            startRecordingAnimation()
            
            Log.d("ChatFragmentModern", "Voice recording started")
            
        } catch (e: Exception) {
            Log.e("ChatFragmentModern", "Failed to start recording", e)
            isRecording = false
            binding.voiceRecordingOverlay.visibility = View.GONE
            binding.tvVoiceStatus.visibility = View.GONE
            Toast.makeText(context, "音声録音を開始できませんでした", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun stopRecording() {
        try {
            isRecording = false
            
            // Hide recording overlay
            binding.voiceRecordingOverlay.visibility = View.GONE
            binding.tvVoiceStatus.visibility = View.GONE
            
            // Reset main button color
            binding.btnVoiceMain.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.primary_color)
            )
            
            // Stop recording animation
            stopRecordingAnimation()
            
            // Simulate voice processing (replace with actual voice recognition)
            simulateVoiceInput()
            
            Log.d("ChatFragmentModern", "Voice recording stopped")
            
        } catch (e: Exception) {
            Log.e("ChatFragmentModern", "Failed to stop recording", e)
        }
    }
    
    private fun simulateVoiceInput() {
        // For demo purposes, simulate voice input
        val sampleVoiceInputs = listOf(
            "こんにちは",
            "今日の天気は？",
            "何か面白い話をして",
            "ありがとう"
        )
        val randomInput = sampleVoiceInputs.random()
        
        // Add voice message to chat
        val voiceMessage = ChatMessage(
            content = "🎤 $randomInput",
            isUser = true,
            timestamp = System.currentTimeMillis()
        )
        chatAdapter.addMessage(voiceMessage)
        
        // Process the voice input
        sendTextMessage(randomInput)
    }
    
    private fun startRecordingAnimation() {
        val ivAnimation = binding.ivVoiceRecording
        val scaleUpX = ObjectAnimator.ofFloat(ivAnimation, "scaleX", 1.0f, 1.2f)
        val scaleUpY = ObjectAnimator.ofFloat(ivAnimation, "scaleY", 1.0f, 1.2f)
        val scaleDownX = ObjectAnimator.ofFloat(ivAnimation, "scaleX", 1.2f, 1.0f)
        val scaleDownY = ObjectAnimator.ofFloat(ivAnimation, "scaleY", 1.2f, 1.0f)
        
        val animatorSet = AnimatorSet()
        animatorSet.play(scaleUpX).with(scaleUpY)
        animatorSet.play(scaleDownX).with(scaleDownY).after(scaleUpX)
        animatorSet.duration = 1000
        animatorSet.start()
    }
    
    private fun stopRecordingAnimation() {
        binding.ivVoiceRecording.animate().cancel()
        binding.ivVoiceRecording.scaleX = 1.0f
        binding.ivVoiceRecording.scaleY = 1.0f
    }
    
    private fun sendTextMessage(message: String) {
        isProcessing = true
        
        // Add user message to chat
        val userMessage = ChatMessage(
            content = message,
            isUser = true,
            timestamp = System.currentTimeMillis()
        )
        chatAdapter.addMessage(userMessage)
        
        // Scroll to bottom
        binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
        
        // Send to backend
        lifecycleScope.launch {
            try {
                val userId = securePreferences.userId ?: "anonymous"
                val request = BackendCompatibleModels.ChatRequest(
                    userId = userId,
                    message = message,
                    isVoice = false
                )
                
                val response = apiClient.assistantService.sendMessage(request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val assistantResponse = response.body()?.response
                    if (assistantResponse != null) {
                        val assistantMessage = ChatMessage(
                            content = assistantResponse.content,
                            isUser = false,
                            timestamp = System.currentTimeMillis()
                        )
                        
                        chatAdapter.addMessage(assistantMessage)
                        binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
                        
                        // TTS if enabled
                        if (isTTSEnabled) {
                            speakText(assistantResponse.content)
                        }
                    }
                } else {
                    // Fallback response
                    val fallbackMessage = ChatMessage(
                        content = "申し訳ございません。現在サーバーに接続できません。しばらく後でお試しください。",
                        isUser = false,
                        timestamp = System.currentTimeMillis()
                    )
                    chatAdapter.addMessage(fallbackMessage)
                    binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
                }
                
            } catch (e: Exception) {
                Log.e("ChatFragmentModern", "Failed to send message", e)
                
                // Error response
                val errorMessage = ChatMessage(
                    content = "エラーが発生しました: ${e.message}",
                    isUser = false,
                    timestamp = System.currentTimeMillis()
                )
                chatAdapter.addMessage(errorMessage)
                binding.recyclerViewChat.scrollToPosition(chatAdapter.itemCount - 1)
                
            } finally {
                isProcessing = false
            }
        }
    }
    
    private fun speakText(text: String) {
        // Get selected voice ID
        val voiceId = securePreferences.getInt("selected_voice_id", 2)
        
        lifecycleScope.launch {
            try {
                val request = BackendCompatibleModels.TTSRequest(
                    text = text,
                    voice = voiceId.toString()
                )
                
                val response = apiClient.assistantService.synthesizeSpeech(request)
                if (response.isSuccessful) {
                    Log.d("ChatFragmentModern", "TTS request successful")
                    Toast.makeText(context, "音声で応答中...", Toast.LENGTH_SHORT).show()
                } else {
                    Log.e("ChatFragmentModern", "TTS request failed: ${response.code()}")
                }
                
            } catch (e: Exception) {
                Log.e("ChatFragmentModern", "TTS error", e)
            }
        }
    }
    
    private fun showVoiceSelectionDialog() {
        // Simple voice selection for now
        val voices = arrayOf("四国めたん", "ずんだもん", "春日部つむぎ", "雨晴はう", "波音リツ")
        val currentVoice = securePreferences.getInt("selected_voice_id", 2)
        
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle("音声キャラクター選択")
            .setSingleChoiceItems(voices, currentVoice - 2) { dialog, which ->
                val voiceId = which + 2
                securePreferences.putInt("selected_voice_id", voiceId)
                Toast.makeText(context, "${voices[which]}に変更しました", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
    
    companion object {
        fun newInstance(autoStartVoice: Boolean = false): ChatFragmentModern {
            val fragment = ChatFragmentModern()
            val args = Bundle()
            args.putBoolean("auto_start_voice", autoStartVoice)
            fragment.arguments = args
            return fragment
        }
    }
}
