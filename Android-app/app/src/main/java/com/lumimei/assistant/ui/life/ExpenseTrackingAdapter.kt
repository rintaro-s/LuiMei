package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class ExpenseTrackingAdapter(
    private val expenses: List<BackendCompatibleModels.ExpenseRecord>,
    private val onItemClick: (BackendCompatibleModels.ExpenseRecord) -> Unit
) : RecyclerView.Adapter<ExpenseTrackingAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAmount: TextView = view.findViewById(R.id.tv_amount)
        val tvCategory: TextView = view.findViewById(R.id.tv_category)
        val tvDescription: TextView = view.findViewById(R.id.tv_description)
        val tvDate: TextView = view.findViewById(R.id.tv_date)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_expense, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
    val expense = expenses[position]

    val numberFormat = NumberFormat.getCurrencyInstance(Locale.JAPAN)
    holder.tvAmount.text = "¥${expense.amount.toInt()}"
    holder.tvCategory.text = expense.category
    holder.tvDescription.text = expense.description

    // ExpenseRecord.date is a String (ISO or formatted). Show it directly or truncate.
    holder.tvDate.text = expense.date
        
    holder.itemView.setOnClickListener { onItemClick(expense) }
    }

    override fun getItemCount(): Int = expenses.size
}
