/* =========================================================
   AUTHENTICATION LOGIC (Login, Register, Session)
   ========================================================= */

let currentUser = null;

function initAuthUI() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');
  const authSwitchBtn = document.getElementById('auth-switch-btn');
  const authSwitchText = document.getElementById('auth-switch-text');
  const showForgotBtn = document.getElementById('show-forgot-btn');
  const logoutBtn = document.getElementById('logout-btn');

  let mode = 'login'; // 'login' | 'register' | 'forgot'

  function showAuthModalError(formType, message) {
    const errorEl = document.getElementById(`${formType}-error-msg`);
    if (errorEl) {
      errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:15px; flex-shrink:0;"></i> <span>${message}</span>`;
      errorEl.style.display = 'flex';
    }
    // Highlight inputs
    if (formType === 'login') {
      document.getElementById('login-email')?.classList.add('is-invalid');
      document.getElementById('login-password')?.classList.add('is-invalid');
    } else if (formType === 'register') {
      document.getElementById('reg-name')?.classList.add('is-invalid');
      document.getElementById('reg-email')?.classList.add('is-invalid');
      document.getElementById('reg-password')?.classList.add('is-invalid');
    } else if (formType === 'forgot') {
      document.getElementById('forgot-email')?.classList.add('is-invalid');
    }
  }

  function clearAuthModalError(formType) {
    if (formType) {
      const errorEl = document.getElementById(`${formType}-error-msg`);
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.innerHTML = '';
      }
      if (formType === 'login') {
        document.getElementById('login-email')?.classList.remove('is-invalid');
        document.getElementById('login-password')?.classList.remove('is-invalid');
      } else if (formType === 'register') {
        document.getElementById('reg-name')?.classList.remove('is-invalid');
        document.getElementById('reg-email')?.classList.remove('is-invalid');
        document.getElementById('reg-password')?.classList.remove('is-invalid');
      } else if (formType === 'forgot') {
        document.getElementById('forgot-email')?.classList.remove('is-invalid');
      }
    } else {
      ['login', 'register', 'forgot'].forEach((t) => {
        const el = document.getElementById(`${t}-error-msg`);
        if (el) {
          el.style.display = 'none';
          el.innerHTML = '';
        }
      });
      ['login-email', 'login-password', 'reg-name', 'reg-email', 'reg-password', 'forgot-email'].forEach((id) => {
        document.getElementById(id)?.classList.remove('is-invalid');
      });
    }
  }

  // Clear errors on typing
  ['login-email', 'login-password', 'reg-name', 'reg-email', 'reg-password', 'forgot-email'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        if (id.startsWith('login')) clearAuthModalError('login');
        else if (id.startsWith('reg')) clearAuthModalError('register');
        else if (id.startsWith('forgot')) clearAuthModalError('forgot');
      });
    }
  });

  function updateAuthFormsView() {
    clearAuthModalError();
    const titleEl = document.getElementById('auth-main-title');
    const subtitleEl = document.getElementById('auth-subtitle');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      forgotForm.style.display = 'none';
      if (titleEl) titleEl.innerText = 'Đăng nhập';
      if (subtitleEl) subtitleEl.innerText = 'Chào mừng bạn quay trở lại với Sen Chăm Boss!';
      authSwitchText.innerText = 'Chưa có tài khoản?';
      authSwitchBtn.innerText = 'Đăng ký miễn phí';
    } else if (mode === 'register') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      forgotForm.style.display = 'none';
      if (titleEl) titleEl.innerText = 'Đăng ký tài khoản';
      if (subtitleEl) subtitleEl.innerText = 'Trở thành thành viên của Sen Chăm Boss!';
      authSwitchText.innerText = 'Đã có tài khoản?';
      authSwitchBtn.innerText = 'Đăng nhập';
    } else if (mode === 'forgot') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'none';
      forgotForm.style.display = 'block';
      if (titleEl) titleEl.innerText = 'Khôi phục mật khẩu';
      if (subtitleEl) subtitleEl.innerText = 'Nhập email để nhận lại mật khẩu tài khoản';
      authSwitchText.innerText = 'Nhớ lại mật khẩu?';
      authSwitchBtn.innerText = 'Quay lại Đăng nhập';
    }
  }

  window.openAuthModal = function(targetMode = 'login') {
    mode = targetMode;
    clearAuthModalError();
    if (window.setShowLoginPassword) window.setShowLoginPassword(false);
    if (window.setShowRegPassword) window.setShowRegPassword(false);
    updateAuthFormsView();
    const landingSection = document.getElementById('landing-section');
    const authSection = document.getElementById('auth-section');
    const appLayout = document.getElementById('app-layout');
    if (appLayout) appLayout.style.display = 'none';
    if (landingSection) landingSection.style.display = 'block'; // Keep landing page visible underneath
    if (authSection) {
      authSection.style.display = 'flex';
      authSection.classList.add('active');
    }
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  window.closeAuthScreen = function() {
    clearAuthModalError();
    const landingSection = document.getElementById('landing-section');
    const authSection = document.getElementById('auth-section');
    if (authSection) {
      authSection.style.display = 'none';
      authSection.classList.remove('active');
    }
    if (landingSection) landingSection.style.display = 'block';
    document.body.style.overflow = ''; // Restore background scrolling
  };

  const btnCloseAuth = document.getElementById('btn-close-auth');
  if (btnCloseAuth) {
    btnCloseAuth.addEventListener('click', () => {
      window.closeAuthScreen();
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const authSection = document.getElementById('auth-section');
      if (authSection && authSection.style.display === 'flex') {
        window.closeAuthScreen();
      }
    }
  });

  authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    updateAuthFormsView();
  });

  showForgotBtn.addEventListener('click', (e) => {
    e.preventDefault();
    mode = 'forgot';
    updateAuthFormsView();
  });


  // ==========================================
  // STATE & LOGIC TOGGLE HIỂN THỊ MẬT KHẨU
  // ==========================================
  let showLoginPassword = false;
  let showRegPassword = false;

  window.setShowLoginPassword = function(show) {
    showLoginPassword = Boolean(show);
    const input = document.getElementById('login-password');
    const btn = document.getElementById('btn-toggle-login-password') || document.querySelector('.toggle-password-btn[data-target="login-password"]');
    const icon = btn ? btn.querySelector('i') : null;

    if (input) {
      input.type = showLoginPassword ? 'text' : 'password';
    }

    if (icon) {
      if (showLoginPassword) {
        icon.className = 'fa-solid fa-eye-slash';
        if (btn) btn.setAttribute('title', 'Ẩn mật khẩu');
      } else {
        icon.className = 'fa-regular fa-eye';
        if (btn) btn.setAttribute('title', 'Hiện mật khẩu');
      }
    }
  };

  window.toggleLoginPassword = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const input = document.getElementById('login-password');
    const currentIsPassword = input ? (input.type === 'password') : (!showLoginPassword);
    window.setShowLoginPassword(currentIsPassword);
  };

  window.setShowRegPassword = function(show) {
    showRegPassword = Boolean(show);
    const input = document.getElementById('reg-password');
    const btn = document.getElementById('btn-toggle-reg-password') || document.querySelector('.toggle-password-btn[data-target="reg-password"]');
    const icon = btn ? btn.querySelector('i') : null;

    if (input) {
      input.type = showRegPassword ? 'text' : 'password';
    }

    if (icon) {
      if (showRegPassword) {
        icon.className = 'fa-solid fa-eye-slash';
        if (btn) btn.setAttribute('title', 'Ẩn mật khẩu');
      } else {
        icon.className = 'fa-regular fa-eye';
        if (btn) btn.setAttribute('title', 'Hiện mật khẩu');
      }
    }
  };

  window.toggleRegPassword = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const input = document.getElementById('reg-password');
    const currentIsPassword = input ? (input.type === 'password') : (!showRegPassword);
    window.setShowRegPassword(currentIsPassword);
  };

  // Toggle password visibility handler đa năng cho các form khác (Profile, Admin,...)
  window.togglePasswordVisibility = function(targetId, btnElement) {
    if (targetId === 'login-password') {
      window.toggleLoginPassword();
      return;
    }
    if (targetId === 'reg-password') {
      window.toggleRegPassword();
      return;
    }

    const input = targetId ? document.getElementById(targetId) : null;
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const icon = (btnElement && btnElement.querySelector('i')) || document.querySelector(`[data-target="${targetId}"] i`);
    if (icon) {
      if (isPassword) {
        icon.className = 'fa-solid fa-eye-slash';
        if (btnElement) btnElement.setAttribute('title', 'Ẩn mật khẩu');
      } else {
        icon.className = 'fa-solid fa-eye';
        if (btnElement) btnElement.setAttribute('title', 'Hiện mật khẩu');
      }
    }
  };

  // Delegated click handler hỗ trợ toàn bộ các form khác ngoài login & register
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.toggle-password-btn');
    if (!toggleBtn) return;
    
    const targetId = toggleBtn.getAttribute('data-target');
    if (targetId === 'login-password' || targetId === 'reg-password') {
      // Đã được xử lý bởi direct onclick, không chạy thêm để tránh double toggle
      return;
    }

    e.preventDefault();
    window.togglePasswordVisibility(targetId, toggleBtn);
  });

  // Login Handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthModalError('login');

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!email || !password) {
      showAuthModalError('login', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...';
    }

    try {
      const res = await apiRequest('/auth/login', 'POST', { email, password });
      if (res && res.success) {
        localStorage.setItem('petcare_token', res.token);
        localStorage.setItem('petcare_user', JSON.stringify(res.user));
        currentUser = res.user;
        window.currentUser = res.user;
        showToast(res.message || 'Đăng nhập thành công!', 'success');
        onAuthSuccess();
      } else {
        let errMessage = 'Email hoặc mật khẩu không chính xác.';
        if (res && res.message) {
          if (res.message.includes('không tồn tại')) {
            errMessage = 'Tài khoản không tồn tại.';
          } else if (res.message.includes('khóa')) {
            errMessage = 'Tài khoản này đã bị khóa. Vui lòng liên hệ Quản trị viên.';
          } else if (res.message.includes('Mật khẩu') || res.message.includes('không chính xác')) {
            errMessage = 'Email hoặc mật khẩu không chính xác.';
          } else {
            errMessage = res.message;
          }
        }
        showAuthModalError('login', errMessage);
      }
    } catch (err) {
      console.error('Login submit error:', err);
      showAuthModalError('login', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Register Handler
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthModalError('register');

    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const roleInput = document.getElementById('reg-role');

    const full_name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';
    const role = roleInput ? roleInput.value : 'USER';

    if (!full_name || !email || !password) {
      showAuthModalError('register', 'Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu.');
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng ký...';
    }

    try {
      const res = await apiRequest('/auth/register', 'POST', { full_name, email, password, role });
      if (res && res.success) {
        localStorage.setItem('petcare_token', res.token);
        localStorage.setItem('petcare_user', JSON.stringify(res.user));
        currentUser = res.user;
        window.currentUser = res.user;
        showToast(res.message || 'Đăng ký tài khoản thành công!', 'success');
        onAuthSuccess();
      } else {
        showAuthModalError('register', (res && res.message) ? res.message : 'Đăng ký tài khoản thất bại.');
      }
    } catch (err) {
      console.error('Register submit error:', err);
      showAuthModalError('register', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Forgot Password Handler
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthModalError('forgot');

    const emailInput = document.getElementById('forgot-email');
    const email = emailInput ? emailInput.value.trim() : '';
    if (!email) {
      showAuthModalError('forgot', 'Vui lòng nhập Email khôi phục.');
      return;
    }

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    }

    try {
      const res = await apiRequest('/auth/forgot-password', 'POST', { email });
      if (res && res.success) {
        alert(res.message);
        mode = 'login';
        updateAuthFormsView();
      } else {
        showAuthModalError('forgot', (res && res.message) ? res.message : 'Tài khoản không tồn tại.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      showAuthModalError('forgot', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await apiRequest('/auth/logout', 'POST');
      localStorage.removeItem('petcare_token');
      localStorage.removeItem('petcare_user');
      currentUser = null;
      window.currentUser = null;
      showToast('Đã đăng xuất thành công.', 'info');
      const landingSection = document.getElementById('landing-section');
      const appLayout = document.getElementById('app-layout');
      const authSection = document.getElementById('auth-section');
      if (authSection) {
        authSection.style.display = 'none';
        authSection.classList.remove('active');
      }
      if (landingSection) landingSection.style.display = 'block';
      if (appLayout) appLayout.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.initLandingPageRealData) window.initLandingPageRealData();
    });
  }

  window.onAuthExpired = () => {
    showToast('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.', 'error');
    window.openAuthModal('login');
  };
}

async function checkAuthSession() {
  const token = localStorage.getItem('petcare_token');
  if (!token) return false;

  const res = await apiRequest('/auth/me');
  if (res && res.success && res.user) {
    currentUser = res.user;
    window.currentUser = res.user;
    return true;
  }
  return false;
}

function onAuthSuccess() {
  if (!currentUser) return;

  document.body.style.overflow = '';

  const authSection = document.getElementById('auth-section');
  if (authSection) {
    authSection.style.display = 'none';
    authSection.classList.remove('active');
  }

  const landingSection = document.getElementById('landing-section');
  if (landingSection) landingSection.style.display = 'none';

  const appLayout = document.getElementById('app-layout');
  if (appLayout) appLayout.style.display = 'flex';

  // Update UI user profile displays
  const defaultAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(currentUser.full_name || 'Pet');
  const userAvatarImg = document.getElementById('user-avatar-img');
  if (userAvatarImg) userAvatarImg.src = currentUser.avatar || defaultAvatar;

  const userNameTxt = document.getElementById('user-name-txt');
  if (userNameTxt) userNameTxt.innerText = currentUser.full_name || 'Người dùng';

  // Sidebar role badge display rules:
  // - USER: CHỦ NUÔI
  // - RECEPTIONIST: LỄ TÂN
  // - CARE_STAFF: CHĂM SÓC
  // - ADMIN: QUẢN LÝ
  const userRoleBadge = document.getElementById('user-role-badge');
  if (userRoleBadge) {
    if (currentUser.role === 'ADMIN') {
      userRoleBadge.innerText = 'QUẢN TRỊ VIÊN';
      userRoleBadge.style.display = 'inline-block';
    } else if (currentUser.role === 'STORE_MANAGER') {
      userRoleBadge.innerText = 'QUẢN LÝ CỬA HÀNG';
      userRoleBadge.style.display = 'inline-block';
    } else if (currentUser.role === 'RECEPTIONIST') {
      userRoleBadge.innerText = 'LỄ TÂN';
      userRoleBadge.style.display = 'inline-block';
    } else if (currentUser.role === 'CARE_STAFF') {
      userRoleBadge.innerText = 'CHĂM SÓC';
      userRoleBadge.style.display = 'inline-block';
    } else {
      userRoleBadge.innerText = '';
      userRoleBadge.style.display = 'none';
    }
  }

  const topUserName = document.getElementById('top-user-name');
  if (topUserName) topUserName.innerText = currentUser.full_name || 'Người dùng';

  const topUserRole = document.getElementById('top-user-role');
  if (topUserRole) {
    const roleTitles = {
      'ADMIN': 'QUẢN TRỊ VIÊN',
      'STORE_MANAGER': 'QUẢN LÝ CỬA HÀNG',
      'RECEPTIONIST': 'LỄ TÂN',
      'CARE_STAFF': 'NHÂN VIÊN CHĂM SÓC',
      'USER': 'CHỦ NUÔI'
    };
    topUserRole.innerText = roleTitles[currentUser.role] || 'CHỦ NUÔI';
    topUserRole.className = ['ADMIN','STORE_MANAGER'].includes(currentUser.role) ? 'badge badge-danger' : 
                            (currentUser.role === 'RECEPTIONIST' ? 'badge badge-warning' : 
                            (currentUser.role === 'CARE_STAFF' ? 'badge badge-info' : 'badge badge-secondary'));
  }

  const topAvatar = document.getElementById('top-user-avatar');
  if (topAvatar) topAvatar.src = currentUser.avatar || defaultAvatar;

  // 1. Role-based Sidebar Groups
  const userMenuGroup = document.getElementById('user-menu-group');
  const receptionistMenuGroup = document.getElementById('receptionist-menu-group');
  const careStaffMenuGroup = document.getElementById('care-staff-menu-group');
  const adminMenuGroup = document.getElementById('admin-menu-group');
  const storeManagerMenuGroup = document.getElementById('store-manager-menu-group');
  const navProfileText = document.getElementById('nav-profile-text');

  if (userMenuGroup) userMenuGroup.style.display = 'none';
  if (receptionistMenuGroup) receptionistMenuGroup.style.display = 'none';
  if (careStaffMenuGroup) careStaffMenuGroup.style.display = 'none';
  if (adminMenuGroup) adminMenuGroup.style.display = 'none';
  if (storeManagerMenuGroup) storeManagerMenuGroup.style.display = 'none';

  const openAiGenModalBtn = document.getElementById('open-ai-gen-modal-btn');
  const btnBookApp = document.getElementById('btn-book-appointment');
  const openAddHealthBtn = document.getElementById('open-add-health-btn');

  if (currentUser.role === 'ADMIN') {
    if (adminMenuGroup) adminMenuGroup.style.display = 'block';
    if (navProfileText) navProfileText.innerText = 'Hồ Sơ Quản Trị Viên';
    if (openAiGenModalBtn) openAiGenModalBtn.style.display = 'inline-flex';
    if (btnBookApp) btnBookApp.style.display = 'none';
    if (openAddHealthBtn) openAddHealthBtn.style.display = 'none';
  } else if (currentUser.role === 'STORE_MANAGER') {
    if (storeManagerMenuGroup) storeManagerMenuGroup.style.display = 'block';
    if (navProfileText) navProfileText.innerText = 'Hồ Sơ Quản Lý Cửa Hàng';
    if (openAiGenModalBtn) openAiGenModalBtn.style.display = 'inline-flex';
    if (btnBookApp) btnBookApp.style.display = 'inline-flex';
    if (openAddHealthBtn) openAddHealthBtn.style.display = 'inline-flex';
  } else if (currentUser.role === 'RECEPTIONIST') {
    if (receptionistMenuGroup) receptionistMenuGroup.style.display = 'block';
    if (navProfileText) navProfileText.innerText = 'Hồ Sơ Lễ Tân';
    if (openAiGenModalBtn) openAiGenModalBtn.style.display = 'none';
    if (btnBookApp) btnBookApp.style.display = 'inline-flex';
    if (openAddHealthBtn) openAddHealthBtn.style.display = 'none';
  } else if (currentUser.role === 'CARE_STAFF') {
    if (careStaffMenuGroup) careStaffMenuGroup.style.display = 'block';
    if (navProfileText) navProfileText.innerText = 'Hồ Sơ Nhân Viên Chăm Sóc';
    if (openAiGenModalBtn) openAiGenModalBtn.style.display = 'none';
    if (btnBookApp) btnBookApp.style.display = 'none';
    if (openAddHealthBtn) openAddHealthBtn.style.display = 'inline-flex';
  } else {
    // USER
    if (userMenuGroup) userMenuGroup.style.display = 'block';
    if (navProfileText) navProfileText.innerText = 'Hồ Sơ Cá Nhân';
    if (openAiGenModalBtn) openAiGenModalBtn.style.display = 'inline-flex';
    if (btnBookApp) btnBookApp.style.display = 'inline-flex';
    if (openAddHealthBtn) openAddHealthBtn.style.display = 'none';
  }

  // Notifications
  if (typeof window.loadNotifications === 'function') {
    window.loadNotifications();
  }

  // Check stored post-login view from landing page quick actions
  const postLoginView = sessionStorage.getItem('post_login_view');
  if (postLoginView) {
    sessionStorage.removeItem('post_login_view');
    if (typeof window.switchView === 'function') {
      window.switchView(postLoginView, null, true);
      return;
    }
  }

  // Initial Route Based on URL or Role:
  const hashRoute = window.location.hash;
  const pathRoute = window.location.pathname;
  const targetView = (typeof window.resolveRouteToView === 'function')
    ? (window.resolveRouteToView(hashRoute) || window.resolveRouteToView(pathRoute))
    : null;

  if (targetView && typeof window.switchView === 'function') {
    window.switchView(targetView, null, true);
  } else if (currentUser.role === 'ADMIN') {
    if (typeof window.switchView === 'function') {
      window.switchView('admin-users', null, true);
    }
  } else if (currentUser.role === 'STORE_MANAGER') {
    if (typeof window.switchView === 'function') {
      window.switchView('dashboard', null, true);
    }
  } else if (currentUser.role === 'RECEPTIONIST') {
    if (typeof window.switchView === 'function') {
      window.switchView('admin-users', null, true);
    }
  } else if (currentUser.role === 'CARE_STAFF') {
    if (typeof window.switchView === 'function') {
      window.switchView('appointments', null, true);
    }
  } else {
    if (typeof window.switchView === 'function') {
      window.switchView('pets', null, true);
    }
  }
}
