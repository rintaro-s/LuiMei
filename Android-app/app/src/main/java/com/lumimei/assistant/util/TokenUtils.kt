package com.lumimei.assistant.util

import android.util.Base64
import org.json.JSONObject

object TokenUtils {
    fun extractClaims(jwt: String): JSONObject? {
        return try {
            val parts = jwt.split(".")
            if (parts.size < 2) return null
            val payload = parts[1]
            val decoded = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            val json = String(decoded, Charsets.UTF_8)
            JSONObject(json)
        } catch (_: Exception) {
            null
        }
    }

    fun getStringClaim(jwt: String, key: String): String? {
        return try {
            val claims = extractClaims(jwt)
            val value = claims?.optString(key, null)
            if (value.isNullOrEmpty()) null else value
        } catch (_: Exception) {
            null
        }
    }
}
