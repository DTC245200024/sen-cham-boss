const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Middleware to strictly block ADMIN from all invoice & payment routes
router.use((req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Quản trị viên (ADMIN) không có quyền xem hoặc thao tác trên hóa đơn và thanh toán của cửa hàng. Quyền này thuộc về Quản lý cửa hàng (STORE_MANAGER) và Lễ tân.'
    });
  }
  next();
});

function enrichInvoice(inv) {
  if (!inv) return null;
  const user = inv.user_id ? db.findById('users', inv.user_id) : null;
  const pet = inv.pet_id ? db.findById('pets', inv.pet_id) : null;
  return {
    ...inv,
    owner_name: inv.owner_name || (user ? user.full_name : 'Khách hàng'),
    owner_phone: inv.owner_phone || (user ? user.phone : 'Chưa cập nhật'),
    owner_email: (user ? user.email : 'Chưa cập nhật'),
    pet_name: inv.pet_name || (pet ? pet.name : 'Bé cưng'),
    pet_species: (pet ? pet.species : 'Thú cưng'),
    pet_breed: (pet ? pet.breed : ''),
    pet_weight: (pet ? pet.weight : '')
  };
}

// GET /api/invoices - List invoices
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;

    if (req.user.role === 'CARE_STAFF') {
      return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc không có quyền truy cập hóa đơn.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const userId = req.user.id;

    let invoices = isStaff
      ? (db.find('invoices', () => true) || [])
      : (db.find('invoices', inv => inv.user_id === userId) || []);

    if (status && status !== 'ALL') {
      invoices = invoices.filter(i => i.status === status);
    }

    if (search) {
      const s = search.toLowerCase();
      invoices = invoices.filter(i => 
        (i.invoice_code && i.invoice_code.toLowerCase().includes(s)) ||
        (i.owner_name && i.owner_name.toLowerCase().includes(s)) ||
        (i.pet_name && i.pet_name.toLowerCase().includes(s)) ||
        (i.service_name && i.service_name.toLowerCase().includes(s))
      );
    }

    invoices.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const enriched = invoices.map(enrichInvoice);

    return res.json({ success: true, count: enriched.length, invoices: enriched, data: enriched });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách hóa đơn.' });
  }
});

// GET /api/invoices/:id - Get invoice detail
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const inv = db.findById('invoices', id);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
    }

    if (req.user.role === 'CARE_STAFF') {
      return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc không có quyền xem hóa đơn.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && inv.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem hóa đơn này.' });
    }

    const enriched = enrichInvoice(inv);
    return res.json({ success: true, invoice: enriched, data: enriched });
  } catch (err) {
    console.error('Get invoice detail error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết hóa đơn.' });
  }
});

// Helper to resolve service/package price from database
function getServicePrice(serviceName) {
  if (!serviceName) return 150000;
  const sNameLower = serviceName.trim().toLowerCase();
  
  const services = db.find('services', () => true) || [];
  const foundSrv = services.find(s => s.name && s.name.trim().toLowerCase() === sNameLower);
  if (foundSrv && foundSrv.price) return parseFloat(foundSrv.price);

  const packages = db.find('service_packages', () => true) || [];
  const foundPkg = packages.find(p => p.name && p.name.trim().toLowerCase() === sNameLower);
  if (foundPkg && foundPkg.price) return parseFloat(foundPkg.price);

  const partialSrv = services.find(s => s.name && (sNameLower.includes(s.name.trim().toLowerCase()) || s.name.trim().toLowerCase().includes(sNameLower)));
  if (partialSrv && partialSrv.price) return parseFloat(partialSrv.price);

  const partialPkg = packages.find(p => p.name && (sNameLower.includes(p.name.trim().toLowerCase()) || p.name.trim().toLowerCase().includes(sNameLower)));
  if (partialPkg && partialPkg.price) return parseFloat(partialPkg.price);

  return 150000;
}

