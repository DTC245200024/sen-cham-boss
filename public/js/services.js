/* =========================================================
   SERVICES & SERVICE PACKAGES MANAGEMENT
   ========================================================= */

window.initServicesUI = function() {
  const serviceAdminActions = document.getElementById('service-admin-actions');
  const btnDropdown = document.getElementById('btn-service-add-dropdown');
  const dropdownMenu = document.getElementById('service-dropdown-menu');
  const dropdownChevron = document.getElementById('service-dropdown-chevron');
  const menuOptAddService = document.getElementById('menu-opt-add-service');
  const menuOptAddPackage = document.getElementById('menu-opt-add-package');

  const serviceForm = document.getElementById('service-form');
  const packageForm = document.getElementById('package-form');
  const searchInput = document.getElementById('service-search-input');
  const categoryFilter = document.getElementById('service-category-filter');

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  const canManage = (userRole === 'STORE_MANAGER' || userRole === 'RECEPTIONIST');

  // Toggle dropdown button for STORE_MANAGER & RECEPTIONIST only (ADMIN is view-only)
  if (serviceAdminActions) {
    serviceAdminActions.style.display = canManage ? 'inline-block' : 'none';
  }

  // Dropdown toggle handler
  if (btnDropdown && dropdownMenu) {
    btnDropdown.onclick = (e) => {
      e.stopPropagation();
      const isShown = dropdownMenu.classList.contains('show');
      if (isShown) {
        dropdownMenu.classList.remove('show');
        dropdownMenu.style.display = 'none';
        if (dropdownChevron) dropdownChevron.style.transform = 'rotate(0deg)';
      } else {
        dropdownMenu.classList.add('show');
        dropdownMenu.style.display = 'block';
        if (dropdownChevron) dropdownChevron.style.transform = 'rotate(180deg)';
      }
    };
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (dropdownMenu && !dropdownMenu.contains(e.target) && btnDropdown && !btnDropdown.contains(e.target)) {
      dropdownMenu.classList.remove('show');
      dropdownMenu.style.display = 'none';
      if (dropdownChevron) dropdownChevron.style.transform = 'rotate(0deg)';
    }
  });

  // Tab switching inside Services View
  const tabBtns = document.querySelectorAll('.service-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.service-tab-pane').forEach(p => p.style.display = 'none');
      const targetPane = document.getElementById(`service-tab-pane-${tab}`);
      if (targetPane) targetPane.style.display = 'block';

      if (tab === 'services') {
        loadServicesList();
      } else if (tab === 'packages') {
        loadServicePackagesList();
      }
    });
  });

  // Action: Open Add Service Modal
  if (menuOptAddService) {
    menuOptAddService.onclick = () => {
      if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
        dropdownMenu.style.display = 'none';
      }
      if (dropdownChevron) dropdownChevron.style.transform = 'rotate(0deg)';

      const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
      const role = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
      if (role === 'ADMIN') {
        showToast('Quản trị viên không trực tiếp tạo dịch vụ của cửa hàng. Quyền này thuộc về Quản lý cửa hàng.', 'warning');
        return;
      }
      if (!['STORE_MANAGER', 'RECEPTIONIST'].includes(role)) {
        showToast('Chỉ Quản lý cửa hàng hoặc Lễ tân mới có quyền thêm dịch vụ.', 'error');
        return;
      }
      if (!serviceForm) return;
      serviceForm.reset();
      document.getElementById('service-form-id').value = '';
      const title = document.getElementById('modal-service-title');
      if (title) title.textContent = 'Thêm Dịch Vụ Mới';
      openModal('modal-service');
    };
  }

  // Action: Open Add Package Modal
  if (menuOptAddPackage) {
    menuOptAddPackage.onclick = () => {
      if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
        dropdownMenu.style.display = 'none';
      }
      if (dropdownChevron) dropdownChevron.style.transform = 'rotate(0deg)';

      const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
      const role = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
      if (role === 'ADMIN') {
        showToast('Quản trị viên không trực tiếp tạo gói dịch vụ của cửa hàng. Quyền này thuộc về Quản lý cửa hàng.', 'warning');
        return;
      }
      if (!['STORE_MANAGER', 'RECEPTIONIST'].includes(role)) {
        showToast('Chỉ Quản lý cửa hàng hoặc Lễ tân mới có quyền thêm gói dịch vụ.', 'error');
        return;
      }
      if (!packageForm) return;
      packageForm.reset();
      document.getElementById('package-form-id').value = '';
      const title = document.getElementById('modal-package-title');
      if (title) title.textContent = 'Thêm Gói Dịch Vụ Mới';
      openModal('modal-package');
    };
  }

  // Submit Service Form
  if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const serviceId = document.getElementById('service-form-id').value;
      const payload = {
        name: document.getElementById('service-form-name').value,
        category: document.getElementById('service-form-category').value,
        price: document.getElementById('service-form-price').value,
        duration: document.getElementById('service-form-duration').value,
        description: document.getElementById('service-form-description').value,
        status: document.getElementById('service-form-status').value
      };

      const method = serviceId ? 'PUT' : 'POST';
      const url = serviceId ? `/services/${serviceId}` : '/services';
      const res = await apiRequest(url, method, payload);

      if (res && res.success) {
        showToast(res.message || 'Thao tác thành công!', 'success');
        closeModal('modal-service');
        loadServicesList();
      } else {
        showToast((res && res.message) || 'Lỗi lưu dịch vụ', 'error');
      }
    });
  }

  // Submit Package Form
  if (packageForm) {
    packageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const packageId = document.getElementById('package-form-id').value;
      const payload = {
        name: document.getElementById('package-form-name').value,
        services_included: document.getElementById('package-form-services').value,
        price: document.getElementById('package-form-price').value,
        original_price: document.getElementById('package-form-original-price').value,
        validity: document.getElementById('package-form-validity').value,
        description: document.getElementById('package-form-description').value,
        status: document.getElementById('package-form-status').value
      };

      const method = packageId ? 'PUT' : 'POST';
      const url = packageId ? `/services/packages/${packageId}` : '/services/packages';
      const res = await apiRequest(url, method, payload);

      if (res && res.success) {
        showToast(res.message || 'Thao tác thành công!', 'success');
        closeModal('modal-package');
        loadServicePackagesList();
      } else {
        showToast((res && res.message) || 'Lỗi lưu gói dịch vụ', 'error');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => loadServicesList(), 300));
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => loadServicesList());
  }

  loadServicesList();
};

