/* =========================================================
   ADOPTION & RESCUE - SOCIAL FEED & MESSENGER CHAT PANEL
   Integrated Social Post Composer + Real-time Messenger Panel
   ========================================================= */

let currentAdoptionEditId = null;
let activeChatConversationId = null;
let chatPollingTimer = null;
let currentAdoptionFilter = 'ALL';
let isViewingConvList = false;

const ADOPTION_STATUS_MAP = {
  'ĐANG_TÌM_CHỦ': { text: 'Đang tìm chủ', cls: 'badge-info', color: '#3b82f6', icon: '<i class="fa-solid fa-paw"></i>' },
  'ĐÃ_CÓ_NGƯỜI_NHẬN': { text: 'Đã có người nhận', cls: 'badge-success', color: '#22c55e', icon: '<i class="fa-solid fa-party-horn"></i>' },
  'CHỜ_DUYỆT': { text: 'Chờ duyệt', cls: 'badge-warning', color: '#f59e0b', icon: '' },
  'HOÀN_TẤT': { text: 'Hoàn tất', cls: 'badge-secondary', color: '#6b7280', icon: '<i class="fa-solid fa-check"></i>' }
};

function formatSocialTime(dateStr) {
  if (!dateStr) return 'Vừa xong';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getUserFirstName(fullName) {
  if (!fullName) return 'Bạn';
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1] || 'Bạn';
}

