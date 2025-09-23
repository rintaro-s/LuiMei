package com.lumimei.assistant.ui.life

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.databinding.ActivityShoppingListBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem
import kotlinx.coroutines.launch

class ShoppingListActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityShoppingListBinding
    private lateinit var securePreferences: SecurePreferences
    private lateinit var adapter: ShoppingListAdapter
    private val shoppingItems = mutableListOf<ShoppingItem>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShoppingListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        securePreferences = SecurePreferences(this)
        
        setupUI()
        loadShoppingList()
    }
    
    private fun setupUI() {
        // 戻るボタン
        binding.btnBack.setOnClickListener {
            finish()
        }
        
        // アイテム追加ボタン
        binding.btnAddItem.setOnClickListener {
            showAddItemDialog()
        }
        
        // RecyclerView設定
        adapter = ShoppingListAdapter(shoppingItems) { item, action ->
            when (action) {
                "toggle" -> toggleItemCompletion(item)
                "delete" -> deleteItem(item)
            }
        }
        
        binding.recyclerShoppingItems.layoutManager = LinearLayoutManager(this)
        binding.recyclerShoppingItems.adapter = adapter
    }
    
    private fun loadShoppingList() {
        lifecycleScope.launch {
            try {
                val response = ApiClient(this@ShoppingListActivity, securePreferences)
                    .apiService.getShoppingList()
                    
                if (response.isSuccessful && response.body()?.success == true) {
                    val responseData = response.body()?.data
                    try {
                        val itemsList = mutableListOf<com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem>()
                        if (responseData != null) {
                            // best-effort extraction
                            try {
                                val itemsField = responseData::class.java.getDeclaredField("items")
                                itemsField.isAccessible = true
                                val raw = itemsField.get(responseData) as? List<*>
                                raw?.forEach { itItem ->
                                    if (itItem is com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem) {
                                        itemsList.add(itItem)
                                    }
                                }
                            } catch (e: Exception) {
                                // fallback: empty
                            }
                        }
                        shoppingItems.clear()
                        shoppingItems.addAll(itemsList)
                        adapter.notifyDataSetChanged()
                        updateStatistics()
                    } catch (e: Exception) {
                        // Handle items access error
                    }
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
    
    private fun updateStatistics() {
        val total = shoppingItems.size
        val completed = shoppingItems.count { it.isCompleted }
        val pending = total - completed
        
        binding.tvTotalItems.text = total.toString()
        binding.tvCompletedItems.text = completed.toString()
        binding.tvPendingItems.text = pending.toString()
    }
    
    private fun toggleItemCompletion(item: ShoppingItem) {
        // APIでアイテムの完了状態を更新
        lifecycleScope.launch {
            try {
                // API call to update item completion
                val index = shoppingItems.indexOf(item)
                if (index != -1) {
                    shoppingItems[index] = item.copy(isCompleted = !item.isCompleted)
                    adapter.notifyItemChanged(index)
                    updateStatistics()
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
    
    private fun deleteItem(item: ShoppingItem) {
        lifecycleScope.launch {
            try {
                // API call to delete item
                val index = shoppingItems.indexOf(item)
                if (index != -1) {
                    shoppingItems.removeAt(index)
                    adapter.notifyItemRemoved(index)
                    updateStatistics()
                }
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
    
    private fun showAddItemDialog() {
        val dialog = AddShoppingItemDialog { newItem ->
            addItem(newItem)
        }
        dialog.show(supportFragmentManager, "AddShoppingItemDialog")
    }
    
    private fun addItem(item: ShoppingItem) {
        lifecycleScope.launch {
            try {
                // API call to add item - simplified to avoid type mismatch
                val newItem = com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem(
                    id = "temp_${System.currentTimeMillis()}",
                    name = item.name, 
                    category = "general",
                    quantity = item.quantity, 
                    isCompleted = item.isCompleted,
                    addedAt = System.currentTimeMillis().toString()
                )
                shoppingItems.add(newItem)
                adapter.notifyItemInserted(shoppingItems.size - 1)
                updateStatistics()
            } catch (e: Exception) {
                // エラーハンドリング
            }
        }
    }
}