window.loadServicesList = async function() {
  const container = document.getElementById('services-grid-container');
  if (!container) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  const canAdd = (userRole === 'STORE_MANAGER' || userRole === 'RECEPTIONIST');
  const canEditOrDelete = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole);
  const isCareStaff = userRole === 'CARE_STAFF';

  // Ensure management header actions button is synced (Only STORE_MANAGER & RECEPTIONIST can add)
  const serviceAdminActions = document.getElementById('service-admin-actions');
  if (serviceAdminActions) {
    serviceAdminActions.style.display = canAdd ? 'inline-block' : 'none';
  }

  const search = document.getElementById('service-search-input')?.value || '';
  const category = document.getElementById('service-category-filter')?.value || 'ALL';

  let url = `/services?search=${encodeURIComponent(search)}`;
  if (category !== 'ALL') url += `&category=${encodeURIComponent(category)}`;

  container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dịch vụ...</div>';

  const res = await apiRequest(url, 'GET');
  if (!res || !res.success || !res.services || res.services.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
        <i class="fa-solid fa-hand-holding-heart" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h4 style="font-weight: 700;">Chưa có dịch vụ nào</h4>
        <p style="color: var(--text-muted); font-size: 13.5px;">Các dịch vụ chăm sóc và bảng giá niêm yết sẽ xuất hiện tại đây.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = res.services.map(s => {
    const statusBadge = s.status === 'ACTIVE' 
      ? '<span class="badge badge-success">Đang hoạt động</span>' 
      : '<span class="badge badge-warning">Tạm ngưng</span>';

    const isCareStaff = userRole === 'CARE_STAFF';

    let actionButtonsHtml = '';
    if (canEditOrDelete) {
      actionButtonsHtml = `
        <button class="btn btn-sm btn-outline" style="flex: 1;" onclick="openEditServiceModal('${s.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Sửa
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteService('${s.id}', '${escapeHTML(s.name)}')">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      `;
    } else if (isCareStaff) {
      actionButtonsHtml = `
        <div style="width: 100%; text-align: center; font-size: 12.5px; color: var(--text-muted); padding: 4px 0;">
          <i class="fa-solid fa-info-circle"></i> Thông tin dịch vụ niêm yết
        </div>
      `;
    } else {
      // USER
      actionButtonsHtml = `
        <button class="btn btn-sm btn-primary" style="width: 100%;" onclick="quickBookService('${escapeHTML(s.name)}')">
          <i class="fa-regular fa-calendar-check" style="margin-right: 6px;"></i> Đặt Lịch Ngay
        </button>
      `;
    }

    return `
      <div class="card-box service-card" style="display: flex; flex-direction: column; justify-content: space-between; position: relative; border-top: 4px solid var(--primary); transition: var(--transition);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <span style="font-size: 11.5px; font-weight: 700; color: var(--primary); background: #FFF4EB; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
              ${escapeHTML(s.category || 'Chăm sóc')}
            </span>
            ${statusBadge}
          </div>
          <h4 style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">${escapeHTML(s.name)}</h4>
          <p style="font-size: 13.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">
            ${escapeHTML(s.description || 'Dịch vụ chăm sóc thú cưng chuyên nghiệp, an toàn và chu đáo.')}
          </p>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 14px; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span style="font-size: 13px; color: var(--text-muted);"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${escapeHTML(s.duration || '30 phút')}</span>
            <span style="font-size: 19px; font-weight: 900; color: var(--primary);">${formatCurrency(s.price)}</span>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            ${actionButtonsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.loadServicePackagesList = async function() {
  const container = document.getElementById('packages-grid-container');
  if (!container) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  const canAdd = (userRole === 'STORE_MANAGER' || userRole === 'RECEPTIONIST');
  const canEditOrDelete = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole);
  const isCareStaff = userRole === 'CARE_STAFF';

  // Ensure management header actions button is synced
  const serviceAdminActions = document.getElementById('service-admin-actions');
  if (serviceAdminActions) {
    serviceAdminActions.style.display = canAdd ? 'inline-block' : 'none';
  }

  container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải gói dịch vụ...</div>';

  const res = await apiRequest('/services/packages', 'GET');
  if (!res || !res.success || !res.packages || res.packages.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
        <i class="fa-solid fa-box-open" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h4 style="font-weight: 700;">Chưa có gói dịch vụ nào</h4>
      </div>
    `;
    return;
  }

  container.innerHTML = res.packages.map(p => {
    const includedList = (p.services_included || []).map(item => `
      <li style="font-size: 13px; color: var(--text-main); margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-check-circle" style="color: var(--success); font-size: 14px;"></i> ${escapeHTML(item)}
      </li>
    `).join('');

    let actionButtonsHtml = '';
    if (canEditOrDelete) {
      actionButtonsHtml = `
        <button class="btn btn-sm btn-outline" style="flex: 1;" onclick="openEditPackageModal('${p.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Sửa
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deletePackage('${p.id}', '${escapeHTML(p.name)}')">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      `;
    } else if (isCareStaff) {
      actionButtonsHtml = `
        <div style="width: 100%; text-align: center; font-size: 12.5px; color: var(--text-muted); padding: 4px 0;">
          <i class="fa-solid fa-info-circle"></i> Thông tin gói combo niêm yết
        </div>
      `;
    } else {
      // USER
      actionButtonsHtml = `
        <button class="btn btn-sm btn-primary" style="width: 100%;" onclick="quickBookService('${escapeHTML(p.name)}')">
          <i class="fa-solid fa-cart-plus" style="margin-right: 6px;"></i> Đăng Ký Gói Ngay
        </button>
      `;
    }

    return `
      <div class="card-box package-card" style="display: flex; flex-direction: column; justify-content: space-between; border: 2px solid var(--border); position: relative; transition: var(--transition);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="badge badge-info"><i class="fa-solid fa-tags"></i> Gói Tiết Kiệm</span>
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;"><i class="fa-regular fa-clock"></i> ${escapeHTML(p.validity || '30 ngày')}</span>
          </div>
          <h4 style="font-size: 18px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">${escapeHTML(p.name)}</h4>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px;">${escapeHTML(p.description || '')}</p>

          <div style="background: var(--bg-main); padding: 12px 14px; border-radius: var(--radius-md); margin-bottom: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 8px;">Dịch vụ bao gồm:</span>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${includedList || '<li style="font-size: 12.5px; color: var(--text-muted);">Trọn gói nhiều dịch vụ</li>'}
            </ul>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px;">
            ${p.original_price && p.original_price > p.price ? `
              <span style="font-size: 13.5px; text-decoration: line-through; color: var(--text-muted);">${formatCurrency(p.original_price)}</span>
            ` : '<span></span>'}
            <span style="font-size: 22px; font-weight: 900; color: var(--primary);">${formatCurrency(p.price)}</span>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            ${actionButtonsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.openEditServiceModal = async function(id) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  if (!['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole)) {
    showToast('Chỉ Quản trị viên, Quản lý cửa hàng hoặc Lễ tân mới có quyền sửa dịch vụ.', 'error');
    return;
  }

  const res = await apiRequest(`/services`, 'GET');
  if (res && res.success && res.services) {
    const s = res.services.find(item => item.id === id);
    if (!s) return;

    document.getElementById('service-form-id').value = s.id;
    document.getElementById('service-form-name').value = s.name;
    document.getElementById('service-form-category').value = s.category || 'Chăm sóc chung';
    document.getElementById('service-form-price').value = s.price;
    document.getElementById('service-form-duration').value = s.duration || '30 phút';
    document.getElementById('service-form-description').value = s.description || '';
    document.getElementById('service-form-status').value = s.status || 'ACTIVE';

    const title = document.getElementById('modal-service-title');
    if (title) title.textContent = 'Chỉnh Sửa Dịch Vụ';
    openModal('modal-service');
  }
};

window.deleteService = async function(id, name) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  if (!['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole)) {
    showToast('Chỉ Quản trị viên, Quản lý cửa hàng hoặc Lễ tân mới có quyền xóa dịch vụ.', 'error');
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa dịch vụ "${name}" không?`)) return;
  const res = await apiRequest(`/services/${id}`, 'DELETE');
  if (res && res.success) {
    showToast(res.message || 'Đã xóa dịch vụ thành công!', 'success');
    loadServicesList();
  } else {
    showToast((res && res.message) || 'Lỗi khi xóa dịch vụ', 'error');
  }
};

window.openEditPackageModal = async function(id) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  if (!['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole)) {
    showToast('Chỉ Quản trị viên, Quản lý cửa hàng hoặc Lễ tân mới có quyền sửa gói dịch vụ.', 'error');
    return;
  }

  const res = await apiRequest(`/services/packages`, 'GET');
  if (res && res.success && res.packages) {
    const p = res.packages.find(item => item.id === id);
    if (!p) return;

    document.getElementById('package-form-id').value = p.id;
    document.getElementById('package-form-name').value = p.name;
    document.getElementById('package-form-services').value = (p.services_included || []).join(', ');
    document.getElementById('package-form-price').value = p.price;
    document.getElementById('package-form-original-price').value = p.original_price || p.price;
    document.getElementById('package-form-validity').value = p.validity || '30 ngày';
    document.getElementById('package-form-description').value = p.description || '';
    document.getElementById('package-form-status').value = p.status || 'ACTIVE';

    const title = document.getElementById('modal-package-title');
    if (title) title.textContent = 'Chỉnh Sửa Gói Dịch Vụ';
    openModal('modal-package');
  }
};

window.deletePackage = async function(id, name) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  if (!['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole)) {
    showToast('Chỉ Quản trị viên, Quản lý cửa hàng hoặc Lễ tân mới có quyền xóa gói dịch vụ.', 'error');
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa gói dịch vụ "${name}" không?`)) return;
  const res = await apiRequest(`/services/packages/${id}`, 'DELETE');
  if (res && res.success) {
    showToast(res.message || 'Đã xóa gói dịch vụ thành công!', 'success');
    loadServicePackagesList();
  } else {
    showToast((res && res.message) || 'Lỗi khi xóa gói dịch vụ', 'error');
  }
};

window.quickBookService = async function(serviceName) {
  if (typeof switchView === 'function') {
    switchView('appointments');
  }
  setTimeout(async () => {
    if (typeof window.openBookAppointmentModal === 'function') {
      await window.openBookAppointmentModal();
    }
    const examTypeSelect = document.getElementById('app-exam-type');
    const reasonInput = document.getElementById('app-reason');
    if (examTypeSelect && serviceName) {
      let matched = false;
      for (let opt of examTypeSelect.options) {
        if (opt.value.toLowerCase() === serviceName.toLowerCase() || opt.text.toLowerCase().includes(serviceName.toLowerCase())) {
          examTypeSelect.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const opt = new Option(serviceName, serviceName, true, true);
        examTypeSelect.add(opt);
        examTypeSelect.value = serviceName;
      }
    }
    if (reasonInput && serviceName) {
      reasonInput.value = `Đặt dịch vụ: ${serviceName}`;
    }
  }, 250);
};