function initAdoptionUI() {
  const container = document.getElementById('view-adoptions');
  if (!container) return;

  const user = window.currentUser || { full_name: 'Bạn', avatar: '', role: 'USER' };
  const userFirstName = getUserFirstName(user.full_name);
  const userAvatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'User')}&background=FF7A00&color=fff&bold=true`;

  container.innerHTML = `
    <div class="adoption-social-layout" id="adoption-main-layout">
      
      <!-- LEFT FEED COLUMN -->
      <div class="adoption-feed-col" id="adoption-feed-col">
        
        <!-- SOCIAL POST CREATOR CARD -->
        <div class="social-creator-card" id="social-creator-card" style="background:#fff; border-radius:16px; border:1px solid var(--border); box-shadow:0 4px 14px rgba(0,0,0,0.03); overflow:hidden;">
          <!-- Collapsed Trigger -->
          <div class="social-creator-collapsed" id="creator-collapsed-trigger" onclick="expandSocialCreator()" style="display:flex; align-items:center; gap:14px; padding:16px 18px; cursor:pointer;">
            <img class="social-creator-avatar" src="${userAvatar}" alt="Avatar" style="width:42px; height:42px; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=User&background=FF7A00&color=fff'">
            <div class="social-creator-prompt-btn" style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:30px; padding:10px 18px; display:flex; justify-content:space-between; align-items:center; color:#64748b; font-size:14px;">
              <span>${userFirstName} ơi, bạn muốn tìm mái ấm cho bé thú cưng nào?</span>
              <span style="display:flex; gap:12px; font-size:13.5px; color:var(--primary); font-weight:700;">
                <span><i class="fa-solid fa-plus-circle"></i> Đăng tin tìm chủ</span>
              </span>
            </div>
          </div>

          <!-- Expanded Composer Form (Direct Manual Inputs) -->
          <div class="social-creator-expanded" id="creator-expanded-box" style="display:none; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:16px;">
                  <i class="fa-solid fa-heart"></i>
                </div>
                <div>
                  <strong style="font-size:15px; color:var(--text-main);">Đăng Tin Nhận Nuôi / Cứu Trợ</strong>
                  <div style="font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-earth-americas"></i> Bài đăng hiển thị công khai</div>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" onclick="collapseSocialCreator()" style="border-radius:20px; padding:4px 12px; font-size:12px;">
                <i class="fa-solid fa-xmark"></i> Đóng lại
              </button>
            </div>

            <form id="social-post-form">
              <div class="form-row-2">
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Tên thú cưng *</label>
                  <input type="text" id="social-pet-name" class="form-control" placeholder="Ví dụ: Bé Miu, Corgi Bơ, Cún Vàng..." required>
                </div>
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Loài *</label>
                  <select id="social-species" class="form-control" required>
                    <option value="Chó">Chó</option>
                    <option value="Mèo">Mèo</option>
                    <option value="Khác">Khác (Thỏ, Hamster...)</option>
                  </select>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Độ tuổi</label>
                  <input type="text" id="social-age" class="form-control" placeholder="Ví dụ: 3 tháng, 1 tuổi, 6 tháng...">
                </div>
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Tình trạng sức khỏe</label>
                  <select id="social-health" class="form-control">
                    <option value="Khỏe mạnh">Khỏe mạnh (Đã tiêm/tẩy giun)</option>
                    <option value="Cần theo dõi">Cần theo dõi / đang chăm sóc</option>
                    <option value="Đang điều trị">Đang điều trị phục hồi</option>
                  </select>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Khu vực / Tỉnh thành *</label>
                  <input type="text" id="social-area" class="form-control" placeholder="Ví dụ: Hà Nội, TP.HCM, Đà Nẵng..." required>
                </div>
                <div class="form-group">
                  <label style="font-size:13px; font-weight:700;">Thông tin liên hệ (SĐT / Zalo) *</label>
                  <input type="text" id="social-contact" class="form-control" placeholder="Ví dụ: 0988.xxx.xxx hoặc nhắn qua app" required>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:13px; font-weight:700;">Trạng thái bài đăng</label>
                <select id="social-status" class="form-control">
                  <option value="ĐANG_TÌM_CHỦ"><i class="fa-solid fa-paw"></i> Đang tìm chủ mới</option>
                  <option value="ĐÃ_CÓ_NGƯỜI_NHẬN"><i class="fa-solid fa-party-horn"></i> Đã có người nhận</option>
                </select>
              </div>

              <!-- Story / Post Content -->
              <div class="form-group" style="margin-bottom:14px;">
                <label style="font-size:13px; font-weight:700;">Câu chuyện & Hoàn cảnh của bé *</label>
                <textarea id="social-post-desc" class="form-control" rows="3" placeholder="Chia sẻ hoàn cảnh cứu trợ, tính cách của bé, yêu cầu đối với chủ nhận nuôi..." required style="font-size:13.5px; line-height:1.5; border-radius:10px;"></textarea>
              </div>

              <!-- Pet Image Picker & Preview -->
              <div class="form-group" style="margin-bottom:16px;">
                <label style="font-size:13px; font-weight:700;">Hình ảnh thú cưng</label>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                  <label class="btn btn-outline" style="cursor:pointer; margin-bottom:0; font-size:13px; padding:7px 16px; border-radius:8px;">
                    <i class="fa-solid fa-camera"></i> Chọn ảnh bé
                    <input type="file" id="social-post-img-file" accept="image/*" style="display:none;" onchange="handleSocialImageSelect(this)">
                  </label>
                  <span id="social-post-img-name" style="font-size:12px; color:var(--text-muted);">Chưa chọn ảnh</span>
                  <button type="button" id="social-post-img-clear" class="btn btn-sm" style="display:none; color:#ef4444; padding:2px 8px; font-size:12px;" onclick="clearSocialImage()">Xóa ảnh</button>
                </div>
                <div id="social-post-img-preview-box" style="display:none; margin-top:10px;">
                  <img id="social-post-img-preview" src="" style="max-height:180px; border-radius:10px; border:1px solid var(--border); object-fit:cover;">
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display:flex; justify-content:flex-end; gap:10px; align-items:center; padding-top:6px; border-top:1px solid var(--border);">
                <button type="button" class="btn btn-outline" onclick="collapseSocialCreator()" style="border-radius:8px; padding:7px 16px; font-size:13.5px;">Hủy</button>
                <button type="submit" id="btn-submit-social-post" class="btn btn-primary" style="border-radius:8px; padding:8px 26px; font-size:13.5px; font-weight:700;">
                  <i class="fa-solid fa-paper-plane"></i> Đăng bài tìm chủ
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- FILTER TABS BAR -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#fff; padding:12px 18px; border-radius:14px; border:1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm adoption-filter-tab active" data-status="ALL" onclick="filterSocialAdoptions('ALL', this)" style="border-radius:20px; font-size:12.5px; padding:5px 14px;">Tất cả</button>
            <button class="btn btn-outline btn-sm adoption-filter-tab" data-status="ĐANG_TÌM_CHỦ" onclick="filterSocialAdoptions('ĐANG_TÌM_CHỦ', this)" style="border-radius:20px; font-size:12.5px; padding:5px 14px;"><i class="fa-solid fa-paw"></i> Đang tìm chủ</button>
            <button class="btn btn-outline btn-sm adoption-filter-tab" data-status="ĐÃ_CÓ_NGƯỜI_NHẬN" onclick="filterSocialAdoptions('ĐÃ_CÓ_NGƯỜI_NHẬN', this)" style="border-radius:20px; font-size:12.5px; padding:5px 14px;"><i class="fa-solid fa-party-horn"></i> Đã có người nhận</button>
          </div>
          <div style="font-size:12.5px; color:var(--text-muted);">
            <span id="social-feed-count">1 bài đăng</span>
          </div>
        </div>

        <!-- FEED LIST CONTAINER -->
        <div id="social-feed-container" style="display:flex; flex-direction:column; gap:18px;">
          <!-- Loaded via loadSocialFeed() -->
        </div>
      </div>

      <!-- RIGHT MESSENGER-STYLE CHAT PANEL (Shown only on demand) -->
      <div class="messenger-chat-panel" id="messenger-chat-panel">
        
        <!-- Header -->
        <div class="messenger-header">
          <div class="messenger-user-meta" id="messenger-header-meta">
            <div class="messenger-avatar-wrap">
              <img id="messenger-target-avatar" class="messenger-avatar" src="" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=User&background=FF7A00&color=fff'">
              <span class="messenger-online-badge" title="Đang hoạt động"></span>
            </div>
            <div>
              <div id="messenger-target-name" class="messenger-user-name">Người dùng</div>
              <div id="messenger-target-sub" class="messenger-user-sub">Trò chuyện nhận nuôi</div>
            </div>
          </div>

          <div class="messenger-header-actions">
            <button type="button" id="btn-toggle-convs" class="messenger-icon-btn" onclick="toggleMessengerConversationsView()" title="Danh sách đoạn chat">
              <i class="fa-solid fa-comments"></i>
              <span id="messenger-unread-badge" style="display:none; position:absolute; top:-2px; right:-2px; background:#ef4444; color:#fff; font-size:9px; font-weight:800; border-radius:50%; width:15px; height:15px; display:none; align-items:center; justify-content:center;"></span>
            </button>
            <button type="button" class="messenger-icon-btn" onclick="closeMessengerChat()" title="Đóng chat">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Active Chat Room View -->
        <div id="messenger-room-view" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
          <!-- Messages Scroll Area -->
          <div id="messenger-messages" class="messenger-messages">
            <!-- Messages rendered dynamically -->
          </div>

          <!-- Input Bar -->
          <div class="messenger-input-bar">
            <form id="messenger-chat-form" onsubmit="sendMessengerMessage(event)" style="display:flex; gap:8px; align-items:center;">
              <input type="text" id="messenger-chat-input" class="form-control" placeholder="Nhập tin nhắn..." autocomplete="off" style="font-size:13.5px; padding:8px 14px; border-radius:20px;">
              <button type="submit" id="btn-send-messenger" class="btn btn-primary" style="border-radius:50%; width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fa-solid fa-paper-plane" style="font-size:13px;"></i>
              </button>
            </form>
          </div>
        </div>

        <!-- Conversations List View (inside panel) -->
        <div id="messenger-convs-view" style="display:none; flex-direction:column; flex:1; overflow:hidden;">
          <div style="padding:10px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#fafafa;">
            <strong style="font-size:13px; color:var(--text-main);">Tất cả đoạn chat</strong>
            <button type="button" class="btn btn-sm btn-outline" onclick="toggleMessengerConversationsView()" style="font-size:11px; padding:2px 8px; border-radius:12px;">Quay lại</button>
          </div>
          <div id="messenger-convs-container" class="messenger-conv-list">
            <!-- Rendered by loadMessengerConversations() -->
          </div>
        </div>

      </div>
    </div>

    <!-- Edit Post Modal -->
    <div id="modal-edit-adoption" class="modal-overlay">
      <div class="modal-card" style="max-width:580px;">
        <div class="modal-header">
          <h3 id="modal-edit-adoption-title">Chỉnh sửa bài đăng</h3>
          <button class="modal-close-btn" onclick="closeModal('modal-edit-adoption')">&times;</button>
        </div>
        <form id="edit-adoption-form" onsubmit="submitEditAdoptionForm(event)">
          <input type="hidden" id="edit-adp-id">
          
          <div class="form-row-2">
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Tên thú cưng *</label>
              <input type="text" id="edit-adp-pet-name" class="form-control" required>
            </div>
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Loài *</label>
              <select id="edit-adp-species" class="form-control">
                <option value="Chó">Chó</option>
                <option value="Mèo">Mèo</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Tuổi</label>
              <input type="text" id="edit-adp-age" class="form-control">
            </div>
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Tình trạng sức khỏe</label>
              <input type="text" id="edit-adp-health" class="form-control">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Khu vực</label>
              <input type="text" id="edit-adp-area" class="form-control">
            </div>
            <div class="form-group">
              <label style="font-size:13px; font-weight:700;">Thông tin liên hệ</label>
              <input type="text" id="edit-adp-contact" class="form-control">
            </div>
          </div>

          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Trạng thái bài đăng</label>
            <select id="edit-adp-status" class="form-control">
              <option value="ĐANG_TÌM_CHỦ"><i class="fa-solid fa-paw"></i> Đang tìm chủ</option>
              <option value="ĐÃ_CÓ_NGƯỜI_NHẬN"><i class="fa-solid fa-party-horn"></i> Đã có người nhận</option>
            </select>
          </div>

          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Nội dung bài viết *</label>
            <textarea id="edit-adp-desc" class="form-control" rows="3" placeholder="Nội dung bài đăng..." required></textarea>
          </div>

          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Thay đổi ảnh thú cưng</label>
            <input type="file" id="edit-adp-img-file" class="form-control" accept="image/*" style="padding:6px;">
            <input type="hidden" id="edit-adp-img-url">
            <div id="edit-adp-img-preview-wrap" style="display:none; margin-top:8px;">
              <img id="edit-adp-img-preview" src="" style="max-height:140px; border-radius:8px; object-fit:cover; border:1px solid var(--border);">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button type="button" class="btn btn-outline" onclick="closeModal('modal-edit-adoption')">Hủy</button>
            <button type="submit" class="btn btn-primary" style="padding:8px 20px;">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Bind edit image preview
  const editImgFile = document.getElementById('edit-adp-img-file');
  if (editImgFile) {
    editImgFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('edit-adp-img-preview').src = URL.createObjectURL(file);
        document.getElementById('edit-adp-img-preview-wrap').style.display = 'block';
      }
    });
  }

  // Bind social post form submit
  const postForm = document.getElementById('social-post-form');
  if (postForm) {
    postForm.addEventListener('submit', handleSocialPostSubmit);
  }

  // Load feed
  loadSocialFeed('ALL');

  // Start polling timer (every 3s)
  if (chatPollingTimer) clearInterval(chatPollingTimer);
  chatPollingTimer = setInterval(() => {
    const view = document.getElementById('view-adoptions');
    if (view && view.classList.contains('active') && activeChatConversationId) {
      pollMessengerMessages();
    }
  }, 3000);
}

