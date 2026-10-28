const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { invalidateRAGCache } = require('../utils/ragEngine');

router.use(authenticateToken);

// Lấy danh sách lịch hẹn
router.get('/', (req, res) => {
  try {
    let appointments = db.find('appointments', () => true) || [];
    
    // Nối thông tin thú cưng, chủ nuôi, nhân viên phụ trách và nhân viên được đề xuất
    appointments = appointments.map(app => {
      const pet = db.findById('pets', app.petId) || {};
      const ownerId = app.ownerId || app.userId || pet.user_id;
      const owner = (ownerId ? db.findById('users', ownerId) : null) || {};
      const staffId = app.staffId || app.staff_id;
      const staff = staffId ? db.findById('users', staffId) : null;
      const proposedStaffId = app.proposedStaffId || null;
      const proposedStaff = proposedStaffId ? db.findById('users', proposedStaffId) : null;

      return {
        ...app,
        staffId: staffId || null,
        staff_id: staffId || null,
        proposedStaffId: proposedStaffId,
        proposedStaffName: proposedStaff ? proposedStaff.full_name : (app.proposedStaffName || null),
        ownerId: ownerId,
        userId: ownerId,
        petName: pet.name || 'Thú cưng',
        petSpecies: pet.species || 'Chưa rõ',
        ownerName: owner.full_name || 'Khách hàng',
        ownerPhone: owner.phone || '',
        staffName: staff ? staff.full_name : (app.staffName || null)
      };
    });

    if (req.user.role === 'USER') {
      appointments = appointments.filter(a => a.ownerId === req.user.id || a.userId === req.user.id);
    } else if (req.user.role === 'CARE_STAFF') {
      appointments = appointments.filter(a => 
        a.staffId === req.user.id || 
        a.staff_id === req.user.id || 
        a.proposedStaffId === req.user.id || 
        a.assignedTo === req.user.id
      );
    }

    // Sắp xếp mới nhất lên đầu
    appointments.sort((a, b) => new Date(b.createdAt || b.created_at || Date.now()) - new Date(a.createdAt || a.created_at || Date.now()));

    res.json({ success: true, appointments });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch hẹn.' });
  }
});

// Lấy chi tiết lịch hẹn
router.get('/:id', (req, res) => {
  try {
    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isAssignedCareStaff = req.user.role === 'CARE_STAFF' && (
      app.staffId === req.user.id || 
      app.staff_id === req.user.id || 
      app.proposedStaffId === req.user.id
    );
    const isOwner = req.user.role === 'USER' && (app.ownerId === req.user.id || app.userId === req.user.id);

    if (!isStaff && !isAssignedCareStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập lịch hẹn này.' });
    }

    const pet = db.findById('pets', app.petId) || {};
    const ownerId = app.ownerId || app.userId || pet.user_id;
    const owner = db.findById('users', ownerId) || {};
    const staffId = app.staffId || app.staff_id;
    const staff = staffId ? db.findById('users', staffId) : null;
    const proposedStaff = app.proposedStaffId ? db.findById('users', app.proposedStaffId) : null;

    const healthRecords = db.find('pet_health_records', h => h.pet_id === app.petId || h.appointment_id === app.id);

    let detailedApp = {
      ...app,
      ownerId,
      staffId: staffId || null,
      staffName: staff ? staff.full_name : (app.staffName || null),
      proposedStaffId: app.proposedStaffId || null,
      proposedStaffName: proposedStaff ? proposedStaff.full_name : (app.proposedStaffName || null),
      pet,
      owner,
      healthRecords
    };

    res.json({ success: true, appointment: detailedApp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết lịch.' });
  }
});

// Helper to resolve service/package price from database
function getServicePrice(serviceName) {
  if (!serviceName) return 150000;
  const sNameLower = serviceName.trim().toLowerCase();
  
  // Check services
  const services = db.find('services', () => true) || [];
  const foundSrv = services.find(s => s.name && s.name.trim().toLowerCase() === sNameLower);
  if (foundSrv && foundSrv.price) return parseFloat(foundSrv.price);

  // Check packages
  const packages = db.find('service_packages', () => true) || [];
  const foundPkg = packages.find(p => p.name && p.name.trim().toLowerCase() === sNameLower);
  if (foundPkg && foundPkg.price) return parseFloat(foundPkg.price);

  // Partial match
  const partialSrv = services.find(s => s.name && (sNameLower.includes(s.name.trim().toLowerCase()) || s.name.trim().toLowerCase().includes(sNameLower)));
  if (partialSrv && partialSrv.price) return parseFloat(partialSrv.price);

  const partialPkg = packages.find(p => p.name && (sNameLower.includes(p.name.trim().toLowerCase()) || p.name.trim().toLowerCase().includes(sNameLower)));
  if (partialPkg && partialPkg.price) return parseFloat(partialPkg.price);

  return 150000; // Standard default
}

// Đặt lịch mới (USER đặt cho mình, RECEPTIONIST/STORE_MANAGER đặt cho khách và có thể phân công cho nhân viên)
router.post('/', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp tạo/lập lịch hẹn nghiệp vụ của cửa hàng. Quyền này thuộc về Quản lý cửa hàng, Lễ tân và Chủ nuôi.' });
    }

    if (req.user.role === 'CARE_STAFF') {
      return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc không có quyền tự đặt lịch hẹn.' });
    }

    const petId = req.body.petId || req.body.pet_id;
    const appointmentDate = req.body.appointmentDate || req.body.date || req.body.appointment_date;
    const appointmentTime = req.body.appointmentTime || req.body.time || req.body.appointment_time;
    let examinationType = req.body.examinationType || req.body.serviceName || req.body.service_name || req.body.service;
    const serviceId = req.body.serviceId || req.body.service_id;
    if (!examinationType && serviceId) {
      const srv = db.findById('services', serviceId) || db.findById('service_packages', serviceId);
      if (srv) examinationType = srv.name;
    }
    const reason = req.body.reason || '';
    const symptoms = req.body.symptoms || '';
    const weight = req.body.weight;
    const priority = req.body.priority || 'NORMAL';
    const note = req.body.note || req.body.notes || '';
    const userId = req.body.userId || req.body.user_id;
    const ownerId = req.body.ownerId || req.body.owner_id;
    const assignedStaffId = req.body.staffId || req.body.staff_id || null;
    let paymentMethod = req.body.paymentMethod || req.body.payment_method || 'TIEN_MAT';
    if (paymentMethod === 'CHUYEN_KHOAN_VIETQR' || paymentMethod === 'CHUYEN_KHOAN_NGAN_HANG' || paymentMethod === 'CHUYEN_KHOAN') {
      paymentMethod = 'CHUYEN_KHOAN';
    } else {
      paymentMethod = 'TIEN_MAT';
    }

    if (!petId || !appointmentDate || !appointmentTime || !examinationType) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Thú cưng, Ngày, Giờ, Dịch vụ).' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const pet = db.findById('pets', petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thú cưng.' });
    }

    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Thú cưng không thuộc tài khoản hiện tại.' });
    }

    const targetUserId = (isStaff && (userId || ownerId)) ? (userId || ownerId) : pet.user_id;

    // Kiểm tra trùng lịch của cùng thú cưng
    const conflict = db.find('appointments', a => 
      a.petId === petId && 
      a.appointmentDate === appointmentDate && 
      a.appointmentTime === appointmentTime && 
      ['PENDING', 'PENDING_STAFF_CONFIRMATION', 'CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status)
    );
    if (conflict.length > 0) {
      return res.status(400).json({ success: false, message: 'Bé thú cưng này đã có lịch hẹn vào cùng khung giờ.' });
    }

    let proposedStaffName = null;
    if (assignedStaffId) {
      const staffObj = db.findById('users', assignedStaffId);
      if (staffObj) proposedStaffName = staffObj.full_name;
    }

    const initialStatus = assignedStaffId ? 'PENDING_STAFF_CONFIRMATION' : 'PENDING';
    const estimatedPrice = getServicePrice(examinationType);

    const newApp = {
      petId,
      userId: targetUserId,
      ownerId: targetUserId,
      priority: priority || 'NORMAL',
      appointmentDate,
      appointmentTime,
      examinationType,
      reason: reason || '',
      symptoms: symptoms || '',
      weight: weight ? parseFloat(weight) : (pet.weight || 0),
      note: note || '',
      status: initialStatus,
      paymentMethod: paymentMethod,
      paymentStatus: 'CHO_XAC_NHAN',
      estimatedPrice: estimatedPrice,
      price: estimatedPrice,
      hasInvoice: false,
      invoice_id: null,
      invoice_code: null,
      staffId: null, // Chưa ghi nhận chính thức cho đến khi nhân viên xác nhận
      staffName: null,
      proposedStaffId: assignedStaffId,
      proposedStaffName: proposedStaffName,
      assignedBy: assignedStaffId ? req.user.full_name : null,
      assignedById: assignedStaffId ? req.user.id : null,
      assignedAt: assignedStaffId ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = db.insert('appointments', newApp);

    // AI REMINDER REQUIREMENT: Tự động tạo nhắc lịch từ lịch vừa đặt
    const reminderDateParts = appointmentDate.split('-');
    const formattedReminderDate = reminderDateParts.length === 3 ? `${reminderDateParts[2]}/${reminderDateParts[1]}/${reminderDateParts[0]}` : appointmentDate;
    const cleanServiceName = (examinationType || 'Dịch vụ chăm sóc').replace(/^\[AI\]\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '').trim();
    const reminderMsg = `🔔 Nhắc lịch chăm sóc cho bé ${pet.name}: Bé có lịch ${cleanServiceName} vào lúc ${appointmentTime} ngày ${formattedReminderDate}. Vui lòng đưa bé đến đúng lịch hẹn.`;
    
    db.insert('notifications', {
      id: 'notif_rem_' + saved.id,
      user_id: targetUserId,
      title: '<i class="fa-solid fa-robot"></i> Nhắc Lịch AI',
      message: reminderMsg,
      type: 'AI_REMINDER',
      reference_id: saved.id,
      appointment_id: saved.id,
      pet_id: petId,
      owner_id: targetUserId,
      service: cleanServiceName,
      date: appointmentDate,
      time: appointmentTime,
      is_read: false,
      status: initialStatus
    });

    db.generateReminders();

    // Thông báo cho chủ nuôi và nhân viên (an toàn)
    const ownerUser = targetUserId ? db.findById('users', targetUserId) : null;
    try {
      if (ownerUser && !isStaff) {
        db.insert('notifications', {
          user_id: targetUserId,
          title: '<i class="fa-solid fa-calendar"></i> Đặt lịch chăm sóc thành công',
          message: `Bạn đã đặt lịch "${examinationType}" cho bé ${pet.name} lúc ${appointmentTime} ngày ${appointmentDate}. Trạng thái thanh toán: "Chờ xác nhận".`,
          type: 'APPOINTMENT',
          reference_id: saved.id,
          appointment_id: saved.id,
          is_read: false
        });
      }

      if (assignedStaffId) {
        db.insert('notifications', {
          user_id: assignedStaffId,
          title: '<i class="fa-solid fa-calendar"></i> Yêu cầu xác nhận lịch chăm sóc mới',
          message: `Bạn được đề xuất phân công lịch "${examinationType}" cho bé ${pet.name} lúc ${appointmentTime} ngày ${appointmentDate}. Người phân công: ${req.user.full_name}. Vui lòng kiểm tra và xác nhận nhận lịch.`,
          type: 'APPOINTMENT_ASSIGNED',
          reference_id: saved.id,
          appointment_id: saved.id,
          is_read: false
        });
      }
    } catch (notifErr) {
      console.warn('Lỗi khi gửi thông báo đặt lịch:', notifErr.message);
    }

    // Xóa cache RAG cũ để AI nhận biết ngay lịch hẹn mới vừa tạo
    invalidateRAGCache('appointment');

    return res.status(201).json({
      success: true,
      message: assignedStaffId 
        ? `Đặt lịch thành công! Trạng thái: Chờ nhân viên ${proposedStaffName} xác nhận.` 
        : 'Đặt lịch chăm sóc thành công!',
      appointment: {
        ...saved,
        petName: pet.name || 'Thú cưng',
        petSpecies: pet.species || 'Chưa rõ',
        ownerName: ownerUser ? ownerUser.full_name : 'Khách hàng'
      }
    });
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo lịch hẹn.' });
  }
});

