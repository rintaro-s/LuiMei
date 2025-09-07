package com.lumimei.assistant.data.models

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.*

enum class MessageType {
    TEXT,
    VOICE,
    IMAGE,
    AUDIO,
    SYSTEM
}

data class StudySession(
    val id: String,
    val title: String,
    val startTime: Long,
    val endTime: Long?,
    val progress: Float,
    val description: String?,
    val subject: String = "general",
    val goal: String = "",
    val duration: Int = 60,
    val isActive: Boolean = false,
    val teacherMode: Boolean = false,
    val timerMode: Boolean = true
)

data class CalendarEvent(
    val id: String,
    val title: String,
    val description: String? = null,
    val startTime: String,
    val endTime: String,
    val location: String? = null
)

// Base Response Models
// Backend API Models
object BackendCompatibleModels {
    
    data class ChatMessage(
        val id: String = UUID.randomUUID().toString(),
        val content: String,
        val timestamp: Long = System.currentTimeMillis(),
        val isFromUser: Boolean,
        val messageType: MessageType = MessageType.TEXT
    )
    
    data class ApiResponse<T>(
        val success: Boolean,
        val data: T? = null,
        val error: String? = null,
        val message: String? = null,
        val code: Int? = null
    )

data class BasicResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null
)

// Authentication Models
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String,
    val personality: PersonalitySettings? = null,
    val preferences: UserPreferences? = null,
    val deviceInfo: DeviceInfo? = null
)

data class LoginRequest(
    val email: String,
    val password: String,
    val deviceInfo: DeviceInfo? = null
)

data class RefreshTokenRequest(
    val refresh: String? = null,
    val refreshToken: String? = null
)

data class AuthResponse(
    val success: Boolean,
    val userId: String?,
    val tokens: TokenPair?,
    val user: User? = null,
    val error: String? = null
)

data class TokenResponse(
    val success: Boolean,
    val tokens: TokenPair?,
    val error: String? = null
)

data class TokenPair(
    @SerializedName("access") val accessToken: String,
    @SerializedName("refresh") val refreshToken: String? = null
)

// Communication Models - Compatible with backend
data class MessageRequest(
    val userId: String,
    val messageType: String = "text",
    val message: String,
    val context: Map<String, Any>? = null,
    val options: Map<String, Any>? = null
)

data class MessageResponse(
    val success: Boolean,
    val messageId: String?,
    val sessionId: String?,
    val response: AssistantResponse?,
    val metadata: MessageMetadata?,
    val error: String? = null
)

data class AssistantResponse(
    val content: String,
    val type: String = "text",
    val emotion: EmotionData? = null,
    val actions: List<Map<String, Any>>? = null,
    val suggestions: List<String>? = null,
    @SerializedName("llm_raw") val llmRaw: String? = null
)

data class MessageMetadata(
    val timestamp: String?,
    val messageType: String?,
    val userId: String?,
    val processingTime: Int?,
    val parsedTags: Map<String, Any>? = null,
    val calendar: CalendarMetadata? = null
)

data class CalendarMetadata(
    val date: String?,
    val total: Int?,
    val events: List<CalendarEvent>? = null
)

data class EmotionData(
    val dominant: String,
    val confidence: Double
)

// Voice Models
data class VoiceInputRequest(
    val userId: String,
    val audioData: String, // Base64 encoded
    val format: String = "wav",
    val options: Map<String, Any>? = null
)

data class VoiceResponse(
    val success: Boolean,
    val transcription: String?,
    val confidence: Double?,
    val response: AssistantResponse?,
    val metadata: VoiceMetadata?,
    val error: String? = null
)

data class VoiceMetadata(
    val processingTime: Double?,
    val timestamp: String?,
    val audioFormat: String?,
    val language: String?,
    val sttEngine: String?
)

data class VoiceOutputResponse(
    val success: Boolean,
    val data: VoiceOutputData?,
    val error: String? = null
)

data class VoiceOutputData(
    val messageId: String,
    val audioData: String, // Base64 encoded
    val format: String,
    val duration: Double,
    val generatedAt: String,
    val voice: VoiceSettings
)

data class VoiceSettings(
    val gender: String,
    val language: String,
    val speed: Double
)

