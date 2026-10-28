/* =========================================================
   APPOINTMENTS & CARE SCHEDULE MANAGEMENT LOGIC
   (USER, CARE_STAFF, RECEPTIONIST, ADMIN)
   ========================================================= */

window.initAppointmentsUI = function() {
  const bookForm = document.getElementById('form-book-appointment');
  if (bookForm) {
    bookForm.onsubmit = async (e) => {
      e.preventDefault();
      
      const submitBtn = bookForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      
      try {
        const selectedPaymentMethod = document.querySelector('input[name="book_payment_method"]:checked')?.value || 'TIEN_MAT';
        const payload = {
          petId: document.getElementById('app-pet-id').value,
          priority: document.getElementById('app-priority')?.value || 'NORMAL',
          appointmentDate: document.getElementById('app-date').value,
          appointmentTime: document.getElementById('app-time').value,
          examinationType: document.getElementById('app-exam-type').value,
          weight: document.getElementById('app-weight')?.value || 0,
          reason: document.getElementById('app-reason')?.value || '',
          symptoms: document.getElementById('app-symptoms')?.value || '',
          note: document.getElementById('app-note')?.value || '',
          staffId: document.getElementById('app-staff-id')?.value || null,
          paymentMethod: selectedPaymentMethod
        };

        const res = await apiRequest('/appointments', 'POST', payload);
        if (res && res.success) {
          closeModal('modal-book-appointment');
          
          // Refetch both appointments and schedules immediately without F5
          try {
            if (window.loadAppointmentsList) await window.loadAppointmentsList();
            if (window.loadAdminAssignments) window.loadAdminAssignments();
            if (window.fetchAndRenderAiReminders) await window.fetchAndRenderAiReminders();
            if (window.loadSchedulesList) await window.loadSchedulesList();
            if (window.loadInvoicesList) window.loadInvoicesList();
            if (window.loadDashboardStats) window.loadDashboardStats();
            if (window.loadNotifications) window.loadNotifications();
          } catch (refetchErr) {
            console.warn('Post-booking UI refresh warning:', refetchErr);
          }
          
          if (res.appointment) {
            // Bước 2: Chuyển sang màn hình/modal Thanh toán
            window.showPostBookingPaymentStepModal(res.appointment);
          } else {
            showToast(res.message || 'Đặt lịch hẹn thành công!', 'success');
          }
        } else {
          showToast((res && res.message) || 'Lỗi đặt lịch hẹn', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  window.onSelectBookingPaymentMethod = function(method) {
    const lblCash = document.getElementById('lbl-book-pay-cash');
    const lblTransfer = document.getElementById('lbl-book-pay-transfer');
    if (method === 'TIEN_MAT') {
      if (lblCash) {
        lblCash.style.borderColor = 'var(--primary)';
        lblCash.style.background = '#fff7ed';
      }
      if (lblTransfer) {
        lblTransfer.style.borderColor = '#e2e8f0';
        lblTransfer.style.background = '#ffffff';
      }
    } else {
      if (lblCash) {
        lblCash.style.borderColor = '#e2e8f0';
        lblCash.style.background = '#ffffff';
      }
      if (lblTransfer) {
        lblTransfer.style.borderColor = 'var(--primary)';
        lblTransfer.style.background = '#fff7ed';
      }
    }
  };

  const adminEditForm = document.getElementById('form-admin-edit-appointment');
  if (adminEditForm) {
    adminEditForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('admin-edit-app-id').value;
      const petId = document.getElementById('admin-edit-app-pet').value;
      const appointmentDate = document.getElementById('admin-edit-app-date').value;
      const appointmentTime = document.getElementById('admin-edit-app-time').value;
      const examinationType = document.getElementById('admin-edit-app-service').value.trim();
      const priority = document.getElementById('admin-edit-app-priority').value;
      const status = document.getElementById('admin-edit-app-status').value;
      const staffId = document.getElementById('admin-edit-app-staff').value || null;
      const reason = document.getElementById('admin-edit-app-reason')?.value || '';
      const note = document.getElementById('admin-edit-app-notes')?.value || '';

      const payload = {
        petId,
        appointmentDate,
        appointmentTime,
        examinationType,
        priority,
        status,
        staffId,
        reason,
        note
      };

      const res = await apiRequest(`/appointments/${id}`, 'PUT', payload);
      if (res && res.success) {
        showToast(res.message || 'Cập nhật lịch hẹn thành công!', 'success');
        closeModal('modal-admin-edit-appointment');
        if (window.loadAppointmentsList) await window.loadAppointmentsList();
        if (window.loadAdminAssignments) window.loadAdminAssignments();
        if (window.loadSchedulesList) window.loadSchedulesList();
        if (window.loadInvoicesList) window.loadInvoicesList();
        if (window.loadDashboardStats) window.loadDashboardStats();
      } else {
        showToast((res && res.message) || 'Lỗi cập nhật lịch hẹn', 'error');
      }
    };
  }

  const rescheduleForm = document.getElementById('form-reschedule-appointment');
  if (rescheduleForm) {
    rescheduleForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('reschedule-app-id').value;
      const appointmentDate = document.getElementById('reschedule-app-date').value;
      const appointmentTime = document.getElementById('reschedule-app-time').value;
      const examinationType = document.getElementById('reschedule-app-service')?.value || '';
      const reason = document.getElementById('reschedule-app-reason').value;

      const payload = {
        appointmentDate,
        appointmentTime,
        reason
      };
      if (examinationType) {
        payload.examinationType = examinationType;
      }

      const res = await apiRequest(`/appointments/${id}/reschedule`, 'PUT', payload);

      if (res && res.success) {
        showToast(res.message || 'Đổi lịch hẹn thành công!', 'success');
        closeModal('modal-reschedule-appointment');
        if (window.loadAppointmentsList) window.loadAppointmentsList();
        if (window.loadAdminAssignments) window.loadAdminAssignments();
        if (window.fetchAndRenderAiReminders) window.fetchAndRenderAiReminders();
        if (window.loadSchedulesList) window.loadSchedulesList();
        if (window.loadNotifications) window.loadNotifications();
        if (window.loadInvoicesList) window.loadInvoicesList();
        if (window.loadDashboardStats) window.loadDashboardStats();
      } else {
        showToast((res && res.message) || 'Lỗi đổi lịch hẹn', 'error');
      }
    };
  }

  const assignForm = document.getElementById('form-assign-appointment');
  if (assignForm) {
    assignForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('assign-app-id').value;
      const staffId = document.getElementById('assign-staff-select').value;
      const note = document.getElementById('assign-staff-note')?.value || '';

      const res = await apiRequest(`/appointments/${id}/assign`, 'PUT', {
        staffId,
        note
      });

      if (res && res.success) {
        showToast(res.message || 'Phân công lịch cho nhân viên thành công!', 'success');
        closeModal('modal-assign-appointment');
        if (window.loadAppointmentsList) window.loadAppointmentsList();
        if (window.loadAdminAssignments) window.loadAdminAssignments();
        if (window.loadSchedulesList) window.loadSchedulesList();
      } else {
        showToast((res && res.message) || 'Lỗi phân công lịch', 'error');
      }
    };
  }

  const careRecordForm = document.getElementById('form-care-record');
  if (careRecordForm) {
    careRecordForm.onsubmit = async (e) => {
      e.preventDefault();
      const appId = document.getElementById('care-record-app-id').value;
      const care_content = document.getElementById('care-record-content')?.value || '';
      const condition_before = document.getElementById('care-condition-before')?.value || '';
      const condition_after = document.getElementById('care-condition-after')?.value || '';
      const notes = document.getElementById('care-record-notes')?.value || '';

      const res = await apiRequest(`/appointments/${appId}/care-record`, 'PUT', {
        care_content,
        condition_before,
        condition_after,
        notes
      });

      if (res && res.success) {
        showToast(res.message || 'Ghi nhận hồ sơ chăm sóc thành công!', 'success');
        closeModal('modal-care-record');
        loadAppointmentsList();
      } else {
        showToast((res && res.message) || 'Lỗi lưu hồ sơ chăm sóc', 'error');
      }
    };
  }

  const completeCareForm = document.getElementById('form-complete-care');
  const btnSubmitComplete = document.getElementById('btn-submit-complete-care');
  if (completeCareForm) {
    completeCareForm.onsubmit = async (e) => {
      e.preventDefault();
      const appId = document.getElementById('complete-care-app-id')?.value;
      if (!appId) {
        showToast('Không xác định được mã lịch hẹn.', 'error');
        return;
      }

      const care_content = (document.getElementById('complete-care-content')?.value || '').trim();
      const notes = (document.getElementById('complete-care-notes')?.value || '').trim();
      const weight = document.getElementById('complete-care-weight')?.value || null;

      if (!care_content) {
        showToast('Vui lòng nhập nội dung chăm sóc đã thực hiện.', 'warning');
        return;
      }

      // Khóa nút để tránh bấm nhiều lần tạo bản ghi trùng
      if (btnSubmitComplete) {
        btnSubmitComplete.disabled = true;
        btnSubmitComplete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
      }

      try {
        const res = await apiRequest(`/appointments/${appId}/complete`, 'PUT', {
          care_content,
          notes,
          condition_after: notes,
          condition_result: notes,
          weight
        });

        if (res && res.success) {
          showToast(res.message || 'Đã hoàn thành dịch vụ chăm sóc và lưu vào Hồ Sơ Chăm Sóc!', 'success');
          closeModal('modal-complete-care');
          if (window.loadAppointmentsList) window.loadAppointmentsList();
          if (window.fetchAndRenderAiReminders) window.fetchAndRenderAiReminders();
          if (window.loadSchedulesList) window.loadSchedulesList();
          if (window.loadNotifications) window.loadNotifications();
          if (window.loadAdminAssignments) window.loadAdminAssignments();
          if (window.loadDashboardData) window.loadDashboardData();
        } else {
          // Hiển thị đúng thông báo lỗi từ backend
          const errMsg = (res && res.message) ? res.message : 'Lỗi khi hoàn thành lịch chăm sóc.';
          showToast(errMsg, 'error');

          const alertEl = document.getElementById('complete-care-status-alert');
          if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(errMsg)}</div>`;
          }
          if (errMsg.includes('đã được hoàn thành') || errMsg.includes('đã bị hủy')) {
            if (btnSubmitComplete) {
              btnSubmitComplete.style.display = 'none';
            }
          }
        }
      } catch (err) {
        console.error('Error completing care:', err);
        showToast('Lỗi kết nối khi gửi yêu cầu hoàn tất lịch chăm sóc.', 'error');
      } finally {
        if (btnSubmitComplete && btnSubmitComplete.style.display !== 'none') {
          btnSubmitComplete.disabled = false;
          btnSubmitComplete.innerHTML = '<i class="fa-solid fa-check"></i> Xác Nhận Hoàn Tất';
        }
      }
    };
  }
};

window.loadAppointmentsList = async function() {
  const tbody = document.getElementById('appointments-list-container');
  const btnBook = document.getElementById('btn-book-appointment');
  const titleEl = document.getElementById('view-appointments-title');
  const subTitleEl = document.getElementById('view-appointments-subtitle');
  if (!tbody) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser) {
    tbody.innerHTML = `
      <div style="text-align:center; padding: 30px; color:var(--danger);">
        <p><i class="fa-solid fa-triangle-exclamation"></i> Vui lòng đăng nhập lại để xem lịch.</p>
        <button class="btn btn-outline" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Tải lại trang</button>
      </div>
    `;
    return;
  }

  const userRole = (currentUser.role || 'USER').toUpperCase();
  const isCareStaff = userRole === 'CARE_STAFF';
  const isReceptionistOrAdmin = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole);

  // Dynamic titles and book button visibility per role
  if (isCareStaff) {
    if (titleEl) titleEl.textContent = 'Lịch Chăm Sóc Phân Công';
    if (subTitleEl) subTitleEl.textContent = 'Danh sách lịch chăm sóc thú cưng được phân công cho bạn';
    if (btnBook) btnBook.style.display = 'none'; // Strictly NO book button for Care Staff
  } else if (userRole === 'RECEPTIONIST') {
    if (titleEl) titleEl.textContent = 'Quản lý Đặt & Lịch Hẹn';
    if (subTitleEl) subTitleEl.textContent = 'Tiếp nhận, phân công và quản lý lịch hẹn';
    if (btnBook) {
      btnBook.style.display = 'inline-block';
      btnBook.innerHTML = '<i class="fa-solid fa-plus"></i> Đặt Lịch Chăm Sóc';
    }
  } else if (userRole === 'ADMIN') {
    if (titleEl) titleEl.textContent = 'Quản lý Đặt & Lịch Hẹn';
    if (subTitleEl) subTitleEl.textContent = 'Quản trị, chỉnh sửa, đổi lịch và theo dõi toàn bộ lịch hẹn chăm sóc trong hệ thống';
    if (btnBook) btnBook.style.display = 'none'; // Strictly NO book button for ADMIN
  } else if (userRole === 'STORE_MANAGER') {
    if (titleEl) titleEl.textContent = 'Quản lý Đặt & Lịch Hẹn';
    if (subTitleEl) subTitleEl.textContent = 'Quản lý, tạo mới, chỉnh sửa, đổi lịch và điều phối toàn bộ lịch hẹn chăm sóc trong hệ thống';
    if (btnBook) {
      btnBook.style.display = 'inline-block';
      btnBook.innerHTML = '<i class="fa-solid fa-plus"></i> Đặt Lịch Chăm Sóc';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Đặt Lịch Chăm Sóc';
    if (subTitleEl) subTitleEl.textContent = 'Theo dõi và quản lý lịch hẹn cho thú cưng của bạn';
    if (btnBook) {
      btnBook.style.display = 'inline-block';
      btnBook.innerHTML = '<i class="fa-solid fa-plus"></i> Đặt Lịch Chăm Sóc';
    }
  }

  tbody.innerHTML = `
    <div style="text-align:center; padding: 40px; color:var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--primary); margin-bottom:12px;"></i>
      <div style="font-size:14px;">Đang tải danh sách lịch chăm sóc...</div>
    </div>
  `;

  try {
    const res = await apiRequest('/appointments');
    if (res && res.success && Array.isArray(res.appointments)) {
      if (res.appointments.length === 0) {
        tbody.innerHTML = `
          <div style="text-align:center; padding: 40px; background:var(--bg-card); border-radius:16px; border:1px solid var(--border);">
            <i class="fa-solid fa-calendar-check" style="font-size:36px; color:var(--text-muted); margin-bottom:12px;"></i>
            <h4 style="color:var(--text-muted); margin-bottom:8px;">${isCareStaff ? 'Chưa có lịch chăm sóc nào được phân công cho bạn' : 'Chưa có lịch hẹn nào'}</h4>
            ${(!isCareStaff && userRole !== 'ADMIN') ? '<button class="btn btn-primary" onclick="openBookAppointmentModal()">+ Đặt Lịch Chăm Sóc</button>' : ''}
          </div>
        `;
        return;
      }

      const renderedIds = new Set();
      const uniqueAppointments = res.appointments.filter(app => {
        if (renderedIds.has(app.id)) return false;
        renderedIds.add(app.id);
        return true;
      });

      tbody.innerHTML = uniqueAppointments.map(app => {
        let dateStr = app.appointmentDate || '';
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
        if (dateStr.includes('-')) {
          const dp = dateStr.split('-');
          if (dp.length === 3) dateStr = `${dp[2]}/${dp[1]}/${dp[0]}`;
        }
        
        const appStatus = (app.status || '').trim().toUpperCase();
        const hasConfirmedStaff = !!(app.staffId || app.staff_id);
        const hasProposedStaff = !!(app.proposedStaffId || app.proposedStaffName);
        const isReceptionConfirmed = !!(app.confirmed || app.is_confirmed || app.receptionist_confirmed || appStatus === 'CONFIRMED' || appStatus === 'ASSIGNED');
        
        const isCancelled = appStatus === 'CANCELLED';
        const isCompleted = appStatus === 'COMPLETED';
        const isInProgress = appStatus === 'IN_PROGRESS';
        const isStaffRejected = appStatus === 'STAFF_REJECTED';
        const isAssigned = (appStatus === 'ASSIGNED' || hasConfirmedStaff) && !isCompleted && !isCancelled && !isInProgress;
        const isPendingStaffConfirm = (appStatus === 'PENDING_STAFF_CONFIRMATION' || (hasProposedStaff && !hasConfirmedStaff && isReceptionConfirmed)) && !isCompleted && !isCancelled && !isInProgress && !isAssigned;
        const isConfirmed = (appStatus === 'CONFIRMED' || isReceptionConfirmed) && !hasConfirmedStaff && !hasProposedStaff && !isCompleted && !isCancelled && !isInProgress && !isPendingStaffConfirm && !isAssigned;
        const isPending = !isReceptionConfirmed && !isConfirmed && !isAssigned && !isPendingStaffConfirm && !isInProgress && !isCompleted && !isCancelled && !isStaffRejected;

        let statusText = 'Chờ xác nhận';
        let statusBadgeCls = 'badge-status-pending';
        let statusIcon = 'fa-clock';
        let statusCustomStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';

        if (isCancelled) {
          statusText = 'Đã hủy';
          statusBadgeCls = 'badge badge-danger';
          statusIcon = 'fa-ban';
          statusCustomStyle = 'background:#fef2f2; color:#ef4444; border:1px solid #fecaca;';
        } else if (isCompleted) {
          statusText = 'Đã hoàn thành';
          statusBadgeCls = 'badge-status-paid';
          statusIcon = 'fa-circle-check';
          statusCustomStyle = 'background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0;';
        } else if (!isReceptionistOrAdmin && !isCareStaff) {
          // GIAO DIỆN CHỦ NUÔI:
          if (isPending) {
            statusText = 'Chờ xác nhận';
            statusBadgeCls = 'badge-status-pending';
            statusIcon = 'fa-clock';
            statusCustomStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
          } else {
            // Tất cả trạng thái sau khi đã được xác nhận đều hiển thị là "<i class="fa-solid fa-check"></i> Đã xác nhận"
            statusText = '<i class="fa-solid fa-check"></i> Đã xác nhận';
            statusBadgeCls = 'badge-status-paid';
            statusIcon = 'fa-check';
            statusCustomStyle = 'background:#ecfdf5; color:#059669; border:1px solid #a7f3d0;';
          }
        } else if (isInProgress) {
          statusText = 'Đang thực hiện';
          statusBadgeCls = 'badge-status-inprogress';
          statusIcon = 'fa-spinner fa-spin';
          statusCustomStyle = 'background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe;';
        } else if (isStaffRejected) {
          statusText = 'Đã từ chối';
          statusBadgeCls = 'badge badge-danger';
          statusIcon = 'fa-circle-xmark';
          statusCustomStyle = 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;';
        } else if (isAssigned) {
          statusText = 'Đã phân công';
          statusBadgeCls = 'badge-status-paid';
          statusIcon = 'fa-user-check';
          statusCustomStyle = 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;';
        } else if (isPendingStaffConfirm) {
          statusText = 'Chờ nhân viên xác nhận';
          statusBadgeCls = 'badge-status-pending';
          statusIcon = 'fa-clock';
          statusCustomStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
        } else if (isConfirmed) {
          statusText = 'Đã xác nhận';
          statusBadgeCls = 'badge-status-paid';
          statusIcon = 'fa-check';
          statusCustomStyle = 'background:#ecfdf5; color:#059669; border:1px solid #a7f3d0;';
        } else {
          statusText = 'Chờ xác nhận';
          statusBadgeCls = 'badge-status-pending';
          statusIcon = 'fa-clock';
          statusCustomStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
        }

        // Thông tin hiển thị nhân viên theo quy trình xác nhận
        let staffDisplayHtml = '';
        if (isCompleted) {
          staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <b style="color:#0284c7;">${escapeHTML(app.staffName || 'Nhân viên chăm sóc')}</b></span>`;
        } else if (isCancelled) {
          staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <b>${escapeHTML(app.staffName || app.proposedStaffName || 'Chưa phân công')}</b></span>`;
        } else if (!isReceptionistOrAdmin && !isCareStaff) {
          // Giao diện Chủ nuôi
          const ownerStaff = app.staffName || app.proposedStaffName;
          if (ownerStaff) {
            staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <b style="color:#0284c7;">${escapeHTML(ownerStaff)}</b></span>`;
          } else {
            staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <span style="color:#64748b;">Chưa phân công</span></span>`;
          }
        } else if (isAssigned || isInProgress) {
          staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <b style="color:#0284c7;">${escapeHTML(app.staffName || 'Nhân viên chăm sóc')}</b></span>`;
        } else if (isPendingStaffConfirm) {
          staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Nhân viên: <b style="color:#d97706;">${escapeHTML(app.proposedStaffName || 'Đang đề xuất')}</b></span>`;
        } else if (isStaffRejected) {
          staffDisplayHtml = `<span><i class="fa-solid fa-user"></i> Từ chối bởi: <b style="color:#ef4444;">${escapeHTML(app.rejected_by_staff_name || app.proposedStaffName || 'Nhân viên')}</b>${app.reject_reason ? ` <span style="color:#dc2626; font-size:12px;">(${escapeHTML(app.reject_reason)})</span>` : ''}</span>`;
        } else {
          staffDisplayHtml = '<span style="color:#f59e0b;"><i class="fa-solid fa-user"></i> Nhân viên: Chưa phân công</span>';
        }

        const appCodeStr = app.id ? `#${app.id.substring(0, 8).toUpperCase()}` : '';
        const isTransferPay = app.paymentMethod === 'CHUYEN_KHOAN' || app.paymentMethod === 'CHUYEN_KHOAN_VIETQR' || app.paymentMethod === 'CHUYEN_KHOAN_NGAN_HANG';
        const payMethodLabel = isTransferPay ? 'Chuyển khoản' : 'Tiền mặt tại cửa hàng';
        const isPaidApp = (app.paymentStatus === 'PAID');

        let actionHtml = '';

        // NGUYÊN TẮC: Khi lịch ĐÃ HỦY hoặc ĐÃ HOÀN THÀNH, TUYỆT ĐỐI KHÔNG HIỂN THỊ BẤT KỲ NÚT NÀO CHO TẤT CẢ TÁC NHÂN
        if (isCancelled || isCompleted) {
          actionHtml = '';
        } else if (['ADMIN','STORE_MANAGER'].includes(userRole)) {
          // ADMIN & STORE MANAGER ACTIONS cho lịch chưa hoàn thành và chưa bị hủy:
          if (userRole === 'STORE_MANAGER' && !isPaidApp && !isCancelled) {
            actionHtml += `<button class="btn btn-sm btn-success" style="background:#10b981; border-color:#059669; color:#fff; font-weight:700;" onclick="receptionConfirmPayment('${app.id}', '${escapeHTML(app.ownerName || 'Khách hàng')}', '${escapeHTML(app.petName || 'Bé cưng')}', '${escapeHTML(app.examinationType || 'Dịch vụ')}', ${app.estimatedPrice || app.price || 150000}, '${app.paymentMethod || 'TIEN_MAT'}')" title="Xác nhận đã thanh toán"><i class="fa-solid fa-file-invoice-dollar"></i> Xác nhận TT</button> `;
          }
          if (isAssigned || isConfirmed || isInProgress) {
            actionHtml += `<button class="btn btn-sm btn-primary" style="background:#ea580c; border-color:#c2410c; color:#fff; font-weight:700;" onclick="openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}')" title="Hoàn tất chăm sóc và lưu hồ sơ"><i class="fa-solid fa-pen-to-square"></i> Hoàn tất chăm sóc</button> `;
          }
          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openAppointmentDetailModal('${app.id}')" title="Xem chi tiết lịch hẹn"><i class="fa-solid fa-eye"></i> Chi tiết</button> `;
          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openAdminEditAppointmentModal('${app.id}')" title="Sửa thông tin lịch hẹn"><i class="fa-solid fa-pen"></i> Sửa</button> `;
          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openRescheduleModal('${app.id}', '${app.appointmentDate}', '${app.appointmentTime || '09:00'}', '${(app.examinationType || '').replace(/'/g, "\\'")}')" title="Đổi ngày / giờ lịch hẹn"><i class="fa-solid fa-clock-rotate-left"></i> Đổi lịch</button> `;
          actionHtml += `<button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment('${app.id}')" title="Hủy lịch hẹn"><i class="fa-solid fa-ban"></i> Hủy</button> `;
          actionHtml += `<button class="btn btn-sm btn-danger" onclick="deleteAppointment('${app.id}')" title="Xóa lịch hẹn khỏi database"><i class="fa-solid fa-trash"></i> Xóa</button>`;
        } else if (isCareStaff) {
          // CARE STAFF ACTIONS cho lịch chưa hoàn thành và chưa bị hủy:
          if (isPendingStaffConfirm) {
            actionHtml += `<button class="btn btn-sm btn-success" style="background:#10b981; border-color:#059669; color:#fff; font-weight:700;" onclick="acceptCareAppointment('${app.id}')" title="Xác nhận nhận lịch chăm sóc"><i class="fa-solid fa-check"></i> Xác nhận</button> `;
            actionHtml += `<button class="btn btn-sm btn-outline-danger" onclick="rejectCareAppointment('${app.id}')" title="Từ chối nhận lịch này"><i class="fa-solid fa-xmark"></i> Từ chối</button> `;
          } else if (isAssigned || isConfirmed || isInProgress) {
            actionHtml += `<button class="btn btn-sm btn-primary" style="background:#ea580c; border-color:#c2410c; color:#fff; font-weight:700;" onclick="openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}')" title="Hoàn tất chăm sóc và lưu hồ sơ"><i class="fa-solid fa-pen-to-square"></i> Hoàn tất chăm sóc</button> `;
          }
          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openHealthForPet('${app.petId}')" title="Xem hồ sơ chăm sóc"><i class="fa-solid fa-eye"></i> Xem hồ sơ</button> `;
        } else if (userRole === 'RECEPTIONIST') {
          // RECEPTIONIST ACTIONS cho lịch chưa hoàn thành và chưa bị hủy:
          if (!isPaidApp && !isCancelled) {
            actionHtml += `<button class="btn btn-sm btn-success" style="background:#10b981; border-color:#059669; color:#fff; font-weight:700;" onclick="receptionConfirmPayment('${app.id}', '${escapeHTML(app.ownerName || 'Khách hàng')}', '${escapeHTML(app.petName || 'Bé cưng')}', '${escapeHTML(app.examinationType || 'Dịch vụ')}', ${app.estimatedPrice || app.price || 150000}, '${app.paymentMethod || 'TIEN_MAT'}')" title="Xác nhận đã thanh toán"><i class="fa-solid fa-file-invoice-dollar"></i> Xác nhận TT</button> `;
          }

          if (isPending) {
            actionHtml += `<button class="btn btn-sm btn-primary" onclick="receptionConfirmAppointment('${app.id}')" title="Xác nhận lịch hẹn"><i class="fa-solid fa-check"></i> Xác nhận</button> `;
            actionHtml += `<button class="btn btn-sm btn-outline" style="opacity:0.6; cursor:not-allowed; border-style:dashed;" onclick="showToast('Vui lòng xác nhận lịch trước khi phân công nhân viên.', 'warning')" title="Vui lòng xác nhận lịch trước khi phân công nhân viên"><i class="fa-solid fa-lock"></i> Phân công <i class="fa-solid fa-lock"></i></button> `;
          } else {
            const assignBtnLabel = isStaffRejected ? 'Phân công lại' : (isPendingStaffConfirm || isAssigned ? 'Phân công lại' : 'Phân công');
            const assignBtnCls = isStaffRejected ? 'btn-warning' : 'btn-outline';
            const assignBtnStyle = isStaffRejected ? 'background:#f59e0b; border-color:#d97706; color:#fff;' : '';

            actionHtml += `<button class="btn btn-sm ${assignBtnCls}" style="${assignBtnStyle}" onclick="openAssignStaffModal('${app.id}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}', '${app.proposedStaffId || app.staffId || ''}')" title="${assignBtnLabel}"><i class="fa-solid fa-user-tag"></i> ${assignBtnLabel}</button> `;

            // Lễ tân có thể hoàn tất dịch vụ chăm sóc khi lịch đã phân công / xác nhận / đang thực hiện
            if (isAssigned || isConfirmed || isInProgress) {
              actionHtml += `<button class="btn btn-sm btn-primary" style="background:#ea580c; border-color:#c2410c; color:#fff; font-weight:700;" onclick="openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName)}', '${escapeHTML(app.examinationType)}')" title="Hoàn tất chăm sóc và lưu hồ sơ"><i class="fa-solid fa-pen-to-square"></i> Hoàn tất chăm sóc</button> `;
            }
          }

          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openRescheduleModal('${app.id}', '${app.appointmentDate}', '${app.appointmentTime || '09:00'}', '${(app.examinationType || '').replace(/'/g, "\\'")}')" title="Đổi lịch hẹn"><i class="fa-solid fa-clock-rotate-left"></i> Đổi lịch</button> `;
          
          if (isPending || isPendingStaffConfirm || isStaffRejected || isConfirmed) {
            actionHtml += `<button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment('${app.id}')"><i class="fa-solid fa-ban"></i> Hủy</button> `;
          }
          actionHtml += `<button class="btn btn-sm btn-outline" onclick="openHealthForPet('${app.petId}')" title="Xem hồ sơ chăm sóc"><i class="fa-solid fa-eye"></i> Xem hồ sơ</button> `;
          if (app.ownerId || app.userId) {
            actionHtml += `<button class="btn btn-sm btn-outline" onclick="openChatFromAppointment('${app.id}', '${app.ownerId || app.userId}', '${escapeHTML(app.ownerName || 'Khách hàng')}', '${app.petId}', '${escapeHTML(app.petName || 'Thú cưng')}', '${escapeHTML(app.examinationType || '')}', '${app.appointmentDate}', '${app.appointmentTime || ''}', '${app.status}')" title="Nhắn tin với khách hàng"><i class="fa-solid fa-comment"></i> Nhắn tin</button> `;
          }
        } else {
          // GIAO DIỆN CHỦ NUÔI (USER / OWNER ACTIONS):
          if (isPending) {
            actionHtml += `<button class="btn btn-sm btn-outline" onclick="openRescheduleModal('${app.id}', '${app.appointmentDate}', '${app.appointmentTime || '09:00'}', '${(app.examinationType || '').replace(/'/g, "\\'")}')" title="Đổi ngày, giờ hoặc dịch vụ"><i class="fa-solid fa-clock-rotate-left"></i> Đổi lịch</button> `;
            actionHtml += `<button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment('${app.id}')" title="Hủy lịch hẹn này"><i class="fa-solid fa-ban"></i> Hủy lịch</button>`;
          } else {
            // Khi ĐÃ XÁC NHẬN: Không hiển thị bất kỳ nút thao tác đổi/hủy/nhắn tin nào, thẻ lịch hiển thị gọn gàng
            actionHtml = '';
          }
        }

        // Chú thích / Thông báo ngữ cảnh cho từng trạng thái
        let statusNoticeHtml = '';
        if (!isCancelled && !isCompleted && isReceptionistOrAdmin) {
          if (isStaffRejected) {
            statusNoticeHtml = `
              <div style="margin-top: 6px; font-size: 12.5px; color: #dc2626; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                <i class="fa-solid fa-triangle-exclamation"></i> Nhân viên đã từ chối nhận lịch. Vui lòng bấm "Phân công lại" để chọn nhân viên khác.
              </div>
            `;
          }
        }

        let paymentBadgeHtml = '';
        if (isCancelled) {
          paymentBadgeHtml = `<span style="font-size:12px; color:#94a3b8;"><i class="fa-solid fa-credit-card"></i> TT: ${payMethodLabel}</span>`;
        } else if (isPaidApp) {
          paymentBadgeHtml = `<span style="font-size:12px; font-weight:700; color:#059669; background:#ecfdf5; border:1px solid #a7f3d0; padding:2px 8px; border-radius:8px;"><i class="fa-solid fa-circle-check"></i> Đã thanh toán (${payMethodLabel})</span>`;
        } else {
          paymentBadgeHtml = `<span style="font-size:12px; font-weight:700; color:#d97706; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:8px;"><i class="fa-solid fa-clock"></i> Chờ xác nhận TT (${payMethodLabel})</span>`;
        }

        // Add invoice view button for USER if invoice is created
        let userInvoiceBtn = '';
        if (!isReceptionistOrAdmin && !isCareStaff && isPaidApp) {
          userInvoiceBtn = `<button class="btn btn-sm btn-outline" style="border-color:#10b981; color:#059669;" onclick="window.switchView('invoices')" title="Xem hóa đơn"><i class="fa-solid fa-file-invoice-dollar"></i> Xem hóa đơn</button> `;
        }

        return `
          <div class="appointment-item" style="background:#ffffff; border-radius:16px; padding:18px 20px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.03); margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:flex-start; gap:16px; flex:1; min-width:280px;">
              <div class="schedule-time-box" style="background:#fff7ed; border:1px solid #ffedd5; padding:10px 16px; border-radius:12px; text-align:center; flex-shrink:0;">
                <div style="font-size:12px; font-weight:700; color:#64748b;">${dateStr}</div>
                <div style="font-size:16px; font-weight:900; color:var(--primary);">${app.appointmentTime || '09:00'}</div>
              </div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                  <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); background:#f1f5f9; padding:2px 8px; border-radius:6px;">${appCodeStr}</span>
                  <h4 style="font-size:16px; font-weight:800; margin:0; color:#0f172a;">${escapeHTML(app.examinationType || 'Dịch vụ chăm sóc')}</h4>
                </div>
                <div style="display:flex; gap:14px; font-size:13px; color:#475569; flex-wrap:wrap; margin-bottom:4px;">
                  <span><i class="fa-solid fa-paw"></i> Bé: <b style="color:#0f172a;">${escapeHTML(app.petName || 'Thú cưng')}</b> (${escapeHTML(app.petSpecies || 'Pet')})</span>
                  <span><i class="fa-solid fa-user"></i> Chủ: <b style="color:#0f172a;">${escapeHTML(app.ownerName || 'Khách hàng')}</b></span>
                  ${staffDisplayHtml}
                </div>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
                  ${paymentBadgeHtml}
                </div>
                ${!isCancelled && (app.note || app.reason) ? `<div style="font-size:12.5px; color:#64748b; margin-top:4px; font-style:italic;"> Ghi chú: ${escapeHTML(app.note || app.reason)}</div>` : ''}
                ${statusNoticeHtml}
              </div>
            </div>
            
            <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
              <span class="${statusBadgeCls}" style="font-size:12.5px; padding:6px 14px; border-radius:20px; font-weight:700; display:inline-flex; align-items:center; gap:6px; ${statusCustomStyle}">
                <i class="fa-solid ${statusIcon}"></i> ${statusText}
              </span>
              <div class="action-buttons" style="display:flex; gap:6px; flex-wrap:wrap;">
                ${userInvoiceBtn}
                ${actionHtml}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      const errorMsg = (res && res.message) ? res.message : 'Không thể tải lịch hẹn.';
      tbody.innerHTML = `
        <div style="text-align:center; padding: 40px; background:var(--bg-card); border-radius:16px; border:1px solid var(--border);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="color:var(--danger); font-size:15px; margin-bottom:16px;">${errorMsg}</p>
          <button class="btn btn-outline" onclick="loadAppointmentsList()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button>
        </div>
      `;
    }
  } catch (err) {
    console.error('loadAppointmentsList error:', err);
    tbody.innerHTML = `
      <div style="text-align:center; padding: 40px; background:var(--bg-card); border-radius:16px; border:1px solid var(--border);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
        <p style="color:var(--danger); font-size:15px; margin-bottom:16px;">Không thể kết nối đến máy chủ. Vui lòng thử lại.</p>
        <button class="btn btn-outline" onclick="loadAppointmentsList()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button>
      </div>
    `;
  }
};

window.acceptCareAppointment = async function(id) {
  try {
    const res = await apiRequest(`/appointments/${id}/accept`, 'PUT');
    if (res && res.success) {
      showToast('Đã xác nhận nhận lịch chăm sóc thành công!', 'success');
      loadAppointmentsList();
      if (window.loadNotifications) window.loadNotifications();
    } else {
      showToast((res && res.message) || 'Lỗi xác nhận lịch', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ', 'error');
  }
};

window.rejectCareAppointment = async function(id) {
  const reason = prompt('Vui lòng nhập lý do từ chối nhận lịch (tùy chọn):', '');
  if (reason === null) return; // Người dùng bấm Cancel trên hộp thoại

  try {
    const res = await apiRequest(`/appointments/${id}/reject`, 'PUT', { reject_reason: reason });
    if (res && res.success) {
      showToast('Đã từ chối nhận lịch chăm sóc. Hệ thống đã thông báo cho Quản lý / Lễ tân.', 'info');
      loadAppointmentsList();
      if (window.loadNotifications) window.loadNotifications();
    } else {
      showToast((res && res.message) || 'Lỗi khi từ chối nhận lịch', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ khi từ chối lịch', 'error');
  }
};

window.startCareAppointment = async function(id) {
  try {
    const res = await apiRequest(`/appointments/${id}/start`, 'PUT');
    if (res && res.success) {
      showToast('Đã bắt đầu thực hiện chăm sóc!', 'success');
      loadAppointmentsList();
    } else {
      showToast((res && res.message) || 'Lỗi bắt đầu chăm sóc', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ', 'error');
  }
};

window.updateCareAppointmentStatus = async function(id, status) {
  try {
    const res = await apiRequest(`/appointments/${id}/status`, 'PUT', { status });
    if (res && res.success) {
      showToast('Cập nhật trạng thái thành công!', 'success');
      loadAppointmentsList();
    } else {
      showToast((res && res.message) || 'Lỗi cập nhật trạng thái', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ', 'error');
  }
};

window.openAssignStaffModal = async function(appId, petName, examType, currentStaffId) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || '{}');
  if (currentUser?.role === 'ADMIN') {
    showToast('Quản trị viên không trực tiếp thực hiện phân công nhân viên.', 'warning');
    return;
  }
  const summaryEl = document.getElementById('assign-app-summary');
  const select = document.getElementById('assign-staff-select');
  const inputId = document.getElementById('assign-app-id');
  if (!select || !inputId) return;

  inputId.value = appId;
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>Dịch vụ:</strong> ${escapeHTML(examType)} | <strong>Bé:</strong> <i class="fa-solid fa-paw"></i> ${escapeHTML(petName)}`;
  }

  // Set loading placeholder
  select.innerHTML = '<option value="">-- Đang tải danh sách nhân viên chăm sóc... --</option>';

  // Load staff with role CARE_STAFF
  let staffList = [];
  try {
    const res = await apiRequest('/users/staff');
    if (res && res.success && (res.staff || res.users)) {
      staffList = res.staff || res.users;
    } else {
      const fallbackRes = await apiRequest('/users?role=CARE_STAFF');
      if (fallbackRes && fallbackRes.success && (fallbackRes.staff || fallbackRes.users)) {
        staffList = fallbackRes.staff || fallbackRes.users;
      }
    }
  } catch (err) {
    console.error('Lỗi tải danh sách nhân viên chăm sóc:', err);
  }

  // Filter active care staff
  staffList = (staffList || []).filter(u => {
    const r = (u.role || '').toUpperCase();
    const isCareStaff = r === 'CARE_STAFF' || r === 'STAFF';
    const isActive = u.status !== 'LOCKED' && u.status !== 'DELETED';
    return isCareStaff && isActive;
  });

  if (staffList.length === 0) {
    select.innerHTML = '<option value="">-- Chưa có tài khoản Nhân viên chăm sóc nào --</option>';
  } else {
    select.innerHTML = '<option value="">-- Chọn nhân viên chăm sóc --</option>' + 
      staffList.map(s => {
        const contact = s.phone || s.email || '';
        return `<option value="${s.id}" ${s.id === currentStaffId ? 'selected' : ''}>${escapeHTML(s.full_name)}${contact ? ` (${escapeHTML(contact)})` : ''}</option>`;
      }).join('');
  }

  openModal('modal-assign-appointment');
};

window.openCareRecordModal = function(appId, petId, petName, examType) {
  const inputAppId = document.getElementById('care-record-app-id');
  const inputPetId = document.getElementById('care-record-pet-id');
  const summaryEl = document.getElementById('care-record-summary');
  if (!inputAppId || !inputPetId) return;

  inputAppId.value = appId;
  inputPetId.value = petId;
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>Dịch vụ chăm sóc:</strong> ${escapeHTML(examType)} | <strong>Bé cưng:</strong> <i class="fa-solid fa-paw"></i> ${escapeHTML(petName)}`;
  }

  const inputContent = document.getElementById('care-record-content');
  if (inputContent) inputContent.value = examType || '';

  openModal('modal-care-record');
};

window.openCompleteCareModal = async function(appId, petId, petName, examType) {
  const inputAppId = document.getElementById('complete-care-app-id');
  const inputPetId = document.getElementById('complete-care-pet-id');
  const summaryEl = document.getElementById('complete-care-summary');
  const inputContent = document.getElementById('complete-care-content');
  const inputNotes = document.getElementById('complete-care-notes');
  const alertEl = document.getElementById('complete-care-status-alert');
  const btnSubmit = document.getElementById('btn-submit-complete-care');

  if (!inputAppId || !inputPetId) return;

  inputAppId.value = appId;
  inputPetId.value = petId || '';
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>Dịch vụ chăm sóc:</strong> ${escapeHTML(examType || 'Dịch vụ')} | <strong>Bé cưng:</strong> <i class="fa-solid fa-paw"></i> <b>${escapeHTML(petName || 'Thú cưng')}</b>`;
  }
  if (inputContent) {
    inputContent.value = examType || '';
    inputContent.readOnly = false;
  }
  if (inputNotes) {
    inputNotes.value = '';
    inputNotes.readOnly = false;
  }
  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.innerHTML = '';
  }
  if (btnSubmit) {
    btnSubmit.style.display = 'inline-flex';
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Xác Nhận Hoàn Tất';
  }

  // Lấy dữ liệu mới nhất của lịch hẹn để kiểm tra trạng thái thực tế mà không tự động chuyển trạng thái
  try {
    const res = await apiRequest(`/appointments/${appId}`);
    if (res && res.success && res.appointment) {
      const app = res.appointment;
      if (summaryEl) {
        summaryEl.innerHTML = `<strong>Mã lịch:</strong> #${(app.id || '').substring(0, 8).toUpperCase()} | <strong>Dịch vụ:</strong> ${escapeHTML(app.examinationType || examType || 'Dịch vụ')} | <strong>Bé cưng:</strong> <i class="fa-solid fa-paw"></i> <b>${escapeHTML(app.petName || petName || 'Thú cưng')}</b>`;
      }
      if (app.care_content && inputContent) {
        inputContent.value = app.care_content;
      }
      if (app.notes && inputNotes) {
        inputNotes.value = app.notes;
      }

      // Xử lý theo trạng thái lịch (Yêu cầu 2: Không tự động chuyển trạng thái khi chỉ mở modal)
      if (app.status === 'COMPLETED') {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.innerHTML = `<div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Lịch chăm sóc này đã được hoàn thành trước đó${app.completedAt || app.completed_at ? ' (' + (app.completed_by ? app.completed_by + ' - ' : '') + formatDate(app.completedAt || app.completed_at) + ')' : ''}. Đang ở chế độ xem chi tiết.</div>`;
        }
        if (btnSubmit) {
          btnSubmit.style.display = 'none';
        }
        if (inputContent) inputContent.readOnly = true;
        if (inputNotes) inputNotes.readOnly = true;
      } else if (app.status === 'CANCELLED') {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:600;"><i class="fa-solid fa-ban"></i> Lịch chăm sóc này đã bị hủy, không thể thực hiện hoàn tất.</div>`;
        }
        if (btnSubmit) {
          btnSubmit.style.display = 'none';
        }
        if (inputContent) inputContent.readOnly = true;
        if (inputNotes) inputNotes.readOnly = true;
      }
    }
  } catch (e) {
    console.warn('Could not prefetch appointment status', e);
  }

  openModal('modal-complete-care');
};

