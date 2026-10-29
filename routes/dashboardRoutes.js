const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/dashboard/stats - Thống kê 3 nội dung cốt lõi: Lượt dịch vụ, Doanh thu, Khách quay lại
router.get('/stats', (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'RECEPTIONIST') {
      return res.status(403).json({
        success: false,
        message: 'Chức năng thống kê & báo cáo chỉ dành riêng cho Quản lý hệ thống (ADMIN) và Lễ tân.',
        redirectTo: 'appointments'
      });
    }

    const appointments = db.find('appointments', () => true) || [];
    const invoices = db.find('invoices', () => true) || [];
    const allUsers = db.find('users', () => true) || [];
    const allServices = db.find('services', () => true) || [];
    const allPackages = db.find('service_packages', () => true) || [];

    // Danh sách ID tài khoản Quản trị / Nhân viên không phải khách hàng thật
    const staffAndAdminUserIds = new Set(
      allUsers.filter(u => u.role !== 'USER').map(u => u.id)
    );

    // Bảng tra cứu gói dịch vụ để phân loại chính xác
    const packageNamesSet = new Set(
      allPackages.map(p => (p.name || '').trim().toLowerCase())
    );
    const packageIdsSet = new Set(
      allPackages.map(p => (p.id || '').trim().toLowerCase())
    );

    function detectItemType(rawName) {
      if (!rawName) return { type: 'SERVICE', typeLabel: 'Dịch vụ' };
      const lower = rawName.trim().toLowerCase();
      if (
        packageNamesSet.has(lower) ||
        packageIdsSet.has(lower) ||
        lower.startsWith('gói ') ||
        lower.includes('gói combo') ||
        lower.includes('(full combo)') ||
        lower.includes('(thẻ tháng)') ||
        lower.includes('(health checkup)')
      ) {
        return { type: 'PACKAGE', typeLabel: 'Gói dịch vụ' };
      }
      return { type: 'SERVICE', typeLabel: 'Dịch vụ' };
    }

    // Hàm kiểm tra định danh khách hàng hợp lệ (Chỉ tính role USER / Chủ nuôi, bỏ qua Admin kiểm thử)
    function isCustomerUser(userId) {
      if (!userId) return false;
      if (staffAndAdminUserIds.has(userId)) return false;
      const u = allUsers.find(x => x.id === userId);
      if (u && u.role !== 'USER') return false;
      return true;
    }

    // ==========================================
    // 1. THỐNG KÊ LƯỢT SỬ DỤNG DỊCH VỤ & GÓI DỊCH VỤ
    // ==========================================
    const serviceUsageMap = {};

    // 1.1. Đếm từ các lịch hẹn của khách hàng thật (không bị hủy)
    const validAppointments = appointments.filter(a => {
      if (a.status === 'CANCELLED') return false;
      const uId = a.ownerId || a.userId || a.user_id;
      return isCustomerUser(uId);
    });

    validAppointments.forEach(a => {
      const sName = (a.examinationType || a.serviceName || a.service_name || 'Khám & Chăm sóc').trim();
      if (!serviceUsageMap[sName]) {
        const { type, typeLabel } = detectItemType(sName);
        serviceUsageMap[sName] = {
          name: sName,
          count: 0,
          type,
          typeLabel
        };
      }
      serviceUsageMap[sName].count += 1;
    });

    // 1.2. Đếm từ các hóa đơn đã thanh toán của khách hàng thật
    const paidInvoices = invoices.filter(i => {
      const isPaid = i.status === 'PAID' || i.payment_status === 'PAID';
      if (!isPaid) return false;
      const uId = i.user_id || i.userId || i.ownerId;
      return isCustomerUser(uId);
    });

    paidInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(item => {
          const sName = (item.name || inv.service_name || 'Dịch vụ chăm sóc').trim();
          const qty = parseInt(item.quantity) || 1;
          if (!serviceUsageMap[sName]) {
            const { type, typeLabel } = detectItemType(sName);
            serviceUsageMap[sName] = {
              name: sName,
              count: 0,
              type,
              typeLabel
            };
          }
          serviceUsageMap[sName].count += qty;
        });
      } else if (inv.service_name) {
        const sName = inv.service_name.trim();
        if (!serviceUsageMap[sName]) {
          const { type, typeLabel } = detectItemType(sName);
          serviceUsageMap[sName] = {
            name: sName,
            count: 0,
            type,
            typeLabel
          };
        }
        serviceUsageMap[sName].count += 1;
      }
    });

    // Tổng số lượt sử dụng bao gồm cả Dịch vụ đơn + Gói dịch vụ
    const totalServiceUsage = Object.values(serviceUsageMap).reduce((sum, item) => sum + item.count, 0);

    let singleServiceUsageCount = 0;
    let packageUsageCount = 0;
    let singleServiceTypesCount = 0;
    let packageTypesCount = 0;

    Object.values(serviceUsageMap).forEach(item => {
      if (item.type === 'PACKAGE') {
        packageUsageCount += item.count;
        packageTypesCount += 1;
      } else {
        singleServiceUsageCount += item.count;
        singleServiceTypesCount += 1;
      }
    });

    const totalTypesCount = singleServiceTypesCount + packageTypesCount;

    // Danh sách dịch vụ & gói sắp xếp từ cao xuống thấp
    const servicesList = Object.values(serviceUsageMap)
      .map(item => {
        const percentage = totalServiceUsage > 0
          ? parseFloat(((item.count / totalServiceUsage) * 100).toFixed(1))
          : 0;
        return {
          name: item.name,
          count: item.count,
          type: item.type,
          typeLabel: item.typeLabel,
          percentage
        };
      })
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    // ==========================================
    // 2. THỐNG KÊ DOANH THU
    // ==========================================
    // Chỉ tính từ hóa đơn PAID của khách hàng thật, loại trừ hóa đơn kiểm thử của Admin
    const totalRevenue = paidInvoices.reduce((sum, inv) => {
      const amt = parseFloat(inv.final_amount) || parseFloat(inv.total_amount) || parseFloat(inv.total) || 0;
      return sum + amt;
    }, 0);

    // Doanh thu theo từng dịch vụ & gói
    const serviceRevenueMap = {};
    paidInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(item => {
          const sName = (item.name || inv.service_name || 'Dịch vụ chăm sóc').trim();
          const itemAmt = parseFloat(item.amount) || (parseFloat(item.price || 0) * (parseInt(item.quantity) || 1)) || 0;
          if (!serviceRevenueMap[sName]) {
            const { type, typeLabel } = detectItemType(sName);
            serviceRevenueMap[sName] = {
              name: sName,
              revenue: 0,
              type,
              typeLabel
            };
          }
          serviceRevenueMap[sName].revenue += itemAmt;
        });
      } else {
        const sName = (inv.service_name || 'Dịch vụ chăm sóc').trim();
        const amt = parseFloat(inv.final_amount) || parseFloat(inv.total_amount) || 0;
        if (!serviceRevenueMap[sName]) {
          const { type, typeLabel } = detectItemType(sName);
          serviceRevenueMap[sName] = {
            name: sName,
            revenue: 0,
            type,
            typeLabel
          };
        }
        serviceRevenueMap[sName].revenue += amt;
      }
    });

    const revenueByService = Object.values(serviceRevenueMap)
      .map(item => {
        const percentage = totalRevenue > 0
          ? parseFloat(((item.revenue / totalRevenue) * 100).toFixed(1))
          : 0;
        return {
          name: item.name,
          revenue: item.revenue,
          type: item.type,
          typeLabel: item.typeLabel,
          percentage
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    // Dữ liệu biểu đồ doanh thu theo thời gian (theo tháng)
    const revenueTimelineMap = {};
    paidInvoices.forEach(inv => {
      const dateStr = inv.paid_at || inv.created_at || new Date().toISOString();
      const d = new Date(dateStr);
      const monthKey = !isNaN(d.getTime())
        ? `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
        : 'Tháng này';
      const amt = parseFloat(inv.final_amount) || parseFloat(inv.total_amount) || 0;
      revenueTimelineMap[monthKey] = (revenueTimelineMap[monthKey] || 0) + amt;
    });

    const revenueTimeline = {
      labels: Object.keys(revenueTimelineMap),
      data: Object.values(revenueTimelineMap)
    };

    // ==========================================
    // 3. THỐNG KÊ KHÁCH QUAY LẠI
    // ==========================================
    // Xác định khách bằng userId / customerId của khách hàng thật
    const customerUsageMap = {};

    // 3.1. Ghi nhận từ lịch hẹn của khách hàng
    validAppointments.forEach(a => {
      const uId = a.ownerId || a.userId || a.user_id;
      if (!uId || !isCustomerUser(uId)) return;

      if (!customerUsageMap[uId]) {
        customerUsageMap[uId] = {
          userId: uId,
          count: 0,
          lastDate: null,
          name: '',
          phone: ''
        };
      }
      customerUsageMap[uId].count += 1;

      // Cập nhật ngày sử dụng gần nhất
      const d = a.appointmentDate ? (a.appointmentTime ? `${a.appointmentDate}T${a.appointmentTime}` : a.appointmentDate) : (a.createdAt || a.created_at);
      if (d) {
        if (!customerUsageMap[uId].lastDate || new Date(d) > new Date(customerUsageMap[uId].lastDate)) {
          customerUsageMap[uId].lastDate = d;
        }
      }
    });

    // 3.2. Ghi nhận từ hóa đơn đã thanh toán của khách hàng
    paidInvoices.forEach(inv => {
      const uId = inv.user_id || inv.userId || inv.ownerId;
      if (!uId || !isCustomerUser(uId)) return;

      if (!customerUsageMap[uId]) {
        customerUsageMap[uId] = {
          userId: uId,
          count: 0,
          lastDate: null,
          name: inv.owner_name || '',
          phone: inv.owner_phone || ''
        };
      }
      customerUsageMap[uId].count += 1;

      const d = inv.paid_at || inv.created_at;
      if (d) {
        if (!customerUsageMap[uId].lastDate || new Date(d) > new Date(customerUsageMap[uId].lastDate)) {
          customerUsageMap[uId].lastDate = d;
        }
      }
      if (!customerUsageMap[uId].name && inv.owner_name) customerUsageMap[uId].name = inv.owner_name;
      if (!customerUsageMap[uId].phone && inv.owner_phone) customerUsageMap[uId].phone = inv.owner_phone;
    });

    // 3.3. Bổ sung họ tên và SĐT từ bảng users
    allUsers.forEach(u => {
      if (customerUsageMap[u.id]) {
        if (u.full_name) customerUsageMap[u.id].name = u.full_name;
        if (u.phone) customerUsageMap[u.id].phone = u.phone;
      }
    });

    // Danh sách toàn bộ khách hàng thật đã phát sinh dịch vụ
    const allCustomersList = Object.values(customerUsageMap).map((c, idx) => {
      let displayName = c.name;
      if (!displayName || displayName.startsWith('Khách hàng #use_') || displayName.startsWith('Khách hàng #usr_')) {
        displayName = c.phone ? `Khách hàng (${c.phone})` : `Khách hàng #${idx + 1}`;
      }
      return {
        ...c,
        name: displayName
      };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.lastDate || 0) - new Date(a.lastDate || 0);
    });

    // Chỉ tính khách hàng có từ 2 lần sử dụng trở lên là khách quay lại
    const returningCustomersList = allCustomersList.filter(c => c.count >= 2);
    const totalActiveCustomers = allCustomersList.length;
    const returningCustomersCount = returningCustomersList.length;
    const returningRate = totalActiveCustomers > 0 ? parseFloat(((returningCustomersCount / totalActiveCustomers) * 100).toFixed(1)) : 0;

    return res.json({
      success: true,
      data: {
        // 3 Chỉ số chính hiển thị ở top cards
        overview: {
          totalServiceUsage,
          singleServiceUsageCount,
          packageUsageCount,
          totalTypesCount,
          singleServiceTypesCount,
          packageTypesCount,
          totalRevenue,
          returningCustomersCount,
          totalActiveCustomers,
          returningRate: `${returningRate}%`
        },
        // 1. Lượt sử dụng dịch vụ & gói
        serviceUsage: {
          totalUsage: totalServiceUsage,
          singleServiceUsageCount,
          packageUsageCount,
          totalTypesCount,
          singleServiceTypesCount,
          packageTypesCount,
          services: servicesList
        },
        // 2. Doanh thu
        revenue: {
          totalRevenue,
          paidInvoicesCount: paidInvoices.length,
          byService: revenueByService,
          timeline: revenueTimeline
        },
        // 3. Khách quay lại (Chỉ trả về danh sách khách có >= 2 lần sử dụng)
        returningCustomers: {
          count: returningCustomersCount,
          totalCustomers: totalActiveCustomers,
          rate: `${returningRate}%`,
          rateNum: returningRate,
          customers: returningCustomersList
        }
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tải thống kê & báo cáo.' });
  }
});

module.exports = router;
