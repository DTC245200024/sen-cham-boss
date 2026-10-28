const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/adoptions - All listings (all authenticated users can view)
router.get('/', (req, res) => {
  try {
    let adoptions = db.find('adoptions', () => true);
    const canViewAll = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    
    // Non-staff only see approved/active posts or their own
    if (!canViewAll) {
      adoptions = adoptions.filter(a => 
        a.status === 'ĐANG_TÌM_CHỦ' || 
        a.status === 'ĐÃ_CÓ_NGƯỜI_NHẬN' || 
        a.user_id === req.user.id
      );
    }
    
    // Attach user info
    adoptions = adoptions.map(a => {
      const u = db.findById('users', a.user_id);
      return { ...a, owner_name: u ? u.full_name : 'Unknown', owner_avatar: u ? u.avatar : '' };
    }).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    
    return res.json({ success: true, adoptions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/adoptions - Create new listing
router.post('/', (req, res) => {
  try {
    const { pet_name, species, age, gender, image_url, health_status, description, area, contact_info, status } = req.body;
    
    if (!description && !image_url && !pet_name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung bài đăng hoặc chọn ảnh.' });
    }

    const newAdoption = db.insert('adoptions', {
      user_id: req.user.id,
      pet_name: (pet_name ? pet_name.trim() : 'Thú cưng cần tìm chủ'),
      species: (species ? species.trim() : 'Thú cưng'),
      age: age ? age.trim() : 'Chưa rõ',
      gender: gender || 'Chưa rõ',
      image_url: image_url || '',
      health_status: health_status ? health_status.trim() : 'Khỏe mạnh',
      description: (description || '').trim(),
      area: (area ? area.trim() : 'Toàn quốc'),
      contact_info: (contact_info ? contact_info.trim() : (req.user.phone || req.user.email || 'Liên hệ qua tin nhắn')),
      status: (status === 'ĐÃ_CÓ_NGƯỜI_NHẬN' ? 'ĐÃ_CÓ_NGƯỜI_NHẬN' : 'ĐANG_TÌM_CHỦ')
    });

    const u = db.findById('users', req.user.id);
    const enriched = {
      ...newAdoption,
      owner_name: u ? u.full_name : req.user.full_name,
      owner_avatar: u ? u.avatar : req.user.avatar
    };

    return res.status(201).json({ success: true, message: 'Đăng tin thành công!', adoption: enriched });
  } catch (err) {
    console.error('Create adoption error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng tin.' });
  }
});

// PUT /api/adoptions/:id - Edit listing (owner or admin)
router.put('/:id', (req, res) => {
  try {
    const adp = db.findById('adoptions', req.params.id);
    if (!adp) return res.status(404).json({ success: false, message: 'Không tìm thấy bài đăng.' });

    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && adp.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa bài này.' });
    }

    const { pet_name, species, age, gender, image_url, health_status, description, area, contact_info, status } = req.body;
    const updates = {};
    if (pet_name !== undefined) updates.pet_name = pet_name.trim();
    if (species !== undefined) updates.species = species.trim();
    if (age !== undefined) updates.age = age.trim();
    if (gender !== undefined) updates.gender = gender;
    if (image_url !== undefined) updates.image_url = image_url;
    if (health_status !== undefined) updates.health_status = health_status.trim();
    if (description !== undefined) updates.description = description.trim();
    if (area !== undefined) updates.area = area.trim();
    if (contact_info !== undefined) updates.contact_info = contact_info.trim();
    if (status !== undefined) updates.status = status;

    const updated = db.update('adoptions', req.params.id, updates);
    const u = db.findById('users', updated.user_id);
    const enriched = {
      ...updated,
      owner_name: u ? u.full_name : 'Unknown',
      owner_avatar: u ? u.avatar : ''
    };
    return res.json({ success: true, message: 'Cập nhật bài viết thành công.', adoption: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// PATCH /api/adoptions/:id/status - Update status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const adp = db.findById('adoptions', req.params.id);
    if (!adp) return res.status(404).json({ success: false, message: 'Không tìm thấy bài đăng.' });

    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && adp.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền thay đổi trạng thái.' });
    }

    const validStatuses = ['CHỜ_DUYỆT', 'ĐANG_TÌM_CHỦ', 'ĐÃ_CÓ_NGƯỜI_NHẬN', 'HOÀN_TẤT'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const updated = db.update('adoptions', req.params.id, { status });
    return res.json({ success: true, message: 'Cập nhật trạng thái thành công.', adoption: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// DELETE /api/adoptions/:id
router.delete('/:id', (req, res) => {
  try {
    const adp = db.findById('adoptions', req.params.id);
    if (!adp) return res.status(404).json({ success: false, message: 'Không tìm thấy bài đăng.' });

    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && adp.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa bài này.' });
    }

    db.delete('adoptions', req.params.id);
    return res.json({ success: true, message: 'Đã xóa bài đăng thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

module.exports = router;
