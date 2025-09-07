package com.lumimei.assistant.ui.calendar

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.data.models.CalendarEvent
import com.lumimei.assistant.databinding.ItemCalendarEventBinding

class CalendarEventsAdapter(
    private val events: List<CalendarEvent>,
    private val onEventClick: (CalendarEvent) -> Unit
) : RecyclerView.Adapter<CalendarEventsAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemCalendarEventBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(events[position])
    }

    override fun getItemCount(): Int = events.size

    inner class ViewHolder(private val binding: ItemCalendarEventBinding) : RecyclerView.ViewHolder(binding.root) {

        fun bind(event: CalendarEvent) {
            binding.textTitle.text = event.title
            binding.textTime.text = "${event.startTime} - ${event.endTime}"

            event.description?.let { description ->
                binding.textDescription.text = description
            } ?: run {
                binding.textDescription.text = "説明なし"
            }

            event.location?.let { location ->
                binding.textLocation.text = location
            } ?: run {
                binding.textLocation.text = ""
            }

            binding.root.setOnClickListener {
                onEventClick(event)
            }
        }
    }
}
