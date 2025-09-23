const express = require('express');
const router = express.Router();
const StudyController = require('../controllers/study-controller');
const controller = new StudyController();

// Normalization middleware for legacy clients: ensure req.body exists and map older fields
function normalizeStudyPayload(req, res, next) {
	try {
		if (!req.body) req.body = {};
		// estimatedDuration -> targetDuration
		if (typeof req.body.estimatedDuration !== 'undefined' && typeof req.body.targetDuration === 'undefined') {
			req.body.targetDuration = req.body.estimatedDuration;
		}
		// goal -> goals (as array)
		if (typeof req.body.goal !== 'undefined' && typeof req.body.goals === 'undefined') {
			req.body.goals = [req.body.goal];
		}
		// legacy session id field
		if (typeof req.body.session_id !== 'undefined' && typeof req.body.sessionId === 'undefined') {
			req.body.sessionId = req.body.session_id;
		}
	} catch (e) { /* ignore */ }
	next();
}

// Compatibility forwarding endpoints for legacy clients (no auth here; global auth applied by app)
router.post('/analyze', normalizeStudyPayload, (req, res) => controller.analyzeStudyMaterial(req, res));
router.post('/progress', normalizeStudyPayload, (req, res) => controller.recordStudyProgress(req, res));
router.get('/sessions', (req, res) => controller.getStudySessions(req, res));
router.post('/sessions/start', normalizeStudyPayload, (req, res) => controller.startStudySession(req, res));
router.post('/sessions/end', normalizeStudyPayload, (req, res) => controller.endStudySession(req, res));
router.get('/stats', (req, res) => controller.getStudyStats(req, res));
router.get('/advice', (req, res) => controller.getStudyAdvice(req, res));

// Legacy short routes used by older clients
router.post('/start', normalizeStudyPayload, (req, res) => controller.startStudySession(req, res));
router.post('/end', normalizeStudyPayload, (req, res) => controller.endStudySession(req, res));

module.exports = router;
