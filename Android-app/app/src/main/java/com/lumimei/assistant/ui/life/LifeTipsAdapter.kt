package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels

class LifeTipsAdapter(
    private val tips: List<BackendCompatibleModels.LifeTip>,
    private val onItemClick: (BackendCompatibleModels.LifeTip) -> Unit
) : RecyclerView.Adapter<LifeTipsAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvTitle: TextView = view.findViewById(R.id.tv_title)
        val tvContent: TextView = view.findViewById(R.id.tv_content)
        val tvCategory: TextView = view.findViewById(R.id.tv_category)
        val ivBookmark: ImageView = view.findViewById(R.id.iv_bookmark)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_life_tip, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val tip = tips[position]
        
        holder.tvTitle.text = tip.title
        holder.tvContent.text = tip.content
        holder.tvCategory.text = tip.category
        
        holder.ivBookmark.setImageResource(
            if (tip.isBookmarked) android.R.drawable.btn_star_big_on
            else android.R.drawable.btn_star_big_off
        )
        
        holder.ivBookmark.setOnClickListener {
            tip.isBookmarked = !tip.isBookmarked
            notifyItemChanged(position)
        }
        
        holder.itemView.setOnClickListener {
            onItemClick(tip)
        }
    }

    override fun getItemCount(): Int = tips.size
}
