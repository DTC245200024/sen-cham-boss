/* =========================================================
   SERVICES & SERVICE PACKAGES MANAGEMENT
   Sen Chăm Boss - Quản lý dịch vụ & gói chăm sóc
   ========================================================= */

(function() {
  let cachedServices = [];
  let currentActiveTab = 'services';

  function isUserAdmin() {
    const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    const role = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
    return role === 'ADMIN' || role === 'STORE_MANAGER';
  }

  function updateActionButtonsVisibility() {
    const serviceAdminActions = document.getElementById('service-admin-actions');
    const btnAddService = document.getElementById('btn-add-service-tab');
    const btnAddPackage = document.getElementById('btn-add-package-tab');

    const canManage = isUserAdmin();

    if (serviceAdminActions) {
      serviceAdminActions.style.display = canManage ? 'flex' : 'none';
    }

    if (btnAddService && btnAddPackage) {
      if (!canManage) {
        btnAddService.style.display = 'none';
        btnAddPackage.style.display = 'none';
      } else {
        if (currentActiveTab === 'packages') {
          btnAddService.style.display = 'none';
          btnAddPackage.style.display = 'inline-flex';
        } else {
          btnAddService.style.display = 'inline-flex';
          btnAddPackage.style.display = 'none';
        }
      }
    }
  }

  window.initServicesUI = function() {
    const serviceForm = document.getElementById('service-form');
    const packageForm = document.getElementById('package-form');
    const searchInput = document.getElementById('service-search-input');
    const categoryFilter = document.getElementById('service-category-filter');

    // Tab switching inside Services View
    const tabBtns = document.querySelectorAll('.service-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        currentActiveTab = tab;

        document.querySelectorAll('.service-tab-pane').forEach(p => p.style.display = 'none');
        const targetPane = document.getElementById(`service-tab-pane-${tab}`);
        if (targetPane) targetPane.style.display = 'block';

        updateActionButtonsVisibility();

        if (tab === 'services') {
          loadServicesList();
        } else if (tab === 'packages') {
          loadServicePackagesList();
        }
      });
    });

    // Form submit: Service Form
    if (serviceForm) {
      serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isUserAdmin()) {
          showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền thực hiện thao tác này.', 'error');
          return;
        }

        const serviceId = document.getElementById('service-form-id').value;
        const payload = {
          name: document.getElementById('service-form-name').value.trim(),
          category: document.getElementById('service-form-category').value,
          price: parseFloat(document.getElementById('service-form-price').value) || 0,
          duration: document.getElementById('service-form-duration').value.trim() || '30 phút',
          description: document.getElementById('service-form-description').value.trim(),
          status: document.getElementById('service-form-status').value
        };

        if (!payload.name || payload.price <= 0) {
          showToast('Vui lòng nhập Tên dịch vụ và Giá hợp lệ.', 'error');
          return;
        }

        const submitBtn = serviceForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        }

        try {
          const method = serviceId ? 'PUT' : 'POST';
          const url = serviceId ? `/services/${serviceId}` : '/services';
          const res = await apiRequest(url, method, payload);

          if (res && res.success) {
            showToast(res.message || 'Lưu dịch vụ thành công!', 'success');
            closeModal('modal-service');
            loadServicesList();
          } else {
            showToast((res && res.message) || 'Lỗi khi lưu dịch vụ', 'error');
          }
        } catch (err) {
          console.error('Save service error:', err);
          showToast('Lỗi kết nối máy chủ.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Dịch Vụ';
          }
        }
      });
    }

    // Form submit: Package Form
    if (packageForm) {
      packageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isUserAdmin()) {
          showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền thực hiện thao tác này.', 'error');
          return;
        }

        const packageId = document.getElementById('package-form-id').value;
        const servicesInput = document.getElementById('package-form-services')?.value || '';
        let servicesArr = [];
        try {
          if (servicesInput.startsWith('[')) {
            servicesArr = JSON.parse(servicesInput);
          } else if (servicesInput) {
            servicesArr = servicesInput.split(',').map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          servicesArr = [];
        }

        const payload = {
          name: document.getElementById('package-form-name').value.trim(),
          services_included: Array.isArray(servicesArr) ? servicesArr : [],
          price: parseFloat(document.getElementById('package-form-price').value) || 0,
          original_price: parseFloat(document.getElementById('package-form-original-price').value) || parseFloat(document.getElementById('package-form-price').value) || 0,
          validity: document.getElementById('package-form-validity').value.trim() || '30 ngày',
          description: document.getElementById('package-form-description').value.trim(),
          status: document.getElementById('package-form-status').value
        };

        if (!payload.name || payload.price <= 0) {
          showToast('Vui lòng nhập Tên gói và Giá gói hợp lệ.', 'error');
          return;
        }

        const submitBtn = packageForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        }

        try {
          const method = packageId ? 'PUT' : 'POST';
          const url = packageId ? `/services/packages/${packageId}` : '/services/packages';
          const res = await apiRequest(url, method, payload);

          if (res && res.success) {
            showToast(res.message || 'Lưu gói dịch vụ thành công!', 'success');
            closeModal('modal-package');
            loadServicePackagesList();
          } else {
            showToast((res && res.message) || 'Lỗi khi lưu gói dịch vụ', 'error');
          }
        } catch (err) {
          console.error('Save package error:', err);
          showToast('Lỗi kết nối máy chủ.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Gói Dịch Vụ';
          }
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => loadServicesList(), 300));
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => loadServicesList());
    }

    updateActionButtonsVisibility();
    loadServicesList();
  };

  // Open Add Service Modal
  window.openAddServiceModal = function() {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền thêm dịch vụ mới.', 'error');
      return;
    }

    const serviceForm = document.getElementById('service-form');
    if (!serviceForm) return;

    serviceForm.reset();
    document.getElementById('service-form-id').value = '';
    document.getElementById('service-form-status').value = 'ACTIVE';

    const title = document.getElementById('modal-service-title');
    if (title) title.textContent = 'Thêm Dịch Vụ Mới';

    openModal('modal-service');
  };

  // Open Add Package Modal
  window.openAddPackageModal = function() {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền thêm gói dịch vụ mới.', 'error');
      return;
    }

    const packageForm = document.getElementById('package-form');
    if (!packageForm) return;

    packageForm.reset();
    document.getElementById('package-form-id').value = '';
    const servicesInput = document.getElementById('package-form-services');
    if (servicesInput) servicesInput.value = '';
    document.getElementById('package-form-status').value = 'ACTIVE';
    document.getElementById('package-form-validity').value = '30 ngày';

    const title = document.getElementById('modal-package-title');
    if (title) title.textContent = 'Thêm Gói Dịch Vụ Mới';

    openModal('modal-package');
  };

  // Load Services Grid
  window.loadServicesList = async function() {
    const container = document.getElementById('services-grid-container');
    if (!container) return;

    updateActionButtonsVisibility();

    const canManage = isUserAdmin();
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
    const isCareStaff = userRole === 'CARE_STAFF';

    const search = document.getElementById('service-search-input')?.value || '';
    const category = document.getElementById('service-category-filter')?.value || 'ALL';

    let url = `/services?search=${encodeURIComponent(search)}`;
    if (category !== 'ALL') url += `&category=${encodeURIComponent(category)}`;

    container.innerHTML = '<div class="loading-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i><div style="margin-top: 8px;">Đang tải danh sách dịch vụ...</div></div>';

    const res = await apiRequest(url, 'GET');
    if (!res || !res.success || !res.services || res.services.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <i class="fa-solid fa-hand-holding-heart" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
          <h4 style="font-weight: 700; color: var(--text-main);">Chưa có dịch vụ nào phù hợp</h4>
          <p style="color: var(--text-muted); font-size: 13.5px; margin-top: 4px;">Các dịch vụ chăm sóc và bảng giá niêm yết sẽ xuất hiện tại đây.</p>
          ${canManage ? `
            <button class="btn btn-primary" onclick="openAddServiceModal()" style="margin-top: 14px;">
              <i class="fa-solid fa-plus"></i> + Thêm dịch vụ ngay
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    cachedServices = res.services;

    container.innerHTML = res.services.map(s => {
      const statusBadge = s.status === 'ACTIVE' 
        ? '<span class="badge badge-success">Đang hoạt động</span>' 
        : '<span class="badge badge-warning">Tạm ngưng</span>';

      let actionButtonsHtml = '';
      if (canManage) {
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

  // Load Service Packages Grid
  window.loadServicePackagesList = async function() {
    const container = document.getElementById('packages-grid-container');
    if (!container) return;

    updateActionButtonsVisibility();

    const canManage = isUserAdmin();
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
    const isCareStaff = userRole === 'CARE_STAFF';

    container.innerHTML = '<div class="loading-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i><div style="margin-top: 8px;">Đang tải danh sách gói dịch vụ...</div></div>';

    const res = await apiRequest('/services/packages', 'GET');
    if (!res || !res.success || !res.packages || res.packages.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; background: #fff; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <i class="fa-solid fa-box-open" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
          <h4 style="font-weight: 700; color: var(--text-main);">Chưa có gói dịch vụ nào</h4>
          <p style="color: var(--text-muted); font-size: 13.5px; margin-top: 4px;">Các gói dịch vụ combo ưu đãi sẽ xuất hiện tại đây.</p>
          ${canManage ? `
            <button class="btn btn-primary" onclick="openAddPackageModal()" style="margin-top: 14px;">
              <i class="fa-solid fa-plus"></i> + Thêm gói dịch vụ ngay
            </button>
          ` : ''}
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
      if (canManage) {
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

  // Edit Service
  window.openEditServiceModal = async function(id) {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền sửa dịch vụ.', 'error');
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

  // Delete Service
  window.deleteService = async function(id, name) {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền xóa dịch vụ.', 'error');
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

  // Edit Package
  window.openEditPackageModal = async function(id) {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền sửa gói dịch vụ.', 'error');
      return;
    }

    const res = await apiRequest(`/services/packages`, 'GET');
    if (res && res.success && res.packages) {
      const p = res.packages.find(item => item.id === id);
      if (!p) return;

      document.getElementById('package-form-id').value = p.id;
      document.getElementById('package-form-name').value = p.name;
      const servicesInput = document.getElementById('package-form-services');
      if (servicesInput) {
        servicesInput.value = JSON.stringify(p.services_included || []);
      }
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

  // Delete Package
  window.deletePackage = async function(id, name) {
    if (!isUserAdmin()) {
      showToast('Chỉ Admin (Quản lý hệ thống) mới có quyền xóa gói dịch vụ.', 'error');
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

  // Quick book redirect
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
})();
