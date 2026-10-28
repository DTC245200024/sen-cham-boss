/* =========================================================
   HEALTH RECORDS & WEIGHT TIMELINE LOGIC
   ========================================================= */

let weightChartInstance = null;

function initHealthUI() {
  const petSelect = document.getElementById('health-pet-select');

  if (petSelect) {
    petSelect.addEventListener('change', () => {
      loadHealthData(petSelect.value);
    });
  }

  // AI Tóm tắt Button
  const btnAiSummarize = document.getElementById('btn-ai-summarize-pet');
  if (btnAiSummarize) {
    btnAiSummarize.addEventListener('click', () => {
      openAiHealthSummaryModal();
    });
  }
  const btnAiSummarizeHeader = document.getElementById('open-ai-health-summary-btn');
  if (btnAiSummarizeHeader) {
    btnAiSummarizeHeader.addEventListener('click', () => {
      openAiHealthSummaryModal();
    });
  }

  // Weight Record Form
  const openAddWeightBtn = document.getElementById('open-add-weight-btn');
  const weightForm = document.getElementById('weight-record-form');
  if (openAddWeightBtn) {
    openAddWeightBtn.addEventListener('click', async () => {
      await populatePetDropdowns();
      const currentSelected = document.getElementById('health-pet-select')?.value;
      if (!currentSelected) {
        showToast('Vui lòng chọn thú cưng trước', 'warning');
        return;
      }
      if (weightForm) {
        weightForm.reset();
        document.getElementById('weight-form-pet').value = currentSelected;
        document.getElementById('weight-form-date').value = new Date().toISOString().split('T')[0];
      }
      openModal('modal-add-weight');
    });
  }

  if (weightForm) {
    weightForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pet_id = document.getElementById('weight-form-pet')?.value;
      const weight = document.getElementById('weight-form-val')?.value;
      const recorded_date = document.getElementById('weight-form-date')?.value;
      const notes = document.getElementById('weight-form-notes')?.value;

      const res = await apiRequest('/health/weight', 'POST', {
        pet_id,
        weight,
        recorded_date,
        notes
      });

      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-add-weight');
        loadHealthData(pet_id);
      } else {
        showToast(res.message, 'error');
      }
    });
  }

  // Health Form (Ghi Nhận Hồ Sơ Chăm Sóc)
  const openAddHealthBtn = document.getElementById('open-add-health-btn');
  const healthForm = document.getElementById('health-form');
  if (openAddHealthBtn) {
    openAddHealthBtn.addEventListener('click', async () => {
      const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || '{}');
      if (user.role === 'ADMIN') {
        showToast('ADMIN không trực tiếp lập hồ sơ chăm sóc mới.', 'warning');
        return;
      }
      await populatePetDropdowns();
      const currentSelected = document.getElementById('health-pet-select')?.value;
      if (currentSelected && document.getElementById('health-form-pet')) {
        document.getElementById('health-form-pet').value = currentSelected;
      }
      healthForm.reset();
      if (document.getElementById('health-form-id')) document.getElementById('health-form-id').value = '';
      if (document.getElementById('health-form-date')) document.getElementById('health-form-date').value = new Date().toISOString().split('T')[0];
      if (document.getElementById('health-form-doctor')) {
        const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || '{}');
        document.getElementById('health-form-doctor').value = user.full_name || 'Nhân viên chăm sóc';
      }
      if (document.getElementById('health-form-weight')) document.getElementById('health-form-weight').value = '';
      if (document.getElementById('health-form-vaccine-name')) document.getElementById('health-form-vaccine-name').value = '';
      if (document.getElementById('health-form-vaccine-next-date')) document.getElementById('health-form-vaccine-next-date').value = '';
      if (document.getElementById('health-form-deworm-name')) document.getElementById('health-form-deworm-name').value = '';
      if (document.getElementById('health-form-deworm-next-date')) document.getElementById('health-form-deworm-next-date').value = '';
      if (document.getElementById('health-form-med-name')) document.getElementById('health-form-med-name').value = '';
      if (document.getElementById('health-form-med-dosage')) document.getElementById('health-form-med-dosage').value = '';

      const title = document.getElementById('modal-health-title');
      if (title) title.innerHTML = '<i class="fa-solid fa-notes-medical" style="color:var(--primary); margin-right:8px;"></i> Ghi Nhận Hồ Sơ Chăm Sóc';
      openModal('modal-health');
    });
  }
  if (healthForm) {
    healthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pet_id = document.getElementById('health-form-pet')?.value;
      const title = document.getElementById('health-form-title')?.value || 'Dịch vụ chăm sóc';
      const record_date = document.getElementById('health-form-date')?.value || new Date().toISOString().split('T')[0];
      const doctor_name = document.getElementById('health-form-doctor')?.value || (window.currentUser && window.currentUser.full_name) || 'Nhân viên chăm sóc';
      const description = document.getElementById('health-form-desc')?.value || '';
      const notes = document.getElementById('health-form-notes')?.value || '';
      const weight = document.getElementById('health-form-weight')?.value || '';
      const vaccine_name = document.getElementById('health-form-vaccine-name')?.value || '';
      const vaccine_next_date = document.getElementById('health-form-vaccine-next-date')?.value || '';
      const deworm_name = document.getElementById('health-form-deworm-name')?.value || '';
      const deworm_next_date = document.getElementById('health-form-deworm-next-date')?.value || '';
      const med_name = document.getElementById('health-form-med-name')?.value || '';
      const med_dosage = document.getElementById('health-form-med-dosage')?.value || '';

      const data = {
        pet_id,
        record_type: 'CHĂM_SÓC',
        title: title.trim(),
        record_date,
        doctor_name: doctor_name.trim(),
        staff_name: doctor_name.trim(),
        description: description.trim(),
        care_content: description.trim(),
        weight,
        vaccine_name,
        vaccine_next_date,
        deworm_name,
        deworm_next_date,
        med_name,
        med_dosage,
        notes: notes.trim(),
        condition_after: notes.trim(),
        reason: notes.trim()
      };
      
      const recordId = document.getElementById('health-form-id')?.value;
      const method = recordId ? 'PUT' : 'POST';
      const url = recordId ? `/health/${recordId}` : '/health';
      const res = await apiRequest(url, method, data);

      if (res && res.success) {
        showToast(res.message || 'Lưu hồ sơ chăm sóc thành công!', 'success');
        closeModal('modal-health');
        loadHealthData(pet_id);
      } else {
        showToast((res && res.message) || 'Lỗi khi lưu hồ sơ chăm sóc.', 'error');
      }
    });
  }

  // Vaccine Form
  const openAddVaccineBtn = document.getElementById('open-add-vaccine-btn');
  const vaccineForm = document.getElementById('vaccine-form');
  if (openAddVaccineBtn) {
    openAddVaccineBtn.addEventListener('click', async () => {
      await populatePetDropdowns();
      const currentSelected = document.getElementById('health-pet-select')?.value;
      if (!currentSelected) { showToast('Vui lòng chọn thú cưng', 'warning'); return; }
      vaccineForm.reset();
      document.getElementById('vaccine-form-id').value = '';
      document.getElementById('vaccine-form-pet').value = currentSelected;
      document.getElementById('vaccine-form-date').value = new Date().toISOString().split('T')[0];
      const title = document.getElementById('modal-vaccine-title');
      if (title) title.textContent = 'Thêm Mũi Tiêm Phòng';
      openModal('modal-vaccine');
    });
  }
  if (vaccineForm) {
    vaccineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pet_id = document.getElementById('vaccine-form-pet')?.value;
      const data = {
        pet_id,
        vaccine_name: document.getElementById('vaccine-form-name')?.value || '',
        administered_date: document.getElementById('vaccine-form-date')?.value || '',
        next_due_date: document.getElementById('vaccine-form-next-date')?.value || '',
        notes: document.getElementById('vaccine-form-notes')?.value || '',
        
        vaccine_type: document.getElementById('vaccine-form-type')?.value || '',
        disease: document.getElementById('vaccine-form-disease')?.value || '',
        manufacturer: document.getElementById('vaccine-form-manufacturer')?.value || '',
        batch: document.getElementById('vaccine-form-batch')?.value || '',
        expiry: document.getElementById('vaccine-form-expiry')?.value || '',
        dosage: document.getElementById('vaccine-form-dosage')?.value || '',
        route: document.getElementById('vaccine-form-route')?.value || '',
        location: document.getElementById('vaccine-form-location')?.value || '',
        person: document.getElementById('vaccine-form-person')?.value || '',
        clinic: document.getElementById('vaccine-form-clinic')?.value || '',
        pre_status: document.getElementById('vaccine-form-pre-status')?.value || '',
        reaction: document.getElementById('vaccine-form-reaction')?.value || '',
        monitor_time: document.getElementById('vaccine-form-monitor-time')?.value || ''
      };
      
      const recordId = document.getElementById('vaccine-form-id').value;
      const method = recordId ? 'PUT' : 'POST';
      const url = recordId ? `/health/vaccination/${recordId}` : '/health/vaccination';
      const res = await apiRequest(url, method, data);

      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-vaccine');
        loadHealthData(pet_id);
      } else { showToast(res.message, 'error'); }
    });
  }

  // Deworm Form
  const openAddDewormBtn = document.getElementById('open-add-deworm-btn');
  const dewormForm = document.getElementById('deworm-form');
  if (openAddDewormBtn) {
    openAddDewormBtn.addEventListener('click', async () => {
      await populatePetDropdowns();
      const currentSelected = document.getElementById('health-pet-select')?.value;
      if (!currentSelected) { showToast('Vui lòng chọn thú cưng', 'warning'); return; }
      dewormForm.reset();
      document.getElementById('deworm-form-id').value = '';
      document.getElementById('deworm-form-pet').value = currentSelected;
      document.getElementById('deworm-form-date').value = new Date().toISOString().split('T')[0];
      const title = document.getElementById('modal-deworm-title');
      if (title) title.textContent = 'Thêm Tẩy Giun';
      openModal('modal-deworm');
    });
  }
  if (dewormForm) {
    dewormForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pet_id = document.getElementById('deworm-form-pet')?.value;
      const data = {
        pet_id,
        date: document.getElementById('deworm-form-date')?.value || '',
        next_due_date: document.getElementById('deworm-form-next-date')?.value || '',
        status: document.getElementById('deworm-form-status')?.value || 'Đã tẩy',
        notes: document.getElementById('deworm-form-notes')?.value || '',
        
        med_name: document.getElementById('deworm-form-med-name')?.value || '',
        active_ing: document.getElementById('deworm-form-active-ing')?.value || '',
        manufacturer: document.getElementById('deworm-form-manufacturer')?.value || '',
        dosage: document.getElementById('deworm-form-dosage')?.value || '',
        amount: document.getElementById('deworm-form-amount')?.value || '',
        route: document.getElementById('deworm-form-route')?.value || '',
        target: document.getElementById('deworm-form-target')?.value || '',
        weight: document.getElementById('deworm-form-weight')?.value || '',
        person: document.getElementById('deworm-form-person')?.value || '',
        clinic: document.getElementById('deworm-form-clinic')?.value || '',
        pre_status: document.getElementById('deworm-form-pre-status')?.value || '',
        reaction: document.getElementById('deworm-form-reaction')?.value || '',
        stool: document.getElementById('deworm-form-stool')?.value || '',
        vomit: document.getElementById('deworm-form-vomit')?.value || ''
      };
      
      console.log("PET ID =", data.pet_id);
      console.log("NGÀY TẨY =", data.date);
      console.log("FORM DATA =", data);

      const recordId = document.getElementById('deworm-form-id').value;
      const method = recordId ? 'PUT' : 'POST';
      const url = recordId ? `/health/deworming/${recordId}` : '/health/deworming';
      const res = await apiRequest(url, method, data);

      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-deworm');
        loadHealthData(pet_id);
      } else { showToast(res.message, 'error'); }
    });
  }

  // Meds Form
  const openAddMedBtn = document.getElementById('open-add-med-btn');
  const medForm = document.getElementById('med-form');
  if (openAddMedBtn) {
    openAddMedBtn.addEventListener('click', async () => {
      await populatePetDropdowns();
      const currentSelected = document.getElementById('health-pet-select')?.value;
      if (!currentSelected) { showToast('Vui lòng chọn thú cưng', 'warning'); return; }
      medForm.reset();
      document.getElementById('med-form-id').value = '';
      document.getElementById('med-form-pet').value = currentSelected;
      document.getElementById('med-form-start').value = new Date().toISOString().split('T')[0];
      const title = document.getElementById('modal-med-title');
      if (title) title.textContent = 'Thêm Thuốc Đang Dùng';
      openModal('modal-med');
    });
  }
  if (medForm) {
    medForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pet_id = document.getElementById('med-form-pet').value;
      const data = {
        pet_id,
        medicine_name: document.getElementById('med-form-name').value,
        dosage: document.getElementById('med-form-dosage').value,
        frequency: document.getElementById('med-form-frequency').value,
        start_date: document.getElementById('med-form-start').value,
        end_date: document.getElementById('med-form-end').value,
        notes: document.getElementById('med-form-notes').value,
        
        active_ing: document.getElementById('med-form-active-ing').value,
        category: document.getElementById('med-form-category').value,
        form: document.getElementById('med-form-form').value,
        manufacturer: document.getElementById('med-form-manufacturer').value,
        strength: document.getElementById('med-form-strength').value,
        dose_per_kg: document.getElementById('med-form-dose-per-kg').value,
        amount_per_dose: document.getElementById('med-form-amount-per-dose').value,
        unit: document.getElementById('med-form-unit').value,
        route: document.getElementById('med-form-route').value,
        time: document.getElementById('med-form-time').value,
        purpose: document.getElementById('med-form-purpose').value,
        indications: document.getElementById('med-form-indications').value,
        contraindications: document.getElementById('med-form-contraindications').value,
        side_effects: document.getElementById('med-form-side-effects').value,
        prescriber: document.getElementById('med-form-prescriber').value,
        care_instructions: document.getElementById('med-form-care-instructions').value
      };
      
      const recordId = document.getElementById('med-form-id').value;
      const method = recordId ? 'PUT' : 'POST';
      const url = recordId ? `/health/medication/${recordId}` : '/health/medication';
      const res = await apiRequest(url, method, data);

      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-med');
        loadHealthData(pet_id);
      } else { showToast(res.message, 'error'); }
    });
  }

  // Edit Health Record Form
}

