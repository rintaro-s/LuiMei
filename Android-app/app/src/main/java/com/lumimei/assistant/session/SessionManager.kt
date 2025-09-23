package com.lumimei.assistant.session

import android.content.Context
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.network.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.*

class SessionManager(
    private val context: Context,
    private val apiClient: ApiClient,
    private val securePreferences: SecurePreferences
) {
    
    private val _currentSession = MutableLiveData<SessionState>()
    val currentSession: LiveData<SessionState> = _currentSession
    
    private val _sessionHistory = MutableLiveData<List<ChatSession>>()
    val sessionHistory: LiveData<List<ChatSession>> = _sessionHistory
    
    private var currentSessionId: String? = null
    private val coroutineScope = CoroutineScope(Dispatchers.IO)
    
    companion object {
        private const val TAG = "SessionManager"
    }
    
    init {
        _currentSession.value = SessionState.Disconnected
        loadSessionHistory()
    }
    
    fun startNewSession(config: Map<String, Any>? = null): String {
        val sessionId = UUID.randomUUID().toString()
        currentSessionId = sessionId
        
        _currentSession.postValue(SessionState.Starting)
        
        coroutineScope.launch {
            try {
                val userId = securePreferences.userId ?: throw Exception("User not authenticated")
                
        val request = BackendCompatibleModels.StartStudySessionRequest(
            subject = "study_session",
            goal = config?.get("goal") as? String,
            estimatedDuration = config?.get("duration") as? Int
        )
        
        val response = apiClient.apiService.startStudySession(request)
        
        if (response.isSuccessful) {
                    val sessionResponse = response.body() as? BackendCompatibleModels.StudySessionResponse
                    if (sessionResponse?.success == true) {
                        // Since response.body() returns StudySessionResponse directly, we can access session property
                        val serverSessionId = sessionResponse.session?.id ?: "temp_" + UUID.randomUUID().toString()
                        currentSessionId = serverSessionId
                        
                        val session = ChatSession(
                            id = serverSessionId,
                            startTime = System.currentTimeMillis(),
                            endTime = null,
                            messageCount = 0,
                            title = "新しいセッション",
                            summary = null
                        )
                        
                        addSessionToHistory(session)
                        _currentSession.postValue(SessionState.Active(session))
                        
                        Log.d(TAG, "Session started: $serverSessionId")
                    } else {
                        _currentSession.postValue(SessionState.Error("セッション開始に失敗しました: ${sessionResponse?.error}"))
                    }
                } else {
                    _currentSession.postValue(SessionState.Error("サーバーエラー: ${response.code()}"))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting session", e)
                _currentSession.postValue(SessionState.Error("セッション開始エラー: ${e.message}"))
            }
        }
        
        return sessionId
    }
    
    fun endCurrentSession(summary: String? = null) {
        val sessionId = currentSessionId ?: return
        
        _currentSession.postValue(SessionState.Ending)
        
        coroutineScope.launch {
            try {
                val request = BackendCompatibleModels.EndSessionRequest(sessionId = currentSessionId ?: "unknown")
                val response = apiClient.apiService.endStudySession(request)
                
                if (response.isSuccessful) {
                    val sessionResponse = response.body()
                    if (sessionResponse?.success == true) {
                        updateSessionInHistory(sessionId) { session ->
                            session.copy(
                                endTime = System.currentTimeMillis(),
                                summary = summary
                            )
                        }
                        
                        _currentSession.postValue(SessionState.Disconnected)
                        currentSessionId = null
                        
                        Log.d(TAG, "Session ended: $sessionId")
                    } else {
                        _currentSession.postValue(SessionState.Error("セッション終了に失敗しました: ${sessionResponse?.error}"))
                    }
                } else {
                    _currentSession.postValue(SessionState.Error("サーバーエラー: ${response.code()}"))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error ending session", e)
                _currentSession.postValue(SessionState.Error("セッション終了エラー: ${e.message}"))
            }
        }
    }
    
    fun getSessionStatus(): SessionState {
        return _currentSession.value ?: SessionState.Disconnected
    }
    
    fun getCurrentSessionId(): String? {
        return currentSessionId
    }
    
    fun incrementMessageCount() {
        val sessionId = currentSessionId ?: return
        updateSessionInHistory(sessionId) { session ->
            session.copy(messageCount = session.messageCount + 1)
        }
    }
    
    fun updateSessionTitle(title: String) {
        val sessionId = currentSessionId ?: return
        updateSessionInHistory(sessionId) { session ->
            session.copy(title = title)
        }
    }
    
    fun clearSessionHistory() {
        _sessionHistory.postValue(emptyList())
        saveSessionHistory(emptyList())
    }
    
    private fun loadSessionHistory() {
        // TODO: Load from persistent storage or server
        try {
            val json = securePreferences.getUserString("session_history", null)
            if (!json.isNullOrEmpty()) {
                val gson = com.google.gson.Gson()
                val type = com.google.gson.reflect.TypeToken.getParameterized(List::class.java, ChatSession::class.java).type
                val list: List<ChatSession> = gson.fromJson(json, type)
                _sessionHistory.postValue(list)
                return
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load session history", e)
        }
        _sessionHistory.postValue(emptyList())
    }
    
    private fun addSessionToHistory(session: ChatSession) {
        val currentHistory = _sessionHistory.value ?: emptyList()
        val newHistory = currentHistory + session
        _sessionHistory.postValue(newHistory)
        saveSessionHistory(newHistory)
    }
    
    private fun updateSessionInHistory(sessionId: String, update: (ChatSession) -> ChatSession) {
        val currentHistory = _sessionHistory.value ?: emptyList()
        val newHistory = currentHistory.map { session ->
            if (session.id == sessionId) {
                update(session)
            } else {
                session
            }
        }
        _sessionHistory.postValue(newHistory)
        saveSessionHistory(newHistory)
    }
    
    private fun saveSessionHistory(history: List<ChatSession>) {
        try {
            val gson = com.google.gson.Gson()
            val json = gson.toJson(history)
            securePreferences.putUserString("session_history", json)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save session history", e)
        }
    }
    
    fun resumeSession(sessionId: String) {
        coroutineScope.launch {
            try {
                val response = apiClient.apiService.getSessionStatus()
                
                if (response.isSuccessful) {
                    val statusResponse = response.body()
                    if (statusResponse?.success == true) {
                        val status = statusResponse.data
                        if (status?.status == "active") {
                            currentSessionId = sessionId
                            
                            val session = _sessionHistory.value?.find { it.id == sessionId }
                            if (session != null) {
                                _currentSession.postValue(SessionState.Active(session))
                                Log.d(TAG, "Session resumed: $sessionId")
                            }
                        } else {
                            _currentSession.postValue(SessionState.Error("セッションが無効です"))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error resuming session", e)
                _currentSession.postValue(SessionState.Error("セッション復旧エラー: ${e.message}"))
            }
        }
    }
}

sealed class SessionState {
    object Disconnected : SessionState()
    object Starting : SessionState()
    data class Active(val session: ChatSession) : SessionState()
    object Ending : SessionState()
    data class Error(val message: String) : SessionState()
}

data class ChatSession(
    val id: String,
    val startTime: Long,
    val endTime: Long? = null,
    val messageCount: Int = 0,
    val title: String = "Chat Session",
    val summary: String? = null
) {
    fun getDuration(): Long {
        return (endTime ?: System.currentTimeMillis()) - startTime
    }
    
    fun isActive(): Boolean {
        return endTime == null
    }
}
