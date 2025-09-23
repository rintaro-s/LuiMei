package com.lumimei.assistant.ui.life

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.preferences.SecurePreferences
import kotlinx.coroutines.launch

class LifeTipsActivity : AppCompatActivity() {
    
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: LifeTipsAdapter
    private lateinit var securePreferences: SecurePreferences
    private val tips = mutableListOf<BackendCompatibleModels.LifeTip>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_life_tips)
        
        securePreferences = SecurePreferences(this)
        
        setupRecyclerView()
        loadLifeTips()
    }
    
    private fun setupRecyclerView() {
        recyclerView = findViewById(R.id.recyclerView)
        adapter = LifeTipsAdapter(tips) { tip ->
            // Handle tip item click
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }
    
    private fun loadLifeTips() {
        lifecycleScope.launch {
            try {
                val response = ApiClient(this@LifeTipsActivity, securePreferences)
                    .apiService.getLifeTips(category = "general")
                    
                if (response.isSuccessful && response.body()?.success == true) {
                    val tipsData = response.body()?.data
                    tipsData?.tips?.let { tipsList ->
                        tips.clear()
                        tips.addAll(tipsList)
                        adapter.notifyDataSetChanged()
                    }
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
}
