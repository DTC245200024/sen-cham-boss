/* =========================================================
   CARE SCHEDULES FRONTEND LOGIC (Views, Filters, CRUD)
   ========================================================= */

let currentScheduleRange = 'all';

function initScheduleUI() {
  const rangeBtns = document.querySelectorAll('.schedule-view-btn');
  const catFilter = document.getElementById('schedule-category-filter');
  const prioFilter = document.getElementById('schedule-priority-filter');
  const searchInput = document.getElementById('schedule-search-input');

  const scheduleForm = document.getElementById('schedule-form');

  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentScheduleRange = btn.getAttribute('data-range');
      loadSchedulesList();
    });
  });

  const petFilter = document.getElementById('schedule-pet-filter');

  if (catFilter) catFilter.addEventListener('change', loadSchedulesList);
  if (prioFilter) prioFilter.addEventListener('change', loadSchedulesList);
  if (petFilter) petFilter.addEventListener('change', loadSchedulesList);
  if (searchInput) searchInput.addEventListener('input', loadSchedulesList);

  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('schedule-form-id').value;
      if (!id) return; // Không cho phép tạo thủ công mới

      const data = {
        pet_id: document.getElementById('schedule-form-pet').value,
        task_name: document.getElementById('schedule-form-name').value.trim(),
        category: document.getElementById('schedule-form-category')?.value || 'KHÁC',
        priority: document.getElementById('schedule-form-priority')?.value || 'TRUNG_BÌNH',
        date: document.getElementById('schedule-form-date').value,
        time: document.getElementById('schedule-form-time').value,
        description: document.getElementById('schedule-form-desc')?.value || ''
      };

      if (!data.pet_id || !data.task_name || !data.date || !data.time) {
        showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)', 'warning');
        return;
      }

      const res = await apiRequest(`/schedules/${id}`, 'PUT', data);

      if (res && res.success) {
        showToast(res.message || 'Cập nhật lịch chăm sóc thành công!', 'success');
        closeModal('modal-schedule');
        try {
          if (window.loadSchedulesList) await window.loadSchedulesList();
          if (window.loadAppointmentsList) await window.loadAppointmentsList();
          if (window.loadDashboardData) window.loadDashboardData();
          if (window.loadNotifications) window.loadNotifications();
        } catch (uiErr) {
          console.warn('UI refresh warning after schedule submit:', uiErr);
        }
      } else {
        showToast(res?.message || 'Có lỗi xảy ra khi lưu lịch chăm sóc.', 'error');
      }
    });
  }
}


