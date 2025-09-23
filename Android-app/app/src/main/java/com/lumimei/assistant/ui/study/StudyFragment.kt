package com.lumimei.assistant.ui.study

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.os.CountDownTimer
import android.speech.RecognizerIntent
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.data.models.StudySession
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.databinding.FragmentStudyBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.ui.study.StudySessionAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.*

class StudyFragment : Fragment() {

    private var _binding: FragmentStudyBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var securePreferences: SecurePreferences
    private lateinit var apiClient: ApiClient
    private lateinit var sessionAdapter: StudySessionAdapter
    
    // Timer variables
    private var studyTimer: CountDownTimer? = null
    private var isSessionActive = false
    private var sessionStartTime = 0L
    private var targetDurationMinutes = 25
    private var currentSession: StudySession? = null
    
    // Camera and voice launchers
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        bitmap?.let { analyzeProblemImage(it) }
    }
    
    private val speechRecognizer = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { text ->
            processVoiceQuestion(text)
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentStudyBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        securePreferences = SecurePreferences(requireContext())
        apiClient = ApiClient(requireContext(), securePreferences)
        
        setupUI()
        setupSessionList()
        loadStudyStatistics()
    }

    private fun setupUI() {
        // Duration slider
        binding.sliderDuration.addOnChangeListener { _, value, _ ->
            targetDurationMinutes = value.toInt()
            binding.textDurationValue.text = "${targetDurationMinutes}分"
        }
        
        // Session controls
        binding.buttonStartSession.setOnClickListener { startStudySession() }
        binding.buttonEndSession.setOnClickListener { endStudySession() }
        binding.buttonTeacherMode.setOnClickListener { toggleTeacherMode() }
        
        // VLM and voice features
        binding.buttonCaptureProblem.setOnClickListener { captureProblem() }
        binding.buttonVoiceQuestion.setOnClickListener { startVoiceQuestion() }
    }

    private fun setupSessionList() {
        sessionAdapter = StudySessionAdapter(mutableListOf()) { session ->
            showSessionDetails(session)
        }
        binding.recyclerViewSessions.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = sessionAdapter
        }
        loadSessionHistory()
    }

    private fun startStudySession() {
        val title = binding.editTextSessionTitle.text.toString().trim()
        if (title.isEmpty()) {
            Toast.makeText(context, "セッションタイトルを入力してください", Toast.LENGTH_SHORT).show()
            return
        }
        
        isSessionActive = true
        sessionStartTime = System.currentTimeMillis()
        
        // Create new session
        currentSession = StudySession(
            id = UUID.randomUUID().toString(),
            title = title,
            startTime = sessionStartTime,
            endTime = null,
            progress = 0.0f,
            description = "学習時間: ${targetDurationMinutes}分",
            subject = "general",
            goal = title
        )
        
        startTimer()
        updateSessionUI()
        
        // Save to backend
        lifecycleScope.launch {
            try {
                // BackendCompatibleModels.StartStudySessionRequest expects (subject, goal, estimatedDuration)
                val request = BackendCompatibleModels.StartStudySessionRequest(
                    subject = "general",
                    goal = title,
                    estimatedDuration = targetDurationMinutes
                )
                apiClient.apiService.startStudySession(request)
            } catch (e: Exception) {
                // Handle error silently
            }
        }
    }

    private fun endStudySession() {
        studyTimer?.cancel()
        isSessionActive = false
        
        currentSession?.let { session ->
            val endTime = System.currentTimeMillis()
            val actualDuration = (endTime - session.startTime) / 1000 / 60
            
            val updatedSession = session.copy(
                endTime = endTime,
                progress = 1.0f
            )
            
            currentSession = updatedSession
            updateSessionUI()
            loadSessionHistory()
            loadStudyStatistics()
            
            // Save to backend
            lifecycleScope.launch {
                try {
                    // EndSessionRequest only requires sessionId in the current models
                    val request = BackendCompatibleModels.EndSessionRequest(
                        sessionId = session.id
                    )
                    apiClient.apiService.endStudySession(request)
                } catch (e: Exception) {
                    // Handle error silently
                }
            }
            
            Toast.makeText(context, "学習セッション完了！(${actualDuration}分)", Toast.LENGTH_LONG).show()
        }
    }

    private fun startTimer() {
        val durationMs = targetDurationMinutes * 60 * 1000L
        
        studyTimer = object : CountDownTimer(durationMs, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val minutes = millisUntilFinished / 1000 / 60
                val seconds = (millisUntilFinished / 1000) % 60
                binding.textSessionTimer.text = String.format("%02d:%02d", minutes, seconds)
                
                val progress = ((durationMs - millisUntilFinished).toFloat() / durationMs.toFloat()) * 100
                binding.progressBarSession.progress = progress.toInt()
                
                currentSession?.let { session ->
                    currentSession = session.copy(progress = progress / 100f)
                }
            }
            
            override fun onFinish() {
                binding.textSessionTimer.text = "完了！"
                binding.progressBarSession.progress = 100
                currentSession?.let { session ->
                    currentSession = session.copy(progress = 1.0f)
                }
                endStudySession()
            }
        }
        studyTimer?.start()
    }

    private fun captureProblem() {
        when {
            ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA) == 
                PackageManager.PERMISSION_GRANTED -> {
                takePicture.launch(null)
            }
            else -> {
                requestPermissions(arrayOf(Manifest.permission.CAMERA), 100)
            }
        }
    }

    private fun startVoiceQuestion() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ja-JP")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "質問を話してください")
        }
        speechRecognizer.launch(intent)
    }

    private fun analyzeProblemImage(bitmap: Bitmap) {
        lifecycleScope.launch {
            try {
                // show analysis card and status
                binding.cardAnalysisResult.visibility = View.VISIBLE
                binding.textAnalysisResult.text = "画像を分析中..."
                
                // Convert bitmap to base64
                val outputStream = ByteArrayOutputStream()
                bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, outputStream)
                val imageBytes = outputStream.toByteArray()
                val base64Image = Base64.encodeToString(imageBytes, Base64.DEFAULT)
                
                val request = BackendCompatibleModels.ImageAnalysisRequest(
                    userId = securePreferences.userId ?: "guest",
                    imageData = base64Image,
                    context = mapOf<String, Any>(
                        "type" to "problem_analysis",
                        "subject" to (currentSession?.subject ?: "general")
                    )
                )
                
                val response = withContext(Dispatchers.IO) {
                    apiClient.apiService.analyzeImage(request)
                }
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val analysisResult = response.body()?.analysis ?: "分析結果を取得できませんでした"
                    binding.textAnalysisResult.text = "分析結果: $analysisResult"
                } else {
                    binding.textAnalysisResult.text = "分析に失敗しました"
                }
                
            } catch (e: Exception) {
                binding.cardAnalysisResult.visibility = View.VISIBLE
                binding.textAnalysisResult.text = "エラー: ${e.message}"
            }
        }
    }

    private fun processVoiceQuestion(question: String) {
        lifecycleScope.launch {
            try {
                // show question/answer in the analysis/result card
                binding.cardAnalysisResult.visibility = View.VISIBLE
                binding.textAnalysisResult.text = "質問: $question\n回答を生成中..."
                
                val request = BackendCompatibleModels.MessageRequest(
                    userId = securePreferences.userId ?: "guest",
                    messageType = "voice_question",
                    message = question,
                    context = mapOf<String, Any>(
                        "mode" to "teacher",
                        "subject" to (currentSession?.subject ?: "general"),
                        "session_id" to (currentSession?.id ?: "")
                    )
                )
                
                val response = withContext(Dispatchers.IO) {
                    apiClient.apiService.sendMessage(request)
                }
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val answer = response.body()?.response?.content ?: "回答を取得できませんでした"
                    binding.textAnalysisResult.text = "回答: $answer"
                } else {
                    binding.textAnalysisResult.text = "回答の生成に失敗しました"
                }
                
            } catch (e: Exception) {
                binding.textAnalysisResult.text = "エラー: ${e.message}"
            }
        }
    }

    private fun toggleTeacherMode() {
        currentSession?.let { session ->
            val newTeacherMode = !session.teacherMode
            currentSession = session.copy(teacherMode = newTeacherMode)

            if (newTeacherMode) {
                binding.buttonTeacherMode.text = "先生モード ON"
                // reuse analysis card as teacher-mode output area
                binding.cardAnalysisResult.visibility = View.VISIBLE
                Toast.makeText(context, "先生モードが有効になりました", Toast.LENGTH_SHORT).show()
            } else {
                binding.buttonTeacherMode.text = "先生モード OFF"
                binding.cardAnalysisResult.visibility = View.GONE
                Toast.makeText(context, "先生モードが無効になりました", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateSessionUI() {
        currentSession?.let { session ->
            binding.textCurrentSession.text = session.title
            binding.buttonStartSession.visibility = if (isSessionActive) View.GONE else View.VISIBLE
            binding.buttonEndSession.visibility = if (isSessionActive) View.VISIBLE else View.GONE
            // show progress layout when session active
            binding.layoutSessionProgress.visibility = if (isSessionActive) View.VISIBLE else View.GONE
        }
    }

    private fun loadSessionHistory() {
        lifecycleScope.launch {
            try {
                // Load session history from backend
                val sessions = mutableListOf<StudySession>()
                // Add current session if active
                currentSession?.let { sessions.add(it) }
                
                sessionAdapter.updateSessions(sessions)
            } catch (e: Exception) {
                Toast.makeText(context, "履歴の読み込みに失敗: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadStudyStatistics() {
        lifecycleScope.launch {
            try {
                binding.textTodayTime.text = "総学習時間: 計算中..."
                binding.textWeekTime.text = "週間目標: 設定中..."
                binding.textTotalSessions.text = "今日の進捗: 計算中..."
            } catch (e: Exception) {
                // Handle error
            }
        }
    }

    private fun showSessionDetails(session: StudySession) {
        Toast.makeText(context, "セッション詳細: ${session.title}", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        studyTimer?.cancel()
        _binding = null
    }
}
