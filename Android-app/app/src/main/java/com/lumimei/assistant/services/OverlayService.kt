package com.lumimei.assistant.services

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

class OverlayService : Service() {
    companion object {
        const val ACTION_SHOW_OVERLAY = "com.lumimei.assistant.SHOW_OVERLAY"
        const val ACTION_HIDE_OVERLAY = "com.lumimei.assistant.HIDE_OVERLAY"
        const val ACTION_TOGGLE_CHAT = "com.lumimei.assistant.TOGGLE_CHAT"
        private const val TAG = "OverlayService"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "OverlayService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW_OVERLAY -> showOverlay()
            ACTION_HIDE_OVERLAY -> hideOverlay()
            ACTION_TOGGLE_CHAT -> toggleChatMode()
        }
        
        return START_STICKY
    }

    private fun showOverlay() {
        Log.d(TAG, "Show overlay requested")
        // TODO: Implement overlay functionality
    }

    private fun hideOverlay() {
        Log.d(TAG, "Hide overlay requested")
        // TODO: Implement hide overlay functionality
    }

    private fun toggleChatMode() {
        Log.d(TAG, "Toggle chat mode requested")
        // TODO: Implement chat mode toggle
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "OverlayService destroyed")
    }
}
