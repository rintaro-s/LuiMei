package com.lumimei.assistant.ui.life

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.ArrayAdapter
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.lumimei.assistant.databinding.DialogAddShoppingItemBinding
import com.lumimei.assistant.data.models.BackendCompatibleModels.ShoppingItem

class AddShoppingItemDialog(
    private val onItemAdded: (ShoppingItem) -> Unit
) : DialogFragment() {

    private lateinit var binding: DialogAddShoppingItemBinding

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        binding = DialogAddShoppingItemBinding.inflate(LayoutInflater.from(requireContext()))
        
        setupUI()
        
        return AlertDialog.Builder(requireContext())
            .setTitle("新しいアイテムを追加")
            .setView(binding.root)
            .setPositiveButton("追加") { _, _ ->
                addItem()
            }
            .setNegativeButton("キャンセル", null)
            .create()
    }

    private fun setupUI() {
        // カテゴリのスピナー設定
        val categories = arrayOf("食品", "日用品", "衣類", "電子機器", "書籍", "その他")
        val categoryAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, categories)
        categoryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerCategory.adapter = categoryAdapter

        // 優先度のスピナー設定
        val priorities = arrayOf("低", "中", "高")
        val priorityAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, priorities)
        priorityAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerPriority.adapter = priorityAdapter
        binding.spinnerPriority.setSelection(1) // デフォルトは「中」

        // 単位のスピナー設定
        val units = arrayOf("個", "袋", "本", "枚", "缶", "瓶", "パック", "箱", "kg", "g", "L", "ml")
        val unitAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, units)
        unitAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerUnit.adapter = unitAdapter
    }

    private fun addItem() {
        val name = binding.etItemName.text.toString().trim()
        val quantity = binding.etQuantity.text.toString().toIntOrNull() ?: 1
        val unit = binding.spinnerUnit.selectedItem.toString()
        val category = binding.spinnerCategory.selectedItem.toString()
        val priority = when (binding.spinnerPriority.selectedItem.toString()) {
            "高" -> "high"
            "中" -> "medium"
            "低" -> "low"
            else -> "medium"
        }

        if (name.isNotEmpty()) {
            val item = ShoppingItem(
                id = System.currentTimeMillis().toString(),
                name = name,
                quantity = quantity,
                unit = unit,
                category = category,
                priority = priority,
                isCompleted = false,
                addedAt = System.currentTimeMillis().toString()
            )
            onItemAdded(item)
        }
    }
}