// Cập nhật phương thức thanh toán sau khi đặt lịch (Bước 2: Thanh toán)
router.patch('/:id/payment-method', (req, res) => {
  try {
    const { id } = req.params;
    let paymentMethod = req.body.paymentMethod || req.body.payment_method || 'TIEN_MAT';
    if (paymentMethod === 'CHUYEN_KHOAN_VIETQR' || paymentMethod === 'CHUYEN_KHOAN_NGAN_HANG' || paymentMethod === 'CHUYEN_KHOAN') {
      paymentMethod = 'CHUYEN_KHOAN';
    } else {
      paymentMethod = 'TIEN_MAT';
    }

    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    const isOwner = req.user.role === 'USER' && (app.ownerId === req.user.id || app.userId === req.user.id);
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật lịch hẹn này.' });
    }

    const nowIso = new Date().toISOString();
    const updated = db.update('appointments', id, {
      paymentMethod,
      paymentStatus: 'CHO_XAC_NHAN',
      updatedAt: nowIso
    });

    return res.json({
      success: true,
      message: paymentMethod === 'CHUYEN_KHOAN' 
        ? 'Đã chọn phương thức Chuyển khoản VietQR! Trạng thái thanh toán: Chờ xác nhận.' 
        : 'Đã chọn phương thức Tiền mặt tại quầy! Trạng thái thanh toán: Chờ xác nhận.',
      appointment: updated
    });
  } catch (err) {
    console.error('Update payment method error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật phương thức thanh toán.' });
  }
});

// Xác nhận lịch hẹn bởi Lễ tân / Quản lý cửa hàng (Xác nhận lịch, KHÔNG tự động đổi trạng thái thanh toán)
router.put('/:id/confirm', (req, res) => {
  try {
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Chỉ Quản lý và Lễ tân mới có quyền xác nhận lịch hẹn.' });
    }

    const { id } = req.params;
    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể xác nhận lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    const nowIso = new Date().toISOString();
    const pet = db.findById('pets', app.petId) || {};
    const ownerId = app.ownerId || app.userId || pet.user_id;

    const currentPaymentStatus = app.paymentStatus || 'CHO_XAC_NHAN';

    const updated = db.update('appointments', id, {
      status: 'CONFIRMED',
      paymentStatus: currentPaymentStatus,
      confirmed: true,
      is_confirmed: true,
      receptionist_confirmed: true,
      confirmed_by_receptionist: req.user.full_name,
      confirmed_by_receptionist_id: req.user.id,
      reception_confirmed_at: nowIso,
      updatedAt: nowIso
    });

    if (ownerId) {
      db.insert('notifications', {
        user_id: ownerId,
        title: '<i class="fa-solid fa-check"></i> Lễ tân đã xác nhận lịch hẹn',
        message: `Lịch hẹn "${app.examinationType}" cho bé ${pet.name || 'thú cưng'} (${app.appointmentTime} ngày ${app.appointmentDate}) đã được Lễ tân xác nhận tiếp nhận. Vui lòng đưa bé đến đúng giờ hẹn.`,
        type: 'APPOINTMENT',
        reference_id: app.id,
        is_read: false
      });
    }

    db.generateReminders();

    return res.json({
      success: true,
      message: 'Đã xác nhận lịch hẹn thành công!',
      appointment: updated
    });
  } catch (err) {
    console.error('Reception confirm appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xác nhận lịch hẹn.' });
  }
});

