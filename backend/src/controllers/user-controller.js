/**
 * User Controller (mock)
 */

const users = new Map();

// seed one user
users.set('user_001', {
  id: 'user_001',
  preferences: { voice: 'meimei', style: 'friendly' },
  stats: { sessions: 12, tokens: 34567 }
});

const getProfile = async (req, res) => {
  const id = req.params.id;
  if (!users.has(id)) return res.status(404).json({ error: true, message: 'user not found' });
  res.json(users.get(id));
};

const listVoices = async (req, res) => {
  const voices = [
    { id: 'meimei', lang: 'ja-JP', gender: 'female', sampleRate: 24000, styles: ['neutral', 'cheerful'] },
    { id: 'kaito', lang: 'ja-JP', gender: 'male', sampleRate: 24000, styles: ['neutral', 'calm'] }
  ];
  res.json(voices);
};

module.exports = { getProfile, listVoices };
