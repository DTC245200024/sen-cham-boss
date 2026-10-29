const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

const DEFAULT_CONFIG = {
  id: 'cfg_1',
  facility_name: 'Trung Tâm Chăm Sóc Thú Cưng Sen Chăm Boss',
  address: 'Số 123 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
  hotline: '1900 8888',
  email: 'hotro@senchamboss.vn',
  operating_hours: '07:30 - 21:00 (Thứ 2 - Chủ Nhật)',
  emergency_contact: '0987 654 321 (Cấp cứu 24/7)',
  notification_banner: 'Hệ thống Sen Chăm Boss sẵn sàng phục vụ các Boss yêu quý!',
  banner_active: true,
  shipping_fee: 30000,
  bank_id: 'vcb',
  bank_name: 'Vietcombank',
  bank_account: '1234567890',
  bank_holder: 'SEN CHAM BOSS',
  bank_branch: 'Chi nhánh TP.HCM',
  enable_ai_reminders: true,
  auto_confirm_schedules: true
};

function getEffectiveConfig() {
  if (!db.data.store_config) {
    db.data.store_config = [];
  }
  if (db.data.store_config.length === 0) {
    db.data.store_config.push({ ...DEFAULT_CONFIG });
    db.saveSync();
  }
  return { ...DEFAULT_CONFIG, ...db.data.store_config[0] };
}

// GET /api/system-settings - Read settings (Admin or Staff)
router.get('/', (req, res) => {
  try {
    const config = getEffectiveConfig();
    return res.json({ success: true, config });
  } catch (err) {
    console.error('Get system settings error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy cấu hình hệ thống.' });
  }
});

// PUT /api/system-settings - Update settings (Admin only)
router.put('/', requireAdmin, (req, res) => {
  try {
    const currentConfig = getEffectiveConfig();
    const {
      facility_name,
      address,
      hotline,
      email,
      operating_hours,
      emergency_contact,
      notification_banner,
      banner_active,
      bank_name,
      bank_account,
      bank_holder,
      bank_branch,
      shipping_fee,
      enable_ai_reminders,
      auto_confirm_schedules
    } = req.body;

    const updated = {
      ...currentConfig,
      facility_name: facility_name !== undefined ? String(facility_name).trim() : currentConfig.facility_name,
      address: address !== undefined ? String(address).trim() : currentConfig.address,
      hotline: hotline !== undefined ? String(hotline).trim() : currentConfig.hotline,
      email: email !== undefined ? String(email).trim() : currentConfig.email,
      operating_hours: operating_hours !== undefined ? String(operating_hours).trim() : currentConfig.operating_hours,
      emergency_contact: emergency_contact !== undefined ? String(emergency_contact).trim() : currentConfig.emergency_contact,
      notification_banner: notification_banner !== undefined ? String(notification_banner).trim() : currentConfig.notification_banner,
      banner_active: banner_active !== undefined ? Boolean(banner_active) : currentConfig.banner_active,
      bank_name: bank_name !== undefined ? String(bank_name).trim() : currentConfig.bank_name,
      bank_account: bank_account !== undefined ? String(bank_account).trim() : currentConfig.bank_account,
      bank_holder: bank_holder !== undefined ? String(bank_holder).trim().toUpperCase() : currentConfig.bank_holder,
      bank_branch: bank_branch !== undefined ? String(bank_branch).trim() : currentConfig.bank_branch,
      shipping_fee: shipping_fee !== undefined ? (parseFloat(shipping_fee) || 0) : currentConfig.shipping_fee,
      enable_ai_reminders: enable_ai_reminders !== undefined ? Boolean(enable_ai_reminders) : currentConfig.enable_ai_reminders,
      auto_confirm_schedules: auto_confirm_schedules !== undefined ? Boolean(auto_confirm_schedules) : currentConfig.auto_confirm_schedules,
      updated_at: new Date().toISOString(),
      updated_by: req.user ? (req.user.full_name || req.user.email) : 'ADMIN'
    };

    db.data.store_config[0] = updated;
    db.saveSync();

    return res.json({
      success: true,
      message: 'Cập nhật cấu hình hệ thống thành công!',
      config: updated
    });
  } catch (err) {
    console.error('Update system settings error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu cấu hình hệ thống.' });
  }
});

module.exports = router;