window.receptionConfirmAppointment = async function(id) {
  try {
    const res = await apiRequest(`/appointments/${id}/confirm`, 'PUT');
    if (res && res.success) {
      showToast(res.message || 'Đã xác nhận lịch hẹn thành công! Bạn có thể phân công nhân viên.', 'success');
      loadAppointmentsList();
      if (window.loadNotifications) window.loadNotifications();
    } else {
      showToast((res && res.message) || 'Lỗi xác nhận lịch hẹn', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ khi xác nhận lịch', 'error');
  }
};

window.receptionConfirmPayment = async function(id, ownerName, petName, serviceName, amount, paymentMethod) {
  const isTransfer = (paymentMethod === 'CHUYEN_KHOAN' || paymentMethod === 'CHUYEN_KHOAN_VIETQR' || paymentMethod === 'CHUYEN_KHOAN_NGAN_HANG');
  const methodText = isTransfer ? 'Chuyển khoản ngân hàng' : 'Tiền mặt tại cửa hàng';
  const formattedAmount = (typeof formatCurrency === 'function') ? formatCurrency(amount) : (Number(amount).toLocaleString('vi-VN') + ' VNĐ');
  const shortId = id ? id.substring(0, 8).toUpperCase() : '';

  const confirmMsg = isTransfer
    ? `XÁC NHẬN ĐÃ THANH TOÁN (CHUYỂN KHOẢN)\n\n• Mã lịch hẹn: #${shortId}\n• Khách hàng: ${ownerName}\n• Bé cưng: ${petName}\n• Dịch vụ: ${serviceName}\n• Tổng tiền: ${formattedAmount}\n• Phương thức: ${methodText}\n\nBạn đã kiểm tra sao kê / tài khoản ngân hàng và xác nhận nhận được tiền? Bấm OK để xác nhận.`
    : `XÁC NHẬN ĐÃ THANH TOÁN (TIỀN MẶT)\n\n• Mã lịch hẹn: #${shortId}\n• Khách hàng: ${ownerName}\n• Bé cưng: ${petName}\n• Dịch vụ: ${serviceName}\n• Tổng tiền: ${formattedAmount}\n• Phương thức: ${methodText}\n\nBạn đã thực tế thu tiền mặt từ khách hàng tại quầy lễ tân chưa? Bấm OK để xác nhận.`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await apiRequest(`/appointments/${id}/confirm-payment`, 'PATCH');
    if (res && res.success) {
      showToast(res.message || 'Xác nhận thanh toán thành công!', 'success');
      if (window.loadAppointmentsList) await window.loadAppointmentsList();
      if (window.loadInvoicesList) window.loadInvoicesList();
      if (window.loadDashboardStats) window.loadDashboardStats();
      if (window.loadNotifications) window.loadNotifications();
    } else {
      showToast((res && res.message) || 'Lỗi khi xác nhận thanh toán', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ khi xác nhận thanh toán', 'error');
  }
};

window.confirmAppointment = async function(id) {
  return window.receptionConfirmAppointment(id);
};

window.completeAppointment = async function(id) {
  openCompleteCareModal(id, '', 'Thú cưng', 'Dịch vụ');
};

window.openBookAppointmentModal = async function() {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  const userRole = (currentUser?.role || 'USER').toUpperCase();
  if (userRole === 'ADMIN') {
    showToast('Quản trị viên không trực tiếp thực hiện nghiệp vụ đặt lịch chăm sóc. Quyền này thuộc về Quản lý cửa hàng, Lễ tân và Chủ nuôi.', 'warning');
    return;
  }

  const form = document.getElementById('form-book-appointment');
  if (form) form.reset();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('app-date');
  const timeInput = document.getElementById('app-time');
  if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
  if (timeInput) timeInput.value = '09:00';

  const res = await apiRequest('/pets');
  const select = document.getElementById('app-pet-id');
  if (select && res && res.success) {
    if (!res.pets || res.pets.length === 0) {
      select.innerHTML = '<option value="">Chưa có thú cưng nào</option>';
    } else {
      select.innerHTML = res.pets.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${escapeHTML(p.species || '')}${p.owner_name ? ` - Chủ: ${p.owner_name}` : ''})</option>`).join('');
    }
  }

  // Populate dynamic services and packages
  const examTypeSelect = document.getElementById('app-exam-type');
  if (examTypeSelect) {
    try {
      const [srvRes, pkgRes] = await Promise.all([
        apiRequest('/services?status=ACTIVE'),
        apiRequest('/services/packages?status=ACTIVE')
      ]);
      const srvList = (srvRes && srvRes.services) || [];
      const pkgList = (pkgRes && pkgRes.packages) || [];
      if (srvList.length > 0 || pkgList.length > 0) {
        let optionsHtml = '';
        if (srvList.length > 0) {
          optionsHtml += '<optgroup label="<i class="fa-solid fa-wand-magic-sparkles"></i> Dịch Vụ Đơn Lẻ">';
          optionsHtml += srvList.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)} (${formatCurrency(s.price)})</option>`).join('');
          optionsHtml += '</optgroup>';
        }
        if (pkgList.length > 0) {
          optionsHtml += '<optgroup label=" Gói Chăm Sóc Tiết Kiệm">';
          optionsHtml += pkgList.map(p => `<option value="${escapeHTML(p.name)}">${escapeHTML(p.name)} (${formatCurrency(p.price)})</option>`).join('');
          optionsHtml += '</optgroup>';
        }
        optionsHtml += '<optgroup label="Khác"><option value="Dịch vụ khác">Dịch vụ khác</option></optgroup>';
        examTypeSelect.innerHTML = optionsHtml;
      }
    } catch (err) {
      console.warn('Could not populate service options dynamically:', err);
    }
  }

  // Handle staff assignment dropdown for Receptionist / Store Manager
  const groupStaff = document.getElementById('group-app-staff');
  const selectStaff = document.getElementById('app-staff-id');

  if (groupStaff && selectStaff) {
    if (['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole)) {
      groupStaff.style.display = 'block';
      selectStaff.innerHTML = '<option value="">-- Đang tải danh sách nhân viên... --</option>';
      let staffList = [];
      try {
        const userRes = await apiRequest('/users/staff');
        if (userRes && userRes.success && (userRes.staff || userRes.users)) {
          staffList = userRes.staff || userRes.users;
        } else {
          const fallback = await apiRequest('/users?role=CARE_STAFF');
          if (fallback && fallback.success && (fallback.staff || fallback.users)) {
            staffList = fallback.staff || fallback.users;
          }
        }
      } catch (e) {
        console.error('Lỗi tải danh sách nhân viên:', e);
      }

      staffList = (staffList || []).filter(u => {
        const r = (u.role || '').toUpperCase();
        return (r === 'CARE_STAFF' || r === 'STAFF') && u.status !== 'LOCKED' && u.status !== 'DELETED';
      });

      if (staffList.length === 0) {
        selectStaff.innerHTML = '<option value="">-- Chưa có tài khoản Nhân viên chăm sóc nào --</option>';
      } else {
        selectStaff.innerHTML = '<option value="">-- Chưa phân công ngay --</option>' + 
          staffList.map(s => {
            const contact = s.phone || s.email || '';
            return `<option value="${s.id}">${escapeHTML(s.full_name)}${contact ? ` (${escapeHTML(contact)})` : ''}</option>`;
          }).join('');
      }
    } else {
      groupStaff.style.display = 'none';
      selectStaff.innerHTML = '<option value="">-- Không phân công --</option>';
    }
  }

  openModal('modal-book-appointment');
};

