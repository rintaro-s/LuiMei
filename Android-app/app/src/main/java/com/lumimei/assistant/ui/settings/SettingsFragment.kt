package com.lumimei.assistant.ui.settings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.databinding.FragmentSettingsBinding
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.services.OverlayService
import com.lumimei.assistant.ui.MainActivity
import kotlinx.coroutines.launch

class SettingsFragment : Fragment() {
    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var app: LumiMeiApplication
    private lateinit var apiClient: ApiClient
    
    companion object {
        private const val TAG = "SettingsFragment"
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        app = requireActivity().application as LumiMeiApplication
        apiClient = ApiClient(requireContext(), app.securePreferences)
        
        setupUI()
        loadSettings()
    }
    
    override fun onResume() {
        super.onResume()
        loadSettings()
    }
    
    override fun onPause() {
        super.onPause()
        saveCurrentSettings()
    }
    
    private fun loadSettings() {
        // 設定を再読み込み
        try {
            binding.spinnerTone?.let { spinner ->
                val tones = arrayOf("friendly", "polite", "casual", "concise")
                val current = app.securePreferences.chatTone
                val position = tones.indexOfFirst { it == current }.coerceAtLeast(0)
                spinner.setSelection(position)
            }
            
            binding.switchWakeWord?.let { sw ->
                sw.isChecked = app.securePreferences.isWakeWordEnabled
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error loading settings", e)
        }
    }
    
    private fun saveCurrentSettings() {
        // 現在の設定を保存
        try {
            binding.spinnerTone?.let { spinner ->
                val tones = arrayOf("friendly", "polite", "casual", "concise")
                val selectedPosition = spinner.selectedItemPosition
                if (selectedPosition >= 0 && selectedPosition < tones.size) {
                    app.securePreferences.chatTone = tones[selectedPosition]
                }
            }
            
            binding.switchWakeWord?.let { sw ->
                app.securePreferences.isWakeWordEnabled = sw.isChecked
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error saving settings", e)
        }
    }
    
    private fun setupUI() {
        // Set user info and login status
        val isLoggedIn = app.securePreferences.isLoggedIn()
        val userName = if (isLoggedIn) {
            app.securePreferences.userName ?: "ユーザー"
        } else {
            "ゲストユーザー"
        }
        val userEmail = if (isLoggedIn) {
            app.securePreferences.userEmail ?: ""
        } else {
            "guest_${app.securePreferences.getCurrentUserId().takeLast(8)}"
        }
        
        binding.textUserName.text = userName
        binding.textUserEmail.text = userEmail
        
        // Voice selection setup for Overlay Assistant
        val voiceDialog = VoiceSelectionDialog(requireContext())
        val overlayVoiceId = app.securePreferences.getUserInt("overlay_voice_id", 2)
        val deviceVoiceId = app.securePreferences.getUserInt("device_voice_id", 3)
        
        val overlayVoice = voiceDialog.getVoiceById(overlayVoiceId) ?: voiceDialog.getDefaultVoice()
        val deviceVoice = voiceDialog.getVoiceById(deviceVoiceId) ?: voiceDialog.getDefaultVoice()
        
        binding.tvSelectedOverlayVoice.text = overlayVoice.name
        binding.tvSelectedDeviceVoice.text = deviceVoice.name
        
        binding.layoutOverlayVoiceSelection.setOnClickListener {
            voiceDialog.show(overlayVoiceId) { selectedVoice ->
                app.securePreferences.putUserInt("overlay_voice_id", selectedVoice.id)
                binding.tvSelectedOverlayVoice.text = selectedVoice.name
            }
        }
        
        binding.layoutDeviceVoiceSelection.setOnClickListener {
            voiceDialog.show(deviceVoiceId) { selectedVoice ->
                app.securePreferences.putUserInt("device_voice_id", selectedVoice.id)
                binding.tvSelectedDeviceVoice.text = selectedVoice.name
            }
        }
        
        // Tone setting (simple selector)
        try {
            binding.spinnerTone?.let { spinner ->
                val tones = arrayOf("friendly", "polite", "casual", "concise")
                val adapter = android.widget.ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, tones)
                spinner.adapter = adapter
                val current = app.securePreferences.chatTone
                spinner.setSelection(tones.indexOfFirst { it == current }.coerceAtLeast(0))
                spinner.onItemSelectedListener = object: android.widget.AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: android.widget.AdapterView<*>, view: View?, position: Int, id: Long) {
                        app.securePreferences.chatTone = tones[position]
                    }
                    override fun onNothingSelected(parent: android.widget.AdapterView<*>) {}
                }
            }
        } catch (_: Exception) {}

