package com.lumimei.assistant.ui.life

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels

class CookingSuggestionsActivityNew : AppCompatActivity() {
    
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: CookingSuggestionsAdapter
    private val recipes = mutableListOf<BackendCompatibleModels.CookingSuggestion>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cooking_suggestions)
        
        setupRecyclerView()
        loadSuggestions()
    }
    
    private fun setupRecyclerView() {
        recyclerView = findViewById(R.id.recyclerView)
        adapter = CookingSuggestionsAdapter(recipes) { recipe ->
            // Handle recipe click
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }
    
    private fun loadSuggestions() {
        // Sample data (use CookingSuggestion which matches adapter)
        recipes.addAll(listOf(
            BackendCompatibleModels.CookingSuggestion(
                id = "1",
                name = "簡単チャーハン",
                difficulty = "簡単",
                cookingTime = "15分",
                ingredients = listOf("ご飯", "卵", "ねぎ", "醤油", "塩"),
                instructions = listOf("ご飯を炒める", "卵を加える", "調味料で味付け"),
                tags = listOf("昼ごはん", "簡単")
            ),
            BackendCompatibleModels.CookingSuggestion(
                id = "2",
                name = "野菜炒め",
                difficulty = "簡単",
                cookingTime = "10分",
                ingredients = listOf("キャベツ", "にんじん", "もやし", "醤油"),
                instructions = listOf("野菜を切る", "炒める", "味付け"),
                tags = listOf("夕食")
            ),
            BackendCompatibleModels.CookingSuggestion(
                id = "3",
                name = "味噌汁",
                difficulty = "簡単",
                cookingTime = "5分",
                ingredients = listOf("味噌", "だし", "わかめ", "豆腐"),
                instructions = listOf("だしをとる", "具材を入れる", "味噌を溶く"),
                tags = listOf("汁物")
            )
        ))
        adapter.notifyDataSetChanged()
    }
}