// TTS Models
data class TTSRequest(
    val text: String,
    val voice: String = "ja-JP-Wavenet-A",
    val format: String = "wav",
    val speaker: String? = null // voicebox用のスピーカーID
)

data class TTSResponse(
    val success: Boolean,
    val jobId: String? = null,
    val audioData: String? = null, // Base64 if direct response
    val format: String? = null,
    val duration: Double? = null,
    val voiceId: Int? = null,
    val voiceName: String? = null,
    val error: String? = null,
    val metadata: Map<String, Any>? = null
)

// Chat Models
data class ChatRequest(
    val message: String,
    val sessionId: String? = null,
    val conversationId: String? = null,
    val userId: String? = null,
    val assistantType: String? = null,
    val timestamp: Long? = null
)

data class ChatResponse(
    val response: String,
    val success: Boolean = true,
    val error: String? = null
)

// Image Analysis Models
data class ImageAnalysisRequest(
    val userId: String,
    val imageData: String, // Base64 encoded
    val context: Map<String, Any>? = null
)

data class ImageAnalysisResponse(
    val success: Boolean,
    val analysis: String? = null,
    val error: String? = null
)

data class ImageAnalysis(
    val description: String,
    val objects: List<DetectedObject>,
    val colors: List<String>,
    val mood: String,
    val style: String,
    val extractedText: String? = null
)

data class DetectedObject(
    val name: String,
    val confidence: Double,
    val boundingBox: List<Int>
)

data class ImageAnalysisMetadata(
    val processingTime: Double?,
    val timestamp: String?,
    val imageSize: Int?,
    val analysisModel: String?
)

// Session Models
data class StartSessionRequest(
    val userId: String,
    val sessionConfig: Map<String, Any>? = null
)

data class EndSessionRequest(
    val sessionId: String
)

data class SessionResponse(
    val success: Boolean,
    val message: String?,
    val data: SessionData?,
    val error: String? = null
)

data class SessionData(
    val session: SessionInfo? = null,
    val sessionId: String? = null,
    val endTime: String? = null
)

data class SessionInfo(
    val sessionId: String,
    val userId: String,
    val config: Map<String, Any>?,
    val startTime: String,
    val status: String
)

data class SessionStatusResponse(
    val success: Boolean,
    val data: SessionStatus?,
    val error: String? = null
)

data class SessionStatus(
    val sessionId: String,
    val status: String,
    val startTime: String,
    val lastActivity: String,
    val messageCount: Int
)

// Context Models
data class UpdateContextRequest(
    val userId: String?,
    val context: Map<String, Any>
)

data class ContextResponse(
    val success: Boolean,
    val data: ContextData?,
    val error: String? = null
)

data class ContextData(
    val context: UserContext
)

data class UserContext(
    val userId: String,
    val currentSession: String?,
    val mood: String?,
    val preferences: Map<String, Any>?,
    val recentTopics: List<String>?,
    val conversationHistory: List<ConversationMessage>?
)

data class ConversationMessage(
    val messageId: String,
    val content: String,
    val timestamp: String,
    val role: String
)

// Device Command Models
data class DeviceCommandRequest(
    val deviceId: String,
    val command: String,
    val parameters: Map<String, Any>? = null
)

data class DeviceCommandResponse(
    val success: Boolean,
    val message: String?,
    val data: DeviceCommandData?,
    val error: String? = null
)

data class DeviceCommandData(
    val execution: CommandExecution
)

data class CommandExecution(
    val commandId: String,
    val deviceId: String,
    val command: String,
    val parameters: Map<String, Any>?,
    val status: String,
    val result: String,
    val executedAt: String,
    val responseTime: Double
)

data class CommandStatusResponse(
    val success: Boolean,
    val data: CommandStatus?,
    val error: String? = null
)

data class CommandStatus(
    val commandId: String,
    val status: String,
    val result: String,
    val executedAt: String,
    val responseTime: Double
)

// User Models
data class User(
    val userId: String,
    val email: String,
    val displayName: String,
    val personality: PersonalitySettings? = null,
    val preferences: UserPreferences? = null,
    val devices: List<DeviceInfo>? = null,
    val status: UserStatus? = null,
    val subscription: SubscriptionInfo? = null,
    val usage: UsageStats? = null
)

    // Wrapper for profile endpoints that return { data: { user: { ... } } }
    data class UserProfilePayload(
        val user: User
    )

