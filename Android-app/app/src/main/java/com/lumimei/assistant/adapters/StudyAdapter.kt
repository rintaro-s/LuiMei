package com.lumimei.assistant.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.ProgressBar
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.lumimei.assistant.R
import java.text.SimpleDateFormat
import java.util.*

// ローカルStudySessionデータクラス
data class StudySession(
    val id: String,
    val title: String,
    val startTime: Long,
    val endTime: Long? = null,
    val progress: Float = 0f,
    val description: String? = null
)

class StudyAdapter(
    private var sessions: List<StudySession>,
    private val onSessionClick: (StudySession) -> Unit
) : RecyclerView.Adapter<StudyAdapter.StudyViewHolder>() {

    fun updateSessions(newSessions: List<StudySession>) {
        sessions = newSessions
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StudyViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_study_session, parent, false)
        return StudyViewHolder(view)
    }

    override fun onBindViewHolder(holder: StudyViewHolder, position: Int) {
        holder.bind(sessions[position])
    }

    override fun getItemCount(): Int = sessions.size

    inner class StudyViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val card: MaterialCardView = itemView.findViewById(R.id.card_session)
        private val titleText: TextView = itemView.findViewById(R.id.tv_session_title)
        private val timeText: TextView = itemView.findViewById(R.id.tv_session_time)
        private val progressBar: ProgressBar = itemView.findViewById(R.id.progress_session)
        private val progressText: TextView = itemView.findViewById(R.id.tv_progress)
        private val descriptionText: TextView = itemView.findViewById(R.id.tv_session_description)

        fun bind(session: StudySession) {
            titleText.text = session.title
            
            val dateFormat = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
            val startTime = dateFormat.format(Date(session.startTime))
            
            timeText.text = "$startTime"
            
            val progress = (session.progress * 100).toInt()
            progressBar.progress = progress
            progressText.text = "${progress}%"
            
            descriptionText.text = session.description ?: ""
            descriptionText.visibility = if (session.description.isNullOrEmpty()) View.GONE else View.VISIBLE
            
            card.setOnClickListener {
                onSessionClick(session)
            }
        }
    }
}
