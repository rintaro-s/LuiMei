package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.databinding.ItemShoppingListBinding
import com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem

class ShoppingListAdapter(
    private val items: MutableList<ShoppingItem>,
    private val onItemAction: (ShoppingItem, String) -> Unit
) : RecyclerView.Adapter<ShoppingListAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemShoppingListBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemShoppingListBinding) : 
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: ShoppingItem) {
            binding.tvItemName.text = item.name
            binding.tvItemCategory.text = item.category
            binding.checkboxCompleted.isChecked = item.isCompleted
            
            // 優先度に応じた表示
            binding.tvPriority.text = when (item.priority) {
                "high" -> "高"
                "medium" -> "中"
                "low" -> "低"
                else -> "中"
            }
            
            // 完了状態に応じたスタイル
            val alpha = if (item.isCompleted) 0.6f else 1.0f
            binding.tvItemName.alpha = alpha
            binding.tvItemCategory.alpha = alpha
            
            // イベントリスナー
            binding.checkboxCompleted.setOnCheckedChangeListener { _, _ ->
                onItemAction(item, "toggle")
            }
            
            binding.btnDeleteItem.setOnClickListener {
                onItemAction(item, "delete")
            }
        }
    }
}