async function loadSchedulesList() {
  const petFilter = document.getElementById('schedule-pet-filter');
  if (petFilter && petFilter.options.length <= 1 && window.populatePetDropdowns) {
    const currentVal = petFilter.value;
    await window.populatePetDropdowns();
    petFilter.value = currentVal || 'ALL';
  }

  const cat = document.getElementById('schedule-category-filter')?.value || 'ALL';
  const prio = document.getElementById('schedule-priority-filter')?.value || 'ALL';
  const search = document.getElementById('schedule-search-input')?.value || '';
  const petId = petFilter?.value || 'ALL';

  if (window.fetchAndRenderAiReminders) {
    window.fetchAndRenderAiReminders();
  }

  const query = `?view=${currentScheduleRange}&category=${cat}&priority=${prio}&pet_id=${petId}&search=${encodeURIComponent(search)}`;
  const res = await apiRequest(`/schedules${query}`);

  const container = document.getElementById('schedule-list-container');
  if (!container || !res.success) return;

  // Loại bỏ lịch đã hủy khỏi danh sách hoạt động
  let schedulesToProcess = (res.schedules || []).filter(sch => sch.status !== 'ĐÃ_HỦY' && sch.status !== 'CANCELLED');
  if (currentScheduleRange === 'completed') {
    schedulesToProcess = schedulesToProcess.filter(sch => sch.status === 'ĐÃ_HOÀN_THÀNH');
  }

  if (schedulesToProcess.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); background:#fff; border-radius:var(--radius-md); border:1px solid var(--border);"><i class="fa-regular fa-calendar-xmark" style="font-size:24px; color:#9ca3af; margin-bottom:8px; display:block;"></i> Hiện tại không có lịch chăm sóc nào phù hợp.</div>`;
    return;
  }

  const uncompleted = schedulesToProcess.filter(sch => sch.status !== 'ĐÃ_HOÀN_THÀNH');
  const completed = schedulesToProcess.filter(sch => sch.status === 'ĐÃ_HOÀN_THÀNH');

  // Sort uncompleted so that QUÁ_HẠN appears first
  uncompleted.sort((a, b) => {
    if (a.status === 'QUÁ_HẠN' && b.status !== 'QUÁ_HẠN') return -1;
    if (b.status === 'QUÁ_HẠN' && a.status !== 'QUÁ_HẠN') return 1;
    return 0; // retain original backend sorting otherwise
  });

  const renderScheduleItem = (sch) => {
    const isDone = sch.status === 'ĐÃ_HOÀN_THÀNH';
    const canToggle = !isDone && Boolean(sch.can_toggle_complete);
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
    const isAdmin = currentUser && ['ADMIN','STORE_MANAGER'].includes(currentUser.role);
    const canEdit = !isDone && Boolean(sch.can_edit && isAdmin);
    const canDelete = !isDone && Boolean(sch.can_delete && isAdmin);
    const isAi = Boolean(sch.is_ai || (sch.task_name && (sch.task_name.includes('[AI') || sch.task_name.includes('<i class="fa-solid fa-robot"></i>'))));

    const isPaid = sch.payment_status === 'DA_THANH_TOAN' || sch.payment_status === 'PAID';
    const isConfirmed = Boolean(sch.is_reception_confirmed || isDone);
    const payMethodName = (sch.payment_method === 'CHUYEN_KHOAN' || sch.payment_method === 'TRANSFER') ? 'Chuyển khoản' : 'Tiền mặt';

    return `
      <div class="schedule-item ${isDone ? 'completed' : ''}" style="${sch.status === 'QUÁ_HẠN' ? 'border-left:4px solid var(--danger);' : ''}">
        <div style="display:flex; align-items:center; gap:16px; flex:1;">
          
          <!-- Complete Action: Clickable for authorized roles -->
          ${canToggle ? `
          <button class="btn btn-outline btn-sm" onclick="toggleCompleteSchedule('${sch.id}')" title="Đánh dấu hoàn thành" style="border-radius:50%; width:36px; height:36px; padding:0; flex-shrink:0; ${isDone ? 'background:var(--secondary); color:#fff; border-color:var(--secondary);' : ''}">
            <i class="fa-solid ${isDone ? 'fa-check' : 'fa-circle'}"></i>
          </button>
          ` : `
          <div style="border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border: 1px solid var(--border); flex-shrink:0; cursor:default; ${isDone ? 'background:var(--secondary); color:#fff; border-color:var(--secondary);' : 'background:#f1f5f9; color:#94a3b8;'}">
            <i class="fa-solid ${isDone ? 'fa-check' : 'fa-clock'}"></i>
          </div>
          `}

          <div class="schedule-time-box">
            <div>${formatDate(sch.date)}</div>
            <div style="font-size:15px; color:var(--primary);">${sch.time}</div>
          </div>

          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${sch.appointment_code ? `<span class="badge" style="background:#fff7ed; color:#c2410c; font-weight:700; border:1px solid #ffedd5; font-size:12px;"><i class="fa-solid fa-receipt"></i> ${sch.appointment_code}</span>` : ''}
              ${isAi ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:11px; padding:2px 8px; border-radius:4px;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI</span>' : ''}
              <h4 style="font-size:16px; font-weight:700; margin:0; color:#1f2937;">${sch.task_name}</h4>
            </div>

            <div style="display:flex; gap:10px; font-size:13px; color:var(--text-muted); margin-top:6px; flex-wrap:wrap; align-items:center;">
              <span><i class="fa-solid fa-paw" style="color:var(--primary);"></i> Thú cưng: <b>${sch.pet_name}</b></span>
              ${(currentUser && (['ADMIN','STORE_MANAGER'].includes(currentUser.role) || currentUser.role === 'RECEPTIONIST')) ? `<span>• <i class="fa-solid fa-user"></i> Chủ: <b>${sch.owner_name}</b></span>` : ''}
              <span>• ${getCategoryIcon(sch.category)}</span>
              <span>• HT: <b>${payMethodName}</b></span>
              ${sch.description ? `<span>• <i>${sch.description}</i></span>` : ''}
              ${(isDone && sch.execution_note) ? `<span style="color:#059669; font-weight:600;">• Ghi chú: ${sch.execution_note}</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">
          <!-- Trạng thái xác nhận -->
          ${isConfirmed 
            ? '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Đã xác nhận</span>'
            : '<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:600;"><i class="fa-solid fa-hourglass-half"></i> Chờ xác nhận</span>'}

          <!-- Trạng thái thanh toán -->
          ${isPaid 
            ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:600;"><i class="fa-solid fa-check"></i> Đã thanh toán</span>'
            : '<span class="badge" style="background:#ffedd5; color:#c2410c; font-weight:600;"><i class="fa-solid fa-clock"></i> Chờ thanh toán</span>'}

          ${getPriorityBadge(sch.priority)}
          ${getStatusBadge(sch.status)}

          ${canEdit ? `
          <button class="btn btn-outline btn-sm" onclick="editSchedule('${sch.id}')" title="Chỉnh sửa lịch">
            <i class="fa-solid fa-pen"></i> Sửa
          </button>
          ` : ''}
          ${canDelete ? `
          <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${sch.id}', '${escapeHTML(sch.task_name || '').replace(/'/g, "\\'")}')" title="Xóa lịch">
            <i class="fa-solid fa-trash"></i> Xóa
          </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  let html = '';

  
  if (uncompleted.length > 0) {
    html += `<h3 style="font-size:18px; font-weight:800; margin-bottom:12px; color:var(--text-color);">Lịch chưa hoàn thành</h3>`;
    html += uncompleted.map(renderScheduleItem).join('');
  }

  if (completed.length > 0) {
    if (uncompleted.length > 0) html += `<div style="height:32px;"></div>`;
    html += `<h3 style="font-size:18px; font-weight:800; margin-bottom:12px; color:var(--text-color);">Lịch đã hoàn thành</h3>`;
    html += completed.map(renderScheduleItem).join('');
  }

  container.innerHTML = html;
}

async function toggleCompleteSchedule(id) {
  const res = await apiRequest(`/schedules/${id}/toggle-complete`, 'PATCH');
  if (res.success) {
    showToast(res.message, 'success');
    loadSchedulesList();
    if (window.loadDashboardData) window.loadDashboardData();
  } else {
    showToast(res.message, 'error');
  }
}

async function editSchedule(id) {
  if (!id) return;
  if (window.populatePetDropdowns) await window.populatePetDropdowns();

  // Try fetching single schedule details from GET /api/schedules/:id
  let sch = null;
  const singleRes = await apiRequest(`/schedules/${id}`);
  if (singleRes && singleRes.success && singleRes.schedule) {
    sch = singleRes.schedule;
  } else {
    // Fallback: search in all schedules list
    const res = await apiRequest(`/schedules?view=all`);
    if (res && res.success && Array.isArray(res.schedules)) {
      sch = res.schedules.find((s) => s.id === id);
    }
  }

  if (!sch) {
    showToast('Không tìm thấy thông tin lịch chăm sóc cần chỉnh sửa.', 'error');
    return;
  }

  // Populate form fields
  document.getElementById('schedule-form-id').value = sch.id;
  document.getElementById('schedule-form-pet').value = sch.pet_id;
  document.getElementById('schedule-form-name').value = sch.task_name || '';
  if (document.getElementById('schedule-form-category')) {
    document.getElementById('schedule-form-category').value = sch.category || 'KHÁC';
  }
  if (document.getElementById('schedule-form-priority')) {
    document.getElementById('schedule-form-priority').value = sch.priority || 'TRUNG_BÌNH';
  }
  document.getElementById('schedule-form-date').value = sch.date || '';
  document.getElementById('schedule-form-time').value = sch.time || '08:00';
  if (document.getElementById('schedule-form-desc')) {
    document.getElementById('schedule-form-desc').value = sch.description || '';
  }

  // Update modal title and submit button text
  const modalTitle = document.getElementById('modal-schedule-title');
  if (modalTitle) modalTitle.innerText = 'Chỉnh Sửa Lịch Chăm Sóc';

  const submitBtn = document.getElementById('schedule-form-submit-btn');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
  }

  openModal('modal-schedule');
}


async function deleteSchedule(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa lịch "${name}"?`)) return;

  const res = await apiRequest(`/schedules/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message, 'success');
    loadSchedulesList();
    if (window.loadDashboardData) window.loadDashboardData();
  } else {
    showToast(res.message, 'error');
  }
}

window.initScheduleUI = initScheduleUI;
window.loadSchedulesList = loadSchedulesList;
window.toggleCompleteSchedule = toggleCompleteSchedule;
window.editSchedule = editSchedule;
window.deleteSchedule = deleteSchedule;

