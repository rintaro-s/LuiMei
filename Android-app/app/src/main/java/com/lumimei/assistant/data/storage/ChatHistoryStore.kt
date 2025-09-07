package com.lumimei.assistant.data.storage

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.data.models.BackendCompatibleModels.ConversationMessage
import com.lumimei.assistant.data.preferences.SecurePreferences

data class ChatSession(
    val id: String,
    val messages: List<ChatMessage>,
    val timestamp: Long
)

class ChatHistoryStore(context: Context, private val securePreferences: SecurePreferences) {

    private val gson = Gson()

    private fun key(sessionId: String) = "chat_history_" + sessionId

    fun load(sessionId: String): List<ChatMessage> {
        val json = securePreferences.getString(key(sessionId), null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<ChatMessage>>() {}.type
            gson.fromJson(json, type)
        } catch (_: Exception) { emptyList() }
    }

    fun save(sessionId: String, messages: List<ChatMessage>) {
        try {
            val json = gson.toJson(messages)
            securePreferences.putString(key(sessionId), json)
        } catch (_: Exception) { }
    }

    fun append(sessionId: String, message: ChatMessage) {
        val current = load(sessionId).toMutableList()
        current.add(message)
        // Keep last 100 messages to limit size
        val trimmed = if (current.size > 100) current.takeLast(100) else current
        save(sessionId, trimmed)
    }

    fun getRecentConversationMessages(sessionId: String, limit: Int = 10): List<ConversationMessage> {
        val msgs = load(sessionId).takeLast(limit)
        return msgs.map { msg ->
            ConversationMessage(
                messageId = msg.id,
                content = msg.text,
                timestamp = java.time.Instant.ofEpochMilli(msg.timestamp).toString(),
                role = if (msg.isFromUser) "user" else "assistant"
            )
        }
    }
    
    fun getAllSessions(): List<ChatSession> {
        // 現在の実装では履歴取得機能は制限的です
        // より完全な実装のためには、データベースまたは別のストレージソリューションが必要です
        // 今はテスト用に空のリストを返します
        return emptyList()
    }
}
