/* =========================================================
   MASTER APP ROUTER & ORCHESTRATOR
   ========================================================= */

function resolveRouteToView(route) {
  if (!route) return null;
  const clean = route.replace(/^[#/]+/, '').toLowerCase().split('?')[0].split('/')[0];
  const routeMap = {
    'pets': 'pets',
    'pet': 'pets',
    'schedules': 'schedules',
    'schedule': 'schedules',
    'health': 'health',
    'appointments': 'appointments',
    'appointment': 'appointments',
    'services': 'services',
    'service': 'services',
    'invoices': 'invoices',
    'invoice': 'invoices',
    'revenue': 'revenue',
    'ai': 'ai-assistant',
    'ai-assistant': 'ai-assistant',
    'profile': 'profile',
    'dashboard': 'dashboard',
    'admin-staff': 'admin-staff',
    'staff': 'admin-staff',
    'admin-users': 'admin-users',
    'admin-pets': 'admin-pets',
    'admin-appointments': 'appointments',
    'admin-care-assignments': 'admin-care-assignments',
    'care-assignments': 'admin-care-assignments',
    'admin-assignments': 'admin-care-assignments',
    'admin-schedules': 'schedules',
    'admin-services': 'services',
    'admin-invoices': 'invoices',
    'admin-health': 'health',
    'health-logs': 'health-logs',
    'admin-health-logs': 'health-logs',
    'admin-revenue': 'revenue',
    'admin-accounts': 'admin-accounts',
    'accounts': 'admin-accounts',
    'admin-settings': 'admin-settings',
    'settings': 'admin-settings',
    'messages': 'messages'
  };
  return routeMap[clean] || null;
}

window.resolveRouteToView = resolveRouteToView;

window.appNavigate = function(viewId, filterType) {
  switchView(viewId);
  if (viewId === 'schedules' && filterType) {
    setTimeout(() => {
      const btn = document.querySelector(`.schedule-view-btn[data-range="${filterType}"]`);
      if (btn) btn.click();
    }, 50);
  }
};

function switchView(viewName, targetPetId, updateUrl = true) {
  const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  const userRole = (user && user.role) ? String(user.role).toUpperCase() : 'USER';
  const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST', 'CARE_STAFF'].includes(userRole);

  // Map route aliases
  const mapped = resolveRouteToView(viewName);
  if (mapped) viewName = mapped;

  // STRICT ROLE ACCESS CONTROL GUARDS
  if (userRole === 'USER') {
    const userAllowed = ['pets', 'schedules', 'health', 'appointments', 'services', 'invoices', 'ai-assistant', 'profile', 'messages'];
    if (!userAllowed.includes(viewName)) {
      viewName = 'pets';
    }
  } else if (userRole === 'RECEPTIONIST') {
    const recAllowed = ['admin-users', 'admin-pets', 'appointments', 'invoices', 'services', 'profile', 'messages', 'pets', 'health', 'ai-assistant'];
    if (!recAllowed.includes(viewName)) {
      viewName = 'admin-users';
    }
  } else if (userRole === 'CARE_STAFF') {
    const careAllowed = ['appointments', 'pets', 'health', 'profile', 'ai-assistant', 'messages'];
    if (!careAllowed.includes(viewName)) {
      viewName = 'appointments';
    }
  } else if (userRole === 'ADMIN' || userRole === 'STORE_MANAGER') {
    // Admin (Quản lý hệ thống) có toàn quyền truy cập tất cả module quản trị và điều hành
    const adminAllowed = [
      'admin-staff', 'admin-users', 'admin-pets', 'health', 'health-logs',
      'schedules', 'appointments', 'admin-care-assignments', 'admin-assignments',
      'services', 'invoices', 'dashboard', 'revenue',
      'admin-accounts', 'admin-settings', 'ai-assistant', 'messages', 'profile', 'pets'
    ];
    if (!adminAllowed.includes(viewName)) {
      viewName = 'admin-staff';
    }
  }

  const views = document.querySelectorAll('.app-view');
  const navLinks = document.querySelectorAll('.nav-link');

  views.forEach((v) => (v.style.display = 'none'));
  navLinks.forEach((l) => l.classList.remove('active'));

  const actualTargetDomId = (viewName === 'health-logs') ? 'view-health' : `view-${viewName}`;
  const targetView = document.getElementById(actualTargetDomId);
  if (targetView) {
    targetView.style.display = 'block';
  }

  const contentBody = document.querySelector('.content-body');
  if (contentBody) {
    contentBody.scrollTop = 0;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const activeLinks = document.querySelectorAll(`.nav-link[data-view="${viewName}"]`);
  activeLinks.forEach(l => l.classList.add('active'));

  // Update Top Title
  const titleMap = {
    dashboard: 'Thống Kê / Báo Cáo Hệ Thống',
    pets: userRole === 'CARE_STAFF' ? 'Thông Tin Thú Cưng' : (userRole === 'ADMIN' ? 'Quản Lý Thông Tin Thú Cưng' : 'Quản Lý Thú Cưng'),
    schedules: 'Nhắc Lịch AI',
    health: userRole === 'ADMIN' ? 'Quản Lý Hồ Sơ Sức Khỏe' : (userRole === 'CARE_STAFF' ? 'Ghi Nhận Hồ Sơ Chăm Sóc' : 'Hồ Sơ Sức Khỏe'),
    'health-logs': 'Quản Lý Ghi Nhận Hồ Sơ Chăm Sóc',
    'ai-assistant': 'Trợ lý AI',
    'admin-settings': 'Cấu Hình Hệ Thống Sen Chăm Boss',
    'admin-accounts': 'Tài Khoản & Phân Quyền Hệ Thống',
    'profile': userRole === 'ADMIN' ? 'Hồ Sơ Admin (Quản Lý Hệ Thống)' : (userRole === 'RECEPTIONIST' ? 'Hồ Sơ Lễ Tân' : (userRole === 'CARE_STAFF' ? 'Hồ Sơ Nhân Viên Chăm Sóc' : 'Hồ Sơ Cá Nhân')),
    'appointments': userRole === 'CARE_STAFF' ? 'Lịch Chăm Sóc Phân Công' : (['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(userRole) ? 'Quản lý Đặt & Lịch Hẹn' : 'Đặt Lịch Chăm Sóc'),
    'admin-care-assignments': 'Phân Công Lịch Chăm Sóc',
    'admin-assignments': 'Phân Công Lịch Chăm Sóc',
    'services': 'Dịch Vụ & Gói Chăm Sóc',
    'invoices': 'Hóa Đơn & Thanh Toán',
    'revenue': 'Thống Kê / Báo Cáo Doanh Thu',
    'admin-staff': 'Quản Lý Nhân Viên',
    'admin-users': 'Quản Lý Chủ Nuôi',
    'admin-pets': 'Quản Lý Thông Tin Thú Cưng',
    'messages': 'Tin Nhắn & Hỗ Trợ Trực Tuyến'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = titleMap[viewName] || 'Sen Chăm Boss';

  // Sync URL hash
  if (updateUrl && window.location.hash !== `#${viewName}`) {
    history.pushState(null, '', `#${viewName}`);
  }

  // Load View Data
  if (viewName === 'admin-staff' && window.loadAdminStaff) {
    window.loadAdminStaff();
  } else if (viewName === 'admin-accounts' && window.loadAdminAccounts) {
    window.loadAdminAccounts();
  } else if (viewName === 'admin-settings' && window.loadAdminSettings) {
    window.loadAdminSettings();
  } else if (viewName === 'dashboard' && window.loadDashboardData) {
    window.loadDashboardData();
  } else if (viewName === 'pets' && window.loadPetsList) {
    window.loadPetsList();
  } else if (viewName === 'schedules' && window.loadSchedulesList) {
    window.loadSchedulesList();
  } else if ((viewName === 'health' || viewName === 'health-logs') && window.loadHealthData) {
    window.loadHealthData(targetPetId);
  } else if (viewName === 'services' && window.loadServicesList) {
    window.loadServicesList();
  } else if (viewName === 'invoices' && window.loadInvoicesList) {
    window.loadInvoicesList();
  } else if (viewName === 'revenue' && window.renderRevenueView) {
    window.renderRevenueView('revenue');
  } else if (viewName === 'ai-assistant') {
    if (window.initAIUI) window.initAIUI();
    if (window.updateAIChatPersonaByRole) window.updateAIChatPersonaByRole();
    if (window.loadPetsForAIChat) window.loadPetsForAIChat();
  } else if (viewName === 'profile' && window.loadProfile) {
    window.loadProfile();
  } else if (viewName === 'appointments' && window.loadAppointmentsList) {
    window.loadAppointmentsList();
  } else if ((viewName === 'admin-care-assignments' || viewName === 'admin-assignments') && window.loadAdminAssignments) {
    window.loadAdminAssignments();
  } else if (viewName === 'admin-users' && window.loadAdminUsers) {
    window.loadAdminUsers();
  } else if (viewName === 'admin-pets' && window.loadAdminPets) {
    window.loadAdminPets();
  } else if (viewName === 'messages') {
    if (window.loadInpageMessenger) window.loadInpageMessenger();
  }

  // Auto-mark category notifications read on view switch
  if (['appointments', 'schedules', 'health', 'health-logs', 'invoices', 'messages'].includes(viewName)) {
    const cat = viewName === 'health-logs' ? 'health' : viewName;
    apiRequest(`/notifications/read-category/${cat}`, 'PATCH').then(r => {
      if (r && r.success && window.loadNotifications) window.loadNotifications();
    });
  }
}

window.switchView = switchView;

document.addEventListener('DOMContentLoaded', async () => {
  // Init Module UIs defensively
  const inits = [
    initAuthUI,
    window.initPetsUI,
    window.initHealthUI,
    window.initScheduleUI,
    window.initAdminUI,
    window.initAdoptionUI,
    window.initAIUI,
    window.initProfileUI,
    window.initAppointmentsUI,
    window.initServicesUI,
    window.initInvoicesUI,
    window.initChatUI,
    initGlobalSearchUI
  ];

  inits.forEach(fn => {
    if (typeof fn === 'function') {
      try { fn(); } catch (err) { console.warn('Module UI init warning:', err); }
    }
  });
  
  // Initial Notification Load
  setTimeout(loadNotifications, 1000);

  // Sidebar Nav Clicks
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      if (view) {
        switchView(view);
      }

      // Close sidebar on mobile after click
      if (window.innerWidth <= 992) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
      }
    });
  });

  // Toggle Sidebar Mobile
  const toggleBtn = document.getElementById('toggle-sidebar-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('active');
    });
  }

  // Check Session & Initial Routing
  const isLoggedIn = await checkAuthSession();
  const path = window.location.pathname;
  const hash = window.location.hash;

  if (isLoggedIn) {
    if (hash === '#home') {
      window.navigateToHome();
    } else {
      onAuthSuccess();
    }
  } else {
    // User is NOT logged in: Never show dashboard / app-layout
    if (path === '/login' || hash === '#login') {
      window.openAuthModal('login', false);
    } else if (path === '/register' || hash === '#register') {
      window.openAuthModal('register', false);
    } else {
      // Direct Home / Landing Page
      const landingSection = document.getElementById('landing-section');
      const authSection = document.getElementById('auth-section');
      const appLayout = document.getElementById('app-layout');
      if (landingSection) landingSection.style.display = 'block';
      if (authSection) authSection.style.display = 'none';
      if (appLayout) appLayout.style.display = 'none';
      if (window.initLandingPageRealData) window.initLandingPageRealData();
    }
  }

  // Handle URL Hash Changes
  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash;
    if (currentHash === '#home') {
      window.navigateToHome();
      return;
    }
    const user = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null');
    if (user) {
      const view = resolveRouteToView(currentHash);
      if (view) switchView(view, null, false);
    }
  });

  // Handle browser Back / Forward navigation
  window.addEventListener('popstate', () => {
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null');

    if (!currentUser) {
      if (currentPath === '/login' || currentHash === '#login') {
        window.openAuthModal('login', false);
      } else if (currentPath === '/register' || currentHash === '#register') {
        window.openAuthModal('register', false);
      } else {
        window.closeAuthScreen(false);
      }
    } else {
      const view = resolveRouteToView(currentHash || currentPath);
      if (view) switchView(view, null, false);
    }
  });
});

