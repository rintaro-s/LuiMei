package com.lumimei.assistant.ui.chat

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.data.models.ChatMessage
import com.lumimei.assistant.data.models.MessageType
import com.lumimei.assistant.databinding.ItemMessageUserBinding
import com.lumimei.assistant.databinding.ItemMessageAssistantBinding
import com.lumimei.assistant.databinding.ItemMessageSystemBinding
import java.text.SimpleDateFormat
import java.util.*

class ChatAdapter(
    private val messages: MutableList<ChatMessage>,
    private val onMessageClick: ((ChatMessage) -> Unit)? = null
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    
    companion object {
        private const val VIEW_TYPE_USER = 1
        private const val VIEW_TYPE_ASSISTANT = 2
        private const val VIEW_TYPE_SYSTEM = 3
        
        private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    }
    
    override fun getItemViewType(position: Int): Int {
        val message = messages[position]
        return when {
            message.messageType == "system" -> VIEW_TYPE_SYSTEM
            message.isFromUser -> VIEW_TYPE_USER
            else -> VIEW_TYPE_ASSISTANT
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        
        return when (viewType) {
            VIEW_TYPE_USER -> {
                val binding = ItemMessageUserBinding.inflate(inflater, parent, false)
                UserMessageViewHolder(binding)
            }
            VIEW_TYPE_ASSISTANT -> {
                val binding = ItemMessageAssistantBinding.inflate(inflater, parent, false)
                AssistantMessageViewHolder(binding)
            }
            VIEW_TYPE_SYSTEM -> {
                val binding = ItemMessageSystemBinding.inflate(inflater, parent, false)
                SystemMessageViewHolder(binding)
            }
            else -> throw IllegalArgumentException("Unknown view type: $viewType")
        }
    }
    
    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = messages[position]
        
        when (holder) {
            is UserMessageViewHolder -> holder.bind(message)
            is AssistantMessageViewHolder -> holder.bind(message)
            is SystemMessageViewHolder -> holder.bind(message)
        }
    }
    
    override fun getItemCount(): Int = messages.size
    
    class UserMessageViewHolder(private val binding: ItemMessageUserBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(message: ChatMessage) {
            binding.textMessage.text = message.text
            binding.textTime.text = timeFormat.format(Date(message.timestamp))
        }
    }
    
    class AssistantMessageViewHolder(private val binding: ItemMessageAssistantBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(message: ChatMessage) {
            binding.textMessage.text = message.text
            binding.textTime.text = timeFormat.format(Date(message.timestamp))
            
            // Show type indicator for non-text messages
            when (message.messageType) {
                "audio" -> binding.textMessage.text = "🎵 ${message.text}"
                "image" -> binding.textMessage.text = "🖼️ ${message.text}"
                else -> {}
            }
        }
    }
    
    class SystemMessageViewHolder(private val binding: ItemMessageSystemBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(message: ChatMessage) {
            binding.textMessage.text = message.text
            binding.textTime.text = timeFormat.format(Date(message.timestamp))
        }
    }
    
    fun addMessage(message: ChatMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }
    
    fun clearMessages() {
        messages.clear()
        notifyDataSetChanged()
    }
}
