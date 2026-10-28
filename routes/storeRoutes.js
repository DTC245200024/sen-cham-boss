const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const PAYMENT_SECRET = process.env.JWT_SECRET || 'senchamboss_payment_secret_2026';
const STANDARD_SHIPPING_FEE = 30000;
const EXPRESS_SHIPPING_FEE = 45000;

// Router-level auth middleware with payment public exemptions
router.use((req, res, next) => {
  if (req.path.startsWith('/payments/info/') || req.path === '/payments/verify') {
    return next();
  }
  return authenticateToken(req, res, next);
});

// ==============================
// HELPERS
// ==============================
function generateProductCode(category) {
  const prefixes = {
    'Thức ăn': 'SP-AN',
    'Phụ kiện': 'SP-PK',
    'Vệ sinh': 'SP-VS',
    'Thuốc & Bổ sung': 'SP-TH',
    'Khác': 'SP-KH'
  };
  const prefix = prefixes[category] || 'SP-KH';
  const num = String(Date.now()).slice(-5);
  return `${prefix}-${num}`;
}

function generatePaymentToken(paymentId, orderId, amount) {
  return crypto
    .createHmac('sha256', PAYMENT_SECRET)
    .update(`${paymentId}:${orderId}:${amount}`)
    .digest('hex');
}

// Server-side Voucher Validation & Calculation Engine
function validateAndCalculateVoucher(code, subtotal, userId = null) {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Vui lòng nhập mã voucher.' };
  }

  const cleanCode = code.trim().toUpperCase();
  const voucher = db.findOne('vouchers', v => (v.code || '').toUpperCase() === cleanCode);

  if (!voucher) {
    return { valid: false, message: `Mã voucher "${cleanCode}" không tồn tại.` };
  }

  if (!voucher.is_active) {
    return { valid: false, message: 'Voucher này hiện đã bị tạm dừng.' };
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (voucher.start_date && todayStr < voucher.start_date) {
    return { valid: false, message: `Voucher chỉ bắt đầu áp dụng từ ngày ${voucher.start_date}.` };
  }

  if (voucher.end_date && todayStr > voucher.end_date) {
    return { valid: false, message: 'Voucher đã hết hạn sử dụng.' };
  }

  if (voucher.usage_limit && (voucher.used_count || 0) >= voucher.usage_limit) {
    return { valid: false, message: 'Voucher đã hết lượt sử dụng.' };
  }

  const minOrder = voucher.minimum_order_value || 0;
  if (subtotal < minOrder) {
    return {
      valid: false,
      message: `Đơn hàng chưa đạt giá trị tối thiểu ${minOrder.toLocaleString('vi-VN')} ₫ (Hiện tại: ${subtotal.toLocaleString('vi-VN')} ₫).`
    };
  }

  // Calculate discount
  let discount = 0;
  if (voucher.discount_type === 'PERCENT') {
    const percent = parseFloat(voucher.discount_value) || 0;
    discount = Math.round((subtotal * percent) / 100);
    if (voucher.maximum_discount && discount > voucher.maximum_discount) {
      discount = voucher.maximum_discount;
    }
  } else {
    // FIXED
    discount = parseFloat(voucher.discount_value) || 0;
  }

  discount = Math.min(discount, subtotal + STANDARD_SHIPPING_FEE);

  return {
    valid: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value,
      minimum_order_value: voucher.minimum_order_value,
      maximum_discount: voucher.maximum_discount
    },
    discount_amount: discount
  };
}

// ==============================
// VOUCHER ENDPOINTS
// ==============================

// GET /api/store/vouchers/available (Public/User: List active & unexpired vouchers)
router.get('/vouchers/available', (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const vouchers = db.find('vouchers', v => {
      const active = v.is_active !== false;
      const notExpired = !v.end_date || v.end_date >= todayStr;
      const notExhausted = !v.usage_limit || (v.used_count || 0) < v.usage_limit;
      return active && notExpired && notExhausted;
    });

    return res.json({ success: true, vouchers });
  } catch (err) {
    console.error('Get available vouchers error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách voucher.' });
  }
});

