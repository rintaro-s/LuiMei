package com.lumimei.assistant.network

import android.content.Context
import android.util.Log
import com.lumimei.assistant.utils.SmartLogger
import com.lumimei.assistant.BuildConfig
import com.lumimei.assistant.data.preferences.SecurePreferences
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONObject
import java.net.URISyntaxException

class SocketManager(
    private val context: Context,
    private val securePreferences: SecurePreferences
) {
    
    private var socket: Socket? = null
    private var isConnected = false
    private var shouldReconnect = true
    
    private val listeners = mutableMapOf<String, MutableList<(Any?) -> Unit>>()
    
    companion object {
        private const val TAG = "SocketManager"
        
        // Socket events
        const val EVENT_CONNECT = Socket.EVENT_CONNECT
        const val EVENT_DISCONNECT = Socket.EVENT_DISCONNECT
        const val EVENT_CONNECT_ERROR = Socket.EVENT_CONNECT_ERROR
        
        // Custom events
        const val EVENT_MESSAGE_RESPONSE = "message_response"
        const val EVENT_FUNCTION_CALL = "function_call"
        const val EVENT_TTS_STREAM = "tts_stream"
        const val EVENT_DEVICE_STATUS = "device_status"
        const val EVENT_CALENDAR_UPDATE = "calendar_update"
        const val EVENT_STUDY_SESSION_UPDATE = "study_session_update"
        const val EVENT_SLEEP_REMINDER = "sleep_reminder"
        const val EVENT_WAKE_WORD_DETECTED = "wake_word_detected"
    }
    
    fun connect() {
        if (isConnected) return
        
        try {
            val options = IO.Options().apply {
                transports = arrayOf("websocket")
                reconnection = true
                reconnectionAttempts = 5
                reconnectionDelay = 1000
                timeout = 20000
                
                // Add auth token if available
                securePreferences.accessToken?.let { token ->
                    auth = mapOf("token" to token)
                }
            }
            
            socket = IO.socket(BuildConfig.SOCKET_URL, options)
            setupSocketListeners()
            socket?.connect()
            
            SmartLogger.d(context, TAG, "Attempting to connect to ${BuildConfig.SOCKET_URL}")
            
        } catch (e: URISyntaxException) {
            SmartLogger.e(context, TAG, "Socket connection failed", e)
        }
    }
    
    fun disconnect() {
        shouldReconnect = false
        socket?.disconnect()
        socket?.close()
        socket = null
        isConnected = false
    SmartLogger.d(context, TAG, "Socket disconnected")
    }
    
    fun isConnected(): Boolean = isConnected
    
    fun getSocket(): Socket {
        if (socket == null) {
            // Attempt to initialize socket lazily
            connect()
        }
        return socket ?: throw IllegalStateException("Socket not initialized. Call connect() first.")
    }
    
    private fun setupSocketListeners() {
        socket?.apply {
            on(EVENT_CONNECT) {
                isConnected = true
                SmartLogger.d(context, TAG, "Socket connected successfully")
                notifyListeners(EVENT_CONNECT, null)
            }
            
            on(EVENT_DISCONNECT) {
                isConnected = false
                SmartLogger.d(context, TAG, "Socket disconnected")
                notifyListeners(EVENT_DISCONNECT, null)
                
                if (shouldReconnect) {
                    // Auto reconnect after a delay
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (!isConnected && shouldReconnect) {
                            connect()
                        }
                    }, 3000)
                }
            }
            
            on(EVENT_CONNECT_ERROR) { args ->
                SmartLogger.e(context, TAG, "Socket connection error: ${args.contentToString()}")
                notifyListeners(EVENT_CONNECT_ERROR, args.firstOrNull())
            }
            
            // Custom event listeners
            on(EVENT_MESSAGE_RESPONSE) { args ->
                SmartLogger.d(context, TAG, "Message response received")
                notifyListeners(EVENT_MESSAGE_RESPONSE, args.firstOrNull())
            }
            
            on(EVENT_FUNCTION_CALL) { args ->
                SmartLogger.d(context, TAG, "Function call received")
                notifyListeners(EVENT_FUNCTION_CALL, args.firstOrNull())
            }
            
            on(EVENT_TTS_STREAM) { args ->
                SmartLogger.d(context, TAG, "TTS stream received")
                notifyListeners(EVENT_TTS_STREAM, args.firstOrNull())
            }

            // Compatibility: servers may emit audio_chunk or tts_audio_chunk
            on("audio_chunk") { args ->
                SmartLogger.d(context, TAG, "audio_chunk received (compat)")
                notifyListeners(EVENT_TTS_STREAM, args.firstOrNull())
            }

            on("tts_audio_chunk") { args ->
                SmartLogger.d(context, TAG, "tts_audio_chunk received (compat)")
                notifyListeners(EVENT_TTS_STREAM, args.firstOrNull())
            }
            
            on(EVENT_DEVICE_STATUS) { args ->
                SmartLogger.d(context, TAG, "Device status update received")
                notifyListeners(EVENT_DEVICE_STATUS, args.firstOrNull())
            }
            
            on(EVENT_CALENDAR_UPDATE) { args ->
                SmartLogger.d(context, TAG, "Calendar update received")
                notifyListeners(EVENT_CALENDAR_UPDATE, args.firstOrNull())
            }
            
            on(EVENT_STUDY_SESSION_UPDATE) { args ->
                SmartLogger.d(context, TAG, "Study session update received")
                notifyListeners(EVENT_STUDY_SESSION_UPDATE, args.firstOrNull())
            }
            
            on(EVENT_SLEEP_REMINDER) { args ->
                SmartLogger.d(context, TAG, "Sleep reminder received")
                notifyListeners(EVENT_SLEEP_REMINDER, args.firstOrNull())
            }
            
            on(EVENT_WAKE_WORD_DETECTED) { args ->
                SmartLogger.d(context, TAG, "Wake word detected")
                notifyListeners(EVENT_WAKE_WORD_DETECTED, args.firstOrNull())
            }
        }
    }
    
    fun addEventListener(event: String, listener: (Any?) -> Unit) {
        listeners.getOrPut(event) { mutableListOf() }.add(listener)
    }
    
    fun removeEventListener(event: String, listener: (Any?) -> Unit) {
        listeners[event]?.remove(listener)
    }
    
    private fun notifyListeners(event: String, data: Any?) {
        listeners[event]?.forEach { listener ->
            try {
                listener(data)
            } catch (e: Exception) {
                SmartLogger.e(context, TAG, "Error in socket listener for event $event", e)
            }
        }
    }
    
    fun emit(event: String, data: Any? = null) {
        if (!isConnected) {
            SmartLogger.w(context, TAG, "Socket not connected, cannot emit event: $event")
            return
        }
        
        try {
            when (data) {
                is JSONObject -> socket?.emit(event, data)
                is String -> socket?.emit(event, data)
                is Map<*, *> -> socket?.emit(event, JSONObject(data as Map<String, Any>))
                null -> socket?.emit(event)
                else -> socket?.emit(event, data.toString())
            }
            SmartLogger.d(context, TAG, "Emitted event: $event")
        } catch (e: Exception) {
            SmartLogger.e(context, TAG, "Error emitting event $event", e)
        }
    }
    
    // Convenience methods for common operations
    fun sendChatMessage(message: String) {
        val data = mapOf(
            "message" to message,
            "timestamp" to System.currentTimeMillis()
        )
        emit("chat_message", data)
    }
    
    fun sendVoiceChunk(audioData: String) {
        val data = mapOf(
            "audioChunk" to audioData,
            "format" to "wav",
            "sampleRate" to 16000
        )
        emit("voice_chunk", data)
    }
    
    fun startVoiceStream() {
        emit("start_voice_stream")
    }
    
    fun endVoiceStream() {
        emit("end_voice_stream")
    }
}
