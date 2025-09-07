package com.lumimei.assistant.ui.life

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.data.models.BackendCompatibleModels
import com.lumimei.assistant.databinding.ActivityMeetingMemoBinding
import com.lumimei.assistant.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class MeetingMemoActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMeetingMemoBinding
    private lateinit var app: LumiMeiApplication
    private lateinit var apiClient: ApiClient
    
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var audioFile: File? = null
    
    companion object {
        private const val TAG = "MeetingMemoActivity"
        private const val PERMISSION_REQUEST_CODE = 1001
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMeetingMemoBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        app = application as LumiMeiApplication
        apiClient = ApiClient(this, app.securePreferences)
        
        setupUI()
        checkPermissions()
    }
    
    private fun setupUI() {
        binding.btnStartRecording.setOnClickListener {
            if (isRecording) {
                stopRecording()
            } else {
                startRecording()
            }
        }
        
        binding.btnBack.setOnClickListener {
            if (isRecording) {
                stopRecording()
            }
            finish()
        }
        
        binding.btnProcessAudio.setOnClickListener {
            audioFile?.let { file ->
                processAudioFile(file)
            } ?: run {
                Toast.makeText(this, "録音ファイルがありません", Toast.LENGTH_SHORT).show()
            }
        }
        
        updateUI()
    }
    
    private fun checkPermissions() {
        val permissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.READ_EXTERNAL_STORAGE
        )
        
        val missingPermissions = permissions.filter { permission ->
            ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
        
        if (missingPermissions.isNotEmpty()) {
            Log.d(TAG, "Requesting permissions: ${missingPermissions.joinToString(", ")}")
            ActivityCompat.requestPermissions(
                this,
                missingPermissions.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        } else {
            Log.d(TAG, "All permissions already granted")
            updateUI()
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        Log.d(TAG, "Permission result: requestCode=$requestCode, permissions=${permissions.joinToString()}, results=${grantResults.joinToString()}")
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val allGranted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            
            if (allGranted) {
                Log.d(TAG, "All permissions granted")
                Toast.makeText(this, "録音権限が許可されました", Toast.LENGTH_SHORT).show()
                updateUI()
            } else {
                val deniedPermissions = permissions.filterIndexed { index, _ -> 
                    index < grantResults.size && grantResults[index] != PackageManager.PERMISSION_GRANTED 
                }
                
                Log.w(TAG, "Permissions denied: ${deniedPermissions.joinToString()}")
                
                Toast.makeText(this, "録音機能を使用するには権限が必要です。設定から権限を許可してください。", Toast.LENGTH_LONG).show()
                
                // 設定画面へのリンクを提供
                showPermissionDialog()
            }
        }
    }
    
    private fun showPermissionDialog() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("権限が必要です")
            .setMessage("議事録機能を使用するには、マイクと外部ストレージの権限が必要です。設定画面で権限を許可してください。")
            .setPositiveButton("設定を開く") { _, _ ->
                try {
                    val intent = android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    val uri = android.net.Uri.fromParts("package", packageName, null)
                    intent.data = uri
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.e(TAG, "Error opening app settings", e)
                    Toast.makeText(this, "設定画面を開けませんでした", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("閉じる") { dialog, _ ->
                dialog.dismiss()
                finish()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun startRecording() {
        try {
            // 録音ファイルの準備
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val fileName = "meeting_memo_$timestamp.3gp"
            
            audioFile = File(getExternalFilesDir(Environment.DIRECTORY_MUSIC), fileName)
            
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
                setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
                setOutputFile(audioFile!!.absolutePath)
                
                prepare()
                start()
            }
            
            isRecording = true
            updateUI()
            
            binding.tvStatus.text = "録音中..."
            Log.d(TAG, "Recording started: ${audioFile!!.absolutePath}")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            Toast.makeText(this, "録音開始に失敗しました: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    private fun stopRecording() {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            
            isRecording = false
            updateUI()
            
            binding.tvStatus.text = "録音完了"
            Log.d(TAG, "Recording stopped")
            
            Toast.makeText(this, "録音が完了しました。音声処理ボタンを押してください。", Toast.LENGTH_LONG).show()
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recording", e)
            Toast.makeText(this, "録音停止に失敗しました: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun updateUI() {
        if (isRecording) {
            binding.btnStartRecording.text = "録音停止"
            binding.btnStartRecording.setBackgroundColor(getColor(android.R.color.holo_red_light))
            binding.btnProcessAudio.isEnabled = false
        } else {
            binding.btnStartRecording.text = "録音開始"
            binding.btnStartRecording.setBackgroundColor(getColor(android.R.color.holo_blue_light))
            binding.btnProcessAudio.isEnabled = audioFile != null && audioFile!!.exists()
        }
    }
    
    private fun processAudioFile(file: File) {
        binding.tvStatus.text = "音声を処理中..."
        binding.btnProcessAudio.isEnabled = false
        
        lifecycleScope.launch {
            try {
                // 1. 音声ファイルをSTT（Speech-to-Text）でテキスト化
                val transcription = performSpeechToText(file)
                
                if (transcription.isNotEmpty()) {
                    binding.tvTranscription.text = "文字起こし結果:\n$transcription"
                    
                    // 2. LMStudioのLLMで要約処理
                    val summary = generateMeetingSummary(transcription)
                    
                    binding.tvSummary.text = "会議要約:\n$summary"
                    binding.tvStatus.text = "処理完了"
                    
                    // 3. 結果を保存
                    saveMeetingMemo(transcription, summary)
                    
                } else {
                    binding.tvStatus.text = "音声の文字起こしに失敗しました"
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error processing audio file", e)
                binding.tvStatus.text = "処理中にエラーが発生しました: ${e.message}"
            } finally {
                binding.btnProcessAudio.isEnabled = true
            }
        }
    }
    
    private suspend fun performSpeechToText(audioFile: File): String {
        return withContext(Dispatchers.IO) {
            try {
                // 音声ファイルをBase64エンコード
                val audioData = audioFile.readBytes()
                val base64Audio = android.util.Base64.encodeToString(audioData, android.util.Base64.DEFAULT)
                
                val request = BackendCompatibleModels.STTRequest(
                    audioData = base64Audio,
                    language = "ja-JP",
                    engine = "vosk" // または "whisper"
                )
                
                val response = apiClient.apiService.speechToText(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val sttResponse = response.body()!!
                    if (sttResponse.success) {
                        sttResponse.transcription
                    } else {
                        Log.e(TAG, "STT failed: ${sttResponse.error}")
                        ""
                    }
                } else {
                    Log.e(TAG, "STT request failed: ${response.code()}")
                    ""
                }
            } catch (e: Exception) {
                Log.e(TAG, "STT error", e)
                ""
            }
        }
    }
    
    private suspend fun generateMeetingSummary(transcription: String): String {
        return withContext(Dispatchers.IO) {
            try {
                val userId = app.securePreferences.userId ?: "guest"
                
                val request = BackendCompatibleModels.MessageRequest(
                    userId = userId,
                    messageType = "meeting_summary",
                    message = transcription,
                    context = mapOf(
                        "task" to "meeting_summary",
                        "format" to "structured"
                    ),
                    options = mapOf(
                        "prompt" to "以下の会議録音の文字起こしから、重要なポイントを整理して要約してください。\n\n" +
                                "以下の形式で回答してください：\n" +
                                "【議題・目的】\n" +
                                "【参加者・発言者】\n" +
                                "【主な議論内容】\n" +
                                "【決定事項】\n" +
                                "【アクションアイテム】\n" +
                                "【その他・備考】\n\n" +
                                "文字起こし内容：\n$transcription"
                    )
                )
                
                val response = apiClient.apiService.sendMessage(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val messageResponse = response.body()!!
                    if (messageResponse.success) {
                        messageResponse.response?.content ?: "要約生成に失敗しました"
                    } else {
                        "要約生成エラー: ${messageResponse.error}"
                    }
                } else {
                    "要約生成リクエスト失敗: ${response.code()}"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Summary generation error", e)
                "要約生成中にエラーが発生しました: ${e.message}"
            }
        }
    }
    
    private suspend fun saveMeetingMemo(transcription: String, summary: String) {
        try {
            val userId = app.securePreferences.userId ?: "guest"
            val timestamp = System.currentTimeMillis()
            
            val memoData = mapOf(
                "userId" to userId,
                "timestamp" to timestamp,
                "transcription" to transcription,
                "summary" to summary,
                "audioFileName" to (audioFile?.name ?: ""),
                "type" to "meeting_memo"
            )
            
            // ローカルにも保存
            app.securePreferences.putString(
                "meeting_memo_$timestamp", 
                memoData.toString()
            )
            
            Log.d(TAG, "Meeting memo saved locally")
            
            withContext(Dispatchers.Main) {
                Toast.makeText(
                    this@MeetingMemoActivity, 
                    "議事録メモを保存しました", 
                    Toast.LENGTH_SHORT
                ).show()
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error saving meeting memo", e)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        if (isRecording) {
            stopRecording()
        }
        mediaRecorder?.release()
    }
}
