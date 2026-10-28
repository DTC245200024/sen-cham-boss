/* =========================================================
   MESSENGER-STYLE CHAT & DIRECT MESSAGING SYSTEM
   (Side Drawer Panel, No Overlay, No Blur, Full Messenger UX)
   ========================================================= */

let activeDrawerConvId = null;
let drawerPollInterval = null;
let currentActiveFilter = 'all'; // 'all' | 'unread' | 'adoptions'
let cachedConversations = [];

// Safe Global Chat Badge Updater
function updateGlobalChatBadges(totalUnread = 0) {
  try {
    const unread = Math.max(0, parseInt(totalUnread, 10) || 0);
    const badgeElements = document.querySelectorAll(
      '.chat-unread-badge, .nav-chat-badge, #chat-badge, #messenger-badge, [data-chat-badge]'
    );
    badgeElements.forEach(badge => {
      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    });
  } catch (err) {
    console.warn('Non-fatal warning in updateGlobalChatBadges:', err);
  }
}

function updateChatUnreadBadges(totalUnread = 0) {
  return updateGlobalChatBadges(totalUnread);
}

// =========================================================
// 1. MESSENGER DRAWER INITIALIZATION & DOM STRUCTURE
// =========================================================

function ensureMessengerDrawer() {
  let drawer = document.getElementById('side-chat-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'side-chat-drawer';
    drawer.className = 'side-chat-drawer';
    document.body.appendChild(drawer);
  }
  return drawer;
}

// Open Messenger Right Drawer in either 'list' or 'chat' mode
async function openMessengerDrawer(mode = 'list', convId = null, extraInfo = {}) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để sử dụng tính năng Đoạn chat.', 'warning');
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.classList.add('active');
    return;
  }

  const drawer = ensureMessengerDrawer();

  // Render Skeleton Template if not rendered yet
  drawer.innerHTML = `
    <!-- SCREEN 1: DANH SÁCH ĐOẠN CHAT (Messenger List View) -->
    <div id="messenger-screen-list" class="messenger-screen ${mode === 'list' ? 'active' : ''}">
      <!-- Header -->
      <div class="messenger-list-header">
        <h2 class="messenger-title">
          <i class="fa-brands fa-facebook-messenger" style="color:var(--primary); font-size:24px;"></i> Đoạn chat
        </h2>
        <div class="messenger-header-actions">
          <button class="messenger-icon-btn" onclick="openNewChatPrompt()" title="Soạn tin nhắn mới">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="messenger-icon-btn" onclick="closeMessengerDrawer()" title="Đóng panel">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="messenger-search-wrap">
        <i class="fa-solid fa-magnifying-glass messenger-search-icon"></i>
        <input type="text" id="messenger-search-input" class="messenger-search-input" placeholder="Tìm kiếm trên Đoạn chat..." oninput="handleMessengerSearch(this.value)">
      </div>

      <!-- Filter Tabs / Pills -->
      <div class="messenger-filter-tabs">
        <button type="button" class="messenger-filter-pill active" data-filter="all" onclick="setMessengerFilter('all', this)">Tất cả</button>
        <button type="button" class="messenger-filter-pill" data-filter="unread" onclick="setMessengerFilter('unread', this)">Chưa đọc</button>
      </div>

      <!-- Conversations Scroll List -->
      <div id="messenger-conv-list" class="messenger-conv-scroll">
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted); font-size:13px;">
          <i class="fa-solid fa-spinner fa-spin" style="color:var(--primary); font-size:22px; display:block; margin-bottom:10px;"></i>
          Đang tải đoạn chat...
        </div>
      </div>
    </div>

    <!-- SCREEN 2: CUỘC TRÒ CHUYỆN TRỰC TIẾP (Conversation View) -->
    <div id="messenger-screen-chat" class="messenger-screen ${mode === 'chat' ? 'active' : ''}">
      <!-- Header -->
      <div class="messenger-chat-header">
        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
          <button type="button" class="side-chat-back-btn" onclick="backToMessengerList()" title="Quay lại danh sách Đoạn chat">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="messenger-chat-user">
            <div style="position:relative; flex-shrink:0;">
              <img id="drawer-chat-avatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=User" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.1);" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">
              <span class="messenger-online-dot"></span>
            </div>
            <div style="min-width:0; flex:1;">
              <div id="drawer-chat-name" style="font-size:15px; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">
                ${extraInfo.recipientName || 'Người dùng'}
              </div>
              <div id="drawer-chat-sub" style="font-size:12px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${extraInfo.petName ? `<i class="fa-solid fa-paw"></i> Bé: <strong>${extraInfo.petName}</strong>` : 'Đang hoạt động'}
              </div>
            </div>
          </div>
        </div>
        <div style="flex-shrink:0; margin-left:8px;">
          <button class="messenger-icon-btn" onclick="closeMessengerDrawer()" title="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div id="drawer-chat-messages" class="messenger-chat-messages-body">
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted); font-size:13px;">
          <i class="fa-solid fa-spinner fa-spin" style="color:var(--primary); font-size:20px; display:block; margin-bottom:8px;"></i>
          Đang tải tin nhắn...
        </div>
      </div>

      <!-- Quick Chips -->
      <div class="messenger-chat-chips">
        <button type="button" class="messenger-filter-pill" onclick="fillDrawerMessage('Chào bạn, cho mình hỏi tình trạng sức khỏe của bé?')">Sức khỏe bé thế nào?</button>
        <button type="button" class="messenger-filter-pill" onclick="fillDrawerMessage('Mình muốn tư vấn về gói dịch vụ chăm sóc thú cưng')">Tư vấn dịch vụ</button>
        <button type="button" class="messenger-filter-pill" onclick="fillDrawerMessage('Mình muốn đặt lịch hẹn chăm sóc cho bé vào ngày mai')">Hẹn lịch chăm sóc</button>
      </div>

      <!-- Input Bar -->
      <div class="messenger-chat-input-bar">
        <form id="drawer-chat-form" onsubmit="handleSendDrawerMessage(event)" style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="drawer-chat-input" class="form-control" placeholder="Nhập tin nhắn..." autocomplete="off" style="border-radius:24px; padding:10px 16px; font-size:14px; flex:1;">
          <button type="submit" class="btn btn-primary" style="border-radius:50%; width:42px; height:42px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="fa-solid fa-paper-plane" style="font-size:15px;"></i>
          </button>
        </form>
      </div>
    </div>
  `;

  // Slide Drawer in smoothly
  drawer.classList.add('active');
  document.body.classList.add('side-chat-open');

  if (mode === 'list') {
    await loadMessengerConversations();
    startDrawerPolling('list');
  } else if (mode === 'chat' && convId) {
    activeDrawerConvId = convId;
    await loadDrawerMessages(convId);
    startDrawerPolling('chat', convId);
    setTimeout(() => {
      const input = document.getElementById('drawer-chat-input');
      if (input) input.focus();
    }, 200);
  }
}

