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

class CleaningScheduleActivity : AppCompatActivity() {
    
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: CleaningScheduleAdapter
    private lateinit var securePreferences: SecurePreferences
    private val cleaningTasks = mutableListOf<BackendCompatibleModels.CleaningTask>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cleaning_schedule)
        
        securePreferences = SecurePreferences(this)
        
        setupRecyclerView()
        loadCleaningTasks()
    }
    
    private fun setupRecyclerView() {
        recyclerView = findViewById(R.id.recyclerView)
        adapter = CleaningScheduleAdapter(cleaningTasks) { task ->
            toggleTaskCompletion(task)
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }
    
    private fun loadCleaningTasks() {
        lifecycleScope.launch {
            try {
                val response = ApiClient(this@CleaningScheduleActivity, securePreferences)
                    .apiService.getCleaningSchedule()
                    
                if (response.isSuccessful && response.body()?.success == true) {
                    val scheduleData = response.body()?.data
                    scheduleData?.tasks?.let { tasks ->
                        cleaningTasks.clear()
                        cleaningTasks.addAll(tasks)
                        adapter.notifyDataSetChanged()
                    }
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
    
    private fun toggleTaskCompletion(task: BackendCompatibleModels.CleaningTask) {
        lifecycleScope.launch {
            try {
                // API call to update task completion
                val index = cleaningTasks.indexOf(task)
                if (index != -1) {
                    cleaningTasks[index] = task.copy(isCompleted = !task.isCompleted)
                    adapter.notifyItemChanged(index)
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
}
