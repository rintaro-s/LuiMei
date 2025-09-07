package com.lumimei.assistant.data.models

data class QuickAction(
    val id: String,
    val title: String,
    val icon: String,
    val actionType: String,
    val description: String? = null
)
