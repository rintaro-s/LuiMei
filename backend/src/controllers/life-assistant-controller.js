/**
 * LumiMei OS Life Assistant Controller
 * 生活の手助け・家事管理機能
 */

const logger = require('../../utils/logger');
const Expense = require('../models/Expense');
const User = require('../models/User');

/**
 * 生活アシスタントコントローラー
 * 買い物リスト、掃除スケジュール、料理提案、家事タスク管理
 */
class LifeAssistantController {

  /**
   * ゲストユーザーの存在確認・作成
   */
  async ensureGuestUser(userId) {
    try {
      let user = await User.findOne({ userId });
      if (!user) {
        user = new User({
          userId,
          email: `${userId}@guest.local`,
          displayName: 'ゲストユーザー',
          isGuest: true,
          provider: 'guest'
        });
        await user.save();
        console.log('Guest user created:', userId);
      }
      return user;
    } catch (error) {
      console.error('Error ensuring guest user:', error);
      throw error;
    }
  }

  /**
   * 買い物リスト取得
   */
  async getShoppingList(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      
      // Mock data - 実際の実装ではデータベースから取得
      const shoppingItems = [
        { 
          id: "1", 
          name: '牛乳', 
          item: '牛乳', // 互換性
          category: '乳製品', 
          priority: 'high', 
          quantity: 1,
          unit: '本',
          completed: false,
          isCompleted: false, // 互換性
          addedAt: new Date().toISOString()
        },
        { 
          id: "2", 
          name: 'パン', 
          item: 'パン', // 互換性
          category: '主食', 
          priority: 'medium', 
          quantity: 1,
          unit: '袋',
          completed: false,
          isCompleted: false, // 互換性
          addedAt: new Date().toISOString()
        },
        { 
          id: "3", 
          name: 'りんご', 
          item: 'りんご', // 互換性
          category: '果物', 
          priority: 'low', 
          quantity: 3,
          unit: '個',
          completed: true,
          isCompleted: true, // 互換性
          addedAt: new Date().toISOString()
        },
        { 
          id: "4", 
          name: '卵', 
          item: '卵', // 互換性
          category: '乳製品', 
          priority: 'high', 
          quantity: 1,
          unit: 'パック',
          completed: false,
          isCompleted: false, // 互換性
          addedAt: new Date().toISOString()
        },
        { 
          id: "5", 
          name: '醤油', 
          item: '醤油', // 互換性
          category: '調味料', 
          priority: 'medium', 
          quantity: 1,
          unit: '本',
          completed: false,
          isCompleted: false, // 互換性
          addedAt: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: {
          items: shoppingItems,
          lastUpdated: new Date().toISOString()
        },
        // 互換性のため古い形式も含める
        shoppingList: shoppingItems,
        summary: {
          total: shoppingItems.length,
          pending: shoppingItems.filter(item => !item.completed && !item.isCompleted).length,
          completed: shoppingItems.filter(item => item.completed || item.isCompleted).length
        }
      });
    } catch (error) {
      logger.error('Failed to get shopping list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shopping list'
      });
    }
  }

  /**
   * 買い物リストに追加
   */
  async addShoppingItem(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { name, item, category, priority = 'medium', quantity = 1, unit = '個' } = req.body;

      // nameまたはitemのどちらかが必要
      const itemName = name || item;
      if (!itemName) {
        return res.status(400).json({
          success: false,
          error: 'Item name is required'
        });
      }

      const newItem = {
        id: Date.now().toString(),
        name: itemName,
        item: itemName, // 互換性のため
        category: category || '一般',
        priority: priority,
        quantity: quantity,
        unit: unit,
        completed: false,
        isCompleted: false, // 互換性のため
        addedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        message: `${itemName}を買い物リストに追加しました`,
        data: newItem,
        item: newItem // 互換性のため
      });
    } catch (error) {
      logger.error('Failed to add shopping item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to shopping list'
      });
    }
  }

  /**
   * 料理提案
   */
  async getCookingSuggestions(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { ingredients, difficulty = 'medium', mealType = 'dinner' } = req.query;

      const suggestions = [
        {
          id: "1",
          name: 'チキンカレー',
          difficulty: 'easy',
          cookingTime: "30分",
          ingredients: ['鶏肉 300g', '玉ねぎ 1個', 'カレールー 1箱', 'じゃがいも 2個', '人参 1本'],
          instructions: [
            '玉ねぎと人参を一口大に切る',
            'じゃがいもの皮をむいて切る',
            '鶏肉を一口大に切る',
            '野菜と肉を炒める',
            '水を加えて煮込む',
            'カレールーを溶かして完成'
          ],
          tags: ['簡単', '定番', '家族向け'],
          calories: 650,
          servings: 4,
          description: '簡単で美味しい定番カレー。野菜もたっぷり摂れます。'
        },
        {
          id: "2",
          name: '野菜炒め',
          difficulty: 'easy',
          cookingTime: "15分",
          ingredients: ['キャベツ 1/4個', '人参 1/2本', 'もやし 1袋', '醤油 大さじ2', 'ごま油 大さじ1'],
          instructions: [
            'キャベツを食べやすい大きさに切る',
            '人参を細切りにする',
            'フライパンにごま油を熱する',
            '硬い野菜から順に炒める',
            '醤油で味付けして完成'
          ],
          tags: ['ヘルシー', '時短', '野菜'],
          calories: 180,
          servings: 2,
          description: '栄養バランスの良い簡単料理。野菜不足解消にピッタリ。'
        },
        {
          id: "3",
          name: 'オムライス',
          difficulty: 'medium',
          cookingTime: "25分",
          ingredients: ['卵 3個', 'ご飯 2膳分', '玉ねぎ 1/2個', 'ケチャップ 大さじ3', 'バター 20g'],
          instructions: [
            '玉ねぎをみじん切りにする',
            'ご飯とケチャップを炒める',
            '卵を溶いて薄焼き卵を作る',
            'ケチャップライスを卵で包む',
            'お皿に盛り付けて完成'
          ],
          tags: ['洋食', '卵料理', '人気'],
          calories: 520,
          servings: 2,
          description: '子供も大人も大好きなオムライス。ふわふわ卵が決め手です。'
        },
        {
          id: "4",
          name: '豚の生姜焼き',
          difficulty: 'easy',
          cookingTime: "20分",
          ingredients: ['豚ロース薄切り 300g', '玉ねぎ 1個', '生姜 1片', '醤油 大さじ3', 'みりん 大さじ2'],
          instructions: [
            '豚肉に軽く塩コショウする',
            '玉ねぎをスライスする',
            '生姜をすりおろす',
            '豚肉を焼いて取り出す',
            '玉ねぎを炒めて調味料と豚肉を戻す'
          ],
          tags: ['和食', '定番', 'ご飯に合う'],
          calories: 420,
          servings: 3,
          description: '甘辛いタレがご飯によく合う人気の定番おかず。'
        }
      ];

      res.json({
        success: true,
        data: {
          suggestions: suggestions,
          mealTime: mealType,
          generatedAt: new Date().toISOString()
        },
        // 互換性のため
        suggestions: suggestions,
        filters: {
          mealType: mealType,
          difficulty: difficulty,
          ingredientsUsed: ingredients ? ingredients.split(',') : []
        }
      });
    } catch (error) {
      logger.error('Failed to get cooking suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cooking suggestions'
      });
    }
  }

  /**
   * 掃除スケジュール取得
   */
  async getCleaningSchedule(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      
      const tasks = [
        {
          id: "1",
          name: 'リビング掃除機',
          task: 'リビング掃除機', // 互換性
          frequency: 'daily',
          lastCompleted: Date.now() - (24 * 60 * 60 * 1000), // 1日前
          nextDue: '2025-09-06',
          priority: 'high',
          estimatedTime: 15,
          isCompleted: false,
          description: 'リビングの床に掃除機をかける',
          room: 'リビング'
        },
        {
          id: "2",
          name: 'お風呂掃除',
          task: 'お風呂掃除', // 互換性
          frequency: 'weekly',
          lastCompleted: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1週間前
          nextDue: '2025-09-08',
          priority: 'medium',
          estimatedTime: 30,
          isCompleted: false,
          description: '浴槽とタイルを掃除する',
          room: 'バスルーム'
        },
        {
          id: "3",
          name: '窓拭き',
          task: '窓拭き', // 互換性
          frequency: 'monthly',
          lastCompleted: Date.now() - (30 * 24 * 60 * 60 * 1000), // 1ヶ月前
          nextDue: '2025-09-15',
          priority: 'low',
          estimatedTime: 45,
          isCompleted: false,
          description: '全部屋の窓ガラスを拭く',
          room: '全室'
        },
        {
          id: "4", 
          name: 'キッチン清掃',
          task: 'キッチン清掃', // 互換性
          frequency: 'daily',
          lastCompleted: Date.now() - (12 * 60 * 60 * 1000), // 12時間前
          nextDue: '2025-09-06',
          priority: 'high',
          estimatedTime: 20,
          isCompleted: true,
          description: 'シンクとコンロ周りの清掃',
          room: 'キッチン'
        },
        {
          id: "5",
          name: 'トイレ掃除',
          task: 'トイレ掃除', // 互換性
          frequency: 'weekly',
          lastCompleted: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3日前
          nextDue: '2025-09-09',
          priority: 'medium',
          estimatedTime: 15,
          isCompleted: false,
          description: '便器と床の清掃',
          room: 'トイレ'
        }
      ];

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => task.isCompleted).length;
      const pendingTasks = totalTasks - completedTasks;
      const todayTasks = tasks.filter(task => {
        const today = new Date().toDateString();
        const taskDate = new Date(task.nextDue).toDateString();
        return taskDate === today;
      }).length;

      res.json({
        success: true,
        data: {
          tasks: tasks,
          weekOverview: `今週は${pendingTasks}件の掃除タスクが残っています`,
          lastUpdated: new Date().toISOString()
        },
        // 互換性のため
        schedule: tasks,
        summary: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          today: todayTasks
        }
      });
    } catch (error) {
      logger.error('Failed to get cleaning schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cleaning schedule'
      });
    }
  }

  /**
   * 家計管理・支出記録
   */
  async getExpenseTracking(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { month = new Date().toISOString().slice(0, 7) } = req.query;

      const records = [
        {
          id: "1",
          amount: 3500,
          category: '食費',
          description: 'スーパーで食材購入（野菜・肉・調味料）',
          date: '2025-09-05',
          paymentMethod: 'クレジットカード'
        },
        {
          id: "2",
          amount: 1200,
          category: '交通費',
          description: '電車賃（往復）',
          date: '2025-09-05',
          paymentMethod: '現金'
        },
        {
          id: "3",
          amount: 800,
          category: '日用品',
          description: 'シャンプー・石鹸・洗剤',
          date: '2025-09-04',
          paymentMethod: 'クレジットカード'
        },
        {
          id: "4",
          amount: 2800,
          category: '食費',
          description: 'コンビニ弁当・飲み物',
          date: '2025-09-04',
          paymentMethod: '電子マネー'
        },
        {
          id: "5",
          amount: 15000,
          category: '光熱費',
          description: '電気代（8月分）',
          date: '2025-09-03',
          paymentMethod: '口座振替'
        },
        {
          id: "6",
          amount: 5200,
          category: '医療費',
          description: '病院受診・薬代',
          date: '2025-09-02',
          paymentMethod: '現金'
        }
      ];

      const monthlyTotal = records.reduce((sum, record) => sum + record.amount, 0);
      
      const categoryBreakdown = {
        '食費': records.filter(r => r.category === '食費').reduce((sum, r) => sum + r.amount, 0),
        '交通費': records.filter(r => r.category === '交通費').reduce((sum, r) => sum + r.amount, 0),
        '日用品': records.filter(r => r.category === '日用品').reduce((sum, r) => sum + r.amount, 0),
        '光熱費': records.filter(r => r.category === '光熱費').reduce((sum, r) => sum + r.amount, 0),
        '医療費': records.filter(r => r.category === '医療費').reduce((sum, r) => sum + r.amount, 0)
      };

      res.json({
        success: true,
        data: {
          records: records,
          monthlyTotal: monthlyTotal,
          categoryBreakdown: categoryBreakdown,
          month: month
        },
        // 互換性のため
        expenses: records,
        summary: {
          totalExpense: monthlyTotal,
          categorySummary: categoryBreakdown
        },
        period: month
      });
    } catch (error) {
      logger.error('Failed to get expense tracking:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve expense data'
      });
    }
  }

  /**
   * 生活のアドバイス・ヒント
   */
  async getLifeTips(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { category = 'general' } = req.query;

      const comprehensiveTips = {
        health: [
          {
            id: 'health_001',
            title: '朝の水分補給',
            content: '起床後にコップ一杯の水を飲むことで、デトックス効果と新陳代謝の向上が期待できます。',
            category: 'health',
            priority: 'high',
            difficulty: 'easy',
            tags: ['健康', '朝活', '習慣']
          },
          {
            id: 'health_002',
            title: '7-8時間の睡眠確保',
            content: '質の良い睡眠は免疫力向上、記憶力アップ、ストレス軽減に効果的です。毎日同じ時間に就寝起床しましょう。',
            category: 'health',
            priority: 'high',
            difficulty: 'medium',
            tags: ['睡眠', '健康', 'ストレス軽減']
          },
          {
            id: 'health_003',
            title: '階段を使う習慣',
            content: 'エレベーターではなく階段を使うことで、日常的な運動量を自然に増やせます。',
            category: 'health',
            priority: 'medium',
            difficulty: 'easy',
            tags: ['運動', '習慣', '健康']
          }
        ],
        productivity: [
          {
            id: 'prod_001',
            title: 'ポモドーロテクニック',
            content: '25分集中 + 5分休憩のサイクルで、集中力を持続させながら効率的に作業できます。',
            category: 'productivity',
            priority: 'high',
            difficulty: 'easy',
            tags: ['集中力', '作業効率', 'テクニック']
          },
          {
            id: 'prod_002',
            title: '朝のTo-Doリスト作成',
            content: '一日の始まりに3つの重要タスクを決めることで、優先順位が明確になり生産性が向上します。',
            category: 'productivity',
            priority: 'high',
            difficulty: 'easy',
            tags: ['計画', '優先順位', '朝活']
          },
          {
            id: 'prod_003',
            title: 'デジタルデトックス時間',
            content: '就寝前1時間はスマホやPCを避けることで、睡眠の質が改善され翌日の集中力がアップします。',
            category: 'productivity',
            priority: 'medium',
            difficulty: 'medium',
            tags: ['デジタルデトックス', '睡眠', '集中力']
          }
        ],
        finance: [
          {
            id: 'finance_001',
            title: '家計簿アプリの活用',
            content: '支出を記録することで無駄遣いが可視化され、月3-5万円の節約も可能です。',
            category: 'finance',
            priority: 'high',
            difficulty: 'easy',
            tags: ['節約', '家計管理', 'アプリ活用']
          },
          {
            id: 'finance_002',
            title: '自動積立の設定',
            content: '給料日に自動で積立設定することで、無理なく貯金習慣が身につきます。',
            category: 'finance',
            priority: 'high',
            difficulty: 'easy',
            tags: ['貯金', '自動化', '資産形成']
          },
          {
            id: 'finance_003',
            title: '固定費の見直し',
            content: 'スマホプラン、保険、サブスクを年1回見直すことで、年間数万円の節約が可能です。',
            category: 'finance',
            priority: 'medium',
            difficulty: 'medium',
            tags: ['節約', '固定費', '見直し']
          }
        ],
        cleaning: [
          {
            id: 'clean_001',
            title: '毎日5分の片付けルール',
            content: '帰宅後5分間だけ片付けを行うことで、家が常にきれいな状態を保てます。',
            category: 'cleaning',
            priority: 'high',
            difficulty: 'easy',
            tags: ['片付け', '習慣', '時短']
          },
          {
            id: 'clean_002',
            title: '重曹とクエン酸活用法',
            content: '自然素材の重曹とクエン酸で、安全で効果的な掃除ができます。環境にも優しい方法です。',
            category: 'cleaning',
            priority: 'medium',
            difficulty: 'easy',
            tags: ['自然派掃除', 'エコ', '安全']
          },
          {
            id: 'clean_003',
            title: 'ながら掃除のススメ',
            content: 'テレビを見ながら、音楽を聞きながらの掃除で、ストレスなく家事ができます。',
            category: 'cleaning',
            priority: 'medium',
            difficulty: 'easy',
            tags: ['ながら作業', 'ストレス軽減', '効率化']
          }
        ],
        general: [
          {
            id: 'general_001',
            title: '感謝の習慣',
            content: '毎日3つの感謝できることを考えることで、ポジティブ思考が身につき幸福度が向上します。',
            category: 'general',
            priority: 'high',
            difficulty: 'easy',
            tags: ['メンタルヘルス', '習慣', 'ポジティブ思考']
          },
          {
            id: 'general_002',
            title: '新しいことへの挑戦',
            content: '月に1つ新しいことに挑戦することで、脳が活性化され創造性が向上します。',
            category: 'general',
            priority: 'medium',
            difficulty: 'medium',
            tags: ['挑戦', '創造性', '脳トレ']
          },
          {
            id: 'general_003',
            title: '深呼吸でリラックス',
            content: 'ストレスを感じたら4秒吸って、7秒止めて、8秒で吐く呼吸法でリラックスできます。',
            category: 'general',
            priority: 'high',
            difficulty: 'easy',
            tags: ['ストレス解消', 'リラックス', '呼吸法']
          }
        ]
      };

      // カテゴリーに基づいてヒントを選択
      const categoryTips = comprehensiveTips[category] || comprehensiveTips.general;
      const randomTip = categoryTips[Math.floor(Math.random() * categoryTips.length)];

      // その他のカテゴリーからもランダムにヒントを追加
      const allCategories = Object.keys(comprehensiveTips);
      const additionalTips = [];
      
      for (let i = 0; i < 2; i++) {
        const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
        const randomCategoryTips = comprehensiveTips[randomCategory];
        const additionalTip = randomCategoryTips[Math.floor(Math.random() * randomCategoryTips.length)];
        if (additionalTip.id !== randomTip.id) {
          additionalTips.push(additionalTip);
        }
      }

      res.json({
        success: true,
        data: {
          featured: randomTip,
          additional: additionalTips,
          categories: allCategories,
          totalTips: Object.values(comprehensiveTips).flat().length,
          dailyRecommendation: {
            date: new Date().toISOString().split('T')[0],
            tip: randomTip,
            motivation: 'small steps lead to big changes! 🌱'
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get life tips:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get life tips'
      });
    }
  }

  /**
   * AI駆動のスマート生活提案
   */
  async getSmartSuggestions(req, res) {
    try {
      const userId = req.user?.userId || 'dev_user';
      const { timeOfDay, weather, mood } = req.body;

      let suggestions = [];

      // 時間帯に応じた提案
      const hour = new Date().getHours();
      if (hour < 10) {
        suggestions.push({
          type: 'morning',
          title: '朝の準備',
          suggestion: '今日一日の計画を立ててみませんか？',
          action: 'schedule_planning'
        });
      } else if (hour < 14) {
        suggestions.push({
          type: 'lunch',
          title: 'ランチ提案',
          suggestion: '栄養バランスの良い昼食はいかがですか？',
          action: 'cooking_suggestion'
        });
      } else if (hour < 18) {
        suggestions.push({
          type: 'afternoon',
          title: '午後の活動',
          suggestion: '少し体を動かしてリフレッシュしませんか？',
          action: 'exercise_suggestion'
        });
      } else {
        suggestions.push({
          type: 'evening',
          title: '夕方の準備',
          suggestion: '明日の準備と今日の振り返りをしませんか？',
          action: 'reflection_planning'
        });
      }

      // 天気に応じた提案
      if (weather === 'rainy') {
        suggestions.push({
          type: 'weather',
          title: '雨の日活動',
          suggestion: '室内でできる整理整頓や読書はいかがですか？',
          action: 'indoor_activity'
        });
      }

      // 気分に応じた提案
      if (mood === 'stressed') {
        suggestions.push({
          type: 'wellness',
          title: 'リラックス',
          suggestion: '深呼吸や軽いストレッチでリラックスしませんか？',
          action: 'relaxation'
        });
      }

      res.json({
        success: true,
        suggestions: suggestions,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get smart suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get smart suggestions'
      });
    }
  }

  /**
   * 支出データの取得
   */
  async getExpenses(req, res) {
    try {
      const userId = req.params.userId || req.user?.userId || 'guest_user';
      const { startDate, endDate, category } = req.query;
      
      // ゲストユーザーの場合、データベースにユーザーを作成
      await this.ensureGuestUser(userId);
      
      const filter = { userId };
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }
      if (category) filter.category = category;
      
      const expenses = await Expense.find(filter).sort({ date: -1 });
      
      const monthlyTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const categoryTotals = await Expense.getCategoryTotals(userId, startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: {
          expenses: expenses,
          monthlyTotal: monthlyTotal,
          categoryTotals: categoryTotals.reduce((acc, cat) => {
            acc[cat._id] = cat.total;
            return acc;
          }, {})
        }
      });
      
    } catch (error) {
      logger.error('Error getting expenses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get expenses',
        details: error.message
      });
    }
  }

  /**
   * 支出の追加
   */
  async addExpense(req, res) {
    try {
      const userId = req.user?.userId || 'guest_user';
      const expenseData = req.body;
      
      // ゲストユーザーの場合、データベースにユーザーを作成
      await this.ensureGuestUser(userId);
      
      const expense = new Expense({
        ...expenseData,
        userId: userId
      });
      
      const savedExpense = await expense.save();
      logger.info('Expense added to database:', savedExpense);
      
      res.status(201).json({
        success: true,
        data: savedExpense,
        message: 'Expense added successfully'
      });
      
    } catch (error) {
      logger.error('Error adding expense:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add expense',
        details: error.message
      });
    }
  }

  /**
   * 支出の削除
   */
  async deleteExpense(req, res) {
    try {
      const expenseId = req.params.id;
      const userId = req.user?.userId || 'guest_user';
      
      const deletedExpense = await Expense.findOneAndDelete({ 
        _id: expenseId, 
        userId: userId 
      });
      
      if (!deletedExpense) {
        return res.status(404).json({
          success: false,
          error: 'Expense not found or not authorized'
        });
      }
      
      logger.info('Expense deleted from database:', { expenseId, userId });
      
      res.status(200).json({
        success: true,
        message: 'Expense deleted successfully'
      });
      
    } catch (error) {
      logger.error('Error deleting expense:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete expense',
        details: error.message
      });
    }
  }

  /**
   * ゲストユーザーの確保（存在しない場合は作成）
   */
  async ensureGuestUser(userId) {
    try {
      let user = await User.findOne({ userId });
      
      if (!user) {
        user = new User({
          userId: userId,
          email: `${userId}@guest.local`,
          displayName: 'ゲストユーザー',
          isGuest: true,
          provider: 'guest'
        });
        await user.save();
        logger.info('Guest user created:', userId);
      }
      
      return user;
    } catch (error) {
      logger.error('Error ensuring guest user:', error);
      throw error;
    }
  }
}

module.exports = LifeAssistantController;