window.cancelAppointment = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) {
    return;
  }
  const reason = prompt('Vui lòng nhập lý do hủy lịch hẹn (tùy chọn):', '');
  if (reason === null) return; // Người dùng ấn Hủy/Cancel trên popup nhập lý do

  try {
    const res = await apiRequest(`/appointments/${id}/cancel`, 'PUT', { cancel_reason: reason });
    if (res && res.success) {
      showToast(res.message || 'Đã hủy lịch hẹn thành công!', 'success');
      if (window.loadAppointmentsList) window.loadAppointmentsList();
      if (window.loadAdminAssignments) window.loadAdminAssignments();
      if (window.fetchAndRenderAiReminders) window.fetchAndRenderAiReminders();
      if (window.loadSchedulesList) window.loadSchedulesList();
      if (window.loadNotifications) window.loadNotifications();
      if (window.loadInvoicesList) window.loadInvoicesList();
      if (window.loadDashboardStats) window.loadDashboardStats();
      if (typeof window.refreshActiveInpageConversation === 'function') window.refreshActiveInpageConversation();
    } else {
      showToast((res && res.message) || 'Lỗi khi hủy lịch hẹn', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi hủy lịch hẹn', 'error');
  }
};

window.deleteAppointment = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa lịch hẹn này khỏi hệ thống? Thao tác này chỉ dành cho Quản trị viên và không thể hoàn tác.')) {
    return;
  }
  try {
    const res = await apiRequest(`/appointments/${id}`, 'DELETE');
    if (res && res.success) {
      showToast(res.message || 'Đã xóa lịch hẹn thành công!', 'success');
      if (window.loadAppointmentsList) window.loadAppointmentsList();
      if (window.loadAdminAssignments) window.loadAdminAssignments();
      if (window.fetchAndRenderAiReminders) window.fetchAndRenderAiReminders();
      if (window.loadSchedulesList) window.loadSchedulesList();
      if (window.loadNotifications) window.loadNotifications();
      if (window.loadInvoicesList) window.loadInvoicesList();
      if (window.loadDashboardStats) window.loadDashboardStats();
    } else {
      showToast((res && res.message) || 'Lỗi khi xóa lịch hẹn', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi xóa lịch hẹn', 'error');
  }
};

window.openRescheduleModal = async function(id, currentDate, currentTime, currentService) {
  const modal = document.getElementById('modal-reschedule-appointment');
  if (!modal) {
    const newDate = prompt('Nhập ngày mới (YYYY-MM-DD):', currentDate);
    if (!newDate) return;
    const newTime = prompt('Nhập giờ mới (HH:MM):', currentTime);
    if (!newTime) return;
    const reason = prompt('Lý do đổi lịch (tùy chọn):', '');

    apiRequest(`/appointments/${id}/reschedule`, 'PUT', {
      appointmentDate: newDate,
      appointmentTime: newTime,
      reason
    }).then(res => {
      if (res && res.success) {
        showToast(res.message || 'Đổi lịch thành công!', 'success');
        if (window.loadAppointmentsList) window.loadAppointmentsList();
      } else {
        showToast((res && res.message) || 'Lỗi đổi lịch', 'error');
      }
    });
    return;
  }

  document.getElementById('reschedule-app-id').value = id;
  document.getElementById('reschedule-app-date').value = currentDate || '';
  document.getElementById('reschedule-app-time').value = currentTime || '09:00';
  document.getElementById('reschedule-app-reason').value = '';

  const dateInput = document.getElementById('reschedule-app-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  // Populate services dropdown
  const serviceSelect = document.getElementById('reschedule-app-service');
  if (serviceSelect) {
    serviceSelect.innerHTML = '<option value="">-- Giữ nguyên dịch vụ hiện tại --</option>';
    try {
      const [srvRes, pkgRes] = await Promise.all([
        apiRequest('/services', 'GET').catch(() => ({ services: [] })),
        apiRequest('/services/packages', 'GET').catch(() => ({ packages: [] }))
      ]);
      const services = (srvRes && srvRes.services) || [];
      const packages = (pkgRes && pkgRes.packages) || [];

      if (services.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = 'Dịch vụ lẻ';
        services.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.name;
          const priceText = typeof formatCurrency === 'function' ? formatCurrency(s.price) : `${s.price}đ`;
          opt.textContent = `${s.name} (${priceText})`;
          if (currentService && s.name.trim().toLowerCase() === currentService.trim().toLowerCase()) {
            opt.selected = true;
          }
          optgroup.appendChild(opt);
        });
        serviceSelect.appendChild(optgroup);
      }

      if (packages.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = 'Gói combo tiết kiệm';
        packages.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.name;
          const priceText = typeof formatCurrency === 'function' ? formatCurrency(p.price) : `${p.price}đ`;
          opt.textContent = `${p.name} (${priceText})`;
          if (currentService && p.name.trim().toLowerCase() === currentService.trim().toLowerCase()) {
            opt.selected = true;
          }
          optgroup.appendChild(opt);
        });
        serviceSelect.appendChild(optgroup);
      }

      // If current service was custom/not found in lists, add it as selected option
      if (currentService && !Array.from(serviceSelect.options).some(o => o.value === currentService)) {
        const opt = document.createElement('option');
        opt.value = currentService;
        opt.textContent = currentService;
        opt.selected = true;
        serviceSelect.appendChild(opt);
      }
    } catch (err) {
      console.warn('Error fetching services for reschedule modal:', err);
    }
  }

  openModal('modal-reschedule-appointment');
};

