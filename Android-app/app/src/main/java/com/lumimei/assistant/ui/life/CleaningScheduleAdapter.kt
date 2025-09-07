package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels
import java.text.SimpleDateFormat
import java.util.*

class CleaningScheduleAdapter(
    private val tasks: List<BackendCompatibleModels.CleaningTask>,
    private val onItemClick: (BackendCompatibleModels.CleaningTask) -> Unit
) : RecyclerView.Adapter<CleaningScheduleAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cbTaskCompleted: CheckBox = view.findViewById(R.id.cb_task_completed)
        val tvTaskName: TextView = view.findViewById(R.id.tv_task_name)
        val tvFrequency: TextView = view.findViewById(R.id.tv_frequency)
        val tvLastCompleted: TextView = view.findViewById(R.id.tv_last_completed)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_cleaning_task, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val task = tasks[position]
        
        holder.cbTaskCompleted.isChecked = task.isCompleted
        holder.tvTaskName.text = task.name
        holder.tvFrequency.text = task.frequency
        
        if (task.lastCompleted != null) {
            val dateFormat = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
            holder.tvLastCompleted.text = "最終: ${dateFormat.format(Date(task.lastCompleted!!))}"
        } else {
            holder.tvLastCompleted.text = "未完了"
        }
        
        holder.cbTaskCompleted.setOnClickListener {
            onItemClick(task)
        }
        
        holder.itemView.setOnClickListener {
            onItemClick(task)
        }
    }

    override fun getItemCount(): Int = tasks.size
}