// Xác nhận thanh toán bởi Lễ tân / Quản lý cửa hàng (Tiền mặt hoặc Chuyển khoản)
router.patch('/:id/confirm-payment', (req, res) => {
  try {
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ Lễ tân hoặc Quản lý mới có quyền xác nhận thanh toán. Chủ nuôi không thể tự xác nhận thanh toán.' 
      });
    }

    const { id } = req.params;
    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể xác nhận thanh toán cho lịch hẹn đã bị hủy.' });
    }

    if (app.paymentStatus === 'PAID' || app.paymentStatus === 'DA_THANH_TOAN') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã được xác nhận thanh toán trước đó, không thể xác nhận trùng.' });
    }

    const nowIso = new Date().toISOString();
    const pet = db.findById('pets', app.petId) || {};
    const ownerId = app.ownerId || app.userId || pet.user_id;
    const owner = ownerId ? db.findById('users', ownerId) : null;
    const estimatedPrice = app.estimatedPrice || app.price || getServicePrice(app.examinationType);

    const isTransfer = (app.paymentMethod === 'CHUYEN_KHOAN' || app.paymentMethod === 'CHUYEN_KHOAN_VIETQR' || app.paymentMethod === 'CHUYEN_KHOAN_NGAN_HANG');
    const paymentMethodCode = isTransfer ? 'CHUYEN_KHOAN_DA_NHAN' : 'TIEN_MAT_DA_THU';
    const paymentMethodLabel = isTransfer ? 'Chuyển khoản ngân hàng' : 'Tiền mặt tại cửa hàng';

    // Tìm hóa đơn liên kết hoặc tạo hóa đơn mới
    let existingInvoice = db.find('invoices', inv => inv.appointment_id === id && inv.status !== 'CANCELLED')?.[0];
    let invoiceCode = existingInvoice ? existingInvoice.invoice_code : null;
    let invoiceId = existingInvoice ? existingInvoice.id : null;

    if (existingInvoice) {
      db.update('invoices', existingInvoice.id, {
        status: 'PAID',
        payment_method: paymentMethodCode,
        payment_method_label: paymentMethodLabel,
        paid_at: nowIso,
        confirmed_by: req.user.full_name,
        confirmed_by_id: req.user.id,
        updated_at: nowIso
      });
    } else {
      const codeNum = (db.data.invoices ? db.data.invoices.length : 0) + 1;
      invoiceCode = `HD-2026-${String(codeNum).padStart(3, '0')}`;

      const newInvoice = {
        invoice_code: invoiceCode,
        user_id: ownerId,
        owner_name: owner ? owner.full_name : (app.ownerName || 'Khách hàng'),
        owner_phone: owner ? owner.phone : '',
        owner_email: owner ? owner.email : '',
        pet_id: app.petId,
        pet_name: pet.name || app.petName || 'Thú cưng',
        appointment_id: app.id,
        service_name: app.examinationType || 'Dịch vụ chăm sóc',
        items: [
          {
            name: app.examinationType || 'Dịch vụ chăm sóc',
            quantity: 1,
            price: estimatedPrice,
            amount: estimatedPrice
          }
        ],
        total_amount: estimatedPrice,
        discount_amount: 0,
        final_amount: estimatedPrice,
        status: 'PAID',
        payment_method: paymentMethodCode,
        payment_method_label: paymentMethodLabel,
        paid_at: nowIso,
        created_by: req.user.id,
        created_by_name: req.user.full_name,
        created_at: nowIso,
        notes: `Xác nhận thanh toán bởi Lễ tân (${req.user.full_name}) qua ${paymentMethodLabel}.`
      };

      const savedInvoice = db.insert('invoices', newInvoice);
      invoiceId = savedInvoice.id;
    }

    // Ghi nhận payments nếu chưa có
    const existingPayment = db.find('payments', p => p.appointment_id === app.id || (invoiceId && p.invoice_id === invoiceId))?.[0];
    if (!existingPayment) {
      db.insert('payments', {
        invoice_id: invoiceId,
        appointment_id: app.id,
        user_id: ownerId,
        amount: estimatedPrice,
        payment_method: paymentMethodCode,
        status: 'SUCCESS',
        paid_at: nowIso,
        confirmed_by: req.user.full_name,
        confirmed_by_id: req.user.id
      });
    }

    const updated = db.update('appointments', id, {
      paymentStatus: 'DA_THANH_TOAN',
      payment_status: 'DA_THANH_TOAN',
      is_paid: true,
      paidAt: nowIso,
      payment_confirmed_by: req.user.full_name,
      payment_confirmed_by_id: req.user.id,
      payment_confirmed_at: nowIso,
      invoice_id: invoiceId,
      invoice_code: invoiceCode,
      invoiceId: invoiceId,
      invoiceCode: invoiceCode,
      hasInvoice: true,
      updatedAt: nowIso
    });

    // Đồng bộ sang care_schedules liên kết
    const linkedCareSchedules = db.find('care_schedules', s => s.appointment_id === id || s.id === 'sch_app_' + id) || [];
    linkedCareSchedules.forEach(s => {
      db.update('care_schedules', s.id, {
        payment_status: 'DA_THANH_TOAN',
        paymentStatus: 'DA_THANH_TOAN',
        payment_method: paymentMethodCode,
        updated_at: nowIso
      });
    });

    if (ownerId) {
      db.insert('notifications', {
        user_id: ownerId,
        title: '<i class="fa-solid fa-receipt"></i> Xác nhận thanh toán thành công',
        message: `Lễ tân (${req.user.full_name}) đã xác nhận thanh toán thành công cho lịch "${app.examinationType}" của bé ${pet.name || 'thú cưng'}. Phương thức: ${paymentMethodLabel}. Số tiền: ${estimatedPrice.toLocaleString('vi-VN')} VNĐ.`,
        type: 'PAYMENT_CONFIRMED',
        reference_id: app.id,
        appointment_id: app.id,
        invoice_id: invoiceId,
        is_read: false
      });
    }

    return res.json({
      success: true,
      message: `Xác nhận đã thanh toán thành công qua ${paymentMethodLabel}!`,
      appointment: updated,
      invoice_id: invoiceId,
      invoice_code: invoiceCode
    });
  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xác nhận thanh toán.' });
  }
});

