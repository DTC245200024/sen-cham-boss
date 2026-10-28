const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/search?q=query
router.get('/', (req, res) => {
  try {
    const q = req.query.q || '';
    const userId = req.user.id;
    const isUserAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

    if (!q.trim()) {
      return res.json({ success: true, results: [] });
    }

    const queryLower = q.toLowerCase();

    // Filter by ownership
    const myPets = isUserAdmin ? db.find('pets', () => true) : db.find('pets', p => p.user_id === userId);
    const mySchedules = isUserAdmin ? db.find('care_schedules', () => true) : db.find('care_schedules', s => s.user_id === userId);

    const results = [];

    // Search Pets
    myPets.forEach(p => {
      if (p.name.toLowerCase().includes(queryLower) || (p.breed && p.breed.toLowerCase().includes(queryLower))) {
        results.push({
          id: p.id,
          type: 'pet',
          title: `Thú cưng: ${p.name}`,
          subtitle: `${p.species} - ${p.breed || 'Không rõ giống'}`,
          link: 'pets'
        });
      }
    });

    // Search Schedules
    mySchedules.forEach(s => {
      if (s.task_name.toLowerCase().includes(queryLower)) {
        const pet = myPets.find(p => p.id === s.pet_id);
        results.push({
          id: s.id,
          type: 'schedule',
          title: `Lịch chăm sóc: ${s.task_name}`,
          subtitle: `Cho ${pet ? pet.name : 'Không rõ'} vào ${s.date} ${s.time}`,
          link: 'schedules'
        });
      }
    });

    return res.json({ success: true, results });
  } catch (err) {
    console.error('Search API error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tìm kiếm.' });
  }
});

module.exports = router;