// POST /api/store/vouchers/apply (User: Apply voucher to cart / checkout)
router.post('/vouchers/apply', (req, res) => {
  try {
    const { code, items, shipping_method } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng đang trống.' });
    }

    let subtotal = 0;
    for (const item of items) {
      const prod = db.findById('products', item.product_id);
      if (prod && prod.status === 'ACTIVE') {
        const qty = parseInt(item.quantity) || 1;
        subtotal += prod.price * qty;
      }
    }

    if (subtotal <= 0) {
      return res.status(400).json({ success: false, message: 'Không có sản phẩm hợp lệ trong giỏ hàng.' });
    }

    const result = validateAndCalculateVoucher(code, subtotal, req.user ? req.user.id : null);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const shippingFee = shipping_method === 'EXPRESS' ? EXPRESS_SHIPPING_FEE : STANDARD_SHIPPING_FEE;
    const totalAmount = Math.max(0, subtotal + shippingFee - result.discount_amount);

    return res.json({
      success: true,
      message: `Đã áp dụng mã "${result.voucher.code}" thành công! Giảm ${result.discount_amount.toLocaleString('vi-VN')} ₫.`,
      voucher: result.voucher,
      discount_amount: result.discount_amount,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount
    });
  } catch (err) {
    console.error('Apply voucher error:', err);
    res.status(500).json({ success: false, message: 'Lỗi áp dụng voucher.' });
  }
});

// GET /api/store/admin/vouchers (Admin: Full Voucher Management)
router.get('/admin/vouchers', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }
    const vouchers = db.find('vouchers', () => true).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return res.json({ success: true, vouchers, total: vouchers.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách voucher.' });
  }
});

// POST /api/store/admin/vouchers (Admin: Create Voucher)
router.post('/admin/vouchers', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện.' });
    }

    const {
      code, name, discount_type, discount_value,
      minimum_order_value, maximum_discount, usage_limit,
      start_date, end_date, is_active
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Mã voucher là bắt buộc.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên voucher là bắt buộc.' });
    }
    if (discount_value === undefined || discount_value === null || parseFloat(discount_value) <= 0) {
      return res.status(400).json({ success: false, message: 'Giá trị giảm không hợp lệ.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = db.findOne('vouchers', v => (v.code || '').toUpperCase() === cleanCode);
    if (existing) {
      return res.status(400).json({ success: false, message: `Mã voucher "${cleanCode}" đã tồn tại.` });
    }

    const newVoucher = db.insert('vouchers', {
      code: cleanCode,
      name: name.trim(),
      discount_type: discount_type === 'FIXED' ? 'FIXED' : 'PERCENT',
      discount_value: parseFloat(discount_value),
      minimum_order_value: parseFloat(minimum_order_value) || 0,
      maximum_discount: parseFloat(maximum_discount) || null,
      usage_limit: parseInt(usage_limit) || 100,
      used_count: 0,
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || '2026-12-31',
      is_active: is_active !== false
    });

    return res.status(201).json({ success: true, message: `Đã tạo voucher "${cleanCode}" thành công.`, voucher: newVoucher });
  } catch (err) {
    console.error('Create voucher error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tạo voucher.' });
  }
});

// PUT /api/store/admin/vouchers/:id (Admin: Update Voucher)
router.put('/admin/vouchers/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện.' });
    }

    const voucher = db.findById('vouchers', req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });

    const {
      name, discount_type, discount_value,
      minimum_order_value, maximum_discount, usage_limit,
      start_date, end_date, is_active
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (minimum_order_value !== undefined) updates.minimum_order_value = parseFloat(minimum_order_value);
    if (maximum_discount !== undefined) updates.maximum_discount = parseFloat(maximum_discount) || null;
    if (usage_limit !== undefined) updates.usage_limit = parseInt(usage_limit);
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (is_active !== undefined) updates.is_active = is_active;

    const updated = db.update('vouchers', req.params.id, updates);
    return res.json({ success: true, message: 'Cập nhật voucher thành công.', voucher: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật voucher.' });
  }
});

// PATCH /api/store/admin/vouchers/:id/toggle (Admin: Toggle Active/Inactive)
router.patch('/admin/vouchers/:id/toggle', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện.' });
    }
    const voucher = db.findById('vouchers', req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });

    const updated = db.update('vouchers', req.params.id, {
      is_active: !voucher.is_active,
      updated_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Voucher "${voucher.code}" hiện ${updated.is_active ? 'đang hoạt động' : 'đã tạm tắt'}.`,
      voucher: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi chuyển trạng thái voucher.' });
  }
});

// DELETE /api/store/admin/vouchers/:id (Admin: Delete voucher if unused)
router.delete('/admin/vouchers/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện.' });
    }
    const voucher = db.findById('vouchers', req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });

    if ((voucher.used_count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Voucher "${voucher.code}" đã được sử dụng (${voucher.used_count} lượt), không thể xóa.`
      });
    }

    db.delete('vouchers', req.params.id);
    return res.json({ success: true, message: `Đã xóa voucher "${voucher.code}".` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa voucher.' });
  }
});

