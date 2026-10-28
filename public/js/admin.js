/* =========================================================
   ADMIN MANAGEMENT LOGIC
   User Management & All Pets Control (4 Roles)
   ========================================================= */

function initAdminUI() {
  const openAddUserBtn = document.getElementById('open-add-user-btn');
  const adminUserForm = document.getElementById('admin-user-form');
  const adminPetSearch = document.getElementById('admin-pet-search');
  const userAvatarFile = document.getElementById('admin-user-avatar-file');
  const userAvatarPreview = document.getElementById('admin-user-avatar-preview');
  const roleStatusRow = document.getElementById('admin-user-role-status-row');

  const staffAvatarFile = document.getElementById('admin-staff-avatar-file');
  const staffAvatarPreview = document.getElementById('admin-staff-avatar-preview');
  const adminStaffForm = document.getElementById('admin-staff-form');

  if (staffAvatarFile) {
    staffAvatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        staffAvatarPreview.src = URL.createObjectURL(file);
        staffAvatarPreview.style.display = 'block';
      } else {
        staffAvatarPreview.style.display = 'none';
      }
    });
  }

  if (adminStaffForm) {
    adminStaffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
      if (!['ADMIN','STORE_MANAGER'].includes(currentUser.role)) {
        showToast('Chỉ Quản trị viên hoặc Quản lý cửa hàng mới có quyền thực hiện thao tác này.', 'error');
        return;
      }

      const id = document.getElementById('admin-staff-id').value;
      const fileInput = document.getElementById('admin-staff-avatar-file');
      let avatarUrl = document.getElementById('admin-staff-avatar')?.value || '';

      // Handle Image Upload if a new file is selected
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const uploadRes = await apiUpload(fileInput.files[0]);
        if (uploadRes && uploadRes.success && uploadRes.url) {
          avatarUrl = uploadRes.url;
        } else {
          showToast((uploadRes && uploadRes.message) || 'Lỗi tải ảnh lên', 'error');
          return;
        }
      }

      const payload = {
        full_name: document.getElementById('admin-staff-name').value.trim(),
        email: document.getElementById('admin-staff-email').value.trim(),
        role: document.getElementById('admin-staff-role').value,
        phone: document.getElementById('admin-staff-phone')?.value.trim() || '',
        address: document.getElementById('admin-staff-address')?.value.trim() || ''
      };

      const passVal = document.getElementById('admin-staff-pass')?.value || '';
      if (!id && !passVal) {
        showToast('Vui lòng nhập mật khẩu cho nhân viên mới.', 'error');
        return;
      }
      if (passVal) {
        payload.password = passVal;
      }

      if (id) {
        payload.status = document.getElementById('admin-staff-status').value;
      }

      if (avatarUrl) payload.avatar = avatarUrl;

      let res = null;
      if (id) {
        res = await apiRequest(`/users/staff-management/${id}`, 'PUT', payload);
      } else {
        res = await apiRequest('/users/staff-management', 'POST', payload);
      }

      if (res && res.success) {
        showToast(res.message || 'Lưu thông tin nhân viên thành công!', 'success');
        closeModal('modal-admin-staff');
        loadAdminStaff();
      } else {
        showToast((res && res.message) || 'Có lỗi xảy ra', 'error');
      }
    });
  }

  if (userAvatarFile) {
    userAvatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        userAvatarPreview.src = URL.createObjectURL(file);
        userAvatarPreview.style.display = 'block';
      } else {
        userAvatarPreview.style.display = 'none';
      }
    });
  }

  if (openAddUserBtn) {
    openAddUserBtn.addEventListener('click', () => {
      document.getElementById('admin-user-id').value = '';
      document.getElementById('modal-user-title').innerHTML = '<i class="fa-solid fa-user-plus" style="color:var(--primary); margin-right:8px;"></i> Thêm Chủ Nuôi Mới';
      adminUserForm.reset();

      document.getElementById('admin-user-role').value = 'USER';
      document.getElementById('admin-user-status').value = 'ACTIVE';
      const statusGroup = document.getElementById('admin-user-status-group');
      if (statusGroup) statusGroup.style.display = 'none';

      const passInput = document.getElementById('admin-user-pass');
      if (passInput) passInput.required = true;
      const hintPass = document.getElementById('hint-user-pass');
      if (hintPass) hintPass.style.display = 'none';
      const labelPass = document.getElementById('label-user-pass');
      if (labelPass) labelPass.innerHTML = 'Mật Khẩu <span style="color:var(--danger);">*</span>';

      if (userAvatarFile) userAvatarFile.value = '';
      if (document.getElementById('admin-user-avatar')) document.getElementById('admin-user-avatar').value = '';
      if (userAvatarPreview) { userAvatarPreview.src = ''; userAvatarPreview.style.display = 'none'; }
      openModal('modal-admin-user');
    });
  }

  if (adminUserForm) {
    adminUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('admin-user-id').value;
      const fileInput = document.getElementById('admin-user-avatar-file');
      
      let avatarUrl = document.getElementById('admin-user-avatar')?.value || '';

      // Handle Image Upload if a new file is selected
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const uploadRes = await apiUpload(fileInput.files[0]);
        if (uploadRes && uploadRes.success && uploadRes.url) {
          avatarUrl = uploadRes.url;
        } else {
          showToast((uploadRes && uploadRes.message) || 'Lỗi tải ảnh lên', 'error');
          return;
        }
      }

      const passVal = document.getElementById('admin-user-pass')?.value || '';
      if (!id && !passVal) {
        showToast('Vui lòng nhập mật khẩu cho chủ nuôi mới.', 'error');
        return;
      }

      const data = {
        full_name: document.getElementById('admin-user-name').value.trim(),
        email: document.getElementById('admin-user-email').value.trim(),
        role: 'USER',
        status: id ? document.getElementById('admin-user-status').value : 'ACTIVE',
        phone: document.getElementById('admin-user-phone')?.value.trim() || '',
        address: document.getElementById('admin-user-address')?.value.trim() || ''
      };

      if (passVal) data.password = passVal;
      if (avatarUrl) data.avatar = avatarUrl;

      let res = null;
      if (id) {
        res = await apiRequest(`/users/${id}`, 'PUT', data);
      } else {
        res = await apiRequest('/users', 'POST', data);
      }

      if (res && res.success) {
        showToast(res.message || 'Lưu thông tin chủ nuôi thành công!', 'success');
        closeModal('modal-admin-user');
        loadAdminUsers();
      } else {
        showToast((res && res.message) || 'Có lỗi xảy ra', 'error');
      }
    });
  }

  if (adminPetSearch) {
    adminPetSearch.addEventListener('input', loadAdminPets);
  }
}

