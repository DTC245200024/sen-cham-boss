/* =========================================================
   STORE & CHECKOUT MANAGEMENT – MODERN TIKTOK SHOP EXPERIENCE
   ========================================================= */

let storeAllProducts = [];
let storeCart = loadCartFromStorage();
let storeShopCategory = 'ALL';
let storeShopSearch = '';
let storeEditProductId = null;
let storeEditVoucherId = null;
let storeAdminProducts = [];
let storeAdminVouchers = [];
let storeDoctorProducts = [];
let storeAvailableVouchers = [];
let storeAppliedVoucher = null; // { code, name, discount_amount, voucher }
let storeShippingMethod = 'STANDARD'; // 'STANDARD' (30k) or 'EXPRESS' (45k)
let storeSelectedVariant = 'Mặc định';
let storeDirectCheckoutItem = null; // Used when user clicks "Mua ngay"
let storeMyOrdersStatusFilter = 'ALL';
let storeAdminOrdersStatusFilter = 'ALL';
let storeDoctorOrdersStatusFilter = 'ALL';
let storeAdminProdApprovalFilter = 'ALL';
let storeConfig = { shipping_fee: 30000, express_fee: 45000, bank_name: 'Vietcombank', bank_account: '1234567890', bank_holder: 'SEN CHAM BOSS', bank_branch: 'Chi nhánh TP.HCM' };

const CATEGORIES = ['Thức ăn', 'Phụ kiện', 'Vệ sinh', 'Thuốc & Bổ sung', 'Khác'];

const ORDER_STATUS_MAP = {
  PENDING:   { text: 'Chờ xác nhận', cls: 'badge-warning' },
  CONFIRMED: { text: 'Đã xác nhận',  cls: 'badge-info' },
  SHIPPING:  { text: 'Đang giao',    cls: 'badge-primary' },
  DELIVERED: { text: 'Đã giao',      cls: 'badge-secondary' },
  COMPLETED: { text: 'Hoàn thành',   cls: 'badge-success' },
  CANCELLED: { text: 'Đã hủy',       cls: 'badge-danger' }
};

const APPROVAL_STATUS_MAP = {
  PENDING_APPROVAL: { text: 'Chờ duyệt', cls: 'badge-warning' },
  APPROVED:         { text: 'Đã duyệt',  cls: 'badge-success' },
  REJECTED:         { text: 'Từ chối',   cls: 'badge-danger' }
};

const PAYMENT_STATUS_MAP = {
  PENDING:         { text: 'Chưa thanh toán', cls: 'badge-warning' },
  PENDING_PAYMENT: { text: 'Chờ thanh toán',  cls: 'badge-warning' },
  PAID:            { text: 'Đã thanh toán',   cls: 'badge-success' },
  FAILED:          { text: 'Thanh toán lỗi',  cls: 'badge-danger' },
  CANCELLED:       { text: 'Đã hủy GD',       cls: 'badge-secondary' },
  COD_PENDING:     { text: 'COD / Chưa trả',  cls: 'badge-info' },
  UNPAID:          { text: 'Chưa thanh toán', cls: 'badge-warning' }
};

/* ─── CART PERSISTENCE ─── */
function loadCartFromStorage() {
  try { return JSON.parse(sessionStorage.getItem('petcare_cart') || '[]'); } catch { return []; }
}
function saveCartToStorage() {
  sessionStorage.setItem('petcare_cart', JSON.stringify(storeCart));
}

