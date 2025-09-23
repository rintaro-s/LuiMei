package com.lumimei.assistant.ui.life

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.lumimei.assistant.databinding.FragmentLifeBinding

class LifeFragment : Fragment() {

    private var _binding: FragmentLifeBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLifeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupLifeFeatures()
    }

    private fun setupLifeFeatures() {
        // 生活管理機能のセットアップ
        try {
            // 会議メモ機能 - Null safe
            view?.findViewById<View>(com.lumimei.assistant.R.id.btn_meeting_memo)?.setOnClickListener {
                startActivity(Intent(requireContext(), MeetingMemoActivity::class.java))
            }

            // 料理提案機能 - Null safe
            view?.findViewById<View>(com.lumimei.assistant.R.id.btn_cooking)?.setOnClickListener {
                startActivity(Intent(requireContext(), CookingSuggestionsActivity::class.java))
            }

            // 家計簿機能 - Null safe
            view?.findViewById<View>(com.lumimei.assistant.R.id.btn_expenses)?.setOnClickListener {
                startActivity(Intent(requireContext(), ExpenseTrackingActivity::class.java))
            }

            // 生活のコツ機能 - Null safe
            view?.findViewById<View>(com.lumimei.assistant.R.id.btn_life_tips)?.setOnClickListener {
                startActivity(Intent(requireContext(), LifeTipsActivity::class.java))
            }
        } catch (e: Exception) {
            // Handle any view access errors gracefully
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