window.openHealthForPet = function(petId) {
  if (window.switchView) {
    window.switchView('health', petId);
  }
};

window.showPostBookingPaymentStepModal = function(appointment) {
  if (!appointment) return;
  const modal = document.getElementById('modal-post-booking-payment');
  if (!modal) return;

  const hiddenIdEl = document.getElementById('post-book-app-id');
  if (hiddenIdEl) hiddenIdEl.value = appointment.id || '';
  window._currentBookingPaymentApp = appointment;

  const totalPrice = appointment.estimatedPrice || appointment.price || 150000;
  const formattedTotal = formatCurrency(totalPrice);
  
  let formattedDate = appointment.appointmentDate || '';
  if (formattedDate.includes('T')) formattedDate = formattedDate.split('T')[0];
  if (formattedDate.includes('-')) {
    const parts = formattedDate.split('-');
    if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const appCode = appointment.id ? `#${appointment.id.substring(0, 8).toUpperCase()}` : '';

  const summaryEl = document.getElementById('post-booking-invoice-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 10px;">
        <span style="font-weight: 700; color: #0f172a; font-size: 14px;">Mã lịch hẹn: <span style="color: var(--primary); font-weight: 800;">${appCode}</span></span>
        <span class="badge badge-warning" style="font-size: 12px; font-weight: 700; background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 12px;">
          <i class="fa-solid fa-clock"></i> Bước 2: Chọn thanh toán
        </span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13.5px; color: #475569; margin-bottom: 12px;">
        <div><strong><i class="fa-solid fa-paw"></i> Thú cưng:</strong> <span style="color: #0f172a; font-weight: 700;">${escapeHTML(appointment.petName || 'Thú cưng')}</span></div>
        <div><strong>️ Dịch vụ:</strong> <span style="color: #0f172a; font-weight: 700;">${escapeHTML(appointment.examinationType || 'Dịch vụ chăm sóc')}</span></div>
        <div style="grid-column: 1 / -1;"><strong><i class="fa-solid fa-calendar"></i> Ngày/giờ:</strong> <span style="color: #0f172a; font-weight: 700;">${escapeHTML(appointment.appointmentTime || '09:00')} - ${formattedDate}</span></div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #fed7aa; background: #fff8f2; padding: 10px 14px; border-radius: 10px; margin-top: 6px;">
        <span style="font-size: 14px; font-weight: 700; color: #334155;">Tổng tiền dịch vụ:</span>
        <span style="font-size: 18px; font-weight: 900; color: #ea580c;">${formattedTotal}</span>
      </div>
    `;
  }

  // Set default radio choice to TIEN_MAT
  const defaultRadio = document.querySelector('input[name="post_booking_payment_choice"][value="TIEN_MAT"]');
  if (defaultRadio) defaultRadio.checked = true;
  window.togglePostBookingPaymentChoice('TIEN_MAT');

  openModal('modal-post-booking-payment');
};

window.showPostBookingPaymentModal = window.showPostBookingPaymentStepModal;

window.togglePostBookingPaymentChoice = function(choice) {
  const transferView = document.getElementById('post-book-transfer-view');
  const cashView = document.getElementById('post-book-cash-view');
  const lblCash = document.getElementById('lbl-post-pay-cash');
  const lblTransfer = document.getElementById('lbl-post-pay-transfer');
  const qrImg = document.getElementById('post-book-qr-img');
  const amountTxt = document.getElementById('post-book-amount-txt');
  const codeTxt = document.getElementById('post-book-code-txt');

  const app = window._currentBookingPaymentApp || {};
  const totalPrice = app.estimatedPrice || app.price || 150000;
  const formattedTotal = formatCurrency(totalPrice);
  const transferCode = `DATLICH ${app.id ? app.id.substring(0, 8).toUpperCase() : ''}`;

  if (choice === 'CHUYEN_KHOAN') {
    if (transferView) transferView.style.display = 'block';
    if (cashView) cashView.style.display = 'none';
    if (lblTransfer) {
      lblTransfer.style.borderColor = 'var(--primary)';
      lblTransfer.style.background = '#fff7ed';
    }
    if (lblCash) {
      lblCash.style.borderColor = '#e2e8f0';
      lblCash.style.background = '#ffffff';
    }
    if (amountTxt) amountTxt.textContent = formattedTotal;
    if (codeTxt) codeTxt.textContent = transferCode;
    if (qrImg) {
      qrImg.src = `https://api.vietqr.io/image/970436-0901234567-compact2.jpg?amount=${totalPrice}&addInfo=${encodeURIComponent(transferCode)}&accountName=SEN%20CHAM%20BOSS`;
    }
  } else {
    if (transferView) transferView.style.display = 'none';
    if (cashView) cashView.style.display = 'block';
    if (lblCash) {
      lblCash.style.borderColor = 'var(--primary)';
      lblCash.style.background = '#fff7ed';
    }
    if (lblTransfer) {
      lblTransfer.style.borderColor = '#e2e8f0';
      lblTransfer.style.background = '#ffffff';
    }
  }
};

