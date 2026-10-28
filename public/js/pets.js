/* =========================================================
   PET MANAGEMENT FRONTEND LOGIC (CRUD, Filters, Modals)
   ========================================================= */

let currentSpeciesFilter = 'ALL';

function initPetsUI() {
  const filterBtns = document.querySelectorAll('.filter-pet-btn');
  const searchInput = document.getElementById('pet-search-input');
  const openAddBtn = document.getElementById('open-add-pet-btn');
  const petForm = document.getElementById('pet-form');
  const speciesSelect = document.getElementById('pet-form-species');
  const speciesOtherInput = document.getElementById('pet-form-species-other');

  if (speciesSelect && speciesOtherInput) {
    speciesSelect.addEventListener('change', () => {
      if (speciesSelect.value === 'Khác') {
        speciesOtherInput.style.display = 'block';
        speciesOtherInput.focus();
      } else {
        speciesOtherInput.style.display = 'none';
        speciesOtherInput.value = '';
      }
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeciesFilter = btn.getAttribute('data-species');
      loadPetsList();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      loadPetsList();
    });
  }

  const healthFilter = document.getElementById('pet-health-filter');
  if (healthFilter) {
    healthFilter.addEventListener('change', () => {
      loadPetsList();
    });
  }

  const currentUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : JSON.parse(localStorage.getItem('user') || localStorage.getItem('petcare_user') || 'null'));
  const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : 'USER';
  const isCareStaff = userRole === 'CARE_STAFF' || userRole === 'STAFF';

  if (openAddBtn) {
    if (isCareStaff) {
      openAddBtn.style.display = 'none';
    } else {
      openAddBtn.style.display = 'inline-flex';
    }

    openAddBtn.addEventListener('click', async () => {
      if (isCareStaff) return;
      if (petForm) petForm.reset();
      document.getElementById('pet-form-id').value = '';
      const titleEl = document.getElementById('modal-pet-title');
      if (titleEl) titleEl.innerText = 'Thêm Thú Cưng Mới';
      const submitTxt = document.getElementById('pet-form-submit-txt');
      if (submitTxt) submitTxt.innerText = 'Lưu Thông Tin Thú Cưng';

      const ownerGroup = document.getElementById('pet-form-owner-group');
      const ownerSelect = document.getElementById('pet-form-owner');
      if (ownerGroup && ownerSelect) {
        if (['ADMIN','STORE_MANAGER'].includes(userRole) || userRole === 'RECEPTIONIST') {
          ownerGroup.style.display = 'block';
          const uRes = await apiRequest('/users');
          if (uRes && uRes.success) {
            ownerSelect.innerHTML = (uRes.users || []).map(u => 
              `<option value="${u.id}">${escapeHTML(u.full_name)} (${escapeHTML(u.email || u.phone || '')})</option>`
            ).join('');
          }
        } else {
          ownerGroup.style.display = 'none';
        }
      }

      if (speciesOtherInput) {
        speciesOtherInput.style.display = 'none';
        speciesOtherInput.value = '';
      }
      document.getElementById('pet-form-photo').value = '';
      const preview = document.getElementById('pet-photo-preview');
      if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
      openModal('modal-pet');
    });
  }

  const photoFileInput = document.getElementById('pet-form-photo-file');
  const photoPreview = document.getElementById('pet-photo-preview');
  
  if (photoFileInput) {
    photoFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          photoPreview.src = evt.target.result;
          photoPreview.style.display = 'block';
        }
        reader.readAsDataURL(file);
      } else {
        photoPreview.src = '';
        photoPreview.style.display = 'none';
      }
    });
  }

  if (petForm) {
    petForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('pet-form-photo-file');
      let photoUrl = document.getElementById('pet-form-photo')?.value || '';

      // Upload new photo only if a file is selected
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const uploadRes = await apiUpload(fileInput.files[0]);
        if (uploadRes && uploadRes.success && uploadRes.url) {
          photoUrl = uploadRes.url;
        } else {
          showToast((uploadRes && uploadRes.message) || 'Không thể tải ảnh lên. Vui lòng thử lại.', 'error');
          return; // Stop form submission so user does not lose entered pet details
        }
      }

      const id = document.getElementById('pet-form-id')?.value;
      
      let speciesVal = document.getElementById('pet-form-species')?.value || 'Khác';
      if (speciesVal === 'Khác') {
        const otherSpecies = document.getElementById('pet-form-species-other')?.value?.trim();
        speciesVal = otherSpecies || 'Khác';
      }

      const data = {
        name: document.getElementById('pet-form-name')?.value?.trim() || '',
        species: speciesVal,
        breed: document.getElementById('pet-form-breed')?.value?.trim() || '',
        gender: document.getElementById('pet-form-gender')?.value || 'Đực',
        dob: document.getElementById('pet-form-dob')?.value || '',
        weight: document.getElementById('pet-form-weight')?.value || '',
        fur_color: document.getElementById('pet-form-color')?.value?.trim() || '',
        photo_url: photoUrl,
        health_status: document.getElementById('pet-form-health')?.value || 'Khỏe mạnh',
        notes: document.getElementById('pet-form-notes')?.value?.trim() || ''
      };

      const ownerSelect = document.getElementById('pet-form-owner');
      const ownerGroup = document.getElementById('pet-form-owner-group');
      if (ownerGroup && ownerGroup.style.display !== 'none' && ownerSelect && ownerSelect.value) {
        data.user_id = ownerSelect.value;
      }

      let res = null;
      if (id) {
        res = await apiRequest(`/pets/${id}`, 'PUT', data);
      } else {
        res = await apiRequest('/pets', 'POST', data);
      }

      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-pet');
        petForm.reset();
        document.getElementById('pet-form-id').value = '';
        loadPetsList();
        if (window.loadAdminPets) window.loadAdminPets();
        if (window.loadDashboardData) window.loadDashboardData();
        if (window.populatePetDropdowns) window.populatePetDropdowns();
        if (window.loadHealthData) window.loadHealthData();
      } else {
        showToast(res.message, 'error');
      }
    });
  }
}