// ==============================
// PRODUCTS
// ==============================

// GET /api/store/products
router.get('/products', (req, res) => {
  try {
    const role = req.user.role;
    const { category, search, status, approval_status, view } = req.query;

    let products = db.find('products', () => true);

    if (['ADMIN','STORE_MANAGER'].includes(role)) {
      if (approval_status && approval_status !== 'ALL') {
        products = products.filter(p => (p.approval_status || 'APPROVED') === approval_status);
      }
      if (status && status !== 'ALL') {
        products = products.filter(p => p.status === status);
      }
    } else {
      products = products.filter(p => {
        const isApproved = !p.approval_status || p.approval_status === 'APPROVED';
        return p.status === 'ACTIVE' && isApproved;
      });
    }

    if (category && category !== 'ALL') {
      products = products.filter(p => p.category === category);
    }

    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(s) ||
        (p.product_code && p.product_code.toLowerCase().includes(s)) ||
        (p.description && p.description.toLowerCase().includes(s)) ||
        (p.doctor_name && p.doctor_name.toLowerCase().includes(s))
      );
    }

    products = products.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    products = products.map(p => ({
      ...p,
      doctor_name: p.doctor_name || (p.doctor_id ? 'Bác sĩ thú y' : 'Sen Chăm Boss'),
      approval_status: p.approval_status || 'APPROVED',
      rating: 4.9,
      sold_count: 128 + (parseInt(String(p.price).slice(-2)) || 25),
      original_price: Math.round(p.price * 1.25)
    }));

    return res.json({ success: true, products, total: products.length });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách sản phẩm.' });
  }
});

// GET /api/store/products/:id
router.get('/products/:id', (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    
    const role = req.user.role;
    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(role);

    if (!isAdmin && product.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
    }

    return res.json({
      success: true,
      product: {
        ...product,
        doctor_name: product.doctor_name || (product.doctor_id ? 'Bác sĩ thú y' : 'Sen Chăm Boss'),
        approval_status: product.approval_status || 'APPROVED',
        rating: 4.9,
        sold_count: 128 + (parseInt(String(product.price).slice(-2)) || 25),
        original_price: Math.round(product.price * 1.25)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy sản phẩm.' });
  }
});

// POST /api/store/products (ADMIN only)
router.post('/products', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền đăng sản phẩm.' });
    }

    const { name, category, price, stock, description, detail, image_url, image_urls, status, product_code, colors } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên sản phẩm là bắt buộc.' });
    }
    if (price === undefined || price === null || price === '') {
      return res.status(400).json({ success: false, message: 'Giá sản phẩm là bắt buộc.' });
    }
    if (parseFloat(price) < 0) {
      return res.status(400).json({ success: false, message: 'Giá không được âm.' });
    }

    const cat = category || 'Khác';
    let code = product_code && product_code.trim() ? product_code.trim() : generateProductCode(cat);

    const existingCode = db.findOne('products', p => p.product_code === code);
    if (existingCode) {
      code = generateProductCode(cat);
    }

    const doctorId = null;
    const doctorName = 'Sen Chăm Boss';

    const urls = Array.isArray(image_urls) && image_urls.length ? image_urls : (image_url ? [image_url] : []);
    const mainImageUrl = urls[0] || image_url || '';

    const newProduct = db.insert('products', {
      product_code: code,
      name: name.trim(),
      category: cat,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      description: description || '',
      detail: detail || '',
      image_url: mainImageUrl,
      image_urls: urls,
      status: status || 'ACTIVE',
      approval_status: 'APPROVED', // Doctor products are instantly active and approved
      doctor_id: doctorId,
      doctor_name: doctorName,
      colors: Array.isArray(colors) ? colors : (colors ? [colors] : [])
    });

    const msg = isDoctor
      ? 'Đăng sản phẩm thành công! Sản phẩm của bạn đã được mở bán trên Cửa hàng.'
      : 'Thêm sản phẩm thành công.';

    return res.status(201).json({ success: true, message: msg, product: newProduct });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ success: false, message: 'Lỗi thêm sản phẩm.' });
  }
});