        // Wake-word toggle
        try {
            binding.switchWakeWord?.let { sw ->
                sw.isChecked = app.securePreferences.isWakeWordEnabled
                sw.setOnCheckedChangeListener { _, isChecked ->
                    app.securePreferences.isWakeWordEnabled = isChecked
                    val appCtx = requireActivity().application as com.lumimei.assistant.LumiMeiApplication
                    if (isChecked) {
                        // 権限チェック
                        if (checkMicrophonePermission()) {
                            appCtx.javaClass.getMethod("startWakeWordService").invoke(appCtx)
                            Toast.makeText(requireContext(), "ウェイクワード検出を開始しました: 「ルミメイ」", Toast.LENGTH_LONG).show()
                        } else {
                            sw.isChecked = false
                            requestMicrophonePermission()
                        }
                    } else {
                        appCtx.stopWakeWordService()
                        Toast.makeText(requireContext(), "ウェイクワード検出を停止しました", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            
            // ウェイクワード設定ボタン
            binding.buttonWakeWordSettings?.setOnClickListener {
                showWakeWordSettingsDialog()
            }
            
            // 使い方ガイドボタン
            binding.buttonUsageGuide?.setOnClickListener {
                showUsageGuide()
            }
        } catch (_: Exception) {}

        // Setup login/logout button based on authentication status
        setupLoginLogoutButton(isLoggedIn)
        
        // Setup overlay assistant
        setupOverlayAssistant()
    }
    
    private fun setupOverlayAssistant() {
        try {
            binding.layoutOverlayAssistant?.setOnClickListener {
                if (canDrawOverlays()) {
                    startOverlayService()
                } else {
                    requestOverlayPermission()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not setup overlay assistant", e)
        }
    }
    
    private fun canDrawOverlays(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(requireContext())
        } else {
            true
        }
    }
    
    private fun requestOverlayPermission() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("オーバーレイ権限が必要です")
            .setMessage("デジタルアシスタントのオーバーレイ機能を使用するには、画面オーバーレイの権限が必要です。")
            .setPositiveButton("設定を開く") { _, _ ->
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${requireContext().packageName}")
                )
                startActivity(intent)
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun startOverlayService() {
        try {
            // まず権限をチェック
            if (!canDrawOverlays()) {
                requestOverlayPermission()
                return
            }
            
            // オーバーレイサービスを開始
            val intent = Intent(requireContext(), OverlayService::class.java)
            intent.action = OverlayService.ACTION_SHOW_OVERLAY
            intent.putExtra("userId", app.securePreferences.userId ?: "guest")
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                requireContext().startForegroundService(intent)
            } else {
                requireContext().startService(intent)
            }
            
            Toast.makeText(
                requireContext(),
                "✅ デジタルアシスタントのオーバーレイを開始しました",
                Toast.LENGTH_LONG
            ).show()
            
            // オーバーレイ状態を保存
            app.securePreferences.putUserBoolean("overlay_active", true)
            
            Log.d(TAG, "Overlay service started successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start overlay service", e)
            Toast.makeText(
                requireContext(),
                "❌ オーバーレイサービスの開始に失敗しました: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }
    
    private fun checkMicrophonePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            requireContext(),
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    private fun requestMicrophonePermission() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("マイク権限が必要です")
            .setMessage("ウェイクワード機能を使用するには、マイクへのアクセス権限が必要です。")
            .setPositiveButton("権限を許可") { _, _ ->
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1001)
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun showWakeWordSettingsDialog() {
        val currentWakeWord = app.securePreferences.getString("wake_word_phrase", "ルミメイ") ?: "ルミメイ"
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("ウェイクワード設定")
            .setMessage("""
                ■ ウェイクワードとは？
                「${currentWakeWord}」と話しかけると、アプリが自動的に起動します。
                
                ■ 使い方
                1. この機能をオンにする
                2. 「${currentWakeWord}」と話しかける
                3. アプリが自動的に音声入力モードになります
                
                ■ 注意
                • バックグラウンドで常に音声を監視します
                • バッテリー消費が増える可能性があります
                • マイク権限が必要です
                
                現在のウェイクワード: 「${currentWakeWord}」
            """.trimIndent())
            .setPositiveButton("設定変更") { _, _ ->
                showWakeWordEditDialog(currentWakeWord)
            }
            .setNegativeButton("閉じる", null)
            .show()
    }
    
    private fun showWakeWordEditDialog(currentWakeWord: String) {
        val input = android.widget.EditText(requireContext())
        input.setText(currentWakeWord)
        input.hint = "ウェイクワードを入力"
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("ウェイクワードを変更")
            .setMessage("新しいウェイクワードを入力してください（2-10文字推奨）")
            .setView(input)
            .setPositiveButton("保存") { _, _ ->
                val newWakeWord = input.text.toString().trim()
                if (newWakeWord.isNotBlank() && newWakeWord.length >= 2) {
                    app.securePreferences.putString("wake_word_phrase", newWakeWord)
                    Toast.makeText(
                        requireContext(),
                        "ウェイクワードを「${newWakeWord}」に変更しました",
                        Toast.LENGTH_SHORT
                    ).show()
                    
                    // サービスを再起動して新しいウェイクワードを適用
                    if (app.securePreferences.isWakeWordEnabled) {
                        val appCtx = requireActivity().application as com.lumimei.assistant.LumiMeiApplication
                        appCtx.stopWakeWordService()
                        Handler().postDelayed({
                            appCtx.javaClass.getMethod("startWakeWordService").invoke(appCtx)
                        }, 500)
                    }
                } else {
                    Toast.makeText(
                        requireContext(),
                        "ウェイクワードは2文字以上で入力してください",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun setupLoginLogoutButton(isLoggedIn: Boolean) {
        try {
            if (isLoggedIn) {
                // Show logout option for logged in users
                binding.layoutLogout.setOnClickListener {
                    showLogoutConfirmation()
                }
                // Update text to show logout option
                val logoutTextView = binding.layoutLogout.findViewById<android.widget.TextView>(android.R.id.text1)
                    ?: binding.layoutLogout.getChildAt(0) as? android.widget.TextView
                logoutTextView?.text = "ログアウト"
            } else {
                // Show login option for guest users
                binding.layoutLogout.setOnClickListener {
                    showLoginPrompt()
                }
                // Update text to show login option
                val loginTextView = binding.layoutLogout.findViewById<android.widget.TextView>(android.R.id.text1)
                    ?: binding.layoutLogout.getChildAt(0) as? android.widget.TextView
                loginTextView?.text = "ログイン"
                loginTextView?.setTextColor(resources.getColor(android.R.color.holo_blue_light, null))
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not setup login/logout button", e)
        }
    }
    
    private fun showLogoutConfirmation() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("ログアウト")
            .setMessage("ログアウトしますか？")
            .setPositiveButton("ログアウト") { _, _ ->
                performLogout()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }

    private fun performLogout() {
        lifecycleScope.launch {
            try {
                // Call logout API
                val response = apiClient.apiService.logout()
                if (response.isSuccessful) {
                    Log.d(TAG, "Server logout successful")
                } else {
                    Log.w(TAG, "Server logout failed: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during logout API call", e)
            } finally {
                app.securePreferences.logout()
                
                // Navigate to main activity
                val intent = Intent(requireContext(), MainActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(intent)
                requireActivity().finish()
            }
        }
    }
    
    private fun showLoginPrompt() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("ログイン")
            .setMessage("ゲストモードで利用中です。アカウントでログインしますか？")
            .setPositiveButton("ログイン") { _, _ ->
                // Navigate to login activity
                try {
                    val intent = Intent(requireContext(), Class.forName("com.lumimei.assistant.ui.auth.LoginActivity"))
                    startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(requireContext(), "ログイン機能は準備中です", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("ゲストのまま継続", null)
            .show()
    }
    
    private fun showUsageGuide() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("アプリの使い方")
            .setMessage("""
                ■ オーバーレイアシスタント
                • 他のアプリの上に透明なアシスタントを表示
                • 設定で権限を許可後、ドラッグ可能なボタンが表示
                • メインボタンで会話開始、応答は画面上に表示
                
                ■ ウェイクワード機能
                • 「ルミメイ」と話しかけてアプリ自動起動
                • マイク権限が必要（使用中のみでOK）
                • バックグラウンドで常時監視
                
                ■ 音声機能
                • TTS: アシスタントの応答を音声で読み上げ
                • 音声入力: マイクボタンで音声でメッセージ送信
                • 音声キャラクター: 複数の声から選択可能
                
                ■ 設定項目
                • 音声ストリーミング: リアルタイム音声通信用（将来機能）
                • オーバーレイチャット: 他のアプリ上でのチャット機能
                
                ■ 権限について
                • マイク: 音声入力とウェイクワード用
                • オーバーレイ: 他のアプリ上での表示用
                • 通知: アプリからのお知らせ用
            """.trimIndent())
            .setPositiveButton("閉じる", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}