async function populatePetDropdowns() {
  const res = await apiRequest('/pets');
  if (!res.success) return;

  const options = res.pets.map((p) => {
    const ownerInfo = (currentUser && ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(currentUser.role)) ? ` - Chủ: ${p.owner_name}` : '';
    return `<option value="${p.id}">${p.name} (${p.species} - Mã: ${p.pet_code}${ownerInfo})</option>`;
  }).join('');

  const healthSelect = document.getElementById('health-pet-select');
  const healthFormPet = document.getElementById('health-form-pet');
  const vaccineFormPet = document.getElementById('vaccine-form-pet');
  const dewormFormPet = document.getElementById('deworm-form-pet');
  const medFormPet = document.getElementById('med-form-pet');
  const scheduleFormPet = document.getElementById('schedule-form-pet');
  const aiGenPet = document.getElementById('ai-gen-pet-select');
  const aiChatPet = document.getElementById('ai-chat-pet-select');
  const schedulePetFilter = document.getElementById('schedule-pet-filter');

  if (healthSelect) healthSelect.innerHTML = options || '<option value="">-- Chưa có thú cưng --</option>';
  if (healthFormPet) healthFormPet.innerHTML = options;
  if (vaccineFormPet) vaccineFormPet.innerHTML = options;
  if (dewormFormPet) dewormFormPet.innerHTML = options;
  if (medFormPet) medFormPet.innerHTML = options;
  if (scheduleFormPet) scheduleFormPet.innerHTML = options;
  if (aiGenPet) aiGenPet.innerHTML = options;
  if (aiChatPet) aiChatPet.innerHTML = `<option value="">-- Chọn thú cưng để tư vấn (không bắt buộc) --</option>` + options;
  if (schedulePetFilter) schedulePetFilter.innerHTML = `<option value="ALL">-- Tất cả thú cưng --</option>` + options;
}

