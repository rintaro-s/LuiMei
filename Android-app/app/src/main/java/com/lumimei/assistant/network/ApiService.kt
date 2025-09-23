package com.lumimei.assistant.network

import com.lumimei.assistant.data.models.BackendCompatibleModels
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    
    // Authentication
    @POST("auth/register")
    suspend fun register(@Body request: BackendCompatibleModels.RegisterRequest): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.AuthResponse>>
    
    @POST("auth/login")
    suspend fun login(@Body request: BackendCompatibleModels.LoginRequest): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.AuthResponse>>
    
    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: BackendCompatibleModels.RefreshTokenRequest): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.TokenResponse>>
    
    @GET("user/profile")
    suspend fun getUserProfile(): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.UserProfilePayload>>
    
    @POST("auth/logout")
    suspend fun logout(): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    // Chat and Voice
    @POST("chat/message")
    suspend fun sendMessage(@Body request: BackendCompatibleModels.MessageRequest): Response<BackendCompatibleModels.MessageResponse>
    
    @POST("voice/input")
    suspend fun processVoiceInput(@Body request: BackendCompatibleModels.VoiceInputRequest): Response<BackendCompatibleModels.VoiceResponse>
    
    // Study Sessions
    @POST("study/start")
    suspend fun startStudySession(@Body request: BackendCompatibleModels.StartStudySessionRequest): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @POST("study/end")
    suspend fun endStudySession(@Body request: BackendCompatibleModels.EndSessionRequest): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @GET("study/status")
    suspend fun getSessionStatus(): Response<BackendCompatibleModels.SessionStatusResponse>
    
    // Calendar
    @GET("calendar/events")
    suspend fun getCalendarEvents(@Query("date") date: String?, @Query("range") range: String?): Response<BackendCompatibleModels.ApiResponse<List<BackendCompatibleModels.CalendarEvent>>>
    
    @POST("calendar/events")
    suspend fun createCalendarEvent(@Body event: BackendCompatibleModels.CalendarEvent): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.CalendarEvent>>
    
    @DELETE("calendar/events/{id}")
    suspend fun deleteCalendarEvent(@Path("id") eventId: String): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @GET("health")
    suspend fun healthCheck(): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @GET("sleep")
    suspend fun getSleepRecords(@Query("range") range: String?): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @POST("sleep/oversleep")
    suspend fun reportOversleep(@Body request: BackendCompatibleModels.ImageAnalysisRequest): Response<BackendCompatibleModels.ImageAnalysisResponse>
    
    @GET("shopping")
    suspend fun getShoppingList(): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @POST("shopping")
    suspend fun addShoppingItem(@Body request: BackendCompatibleModels.ApiResponse<Unit>): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    @GET("recipes")
    suspend fun getRecipes(): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    // TTS and STT
    @POST("tts/synthesize")
    suspend fun synthesizeText(@Body request: BackendCompatibleModels.TTSRequest): Response<BackendCompatibleModels.TTSResponse>
    
    @GET("study/sessions")
    suspend fun getStudySessions(): Response<BackendCompatibleModels.StudySessionsResponse>
    
    @POST("study/progress")
    suspend fun updateStudyProgress(@Body request: BackendCompatibleModels.StudyProgressRequest): Response<BackendCompatibleModels.ApiResponse<Unit>>
    
    // Image Analysis
    @POST("image/analyze")
    suspend fun analyzeImage(@Body request: BackendCompatibleModels.ImageAnalysisRequest): Response<BackendCompatibleModels.ImageAnalysisResponse>
    
    // New APIs for added features
    @POST("stt/transcribe")
    suspend fun speechToText(@Body request: BackendCompatibleModels.STTRequest): Response<BackendCompatibleModels.STTResponse>

    // Life assistant endpoints
    @GET("life/cleaning")
    suspend fun getCleaningSchedule(): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.CleaningSchedule>>

    @GET("life/expenses")
    suspend fun getExpenseTracking(@Query("month") month: String?): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.ExpenseTracking>>
    
    @GET("meeting/memos")
    suspend fun getMeetingMemos(): Response<BackendCompatibleModels.ApiResponse<List<BackendCompatibleModels.MeetingMemo>>>
    
    @GET("life/cooking")
    suspend fun getCookingSuggestions(
        @Query("ingredients") ingredients: String? = null,
        @Query("difficulty") difficulty: String? = null,
        @Query("mealType") mealType: String? = null
    ): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.CookingSuggestions>>
    
    @GET("life/tips")
    suspend fun getLifeTips(@Query("category") category: String? = null): Response<BackendCompatibleModels.ApiResponse<BackendCompatibleModels.LifeTips>>
}
