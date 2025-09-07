package com.lumimei.assistant.ui.life

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.BackendCompatibleModels

class CookingSuggestionsAdapter(
    private val suggestions: List<BackendCompatibleModels.CookingSuggestion>,
    private val onItemClick: (BackendCompatibleModels.CookingSuggestion) -> Unit
) : RecyclerView.Adapter<CookingSuggestionsAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvRecipeName: TextView = view.findViewById(R.id.tv_recipe_name)
        val tvCookingTime: TextView = view.findViewById(R.id.tv_cooking_time)
        val tvDifficulty: TextView = view.findViewById(R.id.tv_difficulty)
        val tvIngredients: TextView = view.findViewById(R.id.tv_ingredients)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_cooking_suggestion, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val recipe = suggestions[position]
        
        holder.tvRecipeName.text = recipe.name
        holder.tvCookingTime.text = "${recipe.cookingTime}分"
        holder.tvDifficulty.text = recipe.difficulty
        
        // Show first few ingredients
        val ingredients = recipe.ingredients.take(3).joinToString(", ")
        holder.tvIngredients.text = if (recipe.ingredients.size > 3) {
            "$ingredients..."
        } else {
            ingredients
        }
        
        holder.itemView.setOnClickListener {
            onItemClick(recipe)
        }
    }

    override fun getItemCount(): Int = suggestions.size
}
