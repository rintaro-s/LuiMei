package com.lumimei.assistant.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.QuickAction

class QuickActionAdapter(
    private val actions: List<QuickAction>,
    private val onActionClick: (QuickAction) -> Unit
) : RecyclerView.Adapter<QuickActionAdapter.QuickActionViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): QuickActionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_quick_action, parent, false)
        return QuickActionViewHolder(view)
    }

    override fun onBindViewHolder(holder: QuickActionViewHolder, position: Int) {
        holder.bind(actions[position])
    }

    override fun getItemCount(): Int = actions.size

    inner class QuickActionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val card: MaterialCardView = itemView.findViewById(R.id.card_action)
        private val iconText: TextView = itemView.findViewById(R.id.tv_icon)
        private val titleText: TextView = itemView.findViewById(R.id.tv_title)

        fun bind(action: QuickAction) {
            iconText.text = action.icon
            titleText.text = action.title
            
            card.setOnClickListener {
                onActionClick(action)
            }
        }
    }
}