async function loadHealthData(petId) {
  await populatePetDropdowns();
  const select = document.getElementById('health-pet-select');
  if (petId) {
    if (select) select.value = petId;
  } else {
    petId = select?.value;
    if (!petId && select && select.options.length > 0) {
      petId = select.options[0].value;
      select.value = petId;
    }
  }

  if (!petId) {
    const overviewEl = document.getElementById('pet-health-overview');
    if (overviewEl) {
      overviewEl.innerHTML = `
        <div style="text-align:center; padding:30px; background:#fff; border:1px solid var(--border); border-radius:var(--radius-md);">
          <div style="font-size:32px; margin-bottom:8px;"><i class="fa-solid fa-paw"></i></div>
          <div style="font-weight:700; color:var(--text-main); margin-bottom:4px;">Chưa có dữ liệu thú cưng</div>
          <div style="font-size:13px; color:var(--text-muted);">Vui lòng thêm thú cưng vào hệ thống để theo dõi hồ sơ sức khỏe.</div>
        </div>
      `;
    }
    ['health-summary-weight-content', 'health-summary-vaccine-content', 'health-summary-deworm-content', 'health-summary-med-content', 'health-timeline-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  const allPetsContainer = document.getElementById('health-all-pets-container');
  if (allPetsContainer) allPetsContainer.style.display = 'none';

  const res = await apiRequest(`/health/pet/${petId}`);
  if (!res.success || !res.pet) {
    showToast(res.message || 'Không thể tải hồ sơ sức khỏe', 'error');
    return;
  }

  const { pet, records, vaccinations, medications, dewormings, weightTimeline } = res;
  window.currentHealthRecords = records || [];
  window.currentVaccinations = vaccinations || [];
  window.currentDewormings = dewormings || [];
  window.currentMedications = medications || [];

  // Render Pet Overview Header Card
  const defaultPhoto = pet.species === 'Mèo'
    ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80'
    : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';
  
  const speciesBadge = pet.species === 'Chó' ? 'badge-primary' : pet.species === 'Mèo' ? 'badge-info' : 'badge-warning';
  const healthBadge = pet.health_status === 'Khỏe mạnh' ? 'badge-success' : 'badge-danger';
  const ageDisplay = pet.age_months ? `${pet.age_months} tháng tuổi` : (pet.dob ? `Sinh ngày ${formatDate(pet.dob)}` : 'Chưa rõ');

  const overviewEl = document.getElementById('pet-health-overview');
  const isUserAdmin = (typeof currentUser !== 'undefined' && currentUser && ['ADMIN','STORE_MANAGER'].includes(currentUser.role)) || 
                      (window.currentUser && ['ADMIN','STORE_MANAGER'].includes(window.currentUser.role));
  const showAiSummaryButton = !isUserAdmin;

  if (overviewEl) {
    overviewEl.innerHTML = `
      <div style="background: linear-gradient(135deg, #FFF9F5 0%, #FFFFFF 100%); border: 1.5px solid #FFE4D6; border-radius:var(--radius-lg); padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap; justify-content:space-between;">
          <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap; flex:1; min-width:280px;">
            <img src="${pet.photo_url || defaultPhoto}" alt="${pet.name}" style="width:85px; height:85px; border-radius:var(--radius-md); object-fit:cover; border:2px solid var(--primary); box-shadow:0 4px 12px rgba(255,122,0,0.15);" onerror="this.src='${defaultPhoto}'" />
            <div style="flex:1; min-width:240px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
                <h3 style="margin:0; font-size:22px; font-weight:800; color:var(--text-main);">${pet.name}</h3>
                <span class="badge ${speciesBadge}">${pet.species}</span>
                <span class="badge ${healthBadge}">${pet.health_status}</span>
                <span style="font-size:12px; color:var(--text-muted); font-weight:600; background:#f1f5f9; padding:2px 8px; border-radius:4px;">Mã: ${pet.pet_code}</span>
              </div>
              <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:13.5px; color:var(--text-muted); margin-bottom:6px;">
                <span><i class="fa-solid fa-dna" style="color:var(--primary); margin-right:4px;"></i><strong>Giống:</strong> ${pet.breed || 'Chưa rõ'}</span>
                <span><i class="fa-solid fa-venus-mars" style="color:var(--primary); margin-right:4px;"></i><strong>Giới tính:</strong> ${pet.gender || 'Đực'}</span>
                <span><i class="fa-solid fa-cake-candles" style="color:var(--primary); margin-right:4px;"></i><strong>Tuổi:</strong> ${ageDisplay}</span>
                <span><i class="fa-solid fa-weight-scale" style="color:var(--primary); margin-right:4px;"></i><strong>Cân nặng hiện tại:</strong> <b style="color:var(--text-main); font-size:15px;">${pet.weight || 0} kg</b></span>
              </div>
              ${pet.notes ? `<div style="font-size:13px; color:var(--text-muted);"><i class="fa-solid fa-circle-info" style="color:var(--primary); margin-right:4px;"></i><strong>Ghi chú:</strong> ${pet.notes}</div>` : ''}
            </div>
          </div>
          ${showAiSummaryButton ? `
          <!-- Single AI Button in Pet Profile Area (Chủ nuôi & Nhân viên) -->
          <div style="display:flex; align-items:center; gap:10px;">
            <button id="btn-ai-summarize-pet" class="btn btn-secondary" onclick="openAiHealthSummaryModal('${pet.id}')" style="background:linear-gradient(135deg, #10b981, #06b6d4); color:#fff; font-weight:700; border:none; box-shadow:0 4px 14px rgba(16,185,129,0.25); display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border-radius:10px; cursor:pointer; font-size:14px; white-space:nowrap; transition:all 0.2s ease;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> <i class="fa-solid fa-robot"></i> AI Tóm tắt & Gợi ý
            </button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Render Danh Sách Hồ Sơ Chăm Sóc (Gộp toàn bộ thông tin chăm sóc + sức khỏe liên quan)
  const container = document.getElementById('health-timeline-container');
  if (!container) return;

  // Build complete list of care records
  const allCareRecords = [];

  (records || []).forEach(r => {
    allCareRecords.push({
      id: r.id,
      pet_id: r.pet_id,
      record_date: r.record_date || r.created_at,
      title: r.title || 'Hồ sơ chăm sóc định kỳ',
      staff_name: r.doctor_name || r.staff_name || 'Quản lý / Nhân viên',
      care_content: r.care_content || r.description || 'Đã hoàn thành dịch vụ chăm sóc',
      weight: (r.weight && parseFloat(r.weight) > 0) ? r.weight : null,
      vaccine_name: r.vaccine_name || '',
      vaccine_next_date: r.vaccine_next_date || '',
      deworm_name: r.deworm_name || '',
      deworm_next_date: r.deworm_next_date || '',
      med_name: r.med_name || '',
      med_dosage: r.med_dosage || '',
      notes: (r.notes !== undefined && r.notes !== null) ? String(r.notes).trim() : (r.condition_after || ''),
      raw: r
    });
  });

  // Sort descending by date
  allCareRecords.sort((a, b) => new Date(b.record_date || 0) - new Date(a.record_date || 0));

  if (allCareRecords.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; color:var(--text-muted); background:#fff; border:1px solid var(--border); border-radius:var(--radius-md);">
        <i class="fa-solid fa-clipboard-list" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
        <div style="font-weight:700; color:var(--text-main); font-size:15px; margin-bottom:4px;">Chưa có hồ sơ chăm sóc nào cho bé</div>
        <div style="font-size:13px;">Hãy bấm <strong>"+ Ghi Nhận Hồ Sơ"</strong> để thêm hồ sơ chăm sóc và theo dõi sức khỏe cho thú cưng.</div>
      </div>
    `;
  } else {
    container.innerHTML = allCareRecords.map((r, idx) => {
      // 1. Cân nặng
      let weightStr = '';
      if (r.weight && parseFloat(r.weight) > 0) {
        weightStr = `<strong style="color:var(--primary); font-size:14px;">${r.weight} kg</strong>`;
      } else if (pet.weight && parseFloat(pet.weight) > 0) {
        weightStr = `<strong style="color:var(--text-main);">${pet.weight} kg</strong>`;
      } else {
        weightStr = '<span style="color:var(--text-muted); font-style:italic;">Chưa ghi nhận</span>';
      }

      // 2. Tiêm phòng
      let vaccineStr = '';
      if (r.vaccine_name) {
        vaccineStr = `<strong style="color:#1e293b;">${escapeHTML(r.vaccine_name)}</strong>${r.vaccine_next_date ? ' <span style="font-size:12px; color:var(--text-muted);">(Nhắc lại: ' + formatDate(r.vaccine_next_date) + ')</span>' : ''}`;
      } else if (vaccinations && vaccinations.length > 0) {
        const v = vaccinations[0];
        vaccineStr = `<strong style="color:#1e293b;">${escapeHTML(v.vaccine_name)}</strong> <span style="font-size:12px; color:var(--text-muted);">(Ngày: ${formatDate(v.administered_date || v.date_administered)})</span>`;
      } else {
        vaccineStr = '<span style="color:var(--text-muted); font-style:italic;">Không có mũi tiêm</span>';
      }

      // 3. Tẩy giun
      let dewormStr = '';
      if (r.deworm_name) {
        dewormStr = `<strong style="color:#1e293b;">${escapeHTML(r.deworm_name)}</strong>${r.deworm_next_date ? ' <span style="font-size:12px; color:var(--text-muted);">(Lần tới: ' + formatDate(r.deworm_next_date) + ')</span>' : ''}`;
      } else if (dewormings && dewormings.length > 0) {
        const d = dewormings[0];
        dewormStr = `<strong style="color:#1e293b;">${escapeHTML(d.med_name || d.medication_name)}</strong> <span style="font-size:12px; color:var(--text-muted);">(Ngày: ${formatDate(d.date || d.date_administered)})</span>`;
      } else {
        dewormStr = '<span style="color:var(--text-muted); font-style:italic;">Chưa tẩy giun</span>';
      }

      // 4. Thuốc
      let medStr = '';
      if (r.med_name) {
        medStr = `<strong style="color:#1e293b;">${escapeHTML(r.med_name)}</strong>${r.med_dosage ? ' <span style="font-size:12px; color:var(--text-muted);">(' + escapeHTML(r.med_dosage) + ')</span>' : ''}`;
      } else if (medications && medications.length > 0) {
        medStr = medications.map(m => `<strong style="color:#1e293b;">${escapeHTML(m.medicine_name || m.name)}</strong>${m.dosage ? ' <span style="font-size:12px; color:var(--text-muted);">(' + escapeHTML(m.dosage) + ')</span>' : ''}`).join(', ');
      } else {
        medStr = '<span style="color:var(--text-muted); font-style:italic;">Không có thuốc đang dùng</span>';
      }

      // 5. Ghi chú / Tình trạng sau chăm sóc
      let actualNote = r.notes;
      const mockPhrases = [
        'Bé sạch sẽ, lông mượt, tinh thần vui vẻ, không kích ứng da.',
        'Bé sạch sẽ, lông mượt thơm, tinh thần vui vẻ, sức khỏe tốt',
        'Dặn chủ nuôi sấy khô lông sau khi tắm tại nhà',
        'Bé ngoan, tình trạng ổn định sau chăm sóc',
        'Hoàn tất chăm sóc',
        'Bình thường'
      ];
      if (mockPhrases.includes(actualNote)) {
        actualNote = 'Bé ngoan, tình trạng ổn định sau chăm sóc.';
      }

      const notesHtml = actualNote
        ? `<span style="color:#1e293b; font-weight:500;">${escapeHTML(actualNote)}</span>`
        : `<span style="color:var(--text-muted); font-style:italic;">Bé ngoan, sức khỏe ổn định sau khi chăm sóc.</span>`;

      return `
        <div style="background:#fff; border:1.5px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02); transition:all 0.2s ease;">
          <!-- Header: Title, Date, Staff, Actions -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="background:var(--primary-light); color:var(--primary); width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                <i class="fa-solid fa-clipboard-list"></i>
              </div>
              <div>
                <div style="font-size:12px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px;"><i class="fa-solid fa-clipboard"></i> HỒ SƠ CHĂM SÓC #${allCareRecords.length - idx}</div>
                <h4 style="font-size:17px; font-weight:800; color:var(--text-main); margin:2px 0 0 0;">${escapeHTML(r.title)}</h4>
              </div>
            </div>
            
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
              <div style="font-size:13px; color:var(--text-muted); display:flex; gap:12px; align-items:center;">
                <span><i class="fa-regular fa-calendar" style="color:var(--primary); margin-right:4px;"></i>Ngày: <strong style="color:var(--text-main);">${formatDate(r.record_date)}</strong></span>
                <span><i class="fa-solid fa-user-check" style="color:#10b981; margin-right:4px;"></i>Thực hiện: <strong style="color:var(--text-main);">${escapeHTML(r.staff_name)}</strong></span>
              </div>
              ${(['ADMIN', 'STORE_MANAGER', 'CARE_STAFF'].includes(currentUser?.role)) ? `
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-secondary btn-sm" onclick="openEditHealthModal('${r.id}')" title="Sửa hồ sơ chăm sóc" style="padding:4px 10px; font-size:12px; border-radius:6px;">
                    <i class="fa-solid fa-pen"></i> Sửa
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteHealthRecord('health', '${r.id}', '${r.pet_id}')" title="Xóa hồ sơ chăm sóc" style="padding:4px 10px; font-size:12px; border-radius:6px;">
                    <i class="fa-solid fa-trash"></i> Xóa
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 1. Nội dung chăm sóc -->
          <div style="background:var(--bg-light); padding:12px 16px; border-radius:8px; font-size:14px; margin-bottom:12px; line-height:1.6;">
            <strong style="color:var(--text-main); display:block; margin-bottom:4px; font-size:13.5px;">
              <i class="fa-solid fa-clipboard-check" style="color:var(--primary); margin-right:6px;"></i>Nội dung chăm sóc:
            </strong>
            <div style="color:#334155;">${escapeHTML(r.care_content)}</div>
          </div>

          <!-- 2. Thông tin sức khỏe liên quan -->
          <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:12px; font-size:13.5px;">
            <strong style="color:#1e293b; display:block; margin-bottom:8px; font-size:13.5px;">
              <i class="fa-solid fa-heart-pulse" style="color:#e11d48; margin-right:6px;"></i>Thông tin sức khỏe liên quan:
            </strong>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; line-height:1.5;">
              <div>️ <strong>Cân nặng:</strong> ${weightStr}</div>
              <div><i class="fa-solid fa-syringe"></i> <strong>Tiêm phòng:</strong> ${vaccineStr}</div>
              <div><i class="fa-solid fa-bug"></i> <strong>Tẩy giun:</strong> ${dewormStr}</div>
              <div><i class="fa-solid fa-capsules"></i> <strong>Thuốc:</strong> ${medStr}</div>
            </div>
          </div>

          <!-- 3. Ghi chú / Tình trạng sau chăm sóc -->
          <div style="background:#fffbeb; border:1px dashed #fde68a; padding:12px 16px; border-radius:8px; font-size:14px; line-height:1.6;">
            <strong style="color:#92400e; display:block; margin-bottom:4px; font-size:13.5px;">
              <i class="fa-solid fa-file-pen" style="color:#d97706; margin-right:6px;"></i>Ghi chú / Tình trạng sau chăm sóc:
            </strong>
            ${notesHtml}
          </div>
        </div>
      `;
    }).join('');
  }
}

async function deleteHealthRecord(endpoint, id, petId) {
  if (!confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
  
  let url = '';
  if (endpoint === 'health') url = `/health/${id}`;
  else if (endpoint === 'vaccines') url = `/health/vaccination/${id}`;
  else if (endpoint === 'dewormings') url = `/health/deworming/${id}`;
  else if (endpoint === 'medications') url = `/health/medication/${id}`;

  console.log("DELETE ID:", id);
  console.log("DELETE URL:", url);

  const res = await apiRequest(url, 'DELETE');
  if (res.success) {
    showToast(res.message, 'success');
    loadHealthData(petId);
  } else {
    showToast(res.message, 'error');
  }
}

async function deleteWeightRecord(petId, date, weight) {
  if (!confirm(`Bạn có chắc chắn muốn xóa bản ghi cân nặng ${weight} kg ngày ${formatDate(date)}?`)) return;
  const res = await apiRequest('/health/weight', 'DELETE', {
    pet_id: petId,
    date,
    weight
  });
  if (res && res.success) {
    showToast(res.message || 'Xóa bản ghi cân nặng thành công!', 'success');
    loadHealthData(petId);
  } else {
    showToast((res && res.message) || 'Lỗi khi xóa bản ghi cân nặng', 'error');
  }
}

window.deleteWeightRecord = deleteWeightRecord;

async function confirmMedication(id, petId) {
  if (!confirm('Xác nhận toa thuốc này hợp lệ?')) return;
  const res = await apiRequest(`/health/medication/${id}/confirm`, 'PATCH');
  if (res.success) {
    showToast(res.message, 'success');
    loadHealthData(petId);
  } else {
    showToast(res.message, 'error');
  }
}

function renderWeightChart(timeline) {
  const canvas = document.getElementById('weightTimelineChart');
  if (!canvas) return;

  if (weightChartInstance) {
    weightChartInstance.destroy();
    weightChartInstance = null;
  }

  const container = canvas.parentElement;

  if (!timeline || timeline.length === 0) {
    canvas.style.display = 'none';
    let emptyMsg = container.querySelector('.chart-empty-msg');
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'chart-empty-msg';
      emptyMsg.style.cssText = 'height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-style:italic; font-weight:600;';
      emptyMsg.innerText = 'Chưa có dữ liệu cân nặng để vẽ biểu đồ.';
      container.appendChild(emptyMsg);
    } else {
      emptyMsg.style.display = 'flex';
    }
    return;
  } else {
    canvas.style.display = 'block';
    const emptyMsg = container.querySelector('.chart-empty-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
  }

  const labels = timeline.map((item) => formatDate(item.date));
  const weights = timeline.map((item) => item.weight);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(255, 122, 0, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 122, 0, 0.0)');

  weightChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cân nặng (kg)',
          data: weights,
          borderColor: '#FF7A00',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 6,
          pointBackgroundColor: '#FF7A00',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { family: 'Nunito, sans-serif', weight: '700', size: 13 }
          }
        },
        tooltip: {
          backgroundColor: '#1E293B',
          titleFont: { family: 'Nunito', weight: '700' },
          bodyFont: { family: 'Nunito', weight: '600' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const item = timeline[context.dataIndex];
              const noteText = item && item.note ? ` (${item.note})` : '';
              return ` Cân nặng: ${context.parsed.y} kg${noteText}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Cân nặng (kg)', font: { family: 'Nunito', weight: '700' } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          title: { display: true, text: 'Ngày cân', font: { family: 'Nunito', weight: '700' } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      }
    }
  });
}

async function loadAllHealthData() {
  // Hide single pet tabs and content
  const singlePetTabs = document.getElementById('health-single-pet-tabs');
  if (singlePetTabs) singlePetTabs.style.display = 'none';
  document.querySelectorAll('.health-tab-content').forEach(c => c.style.display = 'none');
  
  // Show ALL container
  const container = document.getElementById('health-all-pets-container');
  const grid = document.getElementById('health-all-pets-grid');
  if (!container || !grid) return;
  
  container.style.display = 'block';
  grid.innerHTML = '<div style="padding: 20px;">Đang tải dữ liệu...</div>';
  
  const res = await apiRequest('/health/all-summary');
  if (!res.success) {
    grid.innerHTML = `<div style="color:var(--danger); padding:20px;">Lỗi: ${res.message}</div>`;
    return;
  }
  
  if (res.summaries.length === 0) {
    grid.innerHTML = '<div style="padding: 20px; color: var(--text-muted);">Không có thú cưng nào.</div>';
    return;
  }
  
  let html = '';
  res.summaries.forEach(s => {
    const p = s.pet;
    
    // Formatting latest history
    let medHistory = 'Chưa có lịch sử';
    if (s.latest_record) {
      medHistory = `<strong>${s.latest_record.record_date}</strong>: ${s.latest_record.title}`;
    }
    
    let vacInfo = s.total_vaccinations > 0 ? `Đã tiêm ${s.total_vaccinations} mũi` : 'Chưa tiêm';
    let dewInfo = s.total_dewormings > 0 ? `Đã tẩy ${s.total_dewormings} lần` : 'Chưa tẩy';
    let medsInfo = s.current_medications.length > 0 ? `<span style="color:var(--warning); font-weight:bold;">Đang dùng ${s.current_medications.length} loại thuốc</span>` : 'Không';
    
    html += `
      <div class="card-box" style="padding: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); cursor: pointer; display: flex; flex-direction: column;" onclick="document.getElementById('health-pet-select').value='${p.id}'; loadHealthData('${p.id}');">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px;">
          <div>
            <h4 style="margin:0; font-weight:700; color:var(--primary); font-size:18px;">${p.name}</h4>
            <span style="font-size:12px; color:var(--text-muted);">Mã: ${p.pet_code} | ${p.species}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px; font-weight: 600;">Chủ: <span style="font-weight: 400">${p.owner_name}</span></div>
            <div style="font-size:14px; font-weight: 600;">Cân nặng: <span style="font-weight: 400">${p.weight > 0 ? p.weight + ' kg' : 'Chưa rõ'}</span></div>
          </div>
        </div>
        
        <div style="font-size: 14px; line-height: 1.6; flex: 1;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div><i class="fa-solid fa-syringe" style="color:var(--info);"></i> Tiêm phòng:<br><strong>${vacInfo}</strong></div>
            <div><i class="fa-solid fa-bug" style="color:var(--warning);"></i> Tẩy giun:<br><strong>${dewInfo}</strong></div>
          </div>
          <div style="margin-bottom: 4px;"><i class="fa-solid fa-pills" style="color:var(--danger);"></i> Thuốc: ${medsInfo}</div>
          <div style="background: var(--bg-main); padding: 8px; border-radius: 4px; margin-top: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; color: var(--text-muted);">Khám bệnh gần nhất</div>
            <div>${medHistory}</div>
          </div>
        </div>
        
        <button class="btn btn-outline btn-sm" style="width:100%; margin-top:12px;">Xem chi tiết hồ sơ</button>
      </div>
    `;
  });
  
  grid.innerHTML = html;
}

window.initHealthUI = initHealthUI;
window.loadHealthData = loadHealthData;
window.deleteHealthRecord = deleteHealthRecord;
window.confirmMedication = confirmMedication;
window.openEditHealthModal = function(id) {
  if (!window.currentHealthRecords) return;
  const record = window.currentHealthRecords.find(r => r.id === id);
  if (!record) {
    showToast('Không tìm thấy hồ sơ chăm sóc', 'error');
    return;
  }

  // Reuse the main care record modal for editing
  if (document.getElementById('health-form-id')) document.getElementById('health-form-id').value = record.id;
  if (document.getElementById('health-form-pet')) document.getElementById('health-form-pet').value = record.pet_id;
  if (document.getElementById('health-form-type')) document.getElementById('health-form-type').value = record.record_type || 'CHĂM_SÓC';
  if (document.getElementById('health-form-title')) document.getElementById('health-form-title').value = record.title || '';
  if (document.getElementById('health-form-date')) document.getElementById('health-form-date').value = (record.record_date || '').split('T')[0];
  if (document.getElementById('health-form-doctor')) document.getElementById('health-form-doctor').value = record.doctor_name || record.staff_name || '';
  if (document.getElementById('health-form-desc')) document.getElementById('health-form-desc').value = record.care_content || record.description || '';
  if (document.getElementById('health-form-notes')) {
    const rawN = (record.notes !== undefined && record.notes !== null && record.notes.trim() !== '') ? record.notes : (record.condition_after || '');
    document.getElementById('health-form-notes').value = rawN;
  }
  if (document.getElementById('health-form-weight')) document.getElementById('health-form-weight').value = record.weight || '';
  if (document.getElementById('health-form-vaccine-name')) document.getElementById('health-form-vaccine-name').value = record.vaccine_name || '';
  if (document.getElementById('health-form-vaccine-next-date')) document.getElementById('health-form-vaccine-next-date').value = record.vaccine_next_date || '';
  if (document.getElementById('health-form-deworm-name')) document.getElementById('health-form-deworm-name').value = record.deworm_name || '';
  if (document.getElementById('health-form-deworm-next-date')) document.getElementById('health-form-deworm-next-date').value = record.deworm_next_date || '';
  if (document.getElementById('health-form-med-name')) document.getElementById('health-form-med-name').value = record.med_name || '';
  if (document.getElementById('health-form-med-dosage')) document.getElementById('health-form-med-dosage').value = record.med_dosage || '';

  const title = document.getElementById('modal-health-title');
  if (title) title.innerHTML = '<i class="fa-solid fa-notes-medical" style="color:var(--primary); margin-right:8px;"></i> Chỉnh Sửa Hồ Sơ Chăm Sóc';
  openModal('modal-health');
};


window.openEditVaccineModal = async (id, petId) => {
    const v = (window.currentVaccinations || []).find(r => r.id === id);
    if (!v) { showToast('Không tìm thấy bản ghi tiêm phòng', 'error'); return; }
    
    await populatePetDropdowns();
    if (document.getElementById('vaccine-form-id')) document.getElementById('vaccine-form-id').value = v.id;
    if (document.getElementById('vaccine-form-pet')) document.getElementById('vaccine-form-pet').value = v.pet_id;
    if (document.getElementById('vaccine-form-name')) document.getElementById('vaccine-form-name').value = v.vaccine_name || '';
    if (document.getElementById('vaccine-form-date')) document.getElementById('vaccine-form-date').value = v.administered_date || v.date_administered || '';
    if (document.getElementById('vaccine-form-type')) document.getElementById('vaccine-form-type').value = v.vaccine_type || '';
    if (document.getElementById('vaccine-form-disease')) document.getElementById('vaccine-form-disease').value = v.disease || '';
    
    if (document.getElementById('vaccine-form-next-date')) document.getElementById('vaccine-form-next-date').value = v.next_due_date || '';
    if (document.getElementById('vaccine-form-notes')) document.getElementById('vaccine-form-notes').value = v.notes || '';
    if (document.getElementById('vaccine-form-manufacturer')) document.getElementById('vaccine-form-manufacturer').value = v.manufacturer || '';
    if (document.getElementById('vaccine-form-batch')) document.getElementById('vaccine-form-batch').value = v.batch || '';
    if (document.getElementById('vaccine-form-expiry')) document.getElementById('vaccine-form-expiry').value = v.expiry || '';
    if (document.getElementById('vaccine-form-dosage')) document.getElementById('vaccine-form-dosage').value = v.dosage || '';
    if (document.getElementById('vaccine-form-route')) document.getElementById('vaccine-form-route').value = v.route || '';
    if (document.getElementById('vaccine-form-location')) document.getElementById('vaccine-form-location').value = v.location || '';
    if (document.getElementById('vaccine-form-person')) document.getElementById('vaccine-form-person').value = v.person || '';
    if (document.getElementById('vaccine-form-clinic')) document.getElementById('vaccine-form-clinic').value = v.clinic || '';
    if (document.getElementById('vaccine-form-pre-status')) document.getElementById('vaccine-form-pre-status').value = v.pre_status || '';
    if (document.getElementById('vaccine-form-reaction')) document.getElementById('vaccine-form-reaction').value = v.reaction || '';
    if (document.getElementById('vaccine-form-monitor-time')) document.getElementById('vaccine-form-monitor-time').value = v.monitor_time || '';
    
    const title = document.getElementById('modal-vaccine-title');
    if (title) title.textContent = 'Chỉnh Sửa Mũi Tiêm Phòng';
    openModal('modal-vaccine');
}

window.openEditDewormModal = async (id, petId) => {
    const d = (window.currentDewormings || []).find(r => r.id === id);
    if (!d) { showToast('Không tìm thấy bản ghi tẩy giun', 'error'); return; }
    
    await populatePetDropdowns();
    if (document.getElementById('deworm-form-id')) document.getElementById('deworm-form-id').value = d.id;
    if (document.getElementById('deworm-form-pet')) document.getElementById('deworm-form-pet').value = d.pet_id;
    if (document.getElementById('deworm-form-date')) document.getElementById('deworm-form-date').value = d.date || d.date_administered || '';
    if (document.getElementById('deworm-form-next-date')) document.getElementById('deworm-form-next-date').value = d.next_due_date || '';
    if (document.getElementById('deworm-form-status')) document.getElementById('deworm-form-status').value = d.status || 'Đã tẩy';
    if (document.getElementById('deworm-form-notes')) document.getElementById('deworm-form-notes').value = d.notes || '';
    
    if (document.getElementById('deworm-form-med-name')) document.getElementById('deworm-form-med-name').value = d.med_name || '';
    if (document.getElementById('deworm-form-active-ing')) document.getElementById('deworm-form-active-ing').value = d.active_ing || '';
    if (document.getElementById('deworm-form-dosage')) document.getElementById('deworm-form-dosage').value = d.dosage || '';
    if (document.getElementById('deworm-form-route')) document.getElementById('deworm-form-route').value = d.route || '';
    if (document.getElementById('deworm-form-weight')) document.getElementById('deworm-form-weight').value = d.weight || '';
    if (document.getElementById('deworm-form-person')) document.getElementById('deworm-form-person').value = d.person || '';
    if (document.getElementById('deworm-form-clinic')) document.getElementById('deworm-form-clinic').value = d.clinic || '';
    if (document.getElementById('deworm-form-pre-status')) document.getElementById('deworm-form-pre-status').value = d.pre_status || '';
    if (document.getElementById('deworm-form-reaction')) document.getElementById('deworm-form-reaction').value = d.reaction || '';
    if (document.getElementById('deworm-form-stool')) document.getElementById('deworm-form-stool').value = d.stool || '';
    if (document.getElementById('deworm-form-vomit')) document.getElementById('deworm-form-vomit').value = d.vomit || '';
    
    const title = document.getElementById('modal-deworm-title');
    if (title) title.textContent = 'Chỉnh Sửa Tẩy Giun';
    openModal('modal-deworm');
}

window.openEditMedModal = async (id, petId) => {
    const m = (window.currentMedications || []).find(r => r.id === id);
    if (!m) { showToast('Không tìm thấy bản ghi thuốc', 'error'); return; }
    
    await populatePetDropdowns();
    document.getElementById('med-form-id').value = m.id;
    document.getElementById('med-form-pet').value = m.pet_id;
    document.getElementById('med-form-name').value = m.medicine_name || '';
    document.getElementById('med-form-dosage').value = m.dosage || '';
    document.getElementById('med-form-frequency').value = m.frequency || '';
    document.getElementById('med-form-start').value = m.start_date || '';
    document.getElementById('med-form-end').value = m.end_date || '';
    document.getElementById('med-form-notes').value = m.notes || '';
    
    // Correct field IDs matching index.html: med-form-active-ing
    document.getElementById('med-form-active-ing').value = m.active_ing || '';
    document.getElementById('med-form-category').value = m.category || '';
    document.getElementById('med-form-form').value = m.form || '';
    document.getElementById('med-form-manufacturer').value = m.manufacturer || '';
    document.getElementById('med-form-strength').value = m.strength || '';
    document.getElementById('med-form-dose-per-kg').value = m.dose_per_kg || '';
    document.getElementById('med-form-amount-per-dose').value = m.amount_per_dose || '';
    document.getElementById('med-form-unit').value = m.unit || '';
    document.getElementById('med-form-route').value = m.route || '';
    document.getElementById('med-form-time').value = m.time || '';
    document.getElementById('med-form-purpose').value = m.purpose || '';
    document.getElementById('med-form-indications').value = m.indications || '';
    document.getElementById('med-form-contraindications').value = m.contraindications || '';
    document.getElementById('med-form-side-effects').value = m.side_effects || '';
    document.getElementById('med-form-prescriber').value = m.prescriber || '';
    document.getElementById('med-form-care-instructions').value = m.care_instructions || '';
    
    const title = document.getElementById('modal-med-title');
    if (title) title.textContent = 'Chỉnh Sửa Thuốc Đang Dùng';
    openModal('modal-med');
}

// -------------------------------------------------------------
// <i class="fa-solid fa-robot"></i> AI TÓM TẮT & GỢI Ý HỒ SƠ CHĂM SÓC (CHO CHỦ NUÔI, CARE_STAFF & ADMIN)
// -------------------------------------------------------------
async function openAiHealthSummaryModal(targetPetId) {
  let petId = targetPetId;
  let petName = 'Thú cưng';

  // 1. Kiểm tra targetPetId nếu truyền vào
  if (targetPetId && window.allUserPets) {
    const foundPet = window.allUserPets.find(p => p.id === targetPetId);
    if (foundPet) petName = foundPet.name;
  }

  // 2. Nếu chưa có petId, lấy theo view đang hoạt động
  const viewSchedules = document.getElementById('view-schedules');
  const isScheduleView = viewSchedules && viewSchedules.style.display !== 'none';

  if (!petId && isScheduleView) {
    const schedFilter = document.getElementById('schedule-pet-filter');
    if (schedFilter && schedFilter.value && schedFilter.value !== 'ALL') {
      petId = schedFilter.value;
      if (schedFilter.selectedOptions && schedFilter.selectedOptions[0]) {
        petName = schedFilter.selectedOptions[0].text.split('(')[0].trim();
      }
    }
  }

  if (!petId) {
    const healthSelect = document.getElementById('health-pet-select');
    if (healthSelect && healthSelect.value) {
      petId = healthSelect.value;
      if (healthSelect.selectedOptions && healthSelect.selectedOptions[0]) {
        petName = healthSelect.selectedOptions[0].text.split('(')[0].trim();
      }
    }
  }

  if (!petId) {
    const schedFilter = document.getElementById('schedule-pet-filter');
    if (schedFilter && schedFilter.value && schedFilter.value !== 'ALL') {
      petId = schedFilter.value;
      if (schedFilter.selectedOptions && schedFilter.selectedOptions[0]) {
        petName = schedFilter.selectedOptions[0].text.split('(')[0].trim();
      }
    }
  }

  if (!petId && window.allUserPets && window.allUserPets.length > 0) {
    petId = window.allUserPets[0].id;
    petName = window.allUserPets[0].name || 'Thú cưng';
  } else if (!petId) {
    const healthSelect = document.getElementById('health-pet-select');
    if (healthSelect && healthSelect.options && healthSelect.options.length > 0 && healthSelect.options[0].value) {
      petId = healthSelect.options[0].value;
      petName = healthSelect.options[0].text.split('(')[0].trim();
    }
  }

  if (!petId) {
    showToast('Vui lòng chọn thú cưng để AI tóm tắt hồ sơ.', 'warning');
    return;
  }

  const modalTitle = document.getElementById('modal-ai-health-title');
  const loadingEl = document.getElementById('ai-health-loading');
  const contentEl = document.getElementById('ai-health-summary-content');

  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color: #10b981;"></i> <i class="fa-solid fa-robot"></i> AI Tóm Tắt Hồ Sơ — Bé ${escapeHTML(petName)}`;
  }

  if (loadingEl) loadingEl.style.display = 'block';
  if (contentEl) {
    contentEl.style.display = 'none';
    contentEl.innerHTML = '';
  }

  openModal('modal-ai-health-summary');

  try {
    const res = await apiRequest(`/ai/summarize-record/${petId}`);
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    if (!res || !res.success) {
      console.error('[AI Health Summary Error]:', res);
      contentEl.innerHTML = `
        <div style="text-align:center; padding:32px 20px; background:#fff5f5; border:1px solid #fed7d7; border-radius:12px; color:#c53030;">
          <i class="fa-solid fa-circle-exclamation" style="font-size:36px; margin-bottom:12px; display:block;"></i>
          <h4 style="font-weight:700; margin-bottom:6px;">Lỗi khi tải tóm tắt hồ sơ</h4>
          <p style="font-size:13px; margin:0;">${escapeHTML(res?.message || 'Không thể lấy dữ liệu tóm tắt từ hệ thống.')}</p>
        </div>
      `;
      return;
    }

    if (res.pet && res.pet.name && modalTitle) {
      modalTitle.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color: #10b981;"></i> <i class="fa-solid fa-robot"></i> AI Tóm Tắt Hồ Sơ — Bé ${escapeHTML(res.pet.name)}`;
    }

    if (!res.has_data) {
      contentEl.innerHTML = `
        <div style="text-align:center; padding:32px 20px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px;">
          <i class="fa-solid fa-file-circle-question" style="font-size:36px; color:#9ca3af; margin-bottom:12px; display:block;"></i>
          <h4 style="font-weight:700; color:var(--text-main); margin-bottom:6px;">Chưa có đủ dữ liệu để AI tóm tắt hồ sơ.</h4>
          <p style="font-size:13px; color:var(--text-muted); margin:0;">Bé chưa có lịch sử chăm sóc, tiêm phòng hay lịch hẹn nào được ghi nhận trong hệ thống.</p>
        </div>
      `;
      return;
    }

    const sec = res.sections || {};
    const formatSectionLines = (linesStr) => {
      if (!linesStr) return '<div style="color:var(--text-muted); font-style:italic;">Chưa có dữ liệu</div>';
      return linesStr.split('\n').map(l => {
        if (!l.trim()) return '';
        if (l.trim() === '• Chưa có dữ liệu' || l.trim().includes('Chưa có dữ liệu')) {
          return `<div style="color:var(--text-muted); font-style:italic; padding:2px 0;">${escapeHTML(l)}</div>`;
        }
        return `<div style="margin-bottom:6px; line-height:1.55;">${escapeHTML(l)}</div>`;
      }).join('');
    };

    const roleBadge = ['ADMIN','STORE_MANAGER'].includes(res.user_role)
      ? `<span class="badge badge-warning" style="font-size:11.5px; font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Quản Trị Viên</span>`
      : (res.is_owner 
        ? `<span class="badge badge-primary" style="font-size:11.5px; font-weight:700;"><i class="fa-solid fa-user"></i> Dành cho Chủ Nuôi</span>`
        : `<span class="badge badge-info" style="font-size:11.5px; font-weight:700;"><i class="fa-solid fa-user-doctor"></i> Dành cho Nhân Viên Chăm Sóc</span>`);

    const statsBadges = res.stats ? `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
        <span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:11.5px; padding:3px 8px;"><i class="fa-solid fa-calendar-check"></i> ${res.stats.care_schedules_count || 0} lịch chăm sóc</span>
        <span class="badge" style="background:#dcfce7; color:#166534; font-size:11.5px; padding:3px 8px;"><i class="fa-solid fa-check-double"></i> ${res.stats.completed_history_count || 0} lần hoàn thành</span>
        <span class="badge" style="background:#fef3c7; color:#92400e; font-size:11.5px; padding:3px 8px;"><i class="fa-solid fa-notes-medical"></i> ${res.stats.health_records_count || 0} hồ sơ sức khỏe</span>
      </div>
    ` : '';

    contentEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed #e2e8f0; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <div>
          <span style="font-size:13.5px; color:var(--text-muted); font-weight:600;">Hồ sơ: <strong>${escapeHTML(res.pet.name)}</strong> (${res.pet.species || 'Thú cưng'} — ${res.pet.breed || 'Chưa rõ giống'})</span>
          ${statsBadges}
        </div>
        <div>${roleBadge}</div>
      </div>

      <!-- 1. Thông tin cơ bản của thú cưng -->
      <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-left:5px solid #6366f1; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#3730a3; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-clipboard-list" style="color:#6366f1; font-size:16px;"></i> 1. Thông tin cơ bản & Thể trạng thú cưng:
        </div>
        <div style="font-size:13.5px; color:#334155; line-height:1.65;">
          ${formatSectionLines(sec.summary_overview)}
        </div>
      </div>

      <!-- 2. Lịch chăm sóc đã đặt và trạng thái hiện tại -->
      <div style="background:#f0f9ff; border:1.5px solid #bae6fd; border-left:5px solid #0284c7; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#0369a1; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-calendar-check" style="color:#0284c7; font-size:16px;"></i> 2. Lịch chăm sóc đã đặt & Trạng thái hiện tại:
        </div>
        <div style="font-size:13.5px; color:#0f172a; line-height:1.65;">
          ${formatSectionLines(sec.booked_schedules)}
        </div>
      </div>

      <!-- 3. Lịch sử chăm sóc đã hoàn thành -->
      <div style="background:linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border:1.5px solid #a7f3d0; border-left:5px solid #10b981; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#065f46; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-clock-rotate-left" style="color:#10b981; font-size:16px;"></i> 3. Lịch sử chăm sóc đã hoàn thành:
        </div>
        <div style="font-size:13.5px; color:#1e293b; line-height:1.65;">
          ${formatSectionLines(sec.completed_history)}
        </div>
      </div>

      <!-- 4. Lịch tiêm phòng nếu có dữ liệu -->
      <div style="background:#faf5ff; border:1.5px solid #e9d5ff; border-left:5px solid #8b5cf6; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#6b21a8; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-syringe" style="color:#8b5cf6; font-size:16px;"></i> 4. Lịch tiêm phòng:
        </div>
        <div style="font-size:13.5px; color:#3b0764; line-height:1.65;">
          ${formatSectionLines(sec.vaccination_record)}
        </div>
      </div>

      <!-- 5. Hồ sơ sức khỏe nếu có dữ liệu -->
      <div style="background:#fff7ed; border:1.5px solid #fed7aa; border-left:5px solid #ea580c; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#9a3412; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-notes-medical" style="color:#ea580c; font-size:16px;"></i> 5. Hồ sơ sức khỏe & Điều trị:
        </div>
        <div style="font-size:13.5px; color:#431407; line-height:1.65;">
          ${formatSectionLines(sec.health_record)}
        </div>
      </div>

      <!-- 6. Lịch sắp tới và những lưu ý phù hợp -->
      <div style="background:#fefce8; border:1.5px solid #fef08a; border-left:5px solid #ca8a04; border-radius:12px; padding:16px 18px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="font-weight:800; font-size:15px; color:#854d0e; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-lightbulb" style="color:#ca8a04; font-size:16px;"></i> 6. Lịch sắp tới & Những lưu ý phù hợp:
        </div>
        <div style="font-size:13.5px; color:#422006; line-height:1.65;">
          ${formatSectionLines(sec.upcoming_notes)}
        </div>
      </div>

      <!-- Cảnh báo bác sĩ thú y chuẩn -->
      <div style="margin-top:6px; padding:12px 14px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; font-size:12.5px; color:#92400e; line-height:1.5;">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>Cảnh báo:</strong> Thông tin chỉ mang tính tham khảo, không thay thế bác sĩ thú y. Khi có dấu hiệu bất thường, hãy liên hệ bác sĩ thú y.
      </div>

      <div style="font-size:12px; color:var(--text-muted); text-align:right; font-style:italic; margin-top:2px;">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Tóm tắt được tổng hợp hoàn toàn từ dữ liệu thực tế trong cơ sở dữ liệu bởi Trợ lý AI Sen Chăm Boss.
      </div>
    `;
  } catch (err) {
    console.error('Error fetching AI health summary:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      contentEl.innerHTML = `
        <div style="text-align:center; padding:32px 20px; background:#fff5f5; border:1px solid #fed7d7; border-radius:12px; color:#c53030;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; margin-bottom:12px; display:block;"></i>
          <h4 style="font-weight:700; margin-bottom:6px;">Lỗi kết nối khi AI phân tích hồ sơ</h4>
          <p style="font-size:13px; margin:0;">Chi tiết lỗi: ${escapeHTML(err.message || String(err))}</p>
        </div>
      `;
    }
  }
}

window.openAiHealthSummaryModal = openAiHealthSummaryModal;

