/* =========================================================
   AI ASSISTANT & NOTIFICATIONS FRONTEND LOGIC - FULL PAGE WORKSPACE
   ========================================================= */

function updateAIChatPersonaByRole() {
  const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const role = String(user.role || 'USER').toUpperCase();
  const inputEl = document.getElementById('chat-user-input');

  if (inputEl) {
    if (['ADMIN','STORE_MANAGER'].includes(role)) {
      inputEl.placeholder = 'Hỏi về báo cáo doanh thu, thống kê người dùng, quy định phân quyền...';
    } else if (role === 'RECEPTIONIST') {
      inputEl.placeholder = 'Hỏi về lịch hẹn tiếp đón, tư vấn bảng giá, quy trình hóa đơn & thanh toán...';
    } else if (role === 'CARE_STAFF') {
      inputEl.placeholder = 'Tra cứu lịch sử bệnh án, quy trình spa an toàn, vắc-xin, chăm sóc nội trú...';
    } else {
      inputEl.placeholder = 'Nhập câu hỏi về chăm sóc thú cưng...';
    }
  }
}

function initAIUI() {
  const sendBtn = document.getElementById('send-chat-btn');
  const chatInput = document.getElementById('chat-user-input');
  const openAiGenBtn = document.getElementById('open-ai-gen-modal-btn');
  const aiGenForm = document.getElementById('ai-gen-form');
  const petSelect = document.getElementById('ai-chat-pet-select');
  const notifBtn = document.getElementById('notif-btn');
  const markAllReadBtn = document.getElementById('mark-all-read-btn');

  updateAIChatPersonaByRole();

  // Load pets for AI chat initially
  if (window.loadPetsForAIChat) {
    window.loadPetsForAIChat();
  }

  // Handle Pet Select Change
  if (petSelect) {
    petSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const infoBox = document.getElementById('ai-selected-pet-info');
      const contextLabel = document.getElementById('ai-chat-context-label');
      
      if (!selectedId) {
        if (infoBox) infoBox.style.display = 'none';
        updateAIChatPersonaByRole();
        return;
      }

      if (window.allUserPets) {
        const pet = window.allUserPets.find(p => p.id === selectedId);
        if (pet && infoBox) {
          infoBox.style.display = 'block';
          infoBox.innerHTML = `<strong>${escHtml(pet.name)}</strong> (${pet.species}, ${pet.breed || 'Chưa rõ giống'}) • ${pet.age_months || 0} tháng tuổi • Cân nặng: ${pet.weight || 0}kg • Tình trạng: <span style="font-weight:700;">${pet.health_status}</span>`;
          if (contextLabel) contextLabel.innerText = `Đang tư vấn riêng cho bé: ${pet.name} (${pet.species})`;
        }
      }
    });
  }

  const chatForm = document.getElementById('ai-chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendChatMessage();
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendChatMessage();
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  // Bind all topic chips and quick chips (event delegation)
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-topic-chip, .ai-quick-chip, .ai-quick-prompt, .ai-landing-prompt-btn');
    if (!chip) return;

    const prompt = chip.getAttribute('data-prompt') || chip.dataset.prompt;
    if (!prompt) return;

    if (chatInput) {
      chatInput.value = prompt;
      sendChatMessage();
    }
  });

  let currentAiPetSchedules = [];
  window.aiProposedReminders = window.aiProposedReminders || [];

  // -------------------------------------------------------------
  // <i class="fa-solid fa-wand-magic-sparkles"></i> AI SINH NHẮC LỊCH CHĂM SÓC & TIÊM NHẮC
  // -------------------------------------------------------------
  function renderAiProposedReminders(forceShow = false) {
    const section = document.getElementById('ai-proposed-reminders-section');
    const list = document.getElementById('ai-proposed-reminders-list');
    if (!section || !list) return;

    // Lọc theo thú cưng nếu người dùng chọn lọc trên thanh công cụ
    const petFilter = document.getElementById('schedule-pet-filter');
    const selectedPetId = petFilter ? petFilter.value : 'ALL';
    let remindersToRender = window.aiProposedReminders || [];
    if (selectedPetId && selectedPetId !== 'ALL') {
      remindersToRender = remindersToRender.filter(p => p.pet_id === selectedPetId);
    }

    if (remindersToRender.length === 0) {
      if (forceShow) {
        section.style.display = 'block';
        list.innerHTML = `
          <div style="text-align:center; padding:28px 16px; background:#ffffff; border-radius:12px; border:1px solid #d1fae5; color:var(--text-muted); font-size:13.5px;">
            <i class="fa-solid fa-robot" style="font-size:32px; color:#10b981; margin-bottom:10px; display:block;"></i>
            <strong style="color:var(--text-main);">Hiện tại chưa có nhắc lịch nào.</strong>
            <div style="margin-top:4px; font-size:12.5px; color:#059669;">Khi bạn đặt lịch chăm sóc mới cho thú cưng, hệ thống sẽ tự động đồng bộ lời nhắc tại đây!</div>
          </div>
        `;
      } else {
        section.style.display = 'none';
        list.innerHTML = '';
      }
      return;
    }

    section.style.display = 'block';
    list.innerHTML = remindersToRender.map((prop) => {
      let displayDate = prop.date || '';
      if (displayDate.includes('-')) {
        const parts = displayDate.split('-');
        if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      let statusBadge = '';
      if (prop.status === 'PENDING') {
        statusBadge = '<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-clock"></i> Chờ xác nhận</span>';
      } else if (prop.status === 'CONFIRMED') {
        statusBadge = '<span class="badge" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0; font-size:11px; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-check"></i> Đã xác nhận</span>';
      } else if (prop.status) {
        statusBadge = `<span class="badge badge-secondary" style="font-size:11px; padding:3px 8px; border-radius:6px;">${escHtml(prop.status)}</span>`;
      }

      const appCode = prop.appointment_id ? `#APP_${prop.appointment_id.slice(-4).toUpperCase()}` : '';

      return `
        <div class="ai-proposed-card" id="ai-prop-${prop.id}" style="background:#ffffff; border:1.5px solid #10b981; border-radius:12px; padding:16px; box-shadow:0 3px 12px rgba(16, 185, 129, 0.08);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid #c7d2fe;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> <i class="fa-solid fa-robot"></i> Nhắc Lịch AI
              </span>
              <span style="font-weight:700; font-size:15px; color:var(--text-main);">
                <i class="fa-solid fa-paw"></i> Thú cưng: <span style="color:#059669;">${escHtml(prop.pet_name)}</span> ${prop.pet_species ? `(${escHtml(prop.pet_species)})` : ''}
              </span>
              ${statusBadge}
            </div>

            <div style="display:flex; gap:8px; font-size:12.5px; color:var(--text-muted); align-items:center;">
              <span class="badge badge-info" style="font-size:11px;">⏱️ ${escHtml(prop.category || 'CHĂM SÓC')}</span>
              <span><i class="fa-regular fa-clock"></i> <b>${displayDate}</b> ${prop.time ? `lúc ${prop.time}` : ''}</span>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-muted); margin-bottom:6px;">
              <i class="fa-solid fa-thumbtack"></i> Dịch vụ đã đặt: <span style="color:var(--text-main); font-weight:700;">${escHtml(prop.schedule_title || 'Chăm sóc sức khỏe')}</span>
              ${appCode ? `<span style="margin-left:8px; font-size:12px; color:#64748b; font-weight:600;">(Mã: ${appCode})</span>` : ''}
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #10b981; border-radius:8px; padding:12px 14px; font-size:13.5px; color:#1e293b; line-height:1.55; white-space:pre-line;">
${escHtml(prop.message)}
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; border-top:1px dashed #e2e8f0; padding-top:10px; margin-top:10px; flex-wrap:wrap;">
            <div style="font-size:12.5px; color:#059669; font-weight:600; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-circle-check"></i> Đang tự động nhắc nhở từ lịch chăm sóc trong hệ thống
            </div>
            <div style="display:flex; gap:8px;">
              ${prop.appointment_id ? `
                <button type="button" class="btn btn-outline btn-sm" onclick="if (window.viewAppointmentDetail) window.viewAppointmentDetail('${prop.appointment_id}'); else if (window.appNavigate) window.appNavigate('appointments');" style="font-size:12px; padding:5px 12px; border-radius:6px; font-weight:600; border-color:#cbd5e1; color:var(--text-main);">
                  <i class="fa-solid fa-calendar-check"></i> Xem chi tiết lịch hẹn
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function confirmAiProposal(propId) {
    const prop = (window.aiProposedReminders || []).find(p => p.id === propId);
    if (!prop) return;

    try {
      const res = await apiRequest('/ai/confirm-proposed-reminder', 'POST', {
        pet_id: prop.pet_id,
        task_name: prop.schedule_title || 'Nhắc lịch chăm sóc',
        category: prop.category || 'KHÁC',
        date: prop.date,
        time: prop.time || '08:00',
        message: prop.message,
        priority: prop.priority || 'CAO'
      });

      if (res && res.success) {
        showToast('✓ Đã xác nhận và lưu nhắc lịch vào danh sách!', 'success');
        window.aiProposedReminders = (window.aiProposedReminders || []).filter(p => p.id !== propId);
        renderAiProposedReminders();

        closeModal('modal-ai-gen');

        // Reload schedules and appointments list so the new item appears immediately!
        try {
          if (window.loadSchedulesList) await window.loadSchedulesList();
          if (window.loadAppointmentsList) await window.loadAppointmentsList();
          if (window.loadDashboardData) window.loadDashboardData();
          if (window.loadNotifications) window.loadNotifications();
        } catch (uiErr) {
          console.warn('UI refresh error after confirmAiProposal:', uiErr);
        }
      } else {
        showToast(res?.message || 'Không thể lưu nhắc lịch.', 'error');
      }
    } catch (err) {
      console.error('Error confirming AI proposal:', err);
      showToast('Lỗi khi lưu nhắc lịch AI.', 'error');
    }
  }

  function dismissAiProposal(propId) {
    window.aiProposedReminders = (window.aiProposedReminders || []).filter(p => p.id !== propId);
    renderAiProposedReminders();
    closeModal('modal-ai-gen');
    showToast('Đã bỏ qua đề xuất nhắc lịch.', 'info');
  }

  function dismissAllAiProposals() {
    window.aiProposedReminders = [];
    renderAiProposedReminders();
    showToast('Đã bỏ qua tất cả đề xuất.', 'info');
  }

  async function openAiReminderModal(defaultPetId = null) {
    // 1. Luôn tải danh sách thú cưng mới nhất từ API /api/pets
    let pets = [];
    try {
      const res = await apiRequest('/pets');
      if (res && res.success && Array.isArray(res.pets)) {
        pets = res.pets;
        window.allUserPets = pets;
      }
    } catch (e) {
      console.warn('Could not fetch pets for AI Reminder modal:', e);
    }
    if ((!pets || pets.length === 0) && window.allUserPets) {
      pets = window.allUserPets;
    }
    
    // Populate pet select in modal
    const aiGenSelect = document.getElementById('ai-gen-pet-select');
    if (aiGenSelect) {
      aiGenSelect.innerHTML = '<option value="">-- Chọn thú cưng --</option>' +
        pets.map(p => {
          const ownerStr = (window.currentUser && ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(window.currentUser.role) && p.owner_name) ? ` - Chủ: ${escHtml(p.owner_name)}` : '';
          return `<option value="${p.id}">${escHtml(p.name)} (${escHtml(p.species)}${p.breed ? ' - ' + escHtml(p.breed) : ''}${ownerStr})</option>`;
        }).join('');
    }

    // Reset modal UI state
    const schedulesSection = document.getElementById('ai-pet-schedules-section');
    const triggerContainer = document.getElementById('ai-trigger-container');
    const previewContainer = document.getElementById('ai-gen-preview-container');
    const confirmContainer = document.getElementById('ai-confirm-container');
    const messageInput = document.getElementById('ai-reminder-message-text');
    const countBadge = document.getElementById('ai-schedules-count-badge');

    if (schedulesSection) schedulesSection.style.display = 'none';
    if (triggerContainer) triggerContainer.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'none';
    if (confirmContainer) confirmContainer.style.display = 'none';
    if (messageInput) messageInput.value = '';
    if (countBadge) {
      countBadge.innerText = 'Đang tải...';
      countBadge.className = 'badge badge-info';
    }

    openModal('modal-ai-gen');

    // Auto-select pet from argument, schedule filter, or first pet
    const schedulePetFilter = document.getElementById('schedule-pet-filter');
    const filterPetVal = defaultPetId || (schedulePetFilter && schedulePetFilter.value !== 'ALL' ? schedulePetFilter.value : null);

    if (aiGenSelect && aiGenSelect.options.length > 1) {
      if (filterPetVal && Array.from(aiGenSelect.options).some(o => o.value === filterPetVal)) {
        aiGenSelect.value = filterPetVal;
      } else {
        aiGenSelect.selectedIndex = 1;
      }
      await onAiPetSelectChange(aiGenSelect.value);
    }
  }

  // Bind click listeners to all open AI reminder buttons
  document.querySelectorAll('#open-ai-gen-modal-btn, [data-action="open-ai-reminder"], .btn-open-ai-gen').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetchAndRenderAiReminders(true);
      const section = document.getElementById('ai-proposed-reminders-section');
      if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  window.fetchAndRenderAiReminders = async function(forceShow = false) {
    const list = document.getElementById('ai-proposed-reminders-list');
    const section = document.getElementById('ai-proposed-reminders-section');
    if (!list) return;

    try {
      const res = await apiRequest('/ai/my-reminders');
      if (res && res.success) {
        window.aiProposedReminders = res.reminders || [];
        renderAiProposedReminders(forceShow);
      } else {
        if (!forceShow && section) section.style.display = 'none';
      }
    } catch (err) {
      console.error('Error fetching AI reminders:', err);
      if (!forceShow && section) section.style.display = 'none';
    }
  };

  const aiGenSelect = document.getElementById('ai-gen-pet-select');
  if (aiGenSelect) {
    aiGenSelect.addEventListener('change', (e) => {
      onAiPetSelectChange(e.target.value);
    });
  }

  window.onAiPetSelectChange = async function(petId) {
    const schedulesSection = document.getElementById('ai-pet-schedules-section');
    const schedulesList = document.getElementById('ai-pet-schedules-list');
    const countBadge = document.getElementById('ai-schedules-count-badge');
    const triggerContainer = document.getElementById('ai-trigger-container');
    const previewContainer = document.getElementById('ai-gen-preview-container');
    const confirmContainer = document.getElementById('ai-confirm-container');
    const messageInput = document.getElementById('ai-reminder-message-text');

    if (messageInput) messageInput.value = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (confirmContainer) confirmContainer.style.display = 'none';

    if (!petId) {
      if (schedulesSection) schedulesSection.style.display = 'none';
      if (triggerContainer) triggerContainer.style.display = 'none';
      return;
    }

    if (schedulesSection) schedulesSection.style.display = 'block';

    // Bật trạng thái loading trên cả badge lẫn danh sách
    if (countBadge) {
      countBadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:10px;"></i> Đang tải...`;
      countBadge.className = 'badge badge-info';
    }

    if (schedulesList) {
      schedulesList.innerHTML = `<div style="text-align:center; padding:18px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin" style="color:#10b981;"></i> Đang tải dữ liệu lịch của bé...</div>`;
    }

    try {
      const res = await apiRequest(`/ai/pet-schedules/${petId}?t=${Date.now()}`);
      if (res && res.success) {
        // Loại bỏ triệt để các bản ghi trùng lặp (theo ID hoặc theo Ngày + Giờ + Tên dịch vụ)
        const rawSchedules = res.schedules || [];
        const uniqueSchedules = [];
        const seenKeys = new Set();
        for (const s of rawSchedules) {
          const normTitle = (s.title || '').trim().toLowerCase().replace(/^(\[ai\]\s*|<[^>]+>\s*)/i, '');
          const idKey = s.id ? `id_${s.id}` : null;
          const dateTimeKey = `${s.date}_${s.time}_${normTitle}`;
          if ((!idKey || !seenKeys.has(idKey)) && !seenKeys.has(dateTimeKey)) {
            if (idKey) seenKeys.add(idKey);
            seenKeys.add(dateTimeKey);
            uniqueSchedules.push(s);
          }
        }
        currentAiPetSchedules = uniqueSchedules;
        
        if (countBadge) {
          countBadge.innerText = `${currentAiPetSchedules.length} lịch`;
          countBadge.className = currentAiPetSchedules.length > 0 ? 'badge badge-info' : 'badge badge-secondary';
        }

        if (schedulesList) {
          if (currentAiPetSchedules.length === 0) {
            schedulesList.innerHTML = `
              <div style="padding:18px; color:#4b5563; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; font-size:13.5px; text-align:center; line-height:1.5;">
                <i class="fa-solid fa-calendar-xmark" style="font-size:26px; color:#9ca3af; margin-bottom:8px; display:block;"></i>
                Không có lịch chăm sóc hoặc tiêm phòng sắp tới cho thú cưng này.
              </div>
            `;
            if (triggerContainer) triggerContainer.style.display = 'none';
          } else {
            schedulesList.innerHTML = currentAiPetSchedules.map((s, idx) => {
              let badgeColor = 'badge-info';
              let icon = 'fa-calendar-day';
              const catLower = (s.category || '').toLowerCase();
              const titleLower = (s.title || '').toLowerCase();
              if (catLower.includes('tiêm') || titleLower.includes('tiêm') || s.source === 'vaccination') {
                badgeColor = 'badge-warning';
                icon = 'fa-syringe';
              } else if (catLower.includes('tắm') || catLower.includes('móng') || catLower.includes('spa') || titleLower.includes('tắm') || titleLower.includes('spa')) {
                badgeColor = 'badge-success';
                icon = 'fa-bath';
              } else if (catLower.includes('khám') || titleLower.includes('khám') || s.source === 'appointment') {
                badgeColor = 'badge-primary';
                icon = 'fa-stethoscope';
              }

              // Format date DD/MM/YYYY
              let displayDate = s.date || '';
              if (displayDate.includes('-')) {
                const parts = displayDate.split('-');
                if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
              }

              const displayType = s.source === 'appointment' ? 'Lịch Hẹn' : (s.source === 'vaccination' ? 'Lịch Tiêm' : 'Lịch Chăm Sóc');

              return `
                <label style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; background:#FFF; border-radius:8px; margin-bottom:8px; border:1px solid var(--border); cursor:pointer;">
                  <input type="radio" name="ai-selected-schedule" value="${idx}" ${idx === 0 ? 'checked' : ''} style="margin-top:3px;">
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                      <strong style="font-size:13.5px; color:var(--text-main);"><i class="fa-solid ${icon}" style="margin-right:4px; color:#10b981;"></i> ${escHtml(s.title)}</strong>
                      <span class="badge ${badgeColor}" style="font-size:10px;">${escHtml(s.category || displayType)}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted);">
                      <i class="fa-regular fa-clock"></i> Ngày: <strong>${displayDate}</strong> ${s.time ? `(${s.time})` : ''}
                      ${s.notes ? ` • <em>${escHtml(s.notes)}</em>` : ''}
                    </div>
                  </div>
                </label>
              `;
            }).join('');

            if (triggerContainer) triggerContainer.style.display = 'block';
          }
        }
      } else {
        if (countBadge) {
          countBadge.innerText = 'Lỗi tải';
          countBadge.className = 'badge badge-danger';
        }
        if (schedulesList) {
          schedulesList.innerHTML = `<div style="text-align:center; padding:16px; color:#EF4444; font-size:13.5px; background:#FEF2F2; border-radius:8px; border:1px solid #FECACA;"><i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(res?.message || 'Không thể tải lịch của thú cưng.')}</div>`;
        }
        if (triggerContainer) triggerContainer.style.display = 'none';
      }
    } catch (err) {
      console.error('Error fetching schedules for AI:', err);
      if (countBadge) {
        countBadge.innerText = 'Lỗi kết nối';
        countBadge.className = 'badge badge-danger';
      }
      if (schedulesList) {
        schedulesList.innerHTML = `<div style="text-align:center; padding:16px; color:#EF4444; font-size:13.5px; background:#FEF2F2; border-radius:8px; border:1px solid #FECACA;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối: ${escHtml(err.message || 'Không thể kết nối máy chủ.')}</div>`;
      }
      if (triggerContainer) triggerContainer.style.display = 'none';
    }
  };

  window.openAiReminderModal = openAiReminderModal;

  const triggerAiBtn = document.getElementById('btn-trigger-ai');
  if (triggerAiBtn) {
    triggerAiBtn.addEventListener('click', generateAiReminderMessage);
  }

  async function generateAiReminderMessage() {
    const petId = document.getElementById('ai-gen-pet-select')?.value;
    if (!petId) {
      showToast('Vui lòng chọn thú cưng.', 'warning');
      return;
    }

    const triggerBtn = document.getElementById('btn-trigger-ai');
    const previewContainer = document.getElementById('ai-gen-preview-container');
    const confirmContainer = document.getElementById('ai-confirm-container');
    const messageInput = document.getElementById('ai-reminder-message-text');

    // Get selected schedule
    const selectedRadio = document.querySelector('input[name="ai-selected-schedule"]:checked');
    if (!selectedRadio || !currentAiPetSchedules[selectedRadio.value]) {
      showToast('Vui lòng chọn một lịch chăm sóc hoặc tiêm phòng trước.', 'warning');
      return;
    }
    const selectedSchedule = currentAiPetSchedules[selectedRadio.value];

    const originalBtnHtml = triggerBtn ? triggerBtn.innerHTML : '';
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <i class="fa-solid fa-robot"></i> AI đang phân tích dữ liệu & soạn tin...`;
    }

    try {
      const payload = {
        pet_id: petId,
        schedule_id: selectedSchedule ? selectedSchedule.id : null,
        schedule_title: selectedSchedule ? selectedSchedule.title : 'Chăm sóc sức khỏe định kỳ',
        schedule_date: selectedSchedule ? selectedSchedule.date : new Date().toISOString().split('T')[0],
        schedule_time: selectedSchedule ? selectedSchedule.time : '',
        schedule_notes: selectedSchedule ? selectedSchedule.notes : ''
      };

      const res = await apiRequest('/ai/generate-reminder', 'POST', payload);

      if (res && res.success && res.reminder_message) {
        const generatedMessage = res.reminder_message;
        if (messageInput) {
          messageInput.value = generatedMessage;
        }
        if (previewContainer) previewContainer.style.display = 'block';
        if (confirmContainer) confirmContainer.style.display = 'block';

        // Add to active proposed reminders list
        const petObj = (window.allUserPets || []).find(p => p.id === petId) || res.pet || { name: 'Bé cưng', species: 'Thú cưng' };
        const newProposal = {
          id: 'prop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          pet_id: petId,
          pet_name: petObj.name || res.pet?.name || 'Bé cưng',
          pet_species: petObj.species || 'Thú cưng',
          schedule_title: selectedSchedule ? selectedSchedule.title : 'Chăm sóc sức khỏe định kỳ',
          category: selectedSchedule ? (selectedSchedule.category || 'CHĂM_SÓC') : 'KHÁC',
          date: selectedSchedule ? selectedSchedule.date : new Date().toISOString().split('T')[0],
          time: selectedSchedule ? selectedSchedule.time : '08:00',
          message: generatedMessage,
          priority: selectedSchedule?.priority || 'CAO'
        };

        // Prepend to proposed list
        window.aiProposedReminders = [newProposal, ...(window.aiProposedReminders || []).filter(p => p.pet_id !== petId || p.schedule_title !== newProposal.schedule_title)];
        renderAiProposedReminders();

        previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('<i class="fa-solid fa-wand-magic-sparkles"></i> AI đã đề xuất tin nhắn nhắc lịch thành công!', 'success');
      } else {
        showToast(res?.message || 'Không thể soạn tin nhắn nhắc lịch.', 'error');
      }
    } catch (err) {
      console.error('Error generating AI reminder:', err);
      showToast('Lỗi khi AI soạn tin nhắn nhắc lịch.', 'error');
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = originalBtnHtml;
      }
    }
  }

  const confirmAiBtn = document.getElementById('btn-confirm-ai-schedules');
  if (confirmAiBtn) {
    confirmAiBtn.addEventListener('click', confirmSendAiReminder);
  }

  async function confirmSendAiReminder() {
    const petId = document.getElementById('ai-gen-pet-select')?.value;
    const messageInput = document.getElementById('ai-reminder-message-text');
    const message = messageInput ? messageInput.value.trim() : '';

    if (!petId) {
      showToast('Vui lòng chọn thú cưng.', 'warning');
      return;
    }
    if (!message) {
      showToast('Vui lòng nhập nội dung tin nhắn nhắc lịch.', 'warning');
      return;
    }

    const selectedRadio = document.querySelector('input[name="ai-selected-schedule"]:checked');
    let selectedSchedule = null;
    if (selectedRadio && currentAiPetSchedules[selectedRadio.value]) {
      selectedSchedule = currentAiPetSchedules[selectedRadio.value];
    }

    const confirmBtn = document.getElementById('btn-confirm-ai-schedules');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu & gửi thông báo...`;
    }

    try {
      const res = await apiRequest('/ai/confirm-proposed-reminder', 'POST', {
        pet_id: petId,
        schedule_id: selectedSchedule ? selectedSchedule.id : null,
        task_name: selectedSchedule ? selectedSchedule.title : 'Nhắc lịch chăm sóc',
        category: selectedSchedule ? (selectedSchedule.category || 'KHÁC') : 'KHÁC',
        date: selectedSchedule ? selectedSchedule.date : new Date().toISOString().split('T')[0],
        time: selectedSchedule ? selectedSchedule.time : '08:00',
        message: message,
        priority: selectedSchedule?.priority || 'CAO'
      });

      if (res && res.success) {
        showToast('✓ Đã xác nhận và lưu nhắc lịch vào danh sách!', 'success');
        closeModal('modal-ai-gen');

        // Clear matched proposal from proposals list
        window.aiProposedReminders = (window.aiProposedReminders || []).filter(p => p.pet_id !== petId);
        renderAiProposedReminders();

        // Reload schedules and appointments list so the new item appears immediately!
        try {
          if (window.loadSchedulesList) await window.loadSchedulesList();
          if (window.loadAppointmentsList) await window.loadAppointmentsList();
          if (window.loadDashboardData) window.loadDashboardData();
          if (window.loadNotifications) window.loadNotifications();
        } catch (uiErr) {
          console.warn('UI refresh error after confirmSendAiReminder:', uiErr);
        }
      } else {
        showToast(res?.message || 'Không thể gửi thông báo.', 'error');
      }
    } catch (err) {
      console.error('Error sending AI reminder:', err);
      showToast('Lỗi kết nối khi gửi thông báo.', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> ✓ Xác nhận & Lưu nhắc`;
      }
    }
  }

  window.generateAiReminderMessage = generateAiReminderMessage;
  window.confirmSendAiReminder = confirmSendAiReminder;
  window.openAiReminderModal = openAiReminderModal;
  window.renderAiProposedReminders = renderAiProposedReminders;
  window.confirmAiProposal = confirmAiProposal;
  window.dismissAiProposal = dismissAiProposal;
  window.dismissAllAiProposals = dismissAllAiProposals;


  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      loadNotifications();
      openModal('modal-notif');
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async () => {
      const res = await apiRequest('/notifications/read-all', 'PATCH');
      if (res && res.success) {
        showToast(res.message || 'Đã đọc toàn bộ thông báo', 'success');
        loadNotifications();
      }
    });
  }
}

let aiConversationHistory = [];
let isSendingChatMessage = false;
window._lastChatMessage = '';

window.retryLastChatMessage = function() {
  if (window._lastChatMessage) {
    const input = document.getElementById('chat-user-input');
    if (input) input.value = window._lastChatMessage;
    sendChatMessage();
  }
};

async function sendChatMessage() {
  if (isSendingChatMessage) return;

  const input = document.getElementById('chat-user-input');
  const messagesBox = document.getElementById('chat-messages-box');
  const sendBtn = document.getElementById('send-chat-btn');
  if (!input || !messagesBox) return;

  const text = input.value.trim();
  if (!text) return;

  window._lastChatMessage = text;
  isSendingChatMessage = true;

  // Clear input immediately and set loading state
  input.value = '';
  input.disabled = true;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  // Append User Message Row
  const userRow = document.createElement('div');
  userRow.className = 'ai-msg-row ai-msg-user';
  userRow.innerHTML = `
    <div class="msg-content">
      ${escHtml(text)}
    </div>
    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--bg-main); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: var(--shadow-sm);">
      <i class="fa-solid fa-user"></i>
    </div>
  `;
  messagesBox.appendChild(userRow);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  // Append Bot Loading Row
  const botRow = document.createElement('div');
  botRow.className = 'ai-msg-row ai-msg-bot';
  botRow.innerHTML = `
    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-gradient); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(249,115,22,0.3);">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="ai-bot-col">
      <div class="msg-content" style="min-width: 140px;">
        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13.5px;">
          <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary);"></i>
          <span>AI đang suy nghĩ và trả lời...</span>
        </div>
      </div>
    </div>
  `;
  messagesBox.appendChild(botRow);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  // Get Selected Pet
  const petSelect = document.getElementById('ai-chat-pet-select');
  const petId = petSelect ? petSelect.value : null;

  try {
    const token = (window.getAuthToken ? window.getAuthToken() : (localStorage.getItem('petcare_token') || localStorage.getItem('token') || ''));
    const streamRes = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        message: text,
        pet_id: petId,
        history: aiConversationHistory.slice(-4),
        stream: true
      })
    });

    const contentDiv = botRow.querySelector('.msg-content');
    if (!streamRes.ok || !streamRes.body) {
      let errMsg = `HTTP ${streamRes.status}`;
      try {
        const errJson = await streamRes.json();
        errMsg = errJson.message || errMsg;
      } catch (_) {
        const errTxt = await streamRes.text();
        if (errTxt) errMsg = errTxt;
      }
      throw new Error(errMsg);
    }

    // Replace spinner with streaming container
    let streamedText = '';
    if (contentDiv) {
      contentDiv.innerHTML = '<span class="ai-streaming-text"></span>';
    }
    const liveText = contentDiv ? contentDiv.querySelector('.ai-streaming-text') : null;
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch (_) { continue; }
        if (event.type === 'chunk' && event.text) {
          streamedText += event.text;
          if (liveText) {
            liveText.textContent = streamedText;
            messagesBox.scrollTop = messagesBox.scrollHeight;
          }
        } else if (event.type === 'done') {
          finalData = event;
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Lỗi xử lý AI');
        }
      }
    }
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        if (event.type === 'done') finalData = event;
        else if (event.type === 'error') throw new Error(event.message || 'Lỗi xử lý AI');
      } catch (_) {}
    }

    const finalReply = (finalData && finalData.reply) ? finalData.reply : streamedText;
    if (finalReply && contentDiv) {
      aiConversationHistory.push({ role: 'user', text: text });
      aiConversationHistory.push({ role: 'model', text: finalReply });
      renderAIChatResponse(contentDiv, finalReply, messagesBox, finalData && finalData.schedules, text);
    } else if (contentDiv) {
      contentDiv.innerHTML = '<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Không nhận được câu trả lời từ AI. <button class="btn btn-outline-secondary btn-sm" style="margin-left:8px; padding:2px 8px; font-size:12px;" onclick="retryLastChatMessage()"><i class="fa-solid fa-rotate-right"></i> Thử lại</button></span>';
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  } catch (err) {
    console.error('AI chat error:', err);
    const contentDiv = botRow.querySelector('.msg-content');
    if (contentDiv) {
      contentDiv.innerHTML = `<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối hoặc xử lý câu hỏi: ${escHtml(err.message || 'Không có phản hồi')}.</span> <div style="margin-top:6px;"><button class="btn btn-outline-secondary btn-sm" style="padding:3px 10px; font-size:12px;" onclick="retryLastChatMessage()"><i class="fa-solid fa-rotate-right"></i> Thử lại câu hỏi</button></div>`;
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  } finally {
    isSendingChatMessage = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-left: -2px;"></i>';
    }
  }
}
window.sendChatMessage = sendChatMessage;

function isPetHealthTopic(queryText, replyText) {
  const combined = ((queryText || '') + ' ' + (replyText || '')).toLowerCase();
  const healthWords = [
    'sức khỏe', 'suc khoe', 'bệnh', 'benh', 'táo bón', 'tao bon', 'tiêu chảy', 'tieu chay',
    'nôn', 'oi', 'sốt', 'sot', 'bỏ ăn', 'bo an', 'co giật', 'khó thở', 'nấm da', 'viêm tai',
    've', 'bọ chét', 'rận', 'ký sinh trùng', 'vắc xin', 'vac xin', 'tiêm phòng', 'tẩy giun',
    'thuốc', 'khám', 'bác sĩ', 'triệu chứng', 'cấp cứu', 'dị ứng', 'thú y'
  ];
  return healthWords.some(w => combined.includes(w));
}

function extractAndCleanVetDisclaimer(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanedText: rawText || '', hasDisclaimer: false };
  }

  let text = rawText;
  let hasDisclaimer = false;

  const patterns = [
    /(?:[\r\n]+|^)[>\s*_-]*(?:(?:\*|_){0,2}(?:Lưu ý|Khuyến cáo|Cảnh báo|Lời khuyên|Ghi chú)(?:\*|_){0,2}\s*[:：]|\b(?:Lưu ý|Khuyến cáo)\b\s*[:：]?)[^\r\n]*(?:bác sĩ thú y|phòng khám thú y|cơ sở thú y|chẩn đoán|thăm khám|chuyên môn)[^\r\n]*(?:[\r\n]+|$)/gi,
    /(?:[\r\n]+|^)[>\s*_-]*(?:(?:\*|_){0,2}(?:Lưu ý|Khuyến cáo)(?:\*|_){0,2}\s*[:：]?)[^\r\n]*(?:mang tính(?: chất)? tham khảo|không thay thế)[^\r\n]*(?:bác sĩ thú y|thăm khám|điều trị)[^\r\n]*(?:[\r\n]+|$)/gi
  ];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      hasDisclaimer = true;
      text = text.replace(pattern, '\n').trim();
    }
  }

  return { cleanedText: text, hasDisclaimer };
}

function renderAIChatResponse(contentDiv, fullText, messagesBox, schedules = null, userQuery = '') {
  if (!contentDiv || !fullText) return;

  const { cleanedText, hasDisclaimer } = extractAndCleanVetDisclaimer(fullText);
  const showHealthNotice = hasDisclaimer || isPetHealthTopic(userQuery || window._lastChatMessage, fullText);

  let actionBtnHtml = '';
  if (schedules && schedules.length > 0) {
    window._pendingChatSchedules = schedules;
    actionBtnHtml = `
      <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="saveDirectChatSchedules(this)">
          <i class="fa-solid fa-calendar-check"></i> Lưu ${schedules.length} Lịch Chăm Sóc Ngay
        </button>
      </div>
    `;
  }

  // Render ONLY the AI generated content inside the speech bubble
  contentDiv.innerHTML = `
    <button class="ai-copy-btn" title="Sao chép nội dung" onclick="copyAIChatResponse(this)">
      <i class="fa-solid fa-copy"></i> Sao chép
    </button>
    ${parseMarkdown(cleanedText || fullText)}
    ${actionBtnHtml}
  `;

  // Render Veterinary Warning separately below the bubble, appearing exactly once
  const botCol = contentDiv.closest('.ai-bot-col') || contentDiv.parentElement;
  if (botCol) {
    const existingNotice = botCol.querySelector('.ai-vet-disclaimer-box');
    if (showHealthNotice) {
      if (!existingNotice) {
        const disclaimerEl = document.createElement('div');
        disclaimerEl.className = 'ai-vet-disclaimer-box';
        disclaimerEl.setAttribute('role', 'note');
        disclaimerEl.innerHTML = `
          <div class="ai-vet-disclaimer-icon"><i class="fa-solid fa-stethoscope"></i></div>
          <div class="ai-vet-disclaimer-text">
            <strong>Khuyến cáo thú y:</strong> Thông tin trên chỉ mang tính tham khảo và hướng dẫn chăm sóc ban đầu. Khi thú cưng có biểu hiện bất thường hoặc bệnh lý nghiêm trọng, hãy đưa bé đến bác sĩ thú y để được thăm khám kịp thời.
          </div>
        `;
        botCol.appendChild(disclaimerEl);
      }
    } else if (existingNotice) {
      existingNotice.remove();
    }
  }

  if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
}

window.triggerAiGenerateReminder = function() {
  const petSelect = document.getElementById('ai-chat-pet-select');
  const petId = petSelect ? petSelect.value : null;
  const chatInput = document.getElementById('chat-user-input');
  
  if (petId && window.allUserPets) {
    const pet = window.allUserPets.find(p => p.id === petId);
    if (chatInput) {
      chatInput.value = `Hãy sinh tin nhắn mẫu nhắc lịch chăm sóc và tiêm phòng định kỳ cho bé ${pet ? pet.name : 'thú cưng'}`;
      sendChatMessage();
    }
  } else {
    if (chatInput) {
      chatInput.value = 'Hãy sinh tin nhắn mẫu nhắc lịch chăm sóc và lịch tiêm phòng cho thú cưng';
      sendChatMessage();
    }
  }
};

window.triggerAiSummarizeRecord = function() {
  const petSelect = document.getElementById('ai-chat-pet-select');
  const petId = petSelect ? petSelect.value : null;
  const chatInput = document.getElementById('chat-user-input');
  
  if (petId && window.allUserPets) {
    const pet = window.allUserPets.find(p => p.id === petId);
    if (chatInput) {
      chatInput.value = `Hãy tóm tắt hồ sơ chăm sóc và tình trạng sức khỏe của bé ${pet ? pet.name : 'thú cưng'}`;
      sendChatMessage();
    }
  } else {
    if (chatInput) {
      chatInput.value = 'Hãy tóm tắt hồ sơ chăm sóc của thú cưng';
      sendChatMessage();
    }
  }
};

window.triggerAiPlanCare = function() {
  const petSelect = document.getElementById('ai-chat-pet-select');
  const petId = petSelect ? petSelect.value : null;
  const chatInput = document.getElementById('chat-user-input');
  
  if (petId && window.allUserPets) {
    const pet = window.allUserPets.find(p => p.id === petId);
    if (chatInput) {
      chatInput.value = `Lập kế hoạch chăm sóc toàn diện, lịch tắm, vệ sinh và tiêm phòng định kỳ cho bé ${pet ? pet.name : 'thú cưng'}`;
      sendChatMessage();
    }
  } else {
    if (chatInput) {
      chatInput.value = 'Lập kế hoạch chăm sóc và lịch trình dinh dưỡng, tiêm phòng cho thú cưng';
      sendChatMessage();
    }
  }
};

window.saveDirectChatSchedules = async function(btn) {
  if (!window._pendingChatSchedules || window._pendingChatSchedules.length === 0) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

  const res = await apiRequest('/ai/save-schedule', 'POST', { schedules: window._pendingChatSchedules });
  if (res && res.success) {
    btn.className = 'btn btn-secondary';
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Lưu Vào Lịch Chăm Sóc!';
    showToast(res.message || 'Lưu lịch chăm sóc thành công!', 'success');
    if (window.loadSchedulesList) window.loadSchedulesList();
    if (window.loadDashboardData) window.loadDashboardData();
    window._pendingChatSchedules = null;
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Thử lưu lại';
    showToast(res?.message || 'Lỗi khi lưu lịch.', 'error');
  }
};

window.copyAIChatResponse = function(btn) {
  const content = btn.parentElement.innerText.replace('Sao chép', '').trim();
  navigator.clipboard.writeText(content).then(() => {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã chép!';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-copy"></i> Sao chép';
    }, 2000);
  });
};

window.clearAIChatStream = function() {
  aiConversationHistory = []; // Reset conversation history
  const messagesBox = document.getElementById('chat-messages-box');
  const chatInput = document.getElementById('chat-user-input');
  if (chatInput) chatInput.value = '';

  updateAIChatPersonaByRole();
  
  if (messagesBox) {
    messagesBox.innerHTML = `
      <div class="ai-msg-row ai-msg-bot">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-gradient); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(249,115,22,0.3);">
          <i class="fa-solid fa-robot"></i>
        </div>
        <div class="ai-bot-col">
          <div class="msg-content">
            <p style="margin: 0; font-size: 15px; line-height: 1.6;">Xin chào bạn! Mình là Trợ lý AI của Sen Chăm Boss. Mình có thể hỗ trợ bạn tìm hiểu dịch vụ, tra cứu bảng giá, đặt lịch chăm sóc hoặc hướng dẫn chăm sóc thú cưng an toàn. Bạn cần mình hỗ trợ điều gì hôm nay?</p>
          </div>
          <div class="ai-vet-disclaimer-box">
            <div class="ai-vet-disclaimer-icon"><i class="fa-solid fa-stethoscope"></i></div>
            <div class="ai-vet-disclaimer-text">
              <strong>Khuyến cáo thú y:</strong> Thông tin tư vấn chỉ mang tính tham khảo và hỗ trợ ban đầu. Khi thú cưng có dấu hiệu bất thường về sức khỏe, hãy liên hệ bác sĩ thú y để được thăm khám kịp thời.
            </div>
          </div>
        </div>
      </div>
    `;
  }
  showToast('Đã làm mới cuộc hội thoại.', 'info');
};

async function loadPetsForAIChat() {
  const select = document.getElementById('ai-chat-pet-select');
  if (!select) return;

  try {
    const res = await apiRequest('/pets');
    if (res && res.success) {
      window.allUserPets = res.pets || [];
      if (res.pets && res.pets.length > 0) {
        select.innerHTML = `<option value="">-- Tất cả thú cưng / Hỏi chung --</option>` +
          res.pets.map(p => `<option value="${p.id}">${escHtml(p.name)} (${escHtml(p.species)} - ${escHtml(p.breed || 'Chưa rõ')})</option>`).join('');
      } else {
        select.innerHTML = `<option value="">-- Chưa có thú cưng (Hỏi chung) --</option>`;
      }
    }
  } catch (err) {
    console.error('loadPetsForAIChat error:', err);
  }
}

window.initAIUI = initAIUI;
window.updateAIChatPersonaByRole = updateAIChatPersonaByRole;
window.loadPetsForAIChat = loadPetsForAIChat;