/* ─── CART BADGE (sidebar) ─── */
function updateSidebarCartBadge() {
  const total = storeCart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('sidebar-cart-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

/* ─── INIT ─── */
async function initStoreUI() {
  await fetchStoreConfig();
  updateSidebarCartBadge();
}

async function fetchStoreConfig() {
  try {
    const res = await apiRequest('/store/config');
    if (res.success) storeConfig = res.config;
  } catch {}
}

/* ─── ROUTER: switchView hooked from app.js ─── */
function onStoreViewSwitch(viewName) {
  switch (viewName) {
    case 'store-shop':        renderShopView(); break;
    case 'store-cart':        renderCartView(); break;
    case 'store-checkout':    renderCheckoutView(); break;
    case 'store-orders':      renderMyOrdersView(); break;
    case 'admin-products':    renderAdminProductsView(); break;
    case 'admin-orders':      renderAdminOrdersView(); break;
    case 'admin-vouchers':    renderAdminVouchersView(); break;
    case 'doctor-products':   renderDoctorProductsView(); break;
    case 'doctor-orders':     renderDoctorOrdersView(); break;
  }
}

/* ════════════════════════════════════════════════════════
   VIEW 1: SHOP – Browse & Add to Cart
════════════════════════════════════════════════════════ */
async function renderShopView() {
  const container = document.getElementById('view-store-shop');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <div>
        <h2 class="store-page-title">Cửa hàng thú cưng</h2>
        <p class="store-page-sub">Sản phẩm chính hãng và phụ kiện thú cưng chất lượng cao</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="store-filter-bar">
      <div class="store-search-box">
        <i class="fa-solid fa-magnifying-glass store-search-icon"></i>
        <input type="text" id="shop-search" class="form-control" placeholder="Tìm kiếm sản phẩm, người bán..." value="${storeShopSearch}" oninput="onShopSearch(this.value)">
      </div>
      <div class="store-cat-pills" id="shop-cat-pills">
        <button class="cat-pill ${storeShopCategory === 'ALL' ? 'active' : ''}" onclick="setShopCategory('ALL')">Tất cả</button>
        ${CATEGORIES.map(c => `<button class="cat-pill ${storeShopCategory === c ? 'active' : ''}" onclick="setShopCategory('${c}')">${c}</button>`).join('')}
      </div>
    </div>

    <!-- Product Grid -->
    <div id="shop-products-grid" class="store-products-grid">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách sản phẩm...</div>
    </div>
  `;

  await loadShopProducts();
}

async function loadShopProducts() {
  const grid = document.getElementById('shop-products-grid');
  try {
    const res = await apiRequest('/store/products');
    if (!res.success) {
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1; padding:40px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải danh sách sản phẩm</p>
            <p style="color:var(--text-muted); margin-bottom:16px;">${res.message || 'Lỗi kết nối máy chủ.'}</p>
            <button class="btn btn-primary btn-sm" onclick="loadShopProducts()">Thử lại</button>
          </div>`;
      }
      return;
    }
    storeAllProducts = res.products || [];
    renderShopGrid();
  } catch (err) {
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1; padding:40px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi tải dữ liệu sản phẩm</p>
          <button class="btn btn-primary btn-sm" onclick="loadShopProducts()">Thử lại</button>
        </div>`;
    }
  }
}

function renderShopGrid() {
  const grid = document.getElementById('shop-products-grid');
  if (!grid) return;

  let filtered = storeAllProducts;
  if (storeShopCategory !== 'ALL') filtered = filtered.filter(p => p.category === storeShopCategory);
  if (storeShopSearch) {
    const s = storeShopSearch.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.product_code || '').toLowerCase().includes(s) ||
      (p.description || '').toLowerCase().includes(s) ||
      (p.doctor_name || '').toLowerCase().includes(s)
    );
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:40px; text-align:center; background:#fff; border-radius:10px; border:1px solid var(--border);">
        <i class="fa-solid fa-box-open" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i>
        <p style="font-size:16px; font-weight:700; color:var(--text-color); margin-bottom:8px;">Chưa có sản phẩm nào</p>
        <p style="color:var(--text-muted); margin-bottom:16px;">Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.</p>
        <button class="btn btn-outline btn-sm" onclick="setShopCategory('ALL'); document.getElementById('shop-search').value=''; onShopSearch('');">Xem tất cả sản phẩm</button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const inCart = storeCart.find(i => i.product_id === p.id);
    const cartQty = inCart ? inCart.quantity : 0;
    const outOfStock = p.stock <= 0;
    const lowStock = p.stock > 0 && p.stock <= 5;
    const seller = p.doctor_name || 'Sen Chăm Boss';
    const originalPrice = p.original_price || Math.round(p.price * 1.25);

    return `
      <div class="product-card" onclick="openProductDetailModal('${p.id}')">
        <div class="product-card-img">
          ${p.image_url
            ? `<img src="${p.image_url}" alt="${escHtml(p.name)}" onerror="this.parentElement.innerHTML='<div class=product-card-img-placeholder><i class="fa-solid fa-paw"></i></div>'">`
            : `<div class="product-card-img-placeholder"><i class="fa-solid fa-paw"></i></div>`}
          ${outOfStock ? `<span class="product-badge-out">Hết hàng</span>` : ''}
          ${lowStock ? `<span class="product-badge-low">Sắp hết</span>` : ''}
        </div>
        <div class="product-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span class="badge badge-secondary" style="font-size:10px;">${p.category}</span>
            <span style="font-size:11px; color:#f59e0b; font-weight:700;"><i class="fa-solid fa-star"></i> 4.9 (${p.sold_count || 120})</span>
          </div>
          <h4 class="product-card-name" title="${escHtml(p.name)}">${escHtml(p.name)}</h4>
          <div style="font-size:12px; color:var(--primary); font-weight:600; margin-bottom:6px;">
            <i class="fa-solid fa-user-doctor"></i> ${escHtml(seller)}
          </div>
          <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
            <span class="product-price">${p.price.toLocaleString('vi-VN')} ₫</span>
            <span style="font-size:11px; color:var(--text-light); text-decoration:line-through;">${originalPrice.toLocaleString('vi-VN')} ₫</span>
          </div>
          <div class="product-card-btns" onclick="event.stopPropagation()" style="display: flex; gap: 6px; margin-top: auto; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" style="flex: 1; padding: 6px 4px; font-size: 12px;" onclick="openProductDetailModal('${p.id}')">Chi tiết</button>
            <button class="btn btn-primary btn-sm" style="flex: 1; padding: 6px 4px; font-size: 12px;" onclick="quickAddToCart('${p.id}')" ${outOfStock ? 'disabled' : ''}>
              ${outOfStock ? 'Hết' : cartQty > 0 ? `<i class="fa-solid fa-cart-shopping"></i> (${cartQty})` : '<i class="fa-solid fa-cart-plus"></i> Thêm'}
            </button>
            <button class="btn btn-warning btn-sm" style="flex: 1.2; padding: 6px 4px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; border: none;" onclick="buyNow('${p.id}')" ${outOfStock ? 'disabled' : ''}>
              <i class="fa-solid fa-bolt"></i> Mua ngay
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function onShopSearch(val) {
  storeShopSearch = val;
  renderShopGrid();
}
function setShopCategory(cat) {
  storeShopCategory = cat;
  document.querySelectorAll('#shop-cat-pills .cat-pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === (cat === 'ALL' ? 'Tất cả' : cat)));
  renderShopGrid();
}

/* ─── Product Detail Modal (TikTok Shop Style) ─── */
function openProductDetailModal(productId) {
  const p = storeAllProducts.find(x => x.id === productId);
  if (!p) return;

  const inCart = storeCart.find(i => i.product_id === productId);
  const cartQty = inCart ? inCart.quantity : 0;
  const outOfStock = p.stock <= 0;
  const seller = p.doctor_name || 'Sen Chăm Boss';
  const originalPrice = p.original_price || Math.round(p.price * 1.25);
  const discountPercent = Math.round(((originalPrice - p.price) / originalPrice) * 100);

  let modal = document.getElementById('modal-product-detail-store');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-product-detail-store';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:760px; max-height:92vh; overflow-y:auto; border-radius:16px; padding:0;">
      <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:17px; font-weight:800; margin:0;">Chi tiết sản phẩm</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-product-detail-store').classList.remove('active')">&times;</button>
      </div>

      <div class="tk-product-detail-layout">
        <!-- Gallery Column -->
        <div class="tk-gallery-box">
          <div class="tk-main-image-wrap">
            ${p.image_url
              ? `<img id="tk-detail-main-img" src="${p.image_url}" alt="${escHtml(p.name)}" onerror="this.parentElement.innerHTML='<div style=font-size:64px;text-align:center;padding:40px><i class="fa-solid fa-paw"></i></div>'">`
              : `<div style="font-size:64px; text-align:center; padding:40px;"><i class="fa-solid fa-paw"></i></div>`}
          </div>
          <div class="tk-thumb-row">
            <div class="tk-thumb-item active" onclick="switchDetailThumbnail('${p.image_url}', this)">
              ${p.image_url ? `<img src="${p.image_url}">` : '<i class="fa-solid fa-paw"></i>'}
            </div>
            <div class="tk-thumb-item" onclick="switchDetailThumbnail('https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400', this)">
              <img src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400">
            </div>
            <div class="tk-thumb-item" onclick="switchDetailThumbnail('https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400', this)">
              <img src="https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400">
            </div>
          </div>
        </div>

        <!-- Info Column -->
        <div class="tk-info-box">
          <div style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-bottom:4px;">Mã: ${p.product_code || 'N/A'}</div>
          <h2 style="font-size:18px; font-weight:800; line-height:1.4; margin-bottom:6px; color:var(--text-main);">${escHtml(p.name)}</h2>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:13px; margin-bottom:10px;">
            <span style="color:#f59e0b; font-weight:700;"><i class="fa-solid fa-star"></i> 4.9</span>
            <span style="color:var(--text-light);">|</span>
            <span style="color:var(--text-muted);">Đã bán ${p.sold_count || '1.2k'}</span>
            <span style="color:var(--text-light);">|</span>
            <span style="color:var(--success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> Chính hãng 100%</span>
          </div>

          <!-- Price Row -->
          <div class="tk-price-box">
            <span class="tk-current-price">${p.price.toLocaleString('vi-VN')} ₫</span>
            <span class="tk-original-price">${originalPrice.toLocaleString('vi-VN')} ₫</span>
            <span class="tk-discount-tag">-${discountPercent}%</span>
          </div>

          <!-- Promo Badges -->
          <div class="tk-promo-badges">
            <span class="tk-promo-pill voucher"><i class="fa-solid fa-ticket"></i> Voucher giảm 20%</span>
            <span class="tk-promo-pill freeship"><i class="fa-solid fa-truck-fast"></i> Freeship từ 150K</span>
            <span class="tk-promo-pill guarantee"><i class="fa-solid fa-rotate-left"></i> Đổi trả 7 ngày</span>
          </div>

          <!-- Seller Info Card -->
          <div class="tk-seller-card">
            <div class="tk-seller-info">
              <div class="tk-seller-avatar"><i class="fa-solid fa-user-doctor"></i></div>
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--text-main);">${escHtml(seller)}</div>
                <div style="font-size:11px; color:var(--text-muted);"><i class="fa-solid fa-shield-check" style="color:var(--success);"></i> Đã kiểm định chất lượng</div>
              </div>
            </div>
            <span class="badge badge-info" style="font-size:11px;">Chính Hãng</span>
          </div>

          <!-- Variants Selection -->
          <div class="tk-variant-group">
            <div class="tk-variant-label">Dành cho & Quy cách:</div>
            <div class="tk-variant-chips" id="tk-detail-variants">
              <button type="button" class="tk-chip-btn active" onclick="selectDetailVariant('Cho Mèo', this)">Cho Mèo</button>
              <button type="button" class="tk-chip-btn" onclick="selectDetailVariant('Cho Chó', this)">Cho Chó</button>
              <button type="button" class="tk-chip-btn" onclick="selectDetailVariant('Hộp 250g', this)">Hộp 250g</button>
              <button type="button" class="tk-chip-btn" onclick="selectDetailVariant('Hộp 500g', this)">Hộp 500g</button>
            </div>
          </div>

          <!-- Quantity Stepper -->
          <div class="qty-selector-row" style="margin:16px 0;">
            <label style="font-size:13px; font-weight:700; margin-right:10px;">Số lượng:</label>
            <div class="qty-ctrl-wrap">
              <button type="button" class="qty-ctrl-btn" onclick="changeDetailQty(-1, ${p.stock})">−</button>
              <input type="number" id="detail-qty-input" value="${Math.max(1, cartQty || 1)}" min="1" max="${p.stock}" class="qty-ctrl-input">
              <button type="button" class="qty-ctrl-btn" onclick="changeDetailQty(1, ${p.stock})">+</button>
            </div>
            <span style="font-size:12px; color:var(--text-muted); margin-left:10px;">(Còn ${p.stock} sản phẩm)</span>
          </div>

          <!-- Sticky Bottom Buttons -->
          ${!outOfStock ? `
            <div style="display:flex; gap:10px; margin-top:20px;">
              <button class="btn btn-outline" style="flex:1; padding:12px; font-weight:700;" onclick="addToCartFromDetail('${p.id}', ${p.stock})">
                <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ
              </button>
              <button class="btn btn-primary" style="flex:1.2; padding:12px; font-weight:800; background:linear-gradient(135deg, #f97316, #ea580c); border:none;" onclick="buyNowFromDetail('${p.id}', ${p.stock})">
                <i class="fa-solid fa-bolt"></i> Mua ngay
              </button>
            </div>
          ` : `<div class="btn btn-outline" style="width:100%; text-align:center; cursor:not-allowed; opacity:0.6; margin-top:16px;">Sản phẩm đã hết hàng</div>`}
        </div>
      </div>

      <!-- Description & Detail Tabs -->
      <div style="padding:16px 20px; border-top:1px solid var(--border); background:#f8fafc;">
        <h4 style="font-size:14px; font-weight:800; margin-bottom:8px; color:var(--text-main);">Mô tả & Hướng dẫn sử dụng</h4>
        <div style="font-size:13px; line-height:1.7; color:var(--text-main); white-space:pre-wrap;">${escHtml(p.description || p.detail || 'Sản phẩm chính hãng chất lượng cao dành cho thú cưng.')}</div>
      </div>
    </div>`;

  setTimeout(() => modal.classList.add('active'), 10);
}

function switchDetailThumbnail(url, el) {
  const mainImg = document.getElementById('tk-detail-main-img');
  if (mainImg) mainImg.src = url;
  document.querySelectorAll('.tk-thumb-item').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function selectDetailVariant(variantName, el) {
  storeSelectedVariant = variantName;
  document.querySelectorAll('#tk-detail-variants .tk-chip-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function changeDetailQty(delta, maxStock) {
  const input = document.getElementById('detail-qty-input');
  if (!input) return;
  let val = parseInt(input.value) + delta;
  val = Math.max(1, Math.min(maxStock, val));
  input.value = val;
}

function addToCartFromDetail(productId, maxStock) {
  const qty = parseInt(document.getElementById('detail-qty-input')?.value) || 1;
  addToCart(productId, qty, maxStock);
  document.getElementById('modal-product-detail-store')?.classList.remove('active');
  showToast('Đã thêm vào giỏ hàng!', 'success');
}

function buyNow(productId, quantity = 1) {
  const prod = storeAllProducts.find(p => p.id === productId);
  if (!prod || prod.stock <= 0) {
    showToast('Sản phẩm đã hết hàng!', 'error');
    return;
  }
  const qty = Math.min(Math.max(1, parseInt(quantity) || 1), prod.stock);

  // Setup direct checkout session
  storeDirectCheckoutItem = {
    product_id: prod.id,
    product_code: prod.product_code,
    name: prod.name,
    doctor_name: prod.doctor_name || 'Sen Chăm Boss',
    image_url: prod.image_url,
    price: prod.price,
    quantity: qty,
    variant: storeSelectedVariant || 'Tiêu chuẩn',
    subtotal: prod.price * qty,
    max_stock: prod.stock
  };

  document.getElementById('modal-product-detail-store')?.classList.remove('active');
  switchView('store-checkout');
  showToast(`Đang chuyển đến trang đặt hàng cho "${prod.name}"...`, 'info');
}

function buyNowFromDetail(productId, maxStock) {
  const qtyInput = document.getElementById('detail-qty-input');
  const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
  buyNow(productId, qty);
}

function quickAddToCart(productId) {
  const prod = storeAllProducts.find(p => p.id === productId);
  if (!prod || prod.stock <= 0) {
    showToast('Sản phẩm đã hết hàng!', 'error');
    return;
  }
  addToCart(productId, 1, prod.stock);
  showToast(`Đã thêm "${prod.name}" vào giỏ!`, 'success');
  renderShopGrid();
}

function addToCart(productId, qty = 1, maxStock) {
  const prod = storeAllProducts.find(p => p.id === productId);
  if (!prod) return;
  const stock = maxStock !== undefined ? maxStock : prod.stock;

  const existing = storeCart.find(i => i.product_id === productId);
  if (existing) {
    const newQty = existing.quantity + qty;
    if (newQty > stock) {
      showToast(`Chỉ còn ${stock} sản phẩm trong kho!`, 'error');
      return;
    }
    existing.quantity = newQty;
    existing.subtotal = existing.price * existing.quantity;
  } else {
    storeCart.push({
      product_id: prod.id,
      product_code: prod.product_code,
      name: prod.name,
      doctor_name: prod.doctor_name || 'Sen Chăm Boss',
      variant: storeSelectedVariant || 'Tiêu chuẩn',
      image_url: prod.image_url,
      price: prod.price,
      quantity: qty,
      subtotal: prod.price * qty,
      max_stock: stock
    });
  }
  saveCartToStorage();
  updateSidebarCartBadge();
}

/* ════════════════════════════════════════════════════════
   VIEW 2: CART – Shopping Cart Page
════════════════════════════════════════════════════════ */
function renderCartView() {
  const container = document.getElementById('view-store-cart');
  if (!container) return;

  const shippingFee = storeConfig.shipping_fee || 30000;
  const subtotal = storeCart.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal + (storeCart.length > 0 ? shippingFee : 0);
  const totalItems = storeCart.reduce((s, i) => s + i.quantity, 0);

  if (!storeCart.length) {
    container.innerHTML = `
      <div class="store-page-header" style="margin-bottom:20px;">
        <h2 class="store-page-title"><i class="fa-solid fa-cart-shopping"></i> Giỏ hàng</h2>
      </div>
      <div class="empty-state" style="text-align:center; padding:60px 20px; background:#fff; border-radius:14px; box-shadow:0 2px 8px rgba(0,0,0,0.03); border:1px solid var(--border);">
        <div style="font-size:64px; color:var(--primary); margin-bottom:16px; opacity:0.8;"><i class="fa-solid fa-cart-shopping"></i></div>
        <h3 style="font-size:20px; font-weight:700; margin-bottom:8px; color:var(--text-color);">Giỏ hàng của bạn đang trống</h3>
        <p style="color:var(--text-muted); margin-bottom:24px; font-size:14px;">Hãy khám phá các sản phẩm chăm sóc thú cưng chất lượng cao của chúng tôi.</p>
        <button class="btn btn-primary" style="padding:10px 24px; font-size:15px;" onclick="switchView('store-shop')">Tiếp tục mua sắm</button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="store-page-header" style="margin-bottom:20px;">
      <h2 class="store-page-title"><i class="fa-solid fa-cart-shopping"></i> Giỏ hàng (${totalItems} sản phẩm)</h2>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start;">
      <!-- Product List -->
      <div style="flex:1; min-width:300px; display:flex; flex-direction:column; gap:16px;">
        ${storeCart.map((item, idx) => `
          <div style="display:flex; align-items:center; gap:16px; padding:16px; background:#fff; border-radius:14px; border:1px solid var(--border); box-shadow:0 2px 4px rgba(0,0,0,0.02); flex-wrap:wrap;">
            <div style="width:85px; height:85px; flex-shrink:0; border-radius:10px; overflow:hidden; border:1px solid var(--border); display:flex; justify-content:center; align-items:center; background:#f9fafb;">
              ${item.image_url 
                ? `<img src="${item.image_url}" alt="${escHtml(item.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">` 
                : `<i class="fa-solid fa-box" style="font-size:32px; color:var(--text-muted);"></i>`}
            </div>
            
            <div style="flex:1; min-width:200px;">
              <div style="font-size:15px; font-weight:700; color:var(--text-color); margin-bottom:4px;">${escHtml(item.name)}</div>
              <div style="font-size:12px; color:var(--primary); font-weight:600; margin-bottom:4px;">
                <i class="fa-solid fa-user-doctor"></i> Người bán: ${escHtml(item.doctor_name || 'Sen Chăm Boss')}
              </div>
              <div style="font-size:14px; font-weight:600; color:var(--text-muted);">${item.price.toLocaleString('vi-VN')} ₫</div>
            </div>

            <div style="display:flex; align-items:center; gap:16px; margin-left:auto;">
              <div class="qty-ctrl-wrap">
                <button type="button" class="qty-ctrl-btn" onclick="changeCartItemQty(${idx}, -1)">−</button>
                <input type="number" class="qty-ctrl-input" value="${item.quantity}" min="1" max="${item.max_stock || 999}" onchange="setCartItemQty(${idx}, this.value)">
                <button type="button" class="qty-ctrl-btn" onclick="changeCartItemQty(${idx}, 1)">+</button>
              </div>

              <div style="font-weight:800; color:var(--primary); font-size:16px; min-width:110px; text-align:right;">
                ${item.subtotal.toLocaleString('vi-VN')} ₫
              </div>

              <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); padding:6px 10px;" onclick="removeCartItem(${idx})" title="Xóa khỏi giỏ">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Order Summary Card -->
      <div style="width:340px; background:#fff; border-radius:14px; padding:20px; border:1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <h3 style="font-size:16px; font-weight:800; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:10px;">Tóm tắt đơn hàng</h3>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px;">
          <span style="color:var(--text-muted);">Tạm tính:</span>
          <strong>${subtotal.toLocaleString('vi-VN')} ₫</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-size:14px;">
          <span style="color:var(--text-muted);">Phí vận chuyển:</span>
          <strong>${shippingFee.toLocaleString('vi-VN')} ₫</strong>
        </div>
        <div style="border-top:1px solid var(--border); margin:12px 0;"></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:16px; font-weight:800;">
          <span>Tổng thanh toán:</span>
          <span style="color:var(--primary); font-size:20px; font-weight:900;">${total.toLocaleString('vi-VN')} ₫</span>
        </div>
        <button class="btn btn-primary" style="width:100%; padding:12px; font-size:16px; font-weight:700;" onclick="proceedToCheckoutFromCart()">
          Tiến hành thanh toán <i class="fa-solid fa-arrow-right" style="margin-left:6px;"></i>
        </button>
        <button class="btn btn-outline" style="width:100%; margin-top:8px; padding:8px;" onclick="switchView('store-shop')">
          Tiếp tục mua hàng
        </button>
      </div>
    </div>`;
}

function proceedToCheckoutFromCart() {
  storeDirectCheckoutItem = null; // Use entire cart
  switchView('store-checkout');
}

function changeCartItemQty(idx, delta) {
  if (!storeCart[idx]) return;
  const newQty = storeCart[idx].quantity + delta;
  const maxStock = storeCart[idx].max_stock || 999;
  if (newQty < 1) {
    removeCartItem(idx);
    return;
  }
  if (newQty > maxStock) {
    showToast(`Chỉ còn ${maxStock} sản phẩm trong kho!`, 'error');
    return;
  }
  storeCart[idx].quantity = newQty;
  storeCart[idx].subtotal = storeCart[idx].price * newQty;
  saveCartToStorage();
  updateSidebarCartBadge();
  renderCartView();
}

function setCartItemQty(idx, val) {
  if (!storeCart[idx]) return;
  let qty = parseInt(val) || 1;
  const maxStock = storeCart[idx].max_stock || 999;
  qty = Math.max(1, Math.min(maxStock, qty));
  storeCart[idx].quantity = qty;
  storeCart[idx].subtotal = storeCart[idx].price * qty;
  saveCartToStorage();
  updateSidebarCartBadge();
  renderCartView();
}

function removeCartItem(idx) {
  if (!storeCart[idx]) return;
  const name = storeCart[idx].name;
  storeCart.splice(idx, 1);
  saveCartToStorage();
  updateSidebarCartBadge();
  renderCartView();
  showToast(`Đã xóa "${name}" khỏi giỏ hàng.`, 'info');
}

/* ════════════════════════════════════════════════════════
   VIEW 3: DEDICATED TIKTOK SHOP STYLE CHECKOUT VIEW
════════════════════════════════════════════════════════ */
async function renderCheckoutView() {
  const container = document.getElementById('view-store-checkout');
  if (!container) return;

  // Determine checkout items: direct "Mua ngay" item or entire cart
  const checkoutItems = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;

  if (!checkoutItems.length) {
    switchView('store-shop');
    return;
  }

  const user = window.currentUser || {};
  const subtotal = checkoutItems.reduce((s, i) => s + i.subtotal, 0);
  const baseShippingFee = storeShippingMethod === 'EXPRESS' ? (storeConfig.express_fee || 45000) : (storeConfig.shipping_fee || 30000);
  const discountAmount = storeAppliedVoucher ? storeAppliedVoucher.discount_amount : 0;
  const totalAmount = Math.max(0, subtotal + baseShippingFee - discountAmount);

  const hasAddress = !!(user.address && user.address.trim() && user.phone && user.phone.trim());

  // Default payment method
  if (!window.storeSelectedPaymentMethod) window.storeSelectedPaymentMethod = 'COD';

  container.innerHTML = `
    <div class="tiktok-checkout-wrap">
      <!-- Top Return Bar / Header -->
      <div class="tiktok-checkout-header">
        <button type="button" class="btn btn-outline btn-sm" onclick="switchView('store-shop')" style="padding:6px 14px; font-weight:700;">
          <i class="fa-solid fa-arrow-left"></i> Tiếp tục mua hàng
        </button>
        <h2 style="font-size:19px; font-weight:800; margin:0; color:var(--text-main);">Đặt hàng & Thanh toán</h2>
      </div>

      <div class="tiktok-checkout-grid">
        <!-- CỘT TRÁI (~70%): Thông tin đơn hàng & Các bước -->
        <div>
          
          <!-- 1. ĐỊA CHỈ NHẬN HÀNG -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-location-dot"></i> Địa chỉ nhận hàng
              </div>
              ${hasAddress ? `
                <button type="button" class="btn btn-outline btn-sm" style="font-size:12px; padding:4px 12px; font-weight:700;" onclick="openAddressModal()">
                  Thay đổi
                </button>
              ` : ''}
            </div>

            ${hasAddress ? `
              <div class="tk-address-item">
                <div class="tk-address-icon"><i class="fa-solid fa-house"></i></div>
                <div class="tk-address-details">
                  <div class="tk-address-user">${escHtml(user.full_name || 'Khách hàng')} · <strong>${escHtml(user.phone || '')}</strong></div>
                  <div class="tk-address-text"><i class="fa-solid fa-map-pin" style="color:var(--primary); font-size:12px; margin-right:4px;"></i>${escHtml(user.address || '')}</div>
                </div>
              </div>
            ` : `
              <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="color:#b91c1c; font-weight:700; font-size:13px;">
                  <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i> Chưa có địa chỉ nhận hàng. Vui lòng thêm địa chỉ để tiếp tục!
                </div>
                <button type="button" class="btn btn-primary btn-sm" style="padding:6px 14px; font-weight:700;" onclick="openAddressModal()">
                  + Thêm địa chỉ
                </button>
              </div>
            `}
          </div>

          <!-- 2. SẢN PHẨM -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-bag-shopping"></i> Sản phẩm (${checkoutItems.length})
              </div>
            </div>

            <div style="display:flex; flex-direction:column;">
              ${checkoutItems.map((item, idx) => `
                <div class="tk-checkout-item">
                  <div class="tk-checkout-img">
                    ${item.image_url ? `<img src="${item.image_url}" alt="${escHtml(item.name)}" onerror="this.outerHTML='<i class="fa-solid fa-paw"></i>'">` : '<i class="fa-solid fa-paw"></i>'}
                  </div>
                  <div class="tk-checkout-info">
                    <div class="tk-checkout-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
                    <div class="tk-checkout-seller"><i class="fa-solid fa-user-doctor"></i> ${escHtml(item.doctor_name || 'Sen Chăm Boss')}</div>
                    ${item.variant ? `<span class="tk-checkout-variant-tag">${escHtml(item.variant)}</span>` : ''}
                    <div class="tk-checkout-price">Giá: ${item.price.toLocaleString('vi-VN')} ₫</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div class="qty-ctrl-wrap">
                      <button type="button" class="qty-ctrl-btn" onclick="changeCheckoutItemQty(${idx}, -1)">−</button>
                      <input type="number" class="qty-ctrl-input" value="${item.quantity}" min="1" max="${item.max_stock || 999}" onchange="setCheckoutItemQty(${idx}, this.value)">
                      <button type="button" class="qty-ctrl-btn" onclick="changeCheckoutItemQty(${idx}, 1)">+</button>
                    </div>
                    <div class="tk-checkout-subtotal">
                      ${item.subtotal.toLocaleString('vi-VN')} ₫
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 3. PHƯƠNG THỨC VẬN CHUYỂN -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-truck-fast"></i> Phương thức vận chuyển
              </div>
            </div>

            <div class="tk-radio-card ${storeShippingMethod === 'STANDARD' ? 'active' : ''}" onclick="selectShippingMethod('STANDARD')">
              <div class="tk-radio-left">
                <input type="radio" name="shipping-method" value="STANDARD" ${storeShippingMethod === 'STANDARD' ? 'checked' : ''}>
                <div>
                  <div class="tk-radio-title">Giao hàng tiêu chuẩn</div>
                  <div class="tk-radio-sub"><i class="fa-regular fa-clock"></i> Dự kiến nhận hàng 3 - 5 ngày</div>
                </div>
              </div>
              <div class="tk-radio-price">30.000 ₫</div>
            </div>

            <div class="tk-radio-card ${storeShippingMethod === 'EXPRESS' ? 'active' : ''}" onclick="selectShippingMethod('EXPRESS')">
              <div class="tk-radio-left">
                <input type="radio" name="shipping-method" value="EXPRESS" ${storeShippingMethod === 'EXPRESS' ? 'checked' : ''}>
                <div>
                  <div class="tk-radio-title">Giao hàng nhanh <i class="fa-solid fa-bolt"></i></div>
                  <div class="tk-radio-sub"><i class="fa-regular fa-clock"></i> Dự kiến nhận hàng 1 - 2 ngày</div>
                </div>
              </div>
              <div class="tk-radio-price">45.000 ₫</div>
            </div>
          </div>

          <!-- 4. VOUCHER (CARD RIÊNG BIỆT) -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-ticket"></i> Voucher
              </div>
            </div>

            <!-- Input Form -->
            <div class="tk-voucher-input-row">
              <input type="text" id="chk-voucher-code-input" class="form-control" placeholder="Nhập mã voucher (FREESHIP, BOSS20...)" value="${storeAppliedVoucher ? storeAppliedVoucher.code : ''}">
              <button type="button" class="btn btn-primary" style="padding:8px 18px; font-weight:700;" onclick="handleApplyVoucherInput()">Áp dụng</button>
            </div>

            <!-- Active Voucher (if any) -->
            ${storeAppliedVoucher ? `
              <div class="tk-active-voucher-box">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i class="fa-solid fa-circle-check" style="color:#059669; font-size:16px;"></i>
                  <div>
                    <strong style="color:#047857;">✓ Đang áp dụng: ${escHtml(storeAppliedVoucher.code)}</strong>
                    <div style="font-size:12px; color:#065f46;">${escHtml(storeAppliedVoucher.name)} (-${storeAppliedVoucher.discount_amount.toLocaleString('vi-VN')} ₫)</div>
                  </div>
                </div>
                <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); font-size:11px; padding:3px 10px;" onclick="removeVoucherCode()">
                  Bỏ
                </button>
              </div>
            ` : ''}

            <!-- Available Vouchers List -->
            <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin:10px 0 8px 0;">Voucher khả dụng</div>
            <div class="tk-avail-vouchers-grid">
              ${(storeAvailableVouchers.length ? storeAvailableVouchers : [
                { code: 'FREESHIP', name: 'Miễn phí vận chuyển', discount_type: 'FIXED', discount_value: 30000, minimum_order_value: 150000 },
                { code: 'BOSS20', name: 'Giảm 20% tối đa 50k', discount_type: 'PERCENT', discount_value: 20, maximum_discount: 50000, minimum_order_value: 200000 },
                { code: 'SEN50K', name: 'Giảm 50.000 ₫', discount_type: 'FIXED', discount_value: 50000, minimum_order_value: 300000 },
                { code: 'CHAOBANMOI', name: 'Giảm 15% tối đa 30k', discount_type: 'PERCENT', discount_value: 15, maximum_discount: 30000, minimum_order_value: 100000 }
              ]).map(v => {
                const isSelected = storeAppliedVoucher && storeAppliedVoucher.code === v.code;
                const desc = v.discount_type === 'PERCENT'
                  ? `Giảm ${v.discount_value}% ${v.maximum_discount ? `(Tối đa ${v.maximum_discount.toLocaleString('vi-VN')} ₫)` : ''}`
                  : `Giảm ${v.discount_value.toLocaleString('vi-VN')} ₫`;

                return `
                  <div class="tk-voucher-chip-card ${isSelected ? 'active' : ''}">
                    <div>
                      <div style="font-weight:800; font-size:13px; font-family:monospace; color:var(--primary);">${escHtml(v.code)}</div>
                      <div style="font-size:12px; font-weight:700; color:var(--text-main);">${desc}</div>
                      <div style="font-size:11px; color:var(--text-muted);">Đơn từ ${(v.minimum_order_value || 0).toLocaleString('vi-VN')} ₫</div>
                    </div>
                    <div>
                      ${isSelected ? `
                        <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); font-size:11px; padding:3px 8px;" onclick="removeVoucherCode()">Bỏ</button>
                      ` : `
                        <button type="button" class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 10px; font-weight:700; color:var(--primary); border-color:var(--primary);" onclick="selectVoucherCode('${v.code}')">Áp dụng</button>
                      `}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <!-- 5. PHƯƠNG THỨC THANH TOÁN -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-wallet"></i> Phương thức thanh toán
              </div>
            </div>

            <!-- COD Radio -->
            <div class="tk-radio-card ${window.storeSelectedPaymentMethod === 'COD' ? 'active' : ''}" id="card-pay-cod" onclick="selectPaymentMethodRadio('COD')">
              <div class="tk-radio-left">
                <input type="radio" name="chk-pay-method-opt" value="COD" ${window.storeSelectedPaymentMethod === 'COD' ? 'checked' : ''}>
                <div>
                  <div class="tk-radio-title"><i class="fa-solid fa-hand-holding-dollar" style="color:#16a34a;"></i> Thanh toán khi nhận hàng (COD)</div>
                  <div class="tk-radio-sub">Thanh toán bằng tiền mặt khi shipper giao tới tận nhà</div>
                </div>
              </div>
            </div>

            <!-- Online Payment Radio -->
            <div class="tk-radio-card ${window.storeSelectedPaymentMethod === 'ONLINE' ? 'active' : ''}" id="card-pay-online" onclick="selectPaymentMethodRadio('ONLINE')">
              <div class="tk-radio-left">
                <input type="radio" name="chk-pay-method-opt" value="ONLINE" ${window.storeSelectedPaymentMethod === 'ONLINE' ? 'checked' : ''}>
                <div>
                  <div class="tk-radio-title"><i class="fa-solid fa-credit-card" style="color:var(--primary);"></i> Thanh toán online</div>
                  <div class="tk-radio-sub"><i class="fa-solid fa-credit-card"></i> Thanh toán trực tuyến - An toàn qua cổng thanh toán (VietQR, Napas, Thẻ quốc tế)</div>
                </div>
              </div>
              <span class="badge badge-success" style="font-size:10px;">Khuyên Dùng</span>
            </div>
          </div>

          <!-- 6. GHI CHÚ CHO NGƯỜI BÁN -->
          <div class="tk-card">
            <div class="tk-card-header">
              <div class="tk-card-title">
                <i class="fa-solid fa-pencil"></i> Ghi chú cho người bán
              </div>
            </div>
            <textarea id="chk-order-notes" class="form-control" rows="2" placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."></textarea>
          </div>

        </div>

        <!-- CỘT PHẢI (~30%): Chi tiết thanh toán & Đặt hàng -->
        <div>
          <div class="tk-card tk-summary-card">
            <div class="tk-card-header">
              <div class="tk-card-title"><i class="fa-solid fa-receipt"></i> Chi tiết thanh toán</div>
            </div>

            <div class="tk-summary-row">
              <span class="label">Tạm tính</span>
              <span class="val">${subtotal.toLocaleString('vi-VN')} ₫</span>
            </div>
            <div class="tk-summary-row">
              <span class="label">Phí vận chuyển</span>
              <span class="val">${baseShippingFee.toLocaleString('vi-VN')} ₫</span>
            </div>
            ${storeAppliedVoucher ? `
              <div class="tk-summary-row discount">
                <span class="label">Giảm voucher (${escHtml(storeAppliedVoucher.code)})</span>
                <span class="val">-${discountAmount.toLocaleString('vi-VN')} ₫</span>
              </div>
            ` : ''}
            
            <div class="tk-summary-total">
              <span class="tk-summary-total-label">TỔNG THANH TOÁN</span>
              <span class="tk-summary-total-val">${totalAmount.toLocaleString('vi-VN')} ₫</span>
            </div>

            <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-bottom:14px;">
              <i class="fa-solid fa-shield-halved" style="color:var(--success);"></i> Thanh toán an toàn và bảo mật
            </div>

            <button type="button" id="btn-submit-order-desktop" class="tk-btn-submit-order" onclick="executePlaceOrder()">
              <i class="fa-solid fa-cart-shopping"></i> ĐẶT HÀNG
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Sticky Action Footer Bar (Chỉ hiển thị trên Mobile) -->
      <div class="tk-sticky-footer">
        <div class="tk-sticky-total-info">
          <span class="tk-sticky-total-label">Tổng:</span>
          <span class="tk-sticky-total-val">${totalAmount.toLocaleString('vi-VN')} ₫</span>
        </div>
        <button type="button" class="tk-sticky-btn" onclick="executePlaceOrder()">
          <i class="fa-solid fa-cart-shopping"></i> ĐẶT HÀNG
        </button>
      </div>

    </div>`;

  await loadAvailableVouchersForCheckout(subtotal);
}

function handleApplyVoucherInput() {
  const input = document.getElementById('chk-voucher-code-input');
  const code = input ? input.value.trim() : '';
  if (!code) {
    showToast('Vui lòng nhập mã voucher.', 'error');
    return;
  }
  selectVoucherCode(code);
}

function selectPaymentMethodRadio(method) {
  window.storeSelectedPaymentMethod = method;
  const onlineCard = document.getElementById('card-pay-online');
  const codCard = document.getElementById('card-pay-cod');
  const onlineRadio = document.querySelector('input[value="ONLINE"]');
  const codRadio = document.querySelector('input[value="COD"]');

  if (method === 'ONLINE') {
    if (onlineCard) onlineCard.classList.add('active');
    if (codCard) codCard.classList.remove('active');
    if (onlineRadio) onlineRadio.checked = true;
  } else {
    if (codCard) codCard.classList.add('active');
    if (onlineCard) onlineCard.classList.remove('active');
    if (codRadio) codRadio.checked = true;
  }
}


async function loadAvailableVouchersForCheckout(subtotal) {
  try {
    const res = await apiRequest('/store/vouchers/available');
    if (res.success) {
      storeAvailableVouchers = res.vouchers || [];
    }
  } catch (e) {
    console.error('Error loading available vouchers:', e);
  }
}

async function selectVoucherCode(code) {
  const items = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;
  if (!items.length) return;

  try {
    const res = await apiRequest('/store/vouchers/apply', 'POST', {
      code: code.trim(),
      items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      shipping_method: storeShippingMethod
    });

    if (res.success) {
      storeAppliedVoucher = {
        code: res.voucher.code,
        name: res.voucher.name,
        discount_amount: res.discount_amount,
        voucher: res.voucher
      };
      showToast(res.message, 'success');
      renderCheckoutView();
    } else {
      showToast(res.message || 'Mã voucher không hợp lệ.', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi áp dụng voucher.', 'error');
  }
}

function removeVoucherCode() {
  storeAppliedVoucher = null;
  showToast('Đã hủy áp dụng voucher.', 'info');
  renderCheckoutView();
}

function applyVoucherCode(code) {
  return selectVoucherCode(code);
}


function selectShippingMethod(method) {
  storeShippingMethod = method;
  renderCheckoutView();
}

function selectPaymentMethodRadio(method) {
  const onlineCard = document.getElementById('card-pay-online');
  const codCard = document.getElementById('card-pay-cod');
  const onlineRadio = document.querySelector('input[value="ONLINE"]');
  const codRadio = document.querySelector('input[value="COD"]');

  if (method === 'ONLINE') {
    if (onlineCard) onlineCard.classList.add('active');
    if (codCard) codCard.classList.remove('active');
    if (onlineRadio) onlineRadio.checked = true;
  } else {
    if (codCard) codCard.classList.add('active');
    if (onlineCard) onlineCard.classList.remove('active');
    if (codRadio) codRadio.checked = true;
  }
}

function changeCheckoutItemQty(idx, delta) {
  const items = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;
  if (!items[idx]) return;
  const newQty = items[idx].quantity + delta;
  const maxStock = items[idx].max_stock || 999;
  if (newQty < 1) {
    if (storeDirectCheckoutItem) {
      switchView('store-shop');
    } else {
      removeCartItem(idx);
    }
    return;
  }
  if (newQty > maxStock) {
    showToast(`Chỉ còn ${maxStock} sản phẩm trong kho!`, 'error');
    return;
  }
  items[idx].quantity = newQty;
  items[idx].subtotal = items[idx].price * newQty;
  if (!storeDirectCheckoutItem) {
    saveCartToStorage();
    updateSidebarCartBadge();
  }
  renderCheckoutView();
}

function setCheckoutItemQty(idx, val) {
  const items = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;
  if (!items[idx]) return;
  let qty = parseInt(val) || 1;
  const maxStock = items[idx].max_stock || 999;
  qty = Math.max(1, Math.min(maxStock, qty));
  items[idx].quantity = qty;
  items[idx].subtotal = items[idx].price * qty;
  if (!storeDirectCheckoutItem) {
    saveCartToStorage();
    updateSidebarCartBadge();
  }
  renderCheckoutView();
}

/* ─── Address Management Modal ─── */
function openAddressModal() {
  const user = window.currentUser || {};

  let modal = document.getElementById('modal-checkout-address');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-checkout-address';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:500px; border-radius:16px;">
      <div class="modal-header">
        <h3 style="font-size:16px; font-weight:800;"><i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> Thông tin địa chỉ nhận hàng</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-checkout-address').classList.remove('active')">&times;</button>
      </div>
      <form id="form-edit-address" onsubmit="saveCheckoutAddress(event)" style="padding:16px 20px;">
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600;">Họ và tên người nhận <span style="color:var(--danger)">*</span></label>
          <input type="text" id="m-chk-name" class="form-control" required value="${escHtml(user.full_name || '')}" placeholder="Nguyễn Văn A">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600;">Số điện thoại <span style="color:var(--danger)">*</span></label>
          <input type="tel" id="m-chk-phone" class="form-control" required value="${escHtml(user.phone || '')}" placeholder="0987654321">
        </div>
        <div class="form-group" style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:600;">Địa chỉ nhận hàng chi tiết <span style="color:var(--danger)">*</span></label>
          <textarea id="m-chk-address" class="form-control" rows="3" required placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố">${escHtml(user.address || '')}</textarea>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-checkout-address').classList.remove('active')">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu địa chỉ</button>
        </div>
      </form>
    </div>`;

  setTimeout(() => modal.classList.add('active'), 10);
}

function saveCheckoutAddress(e) {
  e.preventDefault();
  const name = document.getElementById('m-chk-name').value.trim();
  const phone = document.getElementById('m-chk-phone').value.trim();
  const address = document.getElementById('m-chk-address').value.trim();

  if (!name || !phone || !address) {
    showToast('Vui lòng điền đầy đủ thông tin nhận hàng.', 'error');
    return;
  }

  if (window.currentUser) {
    window.currentUser.full_name = name;
    window.currentUser.phone = phone;
    window.currentUser.address = address;
  }

  document.getElementById('modal-checkout-address')?.classList.remove('active');
  showToast('Đã lưu thông tin nhận hàng!', 'success');
  renderCheckoutView();
}

/* ─── Voucher Selection Modal (TikTok Shop Style) ─── */
function openVoucherModal() {
  const items = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  let modal = document.getElementById('modal-checkout-voucher-picker');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-checkout-voucher-picker';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card tk-voucher-modal-card" style="padding:0;">
      <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
        <h3 style="font-size:16px; font-weight:800;"><i class="fa-solid fa-ticket" style="color:var(--primary);"></i> Chọn Voucher Sen Chăm Boss</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-checkout-voucher-picker').classList.remove('active')">&times;</button>
      </div>

      <div style="padding:16px 20px;">
        <!-- Input code -->
        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <input type="text" id="modal-voucher-code-input" class="form-control" placeholder="Nhập mã voucher (BOSS20, FREESHIP...)" style="text-transform:uppercase; font-weight:700;" value="${storeAppliedVoucher ? storeAppliedVoucher.code : ''}">
          <button type="button" class="btn btn-primary" style="white-space:nowrap; padding:8px 16px;" onclick="applyVoucherFromModal()">Áp dụng</button>
        </div>

        <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">Voucher khả dụng</div>

        <div style="max-height:320px; overflow-y:auto;">
          ${storeAvailableVouchers.map(v => {
            const eligible = subtotal >= (v.minimum_order_value || 0);
            const isApplied = storeAppliedVoucher && storeAppliedVoucher.code === v.code;
            const desc = v.discount_type === 'PERCENT'
              ? `Giảm ${v.discount_value}% ${v.maximum_discount ? `(Tối đa ${v.maximum_discount.toLocaleString('vi-VN')} ₫)` : ''}`
              : `Giảm ${v.discount_value.toLocaleString('vi-VN')} ₫`;

            return `
              <div class="tk-voucher-item-box ${isApplied ? 'selected' : ''}">
                <div style="flex:1;">
                  <div style="font-weight:800; font-size:14px; font-family:monospace; color:${eligible ? 'var(--primary)' : '#64748b'};">${escHtml(v.code)}</div>
                  <div style="font-size:13px; font-weight:700; color:var(--text-main);">${desc}</div>
                  <div style="font-size:11px; color:var(--text-muted);">Đơn từ ${(v.minimum_order_value || 0).toLocaleString('vi-VN')} ₫ · Hạn: ${v.end_date || 'Không thời hạn'}</div>
                </div>
                <div>
                  ${isApplied ? `
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); font-size:11px; padding:4px 8px;" onclick="removeVoucherCode(); document.getElementById('modal-checkout-voucher-picker').classList.remove('active');">
                      Bỏ chọn
                    </button>
                  ` : eligible ? `
                    <button type="button" class="btn btn-primary btn-sm" style="font-size:11px; padding:4px 12px;" onclick="selectVoucherCode('${v.code}'); document.getElementById('modal-checkout-voucher-picker').classList.remove('active');">
                      Áp dụng
                    </button>
                  ` : `
                    <span style="font-size:11px; color:var(--danger); font-weight:600;">Chưa đủ điều kiện</span>
                  `}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  setTimeout(() => modal.classList.add('active'), 10);
}

async function applyVoucherFromModal() {
  const input = document.getElementById('modal-voucher-code-input');
  const code = (input ? input.value : '').trim();
  if (!code) {
    showToast('Vui lòng nhập mã voucher.', 'error');
    return;
  }
  await selectVoucherCode(code);
  document.getElementById('modal-checkout-voucher-picker')?.classList.remove('active');
}

async function executePlaceOrder() {
  const user = window.currentUser || {};
  if (!user.address || !user.address.trim() || !user.phone || !user.phone.trim()) {
    showToast('Vui lòng thêm địa chỉ nhận hàng trước khi đặt!', 'error');
    openAddressModal();
    return;
  }

  const items = storeDirectCheckoutItem ? [storeDirectCheckoutItem] : storeCart;
  if (!items.length) {
    showToast('Không có sản phẩm để đặt hàng.', 'error');
    switchView('store-shop');
    return;
  }

  const payMethod = document.querySelector('input[name="chk-pay-method-opt"]:checked')?.value || 'ONLINE';
  const notes = document.getElementById('chk-order-notes')?.value || '';

  const btnDesktop = document.getElementById('btn-submit-order-desktop');
  if (btnDesktop) { btnDesktop.disabled = true; btnDesktop.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

  const payload = {
    customer_name: user.full_name || 'Khách hàng',
    phone: user.phone.trim(),
    address: user.address.trim(),
    notes: notes.trim(),
    payment_method: payMethod,
    shipping_method: storeShippingMethod,
    voucher_code: storeAppliedVoucher ? storeAppliedVoucher.code : null,
    items: items.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      variant: i.variant || 'Tiêu chuẩn'
    }))
  };

  try {
    const res = await apiRequest('/store/orders', 'POST', payload);
    if (res.success) {
      if (storeDirectCheckoutItem) {
        storeDirectCheckoutItem = null;
      } else {
        storeCart = [];
        saveCartToStorage();
        updateSidebarCartBadge();
      }
      storeAppliedVoucher = null;

      showToast(res.message || 'Đặt hàng thành công!', 'success');

      if (res.payment_url) {
        // Online Gateway Redirect
        window.location.href = res.payment_url;
      } else {
        renderOrderSuccessView(res.order);
      }
    } else {
      showToast(res.message || 'Đặt hàng không thành công. Vui lòng thử lại!', 'error');
      if (btnDesktop) { btnDesktop.disabled = false; btnDesktop.innerHTML = '<i class="fa-solid fa-lock"></i> ĐẶT HÀNG / THANH TOÁN'; }
    }
  } catch (err) {
    showToast('Lỗi kết nối khi đặt hàng. Vui lòng thử lại!', 'error');
    if (btnDesktop) { btnDesktop.disabled = false; btnDesktop.innerHTML = '<i class="fa-solid fa-lock"></i> ĐẶT HÀNG / THANH TOÁN'; }
  }
}

/* ─── VIEW 3.5: TRANG ĐẶT HÀNG THÀNH CÔNG (Order Success Screen) ─── */
function renderOrderSuccessView(order) {
  const container = document.getElementById('view-store-checkout');
  if (!container) return;

  const itemsSummary = (order.items || []).map(i => `${escHtml(i.name)} (x${i.quantity})`).join(', ');

  container.innerHTML = `
    <div class="tk-success-wrapper">
      <div class="tk-success-icon"><i class="fa-solid fa-circle-check"></i></div>
      <h2 style="font-size:22px; font-weight:800; color:var(--text-main); margin-bottom:6px;"><i class="fa-solid fa-party-horn"></i> Đặt hàng thành công!</h2>
      <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">Cảm ơn bạn đã tin tưởng mua sắm tại Sen Chăm Boss</p>

      <div style="background:#f8fafc; border:1px solid var(--border); border-radius:12px; padding:16px; text-align:left; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <span style="color:var(--text-muted);">Mã đơn hàng:</span>
          <strong style="color:var(--primary); font-family:monospace; font-size:15px;">#${order.order_code}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <span style="color:var(--text-muted);">Sản phẩm:</span>
          <strong style="max-width:260px; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${itemsSummary}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <span style="color:var(--text-muted);">Phương thức:</span>
          <strong>${order.payment_method === 'ONLINE' ? 'Thanh toán Online (Gateway)' : 'Thanh toán khi nhận hàng (COD)'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
          <span style="color:var(--text-muted);">Dự kiến nhận hàng:</span>
          <strong style="color:#0369a1;">Sau 3 - 5 ngày làm việc</strong>
        </div>
        <div style="border-top:1px solid #e2e8f0; margin:10px 0;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:800; font-size:15px;">Tổng thanh toán:</span>
          <span style="color:var(--primary); font-size:20px; font-weight:900;">${order.total_amount?.toLocaleString('vi-VN')} ₫</span>
        </div>
      </div>

      <div style="display:flex; gap:12px; justify-content:center;">
        <button class="btn btn-primary" style="flex:1; padding:12px; font-weight:700;" onclick="switchView('store-orders')">
          <i class="fa-solid fa-box"></i> Xem đơn hàng
        </button>
        <button class="btn btn-outline" style="flex:1; padding:12px;" onclick="switchView('store-shop')">
          Tiếp tục mua sắm
        </button>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════
   VIEW 4: MY ORDERS – User's order history & Repayment
════════════════════════════════════════════════════════ */
let userOrdersData = [];

async function renderMyOrdersView() {
  const container = document.getElementById('view-store-orders');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <h2 class="store-page-title">Đơn hàng của tôi</h2>
    </div>

    <!-- Status Tabs -->
    <div class="store-cat-pills" style="margin-bottom:20px; overflow-x:auto; white-space:nowrap; padding-bottom:6px;">
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'ALL' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('ALL')">Tất cả</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'PENDING' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('PENDING')">Chờ xác nhận</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'CONFIRMED' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('CONFIRMED')">Đã xác nhận</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'SHIPPING' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('SHIPPING')">Đang giao</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'DELIVERED' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('DELIVERED')">Đã giao</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'COMPLETED' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('COMPLETED')">Hoàn thành</button>
      <button class="cat-pill ${storeMyOrdersStatusFilter === 'CANCELLED' ? 'active' : ''}" onclick="setMyOrdersStatusFilter('CANCELLED')">Đã hủy</button>
    </div>

    <div id="my-orders-list">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải đơn hàng...</div>
    </div>`;

  const listEl = document.getElementById('my-orders-list');
  try {
    const res = await apiRequest('/store/orders');
    if (!res.success) {
      if (listEl) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:40px; text-align:center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải dữ liệu đơn hàng</p>
            <p style="color:var(--text-muted); margin-bottom:16px;">${res.message || 'Lỗi kết nối.'}</p>
            <button class="btn btn-primary btn-sm" onclick="renderMyOrdersView()">Thử lại</button>
          </div>`;
      }
      return;
    }
    userOrdersData = res.orders || [];
    renderMyOrdersList();
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:40px; text-align:center;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi tải danh sách đơn hàng</p>
          <button class="btn btn-primary btn-sm" onclick="renderMyOrdersView()">Thử lại</button>
        </div>`;
    }
  }
}

function setMyOrdersStatusFilter(status) {
  storeMyOrdersStatusFilter = status;
  document.querySelectorAll('#view-store-orders .cat-pill').forEach(btn => {
    const text = btn.textContent.trim();
    const map = {
      'Tất cả': 'ALL',
      'Chờ xác nhận': 'PENDING',
      'Đã xác nhận': 'CONFIRMED',
      'Đang giao': 'SHIPPING',
      'Đã giao': 'DELIVERED',
      'Hoàn thành': 'COMPLETED',
      'Đã hủy': 'CANCELLED'
    };
    btn.classList.toggle('active', map[text] === status);
  });
  renderMyOrdersList();
}

function renderMyOrdersList() {
  const listEl = document.getElementById('my-orders-list');
  if (!listEl) return;

  let filtered = userOrdersData;
  if (storeMyOrdersStatusFilter !== 'ALL') {
    filtered = filtered.filter(o => o.order_status === storeMyOrdersStatusFilter);
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:60px 20px; text-align:center; background:#fff; border-radius:14px; border:1px solid var(--border);">
        <div style="font-size:64px; margin-bottom:16px;"><i class="fa-solid fa-cart-shopping"></i></div>
        <p style="font-size:18px; font-weight:bold; margin-bottom:8px; color:var(--text-color);">Bạn chưa có đơn hàng nào</p>
        <p style="color:var(--text-muted); margin-bottom:24px;">Khám phá các sản phẩm chăm sóc thú cưng của chúng tôi.</p>
        <button class="btn btn-primary" onclick="switchView('store-shop')">Mua sắm ngay</button>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const st = ORDER_STATUS_MAP[o.order_status] || { text: o.order_status, cls: 'badge-secondary' };
    const py = PAYMENT_STATUS_MAP[o.payment_status] || { text: o.payment_status, cls: 'badge-secondary' };
    const canCancel = o.order_status === 'PENDING';
    const canConfirmReceive = o.order_status === 'DELIVERED';
    const canRetryPayment = (o.payment_status === 'FAILED' || o.payment_status === 'UNPAID' || o.payment_status === 'PENDING') && o.payment_method === 'ONLINE' && o.order_status !== 'CANCELLED';
    const pm = o.payment_method === 'ONLINE' ? 'Thanh toán Online (Gateway)' : 'Thanh toán khi nhận hàng (COD)';

    return `
      <div class="order-card-full" style="border:1px solid var(--border); border-radius:14px; padding:18px; margin-bottom:16px; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:800; font-size:16px; font-family:monospace; color:var(--primary);">
              Đơn hàng #${o.order_code || o.id.substring(0,8)} 
              <span style="color:var(--text-muted); font-size:13px; font-weight:normal; margin-left:12px; font-family:var(--font-family);">${new Date(o.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">
              Trạng thái: <span class="badge ${st.cls}">${st.text}</span> <span class="badge ${py.cls}" style="margin-left:4px;">[${py.text}]</span>
            </div>
          </div>
        </div>

        <div class="order-products-list" style="margin-bottom:16px;">
          ${(o.items || []).map(item => `
            <div style="display:flex; align-items:center; padding:12px 0; border-bottom:1px dashed #eee; flex-wrap:wrap; gap:12px;">
              <img src="${item.image_url || ''}" alt="${escHtml(item.product_name || item.name)}" style="width:80px; height:80px; object-fit:cover; border-radius:10px; flex-shrink:0; background:#f5f5f5;" onerror="this.outerHTML='<div style=\\'width:80px;height:80px;background:#f5f5f5;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:32px;\\'><i class="fa-solid fa-paw"></i></div>'">
              <div style="flex:1; min-width:200px;">
                <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${escHtml(item.product_name || item.name)}</div>
                <div style="font-size:12px; color:var(--primary); font-weight:600; margin-bottom:4px;">
                  <i class="fa-solid fa-user-doctor"></i> Người bán: ${escHtml(item.doctor_name || 'Sen Chăm Boss')}
                </div>
                ${item.variant ? `<span style="font-size:11px; background:#f1f5f9; color:var(--text-muted); padding:2px 8px; border-radius:4px;">${escHtml(item.variant)}</span>` : ''}
                <div style="font-size:13px; margin-top:4px;">Số lượng: <strong>${item.quantity}</strong> · Đơn giá: ${item.price?.toLocaleString('vi-VN')} ₫</div>
              </div>
              <div style="font-weight:800; color:var(--primary); font-size:15px; text-align:right; min-width:120px;">
                Thành tiền:<br>${(item.subtotal || (item.price * item.quantity))?.toLocaleString('vi-VN')} ₫
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px;">
          <div style="flex:1; min-width:250px;">
            <div style="font-size:13px; margin-bottom:12px;">Phương thức thanh toán: <strong style="color:var(--text-color);">${pm}</strong></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" onclick="viewMyOrderDetail('${o.id}')"><i class="fa-solid fa-eye"></i> Xem chi tiết</button>
              ${canRetryPayment ? `
                <button class="btn btn-primary btn-sm" style="background:#0284c7; border:none; font-weight:700;" onclick="retryOnlinePayment('${o.id}')">
                  <i class="fa-solid fa-credit-card"></i> Thanh toán lại
                </button>
              ` : ''}
              ${canConfirmReceive ? `<button class="btn btn-success btn-sm" onclick="confirmReceiveOrder('${o.id}')"><i class="fa-solid fa-circle-check"></i> Đã nhận được hàng</button>` : ''}
              ${canCancel ? `<button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="cancelMyOrder('${o.id}')"><i class="fa-solid fa-ban"></i> Hủy đơn</button>` : ''}
            </div>
          </div>
          <div style="text-align:right; min-width:200px; background:var(--bg-light); padding:12px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:4px;"><span>Tạm tính:</span> <strong>${(o.subtotal || 0).toLocaleString('vi-VN')} ₫</strong></div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:4px;"><span>Phí vận chuyển:</span> <strong>${(o.shipping_fee || 30000).toLocaleString('vi-VN')} ₫</strong></div>
            ${o.discount_amount ? `
              <div style="display:flex; justify-content:space-between; font-size:13px; color:#059669; margin-bottom:4px;"><span>Voucher (${o.voucher_code || ''}):</span> <strong>-${o.discount_amount.toLocaleString('vi-VN')} ₫</strong></div>
            ` : ''}
            <div style="border-top:1px solid #ddd; margin:6px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:800; color:var(--primary); align-items:center;"><span>Tổng thanh toán:</span> <span>${o.total_amount?.toLocaleString('vi-VN')} ₫</span></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function retryOnlinePayment(orderId) {
  try {
    const res = await apiRequest(`/store/orders/${orderId}/retry-payment`, 'POST', {});
    if (res.success && res.payment_url) {
      window.location.href = res.payment_url;
    } else {
      showToast(res.message || 'Không thể khởi tạo thanh toán lại.', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi thanh toán lại.', 'error');
  }
}

async function viewMyOrderDetail(orderId) {
  try {
    const res = await apiRequest(`/store/orders/${orderId}`);
    if (!res.success) { showToast('Không thể tải chi tiết đơn hàng.', 'error'); return; }

    const o = res.order;
    const st = ORDER_STATUS_MAP[o.order_status] || { text: o.order_status, cls: 'badge-secondary' };
    const py = PAYMENT_STATUS_MAP[o.payment_status] || { text: o.payment_status, cls: 'badge-secondary' };
    const canCancel = o.order_status === 'PENDING';
    const canConfirmReceive = o.order_status === 'DELIVERED';
    const canRetryPayment = (o.payment_status === 'FAILED' || o.payment_status === 'UNPAID' || o.payment_status === 'PENDING') && o.payment_method === 'ONLINE' && o.order_status !== 'CANCELLED';

    let modal = document.getElementById('modal-order-detail-user');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-order-detail-user';
      modal.className = 'modal-overlay';
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:580px; max-height:90vh; overflow-y:auto; padding:20px; border-radius:14px;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
          <h3 style="margin:0; font-size:18px; font-weight:800;">Chi tiết đơn hàng</h3>
          <button class="modal-close-btn" onclick="document.getElementById('modal-order-detail-user').classList.remove('active')" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-size:16px; font-weight:800; font-family:monospace; color:var(--primary); margin-bottom:4px;">${o.order_code || '#' + o.id.substring(0,8)}</div>
            <div style="font-size:13px; color:var(--text-muted);">Ngày đặt: ${new Date(o.created_at).toLocaleString('vi-VN')}</div>
          </div>
          <div style="text-align:right;">
            <div style="margin-bottom:4px;"><span class="badge ${st.cls}">${st.text}</span></div>
            <div><span class="badge ${py.cls}">${py.text}</span></div>
          </div>
        </div>

        <div class="card-box" style="margin-bottom:16px; font-size:13px; background:#f9fafb; padding:14px; border-radius:10px; border:1px solid #e5e7eb;">
          <div style="font-weight:700; margin-bottom:8px; color:var(--text-color);">Thông tin nhận hàng</div>
          <div style="display:grid; grid-template-columns:100px 1fr; gap:4px; margin-bottom:4px;">
            <span style="color:var(--text-muted);">Người nhận:</span>
            <strong>${escHtml(o.customer_name || '')}</strong>
          </div>
          <div style="display:grid; grid-template-columns:100px 1fr; gap:4px; margin-bottom:4px;">
            <span style="color:var(--text-muted);">Điện thoại:</span>
            <strong>${o.phone || ''}</strong>
          </div>
          <div style="display:grid; grid-template-columns:100px 1fr; gap:4px; margin-bottom:4px;">
            <span style="color:var(--text-muted);">Địa chỉ:</span>
            <strong>${escHtml(o.full_address || o.address || '')}</strong>
          </div>
          <div style="display:grid; grid-template-columns:100px 1fr; gap:4px; margin-bottom:4px;">
            <span style="color:var(--text-muted);">Thanh toán:</span>
            <strong>${o.payment_method === 'ONLINE' ? 'Thanh toán Online (Gateway)' : 'Tiền mặt khi nhận hàng (COD)'}</strong>
          </div>
          ${o.notes ? `
          <div style="display:grid; grid-template-columns:100px 1fr; gap:4px; margin-top:4px;">
            <span style="color:var(--text-muted);">Ghi chú:</span>
            <span style="font-style:italic;">${escHtml(o.notes)}</span>
          </div>` : ''}
        </div>

        <div style="font-weight:800; font-size:14px; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">Danh sách sản phẩm</div>
        <div style="margin-bottom:16px;">
          ${(o.items || []).map(item => `
            <div style="display:flex; align-items:center; padding:10px 0; border-bottom:1px dashed #eee; gap:12px;">
              <img src="${item.image_url || ''}" alt="${escHtml(item.product_name || item.name)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; flex-shrink:0; background:#f5f5f5;" onerror="this.outerHTML='<div style=\\'width:70px;height:70px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;\\'><i class="fa-solid fa-paw"></i></div>'">
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:700; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(item.product_name || item.name)}</div>
                <div style="font-size:12px; color:var(--primary); font-weight:600; margin-bottom:2px;">
                  <i class="fa-solid fa-user-doctor"></i> Người bán: ${escHtml(item.doctor_name || 'Sen Chăm Boss')}
                </div>
                ${item.variant ? `<span style="font-size:11px; background:#f1f5f9; color:var(--text-muted); padding:2px 8px; border-radius:4px;">${escHtml(item.variant)}</span>` : ''}
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                  ${item.price?.toLocaleString('vi-VN')} ₫ × <strong style="color:var(--text-color);">${item.quantity}</strong>
                </div>
              </div>
              <div style="font-weight:800; color:var(--primary); font-size:15px; text-align:right;">
                ${(item.subtotal || (item.price * item.quantity))?.toLocaleString('vi-VN')} ₫
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background:var(--bg-light); padding:16px; border-radius:10px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
            <span style="color:var(--text-muted);">Tạm tính</span>
            <strong>${(o.subtotal || 0).toLocaleString('vi-VN')} ₫</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
            <span style="color:var(--text-muted);">Phí vận chuyển</span>
            <strong>${(o.shipping_fee || 30000).toLocaleString('vi-VN')} ₫</strong>
          </div>
          ${o.discount_amount ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; color:#059669;">
              <span>Giảm giá voucher (${o.voucher_code || ''})</span>
              <strong>-${o.discount_amount.toLocaleString('vi-VN')} ₫</strong>
            </div>
          ` : ''}
          <div style="border-top:1px solid #ddd; margin-bottom:10px;"></div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; font-size:16px;">Tổng thanh toán</span>
            <span style="color:var(--primary); font-size:20px; font-weight:900;">${o.total_amount?.toLocaleString('vi-VN')} ₫</span>
          </div>
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
          ${canRetryPayment ? `<button class="btn btn-primary" onclick="retryOnlinePayment('${o.id}'); document.getElementById('modal-order-detail-user').classList.remove('active');"><i class="fa-solid fa-credit-card"></i> Thanh toán lại</button>` : ''}
          ${canConfirmReceive ? `<button class="btn btn-success" onclick="confirmReceiveOrder('${o.id}'); document.getElementById('modal-order-detail-user').classList.remove('active');"><i class="fa-solid fa-circle-check"></i> Đã nhận được hàng</button>` : ''}
          ${canCancel ? `<button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="cancelMyOrder('${o.id}'); document.getElementById('modal-order-detail-user').classList.remove('active');"><i class="fa-solid fa-ban"></i> Hủy đơn</button>` : ''}
        </div>
      </div>`;

    setTimeout(() => modal.classList.add('active'), 10);
  } catch (err) {
    showToast('Lỗi kết nối khi tải chi tiết đơn hàng.', 'error');
  }
}

async function confirmReceiveOrder(orderId) {
  if (!confirm('Bạn xác nhận đã nhận được hàng và đơn hàng đã hoàn tất?')) return;
  const res = await apiRequest(`/store/orders/${orderId}/receive`, 'PATCH', {});
  if (res.success) {
    showToast('Đã xác nhận nhận hàng! Đơn hàng đã hoàn thành.', 'success');
    renderMyOrdersView();
  } else {
    showToast(res.message || 'Không thể xác nhận nhận hàng.', 'error');
  }
}

async function cancelMyOrder(orderId) {
  if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
  const res = await apiRequest(`/store/orders/${orderId}/cancel`, 'PATCH', {});
  if (res.success) {
    showToast('Đã hủy đơn hàng thành công.', 'success');
    renderMyOrdersView();
  } else {
    showToast(res.message || 'Không thể hủy đơn hàng.', 'error');
  }
}

/* ════════════════════════════════════════════════════════
   ADMIN VIEW 1: PRODUCT MANAGEMENT
════════════════════════════════════════════════════════ */
async function renderAdminProductsView() {
  const container = document.getElementById('view-admin-products');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <h2 class="store-page-title">Quản lý sản phẩm (Admin)</h2>
      <button class="btn btn-primary" onclick="openAdminProductModal()">
        <i class="fa-solid fa-plus"></i> Thêm sản phẩm
      </button>
    </div>

    <!-- Status Tabs for Approval -->
    <div class="store-cat-pills" style="margin-bottom:16px; overflow-x:auto; white-space:nowrap; padding-bottom:6px;">
      <button class="cat-pill ${storeAdminProdApprovalFilter === 'ALL' ? 'active' : ''}" onclick="setAdminProdApprovalFilter('ALL')">Tất cả</button>
      <button class="cat-pill ${storeAdminProdApprovalFilter === 'PENDING_APPROVAL' ? 'active' : ''}" onclick="setAdminProdApprovalFilter('PENDING_APPROVAL')">Chờ duyệt</button>
      <button class="cat-pill ${storeAdminProdApprovalFilter === 'APPROVED' ? 'active' : ''}" onclick="setAdminProdApprovalFilter('APPROVED')">Đã duyệt</button>
      <button class="cat-pill ${storeAdminProdApprovalFilter === 'REJECTED' ? 'active' : ''}" onclick="setAdminProdApprovalFilter('REJECTED')">Bị từ chối</button>
    </div>

    <!-- Filters -->
    <div class="store-filter-bar" style="margin-bottom:16px;">
      <div class="store-search-wrap">
        <i class="fa-solid fa-magnifying-glass search-icon"></i>
        <input type="text" id="admin-prod-search" class="form-control" placeholder="Tìm kiếm theo tên, mã, người bán..." oninput="filterAdminProductsTable()">
      </div>
      <select id="admin-prod-cat" class="form-control" style="width:auto; min-width:150px;" onchange="filterAdminProductsTable()">
        <option value="ALL">Tất cả danh mục</option>
        ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <select id="admin-prod-status" class="form-control" style="width:auto; min-width:140px;" onchange="filterAdminProductsTable()">
        <option value="ALL">Tất cả trạng thái</option>
        <option value="ACTIVE">Đang bán</option>
        <option value="INACTIVE">Ngừng bán</option>
      </select>
    </div>

    <div id="admin-products-table-wrap">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách...</div>
    </div>`;

  await loadAdminProductsTable();
  renderAdminProductsTable();
}

function setAdminProdApprovalFilter(status) {
  storeAdminProdApprovalFilter = status;
  document.querySelectorAll('#view-admin-products .cat-pill').forEach(btn => {
    const text = btn.textContent.trim();
    const map = {
      'Tất cả': 'ALL',
      'Chờ duyệt': 'PENDING_APPROVAL',
      'Đã duyệt': 'APPROVED',
      'Bị từ chối': 'REJECTED'
    };
    btn.classList.toggle('active', map[text] === status);
  });
  renderAdminProductsTable();
}

async function loadAdminProductsTable() {
  const wrap = document.getElementById('admin-products-table-wrap');
  try {
    const res = await apiRequest('/store/products');
    if (!res.success) {
      if (wrap) {
        wrap.innerHTML = `
          <div class="empty-state" style="padding:40px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải dữ liệu sản phẩm</p>
            <p style="color:var(--text-muted); margin-bottom:16px;">${res.message || 'Lỗi kết nối.'}</p>
            <button class="btn btn-primary btn-sm" onclick="loadAdminProductsTable().then(renderAdminProductsTable)">Thử lại</button>
          </div>`;
      }
      return;
    }
    storeAdminProducts = res.products || [];
  } catch (err) {
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi tải dữ liệu</p>
          <button class="btn btn-primary btn-sm" onclick="loadAdminProductsTable().then(renderAdminProductsTable)">Thử lại</button>
        </div>`;
    }
  }
}

function filterAdminProductsTable() { renderAdminProductsTable(); }

function renderAdminProductsTable() {
  const wrap = document.getElementById('admin-products-table-wrap');
  if (!wrap) return;

  const search = (document.getElementById('admin-prod-search')?.value || '').toLowerCase();
  const cat = document.getElementById('admin-prod-cat')?.value || 'ALL';
  const status = document.getElementById('admin-prod-status')?.value || 'ALL';

  let filtered = storeAdminProducts;
  if (storeAdminProdApprovalFilter !== 'ALL') {
    filtered = filtered.filter(p => (p.approval_status || 'APPROVED') === storeAdminProdApprovalFilter);
  }
  if (cat !== 'ALL') filtered = filtered.filter(p => p.category === cat);
  if (status !== 'ALL') filtered = filtered.filter(p => p.status === status);
  if (search) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.product_code || '').toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search) ||
      (p.doctor_name || '').toLowerCase().includes(search)
    );
  }

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:40px; text-align:center; background:#fff; border-radius:8px; border:1px solid var(--border);"><p style="font-weight:700; color:var(--text-color);">Chưa có sản phẩm nào phù hợp.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã SP</th>
            <th>Hình ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Người đăng</th>
            <th>Danh mục</th>
            <th>Giá bán</th>
            <th>Tồn kho</th>
            <th>Duyệt</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => {
            const appBadge = APPROVAL_STATUS_MAP[p.approval_status || 'APPROVED'] || { text: 'Đã duyệt', cls: 'badge-success' };
            const isPending = p.approval_status === 'PENDING_APPROVAL';

            return `
              <tr>
                <td style="font-family:monospace; font-weight:700; font-size:12px;">${p.product_code || 'N/A'}</td>
                <td>
                  <div style="width:48px; height:48px; border-radius:6px; overflow:hidden; background:#f0f0f0; display:flex; align-items:center; justify-content:center;">
                    ${p.image_url ? `<img src="${p.image_url}" alt="${escHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : '<i class="fa-solid fa-paw"></i>'}
                  </div>
                </td>
                <td>
                  <div style="font-weight:600; font-size:14px;">${escHtml(p.name)}</div>
                  ${p.description ? `<div style="font-size:11px; color:var(--text-muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(p.description)}</div>` : ''}
                </td>
                <td>
                  <div style="font-weight:600; font-size:12px; color:var(--primary);"><i class="fa-solid fa-user-doctor"></i> ${escHtml(p.doctor_name || 'Sen Chăm Boss')}</div>
                </td>
                <td><span class="badge badge-secondary">${p.category}</span></td>
                <td style="font-weight:700; color:var(--primary);">${p.price.toLocaleString('vi-VN')} ₫</td>
                <td>
                  <span style="font-weight:700; color:${p.stock <= 0 ? 'var(--danger)' : p.stock <= 5 ? '#f59e0b' : 'inherit'};">
                    ${p.stock}
                  </span>
                </td>
                <td>
                  <span class="badge ${appBadge.cls}">${appBadge.text}</span>
                </td>
                <td>
                  <span class="badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">
                    ${p.status === 'ACTIVE' ? 'Đang bán' : 'Ngừng bán'}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    ${isPending ? `
                      <button class="btn btn-success btn-sm" onclick="approveProduct('${p.id}', '${escHtml(p.name)}')" title="Duyệt sản phẩm">
                        <i class="fa-solid fa-check"></i> Duyệt
                      </button>
                      <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="rejectProduct('${p.id}', '${escHtml(p.name)}')" title="Từ chối">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" onclick="openAdminProductModal('${p.id}')" title="Sửa">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="deleteAdminProduct('${p.id}', '${escHtml(p.name)}')" title="Xóa">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:right;">Hiển thị ${filtered.length} / ${storeAdminProducts.length} sản phẩm</div>`;
}

async function approveProduct(id, name) {
  if (!confirm(`Xác nhận DUYỆT sản phẩm "${name}" và cho phép mở bán?`)) return;
  const res = await apiRequest(`/store/products/${id}/approve`, 'PATCH', {});
  if (res.success) {
    showToast(res.message, 'success');
    await loadAdminProductsTable();
    renderAdminProductsTable();
    storeAllProducts = [];
  } else {
    showToast(res.message || 'Lỗi duyệt sản phẩm.', 'error');
  }
}

async function rejectProduct(id, name) {
  const reason = prompt(`Nhập lý do từ chối sản phẩm "${name}":`, 'Không đạt yêu cầu chất lượng');
  if (reason === null) return;
  const res = await apiRequest(`/store/products/${id}/reject`, 'PATCH', { reason });
  if (res.success) {
    showToast(res.message, 'success');
    await loadAdminProductsTable();
    renderAdminProductsTable();
    storeAllProducts = [];
  } else {
    showToast(res.message || 'Lỗi từ chối sản phẩm.', 'error');
  }
}

/* ════════════════════════════════════════════════════════
   SHARED PRODUCT IMAGE UPLOAD MANAGER (JPG, PNG, WEBP, MAX 5)
════════════════════════════════════════════════════════ */
let productFormImages = []; // Array of { file: File|null, url: string, previewUrl: string }
window._replaceImageIndex = -1;

function triggerProductFileInput(inputIndex = -1, inputId = 'prod-file-input') {
  window._replaceImageIndex = inputIndex;
  const fileInput = document.getElementById(inputId);
  if (fileInput) fileInput.click();
}

function handleProductFilesSelect(event, containerId = 'prod-upload-container') {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxBytes = 5 * 1024 * 1024; // 5MB

  const validFiles = [];
  for (const f of files) {
    if (!allowedTypes.includes(f.type.toLowerCase())) {
      showToast('Định dạng ảnh không được hỗ trợ. Vui lòng chọn JPG, PNG hoặc WEBP.', 'error');
      continue;
    }
    if (f.size > maxBytes) {
      showToast(`Ảnh "${f.name}" quá lớn, vui lòng chọn ảnh khác dưới 5MB.`, 'error');
      continue;
    }
    validFiles.push(f);
  }

  if (!validFiles.length) {
    event.target.value = '';
    return;
  }

  if (window._replaceImageIndex >= 0 && window._replaceImageIndex < productFormImages.length) {
    // Replace single slot
    const f = validFiles[0];
    productFormImages[window._replaceImageIndex] = {
      file: f,
      url: '',
      previewUrl: URL.createObjectURL(f)
    };
    window._replaceImageIndex = -1;
  } else {
    // Append
    const availableSlots = 5 - productFormImages.length;
    if (validFiles.length > availableSlots) {
      showToast('Chỉ cho phép tối đa 5 ảnh cho mỗi sản phẩm.', 'warning');
    }
    const toAdd = validFiles.slice(0, availableSlots);
    toAdd.forEach(f => {
      productFormImages.push({
        file: f,
        url: '',
        previewUrl: URL.createObjectURL(f)
      });
    });
  }

  event.target.value = '';
  renderProductImagePreviewGrid(containerId);
}

function removeProductImageSlot(index, containerId = 'prod-upload-container') {
  if (index >= 0 && index < productFormImages.length) {
    productFormImages.splice(index, 1);
    renderProductImagePreviewGrid(containerId);
  }
}

function renderProductImagePreviewGrid(containerId = 'prod-upload-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!productFormImages.length) {
    container.innerHTML = `
      <div class="prod-upload-zone" onclick="triggerProductFileInput(-1, '${containerId}-file')">
        <div class="prod-upload-icon"><i class="fa-solid fa-camera"></i></div>
        <div class="prod-upload-title">Tải ảnh sản phẩm</div>
        <div class="prod-upload-sub">JPG, JPEG, PNG, WEBP • Tối đa 5 ảnh (Dưới 5MB)</div>
        <button type="button" class="prod-upload-btn">
          <i class="fa-solid fa-cloud-arrow-up"></i> Tải ảnh lên
        </button>
      </div>`;
    return;
  }

  const canAddMore = productFormImages.length < 5;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size:12px; font-weight:700; color:var(--text-main);">
        <i class="fa-solid fa-images" style="color:var(--primary); margin-right:4px;"></i> Đã chọn ${productFormImages.length}/5 ảnh
      </span>
      <span style="font-size:11px; color:var(--text-muted);">Ảnh đầu tiên là ảnh đại diện</span>
    </div>

    <div class="prod-img-preview-grid">
      ${productFormImages.map((img, idx) => `
        <div class="prod-img-slot">
          ${idx === 0 ? '<span class="prod-img-slot-badge">Ảnh bìa</span>' : ''}
          <img src="${img.previewUrl || img.url}" alt="Preview ${idx + 1}" onerror="this.src='https://via.placeholder.com/100?text=Error'">
          <div class="prod-img-slot-actions">
            <button type="button" class="prod-img-action-btn" onclick="triggerProductFileInput(${idx}, '${containerId}-file')" title="Đổi ảnh này">
              <i class="fa-solid fa-arrows-rotate"></i>
            </button>
            <button type="button" class="prod-img-action-btn delete" onclick="removeProductImageSlot(${idx}, '${containerId}')" title="Xóa ảnh">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('')}

      ${canAddMore ? `
        <div class="prod-img-add-slot" onclick="triggerProductFileInput(-1, '${containerId}-file')" title="Thêm ảnh khác">
          <i class="fa-solid fa-plus" style="font-size:18px;"></i>
          <span>Thêm ảnh</span>
        </div>
      ` : ''}
    </div>`;
}

async function uploadAllProductImages() {
  if (!productFormImages.length) {
    throw new Error('Vui lòng tải lên ít nhất 1 ảnh sản phẩm.');
  }

  const token = localStorage.getItem('token') || (window.currentUser && window.currentUser.token);
  const uploadedUrls = [];

  for (let i = 0; i < productFormImages.length; i++) {
    const item = productFormImages[i];
    if (item.url && !item.file) {
      uploadedUrls.push(item.url);
      continue;
    }

    if (item.file) {
      const data = await (window.apiUpload ? window.apiUpload(item.file) : (async () => {
        const formData = new FormData();
        formData.append('image', item.file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData
        });
        return await res.json();
      })());

      if (!data || !data.success || !data.url) {
        throw new Error((data && data.message) || 'Không thể tải ảnh lên. Vui lòng thử lại.');
      }
      item.url = data.url;
      item.file = null;
      uploadedUrls.push(data.url);
    }
  }

  return uploadedUrls;
}

function openAdminProductModal(productId = null) {
  storeEditProductId = productId;
  const isEdit = !!productId;
  const p = isEdit ? (storeAdminProducts.find(x => x.id === productId) || storeDoctorProducts.find(x => x.id === productId)) : null;

  // Initialize product images state
  if (p) {
    const existingUrls = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
    productFormImages = existingUrls.map(u => ({ file: null, url: u, previewUrl: u }));
  } else {
    productFormImages = [];
  }

  let modal = document.getElementById('modal-admin-product-form');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-admin-product-form';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:560px; max-height:92vh; overflow-y:auto; border-radius:16px; padding:0;">
      <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
        <h3 style="font-size:17px; font-weight:800; margin:0;"><i class="fa-solid fa-box" style="color:var(--primary); margin-right:6px;"></i> ${isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới (Admin)'}</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-admin-product-form').classList.remove('active')">&times;</button>
      </div>

      <form id="form-admin-product" onsubmit="submitAdminProductForm(event)" style="padding:18px 20px;">
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Tên sản phẩm <span style="color:var(--danger)">*</span></label>
          <input type="text" id="ap-name" class="form-control" required value="${p ? escHtml(p.name) : ''}" placeholder="Nhập tên sản phẩm...">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Danh mục <span style="color:var(--danger)">*</span></label>
            <select id="ap-cat" class="form-control">
              ${CATEGORIES.map(c => `<option value="${c}" ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Mã SP (để trống tự tạo)</label>
            <input type="text" id="ap-code" class="form-control" value="${p ? (p.product_code || '') : ''}" placeholder="Tự động">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Giá bán (₫) <span style="color:var(--danger)">*</span></label>
            <input type="number" id="ap-price" class="form-control" required min="1000" step="1000" value="${p ? p.price : ''}" placeholder="185000">
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Tồn kho <span style="color:var(--danger)">*</span></label>
            <input type="number" id="ap-stock" class="form-control" required min="0" value="${p ? p.stock : 20}">
          </div>
        </div>

        <!--  UPLOAD ẢNH TỪ THIẾT BỊ -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">
            <i class="fa-solid fa-camera" style="color:var(--primary); margin-right:4px;"></i> Ảnh sản phẩm <span style="color:var(--danger)">*</span>
          </label>
          <input type="file" id="ap-upload-container-file" accept="image/jpeg,image/png,image/webp,image/jpg" multiple style="display:none;" onchange="handleProductFilesSelect(event, 'ap-upload-container')">
          <div id="ap-upload-container"></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Mô tả ngắn <span style="color:var(--danger)">*</span></label>
          <input type="text" id="ap-desc" class="form-control" required value="${p ? escHtml(p.description || '') : ''}" placeholder="Mô tả ngắn hiển thị trên thẻ...">
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Chi tiết sản phẩm</label>
          <textarea id="ap-detail" class="form-control" rows="3" placeholder="Thông tin chi tiết, công dụng, thành phần...">${p ? escHtml(p.detail || '') : ''}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:700;">Trạng thái kinh doanh</label>
          <select id="ap-status" class="form-control">
            <option value="ACTIVE" ${!p || p.status === 'ACTIVE' ? 'selected' : ''}>Đang bán</option>
            <option value="INACTIVE" ${p && p.status === 'INACTIVE' ? 'selected' : ''}>Ngừng bán</option>
          </select>
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-admin-product-form').classList.remove('active')">Hủy</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-ap">${isEdit ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>
        </div>
      </form>
    </div>`;

  setTimeout(() => {
    modal.classList.add('active');
    renderProductImagePreviewGrid('ap-upload-container');
  }, 10);
}

async function submitAdminProductForm(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-ap');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...'; }

  try {
    const uploadedUrls = await uploadAllProductImages();

    const payload = {
      name: document.getElementById('ap-name').value.trim(),
      category: document.getElementById('ap-cat').value,
      product_code: document.getElementById('ap-code').value.trim(),
      price: parseFloat(document.getElementById('ap-price').value),
      stock: parseInt(document.getElementById('ap-stock').value) || 0,
      image_url: uploadedUrls[0],
      image_urls: uploadedUrls,
      description: document.getElementById('ap-desc').value.trim(),
      detail: document.getElementById('ap-detail').value.trim(),
      status: document.getElementById('ap-status').value
    };

    const url = storeEditProductId ? `/store/products/${storeEditProductId}` : '/store/products';
    const method = storeEditProductId ? 'PUT' : 'POST';

    const res = await apiRequest(url, method, payload);
    if (res.success) {
      showToast(res.message || 'Lưu sản phẩm thành công!', 'success');
      document.getElementById('modal-admin-product-form')?.classList.remove('active');
      if (document.getElementById('view-doctor-products')?.style.display !== 'none') {
        await loadDoctorProductsTable();
        renderDoctorProductsTable();
      } else {
        await loadAdminProductsTable();
        renderAdminProductsTable();
      }
      storeAllProducts = [];
    } else {
      showToast(res.message || 'Lỗi lưu sản phẩm.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Không thể tải ảnh lên. Vui lòng thử lại.', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = storeEditProductId ? 'Lưu thay đổi' : 'Thêm sản phẩm'; }
}


async function deleteAdminProduct(id, name) {
  if (!confirm(`Bạn có chắc muốn XÓA sản phẩm "${name}"?\n\nHành động này không thể hoàn tác!`)) return;
  const res = await apiRequest(`/store/products/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message, 'success');
    if (document.getElementById('view-doctor-products')?.style.display !== 'none') {
      await loadDoctorProductsTable();
      renderDoctorProductsTable();
    } else {
      await loadAdminProductsTable();
      renderAdminProductsTable();
    }
    storeAllProducts = [];
  } else {
    showToast(res.message, 'error');
  }
}

/* ════════════════════════════════════════════════════════
   ADMIN VIEW 2: ORDER MANAGEMENT
════════════════════════════════════════════════════════ */
let adminOrdersData = [];

async function renderAdminOrdersView() {
  const container = document.getElementById('view-admin-orders');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <h2 class="store-page-title">Quản lý đơn hàng (Admin)</h2>
    </div>

    <!-- Status Tabs -->
    <div class="store-cat-pills" style="margin-bottom:20px; overflow-x:auto; white-space:nowrap; padding-bottom:6px;">
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'ALL' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('ALL')">Tất cả</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'PENDING' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('PENDING')">Chờ xác nhận</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'CONFIRMED' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('CONFIRMED')">Đã xác nhận</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'SHIPPING' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('SHIPPING')">Đang giao</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'DELIVERED' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('DELIVERED')">Đã giao</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'COMPLETED' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('COMPLETED')">Hoàn thành</button>
      <button class="cat-pill ${storeAdminOrdersStatusFilter === 'CANCELLED' ? 'active' : ''}" onclick="setAdminOrdersStatusFilter('CANCELLED')">Đã hủy</button>
    </div>

    <div id="admin-orders-wrap">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách đơn hàng...</div>
    </div>`;

  const wrap = document.getElementById('admin-orders-wrap');
  try {
    const res = await apiRequest('/store/orders');
    if (!res.success) {
      if (wrap) {
        wrap.innerHTML = `
          <div class="empty-state" style="padding:40px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải danh sách đơn hàng</p>
            <p style="color:var(--text-muted); margin-bottom:16px;">${res.message || 'Lỗi kết nối.'}</p>
            <button class="btn btn-primary btn-sm" onclick="renderAdminOrdersView()">Thử lại</button>
          </div>`;
      }
      return;
    }
    adminOrdersData = res.orders || [];
    renderAdminOrdersTable();
  } catch (err) {
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi kết nối khi tải đơn hàng</p>
          <button class="btn btn-primary btn-sm" onclick="renderAdminOrdersView()">Thử lại</button>
        </div>`;
    }
  }
}

function setAdminOrdersStatusFilter(status) {
  storeAdminOrdersStatusFilter = status;
  document.querySelectorAll('#view-admin-orders .cat-pill').forEach(btn => {
    const text = btn.textContent.trim();
    const map = {
      'Tất cả': 'ALL',
      'Chờ xác nhận': 'PENDING',
      'Đã xác nhận': 'CONFIRMED',
      'Đang giao': 'SHIPPING',
      'Đã giao': 'DELIVERED',
      'Hoàn thành': 'COMPLETED',
      'Đã hủy': 'CANCELLED'
    };
    btn.classList.toggle('active', map[text] === status);
  });
  renderAdminOrdersTable();
}

function renderAdminOrdersTable() {
  const wrap = document.getElementById('admin-orders-wrap');
  if (!wrap) return;

  let filtered = adminOrdersData;
  if (storeAdminOrdersStatusFilter !== 'ALL') {
    filtered = filtered.filter(o => o.order_status === storeAdminOrdersStatusFilter);
  }

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:60px; text-align:center; background:#fff; border-radius:10px; border:1px solid var(--border);"><i class="fa-solid fa-clipboard-list" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i><p style="font-weight:700; color:var(--text-color);">Chưa có đơn hàng nào.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Khách hàng</th>
            <th>Sản phẩm / Người bán</th>
            <th>Tổng tiền</th>
            <th>PT Thanh toán</th>
            <th>Trạng thái đơn</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(o => {
            const st = ORDER_STATUS_MAP[o.order_status] || { text: o.order_status, cls: 'badge-secondary' };
            const py = PAYMENT_STATUS_MAP[o.payment_status] || { text: o.payment_status, cls: 'badge-secondary' };
            const sellers = [...new Set((o.items || []).map(i => i.doctor_name).filter(Boolean))].join(', ') || 'Sen Chăm Boss';

            return `
              <tr>
                <td>
                  <div style="font-weight:800; font-family:monospace; font-size:12px; color:var(--primary);">${o.order_code || '#' + o.id.substring(0,8)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString('vi-VN')}</div>
                </td>
                <td>
                  <div style="font-weight:600; font-size:13px;">${escHtml(o.customer_name || o.user_name || '')}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${o.phone || ''}</div>
                </td>
                <td>
                  <div style="font-size:12px; font-weight:600;">${(o.items||[]).length} sản phẩm</div>
                  <div style="font-size:11px; color:var(--primary);"><i class="fa-solid fa-user-doctor"></i> ${escHtml(sellers)}</div>
                </td>
                <td style="font-weight:700; color:var(--primary); white-space:nowrap;">
                  ${o.total_amount?.toLocaleString('vi-VN')} ₫
                  ${o.discount_amount ? `<div style="font-size:10px; color:#059669; font-weight:600;">(Đã giảm ${o.discount_amount.toLocaleString('vi-VN')} ₫)</div>` : ''}
                </td>
                <td>
                  <div style="font-size:12px; font-weight:600;">${o.payment_method === 'ONLINE' ? 'Online Gateway' : 'COD'}</div>
                  <span class="badge ${py.cls}" style="font-size:10px;">${py.text}</span>
                </td>
                <td>
                  <select class="form-control" style="font-size:11px; padding:3px 6px; height:auto; width:130px;" onchange="updateAdminOrderStatus('${o.id}', this.value)">
                    <option value="PENDING" ${o.order_status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
                    <option value="CONFIRMED" ${o.order_status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option>
                    <option value="SHIPPING" ${o.order_status === 'SHIPPING' ? 'selected' : ''}>Đang giao</option>
                    <option value="DELIVERED" ${o.order_status === 'DELIVERED' ? 'selected' : ''}>Đã giao</option>
                    <option value="COMPLETED" ${o.order_status === 'COMPLETED' ? 'selected' : ''}>Hoàn thành</option>
                    <option value="CANCELLED" ${o.order_status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option>
                  </select>
                </td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="viewAdminOrderDetail('${o.id}')" title="Xem chi tiết">
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:right;">Hiển thị ${filtered.length} / ${adminOrdersData.length} đơn hàng</div>`;
}

async function updateAdminOrderStatus(orderId, order_status) {
  const res = await apiRequest(`/store/orders/${orderId}/status`, 'PATCH', { order_status });
  if (res.success) {
    showToast('Đã cập nhật trạng thái đơn hàng.', 'success');
    if (document.getElementById('view-doctor-orders')?.style.display !== 'none') {
      renderDoctorOrdersView();
    } else {
      renderAdminOrdersView();
    }
  } else {
    showToast(res.message || 'Lỗi cập nhật.', 'error');
    renderAdminOrdersView();
  }
}

async function viewAdminOrderDetail(orderId) {
  const res = await apiRequest(`/store/orders/${orderId}`);
  if (!res.success) { showToast('Không thể tải chi tiết.', 'error'); return; }

  const o = res.order;
  const st = ORDER_STATUS_MAP[o.order_status] || { text: o.order_status, cls: 'badge-secondary' };
  const py = PAYMENT_STATUS_MAP[o.payment_status] || { text: o.payment_status, cls: 'badge-secondary' };

  let modal = document.getElementById('modal-admin-order-detail');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-admin-order-detail';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:600px; max-height:92vh; overflow-y:auto; padding:20px; border-radius:14px;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
        <h3 style="margin:0; font-size:18px; font-weight:800;">Chi tiết đơn hàng</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-admin-order-detail').classList.remove('active')" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-muted);">&times;</button>
      </div>
      <div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center;">
          <span class="badge ${st.cls}">${st.text}</span>
          <span class="badge ${py.cls}" style="font-size:11px;">${py.text}</span>
          <span style="font-size:12px; color:var(--text-muted); margin-left:auto;">${new Date(o.created_at).toLocaleString('vi-VN')}</span>
        </div>

        <div class="card-box" style="margin-bottom:14px; font-size:13px; background:#f9fafb; padding:14px; border-radius:10px; border:1px solid #e5e7eb;">
          <div style="font-weight:700; margin-bottom:8px; color:var(--text-color);">Thông tin khách hàng & Giao hàng</div>
          <div>Tên: <strong>${escHtml(o.customer_name || o.user_name || '')}</strong></div>
          <div>Email: <strong>${o.user_email || ''}</strong></div>
          <div>Điện thoại: <strong>${o.phone || ''}</strong></div>
          <div>Địa chỉ: <strong>${escHtml(o.full_address || o.address || '')}</strong></div>
          <div>Phương thức thanh toán: <strong>${o.payment_method === 'ONLINE' ? 'Thanh toán Online (Gateway)' : 'Tiền mặt khi nhận (COD)'}</strong></div>
          ${o.notes ? `<div>Ghi chú: <em>${escHtml(o.notes)}</em></div>` : ''}
        </div>

        <div style="font-weight:700; font-size:13px; margin-bottom:8px;">Danh sách sản phẩm</div>
        ${(o.items || []).map(item => `
          <div class="checkout-item-row" style="margin-bottom:8px; display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px dashed #eee;">
            <div style="width:50px; height:50px; border-radius:8px; overflow:hidden; background:#f0f0f0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${item.image_url ? `<img src="${item.image_url}" alt="${escHtml(item.product_name || item.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : '<i class="fa-solid fa-paw"></i>'}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600;">${escHtml(item.product_name || item.name)}</div>
              <div style="font-size:11px; color:var(--primary); font-weight:600;"><i class="fa-solid fa-user-doctor"></i> ${escHtml(item.doctor_name || 'Sen Chăm Boss')}</div>
              ${item.variant ? `<span style="font-size:10px; background:#f1f5f9; color:var(--text-muted); padding:2px 6px; border-radius:4px;">${escHtml(item.variant)}</span>` : ''}
              <div style="font-size:11px; color:var(--text-muted);">${item.product_code || ''} · ${item.price?.toLocaleString('vi-VN')} ₫ × ${item.quantity}</div>
            </div>
            <div style="font-weight:700; color:var(--primary);">${(item.subtotal || (item.price * item.quantity))?.toLocaleString('vi-VN')} ₫</div>
          </div>
        `).join('')}

        <div style="border-top:2px solid var(--border); padding-top:12px; margin-top:12px; background:var(--bg-light); padding:12px; border-radius:10px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;"><span>Tạm tính</span><strong>${(o.subtotal || 0).toLocaleString('vi-VN')} ₫</strong></div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;"><span>Phí vận chuyển</span><strong>${(o.shipping_fee || 30000).toLocaleString('vi-VN')} ₫</strong></div>
          ${o.discount_amount ? `
            <div style="display:flex; justify-content:space-between; font-size:13px; color:#059669; margin-bottom:4px;"><span>Giảm giá voucher (${o.voucher_code || ''})</span><strong>-${o.discount_amount.toLocaleString('vi-VN')} ₫</strong></div>
          ` : ''}
          <div style="border-top:1px solid #ddd; margin:6px 0;"></div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:800;"><span>Tổng cộng</span><span style="color:var(--primary);">${o.total_amount?.toLocaleString('vi-VN')} ₫</span></div>
        </div>

        <div style="margin-top:16px; display:flex; gap:12px; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="font-size:13px; font-weight:600;">Cập nhật trạng thái:</label>
            <select class="form-control" style="width:auto;" onchange="updateAdminOrderStatus('${o.id}', this.value); document.getElementById('modal-admin-order-detail').classList.remove('active');">
              <option value="PENDING" ${o.order_status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
              <option value="CONFIRMED" ${o.order_status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option>
              <option value="SHIPPING" ${o.order_status === 'SHIPPING' ? 'selected' : ''}>Đang giao</option>
              <option value="DELIVERED" ${o.order_status === 'DELIVERED' ? 'selected' : ''}>Đã giao</option>
              <option value="COMPLETED" ${o.order_status === 'COMPLETED' ? 'selected' : ''}>Hoàn thành</option>
              <option value="CANCELLED" ${o.order_status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option>
            </select>
          </div>
        </div>
      </div>
    </div>`;

  setTimeout(() => modal.classList.add('active'), 10);
}

/* ════════════════════════════════════════════════════════
   ADMIN VIEW 3: VOUCHER MANAGEMENT
════════════════════════════════════════════════════════ */
async function renderAdminVouchersView() {
  const container = document.getElementById('view-admin-vouchers');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <div>
        <h2 class="store-page-title">Quản lý Voucher Khuyến Mãi</h2>
        <p class="store-page-sub">Tạo và quản lý các mã giảm giá cho khách hàng</p>
      </div>
      <button class="btn btn-primary" onclick="openAdminVoucherModal()">
        <i class="fa-solid fa-plus"></i> Tạo voucher mới
      </button>
    </div>

    <div id="admin-vouchers-table-wrap">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách voucher...</div>
    </div>`;

  await loadAdminVouchersTable();
  renderAdminVouchersTable();
}

async function loadAdminVouchersTable() {
  const wrap = document.getElementById('admin-vouchers-table-wrap');
  try {
    const res = await apiRequest('/store/admin/vouchers');
    if (!res.success) {
      if (wrap) {
        wrap.innerHTML = `
          <div class="empty-state" style="padding:40px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải dữ liệu voucher</p>
            <p style="color:var(--text-muted); margin-bottom:16px;">${res.message || 'Lỗi kết nối.'}</p>
            <button class="btn btn-primary btn-sm" onclick="loadAdminVouchersTable().then(renderAdminVouchersTable)">Thử lại</button>
          </div>`;
      }
      return;
    }
    storeAdminVouchers = res.vouchers || [];
  } catch (err) {
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi tải dữ liệu voucher</p>
          <button class="btn btn-primary btn-sm" onclick="loadAdminVouchersTable().then(renderAdminVouchersTable)">Thử lại</button>
        </div>`;
    }
  }
}

function renderAdminVouchersTable() {
  const wrap = document.getElementById('admin-vouchers-table-wrap');
  if (!wrap) return;

  if (!storeAdminVouchers.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:60px; text-align:center; background:#fff; border-radius:14px; border:1px solid var(--border);">
        <i class="fa-solid fa-ticket" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i>
        <p style="font-size:18px; font-weight:700; margin-bottom:8px; color:var(--text-color);">Chưa có voucher nào</p>
        <p style="color:var(--text-muted); margin-bottom:20px;">Tạo voucher đầu tiên để kích thích mua sắm.</p>
        <button class="btn btn-primary" onclick="openAdminVoucherModal()">
          <i class="fa-solid fa-plus"></i> Tạo voucher ngay
        </button>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã Voucher</th>
            <th>Tên chương trình</th>
            <th>Loại giảm</th>
            <th>Giá trị giảm</th>
            <th>Đơn tối thiểu</th>
            <th>Lượt dùng</th>
            <th>Hiệu lực</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${storeAdminVouchers.map(v => {
            const isPercent = v.discount_type === 'PERCENT';
            const valueDisp = isPercent ? `${v.discount_value}% ${v.maximum_discount ? `(Max ${v.maximum_discount.toLocaleString('vi-VN')} ₫)` : ''}` : `${v.discount_value.toLocaleString('vi-VN')} ₫`;
            const isActive = v.is_active !== false;

            return `
              <tr>
                <td style="font-family:monospace; font-weight:800; font-size:14px; color:var(--primary);">${escHtml(v.code)}</td>
                <td>
                  <div style="font-weight:600; font-size:13px;">${escHtml(v.name)}</div>
                </td>
                <td><span class="badge ${isPercent ? 'badge-primary' : 'badge-info'}">${isPercent ? 'Giảm theo %' : 'Giảm số tiền'}</span></td>
                <td style="font-weight:700; color:var(--primary);">${valueDisp}</td>
                <td>${(v.minimum_order_value || 0).toLocaleString('vi-VN')} ₫</td>
                <td>
                  <span style="font-weight:700;">${v.used_count || 0}</span> / ${v.usage_limit || '∞'}
                </td>
                <td style="font-size:12px; color:var(--text-muted);">
                  ${v.start_date || 'N/A'} → ${v.end_date || 'N/A'}
                </td>
                <td>
                  <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}" style="cursor:pointer;" onclick="toggleAdminVoucher('${v.id}')" title="Bấm để bật/tắt">
                    ${isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-sm" onclick="openAdminVoucherModal('${v.id}')" title="Sửa">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    ${(v.used_count || 0) === 0 ? `
                      <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="deleteAdminVoucher('${v.id}', '${escHtml(v.code)}')" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:right;">Tổng: ${storeAdminVouchers.length} voucher</div>`;
}

function openAdminVoucherModal(voucherId = null) {
  storeEditVoucherId = voucherId;
  const isEdit = !!voucherId;
  const v = isEdit ? storeAdminVouchers.find(x => x.id === voucherId) : null;

  let modal = document.getElementById('modal-admin-voucher-form');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-admin-voucher-form';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px; max-height:90vh; overflow-y:auto; border-radius:14px;">
      <div class="modal-header">
        <h3>${isEdit ? 'Chỉnh sửa voucher' : 'Tạo voucher khuyến mãi mới'}</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-admin-voucher-form').classList.remove('active')">&times;</button>
      </div>
      <form id="form-admin-voucher" onsubmit="submitAdminVoucherForm(event)" style="padding:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Mã Voucher <span style="color:var(--danger)">*</span></label>
            <input type="text" id="av-code" class="form-control" required style="text-transform:uppercase; font-weight:700; font-family:monospace;" value="${v ? escHtml(v.code) : ''}" placeholder="BOSS20" ${isEdit ? 'readonly' : ''}>
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Loại giảm giá <span style="color:var(--danger)">*</span></label>
            <select id="av-type" class="form-control" onchange="onVoucherTypeChange(this.value)">
              <option value="PERCENT" ${!v || v.discount_type === 'PERCENT' ? 'selected' : ''}>Giảm theo %</option>
              <option value="FIXED" ${v && v.discount_type === 'FIXED' ? 'selected' : ''}>Giảm số tiền cố định (₫)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600;">Tên voucher / Mô tả ngắn <span style="color:var(--danger)">*</span></label>
          <input type="text" id="av-name" class="form-control" required value="${v ? escHtml(v.name) : ''}" placeholder="Giảm 20% cho thành viên mới...">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;" id="av-val-label">Giá trị giảm (% hoặc ₫) <span style="color:var(--danger)">*</span></label>
            <input type="number" id="av-val" class="form-control" required min="1" value="${v ? v.discount_value : ''}" placeholder="20">
          </div>
          <div class="form-group" id="av-max-box">
            <label style="font-size:13px; font-weight:600;">Giảm tối đa (₫)</label>
            <input type="number" id="av-max" class="form-control" min="0" step="1000" value="${v && v.maximum_discount ? v.maximum_discount : ''}" placeholder="50000">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Đơn tối thiểu (₫)</label>
            <input type="number" id="av-min" class="form-control" min="0" step="1000" value="${v ? v.minimum_order_value : 0}" placeholder="200000">
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Số lượt sử dụng tối đa</label>
            <input type="number" id="av-limit" class="form-control" min="1" value="${v ? v.usage_limit : 100}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Ngày bắt đầu</label>
            <input type="date" id="av-start" class="form-control" value="${v ? v.start_date : new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:600;">Ngày kết thúc</label>
            <input type="date" id="av-end" class="form-control" value="${v ? v.end_date : '2026-12-31'}">
          </div>
        </div>

        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-admin-voucher-form').classList.remove('active')">Hủy</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-av">${isEdit ? 'Lưu thay đổi' : 'Tạo voucher'}</button>
        </div>
      </form>
    </div>`;

  setTimeout(() => modal.classList.add('active'), 10);
}

function onVoucherTypeChange(type) {
  const maxBox = document.getElementById('av-max-box');
  const label = document.getElementById('av-val-label');
  if (type === 'FIXED') {
    if (maxBox) maxBox.style.display = 'none';
    if (label) label.textContent = 'Số tiền giảm (₫) *';
  } else {
    if (maxBox) maxBox.style.display = 'block';
    if (label) label.textContent = 'Phần trăm giảm (%) *';
  }
}

async function submitAdminVoucherForm(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-av');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  const payload = {
    code: document.getElementById('av-code').value.trim(),
    name: document.getElementById('av-name').value.trim(),
    discount_type: document.getElementById('av-type').value,
    discount_value: parseFloat(document.getElementById('av-val').value),
    maximum_discount: parseFloat(document.getElementById('av-max').value) || null,
    minimum_order_value: parseFloat(document.getElementById('av-min').value) || 0,
    usage_limit: parseInt(document.getElementById('av-limit').value) || 100,
    start_date: document.getElementById('av-start').value,
    end_date: document.getElementById('av-end').value
  };

  const url = storeEditVoucherId ? `/store/admin/vouchers/${storeEditVoucherId}` : '/store/admin/vouchers';
  const method = storeEditVoucherId ? 'PUT' : 'POST';

  try {
    const res = await apiRequest(url, method, payload);
    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('modal-admin-voucher-form')?.classList.remove('active');
      await loadAdminVouchersTable();
      renderAdminVouchersTable();
    } else {
      showToast(res.message || 'Lỗi lưu voucher.', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi lưu voucher.', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = storeEditVoucherId ? 'Lưu thay đổi' : 'Tạo voucher'; }
}

async function toggleAdminVoucher(id) {
  const res = await apiRequest(`/store/admin/vouchers/${id}/toggle`, 'PATCH', {});
  if (res.success) {
    showToast(res.message, 'success');
    await loadAdminVouchersTable();
    renderAdminVouchersTable();
  } else {
    showToast(res.message || 'Lỗi thay đổi trạng thái voucher.', 'error');
  }
}

async function deleteAdminVoucher(id, code) {
  if (!confirm(`Bạn có chắc muốn xóa voucher "${code}"?`)) return;
  const res = await apiRequest(`/store/admin/vouchers/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message, 'success');
    await loadAdminVouchersTable();
    renderAdminVouchersTable();
  } else {
    showToast(res.message || 'Không thể xóa voucher.', 'error');
  }
}

let storeDoctorProdFilter = 'ALL';
let storeDoctorProdSearch = '';
let storeDoctorProdSort = 'NEWEST';


async function renderDoctorProductsView() {
  const container = document.getElementById('view-doctor-products');
  if (!container) return;

  container.innerHTML = `
    <div class="seller-center-wrap">
      <!-- 1. Header Trang -->
      <div class="seller-header">
        <div>
          <h2 class="seller-header-title">Sản phẩm của tôi</h2>
          <p class="seller-header-sub">Quản lý sản phẩm, giá bán và kinh doanh trực tiếp trên Sen Chăm Boss</p>
        </div>
        <button type="button" class="seller-header-btn" onclick="openDoctorProductModal()">
          <i class="fa-solid fa-plus"></i> Đăng sản phẩm mới
        </button>
      </div>

      <!-- 2. Khu vực Thống kê (4 KPI Cards) -->
      <div class="seller-stats-grid" id="doctor-stats-grid">
        <div class="seller-stat-card">
          <div class="seller-stat-icon total"><i class="fa-solid fa-box"></i></div>
          <div class="seller-stat-info">
            <span class="seller-stat-num" id="stat-total-prod">0</span>
            <span class="seller-stat-label">Tổng sản phẩm</span>
          </div>
        </div>
        <div class="seller-stat-card">
          <div class="seller-stat-icon active"><i class="fa-solid fa-circle-check"></i></div>
          <div class="seller-stat-info">
            <span class="seller-stat-num" id="stat-active-prod">0</span>
            <span class="seller-stat-label">Đang bán</span>
          </div>
        </div>
        <div class="seller-stat-card">
          <div class="seller-stat-icon out"><i class="fa-solid fa-circle-exclamation"></i></div>
          <div class="seller-stat-info">
            <span class="seller-stat-num" id="stat-out-prod">0</span>
            <span class="seller-stat-label">Hết hàng</span>
          </div>
        </div>
        <div class="seller-stat-card">
          <div class="seller-stat-icon pending" style="background:#f1f5f9; color:#64748b;"><i class="fa-solid fa-eye-slash"></i></div>
          <div class="seller-stat-info">
            <span class="seller-stat-num" id="stat-inactive-prod">0</span>
            <span class="seller-stat-label">Đã ẩn</span>
          </div>
        </div>
      </div>

      <!-- 3. Thanh Tìm kiếm + Bộ Lọc + Sắp Xếp -->
      <div class="seller-filter-wrap">
        <div class="seller-search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="doc-prod-search" class="form-control" placeholder="Tìm kiếm sản phẩm theo tên, mã..." value="${storeDoctorProdSearch}" oninput="onDoctorProdSearch(this.value)">
        </div>

        <div class="seller-pills-row" id="doc-pills-row">
          <button type="button" class="cat-pill ${storeDoctorProdFilter === 'ALL' ? 'active' : ''}" onclick="setDoctorProdFilter('ALL')">Tất cả</button>
          <button type="button" class="cat-pill ${storeDoctorProdFilter === 'ACTIVE' ? 'active' : ''}" onclick="setDoctorProdFilter('ACTIVE')">Đang bán</button>
          <button type="button" class="cat-pill ${storeDoctorProdFilter === 'OUT_OF_STOCK' ? 'active' : ''}" onclick="setDoctorProdFilter('OUT_OF_STOCK')">Hết hàng</button>
          <button type="button" class="cat-pill ${storeDoctorProdFilter === 'INACTIVE' ? 'active' : ''}" onclick="setDoctorProdFilter('INACTIVE')">Đã ẩn</button>
        </div>

        <div>
          <select id="doc-prod-sort" class="form-control seller-sort-select" onchange="onDoctorProdSort(this.value)">
            <option value="NEWEST" ${storeDoctorProdSort === 'NEWEST' ? 'selected' : ''}>Sắp xếp: Mới nhất</option>
            <option value="PRICE_ASC" ${storeDoctorProdSort === 'PRICE_ASC' ? 'selected' : ''}>Giá: Thấp → Cao</option>
            <option value="PRICE_DESC" ${storeDoctorProdSort === 'PRICE_DESC' ? 'selected' : ''}>Giá: Cao → Thấp</option>
            <option value="BEST_SELLER" ${storeDoctorProdSort === 'BEST_SELLER' ? 'selected' : ''}>Bán chạy nhất</option>
          </select>
        </div>
      </div>

      <!-- 4. Danh sách Sản phẩm Grid / Empty State -->
      <div id="doctor-products-grid-wrap">
        <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải sản phẩm của bạn...</div>
      </div>
    </div>`;

  await loadDoctorProductsTable();
  updateDoctorStats();
  renderDoctorProductsTable();
}

async function loadDoctorProductsTable() {
  const wrap = document.getElementById('doctor-products-grid-wrap');
  try {
    const res = await apiRequest('/store/products?view=my_products');
    if (!res.success) {
      if (wrap) {
        wrap.innerHTML = `
          <div class="seller-empty-box">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <h3 style="font-size:16px; font-weight:800; color:var(--danger); margin-bottom:6px;">Không thể tải danh sách sản phẩm</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">${res.message || 'Lỗi kết nối máy chủ.'}</p>
            <button class="btn btn-primary btn-sm" onclick="loadDoctorProductsTable().then(renderDoctorProductsTable)">Thử lại</button>
          </div>`;
      }
      return;
    }
    storeDoctorProducts = res.products || [];
  } catch (err) {
    if (wrap) {
      wrap.innerHTML = `
        <div class="seller-empty-box">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <h3 style="font-size:16px; font-weight:800; color:var(--danger); margin-bottom:6px;">Lỗi tải dữ liệu</h3>
          <button class="btn btn-primary btn-sm" onclick="loadDoctorProductsTable().then(renderDoctorProductsTable)">Thử lại</button>
        </div>`;
    }
  }
}

function updateDoctorStats() {
  const total = storeDoctorProducts.length;
  const active = storeDoctorProducts.filter(p => p.status === 'ACTIVE' && (p.stock || 0) > 0).length;
  const out = storeDoctorProducts.filter(p => (p.stock || 0) <= 0).length;
  const inactive = storeDoctorProducts.filter(p => p.status === 'INACTIVE').length;

  const totalEl = document.getElementById('stat-total-prod');
  const activeEl = document.getElementById('stat-active-prod');
  const outEl = document.getElementById('stat-out-prod');
  const inactiveEl = document.getElementById('stat-inactive-prod');

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (outEl) outEl.textContent = out;
  if (inactiveEl) inactiveEl.textContent = inactive;
}

function onDoctorProdSearch(val) {
  storeDoctorProdSearch = val;
  renderDoctorProductsTable();
}

function setDoctorProdFilter(filter) {
  storeDoctorProdFilter = filter;
  document.querySelectorAll('#doc-pills-row .cat-pill').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick').includes(`'${filter}'`));
  });
  renderDoctorProductsTable();
}

function onDoctorProdSort(sort) {
  storeDoctorProdSort = sort;
  renderDoctorProductsTable();
}

function renderDoctorProductsTable() {
  const wrap = document.getElementById('doctor-products-grid-wrap');
  if (!wrap) return;

  updateDoctorStats();

  // If Doctor has 0 products in total -> Show Clean Seller Center Empty State
  if (!storeDoctorProducts.length) {
    wrap.innerHTML = `
      <div class="seller-empty-box">
        <div class="seller-empty-icon"><i class="fa-solid fa-box-open"></i></div>
        <h3 style="font-size:18px; font-weight:800; color:var(--text-main); margin-bottom:8px;">Chưa có sản phẩm nào</h3>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px; line-height:1.5;">Đăng sản phẩm đầu tiên để bắt đầu bán trực tiếp các sản phẩm chăm sóc thú cưng.</p>
        <button type="button" class="btn btn-primary" style="padding:10px 24px; font-weight:800; border-radius:10px;" onclick="openDoctorProductModal()">
          <i class="fa-solid fa-plus"></i> Đăng sản phẩm mới
        </button>
      </div>`;
    return;
  }

  // Filter
  let filtered = [...storeDoctorProducts];
  if (storeDoctorProdFilter === 'ACTIVE') {
    filtered = filtered.filter(p => p.status === 'ACTIVE' && (p.stock || 0) > 0);
  } else if (storeDoctorProdFilter === 'OUT_OF_STOCK') {
    filtered = filtered.filter(p => (p.stock || 0) <= 0);
  } else if (storeDoctorProdFilter === 'INACTIVE') {
    filtered = filtered.filter(p => p.status === 'INACTIVE');
  }

  if (storeDoctorProdSearch) {
    const s = storeDoctorProdSearch.toLowerCase().trim();
    filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.product_code || '').toLowerCase().includes(s) ||
      (p.description || '').toLowerCase().includes(s) ||
      (p.category || '').toLowerCase().includes(s)
    );
  }

  // Sort
  if (storeDoctorProdSort === 'PRICE_ASC') {
    filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (storeDoctorProdSort === 'PRICE_DESC') {
    filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (storeDoctorProdSort === 'BEST_SELLER') {
    filtered.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
  } else {
    // NEWEST
    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  if (!filtered.length) {
    wrap.innerHTML = `
      <div class="seller-empty-box" style="padding:36px 20px;">
        <i class="fa-solid fa-filter-circle-xmark" style="font-size:36px; color:var(--text-muted); margin-bottom:12px;"></i>
        <h3 style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:6px;">Không tìm thấy sản phẩm phù hợp</h3>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">Vui lòng thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="setDoctorProdFilter('ALL'); document.getElementById('doc-prod-search').value=''; onDoctorProdSearch('');">
          Xem tất cả sản phẩm
        </button>
      </div>`;
    return;
  }

  // Render 3-column Grid
  wrap.innerHTML = `
    <div class="seller-products-grid">
      ${filtered.map(p => {
        const isHidden = p.status === 'INACTIVE';
        const isOutOfStock = (p.stock || 0) <= 0;

        let statusBadgeHtml = '';
        if (isHidden) {
          statusBadgeHtml = '<span class="badge badge-secondary" style="font-size:11px; font-weight:700;"><i class="fa-solid fa-eye-slash"></i> Đã ẩn</span>';
        } else if (isOutOfStock) {
          statusBadgeHtml = '<span class="badge badge-danger" style="font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> Hết hàng</span>';
        } else {
          statusBadgeHtml = '<span class="badge badge-success" style="font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Đang bán</span>';
        }

        return `
          <div class="seller-prod-card" style="${isHidden ? 'opacity:0.85; background:#fafafa;' : ''}">
            <div class="seller-prod-img-wrap">
              ${p.image_url ? `<img src="${p.image_url}" alt="${escHtml(p.name)}" onerror="this.outerHTML='<i class="fa-solid fa-paw"></i>'">` : '<div style="font-size:40px;"><i class="fa-solid fa-paw"></i></div>'}
              <div class="seller-prod-tag-top">
                <span class="badge badge-secondary" style="font-size:10px; background:rgba(15,23,42,0.75); color:#fff; backdrop-filter:blur(4px); border:none;">${escHtml(p.category || 'Khác')}</span>
              </div>
              <div class="seller-prod-tag-status">
                ${statusBadgeHtml}
              </div>
            </div>

            <div class="seller-prod-body">
              <div class="seller-prod-code">Mã: ${escHtml(p.product_code || 'N/A')}</div>
              <h4 class="seller-prod-name" title="${escHtml(p.name)}">${escHtml(p.name)}</h4>
              <div class="seller-prod-price">${(p.price || 0).toLocaleString('vi-VN')} ₫</div>

              <div class="seller-prod-stats">
                <div><span>Tồn kho:</span> <strong style="color:${isOutOfStock ? 'var(--danger)' : 'inherit'};">${p.stock || 0}</strong></div>
                <div><span>Đã bán:</span> <strong>${p.sold_count || 0}</strong></div>
              </div>

              <div class="seller-prod-actions">
                <button type="button" class="btn btn-outline btn-sm" style="flex:1;" onclick="openDoctorProductModal('${p.id}')">
                  <i class="fa-solid fa-pen"></i> Sửa
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:8px 10px;" onclick="toggleDoctorProductStatus('${p.id}')" title="${isHidden ? 'Mở bán lại' : 'Ẩn sản phẩm'}">
                  <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Hiện' : 'Ẩn'}
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:8px 10px;" onclick="openProductDetailModal('${p.id}')" title="Xem trên cửa hàng">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); padding:8px 10px;" onclick="deleteDoctorProduct('${p.id}', '${escHtml(p.name)}')" title="Xóa">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:14px; text-align:right;">Hiển thị ${filtered.length} / ${storeDoctorProducts.length} sản phẩm</div>`;
}

async function toggleDoctorProductStatus(productId) {
  const res = await apiRequest(`/store/products/${productId}/toggle-status`, 'PATCH');
  if (res.success) {
    showToast(res.message, 'success');
    await loadDoctorProductsTable();
    renderDoctorProductsTable();
    storeAllProducts = [];
  } else {
    showToast(res.message || 'Lỗi thay đổi trạng thái sản phẩm.', 'error');
  }
}

function openDoctorProductModal(productId = null) {
  storeEditProductId = productId;
  const isEdit = !!productId;
  const p = isEdit ? storeDoctorProducts.find(x => x.id === productId) : null;

  // Initialize product images state
  if (p) {
    const existingUrls = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
    productFormImages = existingUrls.map(u => ({ file: null, url: u, previewUrl: u }));
  } else {
    productFormImages = [];
  }

  let modal = document.getElementById('modal-doctor-product-form');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-doctor-product-form';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:560px; max-height:92vh; overflow-y:auto; border-radius:16px; padding:0;">
      <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
        <h3 style="font-size:17px; font-weight:800; margin:0;"><i class="fa-solid fa-box" style="color:var(--primary); margin-right:6px;"></i> ${isEdit ? 'Chỉnh sửa sản phẩm' : 'Đăng sản phẩm mới'}</h3>
        <button class="modal-close-btn" onclick="document.getElementById('modal-doctor-product-form').classList.remove('active')">&times;</button>
      </div>

      <form id="form-doctor-product" onsubmit="submitDoctorProductForm(event)" style="padding:18px 20px;">
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Tên sản phẩm <span style="color:var(--danger)">*</span></label>
          <input type="text" id="dp-name" class="form-control" required value="${p ? escHtml(p.name) : ''}" placeholder="Ví dụ: Gel Dinh Dưỡng Cho Mèo Biếng Ăn">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Danh mục <span style="color:var(--danger)">*</span></label>
            <select id="dp-cat" class="form-control">
              ${CATEGORIES.map(c => `<option value="${c}" ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Mã SP (tự động tạo nếu trống)</label>
            <input type="text" id="dp-code" class="form-control" value="${p ? (p.product_code || '') : ''}" placeholder="SP-AN-xxxxx">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Giá bán (₫) <span style="color:var(--danger)">*</span></label>
            <input type="number" id="dp-price" class="form-control" required min="1000" step="1000" value="${p ? p.price : ''}" placeholder="185000">
          </div>
          <div class="form-group">
            <label style="font-size:13px; font-weight:700;">Số lượng tồn kho <span style="color:var(--danger)">*</span></label>
            <input type="number" id="dp-stock" class="form-control" required min="0" value="${p ? p.stock : 20}">
          </div>
        </div>

        <!--  UPLOAD ẢNH TỪ MÁY / THIẾT BỊ -->
        <div class="form-group" style="margin-bottom:14px;">
          <label style="font-size:13px; font-weight:700; display:block; margin-bottom:6px;">
            <i class="fa-solid fa-camera" style="color:var(--primary); margin-right:4px;"></i> Ảnh sản phẩm <span style="color:var(--danger)">*</span>
          </label>
          <input type="file" id="dp-upload-container-file" accept="image/jpeg,image/png,image/webp,image/jpg" multiple style="display:none;" onchange="handleProductFilesSelect(event, 'dp-upload-container')">
          <div id="dp-upload-container"></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Mô tả ngắn <span style="color:var(--danger)">*</span></label>
          <input type="text" id="dp-desc" class="form-control" required value="${p ? escHtml(p.description || '') : ''}" placeholder="Mô tả công dụng chính tóm tắt...">
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:700;">Thông tin chi tiết & Hướng dẫn sử dụng</label>
          <textarea id="dp-detail" class="form-control" rows="3" placeholder="Cách dùng, liều lượng, chỉ định dinh dưỡng/y tế...">${p ? escHtml(p.detail || '') : ''}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:700;">Đối tượng sử dụng</label>
          <select id="dp-target" class="form-control">
            <option value="Chung cho thú cưng">Chung cho thú cưng (Chó & Mèo)</option>
            <option value="Dành riêng cho Chó">Dành riêng cho Chó</option>
            <option value="Dành riêng cho Mèo">Dành riêng cho Mèo</option>
          </select>
        </div>

        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px; font-size:12px; color:#15803d; margin-bottom:18px;">
          <i class="fa-solid fa-circle-check" style="color:var(--success); margin-right:4px;"></i> Sản phẩm sẽ được <strong>mở bán ngay lập tức</strong> trên Cửa hàng Sen Chăm Boss sau khi lưu.
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-doctor-product-form').classList.remove('active')">Hủy</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-dp">
            ${isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
          </button>
        </div>
      </form>
    </div>`;

  setTimeout(() => {
    modal.classList.add('active');
    renderProductImagePreviewGrid('dp-upload-container');
  }, 10);
}

async function submitDoctorProductForm(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-dp');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải ảnh & Lưu...'; }

  try {
    const uploadedUrls = await uploadAllProductImages();

    const payload = {
      name: document.getElementById('dp-name').value.trim(),
      category: document.getElementById('dp-cat').value,
      product_code: document.getElementById('dp-code').value.trim(),
      price: parseFloat(document.getElementById('dp-price').value),
      stock: parseInt(document.getElementById('dp-stock').value) || 0,
      image_url: uploadedUrls[0],
      image_urls: uploadedUrls,
      description: document.getElementById('dp-desc').value.trim(),
      detail: document.getElementById('dp-detail').value.trim(),
      colors: [document.getElementById('dp-target').value]
    };

    const url = storeEditProductId ? `/store/products/${storeEditProductId}` : '/store/products';
    const method = storeEditProductId ? 'PUT' : 'POST';

    const res = await apiRequest(url, method, payload);
    if (res.success) {
      showToast(storeEditProductId ? 'Cập nhật sản phẩm thành công!' : 'Đăng sản phẩm thành công! Sản phẩm của bạn đã mở bán trên Cửa hàng.', 'success');
      document.getElementById('modal-doctor-product-form')?.classList.remove('active');
      await loadDoctorProductsTable();
      renderDoctorProductsTable();
      storeAllProducts = [];
    } else {
      showToast(res.message || 'Lỗi lưu sản phẩm.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Không thể tải ảnh lên. Vui lòng thử lại.', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = storeEditProductId ? 'Lưu thay đổi' : 'Đăng sản phẩm'; }
}

async function deleteDoctorProduct(id, name) {
  if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${name}" khỏi danh sách của bạn?`)) return;
  const res = await apiRequest(`/store/products/${id}`, 'DELETE');
  if (res.success) {
    showToast(res.message || 'Đã xóa sản phẩm thành công.', 'success');
    await loadDoctorProductsTable();
    renderDoctorProductsTable();
    storeAllProducts = [];
  } else {
    showToast(res.message || 'Không thể xóa sản phẩm.', 'error');
  }
}

let doctorOrdersData = [];
async function renderDoctorOrdersView() {
  const container = document.getElementById('view-doctor-orders');
  if (!container) return;

  container.innerHTML = `
    <div class="store-page-header">
      <div>
        <h2 class="store-page-title">Quản lý Đơn hàng</h2>
        <p class="store-page-sub">Theo dõi đơn đặt hàng sản phẩm thú cưng</p>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="store-cat-pills" style="margin-bottom:20px; overflow-x:auto; white-space:nowrap; padding-bottom:6px;">
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'ALL' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('ALL')">Tất cả</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'PENDING' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('PENDING')">Chờ xác nhận</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'CONFIRMED' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('CONFIRMED')">Đã xác nhận</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'SHIPPING' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('SHIPPING')">Đang giao</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'DELIVERED' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('DELIVERED')">Đã giao</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'COMPLETED' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('COMPLETED')">Hoàn thành</button>
      <button class="cat-pill ${storeDoctorOrdersStatusFilter === 'CANCELLED' ? 'active' : ''}" onclick="setDoctorOrdersStatusFilter('CANCELLED')">Đã hủy</button>
    </div>

    <div id="doctor-orders-wrap">
      <div class="store-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải đơn hàng...</div>
    </div>`;

  const wrap = document.getElementById('doctor-orders-wrap');
  try {
    const res = await apiRequest('/store/orders');
    if (!res.success) {
      if (wrap) {
        wrap.innerHTML = `
          <div class="empty-state" style="padding:40px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
            <p style="font-weight:700; color:var(--danger);">Không thể tải danh sách đơn hàng</p>
            <button class="btn btn-primary btn-sm" onclick="renderDoctorOrdersView()">Thử lại</button>
          </div>`;
      }
      return;
    }
    doctorOrdersData = res.orders || [];
    renderDoctorOrdersTable();
  } catch (err) {
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:36px; color:var(--danger); margin-bottom:12px;"></i>
          <p style="font-weight:700; color:var(--danger);">Lỗi tải đơn hàng</p>
          <button class="btn btn-primary btn-sm" onclick="renderDoctorOrdersView()">Thử lại</button>
        </div>`;
    }
  }
}

function setDoctorOrdersStatusFilter(status) {
  storeDoctorOrdersStatusFilter = status;
  document.querySelectorAll('#view-doctor-orders .cat-pill').forEach(btn => {
    const text = btn.textContent.trim();
    const map = {
      'Tất cả': 'ALL',
      'Chờ xác nhận': 'PENDING',
      'Đã xác nhận': 'CONFIRMED',
      'Đang giao': 'SHIPPING',
      'Đã giao': 'DELIVERED',
      'Hoàn thành': 'COMPLETED',
      'Đã hủy': 'CANCELLED'
    };
    btn.classList.toggle('active', map[text] === status);
  });
  renderDoctorOrdersTable();
}

function renderDoctorOrdersTable() {
  const wrap = document.getElementById('doctor-orders-wrap');
  if (!wrap) return;

  let filtered = doctorOrdersData;
  if (storeDoctorOrdersStatusFilter !== 'ALL') {
    filtered = filtered.filter(o => o.order_status === storeDoctorOrdersStatusFilter);
  }

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:60px; text-align:center; background:#fff; border-radius:14px; border:1px solid var(--border);"><i class="fa-solid fa-clipboard-list" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i><p style="font-weight:700; color:var(--text-color);">Chưa có đơn hàng nào.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Khách hàng</th>
            <th>Địa chỉ nhận</th>
            <th>Tổng tiền</th>
            <th>Thanh toán</th>
            <th>Trạng thái đơn</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(o => {
            return `
              <tr>
                <td>
                  <div style="font-weight:800; font-family:monospace; font-size:12px; color:var(--primary);">${o.order_code || '#' + o.id.substring(0,8)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString('vi-VN')}</div>
                </td>
                <td>
                  <div style="font-weight:600; font-size:13px;">${escHtml(o.customer_name || o.user_name || '')}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${o.phone || ''}</div>
                </td>
                <td style="font-size:12px; max-width:180px; word-wrap:break-word;">
                  ${escHtml(o.full_address || o.address || '')}
                </td>
                <td style="font-weight:700; color:var(--primary); white-space:nowrap;">${o.total_amount?.toLocaleString('vi-VN')} ₫</td>
                <td style="font-size:12px;">${o.payment_method === 'ONLINE' ? 'Online Gateway' : 'COD'}</td>
                <td>
                  <select class="form-control" style="font-size:11px; padding:3px 6px; height:auto; width:130px;" onchange="updateAdminOrderStatus('${o.id}', this.value)">
                    <option value="PENDING" ${o.order_status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
                    <option value="CONFIRMED" ${o.order_status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option>
                    <option value="SHIPPING" ${o.order_status === 'SHIPPING' ? 'selected' : ''}>Đang giao</option>
                    <option value="DELIVERED" ${o.order_status === 'DELIVERED' ? 'selected' : ''}>Đã giao</option>
                    <option value="COMPLETED" ${o.order_status === 'COMPLETED' ? 'selected' : ''}>Hoàn thành</option>
                    <option value="CANCELLED" ${o.order_status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option>
                  </select>
                </td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="viewAdminOrderDetail('${o.id}')" title="Xem chi tiết">
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:8px; text-align:right;">Hiển thị ${filtered.length} / ${doctorOrdersData.length} đơn hàng</div>`;
}

/* ─── UTILITY ─── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ─── GLOBAL EXPORTS ─── */
window.initStoreUI = initStoreUI;
window.onStoreViewSwitch = onStoreViewSwitch;
window.renderShopView = renderShopView;
window.renderCartView = renderCartView;
window.renderCheckoutView = renderCheckoutView;
window.renderOrderSuccessView = renderOrderSuccessView;
window.renderMyOrdersView = renderMyOrdersView;
window.renderAdminProductsView = renderAdminProductsView;
window.renderAdminOrdersView = renderAdminOrdersView;
window.renderAdminVouchersView = renderAdminVouchersView;
window.renderDoctorProductsView = renderDoctorProductsView;
window.renderDoctorOrdersView = renderDoctorOrdersView;
window.setShopCategory = setShopCategory;
window.onShopSearch = onShopSearch;
window.openProductDetailModal = openProductDetailModal;
window.switchDetailThumbnail = switchDetailThumbnail;
window.selectDetailVariant = selectDetailVariant;
window.changeDetailQty = changeDetailQty;
window.addToCartFromDetail = addToCartFromDetail;
window.quickAddToCart = quickAddToCart;
window.buyNow = buyNow;
window.buyNowFromDetail = buyNowFromDetail;
window.proceedToCheckoutFromCart = proceedToCheckoutFromCart;
window.changeCartItemQty = changeCartItemQty;
window.setCartItemQty = setCartItemQty;
window.removeCartItem = removeCartItem;
window.changeCheckoutItemQty = changeCheckoutItemQty;
window.setCheckoutItemQty = setCheckoutItemQty;
window.selectShippingMethod = selectShippingMethod;
window.selectPaymentMethodRadio = selectPaymentMethodRadio;
window.openAddressModal = openAddressModal;
window.saveCheckoutAddress = saveCheckoutAddress;
window.openVoucherModal = openVoucherModal;
window.applyVoucherFromModal = applyVoucherFromModal;
window.selectVoucherCode = selectVoucherCode;
window.applyVoucherCode = applyVoucherCode;
window.removeVoucherCode = removeVoucherCode;
window.executePlaceOrder = executePlaceOrder;
window.viewMyOrderDetail = viewMyOrderDetail;
window.cancelMyOrder = cancelMyOrder;
window.confirmReceiveOrder = confirmReceiveOrder;
window.retryOnlinePayment = retryOnlinePayment;
window.setMyOrdersStatusFilter = setMyOrdersStatusFilter;
window.setAdminOrdersStatusFilter = setAdminOrdersStatusFilter;
window.setDoctorOrdersStatusFilter = setDoctorOrdersStatusFilter;
window.setAdminProdApprovalFilter = setAdminProdApprovalFilter;
window.openAdminProductModal = openAdminProductModal;
window.submitAdminProductForm = submitAdminProductForm;
window.deleteAdminProduct = deleteAdminProduct;
window.filterAdminProductsTable = filterAdminProductsTable;
window.previewProductImageFromUrl = previewProductImageFromUrl;
window.updateAdminOrderStatus = updateAdminOrderStatus;
window.viewAdminOrderDetail = viewAdminOrderDetail;
window.approveProduct = approveProduct;
window.rejectProduct = rejectProduct;
window.openAdminVoucherModal = openAdminVoucherModal;
window.submitAdminVoucherForm = submitAdminVoucherForm;
window.toggleAdminVoucher = toggleAdminVoucher;
window.deleteAdminVoucher = deleteAdminVoucher;
window.onVoucherTypeChange = onVoucherTypeChange;
window.handleApplyVoucherInput = handleApplyVoucherInput;
window.openDoctorProductModal = openDoctorProductModal;
window.previewDoctorProdImg = previewDoctorProdImg;
window.submitDoctorProductForm = submitDoctorProductForm;
window.deleteDoctorProduct = deleteDoctorProduct;
window.setDoctorProdFilter = setDoctorProdFilter;
window.onDoctorProdSearch = onDoctorProdSearch;
window.onDoctorProdSort = onDoctorProdSort;
window.triggerProductFileInput = triggerProductFileInput;
window.handleProductFilesSelect = handleProductFilesSelect;
window.removeProductImageSlot = removeProductImageSlot;
window.renderProductImagePreviewGrid = renderProductImagePreviewGrid;
window.toggleDoctorProductStatus = toggleDoctorProductStatus;




