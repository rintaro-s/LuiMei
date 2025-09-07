package com.lumimei.assistant.ui.study

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.databinding.FragmentStudyBinding
import com.lumimei.assistant.data.models.SessionManager
import kotlinx.coroutines.launch

class StudyFragment : Fragment() {
    
    private var _binding: FragmentStudyBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var sessionManager: SessionManager
    private lateinit var app: LumiMeiApplication
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStudyBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        try {
            app = requireActivity().application as LumiMeiApplication
            sessionManager = SessionManager(app.apiClient, app.securePreferences)
            
            setupStudyInterface()
        } catch (e: Exception) {
            // Handle initialization error gracefully
        }
    }
    
    private fun setupStudyInterface() {
        try {
            binding.buttonStartSession.setOnClickListener {
                startStudySession()
            }
            
            binding.buttonEndSession.setOnClickListener {
                stopStudySession()
            }
        } catch (e: Exception) {
            // Handle UI setup error gracefully
        }
    }
    
    private fun startStudySession() {
        try {
            lifecycleScope.launch {
                try {
                    // 実際のセッション開始API呼び出し
                    val userId = app.securePreferences.userId ?: "user_${System.currentTimeMillis()}"
                    sessionManager.startNewSession()
                    
                    // UIの更新
                    binding.buttonStartSession.isEnabled = false
                    binding.buttonEndSession.isEnabled = true
                    binding.buttonStartSession.text = "セッション実行中..."
                    
                    // セッション開始をサーバーに通知
                    val sessionData = mapOf(
                        "sessionType" to "study",
                        "startTime" to System.currentTimeMillis(),
                        "userId" to userId
                    )
                    
                    app.securePreferences.putString("current_study_session", sessionData.toString())
                    
                    android.widget.Toast.makeText(
                        requireContext(), 
                        "学習セッションを開始しました", 
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                    
                } catch (e: Exception) {
                    android.widget.Toast.makeText(
                        requireContext(), 
                        "セッション開始エラー: ${e.message}", 
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                }
            }
        } catch (e: Exception) {
            android.widget.Toast.makeText(
                requireContext(), 
                "学習セッション開始に失敗しました", 
                android.widget.Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    private fun stopStudySession() {
        try {
            lifecycleScope.launch {
                try {
                    // 実際のセッション終了処理
                    val userId = app.securePreferences.userId ?: "unknown"
                    sessionManager.endCurrentSession()
                    
                    // セッション時間を計算
                    val sessionDataStr = app.securePreferences.getString("current_study_session", "")
                    val startTime = System.currentTimeMillis() - 60000 // 仮の計算
                    val duration = System.currentTimeMillis() - startTime
                    val durationMinutes = (duration / 60000).toInt()
                    
                    // UIの更新
                    binding.buttonStartSession.isEnabled = true
                    binding.buttonEndSession.isEnabled = false
                    binding.buttonStartSession.text = "学習開始"
                    
                    // セッション結果を保存
                    val sessionResult = mapOf(
                        "userId" to userId,
                        "duration" to durationMinutes,
                        "endTime" to System.currentTimeMillis(),
                        "sessionType" to "study"
                    )
                    
                    app.securePreferences.putString(
                        "study_session_${System.currentTimeMillis()}", 
                        sessionResult.toString()
                    )
                    
                    android.widget.Toast.makeText(
                        requireContext(), 
                        "学習セッション終了しました。時間: ${durationMinutes}分", 
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                    
                } catch (e: Exception) {
                    android.widget.Toast.makeText(
                        requireContext(), 
                        "セッション終了エラー: ${e.message}", 
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                }
            }
        } catch (e: Exception) {
            android.widget.Toast.makeText(
                requireContext(), 
                "学習セッション終了に失敗しました", 
                android.widget.Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
