const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Seed default services and packages if empty
function ensureDefaultServices() {
  if (!db.data.services || db.data.services.length === 0) {
    db.data.services = [
      {
        id: 'srv_tam_spa',
        name: 'Tắm & Spa Thư Giãn',
        category: 'Vệ sinh & Làm đẹp',
        description: 'Tắm sấy khử mùi, vắt tuyến hôi, sấy phồng lông bằng sữa tắm thảo dược cao cấp.',
        price: 150000,
        duration: '45 - 60 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_grooming',
        name: 'Cắt Tỉa Lông & Tạo Kiểu (Grooming)',
        category: 'Làm đẹp',
        description: 'Tạo kiểu lông chuyên nghiệp (Teddy, Boo, cạo vệ sinh), chải rối và dưỡng lông mượt mà.',
        price: 250000,
        duration: '60 - 90 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_cat_mong_tai',
        name: 'Cắt Móng & Vệ Sinh Tai',
        category: 'Chăm sóc cơ bản',
        description: 'Cắt mài móng an toàn, nhổ lông tai và nhỏ thuốc làm sạch sâu chống viêm tai.',
        price: 60000,
        duration: '20 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_kham_tong_quat',
        name: 'Khám Sức Khỏe Tổng Quát',
        category: 'Y tế & Bác sĩ',
        description: 'Kiểm tra tim mạch, hô hấp, da lông, mắt mũi họng, đo nhiệt độ và tư vấn dinh dưỡng y khoa.',
        price: 120000,
        duration: '30 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_tiem_phong',
        name: 'Tiêm Phòng Vắc-xin Định Kỳ',
        category: 'Y tế & Phòng bệnh',
        description: 'Tiêm các loại vắc-xin 5 bệnh, 7 bệnh, dại (Rabies, Purevax, Zoetis) có cấp sổ theo dõi.',
        price: 200000,
        duration: '15 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_tay_giun',
        name: 'Tẩy Giun Định Kỳ',
        category: 'Y tế & Phòng bệnh',
        description: 'Cho uống thuốc tẩy giun phổ rộng (Sanpet, Endogard, Drontal) phù hợp theo thể trọng.',
        price: 50000,
        duration: '10 phút',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'srv_khach_san',
        name: 'Khách Sạn & Lưu Chuồng Thú Cưng',
        category: 'Lưu trú',
        description: 'Phòng lưu trú máy lạnh riêng biệt, camera theo dõi 24/7, chế độ ăn hạt cao cấp & dắt đi dạo hàng ngày.',
        price: 180000,
        duration: '1 ngày đêm',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      }
    ];
    db.save();
  }

  if (!db.data.service_packages || db.data.service_packages.length === 0) {
    db.data.service_packages = [
      {
        id: 'pkg_toan_dien',
        name: 'Gói Chăm Sóc Toàn Diện (Full Combo)',
        services_included: ['Tắm & Spa Thư Giãn', 'Cắt Tỉa Lông (Grooming)', 'Cắt Móng & Vệ Sinh Tai'],
        price: 390000,
        original_price: 460000,
        validity: 'Dùng trong ngày',
        description: 'Trọn gói làm đẹp và vệ sinh từ A-Z giúp bé cưng thơm tho, sạch sẽ và diện mạo lung linh.',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'pkg_suc_khoe_vang',
        name: 'Gói Sức Khỏe Vàng (Health Checkup)',
        services_included: ['Khám Sức Khỏe Tổng Quát', 'Tiêm Phòng Vắc-xin', 'Tẩy Giun Định Kỳ'],
        price: 320000,
        original_price: 370000,
        validity: 'Định kỳ 6 tháng / 1 năm',
        description: 'Bảo vệ sức khỏe toàn diện, phòng ngừa bệnh truyền nhiễm và ký sinh trùng hiệu quả.',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 'pkg_spa_tuan',
        name: 'Gói Spa Thư Giãn 4 Lần (Thẻ Tháng)',
        services_included: ['4 Lần Tắm & Spa', '4 Lần Cắt Móng & Vệ Sinh Tai', 'Tặng 1 Lần Chải Rối'],
        price: 550000,
        original_price: 680000,
        validity: '30 ngày kể từ ngày mua',
        description: 'Thẻ tiết kiệm dành cho Sen muốn đưa Boss đi spa định kỳ hàng tuần.',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      }
    ];
    db.save();
  }
}

ensureDefaultServices();