// Toggle drawer (used for top navbar message bell/icon)
function toggleMessengerDrawer() {
  const drawer = document.getElementById('side-chat-drawer');
  if (drawer && drawer.classList.contains('active')) {
    closeMessengerDrawer();
  } else {
    openMessengerDrawer('list');
  }
}

// Close drawer completely
function closeMessengerDrawer() {
  const drawer = document.getElementById('side-chat-drawer');
  if (drawer) {
    drawer.classList.remove('active');
  }
  document.body.classList.remove('side-chat-open');
  if (drawerPollInterval) {
    clearInterval(drawerPollInterval);
    drawerPollInterval = null;
  }
  activeDrawerConvId = null;
}

// Back to list view from inside active conversation
function backToMessengerList() {
  const screenList = document.getElementById('messenger-screen-list');
  const screenChat = document.getElementById('messenger-screen-chat');
  if (screenList && screenChat) {
    screenChat.classList.remove('active');
    screenList.classList.add('active');
  }
  activeDrawerConvId = null;
  loadMessengerConversations();
  startDrawerPolling('list');
}

// =========================================================
// 2. CONVERSATION LIST SYSTEM (Screen 1)
// =========================================================

async function loadMessengerConversations(isPolling = false) {
  const convListEl = document.getElementById('messenger-conv-list');
  if (!convListEl && !isPolling) return;

  const res = await apiRequest('/chat/conversations');
  if (!res.success) {
    if (convListEl) {
      convListEl.innerHTML = `<div style="padding:30px 20px; text-align:center; color:var(--danger); font-size:13px;">Lỗi tải đoạn chat: ${res.message}</div>`;
    }
    return;
  }

  const convs = res.conversations || [];
  cachedConversations = convs;

  try {
    const totalUnread = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    if (typeof updateGlobalChatBadges === 'function') {
      updateGlobalChatBadges(totalUnread);
    }
  } catch (badgeErr) {
    console.warn('Non-fatal badge update warning:', badgeErr);
  }

  if (!convListEl) return;

  renderMessengerConversationsHTML(convs);
}