// GET /api/invoices/unbilled-appointments - Get completed appointments eligible for billing
router.get('/unbilled-appointments', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }

    const appointments = db.find('appointments', a => a.status === 'COMPLETED') || [];
    const activeInvoices = db.find('invoices', inv => inv.status !== 'CANCELLED') || [];
    const billedAppIds = new Set(activeInvoices.map(inv => inv.appointment_id).filter(Boolean));

    const unbilled = appointments
      .filter(a => !billedAppIds.has(a.id))
      .map(a => {
        const pet = db.findById('pets', a.petId) || {};
        const owner = db.findById('users', a.ownerId || a.userId || pet.user_id) || {};
        return {
          id: a.id,
          examinationType: a.examinationType,
          appointmentDate: a.appointmentDate,
          appointmentTime: a.appointmentTime,
          petId: pet.id,
          petName: pet.name || 'Thú cưng',
          petSpecies: pet.species || 'Pet',
          ownerId: owner.id,
          ownerName: owner.full_name || 'Khách hàng',
          ownerPhone: owner.phone || '',
          price: getServicePrice(a.examinationType)
        };
      });

    return res.json({ success: true, appointments: unbilled });
  } catch (err) {
    console.error('Error getting unbilled appointments:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch hẹn chưa lập hóa đơn.' });
  }
});

// POST /api/invoices - Create invoice (STORE_MANAGER & RECEPTIONIST only)
router.post('/', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không có quyền tạo/lập hóa đơn nghiệp vụ của cửa hàng. Quyền này thuộc về Quản lý cửa hàng (STORE_MANAGER) hoặc Lễ tân.' });
    }

    if (!['STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ Quản lý cửa hàng hoặc Lễ tân mới có quyền lập hóa đơn.' });
    }

    const {
      user_id,
      owner_name,
      owner_phone,
      pet_id,
      pet_name,
      appointment_id,
      service_name,
      items,
      total_amount,
      discount_amount,
      notes,
      payment_method
    } = req.body;

    const pet = pet_id ? db.findById('pets', pet_id) : null;
    const targetUserId = user_id || (pet ? pet.user_id : req.user.id);
    const user = db.findById('users', targetUserId);

    // Ràng buộc nghiêm ngặt theo quy trình: CHỈ được tạo hóa đơn khi lịch đã HOÀN THÀNH
    if (appointment_id) {
      const app = db.findById('appointments', appointment_id);
      if (!app) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin lịch hẹn tương ứng.' });
      }
      if (app.status === 'CANCELLED') {
        return res.status(400).json({ success: false, message: 'TUYỆT ĐỐI KHÔNG được tạo hóa đơn cho lịch hẹn đã bị hủy.' });
      }
      if (app.status !== 'COMPLETED') {
        return res.status(400).json({ 
          success: false, 
          message: `Lịch hẹn đang ở trạng thái "${app.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận'}". Chỉ được phép lập hóa đơn khi dịch vụ đã chuyển sang trạng thái "Đã hoàn thành".` 
        });
      }

      const existingInv = db.findOne('invoices', inv => inv.appointment_id === appointment_id && inv.status !== 'CANCELLED');
      if (existingInv) {
        if (existingInv.status === 'PAID') {
          return res.status(400).json({ success: false, message: 'Lịch hẹn này đã có hóa đơn đã thanh toán, không thể thay đổi.' });
        }
        // Update existing invoice instead of creating duplicate
        const updated = db.update('invoices', existingInv.id, {
          service_name: service_name || existingInv.service_name,
          total_amount: total_amount !== undefined ? parseFloat(total_amount) : existingInv.total_amount,
          discount_amount: discount_amount !== undefined ? parseFloat(discount_amount) : existingInv.discount_amount,
          final_amount: (total_amount !== undefined ? parseFloat(total_amount) : existingInv.total_amount) - (discount_amount !== undefined ? parseFloat(discount_amount) : existingInv.discount_amount),
          notes: notes || existingInv.notes,
          payment_method: payment_method || existingInv.payment_method
        });
        return res.json({ success: true, message: 'Đã cập nhật hóa đơn hiện tại của lịch hẹn!', invoice: updated });
      }
    }

    const codeNum = (db.data.invoices ? db.data.invoices.length : 0) + 1;
    const invoiceCode = `HD-2026-${String(codeNum).padStart(3, '0')}`;

    const itemsList = Array.isArray(items) && items.length > 0 ? items : [
      {
        name: service_name || 'Dịch vụ chăm sóc thú cưng',
        quantity: 1,
        price: parseFloat(total_amount) || 0,
        amount: parseFloat(total_amount) || 0
      }
    ];

    const total = parseFloat(total_amount) || itemsList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const discount = parseFloat(discount_amount) || 0;
    const finalAmount = Math.max(0, total - discount);

    const requestedStatus = req.body.status;
    const isPaid = requestedStatus === 'PAID' || payment_method === 'TIEN_MAT_DA_THU' || payment_method === 'CHUYEN_KHOAN_DA_NHAN';
    const finalStatus = requestedStatus || (isPaid ? 'PAID' : (payment_method === 'CHUYEN_KHOAN_VIETQR' ? 'WAITING_CONFIRMATION' : 'PENDING'));
    const createdAtDate = (req.body.created_at || req.body.date) ? new Date(req.body.created_at || req.body.date).toISOString() : new Date().toISOString();

    const newInvoice = db.insert('invoices', {
      invoice_code: invoiceCode,
      user_id: targetUserId,
      owner_name: owner_name || (user ? user.full_name : 'Khách hàng'),
      owner_phone: owner_phone || (user ? user.phone : ''),
      owner_email: (user ? user.email : ''),
      pet_id: pet_id || (pet ? pet.id : ''),
      pet_name: pet_name || (pet ? pet.name : 'Bé cưng'),
      appointment_id: appointment_id || null,
      service_name: service_name || (itemsList[0] ? itemsList[0].name : 'Chăm sóc thú cưng'),
      items: itemsList,
      total_amount: total,
      discount_amount: discount,
      final_amount: finalAmount,
      status: finalStatus,
      payment_method: payment_method || (finalStatus === 'PAID' ? 'TIEN_MAT_DA_THU' : 'CHUA_THANH_TOAN'),
      paid_at: finalStatus === 'PAID' ? (req.body.paid_at || new Date().toISOString()) : null,
      created_by: req.user.id,
      created_at: createdAtDate,
      notes: notes || ''
    });

    return res.status(201).json({ success: true, message: 'Lập hóa đơn thành công!', invoice: newInvoice });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lập hóa đơn.' });
  }
});