// Phân công / Đổi nhân viên chăm sóc (Store Manager / Receptionist)
router.put('/:id/assign', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp phân công lịch chăm sóc nhân viên. Quyền này thuộc về Quản lý cửa hàng (STORE_MANAGER) và Lễ tân.' });
    }

    const isStaff = ['STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Chỉ Quản lý cửa hàng và Lễ tân mới có quyền phân công lịch.' });
    }

    const { id } = req.params;
    const { staffId, note: staffNote, directConfirm } = req.body;

    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể phân công lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    if (!staffId) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn nhân viên chăm sóc được phân công.' });
    }

    const staffUser = db.findById('users', staffId);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin nhân viên chăm sóc.' });
    }

    if (staffUser.role !== 'CARE_STAFF' && staffUser.role !== 'STAFF') {
      return res.status(400).json({ success: false, message: 'Chỉ được phân công cho nhân viên có vai trò Nhân Viên Chăm Sóc (CARE_STAFF).' });
    }

    if (staffUser.status === 'LOCKED') {
      return res.status(400).json({ success: false, message: 'Tài khoản nhân viên này đang bị khóa. Vui lòng chọn nhân viên khác.' });
    }

    const pet = db.findById('pets', app.petId);
    const dateFormatted = new Date(app.appointmentDate).toLocaleDateString('vi-VN');

    // Kiểm tra nhân viên có lịch trùng thời gian trước khi phân công
    const conflict = db.find('appointments', a => 
      a.id !== id && 
      (a.staffId === staffId || a.proposedStaffId === staffId) && 
      a.appointmentDate === app.appointmentDate && 
      a.appointmentTime === app.appointmentTime && 
      !['CANCELLED', 'COMPLETED', 'STAFF_REJECTED'].includes(a.status)
    );
    if (conflict.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Nhân viên ${staffUser.full_name} đã có lịch chăm sóc vào cùng khung giờ (${app.appointmentTime} ngày ${dateFormatted}). Vui lòng chọn nhân viên khác hoặc đổi giờ.` 
      });
    }

    const nowIso = new Date().toISOString();
    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

    // Cập nhật thông tin phân công
    const updatePayload = {
      confirmed: true,
      is_confirmed: true,
      receptionist_confirmed: true,
      proposedStaffId: staffId,
      proposedStaffName: staffUser.full_name,
      staffId: (directConfirm || isAdmin) ? staffId : null,
      staff_id: (directConfirm || isAdmin) ? staffId : null,
      staffName: (directConfirm || isAdmin) ? staffUser.full_name : null,
      assignedBy: req.user.full_name,
      assignedById: req.user.id,
      assignedAt: nowIso,
      assignment_note: staffNote || '',
      status: (directConfirm || isAdmin) ? 'ASSIGNED' : 'PENDING_STAFF_CONFIRMATION',
      updatedAt: nowIso
    };

    const updated = db.update('appointments', id, updatePayload);

    // Đồng bộ sang care_schedules liên kết
    const linkedSchedules = db.find('care_schedules', s => s.appointment_id === id || s.appointmentId === id);
    linkedSchedules.forEach(ls => {
      db.update('care_schedules', ls.id, {
        staff_id: staffId,
        staff_name: staffUser.full_name,
        assigned_to: staffId,
        updated_at: nowIso
      });
    });

    // Gửi thông báo cho đúng nhân viên được phân công
    const notifMsg = `Bạn có lịch chăm sóc mới được phân công\n• Thú cưng: ${pet ? pet.name : 'Thú cưng'}\n• Dịch vụ: ${app.examinationType || 'Chăm sóc'}\n• Thời gian: ${app.appointmentTime} - ${dateFormatted}\n• Người phân công: ${req.user.full_name}${staffNote ? '\n• Ghi chú: ' + staffNote : ''}`;

    db.insert('notifications', {
      user_id: staffId,
      title: '<i class="fa-solid fa-calendar"></i> Lịch chăm sóc được phân công',
      message: notifMsg,
      type: 'APPOINTMENT_ASSIGNED',
      reference_id: app.id,
      appointment_id: app.id,
      is_read: false
    });

    invalidateRAGCache('appointment');
    invalidateRAGCache('schedule');

    return res.json({ 
      success: true, 
      message: `Đã phân công lịch cho nhân viên ${staffUser.full_name} thành công!`, 
      appointment: updated 
    });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi phân công lịch.' });
  }
});


// Tiếp nhận và xác nhận lịch hẹn (Care Staff bấm Xác nhận nhận lịch)
router.put('/:id/accept', (req, res) => {
  try {
    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isProposedCareStaff = req.user.role === 'CARE_STAFF' && (app.proposedStaffId === req.user.id || app.staffId === req.user.id || app.staff_id === req.user.id);

    if (!isStaff && !isProposedCareStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xác nhận nhận lịch hẹn này.' });
    }

    const { appointmentDate, appointmentTime, examinationType, staffNote } = req.body || {};
    
    const newDate = appointmentDate || app.appointmentDate;
    const newTime = appointmentTime || app.appointmentTime;
    const newType = examinationType || app.examinationType;
    const nowIso = new Date().toISOString();

    const confirmedStaffId = (req.user.role === 'CARE_STAFF') ? req.user.id : (app.proposedStaffId || app.staffId || req.user.id);
    const confirmedStaffUser = db.findById('users', confirmedStaffId);
    const confirmedStaffName = confirmedStaffUser ? confirmedStaffUser.full_name : (req.user.full_name || app.proposedStaffName);

    const updated = db.update('appointments', app.id, { 
      status: 'CONFIRMED', 
      staffId: confirmedStaffId,
      staff_id: confirmedStaffId,
      staffName: confirmedStaffName,
      proposedStaffId: confirmedStaffId,
      proposedStaffName: confirmedStaffName,
      confirmed_by: req.user.full_name,
      confirmed_by_id: req.user.id,
      confirmed_at: nowIso,
      acceptedAt: nowIso,
      appointmentDate: newDate,
      appointmentTime: newTime,
      examinationType: newType,
      updatedAt: nowIso
    });

    // Cập nhật trạng thái thông báo phân công của nhân viên thành đã đọc
    const staffNotifs = db.find('notifications', n => n.user_id === req.user.id && (n.reference_id === app.id || n.appointment_id === app.id));
    staffNotifs.forEach(n => {
      db.update('notifications', n.id, { is_read: true, status: 'CONFIRMED' });
    });

    // Tự động liên kết với Hồ Sơ Chăm Sóc của đúng thú cưng
    const existingHealth = db.findOne('pet_health_records', r => r.appointment_id === app.id);
    if (!existingHealth) {
      db.insert('pet_health_records', {
        pet_id: app.petId,
        appointment_id: app.id,
        staff_id: confirmedStaffId,
        staff_name: confirmedStaffName,
        record_date: newDate || nowIso.split('T')[0],
        record_type: 'CHĂM_SÓC',
        title: `Hồ sơ chăm sóc: ${newType || 'Dịch vụ'}`,
        description: `Lịch chăm sóc đã được nhân viên ${confirmedStaffName} xác nhận nhận lịch.`,
        care_content: app.examinationType || 'Chăm sóc thú cưng',
        status: 'CONFIRMED',
        condition_before: app.symptoms || app.reason || 'Bình thường',
        condition_after: '',
        notes: staffNote || app.note || '',
        doctor_name: confirmedStaffName,
        created_at: nowIso,
        updated_at: nowIso
      });
    } else {
      db.update('pet_health_records', existingHealth.id, {
        staff_id: confirmedStaffId,
        staff_name: confirmedStaffName,
        doctor_name: confirmedStaffName,
        status: 'CONFIRMED',
        updated_at: nowIso
      });
    }

    const pet = db.findById('pets', app.petId);
    let msg = `Nhân viên ${confirmedStaffName} đã xác nhận nhận lịch chăm sóc cho bé ${pet ? pet.name : 'thú cưng'}.`;

    const ownerId = app.ownerId || app.userId || (pet ? pet.user_id : null);
    if (ownerId) {
      db.insert('notifications', {
        user_id: ownerId,
        title: '<i class="fa-solid fa-check"></i> Lịch hẹn đã được nhân viên xác nhận',
        message: msg,
        type: 'APPOINTMENT',
        is_read: false
      });
    }

    // Thông báo cho Lễ tân & Admin
    const managementUsers = db.find('users', u => ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(u.role)) || [];
    managementUsers.forEach(u => {
      if (u.id !== req.user.id) {
        db.insert('notifications', {
          user_id: u.id,
          title: '<i class="fa-solid fa-check"></i> Nhân viên đã xác nhận nhận lịch',
          message: `Nhân viên ${confirmedStaffName} đã xác nhận nhận lịch "${app.examinationType}" cho bé ${pet ? pet.name : 'thú cưng'} (${app.appointmentTime} ${app.appointmentDate}).`,
          type: 'APPOINTMENT',
          reference_id: app.id,
          is_read: false
        });
      }
    });

    res.json({ success: true, message: 'Đã xác nhận nhận lịch chăm sóc thành công!', appointment: updated });
  } catch(err) {
    console.error('Accept error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xác nhận lịch.' });
  }
});

// Từ chối nhận lịch hẹn (Care Staff bấm Từ chối)
router.put('/:id/reject', (req, res) => {
  try {
    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isProposedCareStaff = req.user.role === 'CARE_STAFF' && (app.proposedStaffId === req.user.id || app.staffId === req.user.id || app.staff_id === req.user.id);

    if (!isStaff && !isProposedCareStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối lịch hẹn này.' });
    }

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED' || app.status === 'IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'Không thể từ chối lịch hẹn đang tiến hành hoặc đã kết thúc.' });
    }

    const { reject_reason, reason } = req.body || {};
    const finalReason = (reject_reason || reason || 'Nhân viên bận hoặc không thể tiếp nhận khung giờ này').trim();
    const nowIso = new Date().toISOString();

    const rejectingStaffName = req.user.full_name;
    const rejectingStaffId = req.user.id;

    const updated = db.update('appointments', app.id, {
      status: 'STAFF_REJECTED',
      staffId: null,
      staff_id: null,
      staffName: null,
      rejected_at: nowIso,
      rejected_by_staff_id: rejectingStaffId,
      rejected_by_staff_name: rejectingStaffName,
      reject_reason: finalReason,
      updatedAt: nowIso
    });

    const pet = db.findById('pets', app.petId);
    const petName = pet ? pet.name : 'thú cưng';

    // Thông báo cho Admin & Lễ tân để điều phối / phân công lại
    const managementUsers = db.find('users', u => ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(u.role)) || [];
    managementUsers.forEach(u => {
      db.insert('notifications', {
        user_id: u.id,
        title: '<i class="fa-solid fa-triangle-exclamation"></i> Nhân viên đã từ chối nhận lịch',
        message: `Nhân viên ${rejectingStaffName} đã TỪ CHỐI lịch "${app.examinationType}" cho bé ${petName} (${app.appointmentTime} ${app.appointmentDate}). Lý do: ${finalReason}. Vui lòng phân công lại cho nhân viên khác.`,
        type: 'APPOINTMENT',
        reference_id: app.id,
        is_read: false
      });
    });

    return res.json({
      success: true,
      message: 'Đã từ chối nhận lịch chăm sóc. Hệ thống đã thông báo đến Lễ tân/Quản lý để điều phối lại.',
      appointment: updated
    });
  } catch (err) {
    console.error('Reject appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi từ chối lịch hẹn.' });
  }
});


// Bắt đầu thực hiện chăm sóc
router.put('/:id/start', (req, res) => {
  try {
    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể bắt đầu lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isAssignedCareStaff = req.user.role === 'CARE_STAFF' && (app.staffId === req.user.id || app.staff_id === req.user.id);

    if (!isStaff && !isAssignedCareStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền bắt đầu lịch chăm sóc này.' });
    }

    const nowIso = new Date().toISOString();
    const updated = db.update('appointments', app.id, {
      status: 'IN_PROGRESS',
      started_at: nowIso,
      startedAt: nowIso,
      updatedAt: nowIso
    });

    const healthRec = db.findOne('pet_health_records', r => r.appointment_id === app.id);
    if (healthRec) {
      db.update('pet_health_records', healthRec.id, {
        status: 'IN_PROGRESS',
        updated_at: nowIso
      });
    }

    res.json({ success: true, message: 'Đã bắt đầu thực hiện chăm sóc!', appointment: updated });
  } catch (err) {
    console.error('Start care error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi bắt đầu chăm sóc.' });
  }
});

// Ghi nhận cập nhật hồ sơ chăm sóc (Care Staff & Admin only)
router.put('/:id/care-record', (req, res) => {
  try {
    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    if (req.user.role === 'USER') {
      return res.status(403).json({ success: false, message: 'Chủ nuôi không có quyền ghi nhận hồ sơ chăm sóc.' });
    }
    if (req.user.role === 'RECEPTIONIST') {
      return res.status(403).json({ success: false, message: 'Lễ tân không được phép ghi nhận hồ sơ chăm sóc thay Nhân viên chăm sóc.' });
    }

    const isAdmin = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);
    const isAssignedCareStaff = req.user.role === 'CARE_STAFF' && (app.staffId === req.user.id || app.staff_id === req.user.id);

    if (!isAdmin && !isAssignedCareStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền ghi nhận hồ sơ cho lịch chăm sóc này.' });
    }

    const { care_content, condition_before, condition_after, notes } = req.body;
    const nowIso = new Date().toISOString();

    // Update appointment record
    db.update('appointments', app.id, {
      care_content: care_content || app.examinationType || '',
      condition_before: condition_before || '',
      condition_after: condition_after || '',
      condition_result: condition_after || '',
      notes: notes || '',
      updatedAt: nowIso
    });

    const healthRec = db.findOne('pet_health_records', r => r.appointment_id === app.id);
    if (healthRec) {
      db.update('pet_health_records', healthRec.id, {
        care_content: care_content || healthRec.care_content || app.examinationType || '',
        condition_before: condition_before || healthRec.condition_before || '',
        condition_after: condition_after !== undefined ? condition_after : (healthRec.condition_after || ''),
        notes: notes !== undefined ? notes : (healthRec.notes || ''),
        staff_id: req.user.id,
        staff_name: req.user.full_name,
        doctor_name: req.user.full_name,
        updated_at: nowIso
      });
    } else {
      db.insert('pet_health_records', {
        pet_id: app.petId,
        appointment_id: app.id,
        staff_id: req.user.id,
        staff_name: req.user.full_name,
        record_date: app.appointmentDate || nowIso.split('T')[0],
        record_type: 'CHĂM_SÓC',
        title: `Hồ sơ chăm sóc: ${app.examinationType || 'Dịch vụ'}`,
        description: care_content || `Dịch vụ: ${app.examinationType || 'Chăm sóc'}.`,
        care_content: care_content || app.examinationType || '',
        status: app.status || 'IN_PROGRESS',
        condition_before: condition_before || 'Bình thường',
        condition_after: condition_after || '',
        notes: notes || '',
        doctor_name: req.user.full_name,
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    invalidateRAGCache('appointment');
    invalidateRAGCache('health');

    res.json({ success: true, message: 'Đã lưu hồ sơ chăm sóc thành công!' });
  } catch (err) {
    console.error('Care record error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu hồ sơ chăm sóc.' });
  }
});


// Cập nhật trạng thái lịch hẹn theo luồng: PENDING -> CONFIRMED/ACCEPTED -> IN_PROGRESS -> COMPLETED
router.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, condition_before, condition_after, care_content, notes } = req.body;

    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi trạng thái của lịch đã hoàn thành hoặc đã bị hủy.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isAssignedCareStaff = req.user.role === 'CARE_STAFF' && (app.staffId === req.user.id || app.staff_id === req.user.id);

    if (!isStaff && !isAssignedCareStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật trạng thái lịch hẹn này.' });
    }

    const validStatuses = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const normalizedStatus = (status === 'ACCEPTED' || status === 'CONFIRMED') ? 'CONFIRMED' : status;
    const nowIso = new Date().toISOString();

    const updated = db.update('appointments', id, {
      status: normalizedStatus,
      updatedAt: nowIso,
      ...(normalizedStatus === 'CONFIRMED' ? { confirmed_at: nowIso, confirmed_by: req.user.full_name, acceptedAt: nowIso } : {}),
      ...(normalizedStatus === 'IN_PROGRESS' ? { started_at: nowIso, startedAt: nowIso } : {}),
      ...(normalizedStatus === 'COMPLETED' ? { completed_at: nowIso, completedAt: nowIso, completed_by: req.user.full_name } : {})
    });

    // Cập nhật hoặc tạo liên kết với hồ sơ chăm sóc
    const healthRec = db.findOne('pet_health_records', r => r.appointment_id === id);
    if (healthRec) {
      db.update('pet_health_records', healthRec.id, {
        status: normalizedStatus,
        care_content: care_content || healthRec.care_content || '',
        condition_before: condition_before || healthRec.condition_before || '',
        condition_after: condition_after || healthRec.condition_after || '',
        notes: notes || healthRec.notes || '',
        updated_at: nowIso
      });
    } else if (normalizedStatus !== 'CANCELLED') {
      db.insert('pet_health_records', {
        pet_id: app.petId,
        appointment_id: app.id,
        staff_id: req.user.id,
        staff_name: req.user.full_name,
        record_date: app.appointmentDate || nowIso.split('T')[0],
        record_type: 'CHĂM_SÓC',
        title: `Hồ sơ chăm sóc: ${app.examinationType || 'Dịch vụ'}`,
        description: care_content || `Trạng thái: ${normalizedStatus}.`,
        care_content: care_content || app.examinationType || '',
        status: normalizedStatus,
        condition_before: condition_before || app.symptoms || app.reason || 'Bình thường',
        condition_after: condition_after || '',
        notes: notes || app.note || '',
        doctor_name: req.user.full_name,
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    // Đồng bộ trạng thái Lịch Chăm Sóc (care_schedules)
    const linkedCareSchedules = db.find('care_schedules', s => s.appointment_id === id) || [];
    linkedCareSchedules.forEach(s => {
      let schStatus = s.status;
      if (normalizedStatus === 'COMPLETED') schStatus = 'ĐÃ_HOÀN_THÀNH';
      else if (normalizedStatus === 'CANCELLED') schStatus = 'ĐÃ_HỦY';
      else if (['CONFIRMED', 'ACCEPTED'].includes(normalizedStatus)) schStatus = 'CHƯA_THỰC_HIỆN';
      else if (normalizedStatus === 'PENDING') schStatus = 'CHỜ_XÁC_NHẬN';

      db.update('care_schedules', s.id, {
        status: schStatus,
        updated_at: nowIso
      });
    });
    const pet = db.findById('pets', app.petId);
    const targetUserId = app.ownerId || app.userId || (pet ? pet.user_id : null);
    if (targetUserId) {
      let statusLabel = normalizedStatus;
      if (normalizedStatus === 'CONFIRMED' || normalizedStatus === 'ACCEPTED') statusLabel = 'đã được xác nhận nhận lịch';
      if (normalizedStatus === 'IN_PROGRESS') statusLabel = 'đang được nhân viên thực hiện';
      if (normalizedStatus === 'COMPLETED') statusLabel = 'đã hoàn thành xuất sắc';
      if (normalizedStatus === 'CANCELLED') statusLabel = 'đã bị hủy';

      db.insert('notifications', {
        user_id: targetUserId,
        title: `<i class="fa-solid fa-calendar"></i> Lịch chăm sóc: ${statusLabel}`,
        message: `Lịch "${app.examinationType}" cho bé ${pet ? pet.name : 'thú cưng'} ${statusLabel}.`,
        type: 'APPOINTMENT',
        is_read: false
      });
    }

    return res.json({ success: true, message: 'Cập nhật trạng thái lịch hẹn thành công!', appointment: updated });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái.' });
  }
});

// Đổi lịch hẹn (Reschedule)
router.put('/:id/reschedule', (req, res) => {
  try {
    const { id } = req.params;
    const appointmentDate = req.body.appointmentDate || req.body.date;
    const appointmentTime = req.body.appointmentTime || req.body.time;
    const examinationType = req.body.examinationType || req.body.serviceName || req.body.service;
    const reason = req.body.reason || '';

    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ hẹn mới.' });
    }

    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    const isOwner = req.user.role === 'USER' && (app.ownerId === req.user.id || app.userId === req.user.id);
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Không có quyền đổi lịch này.' });
    }

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể đổi lịch hẹn đã hoàn thành hoặc đã hủy.' });
    }

    // Quy tắc nghiêm ngặt đối với Chủ nuôi (USER):
    // Chỉ được đổi lịch khi status === 'PENDING' và chưa được lễ tân xác nhận.
    if (req.user.role === 'USER') {
      const isConfirmedOrBeyond = (app.status && app.status !== 'PENDING') || app.confirmed || app.is_confirmed || app.receptionist_confirmed;
      if (isConfirmedOrBeyond) {
        return res.status(400).json({
          success: false,
          message: 'Lịch đã được lễ tân xác nhận nên bạn không thể tự đổi lịch. Vui lòng nhắn tin cho lễ tân để được hỗ trợ đổi lịch.'
        });
      }
    }

    const rescheduleHistory = Array.isArray(app.reschedule_history) ? [...app.reschedule_history] : [];
    rescheduleHistory.push({
      previousDate: app.appointmentDate,
      previousTime: app.appointmentTime,
      previousService: app.examinationType || '',
      newDate: appointmentDate,
      newTime: appointmentTime,
      newService: examinationType || app.examinationType || '',
      reason: reason || '',
      changedBy: req.user.full_name || 'Người dùng',
      changedAt: new Date().toISOString()
    });

    const updateData = {
      appointmentDate,
      appointmentTime,
      status: req.user.role === 'USER' ? 'PENDING' : (app.status || 'PENDING'),
      reschedule_history: rescheduleHistory,
      updatedAt: new Date().toISOString()
    };

    if (examinationType && examinationType.trim()) {
      updateData.examinationType = examinationType.trim();
    }

    const updated = db.update('appointments', id, updateData);

    // Đồng bộ ngày, giờ sang care_schedules liên kết để không bị phân mảnh/trùng lịch cũ
    const linkedSchedules = db.find('care_schedules', s => 
      s.appointment_id === id || 
      s.appointmentId === id || 
      (s.pet_id === app.petId && s.date === app.appointmentDate && s.time === app.appointmentTime)
    );
    linkedSchedules.forEach(ls => {
      db.update('care_schedules', ls.id, {
        date: appointmentDate,
        time: appointmentTime,
        task_name: examinationType ? `[AI] ${examinationType.trim()}` : ls.task_name,
        appointment_id: id,
        updated_at: new Date().toISOString()
      });
    });

    // Cập nhật hóa đơn chưa thanh toán liên kết với lịch hẹn này nếu có đổi dịch vụ
    if (examinationType && examinationType.trim()) {
      const linkedInvoice = db.findOne('invoices', inv => inv.appointment_id === id);
      if (linkedInvoice && linkedInvoice.status !== 'PAID') {
        const newPrice = getServicePrice(examinationType.trim());
        db.update('invoices', linkedInvoice.id, {
          service_name: examinationType.trim(),
          unit_price: newPrice,
          total_amount: newPrice,
          final_amount: newPrice,
          updated_at: new Date().toISOString()
        });
      }
    }

    const pet = db.findById('pets', app.petId);
    const notifTargetId = app.userId || app.ownerId || (pet ? pet.user_id : null);
    if (notifTargetId) {
      db.insert('notifications', {
        user_id: notifTargetId,
        title: '<i class="fa-solid fa-rotate-right"></i> Lịch hẹn đã được đổi thời gian',
        message: `Lịch hẹn cho bé ${pet ? pet.name : 'thú cưng'} đã được cập nhật sang ${appointmentTime} ngày ${appointmentDate}${examinationType ? ' (Dịch vụ: ' + examinationType + ')' : ''}.`,
        type: 'APPOINTMENT',
        is_read: false
      });
    }

    // Xóa cache RAG cũ để AI cập nhật ngay thời gian/dịch vụ mới sau khi đổi lịch
    invalidateRAGCache('appointment');
    invalidateRAGCache('schedule');

    // Đồng bộ lại nhắc lịch AI
    db.generateReminders();

    return res.json({ success: true, message: 'Đổi lịch hẹn thành công!', appointment: updated });
  } catch (err) {
    console.error('Reschedule error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi lịch.' });
  }
});

// Hủy lịch hẹn
router.put('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;

    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    const isOwner = req.user.role === 'USER' && (app.ownerId === req.user.id || app.userId === req.user.id);
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const isCareStaff = req.user.role === 'CARE_STAFF';

    // 4. Nhân viên chăm sóc không được tự hủy lịch
    if (isCareStaff) {
      return res.status(403).json({ 
        success: false, 
        message: 'Nhân viên chăm sóc không có quyền hủy lịch hẹn. Vui lòng báo Lễ tân hoặc Quản lý để xử lý.' 
      });
    }

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy lịch hẹn này.' });
    }

    // 5. Khi đã hoàn thành -> Không thể hủy
    if (app.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn đã hoàn tất, không thể hủy.' });
    }

    // Đã hủy trước đó
    if (app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã được hủy trước đó.' });
    }

    if (app.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        success: false, 
        message: 'Lịch đang được nhân viên tiến hành chăm sóc, không thể hủy.' 
      });
    }

    const isReceptionConfirmed = Boolean(app.confirmed || app.is_confirmed || app.receptionist_confirmed || app.status === 'CONFIRMED' || app.status === 'ACCEPTED' || app.status === 'PENDING_STAFF_CONFIRMATION');

    // Phân quyền cho Chủ nuôi (USER)
    if (isOwner && !isStaff) {
      // Khi Lễ tân đã bấm xác nhận / đã phân công -> User KHÔNG được phép hủy
      if (isReceptionConfirmed) {
        return res.status(400).json({ 
          success: false, 
          message: 'Lịch đã được lễ tân xác nhận nên bạn không thể hủy lịch. Vui lòng liên hệ lễ tân nếu cần hỗ trợ.' 
        });
      }

      // Chỉ cho phép User hủy khi trạng thái là PENDING (Chờ xác nhận)
      if (app.status !== 'PENDING') {
        return res.status(400).json({ 
          success: false, 
          message: 'Chỉ có thể hủy khi lịch đang ở trạng thái Chờ xác nhận.' 
        });
      }
    }

    const nowIso = new Date().toISOString();
    const finalReason = cancel_reason ? cancel_reason.trim() : (isOwner ? 'Chủ nuôi hủy lịch' : 'Lễ tân / Quản lý hủy lịch');

    const updated = db.update('appointments', id, {
      status: 'CANCELLED',
      cancel_reason: finalReason,
      cancelled_by: req.user.full_name,
      cancelled_by_id: req.user.id,
      cancelled_at: nowIso,
      updatedAt: nowIso
    });

    // Cập nhật hồ sơ chăm sóc nếu đã tạo
    const healthRec = db.findOne('pet_health_records', r => r.appointment_id === id);
    if (healthRec) {
      db.update('pet_health_records', healthRec.id, {
        status: 'CANCELLED',
        notes: `${healthRec.notes || ''} [Lịch đã bị hủy: ${finalReason}]`.trim(),
        updated_at: nowIso
      });
    }

    // Tự động hủy toàn bộ hóa đơn liên kết với lịch hẹn này để bảo đảm tính đúng đắn của doanh thu
    const linkedInvoices = db.find('invoices', inv => inv.appointment_id === id) || [];
    linkedInvoices.forEach(inv => {
      db.update('invoices', inv.id, {
        status: 'CANCELLED',
        notes: `Hóa đơn đã bị hủy do lịch hẹn đã bị hủy (${finalReason}). ${inv.notes || ''}`.trim(),
        updated_at: nowIso
      });
    });

    // Đồng bộ trạng thái Lịch Chăm Sóc sang ĐÃ_HỦY để không xuất hiện trong danh sách hoạt động
    const linkedSchedules = db.find('care_schedules', s => s.appointment_id === id) || [];
    linkedSchedules.forEach(s => {
      db.update('care_schedules', s.id, {
        status: 'ĐÃ_HỦY',
        notes: `Lịch chăm sóc đã bị hủy (${finalReason}). ${s.notes || ''}`.trim(),
        updated_at: nowIso
      });
    });

    const pet = db.findById('pets', app.petId);
    const petName = pet ? pet.name : 'thú cưng';

    // Gửi thông báo hệ thống
    if (isOwner) {
      // Chủ nuôi hủy -> Báo cho Admin & Lễ tân
      const staffUsers = db.find('users', u => ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(u.role)) || [];
      staffUsers.forEach(u => {
        db.insert('notifications', {
          user_id: u.id,
          title: '<i class="fa-solid fa-xmark"></i> Chủ nuôi đã hủy lịch hẹn',
          message: `Khách hàng ${req.user.full_name} đã hủy lịch "${app.examinationType}" cho bé ${petName} (${app.appointmentTime} ngày ${app.appointmentDate}). Lý do: ${finalReason}`,
          type: 'APPOINTMENT',
          reference_id: app.id,
          is_read: false
        });
      });
    } else {
      // Admin / Lễ tân hủy -> Báo cho Chủ nuôi
      const notifTargetId = app.userId || app.ownerId || (pet ? pet.user_id : null);
      if (notifTargetId) {
        db.insert('notifications', {
          user_id: notifTargetId,
          title: '<i class="fa-solid fa-xmark"></i> Lịch chăm sóc đã bị hủy',
          message: `Lịch hẹn "${app.examinationType}" cho bé ${petName} (${app.appointmentTime} ngày ${app.appointmentDate}) đã bị hủy (${finalReason}). Vui lòng liên hệ lễ tân nếu bạn cần hỗ trợ.`,
          type: 'APPOINTMENT',
          reference_id: app.id,
          is_read: false
        });
      }

      // Thông báo cho nhân viên chăm sóc phụ trách (nếu có)
      const assignedStaffId = app.staffId || app.staff_id;
      if (assignedStaffId && assignedStaffId !== req.user.id) {
        db.insert('notifications', {
          user_id: assignedStaffId,
          title: '<i class="fa-solid fa-xmark"></i> Lịch phân công đã bị hủy',
          message: `Lịch chăm sóc "${app.examinationType}" cho bé ${petName} (${app.appointmentTime} ngày ${app.appointmentDate}) đã bị hủy bởi ${req.user.full_name}.`,
          type: 'APPOINTMENT',
          reference_id: app.id,
          is_read: false
        });
      }
    }

    // Xóa cache RAG sau khi hủy lịch
    invalidateRAGCache('appointment');

    // Đồng bộ lại nhắc lịch AI (loại bỏ nhắc lịch của lịch đã hủy)
    db.generateReminders();

    return res.json({ success: true, message: 'Đã hủy lịch hẹn thành công.', appointment: updated });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi hủy lịch.' });
  }
});

// Chỉnh sửa lịch hẹn trực tiếp (Duy nhất ADMIN có quyền)
router.put('/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ Quản trị viên (ADMIN) mới có quyền chỉnh sửa lịch hẹn trực tiếp.' 
      });
    }

    const { id } = req.params;
    const app = db.findById('appointments', id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    if (app.status === 'COMPLETED' || app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa lịch hẹn đã hoàn thành hoặc đã bị hủy.' });
    }

    const {
      appointmentDate,
      appointmentTime,
      examinationType,
      petId,
      reason,
      symptoms,
      note,
      status,
      staffId,
      priority
    } = req.body;

    const updates = { updatedAt: new Date().toISOString() };
    if (appointmentDate) updates.appointmentDate = appointmentDate;
    if (appointmentTime) updates.appointmentTime = appointmentTime;
    if (examinationType) updates.examinationType = examinationType.trim();
    if (petId) {
      const pet = db.findById('pets', petId);
      if (pet) {
        updates.petId = petId;
        updates.userId = pet.user_id;
        updates.ownerId = pet.user_id;
      }
    }
    if (reason !== undefined) updates.reason = reason;
    if (symptoms !== undefined) updates.symptoms = symptoms;
    if (note !== undefined) updates.note = note;
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (staffId !== undefined) {
      updates.staffId = staffId;
      updates.staff_id = staffId;
      if (staffId) {
        const staff = db.findById('users', staffId);
        updates.staffName = staff ? staff.full_name : null;
      } else {
        updates.staffName = null;
      }
    }

    const updated = db.update('appointments', id, updates);
    invalidateRAGCache('appointment');
    db.generateReminders();

    return res.json({ success: true, message: 'Cập nhật lịch hẹn thành công!', appointment: updated });
  } catch (err) {
    console.error('Admin edit appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi chỉnh sửa lịch hẹn.' });
  }
});

// Xóa lịch hẹn (Duy nhất ADMIN có quyền)
router.delete('/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa lịch hẹn.' 
      });
    }

    const app = db.findById('appointments', req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

    // Xóa lịch hẹn
    db.delete('appointments', app.id);

    // Xóa các care_schedules liên kết nếu có
    const linkedSchedules = db.find('care_schedules', s => s.appointment_id === app.id || s.appointmentId === app.id);
    linkedSchedules.forEach(ls => db.delete('care_schedules', ls.id));

    // Đồng bộ lại RAG Cache & Nhắc lịch AI
    invalidateRAGCache('appointment');
    invalidateRAGCache('schedule');
    db.generateReminders();
    return res.json({ success: true, message: 'Đã xóa lịch hẹn thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa lịch.' });
  }
});

// Hoàn thành dịch vụ chăm sóc & ghi nhận kết quả vào hồ sơ
router.put('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const app = db.findById('appointments', id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });
    }

    // Không cho phép bấm hoàn thành nhiều lần nếu đã hoàn thành trước đó (bảo vệ chống trùng lặp)
    if (app.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Lịch chăm sóc này đã được hoàn thành trước đó.' });
    }

    // Không cho phép hoàn tất nếu lịch đã bị hủy
    if (app.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Lịch chăm sóc này đã bị hủy, không thể hoàn tất.' });
    }

    // Phân quyền: Lễ tân, Nhân viên chăm sóc, Quản lý cửa hàng và Admin được phép hoàn tất
    const allowedRoles = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST', 'CARE_STAFF'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Chủ nuôi không có quyền đánh dấu hoàn thành lịch chăm sóc.' });
    }

    // Nếu là CARE_STAFF, kiểm tra nếu lịch đã được chỉ định cho nhân viên khác
    if (req.user.role === 'CARE_STAFF') {
      const assignedStaffId = app.staffId || app.staff_id;
      if (assignedStaffId && assignedStaffId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Lịch chăm sóc này đang được phân công cho nhân viên khác.' });
      }
    }
    
    const updates = req.body || {};
    const nowIso = new Date().toISOString();

    const finalCareContent = (updates.care_content || updates.description || app.examinationType || 'Dịch vụ chăm sóc').trim();
    const finalConditionAfter = (updates.condition_result || updates.condition_after || '').trim();
    const finalNotes = updates.notes !== undefined ? String(updates.notes).trim() : (updates.diagnosis ? String(updates.diagnosis).trim() : '');

    const finalStaffId = app.staffId || app.staff_id || (req.user.role === 'CARE_STAFF' ? req.user.id : null);
    const finalStaffName = app.staffName || (req.user.role === 'CARE_STAFF' ? req.user.full_name : null);
    
    const updated = db.update('appointments', app.id, { 
      ...updates,
      status: 'COMPLETED', 
      completed_at: nowIso,
      completedAt: nowIso,
      completed_by: req.user.full_name,
      completed_by_id: req.user.id,
      care_content: finalCareContent,
      notes: finalNotes,
      condition_result: finalConditionAfter,
      condition_after: finalConditionAfter,
      staffId: finalStaffId,
      staffName: finalStaffName,
      updatedAt: nowIso
    });

    // Cập nhật cân nặng mới cho pet nếu có
    if (updates.weight && parseFloat(updates.weight) > 0) {
      db.update('pets', app.petId, { weight: parseFloat(updates.weight) });
    }

    // Tự động tạo / cập nhật hồ sơ chăm sóc của đúng thú cưng - KHÔNG TẠO TRÙNG LẶP
    const existingRec = db.findOne('pet_health_records', r => r.appointment_id === app.id);
    if (existingRec) {
      db.update('pet_health_records', existingRec.id, {
        status: 'COMPLETED',
        care_content: finalCareContent,
        condition_after: finalConditionAfter || existingRec.condition_after || '',
        notes: finalNotes || existingRec.notes || '',
        completed_at: nowIso,
        staff_id: req.user.id,
        staff_name: req.user.full_name,
        doctor_name: req.user.full_name,
        updated_at: nowIso
      });
    } else {
      const healthRecord = {
        pet_id: app.petId,
        appointment_id: app.id,
        record_date: app.appointmentDate || nowIso.split('T')[0],
        record_type: 'CHĂM_SÓC',
        title: `Hồ sơ chăm sóc: ${app.examinationType || 'Dịch vụ'}`,
        description: finalCareContent,
        care_content: finalCareContent,
        condition_before: updates.condition_before || app.symptoms || app.reason || 'Bình thường',
        condition_after: finalConditionAfter,
        treatment: app.examinationType || 'Chăm sóc',
        doctor_name: req.user.full_name,
        staff_id: req.user.id,
        staff_name: req.user.full_name,
        completed_at: nowIso,
        notes: finalNotes,
        status: 'COMPLETED',
        created_at: nowIso,
        updated_at: nowIso
      };
      db.insert('pet_health_records', healthRecord);
    }

    // Đồng bộ trạng thái Lịch Chăm Sóc sang ĐÃ_HOÀN_THÀNH (Dùng app.id chuẩn, không gây ReferenceError)
    const linkedCareSchedules = db.find('care_schedules', s => s.appointment_id === app.id || (app.care_schedule_id && s.id === app.care_schedule_id)) || [];
    linkedCareSchedules.forEach(s => {
      db.update('care_schedules', s.id, {
        status: 'ĐÃ_HOÀN_THÀNH',
        execution_note: finalNotes || 'Đã hoàn thành dịch vụ',
        updated_at: nowIso
      });

      const existingHistory = db.findOne('care_schedule_history', h => h.schedule_id === s.id && h.appointment_id === app.id);
      if (!existingHistory) {
        db.insert('care_schedule_history', {
          schedule_id: s.id,
          appointment_id: app.id,
          pet_id: s.pet_id || app.petId,
          completed_at: nowIso,
          completed_by: req.user.full_name || 'Người chăm sóc',
          task_name: s.task_name || app.examinationType || 'Chăm sóc',
          content: s.description || finalCareContent,
          execution_note: finalNotes || s.execution_note || ''
        });
      }
    });

    const pet = db.findById('pets', app.petId);
    const ownerId = app.ownerId || app.userId || (pet ? pet.user_id : null);
    if (ownerId) {
      db.insert('notifications', {
        user_id: ownerId,
        title: '<i class="fa-solid fa-party-horn"></i> Bé đã được chăm sóc xong',
        message: `Lịch chăm sóc "${app.examinationType || 'Dịch vụ'}" cho bé ${pet ? pet.name : 'thú cưng'} đã hoàn thành. Bé đã được chăm sóc xong. Vui lòng đến đón thú cưng.`,
        type: 'APPOINTMENT',
        is_read: false
      });
    }

    invalidateRAGCache('appointment');
    invalidateRAGCache('schedule');
    invalidateRAGCache('health');
    invalidateRAGCache('pet');

    // Đồng bộ lại nhắc lịch AI (loại bỏ nhắc lịch khi đã hoàn thành)
    if (typeof db.generateReminders === 'function') {
      db.generateReminders();
    }

    return res.json({ success: true, message: 'Đã hoàn thành dịch vụ chăm sóc và lưu vào Hồ Sơ Chăm Sóc!', appointment: updated });
  } catch(err) {
    console.error('Complete appointment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi hoàn thành lịch chăm sóc.' });
  }
});

module.exports = router;
