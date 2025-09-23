package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.databinding.ItemMeetingMemoBinding
import java.text.SimpleDateFormat
import java.util.*

// Enhanced Meeting Memo Adapter with better UX
class MeetingMemoAdapter(
    private val onItemClick: (BackendCompatibleModels.MeetingMemoResponse) -> Unit,
    private val onShareClick: (BackendCompatibleModels.MeetingMemoResponse) -> Unit = {},
    private val onDeleteClick: (BackendCompatibleModels.MeetingMemoResponse) -> Unit = {}
) : ListAdapter<BackendCompatibleModels.MeetingMemoResponse, MeetingMemoAdapter.MeetingMemoViewHolder>(DiffCallback()) {

    private val dateFormat = SimpleDateFormat("yyyy年MM月dd日 HH:mm", Locale.getDefault())
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MeetingMemoViewHolder {
        val binding = ItemMeetingMemoBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return MeetingMemoViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MeetingMemoViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class MeetingMemoViewHolder(
        private val binding: ItemMeetingMemoBinding
    ) : RecyclerView.ViewHolder(binding.root) {

    fun bind(memo: BackendCompatibleModels.MeetingMemoResponse) {
            with(binding) {
                // Enhanced UI with more information
                    root.apply {
                    // Use binding IDs generated from layout: textTitle, textDate, textSummary, textDuration, textParticipants
                    textTitle.text = memo.title ?: "会議メモ #${adapterPosition + 1}"
                    textDate.text = dateFormat.format(Date(memo.timestamp))
                    textSummary.text = memo.summary ?: "要約なし"

                    // Duration display
                    memo.duration?.let { duration ->
                        textDuration.text = "${duration}分"
                        textDuration.visibility = android.view.View.VISIBLE
                    } ?: run {
                        textDuration.visibility = android.view.View.GONE
                    }

                    // Participants count
                    memo.participants?.let { participants ->
                        textParticipants.text = "参加者: ${participants.size}名"
                        textParticipants.visibility = android.view.View.VISIBLE
                    } ?: run {
                        textParticipants.visibility = android.view.View.GONE
                    }

                    // Click handlers
                    setOnClickListener { onItemClick(memo) }

                    binding.buttonShare.setOnClickListener { 
                        onShareClick(memo)
                    }

                    binding.buttonDelete.setOnClickListener { 
                        onDeleteClick(memo)
                    }
                }
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<BackendCompatibleModels.MeetingMemoResponse>() {
        override fun areItemsTheSame(oldItem: BackendCompatibleModels.MeetingMemoResponse, newItem: BackendCompatibleModels.MeetingMemoResponse): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: BackendCompatibleModels.MeetingMemoResponse, newItem: BackendCompatibleModels.MeetingMemoResponse): Boolean {
            return oldItem == newItem
        }
    }
}
