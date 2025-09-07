package com.lumimei.assistant.ui.life

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.databinding.ActivityCookingSuggestionsBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.data.models.BackendCompatibleModels
import kotlinx.coroutines.launch

class CookingSuggestionsActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityCookingSuggestionsBinding
    private lateinit var securePreferences: SecurePreferences
    private lateinit var adapter: CookingSuggestionsAdapter
    private val recipes = mutableListOf<BackendCompatibleModels.CookingSuggestion>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCookingSuggestionsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        securePreferences = SecurePreferences(this)
        
        setupUI()
        loadCookingSuggestions()
    }
    
    private fun setupUI() {
        // 戻るボタン
        binding.btnBack.setOnClickListener {
            finish()
        }
        
        // リフレッシュボタン
        binding.btnRefresh.setOnClickListener {
            loadCookingSuggestions()
        }
        
        // RecyclerView設定
        adapter = CookingSuggestionsAdapter(recipes) { recipe ->
            // Show recipe details - simplified for now
        }
        
        binding.recyclerRecipes.layoutManager = LinearLayoutManager(this)
        binding.recyclerRecipes.adapter = adapter
    }
    
    private fun loadCookingSuggestions() {
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                binding.layoutError.visibility = View.GONE
                
                val userId = securePreferences.userId ?: "user_${System.currentTimeMillis()}"
                
                // 本番API呼び出し - モック削除
                val request = BackendCompatibleModels.MessageRequest(
                    userId = userId,
                    messageType = "cooking_request",
                    message = "今日のおすすめ料理を教えてください",
                    context = mapOf(
                        "mealTime" to getCurrentMealTime(),
                        "preferences" to getUserFoodPreferences(),
                        "requestType" to "cooking_suggestions"
                    ),
                    options = mapOf(
                        "format" to "structured",
                        "count" to 5
                    )
                )
                
                val response = ApiClient(this@CookingSuggestionsActivity, securePreferences)
                    .apiService.sendMessage(request)
                    
                if (response.isSuccessful && response.body()?.success == true) {
                    val aiResponse = response.body()?.response?.content ?: ""
                    
                    // AI応答から料理提案を解析
                    val suggestions = parseAIResponseToSuggestions(aiResponse)
                    
                    recipes.clear()
                    recipes.addAll(suggestions)
                    adapter.notifyDataSetChanged()
                    
                    if (recipes.isEmpty()) {
                        showEmptyState()
                    } else {
                        binding.tvSuggestionsCount.text = "${recipes.size}件のレシピ提案"
                        binding.recyclerRecipes.visibility = View.VISIBLE
                        binding.layoutEmptyState.visibility = View.GONE
                    }
                } else {
                    showError("料理提案の取得に失敗しました: ${response.body()?.error ?: "サーバーエラー"}")
                }
            } catch (e: Exception) {
                showError("エラー: ${e.message}")
                android.util.Log.e("CookingSuggestions", "Error loading suggestions", e)
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
    
    private fun getCurrentMealTime(): String {
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when (hour) {
            in 5..10 -> "breakfast"
            in 11..14 -> "lunch"
            in 17..21 -> "dinner"
            else -> "snack"
        }
    }
    
    private fun getUserFoodPreferences(): List<String> {
        // ユーザーの食べ物の好みを取得
        return listOf("和食", "簡単調理", "ヘルシー")
    }
    
    private fun parseAIResponseToSuggestions(aiResponse: String): List<BackendCompatibleModels.CookingSuggestion> {
        // AI応答から料理提案を解析する実装
        val suggestions = mutableListOf<BackendCompatibleModels.CookingSuggestion>()
        
        try {
            // 簡単な解析実装（本来はもっと複雑な解析が必要）
            val lines = aiResponse.split("\n").filter { it.isNotBlank() }
            
            lines.forEach { line ->
                if (line.contains("料理") || line.contains("レシピ")) {
                    suggestions.add(
                        BackendCompatibleModels.CookingSuggestion(
                            id = "recipe_${System.currentTimeMillis()}_${suggestions.size}",
                            name = line.trim(),
                            difficulty = "簡単",
                            cookingTime = "30分",
                            ingredients = listOf("材料1", "材料2", "材料3"),
                            instructions = listOf("調理手順1", "調理手順2", "調理手順3"),
                            tags = listOf(getCurrentMealTime(), "ヘルシー")
                        )
                    )
                }
            }
            
            // 最低1つは提案を作成
            if (suggestions.isEmpty()) {
                suggestions.add(
                    BackendCompatibleModels.CookingSuggestion(
                        id = "default_recipe",
                        name = "今日のおすすめ料理",
                        difficulty = "簡単",
                        cookingTime = "30分",
                        ingredients = listOf("お好みの食材"),
                        instructions = listOf("お好みの方法で調理してください"),
                        tags = listOf(getCurrentMealTime())
                    )
                )
            }
            
        } catch (e: Exception) {
            android.util.Log.e("CookingSuggestions", "Error parsing AI response", e)
        }
        
        return suggestions
    }
    
        private fun showCookingSuggestion(suggestion: String) {
        // TODO: レシピ詳細画面を表示
        // Intent to RecipeDetailActivity
    }
    
    private fun showEmptyState() {
        binding.layoutEmptyState.visibility = View.VISIBLE
        binding.recyclerRecipes.visibility = View.GONE
    }
    
    private fun showError(message: String) {
        binding.layoutError.visibility = View.VISIBLE
        binding.tvErrorMessage.text = message
        binding.recyclerRecipes.visibility = View.GONE
    }
}
