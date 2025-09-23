package com.lumimei.assistant.ui.study

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.data.models.StudySession
import com.lumimei.assistant.databinding.ItemStudySessionBinding
import java.text.SimpleDateFormat
import java.util.*

class StudySessionAdapter(
    private val sessions: MutableList<StudySession>,
    private val onSessionClick: (StudySession) -> Unit
) : RecyclerView.Adapter<StudySessionAdapter.ViewHolder>() {
    
    companion object {
        private val dateFormat = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
        private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemStudySessionBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(sessions[position])
    }
    
    override fun getItemCount(): Int = sessions.size
    
    inner class ViewHolder(private val binding: ItemStudySessionBinding) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(session: StudySession) {
            binding.tvSessionTitle.text = session.title
            binding.tvSessionTime.text = dateFormat.format(Date(session.startTime))
            
            session.endTime?.let { endTime: Long ->
                val duration = (endTime - session.startTime) / 1000 / 60
                binding.tvSessionTime.text = "${dateFormat.format(Date(session.startTime))} (${duration}分)"
            } ?: run {
                binding.tvSessionTime.text = "${dateFormat.format(Date(session.startTime))} (進行中)"
            }
            
            binding.progressSession.progress = (session.progress * 100).toInt()
            binding.tvProgress.text = "${(session.progress * 100).toInt()}%"
            
            session.description?.let { description: String ->
                binding.tvSessionDescription.text = description
                binding.tvSessionDescription.visibility = android.view.View.VISIBLE
            } ?: run {
                binding.tvSessionDescription.visibility = android.view.View.GONE
            }
            
            binding.root.setOnClickListener {
                onSessionClick(session)
            }
        }
    }

    fun updateSessions(newSessions: List<StudySession>) {
        sessions.clear()
        sessions.addAll(newSessions)
        notifyDataSetChanged()
    }
}