window.switchView = switchView;

// Global Search Logic
function initGlobalSearchUI() {
  const searchInput = document.getElementById('global-search-input');
  const searchResults = document.getElementById('global-search-results');
  let debounceTimeout = null;

  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    const query = e.target.value.trim();

    if (!query) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      return;
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await apiRequest(`/search?q=${encodeURIComponent(query)}`);
        if (res.success && res.results.length > 0) {
          searchResults.innerHTML = res.results.map(item => `
            <div class="search-result-item" style="padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="handleSearchResultClick('${item.link}', '${item.id}')">
              <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">${item.title}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${item.subtitle}</div>
            </div>
          `).join('');
          searchResults.style.display = 'block';
        } else {
          searchResults.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 13px;">Không tìm thấy kết quả phù hợp.</div>';
          searchResults.style.display = 'block';
        }
      } catch (err) {
        console.error('Search error', err);
      }
    }, 300);
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }

    // Also close notif dropdown if clicked outside
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifBtn && notifDropdown && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      notifDropdownVisible = false;
      notifDropdown.style.display = 'none';
    }
  });
}

window.handleSearchResultClick = function(link, id) {
  document.getElementById('global-search-results').style.display = 'none';
  document.getElementById('global-search-input').value = '';
  switchView(link);
};

