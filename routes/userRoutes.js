

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken, requireAdmin, isManagementRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// PUT /api/users/profile - Edit own profile (name, phone, avatar, email)
router.put('/profile', (req, res) => {
  try {
    const { avatar, full_name, phone, address, email } = req.body;
    const userId = req.user.id;

    const user = db.findById('users', userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const updates = {};
    if (avatar) updates.avatar = avatar;
    if (full_name) updates.full_name = full_name.trim();
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
      }
      const existingUser = db.findOne('users', u => u.email.toLowerCase() === trimmedEmail && u.id !== userId);
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi tài khoản khác.' });
      }
      updates.email = trimmedEmail;
    }

    const updatedUser = db.update('users', userId, updates);
    const { password_hash, ...userWithoutPassword } = updatedUser;

    return res.json({ success: true, message: 'Cập nhật hồ sơ thành công.', user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật hồ sơ.' });
  }
});

// PUT /api/users/change-password - Change password
router.put('/change-password', (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = db.findById('users', userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    // Verify current password
    const isMatch = bcrypt.compareSync(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
    }

    // Hash and update new password
    const new_password_hash = bcrypt.hashSync(new_password, 10);
    db.update('users', userId, { password_hash: new_password_hash });

    return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi mật khẩu.' });
  }
});

// User management routes
// Receptionist and Admin can access user listing and creation
const requireUserManagement = (req, res, next) => {
  if (!req.user || !['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý người dùng.' });
  }
  next();
};

// GET /api/users/staff - Get all active Care Staff members (Admin / Receptionist)
router.get('/staff', requireUserManagement, (req, res) => {
  try {
    const allUsers = db.find('users', () => true) || [];
    const staffList = allUsers
      .filter(u => (u.role === 'CARE_STAFF' || u.role === 'STAFF') && u.status !== 'LOCKED' && u.status !== 'DELETED')
      .map(u => {
        const { password_hash, ...rest } = u;
        return rest;
      });
    return res.json({ success: true, staff: staffList, users: staffList });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách nhân viên chăm sóc.' });
  }
});

/* ==========================================================================
   ADMIN ONLY: STAFF MANAGEMENT (LỄ TÂN & NHÂN VIÊN CHĂM SÓC)
   ========================================================================== */

function isReceptionistRole(role) {
  const r = String(role || '').toUpperCase().trim();
  return r === 'RECEPTIONIST' || r === 'LE_TAN' || r === 'LETAN' || r === 'LỄ TÂN' || r.includes('LỄ TÂN') || r.includes('LE TAN');
}

function isCareStaffRole(role) {
  const r = String(role || '').toUpperCase().trim();
  return r === 'CARE_STAFF' || r === 'STAFF' || r === 'DOCTOR' || r === 'CHAMSOC' || r === 'NHANVIEN' || r === 'NHÂN VIÊN CHĂM SÓC' || r.includes('CHĂM SÓC') || r.includes('CHAM SOC');
}

function isStaffMemberRole(role) {
  return isReceptionistRole(role) || isCareStaffRole(role);
}

