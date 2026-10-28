const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { checkAndGenerateNotifications } = require('../utils/notificationManager');

router.use(authenticateToken);

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    checkAndGenerateNotifications(req.user.id);
    const notifs = db.find('notifications', (n) => n.user_id === req.user.id);
    notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const unreadCount = notifs.filter((n) => !n.is_read).length;

    return res.json({ success: true, unreadCount, notifications: notifs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông báo.' });
  }
});

// PATCH /api/notifications/read-all - Mark all user notifications as read
router.patch('/read-all', (req, res) => {
  try {
    const notifs = db.find('notifications', (n) => n.user_id === req.user.id && !n.is_read);
    notifs.forEach((n) => {
      db.update('notifications', n.id, { is_read: true });
    });
    return res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thông báo.' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch('/:id/read', (req, res) => {
  try {
    const notif = db.findById('notifications', req.params.id);
    if (notif && notif.user_id === req.user.id) {
      db.update('notifications', notif.id, { is_read: true });
    }
    return res.json({ success: true, message: 'Đã đánh dấu đã đọc.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thông báo.' });
  }
});

// PATCH /api/notifications/read-category/:category - Mark category notifications as read
router.patch('/read-category/:category', (req, res) => {
  try {
    const category = req.params.category;
    const notifs = db.find('notifications', n => n.user_id === req.user.id && !n.is_read);

    notifs.forEach(n => {
      const t = (n.type || '').toUpperCase();
      const title = (n.title || '').toLowerCase();
      const msg = (n.message || '').toLowerCase();
      let match = false;

      if (category === 'appointments' && (t === 'APPOINTMENT' || title.includes('lịch khám') || msg.includes('lịch khám'))) match = true;
      if (category === 'schedules' && (t === 'OVERDUE' || t === 'UPCOMING' || title.includes('lịch quá hạn') || title.includes('lịch sắp đến') || msg.includes('công việc'))) match = true;
      if (category === 'health' && (t.includes('VACCINE') || t.includes('DEWORM') || t === 'HEALTH' || title.includes('tiêm vắc xin') || title.includes('tẩy giun') || title.includes('sức khỏe') || msg.includes('kết quả khám'))) match = true;
      if (category === 'adoptions' && (t === 'ADOPTION' || title.includes('nhận nuôi') || title.includes('cứu trợ'))) match = true;
      if ((category === 'store-orders' || category === 'admin-orders') && (t === 'ORDER' || t === 'STORE' || title.includes('đơn hàng'))) match = true;

      if (match) {
        db.update('notifications', n.id, { is_read: true });
      }
    });

    return res.json({ success: true, message: `Đã đọc thông báo thuộc danh mục ${category}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thông báo.' });
  }
});

module.exports = router;