data class PersonalitySettings(
    val mode: String = "friendly",
    val voice: VoicePersonality? = null,
    val responseStyle: ResponseStyle? = null
)

data class VoicePersonality(
    val language: String = "ja-JP",
    val gender: String = "neutral"
)

data class ResponseStyle(
    val formality: String = "polite",
    val emoji: Boolean = true
)

data class UserPreferences(
    val theme: String = "auto",
    val language: String = "ja",
    val notifications: NotificationSettings? = null
)

data class NotificationSettings(
    val push: Boolean = true,
    val email: Boolean = true
)

data class DeviceInfo(
    val deviceId: String,
    val deviceName: String,
    val deviceType: String,
    val platform: String,
    val capabilities: DeviceCapabilities? = null
)

data class DeviceCapabilities(
    val hasCamera: Boolean = false,
    val hasMicrophone: Boolean = false,
    val hasSpeaker: Boolean = false,
    val supportsNotifications: Boolean = false
)

data class UserStatus(
    val isOnline: Boolean = false,
    val lastActiveAt: Date? = null
)

data class SubscriptionInfo(
    val plan: String = "free",
    val expiresAt: Date? = null
)

data class UsageStats(
    val totalMessages: Int = 0,
    val totalSessions: Int = 0
)

// Calendar Models
data class CalendarEvent(
    val id: String? = null,
    val title: String,
    val description: String? = null,
    val startTime: String,
    val endTime: String,
    val location: String? = null,
    val attendees: List<String>? = null
)

// Device Control Request Models
data class PhoneSettingsRequest(
    val action: String,
    val value: Any,
    val duration: Int? = null
)

data class LineMessageRequest(
    val recipient: String,
    val message: String,
    val type: String = "text"
)

data class DiscordMessageRequest(
    val channel: String,
    val message: String,
    val embed: Map<String, Any>? = null
)

data class IntegratedActionRequest(
    val actionType: String,
    val settings: Map<String, Any>
)

// Wake Word Models
data class WakeWordSettings(
    val wakeWords: List<String>,
    val sensitivity: Double,
    val enabled: Boolean,
    val popupDuration: Int
)

data class WakeWordDetectionRequest(
    val audioData: String, // Base64
    val confidence: Double
)

data class WakeWordDetectionResponse(
    val detected: Boolean,
    val confidence: Double,
    val wakeWord: String?
)

// Sleep & Alarm Models
data class AlarmSettings(
    val id: String? = null,
    val time: String,
    val label: String?,
    val recurring: RecurringSettings?,
    val sounds: List<String>?,
    val snoozeMinutes: Int = 5,
    val enabled: Boolean = true
)

data class RecurringSettings(
    val enabled: Boolean,
    val days: List<String>
)

data class CreateAlarmRequest(
    val time: String,
    val label: String?,
    val recurring: RecurringSettings?,
    val sounds: List<String>?,
    val snoozeMinutes: Int = 5
)

data class SleepRecord(
    val id: String? = null,
    val bedtime: String,
    val wakeTime: String,
    val quality: Int,
    val notes: String?
)

data class SleepRecordRequest(
    val bedtime: String,
    val wakeTime: String,
    val quality: Int,
    val notes: String?
)

// STT (Speech-to-Text) Models
data class STTRequest(
    val audioData: String, // Base64 encoded audio
    val language: String = "ja-JP",
    val engine: String = "vosk" // vosk or whisper
)

data class STTResponse(
    val success: Boolean,
    val transcription: String,
    val confidence: Double? = null,
    val error: String? = null
)

// Meeting Memo Models
data class MeetingMemo(
    val id: String,
    val title: String,
    val transcription: String,
    val summary: String,
    val audioFileName: String,
    val timestamp: Long,
    val userId: String
)

data class OversleepRequest(
    val alarmId: String,
    val snoozeCount: Int
)

data class OversleepResponse(
    val responseLevel: String,
    val message: String,
    val actions: List<OversleepAction>
)

data class OversleepAction(
    val type: String,
    val action: String
)

// Study Models
data class StudyAnalysisRequest(
    val imageData: String, // Base64
    val analysisType: String = "general",
    val subject: String? = null
)

data class StudyAnalysisResponse(
    val success: Boolean,
    val extractedText: String?,
    val detectedElements: List<DetectedElement>?,
    val suggestions: List<String>?,
    val error: String? = null
)

