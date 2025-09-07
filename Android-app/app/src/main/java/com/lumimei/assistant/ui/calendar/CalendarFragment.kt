package com.lumimei.assistant.ui.calendar

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.R
import com.lumimei.assistant.adapters.CalendarEventsAdapter
import com.lumimei.assistant.data.models.*
import com.lumimei.assistant.data.models.BackendCompatibleModels.CalendarEvent as BackendCalendarEvent
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.databinding.FragmentCalendarBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.session.SessionManager
import com.lumimei.assistant.session.SessionState
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import java.util.Calendar as JavaCalendar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

class CalendarFragment : Fragment() {
    
    private var _binding: FragmentCalendarBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var app: LumiMeiApplication
    private lateinit var apiClient: ApiClient
    private lateinit var securePreferences: SecurePreferences
    private lateinit var eventsAdapter: CalendarEventsAdapter
    private val events = mutableListOf<com.lumimei.assistant.data.models.CalendarEvent>()
    
    private var selectedDate = Date()
    private var currentCalendar = JavaCalendar.getInstance()
    
    companion object {
        private const val TAG = "CalendarFragment"
        private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        private val displayDateFormat = SimpleDateFormat("MM/dd (E)", Locale.getDefault())
        private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCalendarBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        app = requireActivity().application as LumiMeiApplication
        apiClient = ApiClient(requireContext(), app.securePreferences)
        securePreferences = app.securePreferences
        
        setupRecyclerView()
        setupClickListeners()
        setupSessionObserver()
        loadEventsForDate(selectedDate)
        
        // Set today's date
        updateDateDisplay()
    }
    
