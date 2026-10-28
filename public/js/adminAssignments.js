/* =========================================================
   ADMIN CARE ASSIGNMENTS MANAGEMENT (Quản lý Lịch Chăm Sóc Phân Công)
   Dedicated to ADMIN
   ========================================================= */

window.adminAssignmentsCache = [];
window.activeAssignmentsStatFilter = 'ALL';

// Cập nhật giao diện làm nổi bật ô thống kê được chọn
window.updateAdminAssignmentsStatCardsUI = function(selectedFilter) {
  const cards = [
    { id: 'stat-card-assignments-total', key: 'ALL' },
    { id: 'stat-card-assignments-pending', key: 'PENDING_STAFF_CONFIRMATION' },
    { id: 'stat-card-assignments-inprogress', key: 'IN_PROGRESS' },
    { id: 'stat-card-assignments-completed', key: 'COMPLETED' }
  ];

  cards.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    if (c.key === selectedFilter) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
};

// Xử lý khi bấm vào 1 trong 4 ô thống kê
window.selectAdminAssignmentsStatFilter = function(statKey) {
  window.activeAssignmentsStatFilter = statKey;
  
  const statusSelect = document.getElementById('assignments-filter-status');
  if (statusSelect) {
    if (statKey === 'ALL') {
      statusSelect.value = '';
    } else {
      statusSelect.value = statKey;
    }
  }

  window.updateAdminAssignmentsStatCardsUI(statKey);
  window.filterAdminAssignments();
};