async function loadPetsList() {
  const search = document.getElementById('pet-search-input')?.value || '';
  const query = `?species=${currentSpeciesFilter}&search=${encodeURIComponent(search)}`;
  const res = await apiRequest(`/pets${query}`);

  const container = document.getElementById('pets-grid-container');
  if (!container || !res.success) return;

  const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : JSON.parse(localStorage.getItem('user') || localStorage.getItem('petcare_user') || 'null'));
  const userRole = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
  const isCareStaff = userRole === 'CARE_STAFF' || userRole === 'STAFF';

  const openAddBtn = document.getElementById('open-add-pet-btn');
  if (openAddBtn) {
    openAddBtn.style.display = isCareStaff ? 'none' : 'inline-flex';
  }

  let petsToRender = res.pets || [];
  
  const healthFilterVal = document.getElementById('pet-health-filter')?.value;
  if (healthFilterVal && healthFilterVal !== 'ALL') {
    petsToRender = petsToRender.filter(p => p.health_status === healthFilterVal);
  }

  if (petsToRender.length === 0) {
    const emptyMsg = isCareStaff
      ? '<i class="fa-solid fa-paw"></i> Không tìm thấy thú cưng nào phù hợp.'
      : '<i class="fa-solid fa-paw"></i> Chưa có thú cưng nào phù hợp. Bấm "Thêm Thú Cưng Mới" để tạo!';
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">${emptyMsg}</div>`;
    return;
  }

  container.innerHTML = petsToRender
    .map((pet) => {
      const defaultImg =
        pet.species === 'Mèo'
          ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80'
          : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

      const healthBadge =
        pet.health_status === 'Khỏe mạnh'
          ? 'badge-success'
          : pet.health_status === 'Cần theo dõi'
          ? 'badge-warning'
          : 'badge-danger';

      const canManage = user && (['ADMIN','STORE_MANAGER'].includes(user.role) || user.id === pet.user_id);

      return `
      <div class="pet-card" id="pet-card-${pet.id}">
        <img src="${pet.photo_url || defaultImg}" class="pet-card-img" alt="${pet.name}" onerror="this.src='${defaultImg}'">
        <div class="pet-card-body">
          ${getSpeciesBadge(pet.species)}
          <span style="font-size:12px; color:var(--text-muted); float:right;">Mã: ${pet.pet_code}</span>
          <h3 class="pet-name">${pet.name}</h3>
          
          <div class="pet-info-meta">
            <span><i class="fa-solid fa-dna"></i> ${pet.breed || 'Chưa rõ giống'}</span>
            <span><i class="fa-solid fa-venus-mars"></i> ${pet.gender}</span>
            <span><i class="fa-solid fa-weight-scale"></i> ${pet.weight || 0} kg</span>
            <span><i class="fa-solid fa-cake-candles"></i> ${pet.age_months} tháng tuổi</span>
          </div>

          <div style="margin-bottom:16px;">
            <span class="badge ${healthBadge}">${pet.health_status}</span>
          </div>

          ${(user && (['ADMIN','STORE_MANAGER'].includes(user.role) || user.role === 'RECEPTIONIST')) ? `<p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;"><i class="fa-solid fa-user"></i> Chủ: <b>${pet.owner_name}</b></p>` : ''}

          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="viewPetHealth('${pet.id}')" style="flex:1;">
              <i class="fa-solid fa-heart-pulse"></i> Hồ sơ
            </button>
            ${canManage ? `
            <button class="btn btn-outline btn-sm" onclick="editPet('${pet.id}')" title="Chỉnh sửa hồ sơ thú cưng">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deletePet('${pet.id}', '${pet.name.replace(/'/g, "\\'")}')" title="Xóa thú cưng">
              <i class="fa-solid fa-trash"></i>
            </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

async function editPet(id) {
  const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : JSON.parse(localStorage.getItem('user') || 'null'));
  const userRole = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
  
  const res = await apiRequest(`/pets/${id}`);
  if (!res.success || !res.pet) {
    showToast(res.message || 'Không thể tải thông tin thú cưng', 'error');
    return;
  }

  const p = res.pet;

  // Permission check
  if (user && !['ADMIN', 'STORE_MANAGER'].includes(user.role) && p.user_id !== user.id) {
    showToast('Bạn không có quyền chỉnh sửa thú cưng này.', 'error');
    return;
  }

  document.getElementById('pet-form-id').value = p.id;
  document.getElementById('pet-form-name').value = p.name || '';

  const ownerGroup = document.getElementById('pet-form-owner-group');
  const ownerSelect = document.getElementById('pet-form-owner');
  if (ownerGroup && ownerSelect) {
    if (['ADMIN','STORE_MANAGER'].includes(userRole) || userRole === 'RECEPTIONIST') {
      ownerGroup.style.display = 'block';
      const uRes = await apiRequest('/users');
      if (uRes && uRes.success) {
        ownerSelect.innerHTML = (uRes.users || []).map(u => 
          `<option value="${u.id}" ${u.id === p.user_id ? 'selected' : ''}>${escapeHTML(u.full_name)} (${escapeHTML(u.email || u.phone || '')})</option>`
        ).join('');
      }
    } else {
      ownerGroup.style.display = 'none';
    }
  }
  
  const speciesSelect = document.getElementById('pet-form-species');
  const otherSpeciesInput = document.getElementById('pet-form-species-other');

  if (p.species === 'Chó' || p.species === 'Mèo') {
    if (speciesSelect) speciesSelect.value = p.species;
    if (otherSpeciesInput) {
      otherSpeciesInput.style.display = 'none';
      otherSpeciesInput.value = '';
    }
  } else {
    if (speciesSelect) speciesSelect.value = 'Khác';
    if (otherSpeciesInput) {
      otherSpeciesInput.style.display = 'block';
      otherSpeciesInput.value = p.species || '';
    }
  }

  if (document.getElementById('pet-form-breed')) document.getElementById('pet-form-breed').value = p.breed || '';
  if (document.getElementById('pet-form-gender')) document.getElementById('pet-form-gender').value = p.gender || 'Đực';
  if (document.getElementById('pet-form-dob')) document.getElementById('pet-form-dob').value = p.dob || '';
  if (document.getElementById('pet-form-weight')) document.getElementById('pet-form-weight').value = (p.weight !== undefined && p.weight !== null) ? p.weight : '';
  if (document.getElementById('pet-form-color')) document.getElementById('pet-form-color').value = p.fur_color || '';
  if (document.getElementById('pet-form-photo')) document.getElementById('pet-form-photo').value = p.photo_url || '';
  
  const fileInput = document.getElementById('pet-form-photo-file');
  const preview = document.getElementById('pet-photo-preview');
  if (fileInput) fileInput.value = '';
  if (p.photo_url && preview) {
    preview.src = p.photo_url;
    preview.style.display = 'block';
  } else if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }

  if (document.getElementById('pet-form-health')) document.getElementById('pet-form-health').value = p.health_status || 'Khỏe mạnh';
  if (document.getElementById('pet-form-notes')) document.getElementById('pet-form-notes').value = p.notes || '';

  const titleEl = document.getElementById('modal-pet-title');
  if (titleEl) titleEl.innerText = `Chỉnh Sửa Hồ Sơ Thú Cưng (${p.name})`;
  const submitTxt = document.getElementById('pet-form-submit-txt');
  if (submitTxt) submitTxt.innerText = 'Cập Nhật Thú Cưng';

  openModal('modal-pet');
}

async function deletePet(id, name) {
  if (!confirm('Bạn có chắc muốn xóa thú cưng này không?')) {
    return;
  }

  const res = await apiRequest(`/pets/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message, 'success');
    loadPetsList();
    if (window.loadAdminPets) window.loadAdminPets();
    if (window.loadDashboardData) window.loadDashboardData();
    if (window.populatePetDropdowns) window.populatePetDropdowns();
    if (window.loadHealthData) window.loadHealthData();
  } else {
    showToast(res.message, 'error');
  }
}

function viewPetHealth(petId) {
  if (window.switchView) {
    window.switchView('health', petId);
  }
}

window.loadPetsList = loadPetsList;
window.initPetsUI = initPetsUI;
window.editPet = editPet;
window.deletePet = deletePet;
window.viewPetHealth = viewPetHealth;