// PUT /api/invoices/:id - Update invoice (Store Manager / Receptionist)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp xử lý nghiệp vụ hóa đơn của cửa hàng.' });
    }
    const isStaff = ['STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa hóa đơn.' });
    }

    const inv = db.findById('invoices', id);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
    }

    const { service_name, items, total_amount, discount_amount, payment_method, status, notes } = req.body;

    // If invoice is already PAID, do not alter amount unless STORE_MANAGER
    if (inv.status === 'PAID' && req.user.role !== 'STORE_MANAGER') {
      if (total_amount !== undefined && total_amount !== inv.total_amount) {
        return res.status(400).json({ success: false, message: 'Hóa đơn đã thanh toán không được thay đổi tổng tiền.' });
      }
    }

    const updates = {};
    if (service_name) updates.service_name = service_name;
    if (items) updates.items = items;
    if (total_amount !== undefined) updates.total_amount = parseFloat(total_amount) || 0;
    if (discount_amount !== undefined) updates.discount_amount = parseFloat(discount_amount) || 0;
    if (updates.total_amount !== undefined || updates.discount_amount !== undefined) {
      const tot = updates.total_amount !== undefined ? updates.total_amount : inv.total_amount;
      const disc = updates.discount_amount !== undefined ? updates.discount_amount : inv.discount_amount;
      updates.final_amount = Math.max(0, tot - disc);
    }
    if (payment_method) updates.payment_method = payment_method;
    if (status) {
      updates.status = status;
      if (status === 'PAID' && !inv.paid_at) {
        updates.paid_at = new Date().toISOString();
      }
    }
    if (notes !== undefined) updates.notes = notes;

    const updated = db.update('invoices', id, updates);
    return res.json({ success: true, message: 'Cập nhật hóa đơn thành công!', invoice: updated });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật hóa đơn.' });
  }
});

