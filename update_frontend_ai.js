const fs = require('fs');

let aiJs = fs.readFileSync('public/js/ai.js', 'utf8');

// Replace the click handler for the AI generator buttons
aiJs = aiJs.replace(
  /document\.querySelectorAll\('#open-ai-gen-modal-btn, \[data-action="open-ai-reminder"\], \.btn-open-ai-gen'\)\.forEach\(btn => \{[\s\S]*?\}\);/g,
  `document.querySelectorAll('#open-ai-gen-modal-btn, [data-action="open-ai-reminder"], .btn-open-ai-gen').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetchAndRenderAiReminders();
      const section = document.getElementById('ai-proposed-reminders-section');
      if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  window.fetchAndRenderAiReminders = async function() {
    const list = document.getElementById('ai-proposed-reminders-list');
    const section = document.getElementById('ai-proposed-reminders-section');
    if (!list) return;
    
    list.innerHTML = \`<div style="text-align:center; padding:18px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin" style="color:#10b981;"></i> Đang tải Nhắc Lịch AI...</div>\`;
    if (section) section.style.display = 'block';

    try {
      const res = await apiRequest('/ai/my-reminders');
      if (res && res.success) {
        window.aiProposedReminders = res.reminders;
        renderAiProposedReminders();
      } else {
        list.innerHTML = \`<div style="text-align:center; padding:16px; color:#EF4444; font-size:13.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Không thể tải Nhắc Lịch AI.</div>\`;
      }
    } catch (err) {
      console.error(err);
      list.innerHTML = \`<div style="text-align:center; padding:16px; color:#EF4444; font-size:13.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối.</div>\`;
    }
  };
`
);

// We need to modify renderAiProposedReminders to support the new format without generating anything
aiJs = aiJs.replace(
  /function renderAiProposedReminders\(\) \{[\s\S]*?(?=\/\/ -------------------------------------------------------------)/,
  `function renderAiProposedReminders() {
    const section = document.getElementById('ai-proposed-reminders-section');
    const list = document.getElementById('ai-proposed-reminders-list');
    if (!section || !list) return;

    if (!window.aiProposedReminders || window.aiProposedReminders.length === 0) {
      list.innerHTML = \`<div style="text-align:center; padding:20px; color:var(--text-muted);">Hiện tại bạn không có Nhắc Lịch AI nào cho lịch chăm sóc sắp tới.</div>\`;
      return;
    }

    section.style.display = 'block';
    list.innerHTML = window.aiProposedReminders.map((prop) => {
      let displayDate = prop.date || '';
      if (displayDate.includes('-')) {
        const parts = displayDate.split('-');
        if (parts.length === 3) displayDate = \`\${parts[2]}/\${parts[1]}/\${parts[0]}\`;
      }

      const statusHtml = prop.status ? \`<span class="badge badge-info" style="font-size:10px;">\${escHtml(prop.status)}</span>\` : '';

      return \`
        <div class="ai-proposed-card" id="ai-prop-\${prop.id}" style="background:#ffffff; border:1.5px solid #10b981; border-radius:12px; padding:16px; box-shadow:0 3px 12px rgba(16, 185, 129, 0.08);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid #c7d2fe;">
                <i class="fa-solid fa-robot"></i> Nhắc Lịch AI
              </span>
              <span class="badge" style="background:#f3f4f6; color:#4b5563; font-size:12px; border-radius:6px; border:1px solid #e5e7eb;">
                <i class="fa-regular fa-clock"></i> \${displayDate} \${prop.time ? \`\${prop.time}\` : ''}
              </span>
            </div>
            \${statusHtml}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; padding:8px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
            <div style="width:36px; height:36px; border-radius:50%; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:16px; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-paw"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:13.5px; color:#1e293b;">Bé \${escHtml(prop.pet_name)}</div>
              <div style="font-size:12px; color:#64748b;">Dịch vụ: <strong style="color:#2563eb;">\${escHtml(prop.schedule_title)}</strong></div>
            </div>
          </div>

          <div style="font-size:14px; font-weight:600; color:#065f46; margin-bottom:8px;">\${escHtml(prop.message)}</div>
          
          <div style="display:flex; gap:10px; margin-top:14px;">
            <button class="btn btn-outline btn-sm" onclick="dismissAiProposal('\${prop.id}')" style="flex:1; border-color:#e5e7eb; color:#4b5563;">
              <i class="fa-solid fa-eye-slash"></i> Ẩn nhắc lịch
            </button>
          </div>
        </div>
      \`;
    }).join('');
  }
`
);

fs.writeFileSync('public/js/ai.js', aiJs, 'utf8');
console.log('Modified public/js/ai.js');

let scheduleJs = fs.readFileSync('public/js/schedule.js', 'utf8');
// Add auto-fetch of AI Reminders when opening schedule view
scheduleJs = scheduleJs.replace(
  /function fetchAndRenderSchedules\(\) \{/,
  `function fetchAndRenderSchedules() {
  if (window.fetchAndRenderAiReminders) {
    window.fetchAndRenderAiReminders();
  }
`
);
fs.writeFileSync('public/js/schedule.js', scheduleJs, 'utf8');
console.log('Modified public/js/schedule.js');

