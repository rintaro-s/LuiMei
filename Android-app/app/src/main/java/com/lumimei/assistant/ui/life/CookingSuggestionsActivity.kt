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
                
                val response = ApiClient(this@CookingSuggestionsActivity, securePreferences)
                    .apiService.getCookingSuggestions(
                        ingredients = null,
                        difficulty = null,
                        mealType = "breakfast"
                    )
                    
                if (response.isSuccessful && response.body()?.success == true) {
                    val suggestionsData = response.body()?.data
                    suggestionsData?.suggestions?.let { suggestions ->
                        recipes.clear()
                        recipes.addAll(suggestions)
                        adapter.notifyDataSetChanged()
                        
                        if (recipes.isEmpty()) {
                            showEmptyState()
                        } else {
                            binding.tvSuggestionsCount.text = "${recipes.size}件のレシピ提案"
                        }
                    }
                } else {
                    showError("料理提案の取得に失敗しました")
                }
            } catch (e: Exception) {
                showError("エラー: ${e.message}")
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
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
