const express = require('express');
const router = express.Router();
const LifeAssistantController = require('../controllers/life-assistant-controller');
const controller = new LifeAssistantController();

// Forwarding compatibility endpoints
router.get('/shopping', (req, res) => controller.getShoppingList(req, res));
router.post('/shopping', (req, res) => controller.addShoppingItem(req, res));
router.get('/cooking', (req, res) => controller.getCookingSuggestions(req, res));
router.get('/cleaning', (req, res) => controller.getCleaningSchedule(req, res));
router.get('/expenses', (req, res) => controller.getExpenseTracking(req, res));
router.get('/tips', (req, res) => controller.getLifeTips(req, res));
router.post('/smart-suggestions', (req, res) => controller.getSmartSuggestions(req, res));

module.exports = router;