// -----------------------------------------------------------------------------
// CREATOR EXPAND / COLLAPSE
// -----------------------------------------------------------------------------
function expandSocialCreator() {
  const collapsed = document.getElementById('creator-collapsed-trigger');
  const expanded = document.getElementById('creator-expanded-box');
  if (collapsed && expanded) {
    collapsed.style.display = 'none';
    expanded.classList.add('active');
    const textarea = document.getElementById('social-post-desc');
    if (textarea) textarea.focus();
  }
}

function collapseSocialCreator() {
  const collapsed = document.getElementById('creator-collapsed-trigger');
  const expanded = document.getElementById('creator-expanded-box');
  if (collapsed && expanded) {
    expanded.classList.remove('active');
    collapsed.style.display = 'flex';
  }
}

function handleSocialImageSelect(input) {
  const file = input.files[0];
  if (file) {
    document.getElementById('social-post-img-name').innerText = file.name;
    document.getElementById('social-post-img-preview').src = URL.createObjectURL(file);
    document.getElementById('social-post-img-preview-box').style.display = 'block';
    document.getElementById('social-post-img-clear').style.display = 'inline-block';
  }
}

function clearSocialImage() {
  const fileInput = document.getElementById('social-post-img-file');
  if (fileInput) fileInput.value = '';
  document.getElementById('social-post-img-name').innerText = 'Chưa chọn ảnh';
  document.getElementById('social-post-img-preview-box').style.display = 'none';
  document.getElementById('social-post-img-clear').style.display = 'none';
}