function renderMessengerConversationsHTML(convs) {
  const convListEl = document.getElementById('messenger-conv-list');
  if (!convListEl) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');

  // Filter based on active filter tab
  let filtered = convs;
  if (currentActiveFilter === 'unread') {
    filtered = convs.filter(c => (c.unread_count || 0) > 0);
  }

  if (filtered.length === 0) {
    let emptyMsg = 'Chưa có đoạn chat nào';
    let subMsg = 'Chọn hoặc bắt đầu cuộc trò chuyện mới để liên hệ.';
    if (currentActiveFilter === 'unread') {
      emptyMsg = 'Không có tin nhắn chưa đọc';
      subMsg = 'Bạn đã xem hết tất cả các đoạn chat.';
    }

    convListEl.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
        <div style="font-size:38px; margin-bottom:8px;"><i class="fa-solid fa-comment"></i></div>
        <div style="font-weight:700; font-size:15px; color:var(--text-main); margin-bottom:4px;">${emptyMsg}</div>
        <p style="font-size:12.5px; margin:0; line-height:1.4;">${subMsg}</p>
      </div>
    `;
    return;
  }

  convListEl.innerHTML = filtered.map(c => {
    const other = c.other_user || {};
    const name = other.full_name || 'Người dùng';
    const avatar = other.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    const unread = c.unread_count || 0;
    const lastMsg = c.last_message;
    const isMe = lastMsg && lastMsg.sender_id === currentUser.id;
    
    let msgPreview = 'Bắt đầu cuộc trò chuyện...';
    if (lastMsg) {
      msgPreview = isMe ? `Bạn: ${lastMsg.content}` : lastMsg.content;
    }

    const timeStr = lastMsg ? formatMessageTime(lastMsg.created_at) : '';
    const isActive = activeDrawerConvId === c.id;

    return `
      <div class="messenger-conv-item ${isActive ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''}" 
           id="drawer-conv-item-${c.id}" 
           onclick="selectMessengerConversation('${c.id}')"
           data-name="${name.toLowerCase()}"
           data-preview="${msgPreview.toLowerCase()}">
        <div class="messenger-conv-avatar-wrap">
          <img src="${avatar}" class="messenger-conv-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">
          <span class="messenger-online-dot"></span>
        </div>
        <div class="messenger-conv-info">
          <div class="messenger-conv-top">
            <h5 class="messenger-conv-name">${name}</h5>
            <span class="messenger-conv-time">${timeStr ? `· ${timeStr}` : ''}</span>
          </div>
          <div class="messenger-conv-sub">
            <span class="messenger-conv-snippet">${msgPreview}</span>
            ${unread > 0 ? `<span class="messenger-unread-dot" title="${unread} tin nhắn mới"></span>` : ''}
          </div>
          ${c.adoption ? `
            <div style="font-size:11px; color:var(--primary); font-weight:600; margin-top:2px; display:flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-paw"></i> Bé: ${c.adoption.pet_name}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function handleMessengerSearch(query) {
  const q = query.trim().toLowerCase();
  const items = document.querySelectorAll('.messenger-conv-item');
  items.forEach(item => {
    const name = item.getAttribute('data-name') || '';
    const preview = item.getAttribute('data-preview') || '';
    if (!q || name.includes(q) || preview.includes(q)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

function setMessengerFilter(filterType, btnEl) {
  currentActiveFilter = filterType;
  document.querySelectorAll('.messenger-filter-pill').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderMessengerConversationsHTML(cachedConversations);
}

function openNewChatPrompt() {
  showToast('Để trò chuyện mới, hãy chọn cuộc trò chuyện hoặc nhắn tin từ Lịch hẹn / Quản lý khách hàng.', 'info');
}

// =========================================================
// 3. DIRECT CONVERSATION SYSTEM (Screen 2)
// =========================================================

async function selectMessengerConversation(convId) {
  activeDrawerConvId = convId;

  const conv = cachedConversations.find(c => c.id === convId);
  const other = conv?.other_user || {};
  const recipientName = other.full_name || 'Người dùng';
  const recipientAvatar = other.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(recipientName)}`;
  const petName = conv?.adoption?.pet_name || null;

  // Switch to Screen 2
  const screenList = document.getElementById('messenger-screen-list');
  const screenChat = document.getElementById('messenger-screen-chat');
  if (screenList && screenChat) {
    screenList.classList.remove('active');
    screenChat.classList.add('active');
  }

  // Update Screen 2 Header
  const avatarEl = document.getElementById('drawer-chat-avatar');
  const nameEl = document.getElementById('drawer-chat-name');
  const subEl = document.getElementById('drawer-chat-sub');

  if (avatarEl) avatarEl.src = recipientAvatar;
  if (nameEl) nameEl.innerText = recipientName;
  if (subEl) {
    subEl.innerHTML = petName ? `<i class="fa-solid fa-paw"></i> Bé: <strong>${petName}</strong>` : 'Đang hoạt động';
  }

  await loadDrawerMessages(convId);
  startDrawerPolling('chat', convId);

  setTimeout(() => {
    const input = document.getElementById('drawer-chat-input');
    if (input) input.focus();
  }, 200);
}

// Open Direct Chat from any button (Adoption cards, Admin user table, User profile)
async function openDirectChat(options, recipientName = null, recipientAvatar = null, adoptionId = null, petName = null) {
  let recId, recName, recAvatar, adpId, pName;
  if (typeof options === 'object' && options !== null) {
    recId = options.recipientId || options.id || options.user_id;
    recName = options.recipientName || options.name || options.full_name;
    recAvatar = options.recipientAvatar || options.avatar;
    adpId = options.adoptionId;
    pName = options.petName;
  } else {
    recId = options;
    recName = recipientName;
    recAvatar = recipientAvatar;
    adpId = adoptionId;
    pName = petName;
  }

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null');
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để nhắn tin trực tiếp.', 'warning');
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.classList.add('active');
    return;
  }

  if (recId === currentUser.id) {
    showToast('Đây là bài đăng / tài khoản của chính bạn! ', 'info');
    return;
  }

  // Create or fetch conversation from backend
  const res = await apiRequest('/chat/conversations', 'POST', {
    recipient_id: recId,
    adoption_id: adpId || null
  });

  if (!res.success) {
    showToast(res.message || 'Không thể tạo cuộc trò chuyện.', 'error');
    return;
  }

  const conv = res.conversation;
  activeDrawerConvId = conv.id;

  // Open Slide-in Right Chat Drawer directly in 'chat' mode
  await openMessengerDrawer('chat', conv.id, {
    recipientName: recName || conv.other_user?.full_name,
    recipientAvatar: recAvatar || conv.other_user?.avatar,
    petName: pName || conv.adoption?.pet_name
  });
}

// Load messages for Screen 2
async function loadDrawerMessages(convId, isPolling = false) {
  if (!convId || activeDrawerConvId !== convId) return;

  const res = await apiRequest(`/chat/conversations/${convId}/messages`);
  if (!res.success) return;

  const messages = res.messages || [];
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
  const bodyEl = document.getElementById('drawer-chat-messages');
  if (!bodyEl) return;

  const isAtBottom = bodyEl.scrollHeight - bodyEl.scrollTop <= bodyEl.clientHeight + 80;

  if (messages.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:10px;"></div>
        <div style="font-weight:700; color:var(--text-main); font-size:15px; margin-bottom:4px;">Bắt đầu trò chuyện</div>
        <p style="font-size:13px; margin:0; line-height:1.4;">Gửi lời chào hoặc đặt câu hỏi trực tiếp với người nhận.</p>
      </div>
    `;
  } else {
    bodyEl.innerHTML = renderMessagesHTML(messages, currentUser.id);
  }

  if (!isPolling || isAtBottom) {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
}

// Send message in Screen 2
async function handleSendDrawerMessage(e) {
  e.preventDefault();
  if (!activeDrawerConvId) return;

  const input = document.getElementById('drawer-chat-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  const res = await apiRequest(`/chat/conversations/${activeDrawerConvId}/messages`, 'POST', { content });
  if (res.success) {
    await loadDrawerMessages(activeDrawerConvId);
    try {
      if (typeof updateChatUnreadBadges === 'function') updateChatUnreadBadges();
    } catch (e) {
      console.warn('Non-fatal badge update warning:', e);
    }
  } else {
    showToast(res.message || 'Lỗi gửi tin nhắn', 'error');
  }
}

function fillDrawerMessage(text) {
  const input = document.getElementById('drawer-chat-input');
  if (input) {
    input.value = text;
    input.focus();
  }
}

// =========================================================
// 4. MESSAGE RENDERING & HELPERS
// =========================================================

function renderMessagesHTML(messages, currentUserId) {
  let lastDate = '';

  return messages.map(m => {
    const isMe = m.sender_id === currentUserId;
    const msgDate = new Date(m.created_at).toLocaleDateString('vi-VN');
    let dateDivider = '';
    
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      dateDivider = `<div class="chat-date-divider"><span>${msgDate}</span></div>`;
    }

    const timeStr = new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    return `
      ${dateDivider}
      <div class="chat-msg-row ${isMe ? 'msg-outgoing' : 'msg-incoming'}">
        <div class="chat-bubble">
          <div class="chat-bubble-text">${escapeChatHtml(m.content)}</div>
          <div class="chat-bubble-meta">
            <span>${timeStr}</span>
            ${isMe ? `<i class="fa-solid ${m.is_read ? 'fa-check-double text-success' : 'fa-check'}" style="font-size:10px; margin-left:4px;" title="${m.is_read ? 'Đã xem' : 'Đã gửi'}"></i>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function formatMessageTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return '';
  }
}

function escapeChatHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================================================
// 5. POLLING & BADGE SYSTEM
// =========================================================

function startDrawerPolling(mode, convId = null) {
  if (drawerPollInterval) clearInterval(drawerPollInterval);
  drawerPollInterval = setInterval(() => {
    const drawer = document.getElementById('side-chat-drawer');
    if (!drawer || !drawer.classList.contains('active')) return;

    if (mode === 'list') {
      loadMessengerConversations(true);
    } else if (mode === 'chat' && convId && activeDrawerConvId === convId) {
      loadDrawerMessages(convId, true);
    }
  }, 3000);
}

// Helper for role badge representation
function getRoleBadgeInfo(role) {
  switch (role) {
    case 'ADMIN':
      return { label: 'Quản trị viên', color: '#6366f1', bg: '#eef2ff', icon: 'fa-shield-halved' };
    case 'STORE_MANAGER':
      return { label: 'Quản lý cửa hàng', color: '#0284c7', bg: '#e0f2fe', icon: 'fa-user-tie' };
    case 'RECEPTIONIST':
      return { label: 'Lễ tân', color: '#0d9488', bg: '#ccfbf1', icon: 'fa-headset' };
    case 'CARE_STAFF':
      return { label: 'Nhân viên chăm sóc', color: '#ea580c', bg: '#fff7ed', icon: 'fa-user-nurse' };
    case 'USER':
    default:
      return { label: 'Chủ nuôi', color: '#475569', bg: '#f1f5f9', icon: 'fa-user' };
  }
}

// =========================================================
// 6. IN-PAGE MESSAGING SYSTEM (#view-messages)
// =========================================================

let activeInpageConvId = null;
let inpagePollInterval = null;
let cachedChatUsers = [];
let currentChatRoleFilter = 'ALL';

function renderInpageLoadingState() {
  const convListEl = document.getElementById('inpage-conv-list');
  if (convListEl) {
    convListEl.innerHTML = `
      <div style="text-align:center; padding:35px 15px; color:var(--text-muted); font-size:13.5px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary); font-size:22px; margin-bottom:10px; display:block;"></i>
        <div>Đang tải cuộc trò chuyện...</div>
      </div>
    `;
  }
}

function renderInpageEmptyState() {
  const convListEl = document.getElementById('inpage-conv-list');
  if (convListEl) {
    convListEl.innerHTML = `
      <div style="text-align:center; padding:35px 15px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:8px;"><i class="fa-solid fa-comment"></i></div>
        <div style="font-weight:700; font-size:14.5px; color:var(--text-main); margin-bottom:4px;">Chưa có cuộc trò chuyện nào</div>
        <p style="font-size:12.5px; margin:0 0 14px; color:var(--text-muted); line-height:1.4;">Bạn có thể bắt đầu nhắn tin với Chủ nuôi, Lễ tân hoặc Nhân viên chăm sóc.</p>
        <button class="btn btn-primary btn-sm" onclick="openNewChatPrompt()" style="border-radius:20px; padding:7px 18px; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-plus"></i> Bắt đầu trò chuyện
        </button>
      </div>
    `;
  }

  const scrollEl = document.getElementById('inpage-msg-scroll');
  if (scrollEl) {
    scrollEl.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:var(--text-muted); font-size:13.5px;">
        <i class="fa-regular fa-comments" style="font-size:38px; color:var(--primary); margin-bottom:12px; display:block; opacity:0.8;"></i>
        <div style="font-weight:700; color:var(--text-main); font-size:15px; margin-bottom:4px;">Chưa có cuộc trò chuyện nào</div>
        <div style="font-size:13px; color:var(--text-muted);">Bấm vào nút "<b>+ Bắt đầu trò chuyện</b>" để liên hệ với Chủ nuôi, Lễ tân hoặc Nhân viên chăm sóc.</div>
      </div>
    `;
  }

  const targetName = document.getElementById('inpage-target-name');
  const targetRole = document.getElementById('inpage-target-role');
  const targetBadge = document.getElementById('inpage-target-role-badge');
  const bannerContainer = document.getElementById('inpage-appointment-banner-container');
  if (targetName) targetName.innerText = 'Tin Nhắn & Hỗ Trợ';
  if (targetRole) targetRole.innerText = 'Chọn hoặc bắt đầu cuộc trò chuyện mới';
  if (targetBadge) targetBadge.style.display = 'none';
  if (bannerContainer) bannerContainer.innerHTML = '';
}

function renderInpageErrorState(message) {
  const convListEl = document.getElementById('inpage-conv-list');
  if (convListEl) {
    convListEl.innerHTML = `
      <div style="text-align:center; padding:35px 15px; color:var(--danger); font-size:13px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:26px; margin-bottom:8px; display:block;"></i>
        <div style="font-weight:700; margin-bottom:4px;">Không thể tải cuộc trò chuyện</div>
        <div style="color:var(--text-muted); font-size:12px; margin-bottom:12px;">${escapeHTML(message || 'Vui lòng kiểm tra kết nối.')}</div>
        <button class="btn btn-sm btn-outline" onclick="loadInpageMessenger()" style="border-radius:16px; font-size:12px; padding:4px 12px;">
          <i class="fa-solid fa-rotate-right"></i> Thử lại
        </button>
      </div>
    `;
  }
}

async function loadInpageMessenger(isPolling = false, preselectedId = null) {
  const convListEl = document.getElementById('inpage-conv-list');
  if (!convListEl && !isPolling) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser) {
    if (convListEl) {
      convListEl.innerHTML = `<div style="text-align:center; padding:35px 15px; color:var(--text-muted); font-size:13px;">Vui lòng đăng nhập để xem tin nhắn.</div>`;
    }
    return;
  }

  if (!isPolling) {
    renderInpageLoadingState();
  }

  try {
    const res = await apiRequest('/chat/conversations');
    if (!res || !res.success) {
      if (!isPolling) {
        renderInpageErrorState((res && res.message) || 'Lỗi kết nối máy chủ');
      }
      return;
    }

    let convs = res.conversations || [];
    if (currentUser.role === 'STORE_MANAGER') {
      convs = convs.filter(c => c.other_user && c.other_user.role !== 'ADMIN');
    }
    cachedConversations = convs;

    try {
      const totalUnread = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      if (typeof updateGlobalChatBadges === 'function') {
        updateGlobalChatBadges(totalUnread);
      }
    } catch (badgeErr) {
      console.warn('Non-fatal badge update warning in loadInpageMessenger:', badgeErr);
    }

    if (convs.length === 0) {
      activeInpageConvId = null;
      renderInpageEmptyState();
      startInpagePolling();
      return;
    }

    renderInpageConversations(convs);
    startInpagePolling();

    if (preselectedId && convs.some(c => c.id === preselectedId)) {
      selectInpageConversation(preselectedId);
    } else if (activeInpageConvId && convs.some(c => c.id === activeInpageConvId)) {
      selectInpageConversation(activeInpageConvId);
    } else if (convs.length > 0) {
      selectInpageConversation(convs[0].id);
    }
  } catch (err) {
    console.error('Error in loadInpageMessenger:', err);
    if (!isPolling) {
      renderInpageErrorState(err.message || 'Lỗi không xác định');
    }
  }
}

function renderInpageConversations(convs) {
  const convListEl = document.getElementById('inpage-conv-list');
  if (!convListEl) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');

  if (!convs || convs.length === 0) {
    renderInpageEmptyState();
    return;
  }

  convListEl.innerHTML = convs.map(c => {
    const other = c.other_user || {};
    const name = other.full_name || 'Người dùng';
    const avatar = other.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    const badge = getRoleBadgeInfo(other.role);
    const unread = c.unread_count || 0;
    const lastMsg = c.last_message;
    const isMe = lastMsg && typeof lastMsg === 'object' && lastMsg.sender_id === currentUser.id;
    let previewText = 'Bắt đầu cuộc trò chuyện...';
    if (lastMsg && typeof lastMsg === 'object' && lastMsg.content) {
      previewText = `${isMe ? 'Bạn: ' : ''}${lastMsg.content}`;
    } else if (typeof lastMsg === 'string' && lastMsg !== 'undefined') {
      previewText = lastMsg;
    }
    const timeStr = (lastMsg && typeof lastMsg === 'object' && lastMsg.created_at) ? formatMessageTime(lastMsg.created_at) : '';
    const isActive = c.id === activeInpageConvId;

    const activeStyle = isActive 
      ? 'background: #fff7ed; border: 1.5px solid #fdba74; box-shadow: 0 2px 6px rgba(249,115,22,0.08);' 
      : 'background: #ffffff; border: 1px solid #f1f5f9;';

    return `
      <div class="inpage-conv-item" onclick="selectInpageConversation('${c.id}')" style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; cursor:pointer; margin-bottom:8px; transition:all 0.2s ease; ${activeStyle}" onmouseover="if('${isActive}' !== 'true') this.style.background='#f8fafc';" onmouseout="if('${isActive}' !== 'true') this.style.background='#ffffff';">
        <div style="position:relative; flex-shrink:0;">
          <img src="${avatar}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:1px solid #e2e8f0;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">
          ${unread > 0 ? `<span style="position:absolute; top:-2px; right:-2px; width:11px; height:11px; background:#ef4444; border-radius:50%; border:2px solid #fff;"></span>` : ''}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
            <span style="font-weight:700; font-size:14px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${escapeHTML(name)}</span>
            <span style="font-size:11px; color:#94a3b8; flex-shrink:0;">${timeStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
            <span style="font-size:10px; font-weight:700; color:${badge.color}; background:${badge.bg}; padding:1px 6px; border-radius:10px; display:inline-flex; align-items:center; gap:3px;">
              <i class="fa-solid ${badge.icon}" style="font-size:9px;"></i> ${badge.label}
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="font-size:12.5px; color:${unread > 0 ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight:${unread > 0 ? '700' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
              ${escapeHTML(previewText)}
            </div>
            ${unread > 0 ? `<span class="badge badge-primary" style="font-size:10px; padding:2px 7px; border-radius:10px; font-weight:800; flex-shrink:0;">${unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function selectInpageConversation(convId, overrideAppInfo = null) {
  if (!convId) return;
  activeInpageConvId = convId;

  try {
    const res = await apiRequest(`/chat/conversations/${convId}/messages`);
    if (!res || !res.success) {
      showToast((res && res.message) || 'Lỗi tải tin nhắn', 'error');
      return;
    }

    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
    const conv = res.conversation;
    const other = (conv && conv.other_user) || {};

    if (currentUser.role === 'STORE_MANAGER' && other.role === 'ADMIN') {
      showToast('Quản lý cửa hàng không có quyền truy cập cuộc trò chuyện với Quản trị viên.', 'warning');
      return;
    }

    const badge = getRoleBadgeInfo(other.role);

    const targetAvatar = document.getElementById('inpage-target-avatar');
    const targetName = document.getElementById('inpage-target-name');
    const targetRole = document.getElementById('inpage-target-role');
    const targetBadge = document.getElementById('inpage-target-role-badge');
    const bannerContainer = document.getElementById('inpage-appointment-banner-container');

    if (targetAvatar) targetAvatar.src = other.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(other.full_name || 'User')}`;
    if (targetName) targetName.innerText = other.full_name || 'Người dùng';
    if (targetBadge) {
      targetBadge.style.display = 'inline-flex';
      targetBadge.style.color = badge.color;
      targetBadge.style.background = badge.bg;
      targetBadge.innerHTML = `<i class="fa-solid ${badge.icon}" style="margin-right:4px;"></i> ${badge.label}`;
    }
    if (targetRole) {
      targetRole.innerText = other.phone ? `SĐT: ${other.phone} • Sẵn sàng trò chuyện` : 'Đang hoạt động';
    }

    // Render Appointment Banner if available
    const appInfo = overrideAppInfo || (conv && conv.appointment_info);
    if (bannerContainer) {
      if (appInfo && appInfo.service_name) {
        const isOwnerUser = (currentUser && currentUser.role === 'USER');
        const isStaffOrAdmin = (currentUser && ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(currentUser.role));

        const statusMap = {
          'PENDING': { text: 'Chờ xác nhận', cls: 'badge-warning', icon: 'fa-clock' },
          'PENDING_STAFF_CONFIRMATION': { text: 'Chờ nhân viên xác nhận', cls: 'badge-warning', icon: 'fa-user-clock' },
          'CONFIRMED': { text: 'Đã xác nhận', cls: 'badge-info', icon: 'fa-user-check' },
          'IN_PROGRESS': { text: 'Đang thực hiện', cls: 'badge-primary', icon: 'fa-spinner fa-spin' },
          'COMPLETED': { text: 'Hoàn thành', cls: 'badge-success', icon: 'fa-check-double' },
          'CANCELLED': { text: 'Đã hủy', cls: 'badge-danger', icon: 'fa-ban' }
        };
        const st = statusMap[appInfo.status] || { text: appInfo.status || 'Lịch hẹn', cls: 'badge-info', icon: 'fa-calendar' };
        const dateText = appInfo.appointment_date ? (appInfo.appointment_date.includes('-') ? appInfo.appointment_date.split('-').reverse().join('/') : appInfo.appointment_date) : '';
        const timeText = appInfo.appointment_time || '';
        const isNotDone = appInfo.status !== 'COMPLETED' && appInfo.status !== 'CANCELLED';

        let quickActionsHtml = '';
        if (isOwnerUser && isNotDone) {
          quickActionsHtml = `
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="sendQuickCancelRequest('${appInfo.appointment_id}', '${escapeHTML(appInfo.pet_name || 'Bé cưng')}', '${escapeHTML(appInfo.service_name || 'Dịch vụ')}', '${dateText}', '${timeText}')" style="font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 4px rgba(239,68,68,0.15);" title="Gửi yêu cầu hủy lịch nhanh tới Lễ tân">
              <i class="fa-solid fa-paper-plane"></i> <i class="fa-solid fa-bolt"></i> Yêu cầu hủy lịch
            </button>
          `;
        } else if (isStaffOrAdmin && isNotDone) {
          quickActionsHtml = `
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-sm btn-outline" onclick="window.switchView('appointments')" style="font-size: 11.5px; padding: 4px 10px; border-radius: 6px;" title="Xem lịch hẹn trong danh sách">
                <i class="fa-solid fa-eye"></i> Xem lịch
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.cancelAppointment('${appInfo.appointment_id}')" style="font-size: 11.5px; padding: 4px 10px; border-radius: 6px;" title="Hủy lịch hẹn theo yêu cầu khách hàng">
                <i class="fa-solid fa-ban"></i> Hủy lịch
              </button>
            </div>
          `;
        }

        bannerContainer.innerHTML = `
          <div style="background: #fff8f2; border: 1.5px solid #fed7aa; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; box-shadow: 0 2px 8px rgba(249,115,22,0.06);">
            <div style="display: flex; align-items: flex-start; gap: 10px; min-width: 240px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #fff; border: 1px solid #fed7aa; color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <i class="fa-solid fa-calendar-days"></i>
              </div>
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
                  <i class="fa-solid fa-thumbtack"></i> Yêu cầu liên quan đến lịch hẹn
                </div>
                <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; line-height: 1.4;">
                  <i class="fa-solid fa-paw"></i> Thú cưng: <span style="color: var(--primary);">${escapeHTML(appInfo.pet_name || 'Bé cưng')}</span> • Dịch vụ: <b>${escapeHTML(appInfo.service_name)}</b>
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                  <i class="fa-regular fa-clock"></i> Thời gian: <b>${timeText ? `${timeText} - ` : ''}${dateText}</b>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge ${st.cls}" style="font-size: 12px; padding: 5px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid ${st.icon}"></i> ${st.text}
              </span>
              ${quickActionsHtml}
            </div>
          </div>
        `;
      } else {
        bannerContainer.innerHTML = '';
      }
    }

    renderInpageMessagesOnly(res.messages || [], conv);

    // Update left conv list highlight & zero out unread for this active conversation
    const targetConv = cachedConversations.find(c => c.id === convId);
    if (targetConv) {
      targetConv.unread_count = 0;
    }
    renderInpageConversations(cachedConversations);
  } catch (err) {
    console.error('Error in selectInpageConversation:', err);
  }
}

function renderInpageMessagesOnly(messages, conv) {
  const scrollEl = document.getElementById('inpage-msg-scroll');
  if (!scrollEl) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const other = (conv && conv.other_user) || {};

  const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop <= scrollEl.clientHeight + 80;

  if (!messages || messages.length === 0) {
    scrollEl.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted); font-size:13.5px;">
        <i class="fa-regular fa-comments" style="font-size:28px; color:var(--primary); display:block; margin-bottom:10px;"></i>
        Chưa có tin nhắn nào trong cuộc trò chuyện này. Hãy gửi lời chào đầu tiên! 
      </div>
    `;
    return;
  }

  let lastDate = '';

  scrollEl.innerHTML = messages.map(m => {
    const isMe = m.sender_id === currentUser.id;
    const msgDate = m.created_at ? new Date(m.created_at).toLocaleDateString('vi-VN') : '';
    let dateDivider = '';

    if (msgDate && msgDate !== lastDate) {
      lastDate = msgDate;
      dateDivider = `
        <div style="text-align:center; margin:12px 0 8px;">
          <span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:700; padding:3px 12px; border-radius:12px;">${msgDate}</span>
        </div>
      `;
    }

    const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    const senderAvatar = isMe 
      ? (currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.full_name || 'Me')}`) 
      : (other.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(other.full_name || 'User')}`);

    return `
      ${dateDivider}
      <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; gap:8px; margin-bottom:6px;">
        ${!isMe ? `<img src="${senderAvatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-bottom:2px; flex-shrink:0;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">` : ''}
        <div style="max-width:70%;">
          <div style="padding:10px 15px; border-radius:16px; font-size:13.5px; line-height:1.45; word-break:break-word; ${isMe ? 'background:var(--primary); color:#ffffff; border-bottom-right-radius:4px; box-shadow:0 1px 3px rgba(249,115,22,0.2);' : 'background:#f1f5f9; color:var(--text-main); border-bottom-left-radius:4px;'}">
            ${escapeHTML(m.content)}
          </div>
          <div style="font-size:10.5px; color:#94a3b8; margin-top:3px; text-align:${isMe ? 'right' : 'left'}; padding: 0 4px; display:flex; align-items:center; justify-content:${isMe ? 'flex-end' : 'flex-start'}; gap:4px;">
            <span>${timeStr}</span>
            ${isMe ? `<i class="fa-solid ${m.is_read ? 'fa-check-double text-success' : 'fa-check'}" style="font-size:10px;" title="${m.is_read ? 'Đã xem' : 'Đã gửi'}"></i>` : ''}
          </div>
        </div>
        ${isMe ? `<img src="${senderAvatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-bottom:2px; flex-shrink:0;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=Me'">` : ''}
      </div>
    `;
  }).join('');

  if (isAtBottom) {
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }
}

function startInpagePolling() {
  if (inpagePollInterval) clearInterval(inpagePollInterval);
  inpagePollInterval = setInterval(async () => {
    const viewMessages = document.getElementById('view-messages');
    if (!viewMessages || viewMessages.style.display === 'none') {
      return;
    }
    // Silently poll conversations
    try {
      const res = await apiRequest('/chat/conversations');
      if (res && res.success && res.conversations) {
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
        let convs = res.conversations;
        if (currentUser.role === 'STORE_MANAGER') {
          convs = convs.filter(c => c.other_user && c.other_user.role !== 'ADMIN');
        }
        cachedConversations = convs;
        const searchInput = document.getElementById('inpage-msg-search');
        if (!searchInput || !searchInput.value.trim()) {
          renderInpageConversations(cachedConversations);
        }
      }
      // Silently poll active conversation messages
      if (activeInpageConvId) {
        const msgRes = await apiRequest(`/chat/conversations/${activeInpageConvId}/messages`);
        if (msgRes && msgRes.success && msgRes.messages) {
          renderInpageMessagesOnly(msgRes.messages, msgRes.conversation);
        }
      }
    } catch (e) {}
  }, 3500);
}

async function handleInpageSendMsg(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('inpage-msg-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  if (!activeInpageConvId) {
    const res = await apiRequest('/chat/conversations', 'POST', { content });
    if (res && res.success && res.conversation) {
      input.value = '';
      await loadInpageMessenger(false, res.conversation.id);
      selectInpageConversation(res.conversation.id);
    } else {
      showToast((res && res.message) || 'Vui lòng chọn cuộc trò chuyện trước khi gửi.', 'warning');
    }
    return;
  }

  const res = await apiRequest(`/chat/conversations/${activeInpageConvId}/messages`, 'POST', { content });
  if (res && res.success) {
    input.value = '';
    await selectInpageConversation(activeInpageConvId);
    const scrollEl = document.getElementById('inpage-msg-scroll');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    
    // Reload conversations to update order and last message preview
    const convsRes = await apiRequest('/chat/conversations');
    if (convsRes && convsRes.success && convsRes.conversations) {
      const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
      let convs = convsRes.conversations;
      if (currentUser.role === 'STORE_MANAGER') {
        convs = convs.filter(c => c.other_user && c.other_user.role !== 'ADMIN');
      }
      cachedConversations = convs;
      renderInpageConversations(cachedConversations);
    }
  } else {
    showToast((res && res.message) || 'Lỗi gửi tin nhắn', 'error');
  }
}

function handleInpageSearch(query) {
  if (!query || !query.trim()) {
    renderInpageConversations(cachedConversations);
    return;
  }
  const q = query.toLowerCase().trim();
  const filtered = cachedConversations.filter(c => {
    const name = ((c.other_user && c.other_user.full_name) || '').toLowerCase();
    const last = (c.last_message && typeof c.last_message === 'object' && c.last_message.content) ? c.last_message.content.toLowerCase() : '';
    const role = ((c.other_user && c.other_user.role) || '').toLowerCase();
    const roleLabel = getRoleBadgeInfo(c.other_user && c.other_user.role).label.toLowerCase();
    return name.includes(q) || last.includes(q) || role.includes(q) || roleLabel.includes(q);
  });
  renderInpageConversations(filtered);
}

// Prompt / Modal to start a new chat with available staff or user
async function openNewChatPrompt() {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để bắt đầu cuộc trò chuyện.', 'warning');
    return;
  }

  openModal('modal-new-chat');
  const searchInput = document.getElementById('modal-chat-user-search');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 150);
  }
  setChatRoleFilter('ALL');

  const listEl = document.getElementById('modal-chat-users-list');
  if (listEl) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:35px; color:var(--text-muted); font-size:13px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary); margin-bottom:8px; font-size:22px;"></i>
        <div>Đang tải danh sách người dùng...</div>
      </div>
    `;
  }

  try {
    const res = await apiRequest('/chat/users');
    if (!res || !res.success) {
      if (listEl) {
        listEl.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger); font-size:13px;">Lỗi tải danh sách: ${(res && res.message) || 'Không thể kết nối máy chủ.'}</div>`;
      }
      return;
    }

    let users = res.users || [];
    if (currentUser.role === 'STORE_MANAGER') {
      users = users.filter(u => u.role !== 'ADMIN');
    }
    cachedChatUsers = users;
    renderNewChatUsers(cachedChatUsers);
  } catch (err) {
    console.error('Error in openNewChatPrompt:', err);
    if (listEl) {
      listEl.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger); font-size:13px;">Lỗi tải danh sách: ${err.message || 'Không thể kết nối máy chủ.'}</div>`;
    }
  }
}

