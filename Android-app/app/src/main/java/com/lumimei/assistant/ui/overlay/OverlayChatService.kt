package com.lumimei.assistant.ui.overlay

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.*
import android.widget.Toast
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.databinding.OverlayChatBinding
import com.lumimei.assistant.network.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.cancel
import com.lumimei.assistant.data.storage.ChatHistoryStore
import java.util.UUID

class OverlayChatService : Service() {
    
    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private lateinit var binding: OverlayChatBinding
    private lateinit var app: LumiMeiApplication
    private lateinit var apiClient: ApiClient
    private val serviceScope = CoroutineScope(Dispatchers.Main.immediate + SupervisorJob())
    private lateinit var historyStore: ChatHistoryStore
    
    private var isExpanded = false
    
    companion object {
        private const val TAG = "OverlayChatService"
        const val ACTION_SHOW = "com.lumimei.assistant.SHOW_OVERLAY"
        const val ACTION_HIDE = "com.lumimei.assistant.HIDE_OVERLAY"
        const val ACTION_TOGGLE = "com.lumimei.assistant.TOGGLE_OVERLAY"
    }
    
    override fun onCreate() {
        super.onCreate()
        app = application as LumiMeiApplication
        apiClient = ApiClient(this, app.securePreferences)
    historyStore = ChatHistoryStore(this, app.securePreferences)
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createOverlayView()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> showOverlay()
            ACTION_HIDE -> hideOverlay()
            ACTION_TOGGLE -> toggleOverlay()
        }
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun createOverlayView() {
        binding = OverlayChatBinding.inflate(LayoutInflater.from(this))
        overlayView = binding.root
        
        setupOverlayParams()
        setupClickListeners()
        setupDragListeners()
    }
    
    private fun setupOverlayParams() {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )
        
        params.gravity = Gravity.TOP or Gravity.END
        params.x = 0
        params.y = 100
        
