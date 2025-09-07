package com.lumimei.assistant.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.lumimei.assistant.R
import com.lumimei.assistant.data.models.Recipe

class RecipeAdapter(
    private val recipes: List<Recipe>,
    private val onRecipeClick: (Recipe) -> Unit
) : RecyclerView.Adapter<RecipeAdapter.RecipeViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecipeViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recipe, parent, false)
        return RecipeViewHolder(view)
    }

    override fun onBindViewHolder(holder: RecipeViewHolder, position: Int) {
        holder.bind(recipes[position])
    }

    override fun getItemCount(): Int = recipes.size

    inner class RecipeViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val card: MaterialCardView = itemView.findViewById(R.id.card_recipe)
        private val imageView: ImageView = itemView.findViewById(R.id.iv_recipe_image)
        private val nameText: TextView = itemView.findViewById(R.id.tv_recipe_name)
        private val descriptionText: TextView = itemView.findViewById(R.id.tv_recipe_description)
        private val timeText: TextView = itemView.findViewById(R.id.tv_cooking_time)
        private val difficultyText: TextView = itemView.findViewById(R.id.tv_difficulty)

        fun bind(recipe: Recipe) {
            nameText.text = recipe.name
            descriptionText.text = recipe.description
            timeText.text = "${recipe.cookingTime}分"
            difficultyText.text = recipe.difficulty
            
            // デフォルト画像設定
            imageView.setImageResource(R.drawable.ic_recipe_default)
            
            card.setOnClickListener {
                onRecipeClick(recipe)
            }
        }
    }
}