    private fun setupRecyclerView() {
        eventsAdapter = CalendarEventsAdapter(events) { event ->
            showEventDetails(event)
        }
        binding.recyclerViewEvents.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = eventsAdapter
        }
    }
    
    private fun setupClickListeners() {
        binding.fabAddEvent.setOnClickListener {
            showAddEventDialog()
        }
        
        binding.buttonRefresh.setOnClickListener {
            loadEventsForDate(selectedDate)
        }
        
        binding.buttonQuickMeeting.setOnClickListener {
            showQuickMeetingDialog()
        }
        
        binding.buttonQuickTask.setOnClickListener {
            showQuickTaskDialog()
        }
        
        binding.buttonPrevDay.setOnClickListener {
            changeDateBy(-1)
        }
        
        binding.buttonNextDay.setOnClickListener {
            changeDateBy(1)
        }
        
        binding.textSelectedDate.setOnClickListener {
            showDatePicker()
        }
        
        binding.buttonCalendarSettings.setOnClickListener {
            showCalendarSettings()
        }
    }
    
    private fun setupSessionObserver() {
        app.sessionManager.currentSession.observe(viewLifecycleOwner) { sessionState ->
            when (sessionState) {
                is SessionState.Active -> {
                    // セッション開始時のカレンダー統合
                    checkForUpcomingEvents()
                }
                else -> {
                    // その他の状態は特別な処理なし
                }
            }
        }
    }
    
    private fun updateDateDisplay() {
        binding.textSelectedDate.text = displayDateFormat.format(selectedDate)
    }
    
    private fun changeDateBy(days: Int) {
        currentCalendar.time = selectedDate
        currentCalendar.add(JavaCalendar.DAY_OF_MONTH, days)
        selectedDate = currentCalendar.time
        updateDateDisplay()
        loadEventsForDate(selectedDate)
    }
    
    private fun showDatePicker() {
        val datePicker = MaterialDatePicker.Builder.datePicker()
            .setTitleText("日付を選択")
            .setSelection(selectedDate.time)
            .build()
        
        datePicker.addOnPositiveButtonClickListener { selection ->
            selectedDate = Date(selection)
            updateDateDisplay()
            loadEventsForDate(selectedDate)
        }
        
        datePicker.show(parentFragmentManager, "DATE_PICKER")
    }
    
    private fun checkForUpcomingEvents() {
        // 次の1時間以内のイベントをチェック
        val now = Date()
        val oneHourLater = Date(now.time + 60 * 60 * 1000)
        
        val upcomingEvents = events.filter { event ->
            try {
                val eventStart = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(event.startTime)
                eventStart?.let { 
                    it.after(now) && it.before(oneHourLater) 
                } ?: false
            } catch (e: Exception) {
                false
            }
        }
        
        if (upcomingEvents.isNotEmpty()) {
            val eventTitles = upcomingEvents.map { it.title }.joinToString(", ")
            Toast.makeText(context, "まもなく始まるイベント: $eventTitles", Toast.LENGTH_LONG).show()
        }
    }
    
    private fun loadEventsForDate(date: Date) {
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                binding.textNoEvents.visibility = View.GONE
                
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: run {
                    withContext(Dispatchers.Main) {
                        showError("ユーザーIDが見つかりません")
                    }
                    return@launch
                }
                
                val startDate = dateFormat.format(date)
                val endDate = dateFormat.format(Date(date.time + 24 * 60 * 60 * 1000))
                
                            val response = apiClient.apiService.getCalendarEvents(
                date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                range = "day"
            )
                
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val eventsResponse = response.body()
                        if (eventsResponse?.success == true) {
                            events.clear()
                            eventsResponse.data?.let { eventList: List<BackendCalendarEvent> ->
                                // Map backend events to UI model
                                val mapped = eventList.map { be ->
                                    com.lumimei.assistant.data.models.CalendarEvent(
                                        id = be.id ?: "",
                                        title = be.title,
                                        description = be.description,
                                        startTime = be.startTime,
                                        endTime = be.endTime,
                                        location = be.location
                                    )
                                }
                                events.addAll(mapped)
                            }
                            eventsAdapter.notifyDataSetChanged()
                            
                            if (events.isEmpty()) {
                                binding.textNoEvents.visibility = View.VISIBLE
                            }
                        } else {
                            showError("イベントの読み込みに失敗しました: ${eventsResponse?.error}")
                        }
                    } else {
                        showError("サーバーエラー: ${response.code()} ${response.message()}")
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error loading events", e)
                withContext(Dispatchers.Main) {
                    showError("イベントの読み込みに失敗しました: ${e.message}")
                }
            } finally {
                withContext(Dispatchers.Main) {
                    binding.progressBar.visibility = View.GONE
                }
            }
        }
    }
    
    private fun showEventDetails(event: com.lumimei.assistant.data.models.CalendarEvent) {
        val details = buildString {
            appendLine("タイトル: ${event.title}")
            event.description?.let { description ->
                appendLine("詳細: $description")
            }
            appendLine("開始: ${event.startTime}")
            appendLine("終了: ${event.endTime}")
            event.location?.let { location ->
                appendLine("場所: $location")
            }
        }
        
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle("イベント詳細")
            .setMessage(details)
            .setPositiveButton("OK", null)
            .show()
    }
    
    private fun showAddEventDialog() {
        val dialogView = LayoutInflater.from(requireContext())
            .inflate(R.layout.dialog_add_event, null)
        
        val titleEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.edit_text_event_title)
        val descriptionEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.edit_text_event_description)
        val locationEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.edit_text_event_location)
        val startTimeButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.button_start_time)
        val endTimeButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.button_end_time)
        
        var startTime = ""
        var endTime = ""
        
        startTimeButton.setOnClickListener {
            showTimePicker { time ->
                startTime = time
                startTimeButton.text = "開始: $time"
            }
        }
        
        endTimeButton.setOnClickListener {
            showTimePicker { time ->
                endTime = time
                endTimeButton.text = "終了: $time"
            }
        }
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("新しいイベント")
            .setView(dialogView)
            .setPositiveButton("作成") { _, _ ->
                val title = titleEditText.text.toString()
                val description = descriptionEditText.text.toString()
                val location = locationEditText.text.toString()
                
                if (title.isNotEmpty() && startTime.isNotEmpty() && endTime.isNotEmpty()) {
                    val startDateTime = "${dateFormat.format(selectedDate)}T$startTime:00"
                    val endDateTime = "${dateFormat.format(selectedDate)}T$endTime:00"
                    createEvent(title, description, location, startDateTime, endDateTime)
                } else {
                    Toast.makeText(context, "必須項目を入力してください", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun showTimePicker(onTimeSelected: (String) -> Unit) {
        val currentTime = JavaCalendar.getInstance()
        val timePicker = MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_24H)
            .setHour(currentTime.get(JavaCalendar.HOUR_OF_DAY))
            .setMinute(currentTime.get(JavaCalendar.MINUTE))
            .setTitleText("時間を選択")
            .build()
        
        timePicker.addOnPositiveButtonClickListener {
            val hour = String.format("%02d", timePicker.hour)
            val minute = String.format("%02d", timePicker.minute)
            onTimeSelected("$hour:$minute")
        }
        
        timePicker.show(parentFragmentManager, "TIME_PICKER")
    }
    
    private fun showCalendarSettings() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_calendar_settings, null)
        val notificationSwitch = dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switch_event_notifications)
        val reminderSwitch = dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switch_event_reminders)
        val autoSyncSwitch = dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switch_auto_sync)
        val weekStartSpinner = dialogView.findViewById<androidx.appcompat.widget.AppCompatSpinner>(R.id.spinner_week_start)
        
        // Load current settings
        notificationSwitch.isChecked = try { securePreferences.getBoolean("calendar_notifications", true) } catch (e: Exception) { true }
        reminderSwitch.isChecked = try { securePreferences.getBoolean("calendar_reminders", true) } catch (e: Exception) { true }
        autoSyncSwitch.isChecked = try { securePreferences.getBoolean("calendar_auto_sync", false) } catch (e: Exception) { false }
        
        val weekOptions = arrayOf("日曜日", "月曜日")
        val weekAdapter = android.widget.ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, weekOptions)
        weekStartSpinner.adapter = weekAdapter
        weekStartSpinner.setSelection(try { securePreferences.getInt("calendar_week_start", 0) } catch (e: Exception) { 0 })
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("カレンダー設定")
            .setView(dialogView)
            .setPositiveButton("保存") { _, _ ->
                try { securePreferences.putBoolean("calendar_notifications", notificationSwitch.isChecked) } catch (e: Exception) { }
                try { securePreferences.putBoolean("calendar_reminders", reminderSwitch.isChecked) } catch (e: Exception) { }
                try { securePreferences.putBoolean("calendar_auto_sync", autoSyncSwitch.isChecked) } catch (e: Exception) { }
                try { securePreferences.putInt("calendar_week_start", weekStartSpinner.selectedItemPosition) } catch (e: Exception) { }
                Toast.makeText(context, "設定を保存しました", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun createEvent(title: String, description: String, location: String, startTime: String, endTime: String) {
        lifecycleScope.launch {
            try {
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: run {
                    showError("ユーザーIDが見つかりません")
                    return@launch
                }
                
                val newEvent = BackendCalendarEvent(
                    id = null,
                    title = title,
                    description = description.ifEmpty { null },
                    startTime = startTime,
                    endTime = endTime,
                    location = location.ifEmpty { null }
                )
                val response = apiClient.apiService.createCalendarEvent(newEvent)
                
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val eventResponse = response.body()
                        if (eventResponse?.success == true) {
                            eventResponse.data?.let { createdEvent: BackendCalendarEvent ->
                                events.add(
                                    com.lumimei.assistant.data.models.CalendarEvent(
                                        id = createdEvent.id ?: "",
                                        title = createdEvent.title,
                                        description = createdEvent.description,
                                        startTime = createdEvent.startTime,
                                        endTime = createdEvent.endTime,
                                        location = createdEvent.location
                                    )
                                )
                                eventsAdapter.notifyItemInserted(events.size - 1)
                                binding.textNoEvents.visibility = View.GONE
                                Toast.makeText(context, "イベントを作成しました", Toast.LENGTH_SHORT).show()
                            }
                        } else {
                            showError("イベントの作成に失敗しました: ${eventResponse?.error}")
                        }
                    } else {
                        showError("サーバーエラー: ${response.code()} ${response.message()}")
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error creating event", e)
                withContext(Dispatchers.Main) {
                    showError("イベント作成に失敗しました: ${e.message}")
                }
            }
        }
    }
    
    private fun showQuickMeetingDialog() {
        val timeOptions = arrayOf("今から30分", "今から1時間", "午後2時から1時間", "明日の午前10時から1時間")
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("会議をすぐに作成")
            .setItems(timeOptions) { _, which ->
                val (startTime, endTime, title) = when (which) {
                    0 -> {
                        val now = JavaCalendar.getInstance()
                        val end = JavaCalendar.getInstance().apply { add(JavaCalendar.MINUTE, 30) }
                        Triple(now.time, end.time, "会議 (30分)")
                    }
                    1 -> {
                        val now = JavaCalendar.getInstance()
                        val end = JavaCalendar.getInstance().apply { add(JavaCalendar.HOUR_OF_DAY, 1) }
                        Triple(now.time, end.time, "会議 (1時間)")
                    }
                    2 -> {
                        val today = JavaCalendar.getInstance().apply {
                            set(JavaCalendar.HOUR_OF_DAY, 14)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        val end = JavaCalendar.getInstance().apply {
                            time = today.time
                            add(JavaCalendar.HOUR_OF_DAY, 1)
                        }
                        Triple(today.time, end.time, "午後の会議")
                    }
                    3 -> {
                        val tomorrow = JavaCalendar.getInstance().apply {
                            add(JavaCalendar.DAY_OF_MONTH, 1)
                            set(JavaCalendar.HOUR_OF_DAY, 10)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        val end = JavaCalendar.getInstance().apply {
                            time = tomorrow.time
                            add(JavaCalendar.HOUR_OF_DAY, 1)
                        }
                        Triple(tomorrow.time, end.time, "明日の会議")
                    }
                    else -> return@setItems
                }
                
                createQuickEvent(title, startTime, endTime, "会議")
            }
            .show()
    }
    
    private fun showQuickTaskDialog() {
        val taskOptions = arrayOf("今日のタスク", "明日のタスク", "今週のタスク", "来週のタスク")
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("タスクをすぐに作成")
            .setItems(taskOptions) { _, which ->
                val (startTime, title) = when (which) {
                    0 -> {
                        val today = JavaCalendar.getInstance().apply {
                            set(JavaCalendar.HOUR_OF_DAY, 9)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        Pair(today.time, "今日のタスク")
                    }
                    1 -> {
                        val tomorrow = JavaCalendar.getInstance().apply {
                            add(JavaCalendar.DAY_OF_MONTH, 1)
                            set(JavaCalendar.HOUR_OF_DAY, 9)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        Pair(tomorrow.time, "明日のタスク")
                    }
                    2 -> {
                        val nextWeek = JavaCalendar.getInstance().apply {
                            add(JavaCalendar.WEEK_OF_YEAR, 0)
                            set(JavaCalendar.DAY_OF_WEEK, JavaCalendar.FRIDAY)
                            set(JavaCalendar.HOUR_OF_DAY, 17)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        Pair(nextWeek.time, "今週のタスク")
                    }
                    3 -> {
                        val nextWeek = JavaCalendar.getInstance().apply {
                            add(JavaCalendar.WEEK_OF_YEAR, 1)
                            set(JavaCalendar.DAY_OF_WEEK, JavaCalendar.FRIDAY)
                            set(JavaCalendar.HOUR_OF_DAY, 17)
                            set(JavaCalendar.MINUTE, 0)
                        }
                        Pair(nextWeek.time, "来週のタスク")
                    }
                    else -> return@setItems
                }
                
                val endTime = JavaCalendar.getInstance().apply {
                    time = startTime
                    add(JavaCalendar.HOUR_OF_DAY, 1)
                }.time
                
                createQuickEvent(title, startTime, endTime, "タスク")
            }
            .show()
    }
    
    private fun createQuickEvent(title: String, startTime: Date, endTime: Date, description: String) {
        lifecycleScope.launch {
            try {
                val startTimeString = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).format(startTime)
                val endTimeString = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).format(endTime)
                
                val userId = securePreferences.userId ?: securePreferences.userEmail
                if (userId == null) {
                    showError("ユーザー認証が必要です")
                    return@launch
                }
                
                val eventRequest = BackendCalendarEvent(
                    id = "",
                    title = title,
                    description = description,
                    startTime = startTimeString,
                    endTime = endTimeString,
                    location = ""
                )
                
                val response = withContext(Dispatchers.IO) {
                    apiClient.apiService.createCalendarEvent(eventRequest)
                }
                
                if (response.isSuccessful) {
                    val eventResponse = response.body()
                    if (eventResponse?.success == true) {
                        withContext(Dispatchers.Main) {
                            loadEventsForDate(selectedDate)
                            Toast.makeText(context, "${title}を作成しました", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        showError("イベントの作成に失敗しました: ${eventResponse?.error}")
                    }
                } else {
                    showError("サーバーエラー: ${response.code()} ${response.message()}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error creating quick event", e)
                withContext(Dispatchers.Main) {
                    showError("クイックイベント作成に失敗しました: ${e.message}")
                }
            }
        }
    }

    private fun showError(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        Log.e(TAG, message)
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
