package com.lumimei.assistant.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import com.lumimei.assistant.utils.SmartLogger
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.karumi.dexter.Dexter
import com.karumi.dexter.MultiplePermissionsReport
import com.karumi.dexter.PermissionToken
import com.karumi.dexter.listener.PermissionRequest
import com.karumi.dexter.listener.multi.MultiplePermissionsListener
import com.lumimei.assistant.BuildConfig
import com.lumimei.assistant.LumiMeiApplication
import com.lumimei.assistant.R
import com.lumimei.assistant.databinding.ActivityMainBinding
import com.lumimei.assistant.services.OverlayService
import com.lumimei.assistant.ui.chat.ChatFragmentModern
import com.lumimei.assistant.ui.life.LifeFragment
import com.lumimei.assistant.ui.settings.SettingsFragment
import com.lumimei.assistant.ui.study.StudyFragment
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private lateinit var app: LumiMeiApplication
    
    companion object {
        private const val TAG = "MainActivity"
        private const val FRAGMENT_CHAT = "chat"
        private const val FRAGMENT_STUDY = "study"
        private const val FRAGMENT_LIFE = "life"
        private const val FRAGMENT_SETTINGS = "settings"
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 101
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        app = application as LumiMeiApplication
        
        // Handle assistant intents (ASSIST, VOICE_COMMAND)
        handleAssistantIntent()
        
        // Check for auth success/error from intent
        handleAuthResult()
        
        // Request permissions
        requestNecessaryPermissions()
        
        // Setup UI
        setupBottomNavigation()
        
        // Check authentication status
        checkAuthenticationStatus()
        
        // Connect to socket if authenticated
        if (app.securePreferences.isLoggedIn()) {
            app.socketManager.connect()
        }
        
        // Load initial fragment
        if (savedInstanceState == null) {
            loadFragment(ChatFragmentModern(), FRAGMENT_CHAT)
        }
    }
    
    private fun handleAuthResult() {
        val authSuccess = intent.getBooleanExtra("auth_success", false)
        val authError = intent.getStringExtra("auth_error")
        val loggedOut = intent.getBooleanExtra("logged_out", false)
        
        when {
            authSuccess -> {
                Toast.makeText(this, "認証が完了しました", Toast.LENGTH_SHORT).show()
                // Connect to socket after successful auth
                app.socketManager.connect()
                // Fetch user profile if not already available
                if (app.securePreferences.userId.isNullOrEmpty()) {
                    fetchUserProfile()
                }
                // As a safety, ensure fallback to email
                if (app.securePreferences.userId.isNullOrEmpty() && !app.securePreferences.userEmail.isNullOrEmpty()) {
                    app.securePreferences.userId = app.securePreferences.userEmail
                }
            }
            authError != null -> {
                Toast.makeText(this, authError, Toast.LENGTH_LONG).show()
            }
            loggedOut -> {
                Toast.makeText(this, "ログアウトしました", Toast.LENGTH_SHORT).show()
                showLoginDialog()
            }
        }
    }
    
    private fun setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_chat -> {
                    loadFragment(ChatFragmentModern(), FRAGMENT_CHAT)
                    true
                }
                R.id.nav_study -> {
                    loadFragment(StudyFragment(), FRAGMENT_STUDY)
                    true
                }
                R.id.nav_life -> {
                    loadFragment(LifeFragment(), FRAGMENT_LIFE)
                    true
                }
                R.id.nav_settings -> {
                    loadFragment(SettingsFragment(), FRAGMENT_SETTINGS)
                    true
                }
                else -> false
            }
        }
    }
    
    private fun loadFragment(fragment: Fragment, tag: String) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment, tag)
            .commit()
    }
    
    private fun checkAuthenticationStatus() {
        val isLoggedIn = app.securePreferences.isLoggedIn()
        val hasUserId = !app.securePreferences.userId.isNullOrEmpty()
        
        if (!isLoggedIn && !hasUserId) {
            // 完全に未認証状態
            showLoginDialog()
        } else if (!isLoggedIn && hasUserId) {
            // ゲストモード状態
            updateUIForLoginState()
            Toast.makeText(this, "ゲストモードで続行中", Toast.LENGTH_SHORT).show()
        } else {
            // ログイン済み状態
            updateUIForLoginState()
            // Test API connection
            lifecycleScope.launch {
                try {
                    val response = app.apiClient.apiService.healthCheck()
                    if (response.isSuccessful) {
                        SmartLogger.i(this@MainActivity, TAG, "API connection successful")
                    } else {
                            SmartLogger.w(this@MainActivity, TAG, "API connection failed: ${response.code()}")
                    }
                } catch (e: Exception) {
                        SmartLogger.e(this@MainActivity, TAG, "API connection error", e)
                }
            }
        }
    }
    
    private fun updateUIForLoginState() {
        // ナビゲーションメニューの更新などが必要な場合はここで実装
    SmartLogger.d(this, TAG, "UI updated for login state")
    }
    
    private fun showLoginDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle("ようこそ LumiMei へ")
            .setMessage("Googleアカウントでログインするか、ゲストとして続行してください。")
            .setPositiveButton("ログイン") { _, _ ->
                startGoogleAuth()
            }
            .setNegativeButton("ゲストとして続行") { _, _ ->
                setupGuestMode()
            }
            .setNeutralButton("後で") { dialog, _ ->
                setupGuestMode() // デフォルトでゲストモード
                dialog.dismiss()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun startGoogleAuth() {
        val authUrl = "${BuildConfig.SERVER_BASE_URL}/auth/google"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
        
        try {
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Google auth", e)
            Toast.makeText(this, "認証ページを開けませんでした", Toast.LENGTH_SHORT).show()
        }
    }
    
    fun startLoginFlow() {
        startGoogleAuth()
    }
    
    private fun setupGuestMode() {
        // ゲストモードでのユーザーID設定
        val guestId = "guest_" + System.currentTimeMillis()
        app.securePreferences.userId = guestId
        app.securePreferences.userEmail = "guest@lumimei.local"
        app.securePreferences.userName = "ゲストユーザー"
        
        Toast.makeText(this, "ゲストモードで開始しました", Toast.LENGTH_SHORT).show()
        
        // UIを更新
        updateUIForLoginState()
    }
    
    private fun fetchUserProfile() {
        lifecycleScope.launch {
            try {
                val response = app.apiClient.apiService.getUserProfile()
                if (response.isSuccessful) {
                    val profileResponse = response.body()
                    if (profileResponse?.success == true && profileResponse.data?.user != null) {
                        val user = profileResponse.data.user
                        val email = user.email
                        val userId = user.userId.ifEmpty { email }
                        val name = user.displayName

                        app.securePreferences.userId = userId
                        app.securePreferences.userEmail = email
                        app.securePreferences.userName = name
                    SmartLogger.d(this@MainActivity, TAG, "User profile fetched and saved")
                    }
                } else {
                    SmartLogger.w(this@MainActivity, TAG, "Failed to fetch user profile: ${response.code()}")
                }
            } catch (e: Exception) {
                SmartLogger.e(this@MainActivity, TAG, "Error fetching user profile", e)
            }
        }
    }
    
    private fun requestNecessaryPermissions() {
        val permissionsNeeded = mutableListOf<String>()
        
        // Check each permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) 
            != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA)
        }
        
        // 通知権限は任意にする（ユーザーの選択に委ねる）
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            val notificationPermissionDenied = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            val userWantsNotifications = app.securePreferences.getBoolean("request_notifications", false)
            
            if (notificationPermissionDenied && userWantsNotifications) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        
        if (permissionsNeeded.isNotEmpty()) {
            Dexter.withContext(this)
                .withPermissions(permissionsNeeded)
                .withListener(object : MultiplePermissionsListener {
                    override fun onPermissionsChecked(report: MultiplePermissionsReport) {
                        if (report.areAllPermissionsGranted()) {
                                        SmartLogger.d(this@MainActivity, TAG, "All permissions granted")
                                            } else {
                                                            SmartLogger.w(this@MainActivity, TAG, "Some permissions denied")
                            showPermissionExplanation(report.deniedPermissionResponses.map { it.permissionName })
                        }
                        
                        // 通知権限のダイアログを表示（初回のみ）
                        showNotificationPermissionDialog()
                    }
                    
                    override fun onPermissionRationaleShouldBeShown(
                        permissions: List<PermissionRequest>,
                        token: PermissionToken
                    ) {
                        token.continuePermissionRequest()
                    }
                })
                .check()
        } else {
            // 権限が必要ない場合も通知ダイアログを表示
            showNotificationPermissionDialog()
        }
    }
    
    private fun showPermissionExplanation(deniedPermissions: List<String>) {
        val message = buildString {
            appendLine("以下の機能を使用するには権限が必要です：")
            deniedPermissions.forEach { permission ->
                when (permission) {
                    Manifest.permission.RECORD_AUDIO -> appendLine("• 音声入力機能")
                    Manifest.permission.CAMERA -> appendLine("• カメラ撮影機能")
                    Manifest.permission.POST_NOTIFICATIONS -> appendLine("• 通知機能")
                }
            }
        }
        
        MaterialAlertDialogBuilder(this)
            .setTitle("権限について")
            .setMessage(message)
            .setPositiveButton("設定で許可") { _, _ ->
                // Open app settings
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = Uri.fromParts("package", packageName, null)
                startActivity(intent)
            }
            .setNegativeButton("後で") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
    
    private fun showNotificationPermissionDialog() {
        // 初回起動または明示的に設定していない場合のみ表示
        val hasShownNotificationDialog = app.securePreferences.getBoolean("notification_dialog_shown", false)
        
        if (!hasShownNotificationDialog && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            val notificationPermissionGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            
            if (!notificationPermissionGranted) {
                androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle("通知について")
                    .setMessage("学習リマインダーや重要なお知らせを受け取りますか？\n\n※いつでも設定から変更できます")
                    .setPositiveButton("通知を有効にする") { _, _ ->
                        app.securePreferences.putBoolean("request_notifications", true)
                        app.securePreferences.putBoolean("notification_dialog_shown", true)
                        
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST_CODE)
                        }
                    }
                    .setNegativeButton("後で決める") { _, _ ->
                        app.securePreferences.putBoolean("request_notifications", false)
                        app.securePreferences.putBoolean("notification_dialog_shown", true)
                    }
                    .setNeutralButton("表示しない") { _, _ ->
                        app.securePreferences.putBoolean("request_notifications", false)
                        app.securePreferences.putBoolean("notification_dialog_shown", true)
                        app.securePreferences.putBoolean("disable_notification_prompts", true)
                    }
                    .setCancelable(false)
                    .show()
            }
        }
    }
    
    private fun handleAssistantIntent() {
        val action = intent.action
    SmartLogger.d(this, TAG, "Intent action: $action")
        
        when (action) {
            "android.intent.action.ASSIST",
            "android.intent.action.VOICE_COMMAND",
            "android.service.voice.VoiceInteractionService" -> {
                // デバイスアシスタント機能は一時的に無効化
                try {
                    // 現在利用できません
                    Toast.makeText(this, "デバイスアシスタント機能は開発中です", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    SmartLogger.e(this, TAG, "Failed to show device assistant message", e)
                }
                
                // フォールバック: アシスタントとして呼び出された場合、オーバーレイを表示
                if (android.provider.Settings.canDrawOverlays(this)) {
                    startOverlayService()
                    // アプリをバックグラウンドに移動
                    moveTaskToBack(true)
                } else {
                    // オーバーレイ権限がない場合は権限要求
                    requestOverlayPermission()
                }
            }
        }
    }
    
    private fun startOverlayService() {
        val intent = Intent(this, com.lumimei.assistant.ui.overlay.OverlayChatService::class.java).apply {
            action = com.lumimei.assistant.ui.overlay.OverlayChatService.ACTION_SHOW
            putExtra("auto_start_voice", true) // 音声認識自動開始フラグ
        }
                    startService(intent)
    }
    
    private fun requestOverlayPermission() {
        MaterialAlertDialogBuilder(this)
            .setTitle("オーバーレイ権限が必要です")
            .setMessage("どのアプリの上でも表示するために、オーバーレイ権限を許可してください。")
            .setPositiveButton("設定で許可") { _, _ ->
                val intent = Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                intent.data = Uri.fromParts("package", packageName, null)
                startActivity(intent)
            }
            .setNegativeButton("キャンセル") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        app.socketManager.disconnect()
    }
}