function setChatRoleFilter(role, btnEl) {
  currentChatRoleFilter = role;
  document.querySelectorAll('.chat-role-filter').forEach(btn => {
    if (btn === btnEl || (!btnEl && btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${role}'`))) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline');
    } else {
      btn.classList.remove('active', 'btn-primary');
      btn.classList.add('btn-outline');
    }
  });

  const searchInput = document.getElementById('modal-chat-user-search');
  const q = searchInput ? searchInput.value.trim() : '';
  filterNewChatUsers(q);
}

function filterNewChatUsers(query) {
  const q = (query || '').toLowerCase().trim();
  let filtered = cachedChatUsers;

  if (currentChatRoleFilter !== 'ALL') {
    filtered = filtered.filter(u => u.role === currentChatRoleFilter);
  }

  if (q) {
    filtered = filtered.filter(u => {
      const name = (u.full_name || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const roleLabel = getRoleBadgeInfo(u.role).label.toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q) || role.includes(q) || roleLabel.includes(q);
    });
  }

  renderNewChatUsers(filtered);
}

function renderNewChatUsers(users) {
  const listEl = document.getElementById('modal-chat-users-list');
  if (!listEl) return;

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  if (currentUser.role === 'STORE_MANAGER') {
    users = (users || []).filter(u => u.role !== 'ADMIN');
  }

  if (!users || users.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:30px 15px; color:var(--text-muted); font-size:13.5px;">
        <i class="fa-regular fa-user" style="font-size:26px; margin-bottom:8px; display:block; opacity:0.6;"></i>
        Không tìm thấy người dùng phù hợp.
      </div>
    `;
    return;
  }

  listEl.innerHTML = users.map(u => {
    const avatar = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.full_name || 'User')}`;
    const badge = getRoleBadgeInfo(u.role);
    const phone = u.phone ? `<span style="font-size:12px; color:var(--text-muted); margin-right:8px;"><i class="fa-solid fa-phone" style="font-size:10px; margin-right:3px;"></i>${escapeHTML(u.phone)}</span>` : '';
    const email = u.email ? `<span style="font-size:12px; color:var(--text-muted);"><i class="fa-regular fa-envelope" style="font-size:10px; margin-right:3px;"></i>${escapeHTML(u.email)}</span>` : '';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; border:1px solid var(--border); border-radius:12px; background:#fff; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.background='#fffaf5';" onmouseout="this.style.borderColor='var(--border)'; this.style.background='#fff';">
        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
          <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=User'">
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-weight:700; font-size:14px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(u.full_name || 'Người dùng')}</span>
              <span style="font-size:10.5px; font-weight:700; color:${badge.color}; background:${badge.bg}; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                <i class="fa-solid ${badge.icon}" style="font-size:9.5px;"></i> ${badge.label}
              </span>
            </div>
            <div style="margin-top:2px; display:flex; flex-wrap:wrap; gap:4px;">
              ${phone} ${email}
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-primary" onclick="startChatWithUser('${u.id}', '${escapeHTML(u.full_name || '')}')" style="border-radius:20px; padding:6px 14px; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; gap:5px; flex-shrink:0;">
          <i class="fa-solid fa-comment-dots"></i> Nhắn tin
        </button>
      </div>
    `;
  }).join('');
}

async function startChatWithUser(userId, userName) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
  const targetUser = cachedChatUsers.find(u => u.id === userId);
  if (currentUser.role === 'STORE_MANAGER' && targetUser && targetUser.role === 'ADMIN') {
    showToast('Quản lý cửa hàng không được phép nhắn tin với Quản trị viên.', 'warning');
    return;
  }

  closeModal('modal-new-chat');

  try {
    const res = await apiRequest('/chat/conversations', 'POST', { recipient_id: userId });
    if (!res || !res.success || !res.conversation) {
      showToast((res && res.message) || 'Không thể tạo cuộc trò chuyện.', 'error');
      return;
    }

    const conv = res.conversation;
    if (typeof switchView === 'function') {
      switchView('messages');
    }

    await loadInpageMessenger(false, conv.id);
    await selectInpageConversation(conv.id);

    setTimeout(() => {
      const input = document.getElementById('inpage-msg-input');
      if (input) input.focus();
    }, 150);
  } catch (err) {
    console.error('Error starting chat:', err);
    showToast('Lỗi khi bắt đầu cuộc trò chuyện: ' + (err.message || ''), 'error');
  }
}

// Open chat from appointment button directly in messages view
window.openChatFromAppointment = async function(appointmentId, targetUserId, targetUserName, petId, petName, serviceName, appointmentDate, appointmentTime, status) {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để sử dụng tính năng nhắn tin.', 'warning');
    return;
  }

  let recipientId = targetUserId;
  if (!recipientId || recipientId === 'null' || recipientId === currentUser.id) {
    const userRes = await apiRequest('/chat/users');
    if (userRes && userRes.success && userRes.users && userRes.users.length > 0) {
      const rec = userRes.users.find(u => u.role === 'RECEPTIONIST') || 
                  userRes.users.find(u => ['STORE_MANAGER'].includes(u.role)) || 
                  userRes.users[0];
      if (rec) {
        recipientId = rec.id;
        if (!targetUserName) targetUserName = rec.full_name;
      }
    }
  }

  if (!recipientId) {
    showToast('Không tìm thấy tài khoản Lễ tân để gửi tin nhắn.', 'error');
    return;
  }

  const appointmentInfo = {
    appointment_id: appointmentId,
    service_name: serviceName || 'Dịch vụ chăm sóc',
    pet_id: petId || '',
    pet_name: petName || 'Thú cưng',
    appointment_date: appointmentDate || '',
    appointment_time: appointmentTime || '',
    status: status || 'PENDING'
  };

  try {
    const convRes = await apiRequest('/chat/conversations', 'POST', {
      recipient_id: recipientId,
      appointment_id: appointmentId,
      appointment_info: appointmentInfo
    });

    if (!convRes || !convRes.success || !convRes.conversation) {
      showToast((convRes && convRes.message) || 'Không thể mở cuộc trò chuyện.', 'error');
      return;
    }

    const conv = convRes.conversation;

    if (typeof switchView === 'function') {
      switchView('messages');
    }

    setTimeout(async () => {
      await loadInpageMessenger(false, conv.id);
      selectInpageConversation(conv.id, appointmentInfo);
    }, 100);
  } catch (err) {
    console.error('Error opening chat from appointment:', err);
    showToast('Không thể mở cuộc trò chuyện: ' + (err.message || ''), 'error');
  }
};

// Quick cancel request action from appointment banner in chat
window.sendQuickCancelRequest = async function(appointmentId, petName, serviceName, appointmentDate, appointmentTime) {
  const dateStr = appointmentDate ? (appointmentDate.includes('-') ? appointmentDate.split('-').reverse().join('/') : appointmentDate) : '';
  const timeStr = appointmentTime ? ` lúc ${appointmentTime}` : '';
  const defaultText = `Tôi muốn yêu cầu hủy lịch chăm sóc${serviceName ? ` [${serviceName}]` : ''}${petName ? ` cho bé [${petName}]` : ''} ngày ${dateStr}${timeStr}. Vui lòng hỗ trợ.`;

  const input = document.getElementById('inpage-msg-input');
  if (input) {
    input.value = defaultText;
    input.focus();
  }

  const ok = confirm(`Gửi yêu cầu hủy lịch tới Lễ tân:\n\n"${defaultText}"\n\nBạn có muốn gửi ngay không?`);
  if (!ok) return;

  if (activeInpageConvId) {
    try {
      const res = await apiRequest(`/chat/conversations/${activeInpageConvId}/messages`, 'POST', { content: defaultText });
      if (res && res.success) {
        if (input) input.value = '';
        await selectInpageConversation(activeInpageConvId);
        showToast('Đã gửi yêu cầu hủy lịch tới Lễ tân thành công!', 'success');
        
        const convsRes = await apiRequest('/chat/conversations');
        if (convsRes && convsRes.success && convsRes.conversations) {
          const currentUser = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || '{}');
          let convs = convsRes.conversations;
          if (currentUser.role === 'STORE_MANAGER') {
            convs = convs.filter(c => c.other_user && c.other_user.role !== 'ADMIN');
          }
          cachedConversations = convs;
          renderInpageConversations(cachedConversations);
        }
      } else {
        showToast((res && res.message) || 'Không thể gửi yêu cầu hủy lịch.', 'error');
      }
    } catch (err) {
      showToast('Không thể gửi yêu cầu hủy lịch: ' + (err.message || ''), 'error');
    }
  } else if (input) {
    handleInpageSendMsg();
  }
};

// =========================================================
// 7. EXPORTS AND ALIASES
// =========================================================

window.openMessengerDrawer = openMessengerDrawer;
window.toggleMessengerDrawer = toggleMessengerDrawer;
window.closeMessengerDrawer = closeMessengerDrawer;
window.backToMessengerList = backToMessengerList;
window.selectMessengerConversation = selectMessengerConversation;
window.setMessengerFilter = setMessengerFilter;
window.handleMessengerSearch = handleMessengerSearch;
window.handleSendDrawerMessage = handleSendDrawerMessage;
window.fillDrawerMessage = fillDrawerMessage;

window.openDirectChat = openDirectChat;
window.openDirectChatWithUser = openDirectChat;
window.openChatWithUser = openDirectChat;
window.toggleChatDrawer = toggleMessengerDrawer;
window.openSideChatPanel = openMessengerDrawer;
window.closeSideChatPanel = closeMessengerDrawer;
window.openQuickChatModal = openMessengerDrawer;
window.closeQuickChatModal = closeMessengerDrawer;
window.updateGlobalChatBadges = updateGlobalChatBadges;
window.updateChatUnreadBadges = updateChatUnreadBadges;

window.loadInpageMessenger = loadInpageMessenger;
window.selectInpageConversation = selectInpageConversation;
window.handleInpageSendMsg = handleInpageSendMsg;
window.handleInpageSearch = handleInpageSearch;
window.openNewChatPrompt = openNewChatPrompt;
window.setChatRoleFilter = setChatRoleFilter;
window.filterNewChatUsers = filterNewChatUsers;
window.startChatWithUser = startChatWithUser;
window.sendQuickCancelRequest = sendQuickCancelRequest;
window.refreshActiveInpageConversation = () => {
  if (activeInpageConvId) selectInpageConversation(activeInpageConvId);
};

// initChatUI alias
window.initChatUI = () => {
  ensureMessengerDrawer();
  if (document.getElementById('view-messages')) {
    loadInpageMessenger();
  }
};