window.loadAdminAssignments = async function() {
  const container = document.getElementById('admin-care-assignments-list-container') || document.getElementById('admin-assignments-list-container');
  if (!container) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser || !['ADMIN','STORE_MANAGER'].includes(currentUser.role)) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color:var(--danger); background:#fff; border-radius:16px; border:1px solid var(--border);">
        <i class="fa-solid fa-lock fa-2x" style="margin-bottom:12px;"></i>
        <h4>Chức năng này chỉ dành cho Quản trị viên hoặc Quản lý cửa hàng.</h4>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="text-align:center; padding: 40px; color:var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--primary); margin-bottom:12px;"></i>
      <div style="font-size:14px; margin-top:8px;">Đang tải danh sách lịch chăm sóc phân công...</div>
    </div>
  `;

  try {
    const [appRes, staffRes] = await Promise.all([
      apiRequest('/appointments'),
      apiRequest('/users')
    ]);

    if (!appRes || !appRes.success || !Array.isArray(appRes.appointments)) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px; background:#fff; border-radius:16px; border:1px solid var(--border);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="color:var(--danger); font-size:15px;">${appRes?.message || 'Không thể tải danh sách lịch hẹn.'}</p>
          <button class="btn btn-outline" onclick="loadAdminAssignments()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button>
        </div>
      `;
      return;
    }

    // Populate staff filter dropdown
    const staffFilter = document.getElementById('assignments-filter-staff');
    if (staffFilter && staffRes && staffRes.success && Array.isArray(staffRes.users)) {
      const careStaffList = staffRes.users.filter(u => (u.role === 'CARE_STAFF' || u.role === 'STAFF') && u.status !== 'DELETED');
      const currentVal = staffFilter.value;
      staffFilter.innerHTML = '<option value="">-- Tất cả nhân viên --</option>' +
        '<option value="UNASSIGNED"><i class="fa-solid fa-triangle-exclamation"></i> Chưa phân công</option>' +
        careStaffList.map(s => `<option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}><i class="fa-solid fa-user"></i> ${escapeHTML(s.full_name)}</option>`).join('');
    }

    window.adminAssignmentsCache = appRes.appointments;
    
    // Cập nhật số liệu thống kê từ toàn bộ cache
    window.updateAdminAssignmentsStatsNumbers(window.adminAssignmentsCache);
    
    // Áp dụng bộ lọc hiện tại
    window.filterAdminAssignments();
  } catch (err) {
    console.error('loadAdminAssignments error:', err);
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; background:#fff; border-radius:16px; border:1px solid var(--border);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
        <p style="color:var(--danger); font-size:15px;">Lỗi kết nối máy chủ. Vui lòng thử lại.</p>
        <button class="btn btn-outline" onclick="loadAdminAssignments()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button>
      </div>
    `;
  }
};

// Cập nhật số liệu 4 ô thống kê trên toàn bộ danh sách
window.updateAdminAssignmentsStatsNumbers = function(allList) {
  const list = allList || window.adminAssignmentsCache || [];
  const total = list.length;
  const pendingCount = list.filter(a => a.status === 'PENDING_STAFF_CONFIRMATION').length;
  const inProgressCount = list.filter(a => a.status === 'IN_PROGRESS').length;
  const completedCount = list.filter(a => a.status === 'COMPLETED').length;

  const statTotal = document.getElementById('stat-assignments-total');
  const statPending = document.getElementById('stat-assignments-pending');
  const statInProgress = document.getElementById('stat-assignments-inprogress');
  const statCompleted = document.getElementById('stat-assignments-completed');

  if (statTotal) statTotal.textContent = total;
  if (statPending) statPending.textContent = pendingCount;
  if (statInProgress) statInProgress.textContent = inProgressCount;
  if (statCompleted) statCompleted.textContent = completedCount;
};

window.renderAdminAssignmentsList = function(list) {
  const container = document.getElementById('admin-care-assignments-list-container') || document.getElementById('admin-assignments-list-container');
  if (!container) return;

  // Giữ số liệu thống kê luôn chính xác theo toàn bộ cache
  window.updateAdminAssignmentsStatsNumbers(window.adminAssignmentsCache);

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 20px; background:#fff; border-radius:16px; border:1px solid var(--border);">
        <i class="fa-solid fa-calendar-xmark" style="font-size:42px; color:var(--text-muted); margin-bottom:14px;"></i>
        <h4 style="color:#334155; margin-bottom:8px; font-weight:700;">Không tìm thấy lịch chăm sóc nào phù hợp</h4>
        <p style="color:var(--text-muted); font-size:13.5px; margin-bottom:16px;">Hãy thử điều chỉnh bộ lọc hoặc chọn mục thống kê khác.</p>
        <button class="btn btn-outline" onclick="resetAdminAssignmentsFilter()"><i class="fa-solid fa-rotate-right"></i> Làm Mới Bộ Lọc</button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(app => {
    let dateStr = app.appointmentDate || '';
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    if (dateStr.includes('-')) {
      const dp = dateStr.split('-');
      if (dp.length === 3) dateStr = `${dp[2]}/${dp[1]}/${dp[0]}`;
    }

    const appStatus = (app.status || '').trim().toUpperCase();
    const hasConfirmedStaff = !!(app.staffId || app.staff_id);
    const hasProposedStaff = !!(app.proposedStaffId || app.proposedStaffName);
    
    const isCancelled = appStatus === 'CANCELLED';
    const isCompleted = appStatus === 'COMPLETED';
    const isInProgress = appStatus === 'IN_PROGRESS';
    const isStaffRejected = appStatus === 'STAFF_REJECTED';
    const isAssigned = (appStatus === 'ASSIGNED' || hasConfirmedStaff) && !isCompleted && !isCancelled && !isInProgress;
    const isPendingStaffConfirm = (appStatus === 'PENDING_STAFF_CONFIRMATION' || (hasProposedStaff && !hasConfirmedStaff)) && !isCompleted && !isCancelled && !isInProgress && !isAssigned;

    let statusText = 'Chờ phân công';
    let statusBadgeCls = 'badge-status-pending';
    let statusIcon = 'fa-clock';
    let statusStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';

    if (isCancelled) {
      statusText = 'Đã hủy';
      statusBadgeCls = 'badge badge-danger';
      statusIcon = 'fa-ban';
      statusStyle = 'background:#fef2f2; color:#ef4444; border:1px solid #fecaca;';
    } else if (isCompleted) {
      statusText = 'Đã hoàn thành';
      statusBadgeCls = 'badge-status-paid';
      statusIcon = 'fa-circle-check';
      statusStyle = 'background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0;';
    } else if (isInProgress) {
      statusText = 'Đang thực hiện';
      statusBadgeCls = 'badge-status-inprogress';
      statusIcon = 'fa-spinner fa-spin';
      statusStyle = 'background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe;';
    } else if (isStaffRejected) {
      statusText = 'NV đã từ chối';
      statusBadgeCls = 'badge badge-danger';
      statusIcon = 'fa-circle-xmark';
      statusStyle = 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;';
    } else if (isAssigned) {
      statusText = 'Đã phân công';
      statusBadgeCls = 'badge-status-paid';
      statusIcon = 'fa-user-check';
      statusStyle = 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;';
    } else if (isPendingStaffConfirm) {
      statusText = 'Chờ NV xác nhận';
      statusBadgeCls = 'badge-status-pending';
      statusIcon = 'fa-clock';
      statusStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
    } else if (app.confirmed || app.status === 'CONFIRMED') {
      statusText = 'Đã xác nhận (Chờ phân công)';
      statusBadgeCls = 'badge-status-paid';
      statusIcon = 'fa-check';
      statusStyle = 'background:#ecfdf5; color:#059669; border:1px solid #a7f3d0;';
    }

    // Staff Display Block with quick action
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || '{}');
    const canAssign = ['STORE_MANAGER', 'RECEPTIONIST'].includes((currentUser.role || '').toUpperCase());
    let staffBlockHtml = '';
    const currentAssignedId = app.staffId || app.proposedStaffId || '';
    if (isCompleted) {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#ecfdf5; border:1px solid #a7f3d0; padding:4px 10px; border-radius:10px; font-size:12.5px;">
          <span style="color:#059669; font-weight:700;"><i class="fa-solid fa-user-check"></i> ${escapeHTML(app.staffName || 'Nhân viên chăm sóc')}</span>
        </div>
      `;
    } else if (isCancelled) {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#f8fafc; border:1px solid #e2e8f0; padding:4px 10px; border-radius:10px; font-size:12.5px;">
          <span style="color:#64748b; font-weight:700;"><i class="fa-solid fa-user"></i> ${escapeHTML(app.staffName || app.proposedStaffName || 'Chưa phân công')}</span>
        </div>
      `;
    } else if (isAssigned || isInProgress) {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#f0f9ff; border:1px solid #bae6fd; padding:4px 10px; border-radius:10px; font-size:12.5px;">
          <span style="color:#0284c7; font-weight:700;"><i class="fa-solid fa-user-check"></i> ${escapeHTML(app.staffName || 'Nhân viên')}</span>
          ${canAssign ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:11.5px; height:24px;" onclick="openAssignStaffModal('${app.id}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}', '${currentAssignedId}')" title="Đổi sang nhân viên khác"><i class="fa-solid fa-arrows-rotate"></i> Đổi NV</button>` : ''}
        </div>
      `;
    } else if (isPendingStaffConfirm) {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#fffbeb; border:1px solid #fde68a; padding:4px 10px; border-radius:10px; font-size:12.5px;">
          <span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-hourglass-half"></i> Đề xuất: ${escapeHTML(app.proposedStaffName || 'Nhân viên')}</span>
          ${canAssign ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:11.5px; height:24px;" onclick="openAssignStaffModal('${app.id}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}', '${currentAssignedId}')" title="Đổi nhân viên khác"><i class="fa-solid fa-arrows-rotate"></i> Đổi NV</button>` : ''}
        </div>
      `;
    } else if (isStaffRejected) {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#fef2f2; border:1px solid #fecaca; padding:4px 10px; border-radius:10px; font-size:12.5px;">
          <span style="color:#dc2626; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Đã từ chối (${escapeHTML(app.rejected_by_staff_name || 'NV')})</span>
          ${canAssign ? `<button class="btn btn-sm btn-warning" style="background:#f59e0b; border-color:#d97706; color:#fff; padding:2px 8px; font-size:11.5px; height:24px; font-weight:700;" onclick="openAssignStaffModal('${app.id}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}', '')" title="Phân công lại nhân viên khác"><i class="fa-solid fa-user-plus"></i> Phân công lại</button>` : ''}
        </div>
      `;
    } else {
      staffBlockHtml = `
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span style="color:#ea580c; font-weight:600; font-size:12.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Chưa phân công</span>
          ${canAssign ? `<button class="btn btn-sm btn-primary" style="padding:2px 10px; font-size:12px; height:26px; font-weight:700;" onclick="openAssignStaffModal('${app.id}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}', '')" title="Phân công nhân viên chăm sóc cho lịch này"><i class="fa-solid fa-user-plus"></i> Phân công</button>` : ''}
        </div>
      `;
    }

    let actionButtonsHtml = '';
    if (!isCompleted && !isCancelled) {
      actionButtonsHtml = `
        <div class="action-buttons" style="display:flex; gap:6px; flex-wrap:wrap;">
          ${(isAssigned || isInProgress) ? `<button class="btn btn-sm btn-primary" style="background:#ea580c; border-color:#c2410c; color:#fff; font-weight:700;" onclick="openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName || '')}', '${escapeHTML(app.examinationType || '')}')" title="Hoàn tất chăm sóc và lưu hồ sơ"><i class="fa-solid fa-pen-to-square"></i> Hoàn tất</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="openAppointmentDetailModal('${app.id}')" title="Xem chi tiết lịch hẹn"><i class="fa-solid fa-eye"></i> Chi tiết</button>
          <button class="btn btn-sm btn-outline" onclick="openAdminEditAppointmentModal('${app.id}')" title="Chỉnh sửa lịch hẹn"><i class="fa-solid fa-pen"></i> Sửa</button>
          <button class="btn btn-sm btn-outline" onclick="openRescheduleModal('${app.id}', '${app.appointmentDate}', '${app.appointmentTime || '09:00'}', '${(app.examinationType || '').replace(/'/g, "\\'")}')" title="Đổi ngày / giờ lịch hẹn"><i class="fa-solid fa-clock-rotate-left"></i> Đổi lịch</button>
          <button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment('${app.id}')" title="Hủy lịch hẹn"><i class="fa-solid fa-ban"></i> Hủy</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAppointment('${app.id}')" title="Xóa lịch hẹn khỏi database"><i class="fa-solid fa-trash"></i> Xóa</button>
        </div>
      `;
    } else if (isCompleted) {
      actionButtonsHtml = `
        <div class="action-buttons" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-sm btn-outline" onclick="openAppointmentDetailModal('${app.id}')" title="Xem chi tiết lịch hẹn"><i class="fa-solid fa-eye"></i> Chi tiết</button>
          <button class="btn btn-sm btn-outline" onclick="openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName || '')}', '${escapeHTML(app.examinationType || '')}')" title="Xem hồ sơ chăm sóc"><i class="fa-solid fa-clipboard-check"></i> Xem hồ sơ</button>
        </div>
      `;
    }

    const appCodeStr = app.id ? `#${app.id.substring(0, 8).toUpperCase()}` : '';

    return `
      <div class="appointment-item" style="background:#ffffff; border-radius:16px; padding:18px 20px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.03); margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div style="display:flex; align-items:flex-start; gap:16px; flex:1; min-width:300px;">
          <div class="schedule-time-box" style="background:#fff7ed; border:1px solid #ffedd5; padding:10px 16px; border-radius:12px; text-align:center; flex-shrink:0;">
            <div style="font-size:12px; font-weight:700; color:#64748b;">${dateStr}</div>
            <div style="font-size:16px; font-weight:900; color:var(--primary);">${app.appointmentTime || '09:00'}</div>
          </div>
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); background:#f1f5f9; padding:2px 8px; border-radius:6px;">${appCodeStr}</span>
              <h4 style="font-size:16px; font-weight:800; margin:0; color:#0f172a;">${escapeHTML(app.examinationType || 'Dịch vụ chăm sóc')}</h4>
              ${app.priority === 'HIGH' ? '<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:11px; font-weight:700; padding:2px 6px; border-radius:6px;">Ưu tiên cao</span>' : ''}
            </div>
            <div style="display:flex; gap:14px; font-size:13px; color:#475569; flex-wrap:wrap; margin-bottom:8px;">
              <span><i class="fa-solid fa-paw"></i> Bé: <b style="color:#0f172a;">${escapeHTML(app.petName || 'Thú cưng')}</b> (${escapeHTML(app.petSpecies || 'Pet')})</span>
              <span><i class="fa-solid fa-user"></i> Chủ: <b style="color:#0f172a;">${escapeHTML(app.ownerName || 'Khách hàng')}</b> ${app.ownerPhone ? `(${escapeHTML(app.ownerPhone)})` : ''}</span>
            </div>
            <div style="margin-bottom:6px;">
              ${staffBlockHtml}
            </div>
            ${!isCancelled && (app.note || app.reason) ? `<div style="font-size:12.5px; color:#64748b; font-style:italic; margin-top:4px;"> Ghi chú: ${escapeHTML(app.note || app.reason)}</div>` : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
          <span class="${statusBadgeCls}" style="font-size:12.5px; padding:6px 14px; border-radius:20px; font-weight:700; display:inline-flex; align-items:center; gap:6px; ${statusStyle}">
            <i class="fa-solid ${statusIcon}"></i> ${statusText}
          </span>
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  }).join('');
};

window.filterAdminAssignments = function() {
  const keyword = (document.getElementById('assignments-search-input')?.value || '').toLowerCase().trim();
  const staffFilter = document.getElementById('assignments-filter-staff')?.value || '';
  const statusFilter = document.getElementById('assignments-filter-status')?.value || '';
  const dateFilter = document.getElementById('assignments-filter-date')?.value || '';

  // Đồng bộ highlight của 4 ô thống kê theo trạng thái đang lọc
  if (statusFilter === 'PENDING_STAFF_CONFIRMATION') {
    window.activeAssignmentsStatFilter = 'PENDING_STAFF_CONFIRMATION';
  } else if (statusFilter === 'IN_PROGRESS') {
    window.activeAssignmentsStatFilter = 'IN_PROGRESS';
  } else if (statusFilter === 'COMPLETED') {
    window.activeAssignmentsStatFilter = 'COMPLETED';
  } else if (!statusFilter) {
    window.activeAssignmentsStatFilter = 'ALL';
  } else {
    window.activeAssignmentsStatFilter = null;
  }
  window.updateAdminAssignmentsStatCardsUI(window.activeAssignmentsStatFilter);

  let filtered = [...(window.adminAssignmentsCache || [])];

  if (keyword) {
    filtered = filtered.filter(a => {
      const code = (a.id || '').toLowerCase();
      const pet = (a.petName || '').toLowerCase();
      const owner = (a.ownerName || '').toLowerCase();
      const phone = (a.ownerPhone || '').toLowerCase();
      const staff = (a.staffName || a.proposedStaffName || '').toLowerCase();
      const service = (a.examinationType || '').toLowerCase();
      return code.includes(keyword) || pet.includes(keyword) || owner.includes(keyword) || phone.includes(keyword) || staff.includes(keyword) || service.includes(keyword);
    });
  }

  if (staffFilter) {
    if (staffFilter === 'UNASSIGNED') {
      filtered = filtered.filter(a => !a.staffId && !a.staff_id && !a.proposedStaffId);
    } else {
      filtered = filtered.filter(a => a.staffId === staffFilter || a.staff_id === staffFilter || a.proposedStaffId === staffFilter);
    }
  }

  if (statusFilter) {
    if (statusFilter === 'UNASSIGNED') {
      filtered = filtered.filter(a => !a.staffId && !a.staff_id && !a.proposedStaffId && a.status !== 'CANCELLED');
    } else if (statusFilter === 'ASSIGNED') {
      filtered = filtered.filter(a => (a.status === 'ASSIGNED' || a.staffId || a.staff_id) && !['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(a.status));
    } else {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
  }

  if (dateFilter) {
    filtered = filtered.filter(a => {
      const d = (a.appointmentDate || '').split('T')[0];
      return d === dateFilter;
    });
  }

  window.renderAdminAssignmentsList(filtered);
};

window.resetAdminAssignmentsFilter = function() {
  const searchInput = document.getElementById('assignments-search-input');
  const staffFilter = document.getElementById('assignments-filter-staff');
  const statusFilter = document.getElementById('assignments-filter-status');
  const dateFilter = document.getElementById('assignments-filter-date');

  if (searchInput) searchInput.value = '';
  if (staffFilter) staffFilter.value = '';
  if (statusFilter) statusFilter.value = '';
  if (dateFilter) dateFilter.value = '';

  window.selectAdminAssignmentsStatFilter('ALL');
};
