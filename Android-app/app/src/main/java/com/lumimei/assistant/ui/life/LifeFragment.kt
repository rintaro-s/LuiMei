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
            // 会議メモ機能
            binding.btnMeetingMemo.setOnClickListener {
                startActivity(Intent(requireContext(), MeetingMemoActivity::class.java))
            }

            // 料理提案機能
            binding.btnCooking.setOnClickListener {
                startActivity(Intent(requireContext(), CookingSuggestionsActivity::class.java))
            }

            // 家計簿機能
            binding.btnExpenses.setOnClickListener {
                startActivity(Intent(requireContext(), ExpenseTrackingActivity::class.java))
            }

            // 生活のヒント機能を削除（ユーザー要求により）
            // binding.btnLifeTips - この機能は削除済み
        } catch (e: Exception) {
            // Handle any view access errors gracefully
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