// PUT /api/store/products/:id (ADMIN only)
router.put('/products/:id', (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa sản phẩm này.' });
    }

    const { name, category, price, stock, description, detail, image_url, image_urls, status, product_code, colors } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = parseFloat(price);
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (description !== undefined) updates.description = description;
    if (detail !== undefined) updates.detail = detail;
    if (image_urls !== undefined && Array.isArray(image_urls)) {
      updates.image_urls = image_urls;
      if (image_urls.length) updates.image_url = image_urls[0];
    } else if (image_url !== undefined) {
      updates.image_url = image_url;
      updates.image_urls = [image_url];
    }
    if (status !== undefined) updates.status = status;
    if (colors !== undefined) updates.colors = Array.isArray(colors) ? colors : (colors ? [colors] : []);


    if (product_code && product_code.trim() && product_code.trim() !== product.product_code) {
      const existingCode = db.findOne('products', p => p.product_code === product_code.trim() && p.id !== req.params.id);
      if (existingCode) {
        return res.status(400).json({ success: false, message: `Mã sản phẩm "${product_code.trim()}" đã tồn tại.` });
      }
      updates.product_code = product_code.trim();
    }

    const updated = db.update('products', req.params.id, updates);
    return res.json({ success: true, message: 'Cập nhật sản phẩm thành công.', product: updated });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật sản phẩm.' });
  }
});

// PATCH /api/store/products/:id/approve (ADMIN only)
router.patch('/products/:id/approve', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền duyệt sản phẩm.' });
    }

    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const updated = db.update('products', req.params.id, {
      approval_status: 'APPROVED',
      status: 'ACTIVE',
      updated_at: new Date().toISOString()
    });

    if (product.doctor_id) {
      db.insert('notifications', {
        user_id: product.doctor_id,
        title: '<i class="fa-solid fa-check"></i> Sản phẩm đã được duyệt',
        message: `Sản phẩm "${product.name}" của bạn đã được Admin duyệt và hiện đã mở bán trên Shop!`,
        type: 'STORE',
        is_read: false
      });
    }

    return res.json({ success: true, message: `Đã duyệt sản phẩm "${product.name}".`, product: updated });
  } catch (err) {
    console.error('Approve product error:', err);
    res.status(500).json({ success: false, message: 'Lỗi duyệt sản phẩm.' });
  }
});

// PATCH /api/store/products/:id/reject (ADMIN only)
router.patch('/products/:id/reject', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền từ chối sản phẩm.' });
    }

    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const { reason } = req.body;

    const updated = db.update('products', req.params.id, {
      approval_status: 'REJECTED',
      status: 'INACTIVE',
      reject_reason: reason || 'Chưa đáp ứng tiêu chuẩn sản phẩm của Sen Chăm Boss.',
      updated_at: new Date().toISOString()
    });

    if (product.doctor_id) {
      db.insert('notifications', {
        user_id: product.doctor_id,
        title: '<i class="fa-solid fa-xmark"></i> Sản phẩm bị từ chối duyệt',
        message: `Sản phẩm "${product.name}" của bạn đã bị từ chối: ${reason || 'Không đạt yêu cầu'}.`,
        type: 'STORE',
        is_read: false
      });
    }

    return res.json({ success: true, message: `Đã từ chối sản phẩm "${product.name}".`, product: updated });
  } catch (err) {
    console.error('Reject product error:', err);
    res.status(500).json({ success: false, message: 'Lỗi từ chối sản phẩm.' });
  }
});

// PATCH /api/store/products/:id/toggle-status (ADMIN only)
router.patch('/products/:id/toggle-status', (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền thay đổi trạng thái sản phẩm này.' });
    }

    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = db.update('products', req.params.id, {
      status: newStatus,
      updated_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: newStatus === 'ACTIVE' ? `Đã mở bán lại sản phẩm "${product.name}".` : `Đã ẩn sản phẩm "${product.name}".`,
      product: updated
    });
  } catch (err) {
    console.error('Toggle product status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái sản phẩm.' });
  }
});

// DELETE /api/store/products/:id (ADMIN only)
router.delete('/products/:id', (req, res) => {
  try {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa sản phẩm này.' });
    }

    // Check if there are existing orders containing this product
    const relatedOrders = db.find('orders', o => (o.items || []).some(i => i.product_id === req.params.id));
    if (relatedOrders.length > 0) {
      // Soft-hide instead of hard deleting to preserve order history
      db.update('products', req.params.id, { status: 'INACTIVE', is_deleted: true, updated_at: new Date().toISOString() });
      return res.json({
        success: true,
        message: `Sản phẩm "${product.name}" đã có trong đơn hàng của khách nên đã được chuyển sang trạng thái Ẩn để bảo toàn lịch sử đơn hàng.`
      });
    }

    db.delete('products', req.params.id);
    return res.json({ success: true, message: `Đã xóa sản phẩm "${product.name}" thành công.` });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xóa sản phẩm.' });
  }
});