// GET /api/users/staff-management - Get staff list with role, status, search filtering (Admin only)
const getStaffListHandler = (req, res) => {
  try {
    const { role, status, search } = req.query;
    let allUsers = db.find('users', () => true) || [];

    // Filter only staff roles (RECEPTIONIST and CARE_STAFF) - STRICTLY EXCLUDE ADMIN & USER
    let staffUsers = allUsers.filter(u => isStaffMemberRole(u.role) && u.status !== 'DELETED');

    // Role filter
    if (role && role !== 'ALL') {
      const upperRole = role.toUpperCase().trim();
      if (upperRole === 'CARE_STAFF') {
        staffUsers = staffUsers.filter(u => isCareStaffRole(u.role));
      } else if (upperRole === 'RECEPTIONIST') {
        staffUsers = staffUsers.filter(u => isReceptionistRole(u.role));
      }
    }

    // Status filter
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase().trim();
      staffUsers = staffUsers.filter(u => (u.status || 'ACTIVE').toUpperCase().trim() === upperStatus);
    }

    // Search filter (name, email, phone, id)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      staffUsers = staffUsers.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    // Calculate metadata
    const appointments = db.find('appointments', () => true) || [];
    const invoices = db.find('invoices', () => true) || [];

    const result = staffUsers.map(u => {
      const { password_hash, ...rest } = u;
      const normalizedRole = isReceptionistRole(u.role) ? 'RECEPTIONIST' : 'CARE_STAFF';
      const appCount = appointments.filter(a => a.staffId === u.id || a.staff_id === u.id || a.proposedStaffId === u.id).length;
      const invCount = invoices.filter(inv => inv.created_by === u.id || inv.cashier_id === u.id || inv.staff_id === u.id).length;
      return {
        ...rest,
        role: normalizedRole,
        appointment_count: appCount,
        invoice_count: invCount
      };
    });

    // Compute global stats for all staff members (unaffected by filters)
    const allStaffMembers = allUsers.filter(u => isStaffMemberRole(u.role) && u.status !== 'DELETED');
    const stats = {
      total: allStaffMembers.length,
      receptionist: allStaffMembers.filter(u => isReceptionistRole(u.role)).length,
      care_staff: allStaffMembers.filter(u => isCareStaffRole(u.role)).length,
      active: allStaffMembers.filter(u => (u.status || 'ACTIVE').toUpperCase().trim() !== 'LOCKED').length,
      locked: allStaffMembers.filter(u => (u.status || '').toUpperCase().trim() === 'LOCKED').length
    };

    return res.json({ success: true, staff: result, users: result, stats });
  } catch (err) {
    console.error('Staff management list error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách nhân viên.' });
  }
};

// POST /api/users/staff-management or /api/users/staff - Create a new staff member (Admin only)
const createStaffHandler = (req, res) => {
  try {
    const { full_name, email, password, role, phone, address, avatar } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Họ tên, Email, Mật khẩu và Vai trò nhân viên.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Định dạng Email không hợp lệ.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    let targetRole = isReceptionistRole(role) ? 'RECEPTIONIST' : (isCareStaffRole(role) ? 'CARE_STAFF' : (String(role).toUpperCase() === 'STORE_MANAGER' && req.user.role === 'ADMIN' ? 'STORE_MANAGER' : null));
    if (!targetRole) {
      return res.status(400).json({ success: false, message: 'Vai trò nhân viên không hợp lệ. Chọn "Lễ tân" hoặc "Nhân viên chăm sóc".' });
    }

    const existingUser = db.findOne('users', u => u.email && u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống.' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const newStaff = db.insert('users', {
      full_name: full_name.trim(),
      email: trimmedEmail,
      password_hash,
      role: targetRole,
      status: 'ACTIVE',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(full_name)}`
    });

    const { password_hash: ph, ...staffWithoutPassword } = newStaff;
    return res.status(201).json({
      success: true,
      message: `Thêm nhân viên ${targetRole === 'RECEPTIONIST' ? 'Lễ tân' : 'Chăm sóc'} thành công!`,
      staff: staffWithoutPassword,
      user: staffWithoutPassword
    });
  } catch (err) {
    console.error('Staff management create error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm nhân viên.' });
  }
};

// PUT /api/users/staff-management/:id or /api/users/staff/:id - Update staff member
const updateStaffHandler = (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, password, role, status, phone, address, avatar } = req.body;

    const staffUser = db.findById('users', id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    }

    if (staffUser.role === 'ADMIN' || !isStaffMemberRole(staffUser.role)) {
      return res.status(403).json({ success: false, message: 'Tài khoản này không thuộc nhóm nhân viên có thể quản lý.' });
    }

    const updates = {};
    if (full_name) updates.full_name = full_name.trim();

    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: 'Định dạng Email không hợp lệ.' });
      }
      const existing = db.findOne('users', u => u.email && u.email.toLowerCase().trim() === trimmedEmail && u.id !== id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi tài khoản khác.' });
      }
      updates.email = trimmedEmail;
    }

    if (role) {
      const targetRole = isReceptionistRole(role) ? 'RECEPTIONIST' : (isCareStaffRole(role) ? 'CARE_STAFF' : null);
      if (!targetRole) {
        return res.status(400).json({ success: false, message: 'Vai trò nhân viên chỉ có thể là "Lễ tân" hoặc "Nhân viên chăm sóc".' });
      }
      updates.role = targetRole;
    }

    if (status) {
      const validStatuses = ['ACTIVE', 'LOCKED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
      }
      updates.status = status;
    }

    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (avatar) updates.avatar = avatar;
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      updates.password_hash = bcrypt.hashSync(password, 10);
    }

    const updated = db.update('users', id, updates);
    const { password_hash, ...staffWithoutPassword } = updated;

    return res.json({
      success: true,
      message: 'Cập nhật thông tin nhân viên thành công!',
      staff: staffWithoutPassword,
      user: staffWithoutPassword
    });
  } catch (err) {
    console.error('Staff management update error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật nhân viên.' });
  }
};

// PATCH /api/users/staff-management/:id/toggle-status - Lock/Unlock staff member
const toggleStaffStatusHandler = (req, res) => {
  try {
    const { id } = req.params;
    const staffUser = db.findById('users', id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    }

    if (staffUser.role === 'ADMIN' || !isStaffMemberRole(staffUser.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ được thay đổi trạng thái của nhân viên (Lễ tân / Nhân viên chăm sóc).' });
    }

    const newStatus = (staffUser.status || 'ACTIVE').toUpperCase().trim() === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    db.update('users', id, { status: newStatus });

    return res.json({
      success: true,
      message: `Đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản nhân viên ${staffUser.full_name} thành công.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Staff toggle status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi trạng thái nhân viên.' });
  }
};