data class DetectedElement(
    val type: String,
    val content: Any
)

data class StartStudySessionRequest(
    val subject: String,
    val goal: String? = null,
    val estimatedDuration: Int? = null
)

data class StudySessionResponse(
    val success: Boolean,
    val session: StudySession?, // バックエンドは "session" プロパティを使用
    val message: String? = null,
    val error: String? = null
)

data class StudySessionsResponse(
    val success: Boolean,
    val sessions: List<StudySession>?,
    val error: String? = null
)

data class StudyProgressRequest(
    val subject: String,
    val topic: String,
    val duration: Int,
    val completedTasks: List<String>,
    val difficulty: Int,
    val understanding: Int
)

data class StudyAdviceResponse(
    val success: Boolean,
    val advice: List<String>?,
    val learningPattern: LearningPattern?,
    val error: String? = null
)

data class LearningPattern(
    val preferredStudyTime: String,
    val averageSessionLength: Int,
    val strongSubjects: List<String>,
    val improvementAreas: List<String>
)

// Life Assistant models
data class ShoppingItem(
    val id: String,
    val name: String,
    val category: String,
    val priority: String = "medium",
    val isCompleted: Boolean = false,
    val addedAt: String,
    val quantity: Int = 1,
    val unit: String = "個"
)

data class ShoppingList(
    val items: List<ShoppingItem>,
    val lastUpdated: String
)

data class CookingSuggestion(
    val id: String,
    val name: String,
    val difficulty: String,
    val cookingTime: String,
    val ingredients: List<String>,
    val instructions: List<String>,
    val tags: List<String>
)

data class Recipe(
    val id: String,
    val name: String,
    val cookingTime: Int,
    val difficulty: String,
    val ingredients: List<String>,
    val instructions: List<String> = emptyList()
)

data class CookingSuggestions(
    val suggestions: List<CookingSuggestion>,
    val mealTime: String,
    val generatedAt: String
)

// Additional request models
data class CookingRequest(
    val preferences: List<String> = emptyList(),
    val ingredients: List<String> = emptyList()
)

data class LifeTipsRequest(
    val category: String = "general"
)

data class ExpenseTrackingRequest(
    val timeRange: String = "month"
)

data class ShoppingItemRequest(
    val item: ShoppingItem
)

// Meeting Memo models
data class MeetingMemoResponse(
    val id: String = UUID.randomUUID().toString(),
    val title: String? = null,
    val summary: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val duration: Long? = null,
    val participants: List<String>? = null,
    val keyPoints: List<String>? = null,
    val actionItems: List<String>? = null
)

data class CleaningTask(
    val id: String,
    var name: String,
    val frequency: String,
    var lastCompleted: Long?,
    var isCompleted: Boolean = false
)

data class CleaningSchedule(
    val tasks: List<CleaningTask>,
    val weekOverview: String,
    val lastUpdated: String
)

data class Expense(
    val id: String,
    val amount: Double,
    val category: String,
    val description: String,
    val date: Long
)

data class ExpenseRecord(
    val id: String,
    val amount: Double,
    val category: String,
    val description: String,
    val date: String,
    val paymentMethod: String
)

data class ExpenseTracking(
    val records: List<ExpenseRecord>,
    val monthlyTotal: Double,
    val categoryBreakdown: Map<String, Double>,
    val month: String
)

data class LifeTip(
    val id: String,
    val title: String,
    val content: String,
    val category: String,
    var isBookmarked: Boolean = false
)

data class LifeTips(
    val tips: List<LifeTip>,
    val generatedAt: String
)

data class SmartSuggestion(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val actionRequired: Boolean,
    val urgency: String,
    val relatedData: Map<String, Any>?
)

data class SmartSuggestions(
    val suggestions: List<SmartSuggestion>,
    val contextInfo: String,
    val generatedAt: String
)

// Expense tracking models
data class ExpenseItem(
    val id: String,
    val userId: String,
    val amount: Int,
    val description: String,
    val category: String,
    val date: String,
    val source: String, // "manual" or "receipt"
    val timestamp: Long
)

data class ExpenseData(
    val expenses: List<ExpenseItem>,
    val monthlyTotal: Int,
    val categoryTotals: Map<String, Int>
)

}