// ==============================
// ORDERS & CHECKOUT & PAYMENTS
// ==============================

// POST /api/store/orders (USER - Create new order with Voucher & Payment Gateway)
router.post('/orders', (req, res) => {
  try {
    const {
      items, customer_name, phone, address, city, district, ward,
      notes, payment_method, voucher_code, shipping_method, client_timestamp
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng trống.' });
    }
    if (!customer_name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin nhận hàng.' });
    }

    // Idempotency: prevent double submission within 5 seconds
    const recentOrder = db.findOne('orders', o => {
      if (o.user_id !== req.user.id) return false;
      const diffMs = Date.now() - new Date(o.created_at).getTime();
      return diffMs < 5000 && o.customer_name === customer_name.trim();
    });
    if (recentOrder) {
      return res.status(400).json({
        success: false,
        message: 'Bạn vừa tạo đơn hàng tương tự. Vui lòng kiểm tra lại trong mục Đơn hàng của tôi!'
      });
    }

    // 1. Recalculate subtotal strictly from DB prices & check stock
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const prod = db.findById('products', item.product_id);
      if (!prod) {
        return res.status(400).json({ success: false, message: 'Sản phẩm không tồn tại.' });
      }
      if (prod.status !== 'ACTIVE' || (prod.approval_status && prod.approval_status !== 'APPROVED')) {
        return res.status(400).json({ success: false, message: `Sản phẩm "${prod.name}" hiện không còn bán.` });
      }
      const qty = parseInt(item.quantity);
      if (qty < 1) {
        return res.status(400).json({ success: false, message: `Số lượng không hợp lệ cho "${prod.name}".` });
      }
      if (prod.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm "${prod.name}" chỉ còn ${prod.stock} trong kho.`
        });
      }
      const itemTotal = prod.price * qty;
      subtotal += itemTotal;
      orderItems.push({
        product_id: prod.id,
        product_code: prod.product_code,
        name: prod.name,
        variant: item.variant || 'Tiêu chuẩn',
        image_url: prod.image_url,
        price: prod.price,
        quantity: qty,
        subtotal: itemTotal,
        doctor_id: prod.doctor_id || null,
        doctor_name: prod.doctor_name || 'Sen Chăm Boss'
      });
    }

    // 2. Server-side Voucher Validation
    let discountAmount = 0;
    let appliedVoucher = null;
    if (voucher_code && voucher_code.trim()) {
      const vResult = validateAndCalculateVoucher(voucher_code.trim(), subtotal, req.user.id);
      if (!vResult.valid) {
        return res.status(400).json({ success: false, message: vResult.message });
      }
      discountAmount = vResult.discount_amount;
      appliedVoucher = vResult.voucher;
    }

    const shippingFee = shipping_method === 'EXPRESS' ? EXPRESS_SHIPPING_FEE : STANDARD_SHIPPING_FEE;
    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

    // 3. Deduct stock from products
    for (const item of orderItems) {
      const prod = db.findById('products', item.product_id);
      if (prod) {
        db.update('products', prod.id, { stock: prod.stock - item.quantity });
      }
    }

    const fullAddress = [address, ward, district, city].filter(Boolean).join(', ');
    const orderCode = 'DH-' + String(Date.now()).slice(-6) + '-' + Math.floor(Math.random() * 900 + 100);

    const isOnlinePay = payment_method === 'ONLINE' || payment_method === 'VNPAY' || payment_method === 'BANK';

    // 4. Create Order record
    const newOrder = db.insert('orders', {
      order_code: orderCode,
      user_id: req.user.id,
      items: orderItems,
      subtotal,
      shipping_fee: shippingFee,
      shipping_method: shipping_method === 'EXPRESS' ? 'Hỏa tốc (1-2 ngày)' : 'Tiêu chuẩn (3-5 ngày)',
      discount_amount: discountAmount,
      voucher_code: appliedVoucher ? appliedVoucher.code : null,
      voucher_id: appliedVoucher ? appliedVoucher.id : null,
      total_amount: totalAmount,
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city || '',
      district: district || '',
      ward: ward || '',
      full_address: fullAddress,
      notes: notes || '',
      payment_method: isOnlinePay ? 'ONLINE' : 'COD',
      payment_status: isOnlinePay ? 'PENDING' : 'COD_PENDING',
      order_status: 'PENDING'
    });

    // Save/Update user profile info
    if (req.user) {
      db.update('users', req.user.id, {
        phone: phone.trim(),
        address: address.trim()
      });
    }

    // Record voucher usage
    if (appliedVoucher) {
      const vDb = db.findById('vouchers', appliedVoucher.id);
      if (vDb) {
        db.update('vouchers', vDb.id, { used_count: (vDb.used_count || 0) + 1 });
      }
      db.insert('voucher_usages', {
        voucher_id: appliedVoucher.id,
        voucher_code: appliedVoucher.code,
        order_id: newOrder.id,
        user_id: req.user.id,
        discount_amount: discountAmount
      });
    }

    // 5. If Online Payment -> Generate Secure Payment Gateway Session
    let paymentRecord = null;
    let paymentUrl = null;

    if (isOnlinePay) {
      const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const secureToken = generatePaymentToken(paymentId, newOrder.id, totalAmount);

      paymentRecord = db.insert('payments', {
        id: paymentId,
        order_id: newOrder.id,
        order_code: orderCode,
        user_id: req.user.id,
        amount: totalAmount,
        payment_method: 'ONLINE',
        payment_status: 'PENDING',
        gateway: 'VNPAY_GATEWAY',
        secure_token: secureToken,
        pay_url: `/payment-gateway.html?payment_id=${paymentId}&token=${secureToken}`
      });

      db.update('orders', newOrder.id, { payment_id: paymentId });
      paymentUrl = paymentRecord.pay_url;
    }

    // 6. Notify Admin & Doctors
    const admins = db.find('users', u => ['ADMIN','STORE_MANAGER'].includes(u.role));
    admins.forEach(admin => {
      db.insert('notifications', {
        user_id: admin.id,
        title: `<i class="fa-solid fa-cart-shopping"></i> Đơn hàng mới #${orderCode}`,
        message: `Khách hàng ${customer_name} vừa đặt đơn hàng #${orderCode} (${totalAmount.toLocaleString('vi-VN')} ₫).`,
        type: 'STORE',
        is_read: false
      });
    });

    const doctorIds = [...new Set(orderItems.map(i => i.doctor_id).filter(Boolean))];
    doctorIds.forEach(docId => {
      db.insert('notifications', {
        user_id: docId,
        title: '<i class="fa-solid fa-box"></i> Đơn hàng mới có sản phẩm của bạn',
        message: `Đơn hàng #${orderCode} vừa được đặt chứa sản phẩm của bạn. Vui lòng kiểm tra trong mục Đơn hàng!`,
        type: 'STORE',
        is_read: false
      });
    });

    return res.status(201).json({
      success: true,
      message: `Đặt hàng thành công! Mã đơn hàng: #${orderCode}`,
      order: newOrder,
      payment: paymentRecord,
      payment_url: paymentUrl
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi đặt hàng. Vui lòng thử lại.' });
  }
});

