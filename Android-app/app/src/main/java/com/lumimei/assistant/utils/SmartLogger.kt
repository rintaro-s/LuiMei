package com.lumimei.assistant.utils

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SmartLogger {
    private const val TAG_PREFIX = "LumiMei"
    private const val LOG_DIR = "Logs"
    private const val LOG_FILE = "log.txt"

    private fun timeStamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
        return sdf.format(Date())
    }

    private fun logToFile(context: Context?, level: String, tag: String, message: String, throwable: Throwable? = null) {
        try {
            if (context == null) return
            val dir = File(context.filesDir, LOG_DIR)
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, LOG_FILE)
            val pw = PrintWriter(FileWriter(file, true))
            pw.println("${timeStamp()} [$level] $tag: $message")
            throwable?.let { t ->
                t.printStackTrace(pw)
            }
            pw.flush()
            pw.close()
        } catch (e: Exception) {
            Log.e("$TAG_PREFIX-Logger", "Failed to write log file", e)
        }
    }

    fun d(context: Context?, tag: String, message: String) {
        Log.d("$TAG_PREFIX-$tag", message)
        logToFile(context, "DEBUG", tag, message)
    }

    fun i(context: Context?, tag: String, message: String) {
        Log.i("$TAG_PREFIX-$tag", message)
        logToFile(context, "INFO", tag, message)
    }

    fun w(context: Context?, tag: String, message: String, throwable: Throwable? = null) {
        Log.w("$TAG_PREFIX-$tag", message, throwable)
        logToFile(context, "WARN", tag, message, throwable)
    }

    fun e(context: Context?, tag: String, message: String, throwable: Throwable? = null) {
        Log.e("$TAG_PREFIX-$tag", message, throwable)
        logToFile(context, "ERROR", tag, message, throwable)
    }
}
