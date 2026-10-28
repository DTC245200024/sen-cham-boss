/* =========================================================
   USER PROFILE FRONTEND LOGIC - ENHANCED
   ========================================================= */

let profileEditMode = false;

function initProfileUI() {
  const avatarFileInput = document.getElementById('profile-avatar-file');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const cancelEditBtn = document.getElementById('profile-cancel-edit-btn');
  const profileForm = document.getElementById('profile-form');

  // Avatar change
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        showToast('Chỉ chấp nhận file ảnh JPG, PNG, WEBP.', 'error');
        avatarFileInput.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Kích thước ảnh tối đa là 5MB.', 'error');
        avatarFileInput.value = '';
        return;
      }

      // Show preview
      document.getElementById('profile-avatar-preview').src = URL.createObjectURL(file);

      try {
        const uploadData = await apiUpload(file);
      if (!uploadData || !uploadData.success || !uploadData.url) {
        showToast((uploadData && uploadData.message) || 'Lỗi khi upload ảnh.', 'error');
        return;
      }

        const updateRes = await apiRequest('/users/profile', 'PUT', { avatar: uploadData.url });
        if (updateRes.success) {
          showToast('Đã cập nhật ảnh đại diện!', 'success');
          window.currentUser = updateRes.user;
          localStorage.setItem('petcare_user', JSON.stringify(updateRes.user));
          // Update all avatar elements
          document.querySelectorAll('#user-avatar-img, #top-user-avatar').forEach(img => {
            img.src = updateRes.user.avatar;
          });
        } else {
          showToast(updateRes.message, 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi tải ảnh.', 'error');
      }
    });
  }

  // Toggle edit mode
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      setProfileEditMode(true);
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      setProfileEditMode(false);
      loadProfile(); // restore values
    });
  }

  // Save profile info
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        full_name: document.getElementById('profile-name').value.trim(),
        email: document.getElementById('profile-email')?.value.trim() || '',
        phone: document.getElementById('profile-phone')?.value.trim() || '',
        address: document.getElementById('profile-address')?.value.trim() || ''
      };

      if (!data.full_name) {
        showToast('Họ tên không được để trống.', 'error');
        return;
      }

      if (!data.email) {
        showToast('Email không được để trống.', 'error');
        return;
      }

      const res = await apiRequest('/users/profile', 'PUT', data);
      if (res.success) {
        showToast('Cập nhật hồ sơ thành công!', 'success');
        window.currentUser = res.user;
        localStorage.setItem('petcare_user', JSON.stringify(res.user));

        // Update sidebar & header name
        const nameEl = document.getElementById('user-name-txt');
        const topNameEl = document.getElementById('top-user-name');
        if (nameEl) nameEl.innerText = res.user.full_name;
        if (topNameEl) topNameEl.innerText = res.user.full_name;

        setProfileEditMode(false);
        loadProfile();
      } else {
        showToast(res.message, 'error');
      }
    });
  }

  // Toggle Change Password Card visibility
  const toggleChangePassBtn = document.getElementById('toggle-change-pass-btn');
  const closeChangePassBtn = document.getElementById('close-change-pass-btn');
  const changePasswordBox = document.getElementById('change-password-box');

  if (toggleChangePassBtn && changePasswordBox) {
    toggleChangePassBtn.addEventListener('click', () => {
      const isHidden = changePasswordBox.style.display === 'none' || !changePasswordBox.style.display;
      changePasswordBox.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        changePasswordBox.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('profile-current-pass')?.focus();
      }
    });
  }

  if (closeChangePassBtn && changePasswordBox) {
    closeChangePassBtn.addEventListener('click', () => {
      changePasswordBox.style.display = 'none';
      document.getElementById('change-password-form')?.reset();
    });
  }

  // Change Password Handler
  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const current_password = document.getElementById('profile-current-pass').value;
      const new_password = document.getElementById('profile-new-pass').value;
      const confirm_password = document.getElementById('profile-confirm-pass').value;

      if (!current_password) {
        showToast('Vui lòng nhập mật khẩu hiện tại.', 'error');
        return;
      }
      if (!new_password || new_password.length < 6) {
        showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
        return;
      }
      if (new_password !== confirm_password) {
        showToast('Mật khẩu xác nhận không khớp.', 'error');
        return;
      }

      const res = await apiRequest('/users/change-password', 'PUT', { current_password, new_password });
      if (res.success) {
        showToast(res.message, 'success');
        changePasswordForm.reset();
        if (changePasswordBox) changePasswordBox.style.display = 'none';
      } else {
        showToast(res.message, 'error');
      }
    });
  }
}

function setProfileEditMode(enabled) {
  profileEditMode = enabled;
  const fields = ['profile-name', 'profile-email', 'profile-phone', 'profile-address'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });

  const editBtn = document.getElementById('edit-profile-btn');
  const saveCancel = document.getElementById('profile-save-cancel');
  if (editBtn) editBtn.style.display = enabled ? 'none' : 'inline-flex';
  if (saveCancel) saveCancel.style.display = enabled ? 'flex' : 'none';
}

async function loadProfile() {
  const res = await apiRequest('/auth/me');
  if (!res.success || !res.user) {
    showToast('Lỗi khi tải thông tin hồ sơ.', 'error');
    return;
  }

  const user = res.user;
  window.currentUser = user;

  // Avatar
  const avatarPreview = document.getElementById('profile-avatar-preview');
  if (avatarPreview) avatarPreview.src = user.avatar || '/placeholder.png';

  // Display info
  const nameDisplay = document.getElementById('profile-name-display');
  const roleDisplay = document.getElementById('profile-role-display');
  if (nameDisplay) nameDisplay.innerText = user.full_name;
  if (roleDisplay) {
    const roleLabels = { ADMIN: ' Quản trị viên', STORE_MANAGER: ' Quản lý cửa hàng', RECEPTIONIST: '️ Lễ tân', CARE_STAFF: '<i class="fa-solid fa-paw"></i> Nhân viên chăm sóc', USER: '<i class="fa-solid fa-user"></i> Chủ nuôi' };
    roleDisplay.innerText = roleLabels[user.role] || user.role;
  }

  // Form fields
  const nameField = document.getElementById('profile-name');
  const emailField = document.getElementById('profile-email');
  const phoneField = document.getElementById('profile-phone');
  const addressField = document.getElementById('profile-address');
  const joinedField = document.getElementById('profile-joined');

  if (nameField) nameField.value = user.full_name || '';
  if (emailField) emailField.value = user.email || '';
  if (phoneField) phoneField.value = user.phone || '';
  if (addressField) addressField.value = user.address || '';
  if (joinedField) joinedField.value = user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'N/A';

  // Reset to view mode
  setProfileEditMode(false);
  const changePasswordBox = document.getElementById('change-password-box');
  if (changePasswordBox) changePasswordBox.style.display = 'none';

  // Show/hide admin-specific stats section
  const profileStats = document.getElementById('profile-stats-section');
  if (profileStats) {
    if (user.role === 'ADMIN') {
      const userCount = '—'; // will be fetched separately
      profileStats.style.display = 'block';
    } else {
      profileStats.style.display = 'none';
    }
  }
}

window.initProfileUI = initProfileUI;
window.loadProfile = loadProfile;