const roleLabels = {
  ADMIN: { text: 'Quản trị viên', cls: 'badge-danger' },
  STORE_MANAGER: { text: 'Quản lý cửa hàng', cls: 'badge-danger' },
  RECEPTIONIST: { text: 'Lễ tân', cls: 'badge-warning' },
  CARE_STAFF: { text: 'Nhân viên chăm sóc', cls: 'badge-info' },
  USER: { text: 'Chủ nuôi', cls: 'badge-secondary' }
};

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const isAdmin = ['ADMIN','STORE_MANAGER'].includes(currentUser.role);

  // Dynamic header titles
  const viewTitle = document.getElementById('admin-users-view-title');
  const addBtn = document.getElementById('open-add-user-btn');
  if (viewTitle) {
    viewTitle.innerHTML = '<i class="fa-solid fa-users" style="color:var(--primary); margin-right:8px;"></i> Danh Sách Chủ Nuôi';
  }
  if (addBtn) {
    addBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Thêm Chủ Nuôi Mới';
  }

  const res = await apiRequest('/users');
  if (!res || !res.success) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">Không thể tải danh sách chủ nuôi.</td></tr>';
    return;
  }

  // STRICTLY filter only owners / customers (role === 'USER')
  const ownerUsers = (res.users || []).filter(u => u.role === 'USER' || u.role === 'owner');

  if (ownerUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px 20px; color:var(--text-muted);"><div style="font-size:28px; margin-bottom:8px;"><i class="fa-solid fa-paw"></i></div><div>Chưa có tài khoản chủ nuôi nào trong hệ thống.</div></td></tr>';
    return;
  }

  tbody.innerHTML = ownerUsers
    .map((u) => {
      const isLocked = u.status === 'LOCKED';
      const statusBadge = isLocked 
        ? '<span class="badge" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; font-weight:700; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; font-size:12px;"><i class="fa-solid fa-lock"></i> Bị khóa</span>' 
        : '<span class="badge" style="background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0; font-weight:700; padding:4px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; font-size:12px;"> Hoạt động</span>';

      return `
      <tr style="${isLocked ? 'background: #fffcfc;' : ''}; transition: background 0.15s ease;">
        <td style="padding: 14px 16px; vertical-align: middle;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${u.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(u.full_name || 'Pet')}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid #fed7aa; flex-shrink:0;" onerror="this.src='/placeholder.png'">
            <div style="min-width:0;">
              <div style="font-size:14px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(u.full_name)}">${escapeHTML(u.full_name)}</div>
              <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace; margin-top:2px;">ID: ${u.id.substring(0, 10)}...</div>
            </div>
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; font-size:13.5px; font-weight:600; color:#334155;">
          ${escapeHTML(u.email)}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; font-size:13px; color:#475569; white-space:nowrap;">
          ${u.phone ? `<span style="display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-phone" style="color:var(--primary); font-size:11px;"></i> ${escapeHTML(u.phone)}</span>` : '<span style="color:#94a3b8; font-style:italic;">Chưa có</span>'}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align:center; white-space:nowrap;">
          <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; font-weight:700; padding:4px 8px; border-radius:6px; font-size:12px;">Chủ nuôi</span>
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align:center; white-space:nowrap;">
          ${statusBadge}
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align:center; white-space:nowrap;">
          <a href="#" onclick="viewUserPets('${u.id}', '${escapeHTML(u.full_name)}'); return false;" style="color:var(--primary); font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; background:rgba(249,115,22,0.08); transition:background 0.2s;" onmouseover="this.style.background='rgba(249,115,22,0.18)'" onmouseout="this.style.background='rgba(249,115,22,0.08)'">
            <i class="fa-solid fa-paw"></i> <b>${u.petCount || 0}</b> bé
          </a>
        </td>
        <td style="padding: 14px 16px; vertical-align: middle; text-align:center; white-space:nowrap;">
          <div class="table-action-group">
            <button class="btn-action btn-action-view" onclick="viewAdminUserDetails('${u.id}')" title="Xem thông tin chi tiết chủ nuôi">
              <i class="fa-solid fa-eye"></i> Xem thông tin
            </button>
            <button class="btn-action btn-action-edit" onclick="editAdminUser('${u.id}')" title="Cập nhật thông tin chủ nuôi">
              <i class="fa-solid fa-pen-to-square"></i> Sửa
            </button>
            ${isAdmin ? `
            <button class="btn-action btn-action-lock ${isLocked ? 'is-locked' : ''}" onclick="toggleUserStatus('${u.id}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}">
              <i class="fa-solid ${isLocked ? 'fa-lock-open' : 'fa-lock'}"></i> ${isLocked ? 'Mở khóa' : 'Khóa'}
            </button>
            <button class="btn-action btn-action-delete" onclick="deleteAdminUser('${u.id}', '${escapeHTML(u.full_name)}')" title="Xóa tài khoản">
              <i class="fa-solid fa-trash"></i> Xóa
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

async function viewAdminUserDetails(userId) {
  const modalBody = document.getElementById('admin-user-details-body');
  const footerLeft = document.getElementById('admin-user-details-footer-left');
  if (!modalBody) return;

  openModal('modal-admin-user-details');

  modalBody.innerHTML = `
    <div style="text-align:center; padding: 40px; color:var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--primary); margin-bottom:12px;"></i>
      <div>Đang tải thông tin chi tiết chủ nuôi...</div>
    </div>
  `;
  if (footerLeft) footerLeft.innerHTML = '';

  try {
    const res = await apiRequest(`/users/${userId}/details`);
    if (!res || !res.success || !res.user) {
      modalBody.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--danger);">
          <i class="fa-solid fa-triangle-exclamation fa-2x" style="margin-bottom:10px;"></i>
          <p>${res?.message || 'Không thể tải thông tin chi tiết chủ nuôi.'}</p>
        </div>
      `;
      return;
    }

    const u = res.user;
    const pets = Array.isArray(res.pets) ? res.pets : [];
    const appointments = Array.isArray(res.appointments) ? res.appointments : [];
    const healthRecords = Array.isArray(res.healthRecords) ? res.healthRecords : [];

    const isLocked = u.status === 'LOCKED';
    const statusBadge = isLocked 
      ? '<span class="badge badge-danger" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding:4px 10px; font-weight:700;"><i class="fa-solid fa-lock"></i> Bị khóa</span>' 
      : '<span class="badge badge-success" style="background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0; padding:4px 10px; font-weight:700;"> Hoạt động</span>';

    if (footerLeft) {
      footerLeft.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('modal-admin-user-details'); editAdminUser('${u.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Chỉnh Sửa Chủ Nuôi
        </button>
      `;
    }

    // 1. Account Info Section
    const accountSectionHtml = `
      <div style="background:#ffffff; border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin:0 0 14px 0; font-size:15px; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-user"></i> 1. THÔNG TIN TÀI KHOẢN CHỦ NUÔI
        </h4>
        <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
          <img src="${u.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(u.full_name || 'Owner')}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:2px solid var(--primary); box-shadow:0 2px 8px rgba(0,0,0,0.08);" onerror="this.src='/placeholder.png'">
          <div style="flex:1; min-width:250px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:13.5px;">
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Họ và tên:</div>
              <div style="font-weight:800; color:#0f172a; font-size:15px;">${escapeHTML(u.full_name)}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Mã tài khoản:</div>
              <div style="font-family:monospace; font-weight:700; color:#475569;">#${u.id}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Email:</div>
              <div style="font-weight:600; color:#1e293b;">${escapeHTML(u.email)}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Số điện thoại:</div>
              <div style="font-weight:600; color:#1e293b;">${u.phone ? ` ${escapeHTML(u.phone)}` : '<span style="color:#94a3b8;">Chưa cập nhật</span>'}</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Vai trò:</div>
              <div><span class="badge badge-secondary" style="font-weight:700;">Chủ nuôi (USER)</span></div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Trạng thái tài khoản:</div>
              <div>${statusBadge}</div>
            </div>
            ${u.address ? `
            <div style="grid-column:1 / -1;">
              <div style="color:var(--text-muted); font-size:12px; font-weight:600;">Địa chỉ cư trú:</div>
              <div style="color:#334155;"> ${escapeHTML(u.address)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // 2. Pets List Section
    let petsListHtml = '';
    if (pets.length === 0) {
      petsListHtml = `
        <div style="text-align:center; padding:24px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; color:var(--text-muted); font-size:13.5px;">
          <i class="fa-solid fa-paw"></i> Chủ nuôi này chưa đăng ký thú cưng nào.
        </div>
      `;
    } else {
      petsListHtml = `
        <div class="table-responsive" style="border:1px solid var(--border); border-radius:12px; overflow:hidden;">
          <table class="custom-table" style="margin:0; font-size:13px;">
            <thead style="background:#f8fafc;">
              <tr>
                <th>Mã thú cưng</th>
                <th>Tên thú cưng</th>
                <th>Loài</th>
                <th>Giống</th>
                <th>Tuổi</th>
                <th>Cân nặng</th>
                <th>Tình trạng sức khỏe</th>
              </tr>
            </thead>
            <tbody>
              ${pets.map(p => `
                <tr>
                  <td><span style="font-weight:700; color:var(--primary); font-size:12px;">${p.pet_code || ('#' + p.id.substring(0,8).toUpperCase())}</span></td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <img src="${p.photo_url || '/placeholder.png'}" style="width:32px; height:32px; border-radius:6px; object-fit:cover;" onerror="this.src='/placeholder.png'">
                      <b style="color:#0f172a;">${escapeHTML(p.name)}</b>
                    </div>
                  </td>
                  <td>${p.species === 'CHÓ' || p.species === 'Chó' ? '<i class="fa-solid fa-dog"></i> Chó' : (p.species === 'MÈO' || p.species === 'Mèo' ? '<i class="fa-solid fa-cat"></i> Mèo' : escapeHTML(p.species || 'Khác'))}</td>
                  <td>${escapeHTML(p.breed || 'Chưa rõ')}</td>
                  <td>${p.age_months ? `${p.age_months} tháng` : (p.age ? `${p.age} tuổi` : '--')}</td>
                  <td><b>${p.weight || '--'}</b> kg</td>
                  <td><span class="badge badge-success" style="background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0; font-weight:600;">${escapeHTML(p.health_status || 'Bình thường')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const petsSectionHtml = `
      <div style="background:#ffffff; border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin:0 0 14px 0; font-size:15px; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-paw"></i> 2. DANH SÁCH THÚ CƯNG THUỘC CHỦ NUÔI (${pets.length} bé)
        </h4>
        ${petsListHtml}
      </div>
    `;

    // 3. Appointments Section
    let appointmentsListHtml = '';
    if (appointments.length === 0) {
      appointmentsListHtml = `
        <div style="text-align:center; padding:24px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; color:var(--text-muted); font-size:13.5px;">
          <i class="fa-solid fa-calendar"></i> Chủ nuôi này chưa có lịch đặt hoặc lịch hẹn chăm sóc nào.
        </div>
      `;
    } else {
      appointmentsListHtml = `
        <div class="table-responsive" style="border:1px solid var(--border); border-radius:12px; overflow:hidden;">
          <table class="custom-table" style="margin:0; font-size:13px;">
            <thead style="background:#f8fafc;">
              <tr>
                <th>Mã lịch</th>
                <th>Dịch vụ / Gói</th>
                <th>Thú cưng</th>
                <th>Ngày & Giờ</th>
                <th>Nhân viên phân công</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${appointments.map(a => {
                let dStr = a.appointmentDate || '';
                if (dStr.includes('T')) dStr = dStr.split('T')[0];
                if (dStr.includes('-')) {
                  const p = dStr.split('-');
                  if (p.length === 3) dStr = `${p[2]}/${p[1]}/${p[0]}`;
                }

                const st = (a.status || '').toUpperCase();
                let stText = 'Chờ xác nhận';
                let stStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
                if (st === 'COMPLETED') {
                  stText = 'Đã hoàn thành';
                  stStyle = 'background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0;';
                } else if (st === 'CANCELLED') {
                  stText = 'Đã hủy';
                  stStyle = 'background:#fef2f2; color:#ef4444; border:1px solid #fecaca;';
                } else if (st === 'IN_PROGRESS') {
                  stText = 'Đang thực hiện';
                  stStyle = 'background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe;';
                } else if (st === 'ASSIGNED' || a.staffName) {
                  stText = 'Đã phân công';
                  stStyle = 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;';
                } else if (st === 'CONFIRMED') {
                  stText = 'Đã xác nhận';
                  stStyle = 'background:#ecfdf5; color:#059669; border:1px solid #a7f3d0;';
                }

                return `
                  <tr>
                    <td><span style="font-size:11.5px; font-weight:700; color:var(--text-muted); background:#f1f5f9; padding:2px 6px; border-radius:4px;">#${a.id ? a.id.substring(0,8).toUpperCase() : ''}</span></td>
                    <td><b style="color:#0f172a;">${escapeHTML(a.examinationType || 'Dịch vụ')}</b></td>
                    <td><i class="fa-solid fa-paw"></i> <b>${escapeHTML(a.petName || 'Thú cưng')}</b> (${escapeHTML(a.petSpecies || 'Pet')})</td>
                    <td><b>${dStr}</b> <span style="color:var(--primary); font-weight:700;">${a.appointmentTime || '09:00'}</span></td>
                    <td><span style="color:#0284c7; font-weight:600;"><i class="fa-solid fa-user-check"></i> ${escapeHTML(a.staffName || 'Chưa phân công')}</span></td>
                    <td><span class="badge" style="padding:4px 10px; border-radius:12px; font-weight:700; font-size:11.5px; ${stStyle}">${stText}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const appointmentsSectionHtml = `
      <div style="background:#ffffff; border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin:0 0 14px 0; font-size:15px; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-calendar-check"></i> 3. LỊCH ĐẶT & LỊCH HẸN CHĂM SÓC CỦA CHỦ NUÔI (${appointments.length} lịch)
        </h4>
        ${appointmentsListHtml}
      </div>
    `;

    // 4. Health & Care Records Section
    let healthRecordsListHtml = '';
    if (healthRecords.length === 0) {
      healthRecordsListHtml = `
        <div style="text-align:center; padding:24px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; color:var(--text-muted); font-size:13.5px;">
          <i class="fa-solid fa-stethoscope"></i> Chưa có hồ sơ sức khỏe hoặc lịch sử chăm sóc nào cho thú cưng của chủ nuôi này.
        </div>
      `;
    } else {
      healthRecordsListHtml = `
        <div class="table-responsive" style="border:1px solid var(--border); border-radius:12px; overflow:hidden;">
          <table class="custom-table" style="margin:0; font-size:13px;">
            <thead style="background:#f8fafc;">
              <tr>
                <th>Thú cưng</th>
                <th>Ngày ghi nhận</th>
                <th>Dịch vụ / Loại hồ sơ</th>
                <th>Nội dung chăm sóc</th>
                <th>Tình trạng thú cưng</th>
                <th>Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
              ${healthRecords.map(r => {
                let recDateStr = r.record_date || '';
                if (recDateStr.includes('T')) recDateStr = recDateStr.split('T')[0];
                if (recDateStr.includes('-')) {
                  const p = recDateStr.split('-');
                  if (p.length === 3) recDateStr = `${p[2]}/${p[1]}/${p[0]}`;
                }

                return `
                  <tr>
                    <td><i class="fa-solid fa-paw"></i> <b>${escapeHTML(r.pet_name || 'Bé')}</b></td>
                    <td><b>${recDateStr}</b></td>
                    <td><b style="color:var(--primary);">${escapeHTML(r.title || r.record_type || 'Hồ sơ')}</b></td>
                    <td>${escapeHTML(r.care_content || r.description || '--')}</td>
                    <td>
                      ${r.condition_before ? `<div style="font-size:12px;">• Trước: ${escapeHTML(r.condition_before)}</div>` : ''}
                      ${(r.condition_after || r.condition_result) ? `<div style="font-size:12px; color:#059669; font-weight:600;">• Sau: ${escapeHTML(r.condition_after || r.condition_result)}</div>` : ''}
                    </td>
                    <td><i class="fa-solid fa-user"></i> <b>${escapeHTML(r.doctor_name || r.staff_name || 'Nhân viên')}</b></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const healthSectionHtml = `
      <div style="background:#ffffff; border:1px solid var(--border); border-radius:14px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <h4 style="margin:0 0 14px 0; font-size:15px; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-notes-medical"></i> 4. HỒ SƠ SỨC KHỎE & CHĂM SÓC THÚ CƯNG (${healthRecords.length} hồ sơ)
        </h4>
        ${healthRecordsListHtml}
      </div>
    `;

    modalBody.innerHTML = `
      ${accountSectionHtml}
      ${petsSectionHtml}
      ${appointmentsSectionHtml}
      ${healthSectionHtml}
    `;

  } catch (err) {
    console.error('viewAdminUserDetails error:', err);
    modalBody.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--danger);">
        <i class="fa-solid fa-triangle-exclamation fa-2x" style="margin-bottom:10px;"></i>
        <p>Lỗi kết nối máy chủ khi tải chi tiết chủ nuôi.</p>
      </div>
    `;
  }
}

async function editAdminUser(id) {
  const res = await apiRequest('/users');
  if (!res || !res.success) return;

  const u = (res.users || []).find((item) => item.id === id);
  if (!u) return;

  document.getElementById('admin-user-id').value = u.id;
  document.getElementById('admin-user-name').value = u.full_name;
  document.getElementById('admin-user-email').value = u.email;
  document.getElementById('admin-user-role').value = 'USER';
  document.getElementById('admin-user-status').value = u.status || 'ACTIVE';
  
  const passInput = document.getElementById('admin-user-pass');
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
  }
  const hintPass = document.getElementById('hint-user-pass');
  if (hintPass) hintPass.style.display = 'block';
  const labelPass = document.getElementById('label-user-pass');
  if (labelPass) labelPass.innerHTML = 'Mật Khẩu Mới (Để trống nếu không đổi)';

  const statusGroup = document.getElementById('admin-user-status-group');
  if (statusGroup) statusGroup.style.display = 'block';
  
  const phoneEl = document.getElementById('admin-user-phone');
  const addressEl = document.getElementById('admin-user-address');
  if (phoneEl) phoneEl.value = u.phone || '';
  if (addressEl) addressEl.value = u.address || '';

  const avatarHidden = document.getElementById('admin-user-avatar');
  const avatarFile = document.getElementById('admin-user-avatar-file');
  const avatarPreview = document.getElementById('admin-user-avatar-preview');
  
  if (avatarHidden) avatarHidden.value = u.avatar || '';
  if (avatarFile) avatarFile.value = '';
  
  if (u.avatar) {
    avatarPreview.src = u.avatar;
    avatarPreview.style.display = 'block';
  } else {
    avatarPreview.src = '';
    avatarPreview.style.display = 'none';
  }

  document.getElementById('modal-user-title').innerHTML = '<i class="fa-solid fa-user-pen" style="color:var(--primary); margin-right:8px;"></i> Chỉnh Sửa Thông Tin Chủ Nuôi';
  openModal('modal-admin-user');
}

async function viewUserPets(userId, userName) {
  const res = await apiRequest(`/users/${userId}/pets`);
  if (!res || !res.success) {
    showToast('Lỗi tải danh sách thú cưng', 'error');
    return;
  }

  if (!res.pets || res.pets.length === 0) {
    alert(`${userName} chưa có thú cưng nào.`);
    return;
  }

  const petsList = res.pets.map(p =>
    `• ${p.name} (${p.species}, ${p.breed}) - Sức khỏe: ${p.health_status}`
  ).join('\n');

  alert(`<i class="fa-solid fa-paw"></i> Thú cưng của ${userName}:\n\n${petsList}`);
}

async function toggleUserStatus(id) {
  const res = await apiRequest(`/users/${id}/toggle-status`, 'PATCH');
  if (res && res.success) {
    showToast(res.message, 'success');
    loadAdminUsers();
  } else {
    showToast((res && res.message) || 'Lỗi cập nhật trạng thái', 'error');
  }
}

async function deleteAdminUser(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${name}" cùng toàn bộ dữ liệu liên quan?`)) return;

  const res = await apiRequest(`/users/${id}`, 'DELETE');
  if (res && res.success) {
    showToast(res.message, 'success');
    loadAdminUsers();
  } else {
    showToast((res && res.message) || 'Lỗi khi xóa người dùng', 'error');
  }
}

async function loadAdminPets() {
  const search = document.getElementById('admin-pet-search')?.value || '';
  const res = await apiRequest(`/pets?species=ALL&search=${encodeURIComponent(search)}`);
  const tbody = document.getElementById('admin-pets-tbody');
  if (!tbody || !res.success) return;

  if (!res.pets || res.pets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Không tìm thấy thú cưng nào.</td></tr>';
    return;
  }

  tbody.innerHTML = res.pets
    .map(
      (p) => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${p.photo_url || '/placeholder.png'}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover;" onerror="this.src='/placeholder.png'">
          <span style="font-size:12px; font-weight:700; color:var(--primary);">${p.pet_code || ''}</span>
        </div>
      </td>
      <td><b>${escapeHTML(p.name)}</b></td>
      <td>${getSpeciesBadge ? getSpeciesBadge(p.species) : p.species} ${escapeHTML(p.breed || '')}</td>
      <td><i class="fa-solid fa-user"></i> <b>${escapeHTML(p.owner_name || '')}</b> <br><small style="color:var(--text-muted);">${escapeHTML(p.owner_email || '')}</small></td>
      <td>${p.weight || 0} kg</td>
      <td><span class="badge badge-success">${p.health_status || 'Bình thường'}</span></td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="viewPetHealth('${p.id}')" title="Xem hồ sơ sức khỏe thú cưng">
            <i class="fa-solid fa-eye"></i> Hồ sơ
          </button>
          <button class="btn btn-outline btn-sm" onclick="editPet('${p.id}')" title="Sửa thông tin thú cưng">
            <i class="fa-solid fa-pen"></i> Sửa
          </button>
          <button class="btn btn-danger btn-sm" onclick="deletePet('${p.id}', '${escapeHTML(p.name || '').replace(/'/g, "\\'")}')" title="Xóa thú cưng">
            <i class="fa-solid fa-trash"></i> Xóa
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join('');
}

function openAddPetModalAdmin() {
  const openAddBtn = document.getElementById('open-add-pet-btn');
  if (openAddBtn) {
    openAddBtn.click();
  }
}

window.initAdminUI = initAdminUI;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminPets = loadAdminPets;
window.openAddPetModalAdmin = openAddPetModalAdmin;
window.editAdminUser = editAdminUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteAdminUser = deleteAdminUser;
window.viewAdminUserDetails = viewAdminUserDetails;
window.viewUserPets = viewUserPets;

/* =========================================================
   STAFF MANAGEMENT FUNCTIONS (ADMIN ONLY)
   ========================================================= */

let currentStaffData = [];

function isStaffReceptionist(role) {
  const r = String(role || '').toUpperCase().trim();
  return r === 'RECEPTIONIST' || r === 'LE_TAN' || r === 'LETAN' || r === 'LỄ TÂN' || r.includes('LỄ TÂN') || r.includes('LE TAN');
}

function isStaffCare(role) {
  const r = String(role || '').toUpperCase().trim();
  return r === 'CARE_STAFF' || r === 'STAFF' || r === 'DOCTOR' || r === 'CHAMSOC' || r === 'NHANVIEN' || r === 'NHÂN VIÊN CHĂM SÓC' || r.includes('CHĂM SÓC') || r.includes('CHAM SOC');
}

function updateStaffCardActiveState(roleFilter, statusFilter) {
  const cards = {
    total: document.getElementById('staff-card-total'),
    reception: document.getElementById('staff-card-reception'),
    care: document.getElementById('staff-card-care'),
    active: document.getElementById('staff-card-active'),
    locked: document.getElementById('staff-card-locked')
  };

  Object.values(cards).forEach(card => card && card.classList.remove('active'));

  if (roleFilter === 'RECEPTIONIST' && statusFilter === 'ALL') {
    if (cards.reception) cards.reception.classList.add('active');
  } else if (roleFilter === 'CARE_STAFF' && statusFilter === 'ALL') {
    if (cards.care) cards.care.classList.add('active');
  } else if (statusFilter === 'ACTIVE' && roleFilter === 'ALL') {
    if (cards.active) cards.active.classList.add('active');
  } else if (statusFilter === 'LOCKED' && roleFilter === 'ALL') {
    if (cards.locked) cards.locked.classList.add('active');
  } else if (roleFilter === 'ALL' && statusFilter === 'ALL') {
    if (cards.total) cards.total.classList.add('active');
  }
}

function filterStaffByCard(filterType) {
  const roleSelect = document.getElementById('staff-role-filter');
  const statusSelect = document.getElementById('staff-status-filter');

  if (filterType === 'all') {
    if (roleSelect) roleSelect.value = 'ALL';
    if (statusSelect) statusSelect.value = 'ALL';
  } else if (filterType === 'receptionist') {
    if (roleSelect) roleSelect.value = 'RECEPTIONIST';
    if (statusSelect) statusSelect.value = 'ALL';
  } else if (filterType === 'care_staff') {
    if (roleSelect) roleSelect.value = 'CARE_STAFF';
    if (statusSelect) statusSelect.value = 'ALL';
  } else if (filterType === 'active') {
    if (roleSelect) roleSelect.value = 'ALL';
    if (statusSelect) statusSelect.value = 'ACTIVE';
  } else if (filterType === 'locked') {
    if (roleSelect) roleSelect.value = 'ALL';
    if (statusSelect) statusSelect.value = 'LOCKED';
  }

  const role = roleSelect ? roleSelect.value : 'ALL';
  const status = statusSelect ? statusSelect.value : 'ALL';
  updateStaffCardActiveState(role, status);
  loadAdminStaff();
}

async function loadAdminStaff() {
  const tbody = document.getElementById('admin-staff-tbody');
  if (!tbody) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = String(currentUser.role || '').toUpperCase().trim();
  if (!['ADMIN', 'STORE_MANAGER'].includes(userRole)) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">Bạn không có quyền truy cập trang này.</td></tr>';
    return;
  }

  const roleFilter = document.getElementById('staff-role-filter')?.value || 'ALL';
  const statusFilter = document.getElementById('staff-status-filter')?.value || 'ALL';
  const searchQuery = document.getElementById('staff-search-input')?.value || '';

  updateStaffCardActiveState(roleFilter, statusFilter);

  const res = await apiRequest(`/users/staff-management?role=${roleFilter}&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`);
  
  if (!res || !res.success) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">Không thể tải danh sách nhân viên.</td></tr>';
    return;
  }

  currentStaffData = res.staff || [];

  // Update Stats Counters from DB stats
  const stats = res.stats || {
    total: currentStaffData.length,
    receptionist: currentStaffData.filter(s => isStaffReceptionist(s.role)).length,
    care_staff: currentStaffData.filter(s => isStaffCare(s.role)).length,
    active: currentStaffData.filter(s => (s.status || 'ACTIVE').toUpperCase().trim() !== 'LOCKED').length,
    locked: currentStaffData.filter(s => (s.status || '').toUpperCase().trim() === 'LOCKED').length
  };

  const statTotalEl = document.getElementById('staff-stat-total');
  const statRecEl = document.getElementById('staff-stat-reception');
  const statCareEl = document.getElementById('staff-stat-care');
  const statActiveEl = document.getElementById('staff-stat-active');
  const statLockedEl = document.getElementById('staff-stat-locked');

  if (statTotalEl) statTotalEl.innerText = stats.total;
  if (statRecEl) statRecEl.innerText = stats.receptionist;
  if (statCareEl) statCareEl.innerText = stats.care_staff;
  if (statActiveEl) statActiveEl.innerText = stats.active;
  if (statLockedEl) statLockedEl.innerText = stats.locked;

  if (currentStaffData.length === 0) {
    let emptyTitle = 'Không tìm thấy nhân viên nào';
    let emptySub = 'Thử thay đổi bộ lọc hoặc thêm nhân viên mới vào hệ thống.';

    if (statusFilter === 'LOCKED') {
      emptyTitle = 'Không có nhân viên đã khóa';
      emptySub = 'Tất cả nhân viên hệ thống hiện đang trong trạng thái hoạt động.';
    } else if (statusFilter === 'ACTIVE') {
      emptyTitle = 'Không có nhân viên đang hoạt động';
      emptySub = 'Hiện chưa có nhân viên nào ở trạng thái hoạt động.';
    } else if (roleFilter === 'RECEPTIONIST') {
      emptyTitle = 'Không tìm thấy nhân viên Lễ tân';
      emptySub = 'Chưa có tài khoản Lễ tân nào phù hợp với bộ lọc tìm kiếm.';
    } else if (roleFilter === 'CARE_STAFF') {
      emptyTitle = 'Không tìm thấy nhân viên Chăm sóc thú cưng';
      emptySub = 'Chưa có tài khoản Nhân viên chăm sóc nào phù hợp.';
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:35px 20px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:10px;"></div>
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${emptyTitle}</div>
          <div style="font-size:12.5px;">${emptySub}</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentStaffData
    .map(s => {
      const isLocked = (s.status || '').toUpperCase().trim() === 'LOCKED';
      const isReception = isStaffReceptionist(s.role);
      const roleBadge = isReception
        ? '<span class="badge badge-warning"><i class="fa-solid fa-bell-concierge" style="margin-right:4px;"></i> Lễ tân</span>'
        : '<span class="badge badge-info"><i class="fa-solid fa-hand-holding-heart" style="margin-right:4px;"></i> Nhân viên chăm sóc</span>';
      
      const statusBadge = isLocked
        ? '<span class="badge badge-danger"><i class="fa-solid fa-lock"></i> Đã khóa</span>'
        : '<span class="badge badge-success"> Đang hoạt động</span>';

      const activityInfo = isReception
        ? ` <b>${s.invoice_count || 0}</b> hóa đơn`
        : `<i class="fa-solid fa-calendar"></i> <b>${s.appointment_count || 0}</b> lịch phân công`;

      return `
        <tr style="${isLocked ? 'opacity: 0.75; background: rgba(239, 68, 68, 0.03);' : ''}">
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="${s.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(s.full_name || 'Staff')}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border: 2px solid ${isReception ? '#f59e0b' : '#3b82f6'};" onerror="this.src='/placeholder.png'">
              <div>
                <div style="font-size:14px; font-weight:700; color:var(--text-main);">${escapeHTML(s.full_name)}</div>
                <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:4px; margin-top:2px;">
                  <span style="background:var(--bg-main); padding:1px 5px; border-radius:4px; border:1px solid var(--border); font-family:monospace;">${s.id.substring(0, 10)}</span>
                  ${s.created_at ? `• ${new Date(s.created_at).toLocaleDateString('vi-VN')}` : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:13.5px; font-weight:600; color:var(--text-main);">${escapeHTML(s.email)}</div>
          </td>
          <td>
            <div style="font-size:13px; color:var(--text-muted);">
              ${s.phone ? ` <span style="font-weight:600; color:var(--text-main);">${escapeHTML(s.phone)}</span>` : '<span style="color:#94a3b8;">Chưa cập nhật</span>'}
            </div>
            ${s.address ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;"> ${escapeHTML(s.address)}</div>` : ''}
          </td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td style="font-size:12.5px; color:var(--text-muted);">${activityInfo}</td>
          <td style="text-align: right;">
            <div style="display:inline-flex; gap:6px; justify-content: flex-end;">
              <button class="btn btn-outline btn-sm" onclick="editStaff('${s.id}')" title="Sửa thông tin / Đổi vai trò">
                <i class="fa-solid fa-pen-to-square"></i> Sửa
              </button>
              <button class="btn ${isLocked ? 'btn-secondary' : 'btn-outline'} btn-sm" onclick="toggleStaffStatus('${s.id}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}">
                <i class="fa-solid ${isLocked ? 'fa-lock-open' : 'fa-lock'}"></i> ${isLocked ? 'Mở khóa' : 'Khóa'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteStaff('${s.id}', '${escapeHTML(s.full_name)}')" title="Xóa nhân viên">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function openAddStaffModal() {
  const form = document.getElementById('admin-staff-form');
  if (!form) return;

  form.reset();
  document.getElementById('admin-staff-id').value = '';
  document.getElementById('modal-staff-title').innerHTML = '<i class="fa-solid fa-user-plus" style="color:var(--primary); margin-right:8px;"></i> Thêm Nhân Viên Mới';
  
  const passInput = document.getElementById('admin-staff-pass');
  if (passInput) passInput.required = true;

  const hintPass = document.getElementById('hint-staff-pass');
  if (hintPass) hintPass.style.display = 'none';

  const labelPass = document.getElementById('label-staff-pass');
  if (labelPass) labelPass.innerHTML = 'Mật Khẩu Đăng Nhập <span style="color:var(--danger);">*</span>';

  const statusGroup = document.getElementById('admin-staff-status-group');
  if (statusGroup) statusGroup.style.display = 'none'; // Default active when adding
  document.getElementById('admin-staff-status').value = 'ACTIVE';

  const preview = document.getElementById('admin-staff-avatar-preview');
  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  const avatarHidden = document.getElementById('admin-staff-avatar');
  if (avatarHidden) avatarHidden.value = '';

  openModal('modal-admin-staff');
}

function editStaff(id) {
  const staff = currentStaffData.find(s => s.id === id);
  if (!staff) return;

  document.getElementById('admin-staff-id').value = staff.id;
  document.getElementById('admin-staff-name').value = staff.full_name || '';
  document.getElementById('admin-staff-email').value = staff.email || '';
  document.getElementById('admin-staff-role').value = (staff.role === 'STAFF' ? 'CARE_STAFF' : staff.role) || 'CARE_STAFF';
  document.getElementById('admin-staff-status').value = staff.status || 'ACTIVE';
  document.getElementById('admin-staff-phone').value = staff.phone || '';
  document.getElementById('admin-staff-address').value = staff.address || '';
  
  const passInput = document.getElementById('admin-staff-pass');
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
  }

  const hintPass = document.getElementById('hint-staff-pass');
  if (hintPass) hintPass.style.display = 'block';

  const labelPass = document.getElementById('label-staff-pass');
  if (labelPass) labelPass.innerHTML = 'Mật Khẩu Mới (Để trống nếu giữ nguyên)';

  const statusGroup = document.getElementById('admin-staff-status-group');
  if (statusGroup) statusGroup.style.display = 'block';

  const preview = document.getElementById('admin-staff-avatar-preview');
  const avatarHidden = document.getElementById('admin-staff-avatar');
  if (staff.avatar) {
    if (preview) {
      preview.src = staff.avatar;
      preview.style.display = 'block';
    }
    if (avatarHidden) avatarHidden.value = staff.avatar;
  } else {
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    if (avatarHidden) avatarHidden.value = '';
  }

  document.getElementById('modal-staff-title').innerHTML = '<i class="fa-solid fa-user-pen" style="color:var(--primary); margin-right:8px;"></i> Chỉnh Sửa Thông Tin Nhân Viên';
  openModal('modal-admin-staff');
}

async function toggleStaffStatus(id) {
  const staff = currentStaffData.find(s => s.id === id);
  const actionText = (staff && staff.status === 'LOCKED') ? 'mở khóa' : 'khóa';
  
  const res = await apiRequest(`/users/staff-management/${id}/toggle-status`, 'PATCH');
  if (res && res.success) {
    showToast(res.message, 'success');
    loadAdminStaff();
  } else {
    showToast((res && res.message) || `Lỗi khi ${actionText} tài khoản nhân viên`, 'error');
  }
}

async function deleteStaff(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân viên "${name}"?\n\nLưu ý: Nếu nhân viên đã từng tham gia lịch hẹn, hồ sơ chăm sóc hoặc hóa đơn, bạn nên chọn "Khóa tài khoản" thay vì xóa.`)) {
    return;
  }

  const res = await apiRequest(`/users/staff-management/${id}`, 'DELETE');
  if (res && res.success) {
    showToast(res.message, 'success');
    loadAdminStaff();
  } else {
    if (res && res.hasLinkedData) {
      alert(`<i class="fa-solid fa-triangle-exclamation"></i> ${res.message}`);
    } else {
      showToast((res && res.message) || 'Lỗi khi xóa nhân viên', 'error');
    }
  }
}

function resetStaffFilters() {
  const searchInput = document.getElementById('staff-search-input');
  const roleSelect = document.getElementById('staff-role-filter');
  const statusSelect = document.getElementById('staff-status-filter');

  if (searchInput) searchInput.value = '';
  if (roleSelect) roleSelect.value = 'ALL';
  if (statusSelect) statusSelect.value = 'ALL';

  loadAdminStaff();
}

window.loadAdminStaff = loadAdminStaff;
window.openAddStaffModal = openAddStaffModal;
window.editStaff = editStaff;
window.toggleStaffStatus = toggleStaffStatus;
window.deleteStaff = deleteStaff;
window.resetStaffFilters = resetStaffFilters;
window.filterStaffByCard = filterStaffByCard;

