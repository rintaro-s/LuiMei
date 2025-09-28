package com.lumimei.assistant.network

import android.content.Context
import com.google.gson.GsonBuilder
import com.lumimei.assistant.BuildConfig
import com.lumimei.assistant.data.preferences.SecurePreferences
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import android.util.Log
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import com.lumimei.assistant.data.models.BackendCompatibleModels.TokenResponse
import com.lumimei.assistant.data.models.BackendCompatibleModels.ApiResponse
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class ApiClient(
    private val context: Context,
    private val securePreferences: SecurePreferences
) {
    
    private val gson = GsonBuilder()
        .setLenient()
        .create()
    
    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val requestBuilder = original.newBuilder()
        
        // Add Authorization header if access token exists
        securePreferences.accessToken?.let { token ->
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }
        
        // Add common headers
        requestBuilder.addHeader("Content-Type", "application/json")
        requestBuilder.addHeader("Accept", "application/json")
        
        chain.proceed(requestBuilder.build())
    }
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }
    
    // Auth-less client for refresh token calls
    private val authlessOkHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

    // Interceptor to auto-refresh token on 401 once
    private val refreshInterceptor = Interceptor { chain ->
        var request = chain.request()
        var response = chain.proceed(request)

        if (response.code == 401 && request.header("X-Refresh-Attempt") != "true") {
            response.close()
            val newAccess = refreshAccessTokenSync()
            if (!newAccess.isNullOrEmpty()) {
                val newReq: Request = request.newBuilder()
                    .removeHeader("Authorization")
                    .addHeader("Authorization", "Bearer $newAccess")
                    .addHeader("X-Refresh-Attempt", "true")
                    .build()
                return@Interceptor chain.proceed(newReq)
            }
        }

        response
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(refreshInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()
    
    private val retrofit = Retrofit.Builder()
        // Ensure trailing slash as required by Retrofit
        .baseUrl((if (BuildConfig.SERVER_BASE_URL.endsWith("/")) BuildConfig.SERVER_BASE_URL else BuildConfig.SERVER_BASE_URL + "/"))
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()
    
    val apiService: ApiService = retrofit.create(ApiService::class.java)
    
    // Create a dedicated life service interface
    val lifeService: ApiService = apiService
    
    companion object {
        const val TIMEOUT_SECONDS = 30L
        private const val TAG = "ApiClient"
    }

    private fun refreshAccessTokenSync(): String? {
        val refresh = securePreferences.refreshToken ?: return null
        return try {
            val base = if (BuildConfig.SERVER_BASE_URL.endsWith("/")) BuildConfig.SERVER_BASE_URL else BuildConfig.SERVER_BASE_URL + "/"
            val url = base + "api/auth/refresh"
            val mediaType = "application/json; charset=utf-8".toMediaType()
            val payload = "{\"refresh\":\"$refresh\"}"
            val body = payload.toRequestBody(mediaType)
            val req = Request.Builder()
                .url(url)
                .post(body)
                .addHeader("Accept", "application/json")
                .build()
            authlessOkHttpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val json = resp.body?.string() ?: return null
                // Re-parse properly with generics workaround
                val tokenResponse = try {
                    gson.fromJson(json, com.google.gson.reflect.TypeToken.getParameterized(ApiResponse::class.java, TokenResponse::class.java).type) as ApiResponse<TokenResponse>
                } catch (e: Exception) {
                    null
                }
                val tokens = tokenResponse?.data?.tokens
                val access = tokens?.accessToken
                val newRefresh = tokens?.refreshToken ?: refresh
                if (!access.isNullOrEmpty()) {
                    securePreferences.saveAuthTokens(access, newRefresh)
                    return access
                }
                null
            }
        } catch (e: Exception) {
            null
        }
    }
    
    // Chat API
    suspend fun sendChatMessage(request: com.lumimei.assistant.data.models.BackendCompatibleModels.ChatRequest): com.lumimei.assistant.data.models.BackendCompatibleModels.ChatResponse {
        return try {
            val jsonBody = gson.toJson(request)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            
            val httpRequest = Request.Builder()
                .url("${securePreferences.getBaseUrl()}/api/chat")
                .post(requestBody)
                .build()
                
            okHttpClient.newCall(httpRequest).execute().use { response ->
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    gson.fromJson(responseBody, com.lumimei.assistant.data.models.BackendCompatibleModels.ChatResponse::class.java)
                } else {
                    com.lumimei.assistant.data.models.BackendCompatibleModels.ChatResponse(
                        response = "エラーが発生しました",
                        success = false,
                        error = "HTTP ${response.code}"
                    )
                }
            }
        } catch (e: Exception) {
            com.lumimei.assistant.data.models.BackendCompatibleModels.ChatResponse(
                response = "ネットワークエラー",
                success = false,
                error = e.message
            )
        }
    }
    
    // TTS API
    suspend fun synthesizeSpeech(request: com.lumimei.assistant.data.models.BackendCompatibleModels.TTSRequest): com.lumimei.assistant.data.models.BackendCompatibleModels.TTSResponse {
        return try {
            val jsonBody = gson.toJson(request)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

            // Debug: log BuildConfig and secure preferences so we can confirm which base URL is being used
            val buildBase = try { BuildConfig.SERVER_BASE_URL } catch (e: Exception) { "" }
            val secureBase = securePreferences.getBaseUrl()
            Log.d(TAG, "synthesizeSpeech -> BuildConfig.SERVER_BASE_URL=$buildBase securePrefBase=$secureBase")

            // Normalize base URL and use securePreferences value for the actual request to preserve runtime overrides
            var baseNormalized = secureBase.trim()
            if (baseNormalized.endsWith("/")) baseNormalized = baseNormalized.dropLast(1)
            val effectiveUrl = "$baseNormalized/api/tts"
            Log.d(TAG, "synthesizeSpeech -> url=$effectiveUrl payload=$jsonBody")

            // Build request with explicit headers (helpful if interceptors misbehave)
            val httpRequestBuilder = Request.Builder()
                .url(effectiveUrl)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "application/json")

            try {
                okHttpClient.newCall(httpRequestBuilder.build()).execute().use { response ->
                    val responseBody = response.body?.string()
                    Log.d(TAG, "synthesizeSpeech <- response code=${response.code} body=${responseBody}")
                    if (response.isSuccessful && responseBody != null) {
                        gson.fromJson(responseBody, com.lumimei.assistant.data.models.BackendCompatibleModels.TTSResponse::class.java)
                    } else {
                        Log.w(TAG, "synthesizeSpeech non-success response: code=${response.code}")
                        com.lumimei.assistant.data.models.BackendCompatibleModels.TTSResponse(
                            success = false,
                            error = "HTTP ${response.code}",
                            audioData = null,
                            format = null
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "synthesizeSpeech exception while sending request", e)
                com.lumimei.assistant.data.models.BackendCompatibleModels.TTSResponse(
                    success = false,
                    error = e.toString()
                )
            }
        } catch (e: Exception) {
            com.lumimei.assistant.data.models.BackendCompatibleModels.TTSResponse(
                success = false,
                error = e.message
            )
        }
    }

    // STT API  
    suspend fun transcribeAudio(request: com.lumimei.assistant.data.models.BackendCompatibleModels.STTRequest): com.lumimei.assistant.data.models.BackendCompatibleModels.STTResponse {
        return try {
            val jsonBody = gson.toJson(request)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            
            val httpRequest = Request.Builder()
                .url("${securePreferences.getBaseUrl()}/api/stt")
                .post(requestBody)
                .build()
                
            okHttpClient.newCall(httpRequest).execute().use { response ->
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    gson.fromJson(responseBody, com.lumimei.assistant.data.models.BackendCompatibleModels.STTResponse::class.java)
                } else {
                    com.lumimei.assistant.data.models.BackendCompatibleModels.STTResponse(
                        success = false,
                        transcription = "",
                        error = "HTTP ${response.code}"
                    )
                }
            }
        } catch (e: Exception) {
            com.lumimei.assistant.data.models.BackendCompatibleModels.STTResponse(
                success = false,
                transcription = "",
                error = e.message
            )
        }
    }

    // Meeting Summary API
    suspend fun summarizeMeeting(transcription: String): com.lumimei.assistant.data.models.BackendCompatibleModels.BasicResponse {
        return try {
            val request = mapOf(
                "transcription" to transcription,
                "type" to "meeting_summary"
            )
            val jsonBody = gson.toJson(request)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            
            val httpRequest = Request.Builder()
                .url("${securePreferences.getBaseUrl()}/api/summary")
                .post(requestBody)
                .build()
                
            okHttpClient.newCall(httpRequest).execute().use { response ->
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    gson.fromJson(responseBody, com.lumimei.assistant.data.models.BackendCompatibleModels.BasicResponse::class.java)
                } else {
                    com.lumimei.assistant.data.models.BackendCompatibleModels.BasicResponse(
                        success = false,
                        error = "HTTP ${response.code}"
                    )
                }
            }
        } catch (e: Exception) {
            com.lumimei.assistant.data.models.BackendCompatibleModels.BasicResponse(
                success = false,
                error = e.message
            )
        }
    }
}