// GET /api/store/payments/info/:id (Payment Gateway Checkout Screen Info)
router.get('/payments/info/:id', (req, res) => {
  try {
    const payment = db.findById('payments', req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên thanh toán.' });

    const order = db.findById('orders', payment.order_id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    return res.json({
      success: true,
      payment: {
        id: payment.id,
        order_code: payment.order_code,
        amount: payment.amount,
        payment_status: payment.payment_status,
        created_at: payment.created_at
      },
      order: {
        customer_name: order.customer_name,
        phone: order.phone,
        items_count: (order.items || []).length,
        items_summary: (order.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin thanh toán.' });
  }
});

// POST /api/store/payments/verify (Secure Payment Callback / Webhook from Gateway)
router.post('/payments/verify', (req, res) => {
  try {
    const { payment_id, token, status, bank_code, transaction_ref } = req.body;

    if (!payment_id || !token) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin xác minh thanh toán.' });
    }

    const payment = db.findById('payments', payment_id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch thanh toán.' });
    }

    // Cryptographic validation of signature token
    const expectedToken = generatePaymentToken(payment.id, payment.order_id, payment.amount);
    if (token !== expectedToken || token !== payment.secure_token) {
      return res.status(403).json({ success: false, message: 'Chữ ký giao dịch không hợp lệ (Bảo mật vi phạm).' });
    }

    const order = db.findById('orders', payment.order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng tương ứng.' });
    }

    const isSuccess = status === 'SUCCESS';
    const newPayStatus = isSuccess ? 'PAID' : (status === 'CANCELLED' ? 'CANCELLED' : 'FAILED');

    // Update payment record
    const updatedPayment = db.update('payments', payment.id, {
      payment_status: newPayStatus,
      bank_code: bank_code || 'VNPAY-QR',
      transaction_id: transaction_ref || 'TXN-' + Date.now(),
      paid_at: isSuccess ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });

    // Update order record
    const updatedOrder = db.update('orders', order.id, {
      payment_status: newPayStatus,
      order_status: isSuccess ? 'CONFIRMED' : order.order_status,
      updated_at: new Date().toISOString()
    });

    if (isSuccess) {
      db.insert('notifications', {
        user_id: order.user_id,
        title: '<i class="fa-solid fa-credit-card"></i> Thanh toán online thành công',
        message: `Đơn hàng #${order.order_code} đã thanh toán thành công số tiền ${payment.amount.toLocaleString('vi-VN')} ₫ qua Cổng thanh toán Online.`,
        type: 'STORE',
        is_read: false
      });
    }

    return res.json({
      success: isSuccess,
      message: isSuccess ? 'Thanh toán thành công!' : 'Thanh toán không thành công hoặc đã bị hủy.',
      payment: updatedPayment,
      order: updatedOrder
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xác minh thanh toán.' });
  }
});

// POST /api/store/orders/:id/retry-payment (User: Thanh toán lại cho đơn chưa thanh toán hoặc failed)
router.post('/orders/:id/retry-payment', (req, res) => {
  try {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && order.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện trên đơn hàng này.' });
    }

    if (order.order_status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã bị hủy, không thể thanh toán lại.' });
    }

    if (order.payment_status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã được thanh toán hoàn tất.' });
    }

    // Generate new Payment transaction session without duplicate order
    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const secureToken = generatePaymentToken(paymentId, order.id, order.total_amount);

    const paymentRecord = db.insert('payments', {
      id: paymentId,
      order_id: order.id,
      order_code: order.order_code,
      user_id: req.user.id,
      amount: order.total_amount,
      payment_method: 'ONLINE',
      payment_status: 'PENDING',
      gateway: 'VNPAY_GATEWAY',
      secure_token: secureToken,
      pay_url: `/payment-gateway.html?payment_id=${paymentId}&token=${secureToken}`
    });

    db.update('orders', order.id, { payment_id: paymentId });

    return res.json({
      success: true,
      message: 'Khởi tạo phiên thanh toán mới thành công.',
      payment_url: paymentRecord.pay_url
    });
  } catch (err) {
    console.error('Retry payment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi khởi tạo thanh toán lại.' });
  }
});

// GET /api/store/orders
router.get('/orders', (req, res) => {
  try {
    const role = req.user.role;
    let orders;

    if (['ADMIN','STORE_MANAGER'].includes(role)) {
      orders = db.find('orders', () => true);
    } else {
      orders = db.find('orders', o => o.user_id === req.user.id);
    }

    orders = orders
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .map(o => {
        const u = db.findById('users', o.user_id);
        const itemsWithDetails = (o.items || []).map(item => {
          const prod = db.findById('products', item.product_id);
          return {
            ...item,
            product_name: prod ? prod.name : item.name || 'Sản phẩm không còn',
            product_code: prod ? prod.product_code : item.product_code || '',
            image_url: prod ? prod.image_url : item.image_url || '',
            doctor_name: item.doctor_name || (prod ? prod.doctor_name : 'Sen Chăm Boss')
          };
        });
        return {
          ...o,
          user_name: u ? u.full_name : (o.customer_name || 'Khách hàng'),
          user_email: u ? u.email : '',
          user_phone: u ? u.phone : (o.phone || ''),
          items: itemsWithDetails
        };
      });

    return res.json({ success: true, orders, total: orders.length });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng.' });
  }
});

// GET /api/store/orders/:id
router.get('/orders/:id', (req, res) => {
  try {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const role = req.user.role;
    const isOwnerUser = order.user_id === req.user.id;
    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(role);

    if (!isAdmin && !isOwnerUser) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem đơn hàng này.' });
    }

    const u = db.findById('users', order.user_id);
    const itemsWithDetails = (order.items || []).map(item => {
      const prod = db.findById('products', item.product_id);
      return {
        ...item,
        product_name: prod ? prod.name : item.name || 'Sản phẩm',
        product_code: prod ? prod.product_code : item.product_code || '',
        image_url: prod ? prod.image_url : item.image_url || '',
        doctor_name: item.doctor_name || (prod ? prod.doctor_name : 'Sen Chăm Boss')
      };
    });

    return res.json({
      success: true,
      order: { 
        ...order, 
        user_name: u ? u.full_name : (order.customer_name || 'Khách hàng'), 
        user_phone: u ? u.phone : (order.phone || ''), 
        items: itemsWithDetails 
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết đơn hàng.' });
  }
});

// PATCH /api/store/orders/:id/status (ADMIN only)
router.patch('/orders/:id/status', (req, res) => {
  try {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const role = req.user.role;
    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật đơn hàng này.' });
    }

    const { order_status, payment_status } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    const updates = { updated_at: new Date().toISOString() };

    if (order_status && validStatuses.includes(order_status)) {
      updates.order_status = order_status;
      if (order_status === 'COMPLETED') {
        updates.payment_status = 'PAID';
        updates.completed_at = new Date().toISOString();
      }
    }
    if (payment_status) {
      updates.payment_status = payment_status;
    }

    if (Object.keys(updates).length <= 1) {
      return res.status(400).json({ success: false, message: 'Không có thông tin cần cập nhật.' });
    }

    if (order_status === 'CANCELLED' && order.order_status !== 'CANCELLED') {
      (order.items || []).forEach(item => {
        const prod = db.findById('products', item.product_id);
        if (prod) {
          db.update('products', prod.id, { stock: prod.stock + item.quantity });
        }
      });
    }

    const updated = db.update('orders', req.params.id, updates);

    const statusLabelMap = {
      CONFIRMED: 'đã được xác nhận',
      SHIPPING: 'đang được vận chuyển',
      DELIVERED: 'đã được giao thành công',
      COMPLETED: 'đã hoàn thành',
      CANCELLED: 'đã bị hủy'
    };
    if (order_status && statusLabelMap[order_status]) {
      db.insert('notifications', {
        user_id: order.user_id,
        title: `<i class="fa-solid fa-box"></i> Đơn hàng #${order.order_code} ${statusLabelMap[order_status]}`,
        message: `Đơn hàng #${order.order_code} của bạn ${statusLabelMap[order_status]}. Vui lòng kiểm tra trong mục Đơn hàng của tôi!`,
        type: 'STORE',
        is_read: false
      });
    }

    return res.json({ success: true, message: 'Cập nhật trạng thái thành công.', order: updated });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn hàng.' });
  }
});

// PATCH /api/store/orders/:id/receive (USER)
router.patch('/orders/:id/receive', (req, res) => {
  try {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && order.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền thao tác trên đơn hàng này.' });
    }
    if (order.order_status !== 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận khi đơn hàng ở trạng thái Đã giao.' });
    }

    const updated = db.update('orders', req.params.id, {
      order_status: 'COMPLETED',
      payment_status: 'PAID',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    db.insert('notifications', {
      user_id: order.user_id,
      title: '<i class="fa-solid fa-party-horn"></i> Đơn hàng đã hoàn thành',
      message: `Cảm ơn bạn đã mua sắm tại Sen Chăm Boss! Đơn hàng #${order.order_code} đã hoàn thành.`,
      type: 'STORE',
      is_read: false
    });

    return res.json({ success: true, message: 'Đã xác nhận nhận hàng thành công. Đơn hàng hoàn tất!', order: updated });
  } catch (err) {
    console.error('Receive order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xác nhận nhận hàng.' });
  }
});

// PATCH /api/store/orders/:id/cancel (USER / ADMIN)
router.patch('/orders/:id/cancel', (req, res) => {
  try {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);
    const isOwnerUser = order.user_id === req.user.id;

    if (!isAdmin && !isOwnerUser) {
      return res.status(403).json({ success: false, message: 'Không có quyền hủy đơn hàng này.' });
    }
    if (order.order_status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn hàng ở trạng thái Chờ xác nhận.' });
    }

    (order.items || []).forEach(item => {
      const prod = db.findById('products', item.product_id);
      if (prod) {
        db.update('products', prod.id, { stock: prod.stock + item.quantity });
      }
    });

    const updated = db.update('orders', req.params.id, { 
      order_status: 'CANCELLED',
      updated_at: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Đã hủy đơn hàng thành công.', order: updated });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi hủy đơn hàng.' });
  }
});

// GET /api/store/config
router.get('/config', (req, res) => {
  const configs = db.data.store_config || [];
  let config = configs.length > 0 ? configs[0] : {
    shipping_fee: STANDARD_SHIPPING_FEE,
    bank_id: 'vcb',
    bank_name: 'Vietcombank',
    bank_account: '1234567890',
    bank_holder: 'SEN CHAM BOSS',
    bank_branch: 'Chi nhánh TP.HCM'
  };

  return res.json({
    success: true,
    config: config
  });
});

module.exports = router;
