const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'petcare_secret_key_udttnt_2026';

// Middleware verify JWT Token
const authenticateToken = (req, res, next) => {
  let token = null;

  // Check Header Authorization
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Check Cookies if header empty
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để truy cập tài nguyên này.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị xóa.' });
    }

    if (user.status === 'LOCKED') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
  }
};

// Middleware verify Admin Role
const isManagementRole = (role) => ['ADMIN', 'STORE_MANAGER'].includes(String(role || '').toUpperCase().trim());
const isStoreManagerRole = (role) => String(role || '').toUpperCase().trim() === 'STORE_MANAGER';

const requireAdmin = (req, res, next) => {
  const userRole = (req.user && req.user.role) ? String(req.user.role).toUpperCase().trim() : '';
  if (userRole !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Truy cập bị từ chối. Tính năng này chỉ dành cho Quản lý.' });
  }
  next();
};

// Middleware verify Staff (Admin, Receptionist)
const requireStaff = (req, res, next) => {
  const userRole = (req.user && req.user.role) ? String(req.user.role).toUpperCase().trim() : '';
  if (userRole !== 'ADMIN' && userRole !== 'RECEPTIONIST') {
    return res.status(403).json({ success: false, message: 'Truy cập bị từ chối. Tính năng này chỉ dành cho Lễ tân hoặc Quản lý.' });
  }
  next();
};

// Middleware verify Receptionist or Admin
const requireReceptionistOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'RECEPTIONIST')) {
    return res.status(403).json({ success: false, message: 'Truy cập bị từ chối. Tính năng này chỉ dành cho Lễ tân hoặc Quản lý.' });
  }
  next();
};

// Middleware verify Care Staff or Admin (compatibility alias)
const requireCareStaffOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'RECEPTIONIST')) {
    return res.status(403).json({ success: false, message: 'Truy cập bị từ chối. Tính năng này chỉ dành cho Lễ tân hoặc Quản lý.' });
  }
  next();
};

module.exports = {
  JWT_SECRET,
  authenticateToken,
  isManagementRole,
  isStoreManagerRole,
  requireAdmin,
  requireStaff,
  requireReceptionistOrAdmin,
  requireCareStaffOrAdmin
};