// Notification Logic
let notifDropdownVisible = false;

window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) {
    notifDropdownVisible = !notifDropdownVisible;
    dropdown.style.display = notifDropdownVisible ? 'flex' : 'none';
    if (notifDropdownVisible) {
      loadNotifications();
    }
  }
};

window.markAllNotifsRead = async function() {
  try {
    await apiRequest('/notifications/read-all', 'PATCH');
    loadNotifications();
  } catch (err) {
    console.error(err);
  }
};

window.markNotifRead = async function(id, type, refId) {
  try {
    await apiRequest(`/notifications/${id}/read`, 'PATCH');
    loadNotifications();
    
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
      notifDropdownVisible = false;
      dropdown.style.display = 'none';
    }

    if (typeof closeModal === 'function') {
      closeModal('modal-notif');
    }

    if (type === 'UPCOMING' || type === 'OVERDUE' || type === 'AI_REMINDER') {
      if (window.appNavigate) window.appNavigate('schedules');
    } else if (type && (type.includes('VACCINE') || type.includes('DEWORM'))) {
      if (window.appNavigate) window.appNavigate('health');
    }
  } catch (err) {
    console.error(err);
  }
};

async function loadNotifications() {
  try {
    const badge = document.getElementById('notif-badge');
    if (!badge) return; 
    
    if (!localStorage.getItem('petcare_token')) return; // Not logged in yet
    
    const res = await apiRequest('/notifications');
    if (res && res.success) {
      const unreadCount = res.unreadCount || 0;
      if (unreadCount > 0) {
        badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.innerText = '0';
        badge.style.display = 'none';
      }

      const notifList = document.getElementById('notif-list');
      const notifListBox = document.getElementById('notif-list-box');
      
      let html = '';
      if (!res.notifications || res.notifications.length === 0) {
        html = '<div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px;"><i class="fa-solid fa-party-horn"></i> Không có thông báo nào.</div>';
      } else {
        html = res.notifications.map(n => {
          let icon = 'fa-bell';
          let iconColor = '#FF7A00';
          if (n.type && n.type.includes('VACCINE')) { icon = 'fa-syringe'; iconColor = '#16A34A'; }
          else if (n.type && n.type.includes('DEWORM')) { icon = 'fa-bug-slash'; iconColor = '#D97706'; }
          else if (n.type && n.type.includes('OVERDUE')) { icon = 'fa-circle-exclamation'; iconColor = '#DC2626'; }
          else if (n.type && n.type === 'AI_REMINDER') { icon = 'fa-robot'; iconColor = '#10B981'; }
          else if (n.type && n.type.includes('UPCOMING')) { icon = 'fa-calendar-check'; iconColor = '#2563EB'; }
          else if (n.type === 'APPOINTMENT') { icon = 'fa-house-medical'; iconColor = '#7C3AED'; }

          const isUnread = !n.is_read;
          const itemBg = isUnread ? '#FFF8F3' : '#FFFFFF';
          const itemBorderLeft = isUnread ? '3.5px solid #FF7A00' : '3.5px solid transparent';
          const titleColor = isUnread ? '#0F172A' : '#475569';
          const titleWeight = isUnread ? '800' : '600';
          const msgColor = isUnread ? '#334155' : '#94A3B8';
          const iconBg = isUnread ? '#FFE4D1' : '#F1F5F9';
          const iconFinalColor = isUnread ? iconColor : '#94A3B8';

          return `
            <div style="padding: 12px 14px; border-bottom: 1px solid var(--border); background: ${itemBg}; border-left: ${itemBorderLeft}; cursor: pointer; display: flex; gap: 12px; align-items: flex-start; transition: background 0.2s ease;" onclick="markNotifRead('${n.id}', '${n.type || ''}', '${n.reference_id || ''}')">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="fa-solid ${icon}" style="color: ${iconFinalColor}; font-size: 14px;"></i>
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 3px;">
                  <div style="font-weight: ${titleWeight}; color: ${titleColor}; font-size: 13.5px; line-height: 1.3;">
                    ${n.title}
                  </div>
                  ${isUnread ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #FF7A00; display: inline-block; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.25);" title="Chưa đọc"></span>' : ''}
                </div>
                <div style="font-size: 12px; color: ${msgColor}; line-height: 1.4; word-break: break-word;">
                  ${n.message}
                </div>
                <div style="font-size: 10.5px; color: #94A3B8; margin-top: 5px;">
                  ${new Date(n.created_at).toLocaleString('vi-VN')}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      if (notifList) notifList.innerHTML = html;
      if (notifListBox) notifListBox.innerHTML = html;

      // Update Feature Red Dots in Sidebar
      const unreadNotifs = res.notifications.filter(n => !n.is_read);
      const unreadViews = new Set();
      unreadNotifs.forEach(n => {
        const t = (n.type || '').toUpperCase();
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();

        if (t === 'APPOINTMENT' || title.includes('lịch khám') || msg.includes('lịch khám')) {
          unreadViews.add('appointments');
        } else if (t === 'OVERDUE' || t === 'UPCOMING' || title.includes('lịch quá hạn') || title.includes('lịch sắp đến') || msg.includes('công việc')) {
          unreadViews.add('schedules');
        } else if (t.includes('VACCINE') || t.includes('DEWORM') || t === 'HEALTH' || title.includes('tiêm vắc xin') || title.includes('tẩy giun') || title.includes('sức khỏe') || msg.includes('kết quả khám')) {
          unreadViews.add('health');
        } else if (t === 'ORDER' || t === 'STORE' || title.includes('đơn hàng')) {
          unreadViews.add('store-orders');
          unreadViews.add('admin-orders');
        }
      });

      document.querySelectorAll('.nav-link').forEach(link => {
        const view = link.getAttribute('data-view');
        let dot = link.querySelector('.feature-notif-dot');
        if (unreadViews.has(view)) {
          if (!dot) {
            dot = document.createElement('span');
            dot.className = 'feature-notif-dot';
            dot.title = 'Có thông báo mới chưa đọc';
            link.appendChild(dot);
          }
        } else {
          if (dot) {
            dot.remove();
          }
        }
      });
    }
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// Poll for notifications every 30 seconds
setInterval(() => {
  if (localStorage.getItem('petcare_token')) {
    loadNotifications();
  }
}, 30000);
window.loadNotifications = loadNotifications;

// Landing page interactive modules switcher
window.switchLandingModule = function(moduleId, btn) {
  document.querySelectorAll('.landing-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.landing-module-content').forEach(c => c.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const activeBtn = document.querySelector(`.landing-tab-btn[data-module="${moduleId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
  const target = document.getElementById(`module-preview-${moduleId}`);
  if (target) {
    target.classList.add('active');
  }
};

// Navigate from Landing Page to a specific App View
window.navigateToFeature = function(viewName) {
  const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!user) {
    if (window.openAuthModal) {
      window.openAuthModal('login');
      sessionStorage.setItem('post_login_view', viewName);
    }
    return;
  }

  const landingSection = document.getElementById('landing-section');
  const appLayout = document.getElementById('app-layout');
  if (landingSection) landingSection.style.display = 'none';
  if (appLayout) appLayout.style.display = 'flex';
  document.body.style.overflow = '';

  if (window.switchView) {
    window.switchView(viewName, null, true);
  }
};

// Navigate from App Layout back to Home (Landing Page)
window.navigateToHome = function() {
  const landingSection = document.getElementById('landing-section');
  const appLayout = document.getElementById('app-layout');
  if (appLayout) appLayout.style.display = 'none';
  if (landingSection) {
    landingSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.initLandingPageRealData) {
      window.initLandingPageRealData();
    }
  }
};

// Initialize & populate Real Data on the Home / Landing Page
window.initLandingPageRealData = async function() {
  const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  const authNav = document.getElementById('landing-auth-nav');
  const greetingEl = document.getElementById('landing-hero-greeting');

  // Luôn nạp bảng giá dịch vụ thực tế từ DB/API cho tab Dịch Vụ & Bảng Giá
  await loadLandingRealServices();

  if (user) {
    // 1. Cập nhật thanh điều hướng người dùng
    if (authNav) {
      const targetDashboardView = user.role === 'USER' ? 'pets' : (['RECEPTIONIST', 'CARE_STAFF'].includes(user.role) ? 'appointments' : 'dashboard');
      authNav.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span style="font-weight:700; color:#1e293b; font-size:14px; display:inline-flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-circle-user" style="color:var(--primary); font-size:18px;"></i> Chào, <b>${escapeHTML(user.full_name || 'Chủ nuôi')}</b>
          </span>
          <button class="btn btn-primary" style="border-radius:99px; padding:7px 18px; font-size:13px;" onclick="window.navigateToFeature('${targetDashboardView}')">
            <i class="fa-solid fa-gauge-high"></i> Bảng quản lý
          </button>
          <button class="btn btn-outline" style="border-radius:99px; padding:7px 14px; font-size:13px;" onclick="document.getElementById('logout-btn')?.click()">
            <i class="fa-solid fa-right-from-bracket"></i> Đăng xuất
          </button>
        </div>
      `;
    }

    if (greetingEl) {
      greetingEl.innerHTML = `Chào mừng <span class="gradient-text">${escapeHTML(user.full_name || 'Chủ nuôi')}</span> quay trở lại!`;
    }

    // 2. Nạp dữ liệu thực tế cho chủ nuôi
    if (user.role === 'USER') {
      await Promise.all([
        loadLandingUserPets(),
        loadLandingUserSchedules(),
        loadLandingUserHealth(),
        loadLandingUserInvoices()
      ]);
    }
  } else {
    // Trạng thái khách vãng lai (Guest)
    if (authNav) {
      authNav.innerHTML = `
        <button class="btn btn-outline" style="border-radius:99px; padding:8px 20px; font-size:14px;" onclick="openAuthModal('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập
        </button>
        <button class="btn btn-primary" style="border-radius:99px; padding:8px 22px; font-size:14px;" onclick="openAuthModal('register')">
          <i class="fa-solid fa-user-plus"></i> Đăng ký miễn phí
        </button>
      `;
    }
    if (greetingEl) {
      greetingEl.innerHTML = `Chăm Sóc Thú Cưng <br><span class="gradient-text">Thông Minh & Khoa Học</span>`;
    }
    renderLandingGuestStates();
  }
};

async function loadLandingRealServices() {
  const container = document.getElementById('landing-services-container');
  if (!container) return;
  try {
    const res = await apiRequest('/services');
    if (res && res.success && Array.isArray(res.services) && res.services.length > 0) {
      container.innerHTML = res.services.map(srv => `
        <div style="background:#fff; border-radius:18px; padding:20px; border:1px solid var(--border); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <span class="badge" style="background:#fff7ed; color:var(--primary); font-size:11px; font-weight:700;">${escapeHTML(srv.category || 'Dịch vụ')}</span>
              <span style="font-size:16px; font-weight:800; color:var(--primary);">${(srv.price || 0).toLocaleString('vi-VN')} đ</span>
            </div>
            <h4 style="margin:0 0 6px; font-size:16px; font-weight:700; color:#1f2937;">${escapeHTML(srv.name)}</h4>
            <p style="margin:0 0 12px; font-size:13px; color:#64748B; line-height:1.5;">${escapeHTML(srv.description || '')}</p>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; margin-top:12px; padding-top:12px;">
            <span style="font-size:12px; color:#94a3b8;"><i class="fa-regular fa-clock"></i> ${escapeHTML(srv.duration || '30 - 60 phút')}</span>
            <button class="btn btn-primary btn-sm" onclick="window.navigateToFeature('appointments')">
              <i class="fa-solid fa-calendar-plus"></i> Đặt lịch
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading landing services:', err);
  }
}

async function loadLandingUserPets() {
  const container = document.getElementById('landing-pets-container');
  if (!container) return;
  try {
    const res = await apiRequest('/pets');
    if (res && res.success && Array.isArray(res.pets) && res.pets.length > 0) {
      container.innerHTML = res.pets.map(pet => `
        <div class="module-pet-card" style="background:#fff; border-radius:18px; padding:18px; border:1px solid var(--border); box-shadow:var(--shadow-sm); display:flex; gap:16px;">
          <div class="module-pet-avatar" style="width:56px; height:56px; border-radius:16px; background:#fff7ed; color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:26px; overflow:hidden; flex-shrink:0;">
            ${pet.photo_url ? `<img src="${pet.photo_url}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid ${pet.species === 'MÈO' ? 'fa-cat' : 'fa-dog'}"></i>`}
          </div>
          <div class="module-pet-info" style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="margin:0; font-size:16px; font-weight:800; color:#17233C;">${escapeHTML(pet.name)}</h4>
              <span class="badge badge-success">${escapeHTML(pet.health_status || 'Khỏe mạnh')}</span>
            </div>
            <p style="margin:4px 0 10px; font-size:13px; color:#64748B;">${escapeHTML(pet.breed || pet.species || 'Thú cưng')} • ${pet.weight ? pet.weight + ' kg' : 'Chưa có cân nặng'}</p>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline btn-sm" style="flex:1;" onclick="window.navigateToFeature('health')"><i class="fa-solid fa-notes-medical"></i> Xem Y Bạ</button>
              <button class="btn btn-primary btn-sm" style="flex:1;" onclick="window.navigateToFeature('appointments')"><i class="fa-solid fa-calendar-plus"></i> Đặt Lịch</button>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
          <i class="fa-solid fa-paw" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
          <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Bạn chưa có thú cưng nào</h4>
          <p style="font-size:13px; margin:0 0 14px;">Thêm thú cưng ngay để dễ dàng theo dõi sức khỏe, tiêm phòng và đặt lịch chăm sóc.</p>
          <button class="btn btn-primary btn-sm" onclick="window.navigateToFeature('pets')">
            <i class="fa-solid fa-plus"></i> Thêm Thú Cưng Mới
          </button>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading landing pets:', err);
  }
}

async function loadLandingUserSchedules() {
  const container = document.getElementById('landing-schedules-container');
  if (!container) return;
  try {
    const res = await apiRequest('/schedules?view=all');
    if (res && res.success && Array.isArray(res.schedules)) {
      const active = res.schedules.filter(s => s.status !== 'ĐÃ_HOÀN_THÀNH' && s.status !== 'ĐÃ_HỦY' && s.status !== 'CANCELLED');
      if (active.length > 0) {
        container.innerHTML = active.slice(0, 5).map(sch => {
          const isPaid = sch.payment_status === 'DA_THANH_TOAN' || sch.payment_status === 'PAID';
          const isConfirmed = Boolean(sch.is_reception_confirmed);
          return `
            <div class="module-schedule-item" style="background:#fff; border-radius:16px; padding:16px; border:1px solid var(--border); margin-bottom:12px; display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <div style="font-size:20px; width:44px; height:44px; border-radius:12px; background:#fff7ed; color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fa-solid fa-calendar-day"></i>
              </div>
              <div style="flex:1; min-width:200px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  ${sch.appointment_code ? `<span class="badge" style="background:#fff7ed; color:#c2410c; font-weight:700; border:1px solid #ffedd5; font-size:11px;">${sch.appointment_code}</span>` : ''}
                  <h4 style="margin:0; font-size:15px; font-weight:700; color:#1f2937;">${escapeHTML(sch.task_name)}</h4>
                </div>
                <p style="margin:4px 0 0; font-size:12.5px; color:#64748B;">
                  Bé: <strong>${escapeHTML(sch.pet_name)}</strong> • Thời gian: <strong>${formatDate(sch.date)} ${sch.time}</strong>
                </p>
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${isConfirmed ? '<span class="badge badge-primary"><i class="fa-solid fa-circle-check"></i> Đã xác nhận</span>' : '<span class="badge badge-warning"><i class="fa-solid fa-hourglass-half"></i> Chờ xác nhận</span>'}
                ${isPaid ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Đã thanh toán</span>' : '<span class="badge" style="background:#ffedd5; color:#c2410c;"><i class="fa-solid fa-clock"></i> Chờ thanh toán</span>'}
                <button class="btn btn-outline btn-sm" onclick="window.navigateToFeature('schedules')">Chi tiết</button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = `
          <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
            <i class="fa-regular fa-calendar-check" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
            <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Không có nhắc lịch AI sắp tới</h4>
            <p style="font-size:13px; margin:0 0 14px;">Bạn hiện không có lịch chăm sóc hay lịch hẹn nào đang chờ xử lý.</p>
            <button class="btn btn-primary btn-sm" onclick="window.navigateToFeature('appointments')">
              <i class="fa-solid fa-calendar-plus"></i> Đặt Lịch Chăm Sóc Ngay
            </button>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error loading landing schedules:', err);
  }
}

async function loadLandingUserHealth() {
  const container = document.getElementById('landing-health-container');
  if (!container) return;
  try {
    const res = await apiRequest('/health-records');
    if (res && res.success && Array.isArray(res.records) && res.records.length > 0) {
      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
          ${res.records.slice(0, 3).map(rec => `
            <div style="background:#fff; border-radius:16px; padding:18px; border:1px solid var(--border); box-shadow:var(--shadow-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge-info" style="font-size:11px;">${escapeHTML(rec.record_type || 'Chăm sóc')}</span>
                <span style="font-size:12px; color:#94a3b8;">${formatDate(rec.record_date || rec.created_at)}</span>
              </div>
              <h4 style="margin:0 0 4px; font-size:15px; font-weight:700; color:#1f2937;">${escapeHTML(rec.title || 'Hồ sơ chăm sóc')}</h4>
              <p style="margin:0 0 10px; font-size:12.5px; color:#64748B;">Bé: <b>${escapeHTML(rec.pet_name || 'Thú cưng')}</b> • BS/NV: ${escapeHTML(rec.doctor_name || rec.staff_name || 'PetCare')}</p>
              <button class="btn btn-outline btn-sm" style="width:100%;" onclick="window.navigateToFeature('health')">Xem Hồ Sơ Chi Tiết</button>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
          <i class="fa-solid fa-notes-medical" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
          <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Chưa có hồ sơ sức khỏe nào</h4>
          <p style="font-size:13px; margin:0 0 14px;">Hồ sơ khám chữa bệnh, lịch sử chăm sóc và toa thuốc của bé sẽ hiển thị tại đây.</p>
          <button class="btn btn-primary btn-sm" onclick="window.navigateToFeature('health')">
            <i class="fa-solid fa-file-medical"></i> Xem Trang Y Bạ
          </button>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading landing health:', err);
  }
}

async function loadLandingUserInvoices() {
  const container = document.getElementById('landing-invoices-container');
  if (!container) return;
  try {
    const res = await apiRequest('/invoices');
    if (res && res.success && Array.isArray(res.invoices) && res.invoices.length > 0) {
      container.innerHTML = res.invoices.slice(0, 5).map(inv => {
        const isPaid = inv.status === 'PAID' || inv.payment_status === 'DA_THANH_TOAN';
        return `
          <div style="background:#fff; border-radius:16px; padding:16px; border:1px solid var(--border); margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:40px; height:40px; border-radius:10px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:18px;">
                <i class="fa-solid fa-file-invoice-dollar"></i>
              </div>
              <div>
                <h4 style="margin:0; font-size:15px; font-weight:700; color:#1f2937;">${inv.invoice_code || '#' + inv.id.slice(-6).toUpperCase()}</h4>
                <p style="margin:2px 0 0; font-size:12.5px; color:#64748B;">Ngày tạo: ${formatDate(inv.created_at || inv.createdAt)} • Số tiền: <b style="color:var(--primary);">${(inv.final_amount || inv.total_amount || 0).toLocaleString('vi-VN')} đ</b></p>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${isPaid ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Đã thanh toán</span>' : '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Chờ thanh toán</span>'}
              <button class="btn btn-outline btn-sm" onclick="window.navigateToFeature('invoices')">Xem chi tiết</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
          <i class="fa-solid fa-file-invoice-dollar" style="font-size:32px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
          <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Bạn chưa có hóa đơn nào</h4>
          <p style="font-size:13px; margin:0 0 14px;">Mọi lịch sử hóa đơn dịch vụ và trạng thái thanh toán sẽ xuất hiện tại đây.</p>
          <button class="btn btn-primary btn-sm" onclick="window.navigateToFeature('appointments')">
            <i class="fa-solid fa-calendar-plus"></i> Đặt Lịch Dịch Vụ
          </button>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading landing invoices:', err);
  }
}

function renderLandingGuestStates() {
  const petsContainer = document.getElementById('landing-pets-container');
  if (petsContainer) {
    petsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
        <i class="fa-solid fa-shield-dog" style="font-size:32px; color:var(--primary); margin-bottom:10px; display:block;"></i>
        <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Đăng nhập để xem danh sách thú cưng của bạn</h4>
        <p style="font-size:13px; margin:0 0 14px;">Quản lý hồ sơ, lịch sử chăm sóc và theo dõi sức khỏe cho từng bé cưng dễ dàng.</p>
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </button>
      </div>
    `;
  }
  const schContainer = document.getElementById('landing-schedules-container');
  if (schContainer) {
    schContainer.innerHTML = `
      <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
        <i class="fa-regular fa-calendar-check" style="font-size:32px; color:var(--secondary); margin-bottom:10px; display:block;"></i>
        <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Đăng nhập để theo dõi nhắc lịch AI</h4>
        <p style="font-size:13px; margin:0 0 14px;">Xem lịch tiêm phòng, tẩy giun, tắm spa và nhận thông báo nhắc lịch tự động.</p>
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </button>
      </div>
    `;
  }
  const invContainer = document.getElementById('landing-invoices-container');
  if (invContainer) {
    invContainer.innerHTML = `
      <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
        <i class="fa-solid fa-file-invoice-dollar" style="font-size:32px; color:#10b981; margin-bottom:10px; display:block;"></i>
        <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Đăng nhập để xem hóa đơn & thanh toán</h4>
        <p style="font-size:13px; margin:0 0 14px;">Tra cứu chi tiết từng dịch vụ, tổng tiền và trạng thái thanh toán minh bạch.</p>
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </button>
      </div>
    `;
  }
  const healthContainer = document.getElementById('landing-health-container');
  if (healthContainer) {
    healthContainer.innerHTML = `
      <div style="text-align:center; padding:36px; background:#f8fafc; border-radius:16px; border:1px dashed var(--border); color:var(--text-muted);">
        <i class="fa-solid fa-notes-medical" style="font-size:32px; color:#ef4444; margin-bottom:10px; display:block;"></i>
        <h4 style="margin:0 0 4px; font-weight:700; color:#1f2937;">Sổ y bạ điện tử cá nhân hóa</h4>
        <p style="font-size:13px; margin:0 0 14px;">Đăng nhập để theo dõi hồ sơ sức khỏe và tiền sử chăm sóc của các bé.</p>
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </button>
      </div>
    `;
  }
}