// -----------------------------------------------------------------------------
// SUBMIT NEW SOCIAL POST (Direct Manual Input)
// -----------------------------------------------------------------------------
async function handleSocialPostSubmit(e) {
  e.preventDefault();

  const petName = (document.getElementById('social-pet-name')?.value || '').trim();
  const species = document.getElementById('social-species')?.value || 'Chó';
  const age = (document.getElementById('social-age')?.value || '').trim() || 'Chưa rõ';
  const healthStatus = document.getElementById('social-health')?.value || 'Khỏe mạnh';
  const area = (document.getElementById('social-area')?.value || '').trim();
  const contactInfo = (document.getElementById('social-contact')?.value || '').trim();
  const status = document.getElementById('social-status')?.value || 'ĐANG_TÌM_CHỦ';
  const desc = (document.getElementById('social-post-desc')?.value || '').trim();
  const imgFile = document.getElementById('social-post-img-file')?.files[0];

  if (!petName || !area || !contactInfo || !desc) {
    showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*).', 'warning');
    return;
  }

  let imageUrl = '';
  const btnSubmit = document.getElementById('btn-submit-social-post');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...';
  }

  // Upload image if present
  if (imgFile) {
    try {
      const uploadData = await (window.apiUpload ? window.apiUpload(imgFile) : (async () => {
        const fd = new FormData();
        fd.append('image', imgFile);
        const token = localStorage.getItem('petcare_token') || localStorage.getItem('token');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {},
          body: fd
        });
        return await res.json();
      })());

      if (uploadData && uploadData.success && uploadData.url) {
        imageUrl = uploadData.url;
      } else {
        showToast('Lỗi upload ảnh: ' + (uploadData?.message || 'Không thể tải ảnh lên'), 'error');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng bài tìm chủ';
        }
        return;
      }
    } catch (err) {
      showToast('Lỗi kết nối khi tải ảnh lên: ' + (err.message || 'Lỗi mạng'), 'error');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng bài tìm chủ';
      }
      return;
    }
  }

  const payload = {
    pet_name: petName,
    species: species,
    age: age,
    health_status: healthStatus,
    area: area,
    contact_info: contactInfo,
    description: desc,
    image_url: imageUrl,
    status: status
  };

  const res = await apiRequest('/adoptions', 'POST', payload);

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng bài tìm chủ';
  }

  if (res.success) {
    showToast('Đăng tin tìm chủ thành công! <i class="fa-solid fa-party-horn"></i>', 'success');
    document.getElementById('social-post-form').reset();
    clearSocialImage();
    collapseSocialCreator();
    loadSocialFeed(currentAdoptionFilter);
  } else {
    showToast(res.message || 'Không thể đăng bài viết.', 'error');
  }
}

// -----------------------------------------------------------------------------
// LOAD SOCIAL FEED
// -----------------------------------------------------------------------------
function filterSocialAdoptions(status, btnElement) {
  currentAdoptionFilter = status;
  document.querySelectorAll('.adoption-filter-tab').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  loadSocialFeed(status);
}

