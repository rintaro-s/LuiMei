package com.lumimei.assistant

import android.app.Application
import android.content.Intent
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.network.SocketManager
import com.lumimei.assistant.session.SessionManager
import com.lumimei.assistant.services.WakeWordDetectionService

class LumiMeiApplication : Application() {
    
    lateinit var securePreferences: SecurePreferences
    lateinit var apiClient: ApiClient
    lateinit var socketManager: SocketManager
    lateinit var sessionManager: SessionManager
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize secure preferences
        securePreferences = SecurePreferences(this)
        
        // Initialize API client
        apiClient = ApiClient(this, securePreferences)
        
        // Initialize Socket.IO manager
        socketManager = SocketManager(this, securePreferences)
        
        // Initialize session manager
        sessionManager = SessionManager(this, apiClient, securePreferences)
        
        // Start wake word service if enabled
        if (try { securePreferences.getBoolean("wake_word_enabled", false) } catch (e: Exception) { false }) {
            startWakeWordService()
        }
        
        // Set global instance
        instance = this
    }
    
    private fun startWakeWordService() {
        val intent = Intent(this, WakeWordDetectionService::class.java).apply {
            action = "START_DETECTION"
        }
        startForegroundService(intent)
    }
    
    fun stopWakeWordService() {
        val intent = Intent(this, WakeWordDetectionService::class.java).apply {
            action = "STOP_DETECTION"
        }
        startService(intent)
    }
    
    companion object {
        lateinit var instance: LumiMeiApplication
            private set
    }
}