// DELETE /api/users/staff-management/:id - Safe delete staff member
const deleteStaffHandler = (req, res) => {
  try {
    const { id } = req.params;
    const staffUser = db.findById('users', id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    }

    if (staffUser.role === 'ADMIN' || !isStaffMemberRole(staffUser.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ được xóa tài khoản nhân viên (Lễ tân / Nhân viên chăm sóc).' });
    }

    // Check data linkages: appointments, invoices, care records, care schedules
    const hasAppointments = db.findOne('appointments', a => 
      a.staffId === id || a.staff_id === id || a.proposedStaffId === id || a.assignedById === id || a.receptionist_confirmed_by === id
    );
    const hasInvoices = db.findOne('invoices', inv => 
      inv.created_by === id || inv.cashier_id === id || inv.staff_id === id
    );
    const hasHealthRecords = db.findOne('pet_health_records', h => 
      h.doctor_id === id || h.staff_id === id || h.created_by === id
    );
    const hasCareSchedules = db.findOne('care_schedules', s => 
      s.staff_id === id
    );

    if (hasAppointments || hasInvoices || hasHealthRecords || hasCareSchedules) {
      return res.status(400).json({
        success: false,
        hasLinkedData: true,
        message: `Nhân viên "${staffUser.full_name}" đã có dữ liệu lịch hẹn, hóa đơn hoặc hồ sơ chăm sóc liên kết trong hệ thống. Vui lòng sử dụng tính năng "Khóa tài khoản" để bảo toàn lịch sử dữ liệu.`
      });
    }

    db.delete('users', id);
    return res.json({
      success: true,
      message: `Đã xóa tài khoản nhân viên "${staffUser.full_name}" thành công.`
    });
  } catch (err) {
    console.error('Staff delete error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa nhân viên.' });
  }
};

// Mount Staff Management Route Endpoints (Support all URL patterns)
router.get('/staff-management', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), getStaffListHandler);
router.get('/staff-list', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), getStaffListHandler);

router.post('/staff-management', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), createStaffHandler);
router.post('/staff', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), createStaffHandler);

router.put('/staff-management/:id', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), updateStaffHandler);
router.put('/staff/:id', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), updateStaffHandler);

router.patch('/staff-management/:id/toggle-status', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), toggleStaffStatusHandler);
router.patch('/staff/:id/toggle-status', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), toggleStaffStatusHandler);

router.delete('/staff-management/:id', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), deleteStaffHandler);
router.delete('/staff/:id', (req,res,next) => isManagementRole(req.user?.role) ? next() : requireAdmin(req,res,next), deleteStaffHandler);

/* ==========================================================================
   ADMIN ONLY: ACCOUNTS & ROLES AUTHORIZATION MANAGEMENT
   (Tài khoản và phân quyền: ADMIN, RECEPTIONIST, CARE_STAFF, USER)
   ========================================================================== */