// Public routes or authenticated routes
router.get('/', (req, res) => {
  try {
    ensureDefaultServices();
    const { category, search, status } = req.query;
    let services = db.find('services', () => true) || [];

    if (status) {
      services = services.filter(s => s.status === status);
    }
    if (category && category !== 'ALL') {
      services = services.filter(s => s.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      services = services.filter(item => 
        (item.name && item.name.toLowerCase().includes(s)) ||
        (item.description && item.description.toLowerCase().includes(s))
      );
    }

    return res.json({ success: true, count: services.length, services, data: services });
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách dịch vụ.' });
  }
});

router.get('/packages', (req, res) => {
  try {
    ensureDefaultServices();
    const { search, status } = req.query;
    let packages = db.find('service_packages', () => true) || [];

    if (status) {
      packages = packages.filter(p => p.status === status);
    }
    if (search) {
      const s = search.toLowerCase();
      packages = packages.filter(p => 
        (p.name && p.name.toLowerCase().includes(s)) ||
        (p.description && p.description.toLowerCase().includes(s))
      );
    }

    return res.json({ success: true, count: packages.length, packages, data: packages });
  } catch (err) {
    console.error('Get packages error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách gói dịch vụ.' });
  }
});

// Authenticated mutations (Admin only)
router.use(authenticateToken);

// Middleware: Only Admin (Quản lý hệ thống) has rights to create, edit or delete services and packages
const requireAdminRole = (req, res, next) => {
  const role = req.user ? String(req.user.role).toUpperCase() : '';
  if (role !== 'ADMIN' && role !== 'STORE_MANAGER') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Admin (Quản lý hệ thống) mới có quyền thực hiện thao tác này.'
    });
  }
  next();
};

// POST /api/services - Create service (Admin only)
router.post('/', requireAdminRole, (req, res) => {
  try {
    const { name, category, description, price, duration, status } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên dịch vụ và Giá.' });
    }

    const newService = db.insert('services', {
      name: name.trim(),
      category: category || 'Chăm sóc chung',
      description: description || '',
      price: parseFloat(price) || 0,
      duration: duration || '30 phút',
      status: status || 'ACTIVE',
      created_by: req.user.id
    });

    return res.status(201).json({ success: true, message: 'Thêm dịch vụ mới thành công!', service: newService });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm dịch vụ.' });
  }
});

// PUT /api/services/:id - Edit service (Admin only)
router.put('/:id', requireAdminRole, (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, price, duration, status } = req.body;

    const existing = db.findById('services', id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (category) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price) || 0;
    if (duration !== undefined) updates.duration = duration;
    if (status) updates.status = status;

    const updated = db.update('services', id, updates);
    return res.json({ success: true, message: 'Cập nhật dịch vụ thành công!', service: updated });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật dịch vụ.' });
  }
});

// DELETE /api/services/:id - Delete service (Admin only)
router.delete('/:id', requireAdminRole, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.delete('services', id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ để xóa.' });
    }
    return res.json({ success: true, message: 'Đã xóa dịch vụ thành công!' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa dịch vụ.' });
  }
});

// Package Mutations
// POST /api/services/packages - Create package (Admin only)
router.post('/packages', requireAdminRole, (req, res) => {
  try {
    const { name, services_included, price, original_price, validity, description, status } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên gói và Giá gói.' });
    }

    let servicesArr = services_included;
    if (typeof services_included === 'string') {
      servicesArr = services_included.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newPkg = db.insert('service_packages', {
      name: name.trim(),
      services_included: Array.isArray(servicesArr) ? servicesArr : [],
      price: parseFloat(price) || 0,
      original_price: parseFloat(original_price) || parseFloat(price) || 0,
      validity: validity || '30 ngày',
      description: description || '',
      status: status || 'ACTIVE',
      created_by: req.user.id
    });

    return res.status(201).json({ success: true, message: 'Thêm gói dịch vụ thành công!', package: newPkg });
  } catch (err) {
    console.error('Create package error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm gói dịch vụ.' });
  }
});

// PUT /api/services/packages/:id - Edit package (Admin only)
router.put('/packages/:id', requireAdminRole, (req, res) => {
  try {
    const { id } = req.params;
    const { name, services_included, price, original_price, validity, description, status } = req.body;

    const existing = db.findById('service_packages', id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ.' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (services_included !== undefined) {
      let servicesArr = services_included;
      if (typeof services_included === 'string') {
        servicesArr = services_included.split(',').map(s => s.trim()).filter(Boolean);
      }
      updates.services_included = Array.isArray(servicesArr) ? servicesArr : [];
    }
    if (price !== undefined) updates.price = parseFloat(price) || 0;
    if (original_price !== undefined) updates.original_price = parseFloat(original_price) || 0;
    if (validity !== undefined) updates.validity = validity;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;

    const updated = db.update('service_packages', id, updates);
    return res.json({ success: true, message: 'Cập nhật gói dịch vụ thành công!', package: updated });
  } catch (err) {
    console.error('Update package error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật gói dịch vụ.' });
  }
});

// DELETE /api/services/packages/:id - Delete package (Admin only)
router.delete('/packages/:id', requireAdminRole, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.delete('service_packages', id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ để xóa.' });
    }
    return res.json({ success: true, message: 'Đã xóa gói dịch vụ thành công!' });
  } catch (err) {
    console.error('Delete package error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa gói dịch vụ.' });
  }
});

module.exports = router;
