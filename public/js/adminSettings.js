/* =========================================================
   ADMIN SYSTEM SETTINGS LOGIC
   Sen Chăm Boss - Cấu hình hệ thống & cơ sở chăm sóc
   ========================================================= */

(function() {
  let currentConfig = null;

  async function loadAdminSettings() {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    if (currentUser.role !== 'ADMIN') {
      return;
    }

    const form = document.getElementById('admin-settings-form');
    if (!form) return;

    try {
      const res = await apiRequest('/system-settings');
      if (res && res.success && res.config) {
        currentConfig = res.config;
        populateSettingsForm(res.config);
      }
    } catch (err) {
      console.error('loadAdminSettings error:', err);
      showToast('Không thể tải cấu hình hệ thống từ máy chủ.', 'error');
    }
  }

  function populateSettingsForm(cfg) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };

    setVal('cfg-facility-name', cfg.facility_name);
    setVal('cfg-address', cfg.address);
    setVal('cfg-hotline', cfg.hotline);
    setVal('cfg-email', cfg.email);
    setVal('cfg-operating-hours', cfg.operating_hours);
    setVal('cfg-emergency-contact', cfg.emergency_contact);
    setVal('cfg-notification-banner', cfg.notification_banner);
    setChecked('cfg-banner-active', cfg.banner_active);

    setVal('cfg-bank-name', cfg.bank_name);
    setVal('cfg-bank-account', cfg.bank_account);
    setVal('cfg-bank-holder', cfg.bank_holder);
    setVal('cfg-bank-branch', cfg.bank_branch);
    setVal('cfg-shipping-fee', cfg.shipping_fee || 0);

    setChecked('cfg-enable-ai-reminders', cfg.enable_ai_reminders !== false);
    setChecked('cfg-auto-confirm-schedules', cfg.auto_confirm_schedules !== false);

    const updateMeta = document.getElementById('cfg-last-updated-meta');
    if (updateMeta && cfg.updated_at) {
      const dateStr = new Date(cfg.updated_at).toLocaleString('vi-VN');
      updateMeta.innerText = `Cập nhật lần cuối: ${dateStr} (bởi ${cfg.updated_by || 'Admin'})`;
    }
  }

  async function handleSaveSettings(e) {
    if (e && e.preventDefault) e.preventDefault();

    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu cấu hình...';
    }

    const payload = {
      facility_name: document.getElementById('cfg-facility-name')?.value?.trim(),
      address: document.getElementById('cfg-address')?.value?.trim(),
      hotline: document.getElementById('cfg-hotline')?.value?.trim(),
      email: document.getElementById('cfg-email')?.value?.trim(),
      operating_hours: document.getElementById('cfg-operating-hours')?.value?.trim(),
      emergency_contact: document.getElementById('cfg-emergency-contact')?.value?.trim(),
      notification_banner: document.getElementById('cfg-notification-banner')?.value?.trim(),
      banner_active: Boolean(document.getElementById('cfg-banner-active')?.checked),

      bank_name: document.getElementById('cfg-bank-name')?.value?.trim(),
      bank_account: document.getElementById('cfg-bank-account')?.value?.trim(),
      bank_holder: document.getElementById('cfg-bank-holder')?.value?.trim(),
      bank_branch: document.getElementById('cfg-bank-branch')?.value?.trim(),
      shipping_fee: parseFloat(document.getElementById('cfg-shipping-fee')?.value) || 0,

      enable_ai_reminders: Boolean(document.getElementById('cfg-enable-ai-reminders')?.checked),
      auto_confirm_schedules: Boolean(document.getElementById('cfg-auto-confirm-schedules')?.checked)
    };

    try {
      const res = await apiRequest('/system-settings', 'PUT', payload);
      if (res && res.success) {
        currentConfig = res.config;
        populateSettingsForm(res.config);
        showToast(res.message || 'Lưu cấu hình hệ thống thành công!', 'success');
      } else {
        showToast((res && res.message) || 'Lỗi khi lưu cấu hình.', 'error');
      }
    } catch (err) {
      console.error('handleSaveSettings error:', err);
      showToast('Lỗi kết nối máy chủ khi lưu cấu hình.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Cấu Hình Hệ Thống';
      }
    }
  }

  window.loadAdminSettings = loadAdminSettings;
  window.handleSaveSettings = handleSaveSettings;
})();
