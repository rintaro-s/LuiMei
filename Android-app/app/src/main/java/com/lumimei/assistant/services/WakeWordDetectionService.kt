package com.lumimei.assistant.services

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.lumimei.assistant.utils.SmartLogger
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.lumimei.assistant.ui.MainActivity
import com.lumimei.assistant.R
import com.lumimei.assistant.data.preferences.SecurePreferences
import kotlinx.coroutines.*
import kotlin.math.*

class WakeWordDetectionService : Service() {
    
    private var audioRecord: AudioRecord? = null
    private var isListening = false
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    
    private lateinit var securePreferences: SecurePreferences
    private var sensitivity = 0.7f
    private var wakeWordPhrase = "ルミメイ"
    
    companion object {
        private const val TAG = "WakeWordService"
        private const val NOTIFICATION_ID = 3001
        private const val CHANNEL_ID = "wake_word_channel"
        
        private const val SAMPLE_RATE = 16000
        private val BUFFER_SIZE by lazy {
            AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ) * 2
        }
        
        // 簡単なウェイクワード検出のための音声特徴閾値
        private const val ENERGY_THRESHOLD = 500.0 // 閾値を下げて反応しやすく
        private const val WAKE_WORD_DURATION_MS = 1500L
    }
    
    override fun onCreate() {
        super.onCreate()
        securePreferences = SecurePreferences(this)
        
        loadSettings()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START_DETECTION" -> startWakeWordDetection()
            "STOP_DETECTION" -> stopWakeWordDetection()
            "TOGGLE_DETECTION" -> toggleWakeWordDetection()
        }
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    private fun loadSettings() {
        sensitivity = try { securePreferences.getFloat("wake_word_sensitivity", 0.7f) } catch (e: Exception) { 0.7f }
        wakeWordPhrase = try { securePreferences.getString("wake_word_phrase", "ルミメイ") ?: "ルミメイ" } catch (e: Exception) { "ルミメイ" }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Wake Word Detection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Wake word detection service"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        val stopIntent = Intent(this, WakeWordDetectionService::class.java).apply {
            action = "STOP_DETECTION"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val openAppIntent = Intent(this, com.lumimei.assistant.ui.MainActivity::class.java)
        val openAppPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ルミメイ - ウェイクワード検出")
            .setContentText(if (isListening) "「$wakeWordPhrase」を待機中..." else "待機中")
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(openAppPendingIntent)
            .addAction(R.drawable.ic_stop, "停止", stopPendingIntent)
            .setOngoing(true)
            .setShowWhen(false)
            .build()
    }
    
    private fun updateNotification() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, createNotification())
    }
    
    private fun startWakeWordDetection() {
        if (isListening) return
        
        if (!hasAudioPermission()) {
            SmartLogger.w(this, TAG, "Audio permission not granted")
            return
        }
        
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                BUFFER_SIZE
            )
            
            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                SmartLogger.e(this, TAG, "AudioRecord initialization failed")
                return
            }
            
            isListening = true
            audioRecord?.startRecording()
            updateNotification()
            
            // 音声処理を別スレッドで開始
            serviceScope.launch {
                processAudioStream()
            }
            
            SmartLogger.i(this, TAG, "Wake word detection started")
            
        } catch (e: Exception) {
            SmartLogger.e(this, TAG, "Failed to start wake word detection", e)
            isListening = false
        }
    }
    
    private fun stopWakeWordDetection() {
        if (!isListening) return
        
        isListening = false
        audioRecord?.apply {
            if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                stop()
            }
            release()
        }
        audioRecord = null
        updateNotification()
        
        SmartLogger.i(this, TAG, "Wake word detection stopped")
    }
    
    private fun toggleWakeWordDetection() {
        if (isListening) {
            stopWakeWordDetection()
        } else {
            startWakeWordDetection()
        }
    }
    
    private suspend fun processAudioStream() {
        val buffer = ShortArray(BUFFER_SIZE)
        val energyBuffer = mutableListOf<Double>()
        val maxEnergyBufferSize = (WAKE_WORD_DURATION_MS * SAMPLE_RATE / 1000 / BUFFER_SIZE).toInt()
        
        while (isListening) {
            try {
                val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                
                if (bytesRead > 0) {
                    // 音声エネルギーを計算
                    val energy = calculateEnergy(buffer, bytesRead)
                    energyBuffer.add(energy)
                    
                    // バッファサイズを制限
                    if (energyBuffer.size > maxEnergyBufferSize) {
                        energyBuffer.removeAt(0)
                    }
                    
                    // ウェイクワード検出ロジック（簡易版）
                    if (detectWakeWord(energyBuffer)) {
                        onWakeWordDetected()
                        // 検出後は少し待機して重複検出を防ぐ
                        delay(2000)
                        energyBuffer.clear()
                    }
                }
                
                delay(10) // CPU使用率を下げるための短い待機
                
            } catch (e: Exception) {
                SmartLogger.e(this, TAG, "Error processing audio stream", e)
                break
            }
        }
    }
    
    private fun calculateEnergy(buffer: ShortArray, size: Int): Double {
        var sum = 0.0
        for (i in 0 until size) {
            sum += buffer[i] * buffer[i]
        }
        return sqrt(sum / size)
    }
    
    private fun detectWakeWord(energyBuffer: List<Double>): Boolean {
        if (energyBuffer.size < 10) return false
        
        // 簡易的なウェイクワード検出ロジック
        // 実際の実装では音声認識エンジンや機械学習モデルを使用
        
        val averageEnergy = energyBuffer.average()
        val maxEnergy = energyBuffer.maxOrNull() ?: 0.0
        val energyVariance = energyBuffer.map { (it - averageEnergy).pow(2) }.average()
        
        // エネルギーが閾値を超え、かつ変動がある場合にウェイクワードとして判定
        val threshold = ENERGY_THRESHOLD * sensitivity
        val hasEnoughEnergy = maxEnergy > threshold
        val hasVariation = energyVariance > threshold * 0.1
        
        // デバッグログを追加
        if (maxEnergy > threshold * 0.3) { // 30%の閾値でも音声を検出した場合ログ出力
            SmartLogger.d(this, TAG, "Audio detected - Max: $maxEnergy, Avg: $averageEnergy, Threshold: $threshold, HasEnergy: $hasEnoughEnergy, HasVariation: $hasVariation")
        }
        
        return hasEnoughEnergy && hasVariation
    }
    
    private fun onWakeWordDetected() {
        SmartLogger.i(this, TAG, "Wake word detected: $wakeWordPhrase")
        
        // オーバーレイチャットを開く
        val overlayIntent = Intent(this, com.lumimei.assistant.ui.overlay.OverlayChatService::class.java).apply {
            action = "WAKE_WORD_ACTIVATED"
        }
        startService(overlayIntent)
        
        // 検出音を再生（オプション）
        if (try { securePreferences.getBoolean("wake_word_sound", true) } catch (e: Exception) { true }) {
            playDetectionSound()
        }
        
        // 振動フィードバック（オプション）
        if (try { securePreferences.getBoolean("wake_word_vibration", true) } catch (e: Exception) { true }) {
            vibrate()
        }
    }
    
    private fun playDetectionSound() {
        // 簡単な検出音を再生
        try {
            val toneGenerator = android.media.ToneGenerator(
                android.media.AudioManager.STREAM_NOTIFICATION,
                50 // 音量（0-100）
            )
            toneGenerator.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 200)
            toneGenerator.release()
        } catch (e: Exception) {
            SmartLogger.w(this, TAG, "Could not play detection sound", e)
        }
    }
    
    private fun vibrate() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    android.os.VibrationEffect.createOneShot(
                        200,
                        android.os.VibrationEffect.DEFAULT_AMPLITUDE
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(200)
            }
        } catch (e: Exception) {
            SmartLogger.w(this, TAG, "Could not vibrate", e)
        }
    }
    
    private fun hasAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopWakeWordDetection()
        serviceScope.cancel()
    }
}
