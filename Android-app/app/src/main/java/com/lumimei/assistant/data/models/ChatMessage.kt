package com.lumimei.assistant.data.models

data class ChatMessage(
    val id: String,
    val text: String,
    val isFromUser: Boolean,
    val timestamp: Long,
    val conversationId: String? = null,
    val messageType: String = "text", // text, image, audio, etc.
    val metadata: Map<String, Any>? = null
)