package com.lumimei.assistant.ui.life

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.text.Editable
import android.text.TextWatcher
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lumimei.assistant.R
import com.lumimei.assistant.network.ApiClient
import com.lumimei.assistant.data.preferences.SecurePreferences
import com.lumimei.assistant.data.models.BackendCompatibleModels
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.collections.ArrayList

/**
 * 高機能家計簿アクティビティ
 * - レシート写真自動読み取り・登録
 * - 手動入力機能
 * - カテゴリ別分析
 * - 月別・週別レポート
 * - 予算管理
 * - 支出傾向分析
 */
class ExpenseTrackingActivity : AppCompatActivity() {
    
    private lateinit var securePreferences: SecurePreferences
    private lateinit var apiClient: ApiClient
    private lateinit var expenseAdapter: ExpenseAdapter
    private val expenseList = ArrayList<ExpenseItem>()
    
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        bitmap?.let { 
            analyzeReceiptImage(it)
        }
    }
    
    private val pickImages = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty()) {
            uris.forEach { uri ->
                try {
                    val bitmap = MediaStore.Images.Media.getBitmap(contentResolver, uri)
                    analyzeReceiptImage(bitmap)
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading image", e)
                    Toast.makeText(this, "画像の読み込みに失敗しました: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    companion object {
        private const val TAG = "ExpenseTrackingActivity"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_expense_tracking)
        
        securePreferences = SecurePreferences(this)
        apiClient = ApiClient(this, securePreferences)
        
        setupUI()
        setupRecyclerView()
        loadExpenseData()
    }
    
    private fun setupUI() {
        
        
        // レシート写真ボタン
        val btnReceiptPhoto = findViewById<android.widget.Button>(R.id.btnReceiptPhoto)
        btnReceiptPhoto?.setOnClickListener {
            showImageSourceDialog()
        }
        
        // 複数レシート写真ボタン
        val btnMultipleReceipts = findViewById<android.widget.Button>(R.id.btnMultipleReceipts)
        btnMultipleReceipts?.setOnClickListener {
            if (hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                pickImages.launch("image/*")
            } else {
                requestStoragePermission()
            }
        }
        
        // 手動追加ボタン
        val btnAddManual = findViewById<android.widget.Button>(R.id.btnAddManual)
        btnAddManual?.setOnClickListener {
            addManualExpense()
        }
        
        // 分析ボタン
        val btnAnalytics = findViewById<android.widget.Button>(R.id.btnAnalytics)
        btnAnalytics?.setOnClickListener {
            showAnalyticsView()
        }
    }
    
    private fun setupRecyclerView() {
        val recyclerView = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.recyclerView)
        expenseAdapter = ExpenseAdapter(expenseList) { expense ->
            // 支出項目をクリックした時の編集機能
            editExpense(expense)
        }
        recyclerView?.layoutManager = LinearLayoutManager(this)
        recyclerView?.adapter = expenseAdapter
    }
    
    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }
    
    private fun requestStoragePermission() {
        requestPermissions(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE), 101)
    }
    
    private fun requestCameraPermission() {
        requestPermissions(arrayOf(Manifest.permission.CAMERA), 100)
    }
    
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            100 -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    takePicture.launch(null)
                } else {
                    Toast.makeText(this, "カメラの権限が必要です", Toast.LENGTH_SHORT).show()
                }
            }
            101 -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pickImages.launch("image/*")
                } else {
                    Toast.makeText(this, "ストレージの権限が必要です", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    private fun showImageSourceDialog() {
        val options = arrayOf("カメラで撮影", "ギャラリーから選択", "複数画像を選択")
        
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("レシート画像の取得方法")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> {
                        if (hasPermission(Manifest.permission.CAMERA)) {
                            takePicture.launch(null)
                        } else {
                            requestCameraPermission()
                        }
                    }
                    1 -> {
                        if (hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                            pickImages.launch("image/*")
                        } else {
                            requestStoragePermission()
                        }
                    }
                    2 -> {
                        if (hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                            pickImages.launch("image/*")
                        } else {
                            requestStoragePermission()
                        }
                    }
                }
            }
            .show()
    }
    
    private fun analyzeReceiptImage(bitmap: Bitmap) {
        lifecycleScope.launch {
            try {
                findViewById<android.widget.ProgressBar>(R.id.progressBar)?.visibility = View.VISIBLE
                
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: "guest"
                
                // Convert bitmap to base64
                val base64Image = bitmapToBase64(bitmap)
                
                val request = BackendCompatibleModels.ImageAnalysisRequest(
                    userId = userId,
                    imageData = base64Image,
                    context = mapOf(
                        "analysisType" to "receipt_ocr",
                        "language" to "ja",
                        "purpose" to "expense_tracking",
                        "extractFields" to listOf("total_amount", "items", "store_name", "date", "tax")
                    )
                )
                
                val response = withContext(Dispatchers.IO) {
                    apiClient.apiService.analyzeImage(request)
                }
                
                if (response.isSuccessful) {
                    val analysisResponse = response.body()
                    if (analysisResponse?.success == true) {
                        processReceiptAnalysis(analysisResponse)
                    } else {
                        showError("レシート解析に失敗しました: ${analysisResponse?.error}")
                    }
                } else {
                    showError("サーバーエラー: ${response.code()} ${response.message()}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error analyzing receipt image", e)
                showError("レシート解析に失敗しました: ${e.message}")
            } finally {
                findViewById<android.widget.ProgressBar>(R.id.progressBar)?.visibility = View.GONE
            }
        }
    }
    
    private fun processReceiptAnalysis(analysis: BackendCompatibleModels.ImageAnalysisResponse?) {
        try {
            // レシート解析結果を解析して自動入力
            val description = analysis?.analysis ?: ""
            val totalAmount = extractAmountFromDescription(description)
            val storeName = extractStoreNameFromDescription(description)
            val items = extractItemsFromDescription(description)
            
            // 確認ダイアログ表示
            showReceiptConfirmationDialog(analysis, totalAmount, storeName, items)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error processing receipt analysis", e)
            showError("レシート解析結果の処理に失敗しました: ${e.message}")
        }
    }
    
    private fun extractAmountFromDescription(description: String): Int {
        // 金額抽出ロジック
        val amountRegex = Regex("""(\d{1,3}(?:,\d{3})*|\d+)\s*円""")
        val matches = amountRegex.findAll(description)
        return matches.maxByOrNull { it.value.replace(",", "").replace("円", "").toIntOrNull() ?: 0 }
            ?.value?.replace(",", "")?.replace("円", "")?.toIntOrNull() ?: 0
    }
    
    private fun extractStoreNameFromDescription(description: String): String {
        // 店舗名抽出ロジック
        val lines = description.split("\n")
        return lines.firstOrNull { line ->
            line.contains("店") || line.contains("株式会社") || line.contains("有限会社") ||
            line.length < 20 && !line.contains("円") && !line.contains("税")
        }?.trim() ?: ""
    }
    
    private fun extractItemsFromDescription(description: String): List<String> {
        // 商品リスト抽出ロジック
        val lines = description.split("\n")
        return lines.filter { line ->
            line.contains("円") && !line.contains("計") && !line.contains("税") &&
            !line.contains("合計") && line.length > 3
        }.map { it.split("円")[0].trim() }
    }
    
    private fun showReceiptConfirmationDialog(
        analysis: BackendCompatibleModels.ImageAnalysisResponse?,
        amount: Int,
        storeName: String,
        items: List<String>
    ) {
        val message = buildString {
            appendLine("レシート解析結果：")
            appendLine()
            if (amount > 0) appendLine("金額: ${amount}円")
            if (storeName.isNotEmpty()) appendLine("店舗: $storeName")
            if (items.isNotEmpty()) {
                appendLine("商品:")
                items.take(5).forEach { appendLine("• $it") }
                if (items.size > 5) appendLine("...他${items.size - 5}点")
            }
            appendLine()
            appendLine("この内容で支出を記録しますか？")
        }
        
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("レシート解析完了")
            .setMessage(message)
            .setPositiveButton("記録") { _, _ ->
                saveExpenseFromReceipt(amount, storeName, items)
            }
            .setNegativeButton("手動編集") { _, _ ->
                Toast.makeText(this, "手動編集機能は開発中です", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("キャンセル", null)
            .show()
    }
    
    private fun saveExpenseFromReceipt(amount: Int, storeName: String, items: List<String>) {
        val description = if (storeName.isNotEmpty()) {
            if (items.isNotEmpty()) "$storeName - ${items.take(3).joinToString(", ")}" else storeName
        } else {
            items.take(3).joinToString(", ")
        }
        
        val category = "食費" // デフォルトカテゴリ
        
        saveExpense(amount, description, category, "receipt")
    }
    
    private fun addManualExpense() {
        // 簡易入力ダイアログ
        val builder = androidx.appcompat.app.AlertDialog.Builder(this)
        builder.setTitle("支出を手動追加")
        
        val inputView = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(50, 40, 50, 10)
        }
        
        val amountInput = android.widget.EditText(this).apply {
            hint = "金額"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        
        val descriptionInput = android.widget.EditText(this).apply {
            hint = "説明"
        }
        
        inputView.addView(amountInput)
        inputView.addView(descriptionInput)
        
        builder.setView(inputView)
            .setPositiveButton("追加") { _, _ ->
                val amountStr = amountInput.text.toString()
                val description = descriptionInput.text.toString()
                val category = "その他" // デフォルトカテゴリ
                
                if (amountStr.isNotEmpty() && description.isNotEmpty()) {
                    val amount = amountStr.toIntOrNull()
                    if (amount != null && amount > 0) {
                        saveExpense(amount, description, category, "manual")
                    } else {
                        Toast.makeText(this, "正しい金額を入力してください", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(this, "すべての項目を入力してください", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun saveExpense(amount: Int, description: String, category: String, source: String) {
        lifecycleScope.launch {
            try {
                findViewById<android.widget.ProgressBar>(R.id.progressBar)?.visibility = View.VISIBLE
                
                val userId = securePreferences.userId ?: securePreferences.userEmail ?: "guest"
                
                val expense = ExpenseItem(
                    id = System.currentTimeMillis().toString(),
                    userId = userId,
                    amount = amount,
                    description = description,
                    category = category,
                    date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()),
                    source = source,
                    timestamp = System.currentTimeMillis()
                )
                
                // APIリクエスト（仮実装）
                // val response = withContext(Dispatchers.IO) {
                //     apiClient.apiService.addExpense(expense)
                // }
                
                // ローカルリストに追加（API実装まで）
                expenseList.add(0, expense)
                expenseAdapter.notifyItemInserted(0)
                
                Toast.makeText(this@ExpenseTrackingActivity, "支出を記録しました", Toast.LENGTH_SHORT).show()
                
            } catch (e: Exception) {
                Log.e(TAG, "Error saving expense", e)
                showError("支出の保存に失敗しました: ${e.message}")
            } finally {
                findViewById<android.widget.ProgressBar>(R.id.progressBar)?.visibility = View.GONE
            }
        }
    }
    
    private fun loadExpenseData() {
        lifecycleScope.launch {
            try {
                // Attempt to call backend if API exists; otherwise no-op and keep local list empty
                try {
                    val response = ApiClient(this@ExpenseTrackingActivity, securePreferences)
                        .apiService.getExpenseTracking(month = null)

                    if (response.isSuccessful && response.body()?.success == true) {
                        val data = response.body()?.data
                        // convert to local ExpenseItem list if possible
                        data?.records?.let { recs ->
                            // TODO: map BackendCompatibleModels.ExpenseRecord to local ExpenseItem if schema differs
                        }
                    }
                } catch (e: Exception) {
                    // ignore and continue with empty local list
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading expense data", e)
            }
        }
    }
    
    private fun editExpense(expense: ExpenseItem) {
        // 支出編集ダイアログ
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("支出編集")
            .setMessage("${expense.description}\n¥${expense.amount}\n${expense.category}")
            .setPositiveButton("削除") { _, _ ->
                deleteExpense(expense)
            }
            .setNeutralButton("閉じる", null)
            .show()
    }
    
    private fun deleteExpense(expense: ExpenseItem) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("支出削除")
            .setMessage("この支出を削除しますか？\n\n${expense.description}\n¥${expense.amount}")
            .setPositiveButton("削除") { _, _ ->
                val position = expenseList.indexOf(expense)
                if (position >= 0) {
                    expenseList.removeAt(position)
                    expenseAdapter.notifyItemRemoved(position)
                    Toast.makeText(this, "支出を削除しました", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    private fun showAnalyticsView() {
        // 詳細分析を表示
        val categoryTotals = expenseList.groupBy { it.category }
            .mapValues { it.value.sumOf { expense -> expense.amount } }
            .toList()
            .sortedByDescending { it.second }
        
        val analyticsText = if (categoryTotals.isNotEmpty()) {
            buildString {
                appendLine("カテゴリ別支出:")
                categoryTotals.take(5).forEach { (category, total) ->
                    appendLine("• $category: ¥${total}")
                }
            }
        } else {
            "支出データがありません"
        }
        
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("支出分析")
            .setMessage(analyticsText)
            .setPositiveButton("OK", null)
            .show()
    }
    
    private fun bitmapToBase64(bitmap: Bitmap): String {
        val byteArrayOutputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, byteArrayOutputStream)
        val byteArray = byteArrayOutputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }
    
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        Log.e(TAG, message)
    }
}

// 支出項目データクラス
data class ExpenseItem(
    val id: String,
    val userId: String,
    val amount: Int,
    val description: String,
    val category: String,
    val date: String,
    val source: String, // "manual" or "receipt"
    val timestamp: Long
)

// 支出リストアダプター
class ExpenseAdapter(
    private val expenses: List<ExpenseItem>,
    private val onItemClick: (ExpenseItem) -> Unit
) : androidx.recyclerview.widget.RecyclerView.Adapter<ExpenseAdapter.ViewHolder>() {
    
    class ViewHolder(view: View) : androidx.recyclerview.widget.RecyclerView.ViewHolder(view) {
        val tvAmount: android.widget.TextView = view.findViewById(android.R.id.text1)
        val tvDescription: android.widget.TextView = view.findViewById(android.R.id.text2)
    }
    
    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ViewHolder {
        val view = android.view.LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_2, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val expense = expenses[position]
        holder.tvAmount.text = "¥${expense.amount} (${expense.category})"
        holder.tvDescription.text = "${expense.description} - ${expense.date}"
        
        holder.itemView.setOnClickListener {
            onItemClick(expense)
        }
    }
    
    override fun getItemCount() = expenses.size
}