// GET /api/users/accounts - Get all accounts with search, role filter, status filter, and statistics
router.get('/accounts', requireAdmin, (req, res) => {
  try {
    const { role, status, search } = req.query;
    let allUsers = db.find('users', () => true) || [];
    allUsers = allUsers.filter(u => u.status !== 'DELETED');

    const totalAccounts = allUsers.length;
    const stats = {
      total: totalAccounts,
      admin: allUsers.filter(u => u.role === 'ADMIN').length,
      receptionist: allUsers.filter(u => isReceptionistRole(u.role)).length,
      care_staff: allUsers.filter(u => isCareStaffRole(u.role)).length,
      user: allUsers.filter(u => u.role === 'USER' || u.role === 'owner').length,
      active: allUsers.filter(u => (u.status || 'ACTIVE').toUpperCase() !== 'LOCKED').length,
      locked: allUsers.filter(u => (u.status || '').toUpperCase() === 'LOCKED').length
    };

    let filtered = [...allUsers];

    // Role filter
    if (role && role !== 'ALL') {
      const upperRole = role.toUpperCase().trim();
      if (upperRole === 'CARE_STAFF') {
        filtered = filtered.filter(u => isCareStaffRole(u.role));
      } else if (upperRole === 'RECEPTIONIST') {
        filtered = filtered.filter(u => isReceptionistRole(u.role));
      } else if (upperRole === 'USER') {
        filtered = filtered.filter(u => u.role === 'USER' || u.role === 'owner');
      } else {
        filtered = filtered.filter(u => u.role === upperRole);
      }
    }

    // Status filter
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase().trim();
      filtered = filtered.filter(u => (u.status || 'ACTIVE').toUpperCase() === upperStatus);
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    const pets = db.find('pets', () => true) || [];
    const appointments = db.find('appointments', () => true) || [];

    const accounts = filtered.map(u => {
      const { password_hash, ...rest } = u;
      const petCount = pets.filter(p => p.user_id === u.id).length;
      const appCount = appointments.filter(a => a.userId === u.id || a.staffId === u.id || a.staff_id === u.id).length;
      let displayRole = 'USER';
      if (u.role === 'ADMIN') displayRole = 'ADMIN';
      else if (isReceptionistRole(u.role)) displayRole = 'RECEPTIONIST';
      else if (isCareStaffRole(u.role)) displayRole = 'CARE_STAFF';

      return {
        ...rest,
        role: displayRole,
        pet_count: petCount,
        appointment_count: appCount
      };
    });

    return res.json({ success: true, accounts, stats });
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách tài khoản.' });
  }
});