        overlayView?.layoutParams = params
    }
    
    private fun setupClickListeners() {
        binding.buttonToggle.setOnClickListener {
            toggleChat()
        }
        
        binding.buttonSend.setOnClickListener {
            sendMessage()
        }
        
        binding.buttonClose.setOnClickListener {
            hideOverlay()
        }
        
        binding.buttonMinimize.setOnClickListener {
            minimizeChat()
        }
    }
    
    private fun setupDragListeners() {
        var lastX = 0
        var lastY = 0
        var initialX = 0
        var initialY = 0
        var isDragging = false
        
        binding.dragHandle.setOnTouchListener { _, event ->
            val params = overlayView?.layoutParams as? WindowManager.LayoutParams
                ?: return@setOnTouchListener false
            
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    lastX = event.rawX.toInt()
                    lastY = event.rawY.toInt()
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX.toInt() - lastX
                    val deltaY = event.rawY.toInt() - lastY
                    
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        isDragging = true
                        params.x = initialX - deltaX
                        params.y = initialY + deltaY
                        windowManager.updateViewLayout(overlayView, params)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        // Single tap - toggle chat
                        toggleChat()
                    }
                    true
                }
                else -> false
            }
        }
    }
    
    private fun showOverlay() {
        if (overlayView?.parent == null) {
            try {
                windowManager.addView(overlayView, overlayView?.layoutParams)
                updateUI()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to show overlay", e)
                Toast.makeText(this, "オーバーレイの表示に失敗しました", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun hideOverlay() {
        try {
            if (overlayView?.parent != null) {
                windowManager.removeView(overlayView)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to hide overlay", e)
        }
        stopSelf()
    }
    
    private fun toggleOverlay() {
        if (overlayView?.parent != null) {
            hideOverlay()
        } else {
            showOverlay()
        }
    }
    
    private fun toggleChat() {
        isExpanded = !isExpanded
        updateUI()
    }
    
    private fun minimizeChat() {
        isExpanded = false
        updateUI()
    }
    
    private fun updateUI() {
        if (isExpanded) {
            binding.chatLayout.visibility = View.VISIBLE
            binding.buttonToggle.text = "−"
            // Update layout params to accommodate expanded view
            val params = overlayView?.layoutParams as? WindowManager.LayoutParams
            params?.let {
                it.width = WindowManager.LayoutParams.MATCH_PARENT
                it.height = 600
                if (overlayView?.parent != null) {
                    windowManager.updateViewLayout(overlayView, it)
                }
            }
        } else {
            binding.chatLayout.visibility = View.GONE
            binding.buttonToggle.text = "💬"
            // Update layout params for minimized view
            val params = overlayView?.layoutParams as? WindowManager.LayoutParams
            params?.let {
                it.width = WindowManager.LayoutParams.WRAP_CONTENT
                it.height = WindowManager.LayoutParams.WRAP_CONTENT
                if (overlayView?.parent != null) {
                    windowManager.updateViewLayout(overlayView, it)
                }
            }
        }
    }
    
    private fun sendMessage() {
        val message = binding.editTextMessage.text.toString().trim()
        if (message.isNotEmpty()) {
            binding.editTextMessage.setText("")
            
            // Add user message to chat
            addMessageToChat(ChatMessage(
                id = UUID.randomUUID().toString(),
                text = message,
                isFromUser = true,
                timestamp = System.currentTimeMillis(),
                messageType = "text"
            ))
            
            // Send to server
            sendMessageToServer(message)
        }
    }
    
    private fun addMessageToChat(message: ChatMessage) {
        val messageText = if (message.isFromUser) {
            "あなた: ${message.text}"
        } else {
            "AI: ${message.text}"
        }
        
        val currentText = binding.textChatHistory.text.toString()
        val newText = if (currentText.isEmpty()) {
            messageText
        } else {
            "$currentText\n$messageText"
        }
        
        binding.textChatHistory.text = newText
        
        // Scroll to bottom
        binding.scrollView.post {
            binding.scrollView.fullScroll(View.FOCUS_DOWN)
        }
    }
    
    private fun sendMessageToServer(message: String) {
        if (!app.securePreferences.isLoggedIn()) {
            addMessageToChat(ChatMessage(
                id = UUID.randomUUID().toString(),
                text = "認証が必要です。メインアプリでログインしてください。",
                isFromUser = false,
                timestamp = System.currentTimeMillis(),
                messageType = "system"
            ))
            return
        }
        
        serviceScope.launch {
            try {
                val userId = app.securePreferences.userId ?: app.securePreferences.userEmail ?: return@launch
                
                val request = com.lumimei.assistant.data.models.BackendCompatibleModels.MessageRequest(
                    userId = userId,
                    messageType = "text",
                    message = message,
                    context = mapOf("source" to "overlay"),
                    options = mapOf(
                        "sessionId" to "overlay_${System.currentTimeMillis()}",
                        "tone" to app.securePreferences.chatTone
                    )
                )
                
                val response = withContext(Dispatchers.IO) {
                    apiClient.apiService.sendMessage(request)
                }
                
                if (response.isSuccessful) {
                    val messageResponse = response.body()
                    if (messageResponse?.success == true) {
                        messageResponse.response?.let { assistantResponse ->
                            addMessageToChat(ChatMessage(
                                id = UUID.randomUUID().toString(),
                                text = assistantResponse.content,
                                isFromUser = false,
                                timestamp = System.currentTimeMillis(),
                                messageType = "text"
                            ))
                        }
                    } else {
                        addMessageToChat(ChatMessage(
                            id = UUID.randomUUID().toString(),
                            text = "エラー: ${messageResponse?.error}",
                            isFromUser = false,
                            timestamp = System.currentTimeMillis(),
                            messageType = "system"
                        ))
                    }
                } else {
                    addMessageToChat(ChatMessage(
                        id = UUID.randomUUID().toString(),
                        text = "サーバーエラー: ${response.code()}",
                        isFromUser = false,
                        timestamp = System.currentTimeMillis(),
                        messageType = "system"
                    ))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending message", e)
                addMessageToChat(ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = "送信エラー: ${e.message}",
                    isFromUser = false,
                    timestamp = System.currentTimeMillis(),
                    messageType = "system"
                ))
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        try {
            serviceScope.cancel()
        } catch (_: Exception) {}
        hideOverlay()
    }
}
