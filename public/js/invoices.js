/* =========================================================
   INVOICES & PAYMENTS MANAGEMENT - SEN CHĂM BOSS
   (Automatic invoice workflow based on appointments)
   ========================================================= */

window.initInvoicesUI = function() {
  const searchInput = document.getElementById('invoice-search-input');
  const statusFilter = document.getElementById('invoice-status-filter');

  if (searchInput) {
    searchInput.oninput = debounce(() => loadInvoicesList(), 300);
  }
  if (statusFilter) {
    statusFilter.onchange = () => loadInvoicesList();
  }

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser.role || 'USER').toUpperCase();
  const btnCreate = document.getElementById('btn-open-create-invoice-modal');
  if (btnCreate) {
    btnCreate.style.display = (userRole === 'RECEPTIONIST' || userRole === 'STORE_MANAGER') ? 'inline-flex' : 'none';
  }

  const createInvoiceForm = document.getElementById('form-create-invoice');
  if (createInvoiceForm) {
    createInvoiceForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-create-invoice');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const appointmentId = document.getElementById('create-inv-app-id')?.value || null;
        const userId = document.getElementById('create-inv-user-id')?.value || '';
        const petId = document.getElementById('create-inv-pet-id')?.value || '';
        const serviceName = document.getElementById('create-inv-service')?.value || '';
        const amount = parseFloat(document.getElementById('create-inv-amount')?.value) || 0;
        const date = document.getElementById('create-inv-date')?.value || '';
        const status = document.getElementById('create-inv-status')?.value || 'PENDING';
        const notes = document.getElementById('create-inv-notes')?.value || '';

        const ownerObj = (window._cachedInvoiceUsers || []).find(u => u.id === userId);
        const petObj = (window._cachedInvoicePets || []).find(p => p.id === petId);

        const payload = {
          appointment_id: appointmentId || null,
          user_id: userId,
          owner_name: ownerObj ? ownerObj.full_name : '',
          owner_phone: ownerObj ? ownerObj.phone : '',
          pet_id: petId,
          pet_name: petObj ? petObj.name : '',
          service_name: serviceName,
          total_amount: amount,
          date: date,
          status: status,
          notes: notes,
          payment_method: status === 'PAID' ? 'TIEN_MAT_DA_THU' : (status === 'WAITING_CONFIRMATION' ? 'CHUYEN_KHOAN_VIETQR' : 'CHUA_THANH_TOAN')
        };

        const res = await apiRequest('/invoices', 'POST', payload);
        if (res && res.success) {
          showToast(res.message || 'Lập hóa đơn mới thành công!', 'success');
          closeModal('modal-create-invoice');
          loadInvoicesList();
          if (window.loadDashboardStats) window.loadDashboardStats();
        } else {
          showToast((res && res.message) || 'Lỗi khi lập hóa đơn', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối máy chủ khi lập hóa đơn', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  loadInvoicesList();
};

window.loadInvoicesList = async function() {
  const container = document.getElementById('invoices-table-body');
  if (!container) return;

  const search = document.getElementById('invoice-search-input')?.value || '';
  const status = document.getElementById('invoice-status-filter')?.value || 'ALL';

  // Fetch danh sách theo bộ lọc tìm kiếm & trạng thái
  let url = `/invoices?search=${encodeURIComponent(search)}`;
  if (status !== 'ALL') url += `&status=${encodeURIComponent(status)}`;

  container.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 20px; color: var(--primary);"></i><div style="margin-top: 8px;">Đang tải danh sách hóa đơn...</div></td></tr>`;

  const res = await apiRequest(url, 'GET');
  if (!res.success || !res.invoices || res.invoices.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 20px; color: #64748b;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #f8fafc; border: 1px dashed #cbd5e1; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; color: #94a3b8; margin-bottom: 12px;">
            <i class="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #334155; margin-bottom: 4px;">Chưa có hóa đơn nào</div>
          <div style="font-size: 13px; color: #94a3b8;">Không tìm thấy dữ liệu hóa đơn phù hợp với điều kiện tìm kiếm.</div>
        </td>
      </tr>
    `;
    return;
  }

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser.role || 'USER').toUpperCase();
  const canManage = ['ADMIN','STORE_MANAGER'].includes(userRole) || userRole === 'RECEPTIONIST';
  const isAdmin = ['ADMIN','STORE_MANAGER'].includes(userRole);

  const btnCreate = document.getElementById('btn-open-create-invoice-modal');
  if (btnCreate) {
    btnCreate.style.display = (userRole === 'STORE_MANAGER' || userRole === 'RECEPTIONIST') ? 'inline-flex' : 'none';
  }

  container.innerHTML = res.invoices.map((inv, idx) => {
    let statusBadge = '';
    const isPending = inv.status === 'PENDING' || inv.status === 'WAITING_CONFIRMATION';
    const isOwner = userRole === 'USER';

    if (inv.status === 'PAID') {
      statusBadge = '<span class="badge-status-paid"><i class="fa-solid fa-circle-check"></i> Đã thanh toán</span>';
    } else if (inv.status === 'WAITING_CONFIRMATION') {
      statusBadge = `<span class="badge" style="background:#e0f2fe;color:#0284c7;font-weight:700;padding:5px 10px;border-radius:6px;font-size:12.5px;cursor:pointer;" onclick="openInvoicePaymentModal('${inv.id}')" title="Bấm để thanh toán hóa đơn"><i class="fa-solid fa-hourglass-half"></i> Chờ xác nhận</span>`;
    } else if (inv.status === 'PENDING') {
      statusBadge = `<span class="badge-status-pending" style="cursor:pointer; display:inline-flex; align-items:center; gap:5px;" onclick="openInvoicePaymentModal('${inv.id}')" title="Bấm để mở thanh toán"><i class="fa-solid fa-clock"></i> Chờ thanh toán</span>`;
    } else {
      statusBadge = '<span class="badge badge-danger"><i class="fa-solid fa-ban"></i> Đã hủy</span>';
    }

    const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString('vi-VN') : '---';
    const amountStr = formatCurrency(inv.final_amount || inv.total_amount);
    const invoiceCode = escapeHTML(inv.invoice_code || `HD-${String(idx+1).padStart(3, '0')}`);
    const ownerName = escapeHTML(inv.owner_name || 'Khách hàng');
    const ownerPhone = inv.owner_phone ? escapeHTML(inv.owner_phone) : '';
    const petName = escapeHTML(inv.pet_name || 'Bé cưng');
    const petSpecies = inv.pet_species ? escapeHTML(inv.pet_species) : '';
    const serviceName = escapeHTML(inv.service_name || 'Dịch vụ chăm sóc');

    return `
      <tr>
        <!-- Cột 1: Mã HĐ -->
        <td style="font-weight: 700;">
          <span class="invoice-code-badge">${invoiceCode}</span>
        </td>

        <!-- Cột 2: Chủ nuôi -->
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${ownerName}</div>
          ${ownerPhone ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;"><i class="fa-solid fa-phone" style="font-size: 10px; margin-right: 4px; color: #94a3b8;"></i>${ownerPhone}</div>` : ''}
        </td>

        <!-- Cột 3: Thú cưng (Cột riêng) -->
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 30px; height: 30px; border-radius: 8px; background: #fff7ed; color: #ea580c; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
              <i class="fa-solid fa-paw"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${petName}</div>
              ${petSpecies ? `<span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${petSpecies}</span>` : ''}
            </div>
          </div>
        </td>

        <!-- Cột 4: Dịch vụ (Giới hạn chiều rộng và tooltip khi hover) -->
        <td>
          <span class="service-cell-ellipsis" title="${serviceName}">
            ${serviceName}
          </span>
        </td>

        <!-- Cột 5: Ngày lập -->
        <td style="font-size: 13px; color: #475569; font-weight: 500;">
          ${dateStr}
        </td>

        <!-- Cột 6: Tổng tiền -->
        <td style="text-align: right;">
          <div style="font-weight: 800; font-size: 14.5px; color: #0f172a;">${amountStr}</div>
        </td>

        <!-- Cột 7: Trạng thái (Bấm vào để thanh toán nếu đang Chờ thanh toán) -->
        <td style="text-align: center;">
          ${statusBadge}
        </td>

        <!-- Cột 8: Thao tác -->
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
            <!-- Nút Thanh toán cho Chủ nuôi khi đang Chờ thanh toán -->
            ${isPending && isOwner ? `
              <button class="btn btn-sm btn-primary" style="background:#ea580c; border-color:#ea580c; font-weight:700; border-radius:8px; padding:4px 10px; font-size:12.5px; display:inline-flex; align-items:center; gap:5px; color:#fff;" onclick="openInvoicePaymentModal('${inv.id}')" title="Thanh toán hóa đơn">
                <i class="fa-solid fa-credit-card"></i> Thanh toán
              </button>
            ` : ''}

            <!-- Chi tiết (Luôn hiển thị) -->
            <button class="btn-inv-detail" title="Xem chi tiết" onclick="viewInvoiceDetail('${inv.id}')">
              <i class="fa-solid fa-eye"></i> Chi tiết
            </button>

            <!-- Xác nhận thanh toán (Chỉ hiển thị nếu CHỜ THANH TOÁN và có quyền Quản lý/Lễ tân) -->
            ${isPending && canManage ? `
              <button class="btn-inv-pay" title="Xác nhận thanh toán / thu tiền" onclick="confirmPaymentInvoice('${inv.id}')">
                <i class="fa-solid fa-check"></i> Xác nhận
              </button>
            ` : ''}

            <!-- Xóa (Chỉ hiển thị với Admin) -->
            ${isAdmin ? `
              <button class="btn-inv-delete" title="Xóa hóa đơn" onclick="deleteInvoice('${inv.id}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.currentPayingInvoice = null;

window.openInvoicePaymentModal = async function(id) {
  const res = await apiRequest(`/invoices/${id}`, 'GET');
  if (!res || !res.success || !res.invoice) {
    showToast('Không tìm thấy thông tin hóa đơn', 'error');
    return;
  }

  const inv = res.invoice;

  // Requirement 7: Khi hóa đơn có trạng thái "Đã hủy" → Không cho phép mở chức năng thanh toán.
  if (inv.status === 'CANCELLED') {
    showToast('Hóa đơn này đã bị hủy, không thể thực hiện thanh toán.', 'error');
    return;
  }

  // Requirement 6: Không thể thanh toán lại hóa đơn đã thanh toán.
  if (inv.status === 'PAID') {
    showToast('Hóa đơn này đã được thanh toán hoàn tất.', 'info');
    viewInvoiceDetail(id);
    return;
  }

  window.currentPayingInvoice = inv;

  const codeEl = document.getElementById('pay-inv-code');
  const ownerEl = document.getElementById('pay-inv-owner');
  const petEl = document.getElementById('pay-inv-pet');
  const serviceEl = document.getElementById('pay-inv-service');
  const amountEl = document.getElementById('pay-inv-amount');
  const qrImg = document.getElementById('pay-inv-qr-img');
  const qrAmount = document.getElementById('pay-inv-qr-amount');
  const qrCode = document.getElementById('pay-inv-qr-code');

  const invCode = inv.invoice_code || id;
  const totalAmount = inv.final_amount || inv.total_amount || 0;
  const formattedTotal = formatCurrency(totalAmount);

  if (codeEl) codeEl.textContent = invCode;
  if (ownerEl) ownerEl.textContent = inv.owner_name || 'Khách hàng';
  if (petEl) petEl.textContent = `${inv.pet_name || 'Bé cưng'}${inv.pet_species ? ` (${inv.pet_species})` : ''}`;
  if (serviceEl) serviceEl.textContent = inv.service_name || 'Dịch vụ chăm sóc thú cưng';
  if (amountEl) amountEl.textContent = formattedTotal;
  if (qrAmount) qrAmount.textContent = formattedTotal;
  if (qrCode) qrCode.textContent = invCode;

  if (qrImg) {
    qrImg.src = `https://api.vietqr.io/image/970436-0901234567-compact2.jpg?amount=${totalAmount}&addInfo=${encodeURIComponent(invCode)}&accountName=SEN%20CHAM%20BOSS`;
  }

  // Reset to transfer method initially
  const transferRadio = document.querySelector('input[name="invoice_payment_method"][value="CHUYEN_KHOAN_VIETQR"]');
  if (transferRadio) transferRadio.checked = true;
  toggleInvoicePaymentMethod('transfer');

  openModal('modal-invoice-payment');
};

window.toggleInvoicePaymentMethod = function(mode) {
  const transferView = document.getElementById('inv-pay-transfer-view');
  const cashView = document.getElementById('inv-pay-cash-view');
  const lblTransfer = document.getElementById('lbl-inv-pay-transfer');
  const lblCash = document.getElementById('lbl-inv-pay-cash');
  const btnSubmit = document.getElementById('btn-submit-invoice-payment');

  if (mode === 'transfer') {
    if (transferView) transferView.style.display = 'block';
    if (cashView) cashView.style.display = 'none';
    if (lblTransfer) {
      lblTransfer.style.border = '2px solid var(--primary)';
      lblTransfer.style.background = '#fff7ed';
    }
    if (lblCash) {
      lblCash.style.border = '2px solid #e2e8f0';
      lblCash.style.background = '#ffffff';
    }
    if (btnSubmit) {
      btnSubmit.innerHTML = '<i class="fa-solid fa-credit-card"></i> Thanh toán';
    }
  } else {
    if (transferView) transferView.style.display = 'none';
    if (cashView) cashView.style.display = 'block';
    if (lblTransfer) {
      lblTransfer.style.border = '2px solid #e2e8f0';
      lblTransfer.style.background = '#ffffff';
    }
    if (lblCash) {
      lblCash.style.border = '2px solid var(--primary)';
      lblCash.style.background = '#fff7ed';
    }
    if (btnSubmit) {
      btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Xác nhận chọn tiền mặt';
    }
  }
};

window.submitInvoicePayment = async function() {
  if (!window.currentPayingInvoice) {
    closeModal('modal-invoice-payment');
    return;
  }

  const selectedMethod = document.querySelector('input[name="invoice_payment_method"]:checked')?.value || 'CHUYEN_KHOAN_VIETQR';
  const invoiceId = window.currentPayingInvoice.id;
  const btnSubmit = document.getElementById('btn-submit-invoice-payment');
  const originalHtml = btnSubmit ? btnSubmit.innerHTML : '';

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
  }

  try {
    const res = await apiRequest(`/invoices/${invoiceId}/pay`, 'PATCH', {
      payment_method: selectedMethod
    });

    if (res && res.success) {
      closeModal('modal-invoice-payment');
      showToast(res.message || (selectedMethod === 'CHUYEN_KHOAN_VIETQR' ? 'Thanh toán thành công!' : 'Đã chọn thanh toán tiền mặt tại quầy.'), 'success');
      loadInvoicesList();
      if (window.loadAppointmentsList) window.loadAppointmentsList();
    } else {
      showToast((res && res.message) || 'Lỗi khi thanh toán hóa đơn', 'error');
    }
  } catch (err) {
    console.error('submitInvoicePayment error:', err);
    showToast('Lỗi kết nối máy chủ khi thanh toán', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalHtml;
    }
  }
};

window.viewInvoiceDetail = async function(id) {
  const res = await apiRequest(`/invoices/${id}`, 'GET');
  if (!res.success || !res.invoice) {
    showToast('Không tìm thấy thông tin hóa đơn', 'error');
    return;
  }

  const inv = res.invoice;
  const modal = document.getElementById('modal-invoice-detail');
  if (!modal) return;

  const content = document.getElementById('invoice-detail-content');
  if (!content) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser.role || 'USER').toUpperCase();
  const canManage = ['ADMIN','STORE_MANAGER'].includes(userRole) || userRole === 'RECEPTIONIST';

  const itemsHtml = (inv.items && inv.items.length > 0) ? inv.items.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13.5px;">
      <div>
        <strong style="color: #0f172a;">${escapeHTML(item.name)}</strong>
        <span style="color: #64748b; font-size: 12px; margin-left: 6px;">x${item.quantity || 1}</span>
      </div>
      <span style="font-weight: 700; color: #0f172a;">${formatCurrency(item.amount || item.price)}</span>
    </div>
  `).join('') : `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13.5px;">
      <strong style="color: #0f172a;">${escapeHTML(inv.service_name || 'Dịch vụ chăm sóc thú cưng')}</strong>
      <span style="font-weight: 700; color: #0f172a;">${formatCurrency(inv.total_amount)}</span>
    </div>
  `;

  const qrUrl = `https://api.vietqr.io/image/970436-1234567890-compact2.jpg?amount=${inv.final_amount || inv.total_amount}&addInfo=${encodeURIComponent(inv.invoice_code || 'Thanh toan hoa don')}&accountName=SEN%20CHAM%20BOSS`;

  const dateCreated = inv.created_at ? new Date(inv.created_at).toLocaleString('vi-VN') : '---';
  const datePaid = inv.paid_at ? new Date(inv.paid_at).toLocaleString('vi-VN') : null;

  content.innerHTML = `
    <!-- Modal Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 20px;">
          <i class="fa-solid fa-receipt"></i>
        </div>
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">HÓA ĐƠN #${escapeHTML(inv.invoice_code || id)}</h3>
          <span style="font-size: 12.5px; color: #64748b;">Hệ thống chăm sóc thú cưng Sen Chăm Boss</span>
        </div>
      </div>
      <button type="button" class="btn-close-modal" onclick="closeModal('modal-invoice-detail')" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8;">&times;</button>
    </div>

    <!-- Thông Tin Khách Hàng & Thú Cưng -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px;">
      <!-- Khách Hàng -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-user" style="color: var(--primary);"></i> Thông Tin Khách Hàng
        </div>
        <div style="font-weight: 700; font-size: 15px; color: #0f172a; margin-bottom: 4px;">${escapeHTML(inv.owner_name || 'Khách hàng')}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 2px;">
          <strong>SĐT:</strong> ${escapeHTML(inv.owner_phone || 'Chưa cập nhật')}
        </div>
        <div style="font-size: 13px; color: #475569;">
          <strong>Email:</strong> ${escapeHTML(inv.owner_email || 'Chưa cập nhật')}
        </div>
      </div>

      <!-- Thú Cưng -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-paw" style="color: var(--primary);"></i> Thông Tin Thú Cưng
        </div>
        <div style="font-weight: 700; font-size: 15px; color: var(--primary); margin-bottom: 4px;"><i class="fa-solid fa-paw"></i> ${escapeHTML(inv.pet_name || 'Bé cưng')}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 2px;">
          <strong>Loài:</strong> ${escapeHTML(inv.pet_species || 'Thú cưng')}
        </div>
        <div style="font-size: 13px; color: #475569;">
          <strong>Thông tin:</strong> ${escapeHTML(inv.pet_breed ? `Giống: ${inv.pet_breed}` : '')}${inv.pet_weight ? ` (${inv.pet_weight} kg)` : '' || 'Khỏe mạnh'}
        </div>
      </div>
    </div>

    <!-- Thông Tin Dịch Vụ -->
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h5 style="font-weight: 800; font-size: 14px; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-list-check" style="color: var(--primary);"></i> Thông Tin Dịch Vụ Sử Dụng
        </h5>
        <span style="font-size: 12.5px; color: #64748b;">Ngày lập: ${dateCreated}</span>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 16px;">
        ${itemsHtml}
      </div>
    </div>

    <!-- Chi Tiết Thanh Toán -->
    <div style="background: #fff8f2; border: 1px solid #fed7aa; padding: 16px; border-radius: 14px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13.5px; color: #475569;">
        <span>Tổng cộng chi phí dịch vụ:</span>
        <span style="font-weight: 700; color: #0f172a;">${formatCurrency(inv.total_amount)}</span>
      </div>
      ${inv.discount_amount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13.5px; color: #10b981;">
          <span>Giảm giá / Ưu đãi:</span>
          <span style="font-weight: 700;">-${formatCurrency(inv.discount_amount)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: 900; color: #ea580c; border-top: 1px dashed #fed7aa; padding-top: 10px; margin-top: 6px;">
        <span>Số tiền thanh toán:</span>
        <span style="font-size: 20px;">${formatCurrency(inv.final_amount || inv.total_amount)}</span>
      </div>
    </div>

    <!-- Trạng Thái & VietQR -->
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; border-radius: 12px; margin-bottom: 20px;">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Trạng Thái Thanh Toán</div>
        <div>
          ${inv.status === 'PAID' 
            ? '<span class="badge-status-paid" style="font-size: 13px;"><i class="fa-solid fa-circle-check"></i> Đã thanh toán</span>' 
            : (inv.status === 'WAITING_CONFIRMATION' 
                ? '<span class="badge" style="background:#e0f2fe;color:#0284c7;font-weight:700;padding:5px 10px;border-radius:6px;font-size:13px;"><i class="fa-solid fa-hourglass-half"></i> Chờ xác nhận chuyển khoản</span>'
                : '<span class="badge-status-pending" style="font-size: 13px;"><i class="fa-solid fa-clock"></i> Chờ thanh toán</span>')}
        </div>
        <div style="font-size: 12.5px; color: #475569; margin-top: 6px;">
          <strong>Phương thức:</strong> ${escapeHTML(inv.payment_method || 'Chuyển khoản VietQR / Tiền mặt')}
        </div>
        ${datePaid ? `
          <div style="font-size: 12px; color: #10b981; margin-top: 2px;">
            <i class="fa-solid fa-check-double"></i> Đã thanh toán lúc: ${datePaid}
          </div>
        ` : ''}
      </div>

      ${(inv.status === 'PENDING' || inv.status === 'WAITING_CONFIRMATION') ? `
        <div style="text-align: center; background: #ffffff; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <img src="${qrUrl}" alt="VietQR" style="width: 105px; height: 105px; border-radius: 6px; display: block; margin-bottom: 4px;">
          <div style="font-size: 11px; font-weight: 700; color: #0284c7;">Quét mã VietQR</div>
        </div>
      ` : ''}
    </div>

    ${inv.notes ? `
      <div style="font-size: 13px; color: #64748b; font-style: italic; background: #f8fafc; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid var(--primary);">
        <strong>Ghi chú:</strong> ${escapeHTML(inv.notes)}
      </div>
    ` : ''}

    <!-- Modal Actions -->
    <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      ${(inv.status === 'PENDING' || inv.status === 'WAITING_CONFIRMATION') && canManage ? `
        <button class="btn btn-success" style="padding: 9px 18px; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;" onclick="confirmPaymentInvoice('${inv.id}'); closeModal('modal-invoice-detail');">
          <i class="fa-solid fa-check"></i> Xác Nhận Đã Thu Tiền / Thanh Toán
        </button>
      ` : ''}
      <button class="btn btn-outline" style="padding: 9px 18px; font-weight: 600; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;" onclick="window.print();">
        <i class="fa-solid fa-print"></i> In Hóa Đơn
      </button>
      <button class="btn btn-secondary" style="padding: 9px 18px; font-weight: 600; border-radius: 10px;" onclick="closeModal('modal-invoice-detail')">Đóng</button>
    </div>
  `;

  openModal('modal-invoice-detail');
};

window.confirmPaymentInvoice = async function(id) {
  try {
    const resInv = await apiRequest(`/invoices/${id}`, 'GET');
    const inv = resInv?.invoice || resInv?.data;
    const method = inv?.payment_method || '';
    const isTransfer = method.includes('CHUYEN_KHOAN');
    const methodText = isTransfer ? 'Chuyển khoản' : 'Tiền mặt';
    const amountStr = typeof formatCurrency === 'function' ? formatCurrency(inv?.final_amount || inv?.total_amount || 0) : ((inv?.final_amount || inv?.total_amount || 0) + ' đ');

    const confirmMsg = isTransfer
      ? `XÁC NHẬN ĐÃ THANH TOÁN (CHUYỂN KHOẢN)\n\n• Hóa đơn: ${inv?.invoice_code || id}\n• Khách hàng: ${inv?.owner_name || 'Khách'}\n• Dịch vụ: ${inv?.service_name || 'Dịch vụ'}\n• Số tiền: ${amountStr}\n• Phương thức: ${methodText}\n\nBạn đã kiểm tra giao dịch chuyển khoản ngân hàng thực tế thành công chưa? Bấm OK để xác nhận.`
      : `XÁC NHẬN ĐÃ THANH TOÁN (TIỀN MẶT)\n\n• Hóa đơn: ${inv?.invoice_code || id}\n• Khách hàng: ${inv?.owner_name || 'Khách'}\n• Dịch vụ: ${inv?.service_name || 'Dịch vụ'}\n• Số tiền: ${amountStr}\n• Phương thức: ${methodText}\n\nBạn đã thực tế nhận đủ tiền mặt tại quầy lễ tân chưa? Bấm OK để xác nhận.`;

    if (!confirm(confirmMsg)) return;

    const res = await apiRequest(`/invoices/${id}/pay`, 'PATCH', { 
      status: 'PAID',
      payment_method: isTransfer ? 'CHUYEN_KHOAN_DA_NHAN' : 'TIEN_MAT_DA_THU'
    });
    if (res && res.success) {
      showToast(res.message || 'Xác nhận thanh toán thành công!', 'success');
      loadInvoicesList();
      if (window.loadAppointmentsList) window.loadAppointmentsList();
      if (window.loadDashboardStats) window.loadDashboardStats();
    } else {
      showToast((res && res.message) || 'Lỗi khi xác nhận thanh toán', 'error');
    }
  } catch (err) {
    showToast('Lỗi khi xác nhận thanh toán', 'error');
  }
};

window.deleteInvoice = async function(id) {
  if (!confirm('Bạn có chắc muốn xóa hóa đơn này không?')) return;
  const res = await apiRequest(`/invoices/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message || 'Đã xóa hóa đơn thành công!', 'success');
    loadInvoicesList();
  } else {
    showToast(res.message || 'Lỗi khi xóa hóa đơn', 'error');
  }
};

window._cachedInvoiceUsers = [];
window._cachedInvoicePets = [];
window._cachedInvoiceServices = [];
window._cachedUnbilledAppointments = [];

window.openCreateInvoiceModal = async function() {
  const form = document.getElementById('form-create-invoice');
  if (form) form.reset();

  const dateInput = document.getElementById('create-inv-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  const appSelect = document.getElementById('create-inv-app-id');
  const userSelect = document.getElementById('create-inv-user-id');
  const petSelect = document.getElementById('create-inv-pet-id');
  const serviceSelect = document.getElementById('create-inv-service');
  const amountInput = document.getElementById('create-inv-amount');

  if (appSelect) appSelect.innerHTML = '<option value="">-- Đang tải danh sách lịch hẹn... --</option>';
  if (userSelect) userSelect.innerHTML = '<option value="">-- Đang tải danh sách khách hàng... --</option>';
  if (petSelect) petSelect.innerHTML = '<option value="">-- Đang tải danh sách thú cưng... --</option>';
  if (serviceSelect) serviceSelect.innerHTML = '<option value="">-- Đang tải dịch vụ... --</option>';

  try {
    const [userRes, petRes, srvRes, pkgRes, unbilledRes] = await Promise.all([
      apiRequest('/users', 'GET').catch(() => ({ users: [] })),
      apiRequest('/pets', 'GET').catch(() => ({ pets: [] })),
      apiRequest('/services', 'GET').catch(() => ({ services: [] })),
      apiRequest('/services/packages', 'GET').catch(() => ({ packages: [] })),
      apiRequest('/invoices/unbilled-appointments', 'GET').catch(() => ({ appointments: [] }))
    ]);

    const users = (userRes && (userRes.users || userRes.data)) || [];
    const pets = (petRes && (petRes.pets || petRes.data)) || [];
    const services = (srvRes && srvRes.services) || [];
    const packages = (pkgRes && pkgRes.packages) || [];
    const unbilledApps = (unbilledRes && unbilledRes.appointments) || [];

    window._cachedInvoiceUsers = users;
    window._cachedInvoicePets = pets;
    window._cachedInvoiceServices = [...services, ...packages];
    window._cachedUnbilledAppointments = unbilledApps;

    // Populate Completed Unbilled Appointments
    if (appSelect) {
      if (unbilledApps.length === 0) {
        appSelect.innerHTML = '<option value="">-- Lập hóa đơn trực tiếp (Không có lịch hoàn tất chờ lập HĐ) --</option>';
      } else {
        appSelect.innerHTML = '<option value="">-- Lập hóa đơn trực tiếp / Hoặc chọn lịch đã hoàn thành --</option>' +
          unbilledApps.map(a => {
            return `<option value="${a.id}">[Hoàn thành ${a.appointmentDate}] ${escapeHTML(a.ownerName)} - Bé ${escapeHTML(a.petName)} (${escapeHTML(a.examinationType)})</option>`;
          }).join('');
      }
    }

    // Populate Users
    if (userSelect) {
      const customers = users.filter(u => u.status !== 'DELETED');
      if (customers.length === 0) {
        userSelect.innerHTML = '<option value="">-- Chưa có khách hàng nào --</option>';
      } else {
        userSelect.innerHTML = '<option value="">-- Chọn khách hàng / chủ nuôi --</option>' + 
          customers.map(u => {
            const phoneStr = u.phone ? ` -  ${u.phone}` : '';
            return `<option value="${u.id}">${escapeHTML(u.full_name || u.username)}${escapeHTML(phoneStr)}</option>`;
          }).join('');
      }
    }

    // Populate Pets
    renderInvoicePetsOptions(pets);

    // Populate Services
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">-- Chọn dịch vụ chăm sóc --</option>';
      if (services.length > 0) {
        const optgroupSrv = document.createElement('optgroup');
        optgroupSrv.label = 'Dịch Vụ Lẻ';
        services.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.name;
          const priceText = typeof formatCurrency === 'function' ? formatCurrency(s.price) : `${s.price}đ`;
          opt.textContent = `${s.name} (${priceText})`;
          optgroupSrv.appendChild(opt);
        });
        serviceSelect.appendChild(optgroupSrv);
      }

      if (packages.length > 0) {
        const optgroupPkg = document.createElement('optgroup');
        optgroupPkg.label = 'Gói Combo Tiết Kiệm';
        packages.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.name;
          const priceText = typeof formatCurrency === 'function' ? formatCurrency(p.price) : `${p.price}đ`;
          opt.textContent = `${p.name} (${priceText})`;
          optgroupPkg.appendChild(opt);
        });
        serviceSelect.appendChild(optgroupPkg);
      }
    }

    if (amountInput) amountInput.value = '';

  } catch (err) {
    console.error('Lỗi tải dữ liệu lập hóa đơn:', err);
  }

  openModal('modal-create-invoice');
};

function renderInvoicePetsOptions(petsList) {
  const petSelect = document.getElementById('create-inv-pet-id');
  if (!petSelect) return;

  if (!petsList || petsList.length === 0) {
    petSelect.innerHTML = '<option value="">-- Không tìm thấy thú cưng phù hợp --</option>';
  } else {
    petSelect.innerHTML = '<option value="">-- Chọn thú cưng --</option>' + 
      petsList.map(p => {
        const ownerName = p.owner_name ? ` (Chủ: ${p.owner_name})` : '';
        return `<option value="${p.id}" data-user-id="${p.user_id || ''}">${escapeHTML(p.name)} - ${escapeHTML(p.species || 'Thú cưng')}${escapeHTML(ownerName)}</option>`;
      }).join('');
  }
}

window.onInvoiceAppSelected = function(appId) {
  if (!appId) return;
  const unbilled = window._cachedUnbilledAppointments || [];
  const found = unbilled.find(a => a.id === appId);
  if (!found) return;

  const userSelect = document.getElementById('create-inv-user-id');
  if (userSelect && found.ownerId) {
    userSelect.value = found.ownerId;
    window.onInvoiceOwnerSelected(found.ownerId);
  }

  const petSelect = document.getElementById('create-inv-pet-id');
  if (petSelect && found.petId) {
    petSelect.value = found.petId;
  }

  const serviceSelect = document.getElementById('create-inv-service');
  if (serviceSelect && found.examinationType) {
    serviceSelect.value = found.examinationType;
    window.onInvoiceServiceSelected(found.examinationType);
  }

  const amountInput = document.getElementById('create-inv-amount');
  if (amountInput && found.price) {
    amountInput.value = found.price;
  }
};

window.onInvoiceOwnerSelected = function(userId) {
  const allPets = window._cachedInvoicePets || [];
  if (!userId) {
    renderInvoicePetsOptions(allPets);
    return;
  }
  const filtered = allPets.filter(p => p.user_id === userId);
  renderInvoicePetsOptions(filtered);
  if (filtered.length === 1) {
    const petSelect = document.getElementById('create-inv-pet-id');
    if (petSelect) petSelect.value = filtered[0].id;
  }
};

window.onInvoicePetSelected = function(petId) {
  if (!petId) return;
  const allPets = window._cachedInvoicePets || [];
  const pet = allPets.find(p => p.id === petId);
  if (pet && pet.user_id) {
    const userSelect = document.getElementById('create-inv-user-id');
    if (userSelect && userSelect.value !== pet.user_id) {
      userSelect.value = pet.user_id;
    }
  }
};

window.onInvoiceServiceSelected = function(serviceName) {
  if (!serviceName) return;
  const allServices = window._cachedInvoiceServices || [];
  const found = allServices.find(s => s.name && s.name.trim().toLowerCase() === serviceName.trim().toLowerCase());
  const amountInput = document.getElementById('create-inv-amount');
  if (amountInput && found && found.price) {
    amountInput.value = found.price;
  }
};

