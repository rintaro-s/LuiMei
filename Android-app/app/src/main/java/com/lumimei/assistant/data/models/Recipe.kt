package com.lumimei.assistant.data.models

data class Recipe(
    val id: String,
    val name: String,
    val description: String,
    val imageUrl: String?,
    val cookingTime: Int, // minutes
    val difficulty: String, // 初級, 中級, 上級
    val ingredients: List<String>? = null,
    val instructions: List<String>? = null,
    val rating: Float = 0f,
    val tags: List<String>? = null
)
