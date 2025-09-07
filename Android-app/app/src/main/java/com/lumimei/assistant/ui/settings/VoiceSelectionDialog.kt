package com.lumimei.assistant.ui.settings

import android.content.Context
import com.google.android.material.dialog.MaterialAlertDialogBuilder

data class VoiceCharacter(
    val id: Int,
    val name: String,
    val description: String
)

class VoiceSelectionDialog(private val context: Context) {
    
    private val voiceCharacters = listOf(
        VoiceCharacter(2, "四国めたん", "はっきりした芯のある声"),
        VoiceCharacter(3, "ずんだもん", "子供っぽい高めの声"),
        VoiceCharacter(8, "春日部つむぎ", "元気な明るい声"),
        VoiceCharacter(10, "雨晴はう", "優しく可愛い声"),
        VoiceCharacter(9, "波音リツ", "低めのクールな声"),
        VoiceCharacter(11, "玄野武宏", "爽やかな青年の声"),
        VoiceCharacter(29, "No.7", "しっかりした凛々しい声")
    )
    
    fun show(currentVoiceId: Int, onVoiceSelected: (VoiceCharacter) -> Unit) {
        val voiceNames = voiceCharacters.map { "${it.name}\n${it.description}" }.toTypedArray()
        val currentIndex = voiceCharacters.indexOfFirst { it.id == currentVoiceId }.takeIf { it >= 0 } ?: 0
        
        MaterialAlertDialogBuilder(context)
            .setTitle("音声キャラクターを選択")
            .setSingleChoiceItems(voiceNames, currentIndex) { dialog, which ->
                onVoiceSelected(voiceCharacters[which])
                dialog.dismiss()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }
    
    fun getVoiceById(id: Int): VoiceCharacter? {
        return voiceCharacters.find { it.id == id }
    }
    
    fun getDefaultVoice(): VoiceCharacter {
        return voiceCharacters.first { it.id == 2 } // 四国めたん
    }
}