async function loadSocialFeed(filterStatus = currentAdoptionFilter) {
  const container = document.getElementById('social-feed-container');
  const countEl = document.getElementById('social-feed-count');
  if (!container) return;

  const res = await apiRequest('/adoptions');
  if (!res.success) {
    if (countEl) countEl.innerText = '0 bài đăng';
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted); background:#fff; border-radius:16px;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:24px; color:#ef4444; margin-bottom:8px;"></i>
        <p style="margin:0 0 10px 0;">Không thể tải bài đăng.</p>
        <button class="btn btn-outline btn-sm" onclick="loadSocialFeed()">Thử lại</button>
      </div>`;
    return;
  }

  let list = res.adoptions || [];
  if (filterStatus !== 'ALL') {
    list = list.filter(a => a.status === filterStatus);
  }

  if (countEl) {
    countEl.innerText = `${list.length} bài đăng`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:#fff; border-radius:16px; border:1px solid var(--border);">
        <div style="font-size:42px; margin-bottom:12px;"><i class="fa-solid fa-paw"></i></div>
        <h4 style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:6px;">Chưa có bài đăng nào</h4>
        <p style="font-size:13.5px; color:var(--text-muted); margin:0;">Hãy là người đầu tiên chia sẻ câu chuyện để tìm mái ấm cho bé nhé!</p>
      </div>`;
    return;
  }

  const currentUser = window.currentUser || {};
  const currentUserId = currentUser.id;
  const userRole = currentUser.role || 'USER';

  container.innerHTML = list.map(post => {
    const isOwner = currentUserId && post.user_id === currentUserId;
    const isAdmin = ['ADMIN','STORE_MANAGER'].includes(userRole);
    const canEditDelete = isOwner || isAdmin;
    const authorAvatar = post.owner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.owner_name || 'User')}&background=FF7A00&color=fff`;
    const timeFormatted = formatSocialTime(post.created_at);
    const statusMeta = ADOPTION_STATUS_MAP[post.status] || { text: post.status, cls: 'badge-secondary', icon: '<i class="fa-solid fa-thumbtack"></i>' };

    return `
      <div class="social-post-card" id="post-card-${post.id}">
        <!-- Post Header -->
        <div class="social-post-header">
          <div class="social-post-author">
            <img class="social-post-author-avatar" src="${authorAvatar}" alt="${post.owner_name}" onerror="this.src='https://ui-avatars.com/api/?name=User&background=FF7A00&color=fff'">
            <div>
              <div class="social-post-author-name">${escapeHtml(post.owner_name)}</div>
              <div class="social-post-time"><i class="fa-regular fa-clock"></i> ${timeFormatted} • <i class="fa-solid fa-earth-americas"></i></div>
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge ${statusMeta.cls}" style="font-size:12px; padding:4px 10px; border-radius:20px;">
              ${statusMeta.icon} ${statusMeta.text}
            </span>
            ${canEditDelete ? `
              <div class="dropdown" style="position:relative; display:inline-block;">
                <button class="btn btn-sm btn-outline" style="border-radius:50%; width:30px; height:30px; padding:0; border-color:transparent;" onclick="togglePostDropdown('${post.id}')">
                  <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div id="post-menu-${post.id}" class="post-dropdown-menu" style="display:none; position:absolute; right:0; top:34px; background:#fff; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.12); border:1px solid var(--border); min-width:150px; z-index:10; overflow:hidden;">
                  <button type="button" style="width:100%; text-align:left; padding:9px 14px; background:none; border:none; font-size:13px; color:var(--text-main); cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="openEditAdoptionModal('${post.id}')">
                    <i class="fa-solid fa-pen" style="color:var(--primary);"></i> Chỉnh sửa
                  </button>
                  ${post.status === 'ĐANG_TÌM_CHỦ' ? `
                    <button type="button" style="width:100%; text-align:left; padding:9px 14px; background:none; border:none; font-size:13px; color:#16a34a; cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="markAdoptionFound('${post.id}')">
                      <i class="fa-solid fa-circle-check"></i> Đã tìm được chủ
                    </button>
                  ` : ''}
                  <button type="button" style="width:100%; text-align:left; padding:9px 14px; background:none; border:none; font-size:13px; color:#ef4444; cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="deleteSocialPost('${post.id}')">
                    <i class="fa-solid fa-trash"></i> Xóa bài
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Post Body -->
        <div class="social-post-body">
          ${post.description ? `<div class="social-post-content">${escapeHtml(post.description)}</div>` : ''}

          ${(post.pet_name && post.pet_name !== 'Thú cưng cần tìm chủ' && post.pet_name !== 'Bé cần tìm chủ') || (post.species && post.species !== 'Thú cưng') ? `
            <div class="social-pet-meta-box">
              ${post.pet_name && post.pet_name !== 'Thú cưng cần tìm chủ' && post.pet_name !== 'Bé cần tìm chủ' ? `
                <div class="social-pet-meta-item">
                  <strong><i class="fa-solid fa-paw"></i> Tên bé:</strong> ${escapeHtml(post.pet_name)}
                </div>
              ` : ''}
              ${post.species && post.species !== 'Thú cưng' ? `
                <div class="social-pet-meta-item">
                  <strong>️ Loài:</strong> ${escapeHtml(post.species)}
                </div>
              ` : ''}
              ${post.age && post.age !== 'Chưa rõ' ? `
                <div class="social-pet-meta-item">
                  <strong> Tuổi:</strong> ${escapeHtml(post.age)}
                </div>
              ` : ''}
              ${post.health_status && post.health_status !== 'Khỏe mạnh' ? `
                <div class="social-pet-meta-item">
                  <strong> Sức khỏe:</strong> ${escapeHtml(post.health_status)}
                </div>
              ` : ''}
              ${post.area && post.area !== 'Toàn quốc' && post.area !== 'Chưa cập nhật' ? `
                <div class="social-pet-meta-item">
                  <strong> Địa điểm:</strong> ${escapeHtml(post.area)}
                </div>
              ` : ''}
              ${post.contact_info && post.contact_info !== 'Liên hệ qua tin nhắn' ? `
                <div class="social-pet-meta-item" style="grid-column:1/-1;">
                  <strong> Liên hệ:</strong> <span style="color:var(--primary); font-weight:700;">${escapeHtml(post.contact_info)}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Post Image Media -->
        ${post.image_url ? `
          <div class="social-post-media">
            <img src="${post.image_url}" alt="Ảnh thú cưng" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80'">
          </div>
        ` : ''}

        <!-- Post Footer -->
        <div class="social-post-footer">
          <div style="font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-shield-heart" style="color:var(--primary);"></i> Vì tình yêu thương động vật
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            ${!isOwner ? `
              <button class="btn btn-primary" onclick="openMessengerChat('${post.user_id}', '${escapeJs(post.owner_name)}', '${escapeJs(post.pet_name || 'Thú cưng')}', '${post.id}')" style="border-radius:24px; padding:7px 20px; font-size:13.5px; font-weight:700; box-shadow:0 3px 10px rgba(255,122,0,0.25);">
                <i class="fa-solid fa-comment"></i> Nhắn tin
              </button>
            ` : `
              <span style="font-size:12.5px; color:var(--text-muted); font-style:italic;">Bài đăng của bạn</span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function togglePostDropdown(postId) {
  const menu = document.getElementById(`post-menu-${postId}`);
  if (!menu) return;
  const isShown = menu.style.display === 'block';
  document.querySelectorAll('.post-dropdown-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isShown ? 'none' : 'block';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.post-dropdown-menu').forEach(m => m.style.display = 'none');
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(text) {
  if (!text) return '';
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// -----------------------------------------------------------------------------
// EDIT / DELETE SOCIAL POST
// -----------------------------------------------------------------------------
async function openEditAdoptionModal(postId) {
  const res = await apiRequest('/adoptions');
  if (!res.success) return;
  const post = (res.adoptions || []).find(a => a.id === postId);
  if (!post) {
    showToast('Không tìm thấy bài viết.', 'error');
    return;
  }

  document.getElementById('edit-adp-id').value = post.id;
  document.getElementById('edit-adp-pet-name').value = post.pet_name || '';
  document.getElementById('edit-adp-species').value = post.species || 'Chó';
  document.getElementById('edit-adp-age').value = (post.age && post.age !== 'Chưa rõ') ? post.age : '';
  document.getElementById('edit-adp-health').value = post.health_status || 'Khỏe mạnh';
  document.getElementById('edit-adp-area').value = (post.area && post.area !== 'Toàn quốc') ? post.area : '';
  document.getElementById('edit-adp-contact').value = (post.contact_info && post.contact_info !== 'Liên hệ qua tin nhắn') ? post.contact_info : '';
  document.getElementById('edit-adp-status').value = post.status || 'ĐANG_TÌM_CHỦ';
  document.getElementById('edit-adp-desc').value = post.description || '';
  document.getElementById('edit-adp-img-url').value = post.image_url || '';

  const previewWrap = document.getElementById('edit-adp-img-preview-wrap');
  const previewImg = document.getElementById('edit-adp-img-preview');
  if (post.image_url) {
    previewImg.src = post.image_url;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
  }

  openModal('modal-edit-adoption');
}

async function submitEditAdoptionForm(e) {
  e.preventDefault();
  const id = document.getElementById('edit-adp-id').value;
  let imageUrl = document.getElementById('edit-adp-img-url').value;

  const imgFile = document.getElementById('edit-adp-img-file')?.files[0];
  if (imgFile) {
    try {
      const uploadData = await (window.apiUpload ? window.apiUpload(imgFile) : (async () => {
        const fd = new FormData();
        fd.append('image', imgFile);
        const token = localStorage.getItem('petcare_token') || localStorage.getItem('token');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {},
          body: fd
        });
        return await res.json();
      })());

      if (uploadData && uploadData.success && uploadData.url) {
        imageUrl = uploadData.url;
      } else {
        showToast('Lỗi khi tải ảnh mới: ' + (uploadData?.message || 'Không thể upload'), 'error');
      }
    } catch (err) {
      showToast('Lỗi khi tải ảnh mới: ' + (err.message || 'Lỗi mạng'), 'error');
    }
  }

  const payload = {
    pet_name: document.getElementById('edit-adp-pet-name').value.trim(),
    species: document.getElementById('edit-adp-species').value,
    age: document.getElementById('edit-adp-age').value.trim() || 'Chưa rõ',
    health_status: document.getElementById('edit-adp-health').value.trim() || 'Khỏe mạnh',
    area: document.getElementById('edit-adp-area').value.trim(),
    contact_info: document.getElementById('edit-adp-contact').value.trim(),
    status: document.getElementById('edit-adp-status').value,
    description: document.getElementById('edit-adp-desc').value.trim(),
    image_url: imageUrl
  };

  const res = await apiRequest(`/adoptions/${id}`, 'PUT', payload);
  if (res.success) {
    showToast('Cập nhật bài đăng thành công! <i class="fa-solid fa-party-horn"></i>', 'success');
    closeModal('modal-edit-adoption');
    loadSocialFeed(currentAdoptionFilter);
  } else {
    showToast(res.message || 'Lỗi khi cập nhật.', 'error');
  }
}

async function markAdoptionFound(id) {
  const res = await apiRequest(`/adoptions/${id}/status`, 'PATCH', { status: 'ĐÃ_CÓ_NGƯỜI_NHẬN' });
  if (res.success) {
    showToast('Chúc mừng bé đã tìm được chủ mới! <i class="fa-solid fa-party-horn"></i>', 'success');
    loadSocialFeed(currentAdoptionFilter);
  } else {
    showToast(res.message || 'Không thể cập nhật trạng thái.', 'error');
  }
}

async function deleteSocialPost(id) {
  if (!confirm('Bạn có chắc muốn xóa bài đăng này không?')) return;
  const res = await apiRequest(`/adoptions/${id}`, 'DELETE');
  if (res.success) {
    showToast('Đã xóa bài đăng.', 'success');
    loadSocialFeed(currentAdoptionFilter);
  } else {
    showToast(res.message || 'Không thể xóa bài đăng.', 'error');
  }
}

// -----------------------------------------------------------------------------
// MESSENGER CHAT PANEL CONTROLLER
// -----------------------------------------------------------------------------

// Open Messenger Chat from "Nhắn tin" button
async function openMessengerChat(recipientId, recipientName, petName, adoptionId) {
  const currentUser = window.currentUser || {};
  if (recipientId === currentUser.id) {
    showToast('Đây là bài đăng của chính bạn!', 'info');
    return;
  }

  // Request or create conversation
  const res = await apiRequest('/chat/conversations', 'POST', {
    recipient_id: recipientId,
    adoption_id: adoptionId
  });

  if (!res.success) {
    showToast(res.message || 'Không thể tạo cuộc trò chuyện.', 'error');
    return;
  }

  const conv = res.conversation;
  const other = conv.other_user || { full_name: recipientName };
  const avatar = other.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other.full_name || recipientName)}&background=FF7A00&color=fff`;

  activeChatConversationId = conv.id;

  // Activate 2-column layout and show Messenger panel
  const layout = document.getElementById('adoption-main-layout');
  const panel = document.getElementById('messenger-chat-panel');
  if (layout) layout.classList.add('has-chat-active');
  if (panel) panel.classList.add('active');

  // Switch to room view
  showMessengerRoomView();

  // Set header info
  const nameEl = document.getElementById('messenger-target-name');
  const subEl = document.getElementById('messenger-target-sub');
  const avatarEl = document.getElementById('messenger-target-avatar');

  if (nameEl) nameEl.innerText = other.full_name || recipientName;
  if (subEl) subEl.innerText = petName ? `Bé ${petName}` : 'Trò chuyện nhận nuôi';
  if (avatarEl) avatarEl.src = avatar;

  // Load message history
  await loadMessengerMessages(conv.id);

  // Focus input
  const inputEl = document.getElementById('messenger-chat-input');
  if (inputEl) {
    if (!conv.last_message) {
      inputEl.value = `Chào ${getUserFirstName(recipientName)}, mình quan tâm đến bé ${petName} bạn vừa đăng!`;
    } else {
      inputEl.value = '';
    }
    inputEl.focus();
  }
}

// Close Messenger Chat Panel
function closeMessengerChat() {
  activeChatConversationId = null;
  const layout = document.getElementById('adoption-main-layout');
  const panel = document.getElementById('messenger-chat-panel');
  if (layout) layout.classList.remove('has-chat-active');
  if (panel) panel.classList.remove('active');
}

// Switch between room view and conversations list view inside the panel
function toggleMessengerConversationsView() {
  if (isViewingConvList) {
    showMessengerRoomView();
  } else {
    showMessengerConvListView();
  }
}

function showMessengerRoomView() {
  isViewingConvList = false;
  const roomView = document.getElementById('messenger-room-view');
  const convsView = document.getElementById('messenger-convs-view');
  const meta = document.getElementById('messenger-header-meta');
  const btnToggle = document.getElementById('btn-toggle-convs');

  if (roomView) roomView.style.display = 'flex';
  if (convsView) convsView.style.display = 'none';
  if (meta) meta.style.display = 'flex';
  if (btnToggle) btnToggle.classList.remove('active');
}

async function showMessengerConvListView() {
  isViewingConvList = true;
  const roomView = document.getElementById('messenger-room-view');
  const convsView = document.getElementById('messenger-convs-view');
  const btnToggle = document.getElementById('btn-toggle-convs');

  if (roomView) roomView.style.display = 'none';
  if (convsView) convsView.style.display = 'flex';
  if (btnToggle) btnToggle.classList.add('active');

  await loadMessengerConversations();
}

// Load Conversation List inside Messenger panel
async function loadMessengerConversations() {
  const container = document.getElementById('messenger-convs-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
      <i class="fa-solid fa-spinner fa-spin" style="color:var(--primary);"></i> Đang tải danh sách...
    </div>`;

  const res = await apiRequest('/chat/conversations');
  if (!res.success) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Không thể tải danh sách.</div>`;
    return;
  }

  const convs = res.conversations || [];
  if (convs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 14px; color:var(--text-muted);">
        <i class="fa-regular fa-comments" style="font-size:28px; color:var(--border); margin-bottom:8px; display:block;"></i>
        <div style="font-size:13px; font-weight:700; color:var(--text-main);">Chưa có đoạn chat nào</div>
        <p style="font-size:11.5px; margin:4px 0 0 0;">Bấm "Nhắn tin" trên bài đăng bất kỳ để bắt đầu trò chuyện!</p>
      </div>`;
    return;
  }

  container.innerHTML = convs.map(c => {
    const other = c.other_user || {};
    const avatar = other.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other.full_name || 'User')}&background=FF7A00&color=fff`;
    const lastMsg = c.last_message ? c.last_message.content : 'Bắt đầu cuộc trò chuyện...';
    const lastTime = c.last_message ? formatSocialTime(c.last_message.created_at) : '';
    const unread = c.unread_count || 0;
    const isActive = activeChatConversationId === c.id;
    const petTitle = c.adoption ? `Bé ${c.adoption.pet_name}` : 'Trò chuyện';

    return `
      <div class="messenger-conv-item ${isActive ? 'active' : ''}" onclick="selectMessengerConversation('${c.id}', '${escapeJs(other.full_name || 'Người dùng')}', '${escapeJs(avatar)}', '${escapeJs(petTitle)}')">
        <div class="messenger-avatar-wrap">
          <img class="messenger-avatar" src="${avatar}" alt="${other.full_name}" onerror="this.src='https://ui-avatars.com/api/?name=User&background=FF7A00&color=fff'">
          <span class="messenger-online-badge"></span>
        </div>
        <div class="messenger-conv-info">
          <div class="messenger-conv-name">${escapeHtml(other.full_name || 'Người dùng')}</div>
          <div class="messenger-conv-preview" style="${unread > 0 ? 'font-weight:700; color:var(--text-main);' : ''}">${escapeHtml(lastMsg)}</div>
        </div>
        <div class="messenger-conv-meta">
          <div class="messenger-conv-time">${lastTime}</div>
          ${unread > 0 ? `<span class="messenger-conv-unread">${unread}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Select a conversation from the list
async function selectMessengerConversation(convId, recipientName, recipientAvatar, petTitle) {
  activeChatConversationId = convId;

  // Set header
  const nameEl = document.getElementById('messenger-target-name');
  const subEl = document.getElementById('messenger-target-sub');
  const avatarEl = document.getElementById('messenger-target-avatar');

  if (nameEl) nameEl.innerText = recipientName;
  if (subEl) subEl.innerText = petTitle || 'Trò chuyện';
  if (avatarEl) avatarEl.src = recipientAvatar;

  // Switch to room view
  showMessengerRoomView();

  // Load messages
  await loadMessengerMessages(convId);

  // Focus input
  const inputEl = document.getElementById('messenger-chat-input');
  if (inputEl) inputEl.focus();
}

// Load and render message history
async function loadMessengerMessages(convId) {
  const msgContainer = document.getElementById('messenger-messages');
  if (!msgContainer) return;

  const res = await apiRequest(`/chat/conversations/${convId}/messages`);
  if (!res.success) {
    msgContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12.5px;">Lỗi tải tin nhắn.</div>`;
    return;
  }

  const currentUserId = window.currentUser?.id;
  const messages = res.messages || [];

  if (messages.length === 0) {
    msgContainer.innerHTML = `
      <div style="text-align:center; padding:40px 14px; color:var(--text-muted); font-size:13px;">
        <i class="fa-regular fa-comments" style="font-size:32px; color:var(--border); margin-bottom:8px; display:block;"></i>
        <div style="font-size:13.5px; font-weight:700; color:var(--text-main);">Chưa có tin nhắn</div>
        <p style="font-size:12px; margin:4px 0 0 0;">Hãy gửi tin nhắn đầu tiên để liên hệ nhé!</p>
      </div>`;
    return;
  }

  msgContainer.innerHTML = messages.map(m => {
    const isSent = m.sender_id === currentUserId;
    const time = formatSocialTime(m.created_at);
    return `
      <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
        <div>${escapeHtml(m.content)}</div>
        <div class="chat-bubble-time">${time}</div>
      </div>
    `;
  }).join('');

  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// Polling active messages without flashing
