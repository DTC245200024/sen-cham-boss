const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Middleware to check STORE_MANAGER role (ADMIN is not allowed to view store business revenues)
const checkRevenuePermission = (req, res, next) => {
  if (req.user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Quản trị viên (ADMIN) không có quyền xem doanh thu, thu nhập và báo cáo kinh doanh của cửa hàng. Quyền này thuộc về Quản lý cửa hàng (STORE_MANAGER).'
    });
  }
  if (req.user.role !== 'STORE_MANAGER') {
    return res.status(403).json({ success: false, message: 'Chức năng thống kê doanh thu chỉ dành riêng cho Quản lý cửa hàng.' });
  }
  next();
};

router.use(checkRevenuePermission);

// Helper function to get start date from range
function getStartDate(range) {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7days':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case '30days':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
    default:
      return new Date(0); // Epoch
  }
}

// GET /api/revenue/report
router.get('/report', (req, res) => {
  try {
    const { groupBy = 'month', range = 'all' } = req.query;
    const title = 'Thống kê dịch vụ & doanh thu';

    const allInvoices = db.find('invoices', () => true) || [];
    const allAppointments = db.find('appointments', () => true) || [];
    const allSchedules = db.find('care_schedules', () => true) || [];
    const allUsers = db.find('users', () => true) || [];
    const startDate = getStartDate(range);

    // Paid Invoices within range, strictly excluding cancelled invoices or invoices linked to cancelled appointments
    const cancelledAppIds = new Set(allAppointments.filter(a => a.status === 'CANCELLED').map(a => a.id));
    const validInvoices = allInvoices.filter(inv => {
      if (inv.status === 'CANCELLED' || (inv.appointment_id && cancelledAppIds.has(inv.appointment_id))) return false;
      const d = new Date(inv.paid_at || inv.created_at || 0);
      if (d < startDate) return false;
      return inv.status === 'PAID';
    });

    // Completed service appointments within range
    const validAppointments = allAppointments.filter(a => {
      const d = new Date(a.createdAt || a.created_at || a.appointmentDate || 0);
      return d >= startDate && (a.status === 'COMPLETED' || a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS');
    });

    // Completed care schedules
    const completedCareTasks = allSchedules.filter(s => {
      const d = new Date(s.date || s.created_at || 0);
      return d >= startDate && s.status === 'ĐÃ_HOÀN_THÀNH';
    });

    let totalRevenue = 0;
    let totalServicesPerformed = validAppointments.length + completedCareTasks.length;
    const groups = {};
    const serviceStatsMap = {};
    const recentTransactions = [];

    // Track user visit frequencies for repeat customer calculation
    const userUsageCount = {};

    // Process Invoices
    validInvoices.forEach(inv => {
      const dateObj = new Date(inv.paid_at || inv.created_at || Date.now());
      let dateKey = '';
      let label = '';

      if (groupBy === 'day') {
        dateKey = dateObj.toISOString().split('T')[0];
        label = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } else if (groupBy === 'month') {
        dateKey = dateObj.toISOString().slice(0, 7);
        label = `Tháng ${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
      } else if (groupBy === 'year') {
        dateKey = dateObj.getFullYear().toString();
        label = `Năm ${dateKey}`;
      }

      if (!groups[dateKey]) {
        groups[dateKey] = { revenue: 0, ordersCount: 0, timeLabel: label };
      }

      const invAmount = parseFloat(inv.final_amount) || parseFloat(inv.total_amount) || 0;
      totalRevenue += invAmount;
      groups[dateKey].revenue += invAmount;
      groups[dateKey].ordersCount += 1;

      // Track items
      (inv.items || []).forEach(item => {
        totalServicesPerformed += (parseInt(item.quantity) || 1);
        const itemName = item.name || inv.service_name || 'Dịch vụ chăm sóc';
        if (!serviceStatsMap[itemName]) {
          serviceStatsMap[itemName] = {
            id: itemName,
            name: itemName,
            category: 'Dịch vụ chăm sóc',
            used_count: 0,
            revenue: 0
          };
        }
        serviceStatsMap[itemName].used_count += (parseInt(item.quantity) || 1);
        serviceStatsMap[itemName].revenue += (parseFloat(item.amount) || parseFloat(item.price) || 0);
      });

      if (inv.user_id) {
        userUsageCount[inv.user_id] = (userUsageCount[inv.user_id] || 0) + 1;
      }

      recentTransactions.push({
        id: inv.id,
        invoice_code: inv.invoice_code || `HD-${inv.id.slice(-6).toUpperCase()}`,
        service_summary: inv.service_name || (inv.items && inv.items[0] ? inv.items[0].name : 'Dịch vụ chăm sóc'),
        total_amount: invAmount,
        status: inv.status,
        payment_status: 'PAID',
        payment_method: inv.payment_method === 'CHUYEN_KHOAN_VIETQR' ? 'VietQR' : 'Tiền mặt',
        created_at: inv.created_at
      });
    });

    // Also count completed appointment services
    validAppointments.forEach(a => {
      const sName = a.service_name || a.service || a.examinationType || 'Dịch vụ chăm sóc';
      if (!serviceStatsMap[sName]) {
        serviceStatsMap[sName] = {
          id: sName,
          name: sName,
          category: 'Dịch vụ chăm sóc',
          used_count: 0,
          revenue: 0
        };
      }
      serviceStatsMap[sName].used_count += 1;
      if (a.user_id) {
        userUsageCount[a.user_id] = (userUsageCount[a.user_id] || 0) + 1;
      }
    });

    // Calculate repeat customer metrics
    let totalUniqueCustomers = Object.keys(userUsageCount).length;
    let returningCustomersCount = 0;
    Object.values(userUsageCount).forEach(count => {
      if (count > 1) returningCustomersCount++;
    });

    const repeatRate = totalUniqueCustomers > 0 ? Math.round((returningCustomersCount / totalUniqueCustomers) * 100) : 0;

    // Sort chartData keys chronologically
    const sortedKeys = Object.keys(groups).sort();
    const sortedLabels = sortedKeys.map(k => groups[k].timeLabel);
    const sortedData = sortedKeys.map(k => groups[k].revenue);
    const sortedOrders = sortedKeys.map(k => groups[k].ordersCount);

    const topServices = Object.values(serviceStatsMap)
      .sort((a, b) => b.used_count - a.used_count || b.revenue - a.revenue)
      .slice(0, 10);

    const recentInvoices = recentTransactions
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);

    return res.json({
      success: true,
      report: {
        title,
        role: req.user.role,
        totalRevenue,
        totalServicesPerformed,
        totalInvoices: validInvoices.length,
        totalCustomers: totalUniqueCustomers || allUsers.filter(u => u.role === 'USER').length,
        returningCustomers: returningCustomersCount,
        repeatRate: `${repeatRate}%`,
        averageOrderValue: validInvoices.length > 0 ? Math.round(totalRevenue / validInvoices.length) : 0,
        chart: {
          labels: sortedLabels,
          data: sortedData,
          orders: sortedOrders,
          hasData: sortedData.some(v => v > 0)
        },
        topServices,
        recentInvoices,
        details: sortedKeys.reverse().map(k => groups[k])
      }
    });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải báo cáo doanh thu.' });
  }
});

module.exports = router;

