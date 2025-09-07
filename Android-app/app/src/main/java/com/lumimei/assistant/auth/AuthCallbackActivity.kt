package com.lumimei.assistant.auth

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.ui.MainActivity
import com.lumimei.assistant.util.TokenUtils
import kotlinx.coroutines.launch
import java.net.URLDecoder

class AuthCallbackActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "AuthCallbackActivity"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Handle the deep link callback
        handleAuthCallback(intent)
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleAuthCallback(it) }
    }
    
    private fun handleAuthCallback(intent: Intent) {
        val data = intent.data
        Log.d(TAG, "Received auth callback with data: $data")
        
        if (data != null && data.scheme == "meimi" && data.host == "auth") {
            try {
                // Extract tokens from query parameters
                val accessToken = data.getQueryParameter("access")
                val refreshToken = data.getQueryParameter("refresh")
                
                // Also check fragment for tokens (some browsers may use fragment)
                val fragment = data.encodedFragment
                var fragmentAccessToken: String? = null
                var fragmentRefreshToken: String? = null
                
                if (!fragment.isNullOrEmpty()) {
                    val fragmentParams = parseFragment(fragment)
                    fragmentAccessToken = fragmentParams["access"]
                    fragmentRefreshToken = fragmentParams["refresh"]
                }
                
                // Use query parameters first, fall back to fragment
                val finalAccessToken = accessToken ?: fragmentAccessToken
                val finalRefreshToken = refreshToken ?: fragmentRefreshToken
                
                if (!finalAccessToken.isNullOrEmpty() && !finalRefreshToken.isNullOrEmpty()) {
                    // URL decode the tokens
                    val decodedAccessToken = URLDecoder.decode(finalAccessToken, "UTF-8")
                    val decodedRefreshToken = URLDecoder.decode(finalRefreshToken, "UTF-8")
                    
                    // Save tokens to secure preferences
                    val app = application as LumiMeiApplication
                    app.securePreferences.saveAuthTokens(decodedAccessToken, decodedRefreshToken)
                    
                    Log.d(TAG, "Auth tokens saved successfully")
                    
                    // Derive identity from access token claims immediately (fallback)
                    TokenUtils.getStringClaim(decodedAccessToken, "email")?.let { email ->
                        app.securePreferences.userEmail = email
                    }
                    val tokenUserId = TokenUtils.getStringClaim(decodedAccessToken, "userId")
                    val effectiveId = tokenUserId ?: app.securePreferences.userEmail
                    if (!effectiveId.isNullOrEmpty()) {
                        app.securePreferences.userId = effectiveId
                    }

                    // Fetch user profile to get userId and save it
                    fetchAndSaveUserProfile(app, decodedAccessToken)
                    
                    // Navigate to main activity
                    val mainIntent = Intent(this, com.lumimei.assistant.ui.MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        putExtra("auth_success", true)
                    }
                    startActivity(mainIntent)
                    finish()
                } else {
                    Log.e(TAG, "Missing access token or refresh token in callback")
                    handleAuthError("認証に失敗しました。トークンが見つかりません。")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error processing auth callback", e)
                handleAuthError("認証処理中にエラーが発生しました: ${e.message}")
            }
        } else {
            Log.e(TAG, "Invalid auth callback URI: $data")
            handleAuthError("無効な認証コールバックです。")
        }
    }
    
    private fun parseFragment(fragment: String): Map<String, String> {
        val params = mutableMapOf<String, String>()
        val pairs = fragment.split("&")
        
        for (pair in pairs) {
            val keyValue = pair.split("=")
            if (keyValue.size == 2) {
                params[keyValue[0]] = keyValue[1]
            }
        }
        
        return params
    }
    
    private fun handleAuthError(error: String) {
        Log.e(TAG, "Auth error: $error")
        
        // Navigate back to main activity with error
        val mainIntent = Intent(this, com.lumimei.assistant.ui.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("auth_error", error)
        }
        startActivity(mainIntent)
        finish()
    }
    
    private fun fetchAndSaveUserProfile(app: LumiMeiApplication, accessToken: String) {
        lifecycleScope.launch {
            try {
                val apiClient = ApiClient(this@AuthCallbackActivity, app.securePreferences)
                val response = apiClient.apiService.getUserProfile()
                
                if (response.isSuccessful) {
                    val profileResponse = response.body()
                    if (profileResponse?.success == true && profileResponse.data?.user != null) {
                        val user = profileResponse.data.user
                        val email = user.email
                        val userId = user.userId.ifEmpty { email }
                        val name = user.displayName

                        // Save user information to preferences
                        app.securePreferences.userId = userId
                        app.securePreferences.userEmail = email
                        app.securePreferences.userName = name

                        Log.d(TAG, "User profile saved: userId=$userId, email=$email")
                    } else {
                        Log.w(TAG, "Failed to get user profile: ${profileResponse?.error}")
                    }
                } else {
                    Log.w(TAG, "API call failed: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching user profile", e)
            }
        }
    }
}
