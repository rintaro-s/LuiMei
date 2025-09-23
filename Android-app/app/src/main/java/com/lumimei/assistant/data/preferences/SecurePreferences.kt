package com.lumimei.assistant.data.preferences

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID
import com.lumimei.assistant.BuildConfig

class SecurePreferences(private val context: Context) {
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "lumimei_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_WAKE_WORD_ENABLED = "wake_word_enabled"
        private const val KEY_TTS_ENABLED = "tts_enabled"
        private const val KEY_VOICE_STREAMING = "voice_streaming"
        private const val KEY_WAKE_WORD = "wake_word"
        private const val KEY_CHAT_TONE = "chat_tone"
        private const val KEY_GUEST_USER_ID = "guest_user_id"
    }
    
    var accessToken: String?
        get() = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
        set(value) = sharedPreferences.edit().putString(KEY_ACCESS_TOKEN, value).apply()
    
    var refreshToken: String?
        get() = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        set(value) = sharedPreferences.edit().putString(KEY_REFRESH_TOKEN, value).apply()
    
    var userId: String?
        get() = sharedPreferences.getString(KEY_USER_ID, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_ID, value).apply()
    
    var userEmail: String?
        get() = sharedPreferences.getString(KEY_USER_EMAIL, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_EMAIL, value).apply()
    
    var userName: String?
        get() = sharedPreferences.getString(KEY_USER_NAME, null)
        set(value) = sharedPreferences.edit().putString(KEY_USER_NAME, value).apply()
    
    var isFirstLaunch: Boolean
        get() = sharedPreferences.getBoolean(KEY_FIRST_LAUNCH, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_FIRST_LAUNCH, value).apply()
    
    var isWakeWordEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_WAKE_WORD_ENABLED, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_WAKE_WORD_ENABLED, value).apply()
    
    var isTtsEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_TTS_ENABLED, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_TTS_ENABLED, value).apply()
    
    var isVoiceStreamingEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_VOICE_STREAMING, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_VOICE_STREAMING, value).apply()
    
    var wakeWord: String?
        get() = sharedPreferences.getString(KEY_WAKE_WORD, "Hey Meimi")
        set(value) = sharedPreferences.edit().putString(KEY_WAKE_WORD, value).apply()

    var chatTone: String
        get() = sharedPreferences.getString(KEY_CHAT_TONE, "friendly") ?: "friendly"
        set(value) = sharedPreferences.edit().putString(KEY_CHAT_TONE, value).apply()
    
    // Helper methods for backward compatibility
    fun getFloat(key: String, defaultValue: Float): Float {
        return sharedPreferences.getFloat(key, defaultValue)
    }
    
    fun putFloat(key: String, value: Float) {
        sharedPreferences.edit().putFloat(key, value).apply()
    }
    
    fun getString(key: String, defaultValue: String?): String? {
        return sharedPreferences.getString(key, defaultValue)
    }
    
    fun putString(key: String, value: String?) {
        sharedPreferences.edit().putString(key, value).apply()
    }
    
    fun clearUserData() {
        logout()
    }
    
    fun isLoggedIn(): Boolean {
        return !accessToken.isNullOrEmpty()
    }
    
    fun getOrCreateGuestUserId(): String {
        // まず既存のゲストユーザーIDを確認
        val existingGuestId = sharedPreferences.getString(KEY_GUEST_USER_ID, null)
        if (!existingGuestId.isNullOrEmpty()) {
            return existingGuestId
        }
        
        // 新しいゲストユーザーIDを生成
        val deviceId = try {
            android.provider.Settings.Secure.getString(
                context.contentResolver, 
                android.provider.Settings.Secure.ANDROID_ID
            ) ?: UUID.randomUUID().toString()
        } catch (e: Exception) {
            UUID.randomUUID().toString()
        }
        
        val guestUserId = "guest_${deviceId.takeLast(8)}_${System.currentTimeMillis()}"
        sharedPreferences.edit().putString(KEY_GUEST_USER_ID, guestUserId).apply()
        return guestUserId
    }
    
    fun getCurrentUserId(): String {
        return if (isLoggedIn()) {
            userId ?: getOrCreateGuestUserId()
        } else {
            getOrCreateGuestUserId()
        }
    }
    
    fun logout() {
        sharedPreferences.edit().apply {
            remove(KEY_ACCESS_TOKEN)
            remove(KEY_REFRESH_TOKEN)
            remove(KEY_USER_EMAIL)
            remove(KEY_USER_NAME)
            // Keep userId for guest mode
            apply()
        }
    }
    
    fun saveAuthTokens(accessToken: String, refreshToken: String) {
        sharedPreferences.edit().apply {
            putString(KEY_ACCESS_TOKEN, accessToken)
            putString(KEY_REFRESH_TOKEN, refreshToken)
            apply()
        }
    }
    
    // ユーザーベースの設定保存
    fun putUserInt(key: String, value: Int) {
        val userKey = "${getCurrentUserId()}_$key"
        sharedPreferences.edit().putInt(userKey, value).apply()
    }
    
    fun getUserInt(key: String, defaultValue: Int = 0): Int {
        val userKey = "${getCurrentUserId()}_$key"
        return sharedPreferences.getInt(userKey, defaultValue)
    }
    
    fun putUserString(key: String, value: String) {
        val userKey = "${getCurrentUserId()}_$key"
        sharedPreferences.edit().putString(userKey, value).apply()
    }
    
    fun getUserString(key: String, defaultValue: String? = null): String? {
        val userKey = "${getCurrentUserId()}_$key"
        return sharedPreferences.getString(userKey, defaultValue)
    }
    
    fun putUserBoolean(key: String, value: Boolean) {
        val userKey = "${getCurrentUserId()}_$key"
        sharedPreferences.edit().putBoolean(userKey, value).apply()
    }
    
    fun getUserBoolean(key: String, defaultValue: Boolean = false): Boolean {
        val userKey = "${getCurrentUserId()}_$key"
        return sharedPreferences.getBoolean(userKey, defaultValue)
    }
    
    // Int型データの保存・取得
    fun putInt(key: String, value: Int) {
        sharedPreferences.edit().putInt(key, value).apply()
    }
    
    fun getInt(key: String, defaultValue: Int = 0): Int {
        return sharedPreferences.getInt(key, defaultValue)
    }
    
    // Boolean型データの保存・取得
    fun putBoolean(key: String, value: Boolean) {
        sharedPreferences.edit().putBoolean(key, value).apply()
    }
    
    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return sharedPreferences.getBoolean(key, defaultValue)
    }
    
    // Base URL取得メソッド
    fun getBaseUrl(): String {
        // If user explicitly set a base_url and it's not the common local-dev placeholder, use it
        val pref = sharedPreferences.getString("base_url", null)
        if (!pref.isNullOrBlank()) {
            // Treat localhost defaults as "not set" so real devices/emulators fall back to BuildConfig
            val lower = pref.lowercase()
            if (!lower.startsWith("http://localhost") && !lower.startsWith("http://10.0.2.2")) {
                return pref
            }
        }

        // Fall back to BuildConfig.SERVER_BASE_URL if available (useful for ngrok / CI overrides)
        return try {
            val buildBase = BuildConfig.SERVER_BASE_URL
            if (!buildBase.isNullOrBlank()) buildBase else "http://localhost:8080"
        } catch (e: Exception) {
            "http://localhost:8080"
        }
    }
}
