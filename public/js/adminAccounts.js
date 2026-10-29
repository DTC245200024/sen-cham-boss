/* =========================================================
   ADMIN ACCOUNTS & RBAC MANAGEMENT
   Sen Chăm Boss - Quản trị tài khoản & phân quyền
   ========================================================= */

(function() {
  let accountsState = {
    list: [],
    stats: {},
    filterRole: 'ALL',
    filterStatus: 'ALL',
    searchQuery: '',
    loading: false
  };

  function getRoleBadge(role) {
    const upper = String(role || '').toUpperCase();
    switch (upper) {
      case 'ADMIN':
        return '<span class="badge badge-danger" style="font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Admin (Quản lý hệ thống)</span>';
      case 'RECEPTIONIST':
        return '<span class="badge badge-warning" style="font-weight:700;"><i class="fa-solid fa-headset"></i> Lễ tân</span>';
      case 'CARE_STAFF':
        return '<span class="badge badge-info" style="font-weight:700;"><i class="fa-solid fa-user-doctor"></i> Nhân viên chăm sóc</span>';
      case 'USER':
      case 'OWNER':
      default:
        return '<span class="badge badge-secondary" style="font-weight:700;"><i class="fa-solid fa-paw"></i> Chủ nuôi</span>';
    }
  }

  function getStatusBadge(status) {
    const upper = String(status || 'ACTIVE').toUpperCase();
    if (upper === 'LOCKED') {
      return '<span class="badge badge-danger" style="font-size:11px;"><i class="fa-solid fa-lock"></i> Đã khóa</span>';
    }
    return '<span class="badge badge-success" style="font-size:11px;"><i class="fa-solid fa-check-circle"></i> Đang hoạt động</span>';
  }

  async function loadAdminAccounts() {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    if (currentUser.role !== 'ADMIN') {
      return;
    }

    const tableBody = document.getElementById('admin-accounts-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: var(--primary); margin-bottom: 8px;"></i>
            <div>Đang tải danh sách tài khoản...</div>
          </td>
        </tr>
      `;
    }

    accountsState.loading = true;
    try {
      const queryParams = new URLSearchParams();
      if (accountsState.filterRole && accountsState.filterRole !== 'ALL') {
        queryParams.set('role', accountsState.filterRole);
      }
      if (accountsState.filterStatus && accountsState.filterStatus !== 'ALL') {
        queryParams.set('status', accountsState.filterStatus);
      }
      if (accountsState.searchQuery) {
        queryParams.set('search', accountsState.searchQuery);
      }

      const res = await apiRequest(`/users/accounts?${queryParams.toString()}`);
      if (res && res.success) {
        accountsState.list = res.accounts || [];
        accountsState.stats = res.stats || {};
        renderStats();
        renderAccountsTable();
      } else {
        if (tableBody) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align:center; padding: 30px; color: var(--danger);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 8px;"></i>
                <div>${(res && res.message) || 'Không thể tải danh sách tài khoản'}</div>
              </td>
            </tr>
          `;
        }
      }
    } catch (err) {
      console.error('loadAdminAccounts error:', err);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 30px; color: var(--danger);">
              <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 8px;"></i>
              <div>Lỗi kết nối khi tải danh sách tài khoản</div>
            </td>
          </tr>
        `;
      }
    } finally {
      accountsState.loading = false;
    }
  }

  function renderStats() {
    const s = accountsState.stats || {};
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val !== undefined ? val : 0;
    };
    setEl('stat-acc-total', s.total);
    setEl('stat-acc-admin', s.admin);
    setEl('stat-acc-rec', s.receptionist);
    setEl('stat-acc-staff', s.care_staff);
    setEl('stat-acc-user', s.user);
    setEl('stat-acc-active', s.active);
    setEl('stat-acc-locked', s.locked);
  }

  function renderAccountsTable() {
    const tableBody = document.getElementById('admin-accounts-table-body');
    if (!tableBody) return;

    if (!accountsState.list || accountsState.list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-user-slash" style="font-size: 32px; color: #cbd5e1; margin-bottom: 12px; display:block;"></i>
            <div style="font-size: 15px; font-weight: 600;">Không tìm thấy tài khoản phù hợp</div>
            <div style="font-size: 13px; margin-top: 4px;">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</div>
          </td>
        </tr>
      `;
      return;
    }

    const currentUserId = (window.currentUser && window.currentUser.id) || '';

    tableBody.innerHTML = accountsState.list.map((u, idx) => {
      const avatarSrc = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.full_name || u.email || 'user')}`;
      const isLocked = (u.status || 'ACTIVE').toUpperCase() === 'LOCKED';
      const isSelf = u.id === currentUserId;
      const createdAtStr = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'Mặc định';

      return `
        <tr style="${isLocked ? 'background:#fef2f2;' : ''}">
          <td style="text-align:center; color:var(--text-muted); font-size:12px; width:40px;">${idx + 1}</td>
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="${avatarSrc}" alt="Avatar" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--border); flex-shrink:0;">
              <div>
                <div style="font-weight:700; color:var(--text-main); font-size:14px; display:flex; align-items:center; gap:6px;">
                  ${escapeHtml(u.full_name || 'Chưa cập nhật')}
                  ${isSelf ? '<span class="badge badge-info" style="font-size:10px; padding:2px 6px;">Tôi</span>' : ''}
                </div>
                <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(u.email || '')}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:13px; color:var(--text-main); font-weight:600;">
              ${u.phone ? `<i class="fa-solid fa-phone" style="font-size:11px; color:var(--text-muted); margin-right:4px;"></i>${escapeHtml(u.phone)}` : '<span style="color:var(--text-muted); font-style:italic;">Chưa có SĐT</span>'}
            </div>
            ${u.address ? `<div style="font-size:11.5px; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(u.address)}"><i class="fa-solid fa-location-dot" style="font-size:10px; margin-right:4px;"></i>${escapeHtml(u.address)}</div>` : ''}
          </td>
          <td style="text-align:center;">
            ${getRoleBadge(u.role)}
          </td>
          <td style="text-align:center; font-size:12.5px;">
            <div style="display:inline-flex; gap:8px;">
              <span class="badge badge-secondary" title="Số thú cưng"><i class="fa-solid fa-paw"></i> ${u.pet_count || 0}</span>
              <span class="badge badge-secondary" title="Số lịch hẹn liên quan"><i class="fa-solid fa-calendar"></i> ${u.appointment_count || 0}</span>
            </div>
          </td>
          <td style="text-align:center;">
            ${getStatusBadge(u.status)}
          </td>
          <td style="text-align:center; white-space:nowrap;">
            <div style="display:inline-flex; gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="openAdminAccountModal('${u.id}')" title="Chỉnh sửa thông tin & đổi vai trò">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              ${isSelf ? '' : `
                <button class="btn btn-sm ${isLocked ? 'btn-success' : 'btn-danger'}" onclick="toggleAccountLockStatus('${u.id}', '${u.status || 'ACTIVE'}', '${escapeHtml(u.full_name || u.email)}', '${u.role}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}">
                  <i class="fa-solid ${isLocked ? 'fa-lock-open' : 'fa-lock'}"></i>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.openAdminAccountModal = function(userId) {
    const modal = document.getElementById('modal-admin-account');
    if (!modal) return;

    const titleEl = document.getElementById('modal-admin-account-title');
    const form = document.getElementById('admin-account-form');
    if (form) form.reset();

    const idInput = document.getElementById('admin-acc-id');
    const nameInput = document.getElementById('admin-acc-name');
    const emailInput = document.getElementById('admin-acc-email');
    const passInput = document.getElementById('admin-acc-password');
    const passHelp = document.getElementById('admin-acc-pass-help');
    const phoneInput = document.getElementById('admin-acc-phone');
    const addressInput = document.getElementById('admin-acc-address');
    const roleSelect = document.getElementById('admin-acc-role');
    const statusSelect = document.getElementById('admin-acc-status');
    const statusRow = document.getElementById('admin-acc-status-row');

    if (userId) {
      const acc = accountsState.list.find(a => a.id === userId);
      if (!acc) {
        showToast('Không tìm thấy tài khoản cần chỉnh sửa.', 'error');
        return;
      }

      if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-pen" style="color:var(--primary);"></i> Chỉnh Sửa Tài Khoản';
      if (idInput) idInput.value = acc.id;
      if (nameInput) nameInput.value = acc.full_name || '';
      if (emailInput) emailInput.value = acc.email || '';
      if (phoneInput) phoneInput.value = acc.phone || '';
      if (addressInput) addressInput.value = acc.address || '';
      if (roleSelect) roleSelect.value = acc.role || 'USER';
      if (statusSelect) statusSelect.value = (acc.status || 'ACTIVE').toUpperCase();
      if (statusRow) statusRow.style.display = 'block';

      if (passInput) {
        passInput.value = '';
        passInput.required = false;
        passInput.placeholder = 'Để trống nếu giữ nguyên mật khẩu cũ';
      }
      if (passHelp) {
        passHelp.innerText = 'Chỉ nhập nếu bạn muốn đặt lại mật khẩu mới cho tài khoản này (tối thiểu 6 ký tự).';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-plus" style="color:var(--primary);"></i> Thêm Tài Khoản Mới';
      if (idInput) idInput.value = '';
      if (statusRow) statusRow.style.display = 'none';
      if (statusSelect) statusSelect.value = 'ACTIVE';

      if (roleSelect) {
        roleSelect.value = (accountsState.filterRole && accountsState.filterRole !== 'ALL') ? accountsState.filterRole : 'USER';
      }

      if (passInput) {
        passInput.value = '';
        passInput.required = true;
        passInput.placeholder = 'Nhập mật khẩu (tối thiểu 6 ký tự)';
      }
      if (passHelp) {
        passHelp.innerText = 'Bắt buộc khi tạo mới tài khoản (tối thiểu 6 ký tự).';
      }
    }

    modal.style.display = 'flex';
  };

  window.handleSaveAdminAccount = async function(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('admin-acc-id')?.value;
    const full_name = document.getElementById('admin-acc-name')?.value?.trim();
    const email = document.getElementById('admin-acc-email')?.value?.trim();
    const password = document.getElementById('admin-acc-password')?.value;
    const phone = document.getElementById('admin-acc-phone')?.value?.trim() || '';
    const address = document.getElementById('admin-acc-address')?.value?.trim() || '';
    const role = document.getElementById('admin-acc-role')?.value || 'USER';
    const status = document.getElementById('admin-acc-status')?.value || 'ACTIVE';

    if (!full_name || !email) {
      showToast('Vui lòng nhập Họ tên và Email.', 'error');
      return;
    }

    if (!id && (!password || password.length < 6)) {
      showToast('Mật khẩu bắt buộc có tối thiểu 6 ký tự khi tạo mới.', 'error');
      return;
    }

    if (id && password && password.length < 6) {
      showToast('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'error');
      return;
    }

    const payload = {
      full_name,
      email,
      phone,
      address,
      role
    };

    if (password) payload.password = password;
    if (id) payload.status = status;

    const saveBtn = document.getElementById('btn-save-admin-acc');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    try {
      let res;
      if (id) {
        res = await apiRequest(`/users/accounts/${id}`, 'PUT', payload);
      } else {
        res = await apiRequest('/users/accounts', 'POST', payload);
      }

      if (res && res.success) {
        showToast(res.message || 'Lưu tài khoản thành công!', 'success');
        closeModal('modal-admin-account');
        loadAdminAccounts();
      } else {
        showToast((res && res.message) || 'Có lỗi xảy ra khi lưu tài khoản.', 'error');
      }
    } catch (err) {
      console.error('handleSaveAdminAccount error:', err);
      showToast('Lỗi kết nối máy chủ khi lưu tài khoản.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu Tài Khoản';
      }
    }
  };

  window.toggleAccountLockStatus = async function(userId, currentStatus, userName, userRole) {
    const isLocked = (currentStatus || 'ACTIVE').toUpperCase() === 'LOCKED';
    const nextStatus = isLocked ? 'ACTIVE' : 'LOCKED';
    const actionText = isLocked ? 'MỞ KHÓA' : 'TẠM KHÓA';

    if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản của "${userName}" không?`)) {
      return;
    }

    try {
      const res = await apiRequest(`/users/accounts/${userId}`, 'PUT', { status: nextStatus });
      if (res && res.success) {
        showToast(`${isLocked ? 'Mở khóa' : 'Khóa'} tài khoản thành công!`, 'success');
        loadAdminAccounts();
      } else {
        showToast((res && res.message) || 'Không thể thay đổi trạng thái tài khoản.', 'error');
      }
    } catch (err) {
      console.error('toggleAccountLockStatus error:', err);
      showToast('Lỗi kết nối máy chủ.', 'error');
    }
  };

  window.setAdminAccountsRoleFilter = function(role, btnElement) {
    accountsState.filterRole = role || 'ALL';
    document.querySelectorAll('.acc-role-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    loadAdminAccounts();
  };

  window.setAdminAccountsStatusFilter = function(status, btnElement) {
    accountsState.filterStatus = status || 'ALL';
    document.querySelectorAll('.acc-status-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    loadAdminAccounts();
  };

  let searchTimeout = null;
  window.onAdminAccountSearchInput = function(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      accountsState.searchQuery = (query || '').trim();
      loadAdminAccounts();
    }, 350);
  };

  // Expose to window
  window.loadAdminAccounts = loadAdminAccounts;
})();