// POST /api/users/accounts - Create new account with specified role (Admin only)
router.post('/accounts', requireAdmin, (req, res) => {
  try {
    const { full_name, email, password, role = 'USER', phone = '', address = '', avatar = '' } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Họ tên, Email và Mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất 6 ký tự.' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = db.findOne('users', u => u.email && u.email.toLowerCase().trim() === trimmedEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống.' });
    }

    const allowedRoles = ['ADMIN', 'RECEPTIONIST', 'CARE_STAFF', 'USER'];
    const targetRole = allowedRoles.includes(role) ? role : 'USER';

    const newUser = db.insert('users', {
      full_name: full_name.trim(),
      email: trimmedEmail,
      password_hash: bcrypt.hashSync(password, 10),
      role: targetRole,
      status: 'ACTIVE',
      phone: phone.trim(),
      address: address.trim(),
      avatar: avatar.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(full_name)}`
    });

    const { password_hash, ...sanitized } = newUser;
    return res.status(201).json({
      success: true,
      message: `Tạo tài khoản ${sanitized.full_name} (${targetRole}) thành công!`,
      account: sanitized
    });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản.' });
  }
});

// PUT /api/users/accounts/:id - Update account info and role (Admin only)
router.put('/accounts/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, status, password, phone, address, avatar } = req.body;

    const user = db.findById('users', id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng.' });
    }

    const updates = {};
    if (full_name) updates.full_name = full_name.trim();

    if (email) {
      const trimmedEmail = email.toLowerCase().trim();
      const existing = db.findOne('users', u => u.email && u.email.toLowerCase().trim() === trimmedEmail && u.id !== id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email đã được sử dụng bởi tài khoản khác.' });
      }
      updates.email = trimmedEmail;
    }

    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (avatar) updates.avatar = avatar.trim();

    // Role modification safety check
    if (role && role !== user.role) {
      if (user.role === 'ADMIN' && role !== 'ADMIN') {
        const activeAdmins = db.find('users', u => u.role === 'ADMIN' && u.status !== 'LOCKED');
        if (activeAdmins.length <= 1) {
          return res.status(400).json({ success: false, message: 'Không thể hạ quyền Quản trị viên đang hoạt động duy nhất của hệ thống.' });
        }
      }
      const allowedRoles = ['ADMIN', 'RECEPTIONIST', 'CARE_STAFF', 'USER'];
      if (allowedRoles.includes(role)) {
        updates.role = role;
      }
    }

    // Status modification safety check
    if (status && status !== user.status) {
      if (user.role === 'ADMIN' && status === 'LOCKED') {
        const activeAdmins = db.find('users', u => u.role === 'ADMIN' && u.status !== 'LOCKED');
        if (activeAdmins.length <= 1) {
          return res.status(400).json({ success: false, message: 'Không thể khóa Quản trị viên đang hoạt động duy nhất của hệ thống.' });
        }
      }
      updates.status = status;
    }

    if (password && password.trim().length >= 6) {
      updates.password_hash = bcrypt.hashSync(password.trim(), 10);
    }

    const updated = db.update('users', id, updates);
    const { password_hash, ...sanitized } = updated;

    return res.json({
      success: true,
      message: 'Cập nhật tài khoản thành công!',
      account: sanitized
    });
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật tài khoản.' });
  }
});

// GET /api/users - Get customers / pet owners list (Role: USER only)
router.get('/', requireUserManagement, (req, res) => {
  try {
    const roleQuery = (req.query.role || '').trim().toUpperCase();
    let allUsers = db.find('users', () => true) || [];

    if (roleQuery && roleQuery !== 'ALL') {
      if (roleQuery === 'CARE_STAFF' || roleQuery === 'STAFF') {
        allUsers = allUsers.filter(u => isCareStaffRole(u.role) && u.status !== 'DELETED');
      } else if (roleQuery === 'RECEPTIONIST') {
        allUsers = allUsers.filter(u => isReceptionistRole(u.role) && u.status !== 'DELETED');
      } else {
        allUsers = allUsers.filter(u => u.role === roleQuery && u.status !== 'DELETED');
      }
    } else {
      // Default: Strictly return only customers / pet owners (USER)
      allUsers = allUsers.filter(u => (u.role === 'USER' || u.role === 'owner') && u.status !== 'DELETED');
    }

    const users = allUsers.map((u) => {
      const { password_hash, ...rest } = u;
      const petCount = db.find('pets', (p) => p.user_id === u.id).length;
      return { ...rest, petCount };
    });
    return res.json({ success: true, users, staff: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách chủ nuôi.' });
  }
});

// GET /api/users/:id/pets - Get all pets of a specific user
router.get('/:id/pets', requireUserManagement, (req, res) => {
  try {
    const user = db.findById('users', req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });

    const pets = db.find('pets', (p) => p.user_id === req.params.id);
    return res.json({ success: true, pets, owner: { id: user.id, full_name: user.full_name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// GET /api/users/:id/details - Get comprehensive details of a user for Admin/Receptionist
router.get('/:id/details', requireUserManagement, (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = db.findById('users', targetUserId);
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });

    const { password_hash, ...userInfo } = user;

    // 1. Pets belonging STRICTLY to this owner (no all-pets fallback)
    const pets = db.find('pets', (p) => 
      p.user_id === targetUserId || 
      p.userId === targetUserId || 
      p.owner_id === targetUserId || 
      p.ownerId === targetUserId
    ) || [];
    const petIds = pets.map(p => p.id).filter(Boolean);

    // 2. Appointments belonging STRICTLY to this owner or their pets
    let appointments = db.find('appointments', (a) => {
      const matchesUser = a.ownerId === targetUserId || a.userId === targetUserId || a.user_id === targetUserId;
      const matchesPet = (a.petId && petIds.includes(a.petId)) || (a.pet_id && petIds.includes(a.pet_id));
      return matchesUser || matchesPet;
    }) || [];

    appointments = appointments.map(app => {
      const pet = db.findById('pets', app.petId || app.pet_id) || {};
      const staffId = app.staffId || app.staff_id;
      const staff = staffId ? db.findById('users', staffId) : null;
      return {
        ...app,
        petName: pet.name || app.petName || 'Thú cưng',
        petSpecies: pet.species || app.petSpecies || 'Pet',
        staffName: staff ? staff.full_name : (app.staffName || app.proposedStaffName || 'Chưa phân công')
      };
    });
    appointments.sort((a, b) => new Date(b.appointmentDate || b.createdAt || b.created_at || 0) - new Date(a.appointmentDate || a.createdAt || a.created_at || 0));

    const appointmentIds = appointments.map(a => a.id).filter(Boolean);

    // 3. Health & Care records associated STRICTLY with this owner's pets or appointments
    let healthRecords = db.find('pet_health_records', (r) => {
      const matchesPet = (r.pet_id && petIds.includes(r.pet_id)) || (r.petId && petIds.includes(r.petId));
      const matchesAppointment = (r.appointment_id && appointmentIds.includes(r.appointment_id)) || (r.appointmentId && appointmentIds.includes(r.appointmentId));
      return matchesPet || matchesAppointment;
    }) || [];

    healthRecords = healthRecords.map(rec => {
      const pet = db.findById('pets', rec.pet_id || rec.petId) || {};
      return {
        ...rec,
        pet_name: pet.name || rec.pet_name || 'Thú cưng',
        pet_species: pet.species || 'Chưa rõ'
      };
    });
    healthRecords.sort((a, b) => new Date(b.record_date || b.created_at || 0) - new Date(a.record_date || a.created_at || 0));

    // 4. Invoices associated STRICTLY with this owner or their appointments/pets
    let invoices = db.find('invoices', (inv) => {
      const matchesUser = inv.user_id === targetUserId || inv.userId === targetUserId || inv.owner_id === targetUserId || inv.customer_id === targetUserId;
      const matchesPet = (inv.pet_id && petIds.includes(inv.pet_id)) || (inv.petId && petIds.includes(inv.petId));
      const matchesAppointment = (inv.appointment_id && appointmentIds.includes(inv.appointment_id)) || (inv.appointmentId && appointmentIds.includes(inv.appointmentId));
      return matchesUser || matchesPet || matchesAppointment;
    }) || [];
    invoices.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));

    return res.json({
      success: true,
      user: userInfo,
      pets,
      appointments,
      healthRecords,
      invoices
    });
  } catch (err) {
    console.error('Error fetching user full profile:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết chủ nuôi.' });
  }
});

// POST /api/users - Add user (Customer or Staff)
router.post('/', requireUserManagement, (req, res) => {
  try {
    const { full_name, email, password, role, avatar, phone, address } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existingUser = db.findOne('users', (u) => u.email && u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email này đã tồn tại.' });
    }

    let targetRole = 'USER';
    if (req.user.role === 'ADMIN' && role) {
      if (isReceptionistRole(role)) targetRole = 'RECEPTIONIST';
      else if (isCareStaffRole(role)) targetRole = 'CARE_STAFF';
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const newUser = db.insert('users', {
      full_name: full_name.trim(),
      email: trimmedEmail,
      password_hash,
      role: targetRole,
      status: 'ACTIVE',
      phone: phone || '',
      address: address || '',
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(full_name)}`
    });

    const { password_hash: ph, ...userWithoutPassword } = newUser;
    return res.status(201).json({ success: true, message: 'Thêm chủ nuôi mới thành công.', user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm người dùng.' });
  }
});