// PATCH /api/invoices/:id/pay - Confirm payment (Customer choice or Receptionist/Store Manager confirmation)
router.patch('/:id/pay', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method = 'CHUYEN_KHOAN_VIETQR', status, notes } = req.body;

    const inv = db.findById('invoices', id);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
    }

    if (inv.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Hóa đơn này đã bị hủy, không thể thực hiện thanh toán.' });
    }

    if (inv.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Hóa đơn này đã được thanh toán trước đó.' });
    }

    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp xử lý nghiệp vụ thanh toán của cửa hàng.' });
    }

    const isStaff = ['STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isOwner = req.user.role === 'USER' && inv.user_id === req.user.id;

    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên hóa đơn này.' });
    }

    // Role-based status resolution:
    // Chủ nuôi KHÔNG thể tự đánh dấu PAID
    let newStatus = 'PAID';
    let isNowPaid = false;

    if (isStaff) {
      newStatus = status || 'PAID';
      isNowPaid = (newStatus === 'PAID');
    } else if (isOwner) {
      if (payment_method === 'TIEN_MAT') {
        newStatus = 'PENDING';
        isNowPaid = false;
      } else {
        // Chuyển khoản VietQR -> Chờ Lễ tân xác nhận giao dịch
        newStatus = 'WAITING_CONFIRMATION';
        isNowPaid = false;
      }
    }

    const nowIso = new Date().toISOString();
    const updated = db.update('invoices', id, {
      status: newStatus,
      payment_method: payment_method || inv.payment_method,
      paid_at: isNowPaid ? nowIso : (inv.paid_at || null),
      notes: notes || (payment_method === 'TIEN_MAT' ? 'Khách hàng chọn thanh toán tiền mặt tại quầy lễ tân.' : (isNowPaid ? `Lễ tân (${req.user.full_name}) đã xác nhận thanh toán.` : 'Khách hàng đã gửi yêu cầu thanh toán chuyển khoản.')),
      updated_at: nowIso
    });

    if (isNowPaid) {
      // Đồng bộ trạng thái thanh toán của lịch hẹn nếu có
      if (inv.appointment_id) {
        db.update('appointments', inv.appointment_id, {
          paymentStatus: 'PAID',
          is_paid: true,
          paidAt: nowIso,
          payment_confirmed_by: req.user.full_name,
          payment_confirmed_by_id: req.user.id,
          payment_confirmed_at: nowIso,
          hasInvoice: true,
          invoice_id: id,
          invoice_code: inv.invoice_code,
          updatedAt: nowIso
        });
      }

      // Ghi nhận payments nếu chưa có
      const existingPay = db.find('payments', p => p.invoice_id === id)?.[0];
      if (!existingPay) {
        db.insert('payments', {
          invoice_id: id,
          appointment_id: inv.appointment_id || null,
          user_id: inv.user_id,
          amount: inv.final_amount || inv.total_amount,
          payment_method: payment_method || 'CHUYEN_KHOAN_DA_NHAN',
          status: 'SUCCESS',
          paid_at: nowIso,
          confirmed_by: req.user.full_name,
          confirmed_by_id: req.user.id
        });
      }
    }

    const returnMsg = isNowPaid 
      ? 'Xác nhận thanh toán hóa đơn thành công!' 
      : (payment_method === 'TIEN_MAT' 
          ? 'Đã ghi nhận phương thức thanh toán tiền mặt tại quầy lễ tân!' 
          : 'Đã gửi thông tin chuyển khoản! Vui lòng chờ Lễ tân kiểm tra và xác nhận thanh toán.');

    return res.json({
      success: true,
      message: returnMsg,
      invoice: updated
    });
  } catch (err) {
    console.error('Pay invoice error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thanh toán hóa đơn.' });
  }
});

// DELETE /api/invoices/:id - Delete invoice (Admin only)
router.delete('/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền xóa hóa đơn.' });
    }
    const { id } = req.params;
    const deleted = db.delete('invoices', id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn để xóa.' });
    }
    return res.json({ success: true, message: 'Đã xóa hóa đơn thành công!' });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa hóa đơn.' });
  }
});

module.exports = router;