async function pollMessengerMessages() {
  if (!activeChatConversationId || isViewingConvList) return;
  const msgContainer = document.getElementById('messenger-messages');
  if (!msgContainer) return;

  const res = await apiRequest(`/chat/conversations/${activeChatConversationId}/messages`);
  if (!res.success) return;

  const currentUserId = window.currentUser?.id;
  const messages = res.messages || [];

  const currentBubbleCount = msgContainer.querySelectorAll('.chat-bubble').length;
  if (messages.length !== currentBubbleCount) {
    msgContainer.innerHTML = messages.map(m => {
      const isSent = m.sender_id === currentUserId;
      const time = formatSocialTime(m.created_at);
      return `
        <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
          <div>${escapeHtml(m.content)}</div>
          <div class="chat-bubble-time">${time}</div>
        </div>
      `;
    }).join('');
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

// Send Message
async function sendMessengerMessage(e) {
  if (e) e.preventDefault();
  if (!activeChatConversationId) return;

  const inputEl = document.getElementById('messenger-chat-input');
  const btnSend = document.getElementById('btn-send-messenger');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  if (btnSend) btnSend.disabled = true;

  // Optimistic UI render
  const msgContainer = document.getElementById('messenger-messages');
  if (msgContainer) {
    if (msgContainer.querySelector('.fa-comments')) {
      msgContainer.innerHTML = '';
    }
    const tempBubble = document.createElement('div');
    tempBubble.className = 'chat-bubble sent';
    tempBubble.innerHTML = `<div>${escapeHtml(text)}</div><div class="chat-bubble-time">Đang gửi...</div>`;
    msgContainer.appendChild(tempBubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  const res = await apiRequest(`/chat/conversations/${activeChatConversationId}/messages`, 'POST', {
    content: text
  });

  if (btnSend) btnSend.disabled = false;

  if (res.success) {
    await loadMessengerMessages(activeChatConversationId);
  } else {
    showToast(res.message || 'Không thể gửi tin nhắn.', 'error');
  }
}

// -----------------------------------------------------------------------------
// EXPORTS TO WINDOW
// -----------------------------------------------------------------------------
window.initAdoptionUI = initAdoptionUI;
window.expandSocialCreator = expandSocialCreator;
window.collapseSocialCreator = collapseSocialCreator;
window.handleSocialImageSelect = handleSocialImageSelect;
window.clearSocialImage = clearSocialImage;
window.filterSocialAdoptions = filterSocialAdoptions;
window.loadSocialFeed = loadSocialFeed;
window.openMessengerChat = openMessengerChat;
window.closeMessengerChat = closeMessengerChat;
window.toggleMessengerConversationsView = toggleMessengerConversationsView;
window.selectMessengerConversation = selectMessengerConversation;
window.sendMessengerMessage = sendMessengerMessage;
window.openEditAdoptionModal = openEditAdoptionModal;
window.submitEditAdoptionForm = submitEditAdoptionForm;
window.markAdoptionFound = markAdoptionFound;
window.deleteSocialPost = deleteSocialPost;
window.togglePostDropdown = togglePostDropdown;
