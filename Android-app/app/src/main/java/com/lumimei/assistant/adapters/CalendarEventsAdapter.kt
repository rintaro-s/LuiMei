package com.lumimei.assistant.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.data.models.CalendarEvent
import com.lumimei.assistant.databinding.ItemCalendarEventBinding
import java.text.SimpleDateFormat
import java.util.*

class CalendarEventsAdapter(
    private val events: List<CalendarEvent>,
    private val onEventClick: (CalendarEvent) -> Unit
) : RecyclerView.Adapter<CalendarEventsAdapter.EventViewHolder>() {
    
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EventViewHolder {
        val binding = ItemCalendarEventBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return EventViewHolder(binding)
    }
    
    override fun onBindViewHolder(holder: EventViewHolder, position: Int) {
        holder.bind(events[position])
    }
    
    override fun getItemCount(): Int = events.size
    
    inner class EventViewHolder(
        private val binding: ItemCalendarEventBinding
    ) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(event: CalendarEvent) {
            binding.textTitle.text = event.title
            
            try {
                // Parse time strings and format them
                binding.textTime.text = "${event.startTime} - ${event.endTime}"
            } catch (e: Exception) {
                binding.textTime.text = "${event.startTime} - ${event.endTime}"
            }
            
            event.description?.let { description ->
                binding.textDescription.text = description
            }
            
            event.location?.let { location ->
                binding.textLocation.text = location
            }
            
            binding.root.setOnClickListener {
                onEventClick(event)
            }
        }
    }
}
