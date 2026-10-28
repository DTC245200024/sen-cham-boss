/* =========================================================
   UTILITIES & HELPER FUNCTIONS - SEN CHĂM BOSS
   ========================================================= */

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escHtml = escHtml;
window.escapeHTML = escHtml;
window.escapeHtml = escHtml;

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Prevent duplicate toast messages from spamming
  const existingToasts = Array.from(container.querySelectorAll('.toast span'));
  if (existingToasts.some(span => span.textContent.trim() === String(message).trim())) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconClass =
    type === 'success'
      ? 'fa-circle-check'
      : type === 'error'
      ? 'fa-circle-exclamation'
      : type === 'warning'
      ? 'fa-triangle-exclamation'
      : 'fa-bell';

  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  }
}

function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN');
    }
  } catch (e) {}
  return dateStr;
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return 'N/A';
  try {
    const d = new Date(dateTimeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  } catch (e) {}
  return dateTimeStr;
}

function getSpeciesBadge(species) {
  const s = (species || '').toLowerCase();
  if (s.includes('chó') || s.includes('dog')) return `<span class="pet-badge dog"><i class="fa-solid fa-dog"></i> ${species || 'Chó'}</span>`;
  if (s.includes('mèo') || s.includes('cat')) return `<span class="pet-badge cat"><i class="fa-solid fa-cat"></i> ${species || 'Mèo'}</span>`;
  if (s.includes('chim') || s.includes('bird')) return `<span class="pet-badge other"><i class="fa-solid fa-crow"></i> ${species || 'Chim'}</span>`;
  if (s.includes('thỏ') || s.includes('rabbit')) return `<span class="pet-badge other"><i class="fa-solid fa-carrot"></i> ${species || 'Thỏ'}</span>`;
  return `<span class="pet-badge other"><i class="fa-solid fa-paw"></i> ${species || 'Khác'}</span>`;
}

function getCategoryIcon(cat) {
  const map = {
    CHO_ĂN: '<i class="fa-solid fa-bowl-food"></i> Cho ăn',
    TẮM: '<i class="fa-solid fa-soap"></i> Tắm rửa',
    CẮT_MÓNG: '<i class="fa-solid fa-scissors"></i> Cắt móng',
    CHẢI_LÔNG: '<i class="fa-solid fa-comb"></i> Chải lông',
    TẨY_GIUN: '<i class="fa-solid fa-bug"></i> Tẩy giun',
    TIÊM_PHÒNG: '<i class="fa-solid fa-syringe"></i> Tiêm phòng',
    KHÁM_SỨC_KHỎE: '<i class="fa-solid fa-stethoscope"></i> Khám sức khỏe',
    UỐNG_THUỐC: '<i class="fa-solid fa-capsules"></i> Uống thuốc',
    DẮT_ĐI_DẠO: '<i class="fa-solid fa-dog"></i> Dắt đi dạo',
    KHÁC: '<i class="fa-solid fa-thumbtack"></i> Khác'
  };
  return map[cat] || cat;
}

function getStatusBadge(status) {
  if (status === 'ĐÃ_HOÀN_THÀNH') return `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Đã hoàn thành</span>`;
  if (status === 'QUÁ_HẠN') return `<span class="badge badge-danger"><i class="fa-solid fa-triangle-exclamation"></i> Quá hạn</span>`;
  if (status === 'CHỜ_XÁC_NHẬN' || status === 'PENDING') return `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;"><i class="fa-solid fa-clock"></i> Chờ xác nhận</span>`;
  if (status === 'ĐÃ_XÁC_NHẬN' || status === 'CONFIRMED') return `<span class="badge" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;"><i class="fa-solid fa-check"></i> Đã xác nhận</span>`;
  return `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Chưa thực hiện</span>`;
}

function getPriorityBadge(priority) {
  if (priority === 'KHẨN_CẤP') return `<span class="badge badge-danger"><i class="fa-solid fa-circle-radiation"></i> Khẩn cấp</span>`;
  if (priority === 'CAO') return `<span class="badge badge-warning"><i class="fa-solid fa-fire"></i> Cao</span>`;
  if (priority === 'TRUNG_BÌNH') return `<span class="badge badge-info"><i class="fa-solid fa-circle-info"></i> Trung bình</span>`;
  return `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Thấp</span>`;
}

function getPetAvatarUrl(url, name = 'Pet') {
  if (url && url.trim().length > 0 && !url.includes('placeholder') && !url.includes('null')) {
    return url;
  }
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'Pet')}`;
}

function getUserAvatarUrl(url, name = 'User') {
  if (url && url.trim().length > 0 && !url.includes('placeholder') && !url.includes('null')) {
    return url;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'User')}`;
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = String(text);

  // Escaping dangerous HTML tags while keeping markdown formatting
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Handle ***bold and italic***
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  
  // Handle **bold**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Handle *italic*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Handle `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Handle Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>');

  // Handle lists (bullets)
  html = html.replace(/^(?:\*|-)\s+(.*)$/gm, '<li class="md-li">$1</li>');
  html = html.replace(/(<li class="md-li">.*?<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');

  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Global Modal handlers (Escape key & backdrop click)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    activeModals.forEach((m) => {
      m.classList.remove('active');
    });
    document.body.classList.remove('modal-open');
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    e.target.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  }
});


// Role helper for store management
window.isStoreManager = function(role) { return ['ADMIN','STORE_MANAGER'].includes(String(role || '').toUpperCase()); };
window.isStoreManagerUser = function(user) { return window.isStoreManager(user && user.role); };