// PUT /api/users/:id - Edit user
router.put('/:id', requireUserManagement, (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, status, password, avatar, phone, address } = req.body;

    const user = db.findById('users', id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    // Receptionist can only update USER (customer) accounts
    if (req.user.role === 'RECEPTIONIST' && user.role !== 'USER') {
      return res.status(403).json({ success: false, message: 'Lễ tân chỉ có quyền cập nhật thông tin khách hàng (Chủ nuôi).' });
    }

    // Store Manager cannot update Admin accounts
    if (req.user.role === 'STORE_MANAGER' && user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản lý cửa hàng không có quyền chỉnh sửa tài khoản Quản trị viên.' });
    }

    const updates = {};
    if (full_name) updates.full_name = full_name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    
    // Role changing is strictly Admin only
    if (role && role !== user.role && req.user.role === 'ADMIN') {
      if (user.role === 'ADMIN') {
        const allAdmins = db.find('users', u => u.role === 'ADMIN');
        if (allAdmins.length <= 1) {
          return res.status(400).json({ success: false, message: 'Không thể hạ quyền Quản trị viên duy nhất của hệ thống.' });
        }
      }
      const allowedRoles = ['ADMIN', 'USER', 'RECEPTIONIST', 'CARE_STAFF'];
      if (allowedRoles.includes(role)) {
        updates.role = role;
      }
    }

    // Status changing is strictly Admin only
    if (status && status !== user.status && req.user.role === 'ADMIN') {
      if (user.role === 'ADMIN' && status === 'LOCKED') {
        const allAdmins = db.find('users', u => u.role === 'ADMIN' && u.status === 'ACTIVE');
        if (allAdmins.length <= 1) {
          return res.status(400).json({ success: false, message: 'Không thể khóa Quản trị viên đang hoạt động duy nhất.' });
        }
      }
      updates.status = status;
    }
    if (password) updates.password_hash = bcrypt.hashSync(password, 10);
    if (avatar) updates.avatar = avatar;

    const updatedUser = db.update('users', id, updates);
    const { password_hash, ...userWithoutPassword } = updatedUser;

    return res.json({ success: true, message: 'Cập nhật thông tin người dùng thành công.', user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi sửa người dùng.' });
  }
});

// PATCH /api/users/:id/toggle-status - Lock/Unlock user (Admin only)
router.patch('/:id/toggle-status', (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền khóa/mở khóa tài khoản.' });
    }

    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự khóa tài khoản của chính mình.' });
    }

    const user = db.findById('users', id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const newStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    
    if (user.role === 'ADMIN' && newStatus === 'LOCKED') {
      const allAdmins = db.find('users', u => u.role === 'ADMIN' && u.status === 'ACTIVE');
      if (allAdmins.length <= 1) {
        return res.status(400).json({ success: false, message: 'Không thể khóa Quản trị viên đang hoạt động duy nhất.' });
      }
    }

    db.update('users', id, { status: newStatus });

    return res.json({
      success: true,
      message: `Đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản ${user.full_name} thành công.`,
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi trạng thái người dùng.' });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền xóa tài khoản.' });
    }

    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản của chính mình.' });
    }

    const userToDelete = db.findById('users', id);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (userToDelete.role === 'ADMIN') {
      const allAdmins = db.find('users', u => u.role === 'ADMIN');
      if (allAdmins.length <= 1) {
        return res.status(400).json({ success: false, message: 'Không thể xóa Quản trị viên duy nhất của hệ thống.' });
      }
    }

    const deleted = db.delete('users', id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    // Clean up user's pets and schedules
    const pets = db.find('pets', (p) => p.user_id === id);
    pets.forEach((p) => {
      db.delete('pets', p.id);
      db.find('pet_health_records', (h) => h.pet_id === p.id).forEach((h) => db.delete('pet_health_records', h.id));
      db.find('vaccinations', (v) => v.pet_id === p.id).forEach((v) => db.delete('vaccinations', v.id));
      db.find('medications', (m) => m.pet_id === p.id).forEach((m) => db.delete('medications', m.id));
      db.find('dewormings', (d) => d.pet_id === p.id).forEach((d) => db.delete('dewormings', d.id));
    });
    db.find('care_schedules', (s) => s.user_id === id).forEach((s) => db.delete('care_schedules', s.id));
    db.find('notifications', (n) => n.user_id === id).forEach((n) => db.delete('notifications', n.id));

    return res.json({ success: true, message: 'Đã xóa người dùng và dữ liệu liên quan thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa người dùng.' });
  }
});

module.exports = router;