window.submitPostBookingPaymentSelection = async function() {
  const appId = document.getElementById('post-book-app-id')?.value;
  if (!appId) {
    closeModal('modal-post-booking-payment');
    if (window.loadAppointmentsList) window.loadAppointmentsList();
    return;
  }

  const selectedMethod = document.querySelector('input[name="post_booking_payment_choice"]:checked')?.value || 'TIEN_MAT';
  const submitBtn = document.getElementById('btn-submit-post-booking-payment');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await apiRequest(`/appointments/${appId}/payment-method`, 'PATCH', {
      paymentMethod: selectedMethod
    });

    if (res && res.success) {
      showToast(res.message || 'Đã lưu phương thức thanh toán thành công! Trạng thái: Chờ xác nhận.', 'success');
    } else {
      showToast((res && res.message) || 'Đã ghi nhận phương thức thanh toán.', 'success');
    }

    closeModal('modal-post-booking-payment');
    if (window.loadAppointmentsList) await window.loadAppointmentsList();
    if (window.fetchAndRenderAiReminders) await window.fetchAndRenderAiReminders();
    if (window.loadSchedulesList) await window.loadSchedulesList();
    if (window.loadNotifications) window.loadNotifications();
  } catch (err) {
    showToast('Lỗi lưu phương thức thanh toán', 'error');
    closeModal('modal-post-booking-payment');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.openAdminEditAppointmentModal = async function(id) {
  const res = await apiRequest(`/appointments/${id}`);
  if (!res || !res.success || !res.appointment) {
    showToast('Không tìm thấy thông tin lịch hẹn', 'error');
    return;
  }
  const app = res.appointment;
  document.getElementById('admin-edit-app-id').value = app.id;

  // Populate pet select with all pets + owner name
  const petSelect = document.getElementById('admin-edit-app-pet');
  if (petSelect) {
    const pRes = await apiRequest('/pets');
    if (pRes && pRes.success) {
      petSelect.innerHTML = (pRes.pets || []).map(p => 
        `<option value="${p.id}" ${p.id === app.petId ? 'selected' : ''}>${escapeHTML(p.name)} (${p.species} - Chủ: ${escapeHTML(p.owner_name || '')})</option>`
      ).join('');
    }
  }

  // Populate staff select with CARE_STAFF
  const staffSelect = document.getElementById('admin-edit-app-staff');
  if (staffSelect) {
    const uRes = await apiRequest('/users');
    if (uRes && uRes.success) {
      const staffList = (uRes.users || []).filter(u => u.role === 'CARE_STAFF' || u.role === 'STAFF');
      staffSelect.innerHTML = `<option value="">-- Chưa phân công --</option>` + staffList.map(s => 
        `<option value="${s.id}" ${(s.id === app.staffId || s.id === app.proposedStaffId) ? 'selected' : ''}>${escapeHTML(s.full_name)} (${s.phone || s.email || 'NV'})</option>`
      ).join('');
    }
  }

  document.getElementById('admin-edit-app-date').value = app.appointmentDate || '';
  document.getElementById('admin-edit-app-time').value = app.appointmentTime || '09:00';
  document.getElementById('admin-edit-app-service').value = app.examinationType || '';
  document.getElementById('admin-edit-app-priority').value = app.priority || 'NORMAL';
  document.getElementById('admin-edit-app-status').value = app.status || 'PENDING';
  document.getElementById('admin-edit-app-reason').value = app.reason || '';
  document.getElementById('admin-edit-app-notes').value = app.note || app.notes || '';

  openModal('modal-admin-edit-appointment');
};

window.openAppointmentDetailModal = async function(id) {
  const res = await apiRequest(`/appointments/${id}`);
  if (!res || !res.success || !res.appointment) {
    showToast('Không tìm thấy thông tin chi tiết lịch hẹn', 'error');
    return;
  }
  const app = res.appointment;
  const pet = app.pet || {};
  const owner = app.owner || {};

  const codeEl = document.getElementById('detail-app-code');
  if (codeEl) codeEl.textContent = `Mã lịch: #${(app.id || '').substring(0, 8).toUpperCase()}`;

  const statusEl = document.getElementById('detail-app-status-badge');
  if (statusEl) {
    let statusText = 'Chờ xác nhận';
    let statusStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
    if (app.status === 'CANCELLED') {
      statusText = 'Đã hủy';
      statusStyle = 'background:#fef2f2; color:#ef4444; border:1px solid #fecaca;';
    } else if (app.status === 'COMPLETED') {
      statusText = 'Đã hoàn thành';
      statusStyle = 'background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0;';
    } else if (app.status === 'IN_PROGRESS') {
      statusText = 'Đang thực hiện';
      statusStyle = 'background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe;';
    } else if (app.status === 'CONFIRMED' || app.status === 'ASSIGNED') {
      statusText = app.staffName ? 'Đã phân công' : 'Đã xác nhận';
      statusStyle = 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;';
    } else if (app.status === 'PENDING_STAFF_CONFIRMATION') {
      statusText = 'Chờ nhân viên xác nhận';
      statusStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';
    }
    statusEl.innerHTML = `<span style="padding:6px 14px; border-radius:20px; font-weight:700; font-size:12.5px; ${statusStyle}">${statusText}</span>`;
  }

  let dateStr = app.appointmentDate || '';
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  if (dateStr.includes('-')) {
    const dp = dateStr.split('-');
    if (dp.length === 3) dateStr = `${dp[2]}/${dp[1]}/${dp[0]}`;
  }

  const bodyEl = document.getElementById('detail-app-body');
  if (bodyEl) {
    let rescheduleHtml = '';
    if (Array.isArray(app.reschedule_history) && app.reschedule_history.length > 0) {
      rescheduleHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-top:8px;">
          <h5 style="margin:0 0 8px 0; font-size:13px; font-weight:700; color:#334155;"><i class="fa-solid fa-clock-rotate-left"></i> Lịch Sử Đổi Lịch:</h5>
          ${app.reschedule_history.map((h, i) => `
            <div style="font-size:12px; color:#64748b; margin-bottom:4px; padding-left:8px; border-left:2px solid var(--primary);">
              Lần ${i + 1}: Từ <b>${h.previousTime || ''} ${h.previousDate || ''}</b> ➔ <b>${h.newTime || ''} ${h.newDate || ''}</b>
              ${h.reason ? ` <i>(Lý do: ${escapeHTML(h.reason)})</i>` : ''} - Bởi: <b>${escapeHTML(h.changedBy || 'Hệ thống')}</b>
            </div>
          `).join('')}
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px;">
          <h4 style="margin:0 0 10px 0; font-size:14px; color:var(--primary); font-weight:700;"><i class="fa-solid fa-paw"></i> Thông Tin Thú Cưng</h4>
          <div style="font-size:13px; line-height:1.8; color:#334155;">
            <div><i class="fa-solid fa-paw"></i> Tên: <b>${escapeHTML(pet.name || app.petName || 'Thú cưng')}</b></div>
            <div>️ Loài/Giống: ${escapeHTML(pet.species || app.petSpecies || 'Chưa rõ')} ${pet.breed ? `(${escapeHTML(pet.breed)})` : ''}</div>
            <div>️ Cân nặng: ${pet.weight || app.weight || '--'} kg</div>
            <div> Tuổi: ${pet.age ? pet.age + ' tuổi' : '--'}</div>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px;">
          <h4 style="margin:0 0 10px 0; font-size:14px; color:var(--primary); font-weight:700;"><i class="fa-solid fa-user"></i> Thông Tin Chủ Nuôi</h4>
          <div style="font-size:13px; line-height:1.8; color:#334155;">
            <div><i class="fa-solid fa-user"></i> Họ tên: <b>${escapeHTML(owner.full_name || app.ownerName || 'Khách hàng')}</b></div>
            <div> Điện thoại: ${escapeHTML(owner.phone || app.ownerPhone || 'Chưa cập nhật')}</div>
            <div>️ Email: ${escapeHTML(owner.email || 'Chưa cập nhật')}</div>
          </div>
        </div>
      </div>

      <div style="background:#ffffff; border:1px solid var(--border); border-radius:14px; padding:16px;">
        <h4 style="margin:0 0 12px 0; font-size:14px; color:var(--primary); font-weight:700;"><i class="fa-solid fa-calendar-check"></i> Thông Tin Dịch Vụ & Thanh Toán</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px; line-height:1.8; color:#334155;">
          <div>️ Dịch vụ / Gói: <b style="color:#0f172a;">${escapeHTML(app.examinationType || 'Dịch vụ')}</b></div>
          <div><i class="fa-solid fa-bolt"></i> Mức ưu tiên: <b>${app.priority === 'HIGH' ? 'Khẩn cấp' : 'Bình thường'}</b></div>
          <div><i class="fa-solid fa-calendar"></i> Ngày hẹn: <b>${dateStr}</b></div>
          <div> Khung giờ: <b>${app.appointmentTime || '09:00'}</b></div>
          <div><i class="fa-solid fa-credit-card"></i> Phương thức TT: <b style="color:#0f172a;">${(app.paymentMethod === 'CHUYEN_KHOAN' || app.paymentMethod === 'CHUYEN_KHOAN_VIETQR') ? 'Chuyển khoản ngân hàng' : 'Tiền mặt tại cửa hàng'}</b></div>
          <div> Trạng thái TT: <b style="color:${app.paymentStatus === 'PAID' ? '#059669' : '#d97706'};">${app.paymentStatus === 'PAID' ? '<i class="fa-solid fa-check"></i> Đã thanh toán' : ' Chờ xác nhận'}</b></div>
          ${(app.invoice_code || app.invoiceCode) ? `<div> Mã hóa đơn: <b style="color:var(--primary);">${escapeHTML(app.invoice_code || app.invoiceCode)}</b></div>` : ''}
          ${(app.estimatedPrice || app.price) ? `<div> Tổng tiền: <b style="color:#ea580c;">${formatCurrency(app.estimatedPrice || app.price)}</b></div>` : ''}
          <div style="grid-column: 1 / -1;"><i class="fa-solid fa-user"></i> Nhân viên phụ trách: <b style="color:#0284c7;">${escapeHTML(app.staffName || app.proposedStaffName || 'Chưa phân công')}</b></div>
          ${app.reason ? `<div style="grid-column: 1 / -1;"> Yêu cầu: ${escapeHTML(app.reason)}</div>` : ''}
          ${app.symptoms ? `<div style="grid-column: 1 / -1;"><i class="fa-solid fa-stethoscope"></i> Tình trạng/Lưu ý: ${escapeHTML(app.symptoms)}</div>` : ''}
          ${app.note ? `<div style="grid-column: 1 / -1;"> Ghi chú: ${escapeHTML(app.note)}</div>` : ''}
          ${app.cancel_reason ? `<div style="grid-column: 1 / -1; color:#ef4444; font-weight:600;"><i class="fa-solid fa-xmark"></i> Lý do hủy: ${escapeHTML(app.cancel_reason)}</div>` : ''}
        </div>
        ${rescheduleHtml}
      </div>
    `;
  }

  const footerEl = document.getElementById('detail-app-footer');
  if (footerEl) {
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
    const userRole = (currentUser?.role || 'USER').toUpperCase();
    const canComplete = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST', 'CARE_STAFF'].includes(userRole);

    let completeBtnHtml = '';
    if (app.status === 'COMPLETED') {
      completeBtnHtml = `<button type="button" class="btn btn-outline" onclick="closeModal('modal-appointment-detail'); openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName || '')}', '${escapeHTML(app.examinationType || '')}')"><i class="fa-solid fa-clipboard-check"></i> Xem hồ sơ chăm sóc</button>`;
    } else if (app.status !== 'CANCELLED' && canComplete) {
      completeBtnHtml = `<button type="button" class="btn btn-primary" style="background:#ea580c; border-color:#c2410c; color:#fff; font-weight:700;" onclick="closeModal('modal-appointment-detail'); openCompleteCareModal('${app.id}', '${app.petId}', '${escapeHTML(app.petName || '')}', '${escapeHTML(app.examinationType || '')}')"><i class="fa-solid fa-pen-to-square"></i> Hoàn tất chăm sóc</button>`;
    }

    if (['ADMIN','STORE_MANAGER'].includes(userRole)) {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('modal-appointment-detail')">Đóng</button>
        ${completeBtnHtml}
        <button type="button" class="btn btn-outline" onclick="closeModal('modal-appointment-detail'); openRescheduleModal('${app.id}', '${app.appointmentDate}', '${app.appointmentTime || '09:00'}', '${(app.examinationType || '').replace(/'/g, "\\'")}')"><i class="fa-solid fa-clock-rotate-left"></i> Đổi lịch</button>
        <button type="button" class="btn btn-outline" onclick="closeModal('modal-appointment-detail'); openAdminEditAppointmentModal('${app.id}')"><i class="fa-solid fa-pen"></i> Chỉnh sửa</button>
        ${app.status !== 'CANCELLED' && app.status !== 'COMPLETED' ? `<button type="button" class="btn btn-outline-danger" onclick="closeModal('modal-appointment-detail'); cancelAppointment('${app.id}')"><i class="fa-solid fa-ban"></i> Hủy lịch</button>` : ''}
        <button type="button" class="btn btn-danger" onclick="closeModal('modal-appointment-detail'); deleteAppointment('${app.id}')"><i class="fa-solid fa-trash"></i> Xóa lịch</button>
      `;
    } else {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('modal-appointment-detail')">Đóng</button>
        ${completeBtnHtml}
      `;
    }
  }

  openModal('modal-appointment-detail');
};


