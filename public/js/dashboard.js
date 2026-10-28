/* =========================================================
   DASHBOARD & THỐNG KÊ BÁO CÁO - SEN CHĂM BOSS
   3 Ô thống kê tương tác (Có thể bấm để mở/thu gọn chi tiết):
   1. Lượt sử dụng dịch vụ
   2. Doanh thu
   3. Khách quay lại
   Chỉ hiển thị chi tiết của ô đang được bấm.
   Dữ liệu lấy 100% từ Database / API, tự động cập nhật.
   ========================================================= */

let dashboardServiceUsageChartInstance = null;
let dashboardRevenueChartInstance = null;
let activeDashboardTab = 'services'; // 'services' | 'revenue' | 'returning' | null
let cachedDashboardData = null;

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Chưa có thông tin';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    if (hasTime) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
             d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// =============================================================
// TAB TOGGLE HANDLER: Bấm vào từng ô để mở/thu gọn chi tiết
// =============================================================
function toggleDashboardTab(tabName) {
  if (activeDashboardTab === tabName) {
    // Nếu bấm vào tab đang mở -> Thu gọn lại
    activeDashboardTab = null;
  } else {
    // Mở tab mới được bấm
    activeDashboardTab = tabName;
  }

  applyDashboardTabVisibility();
}

function applyDashboardTabVisibility() {
  const tabs = [
    { key: 'services', color: '#FF7A00', bg: '#FFF0E5' },
    { key: 'revenue', color: '#059669', bg: '#ECFDF5' },
    { key: 'returning', color: '#2563EB', bg: '#EFF6FF' }
  ];

  tabs.forEach(t => {
    const detailEl = document.getElementById(`dashboard-detail-${t.key}`);
    const cardEl = document.getElementById(`card-stat-${t.key}`);
    const chevronEl = document.getElementById(`chevron-stat-${t.key}`);
    const pillEl = document.getElementById(`pill-stat-${t.key}`);

    const isActive = activeDashboardTab === t.key;

    if (detailEl) {
      detailEl.style.display = isActive ? 'block' : 'none';
    }

    if (cardEl) {
      if (isActive) {
        cardEl.style.border = `2px solid ${t.color}`;
        cardEl.style.boxShadow = `0 10px 24px rgba(0,0,0,0.08)`;
        cardEl.style.transform = 'translateY(-3px)';
        cardEl.style.backgroundColor = '#FFFFFF';
      } else {
        cardEl.style.border = '1px solid #E2E8F0';
        cardEl.style.boxShadow = '';
        cardEl.style.transform = '';
        cardEl.style.backgroundColor = '#FFFFFF';
      }
    }

    if (pillEl) {
      if (isActive) {
        pillEl.style.backgroundColor = t.color;
        pillEl.style.color = '#FFFFFF';
        pillEl.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Đang mở`;
      } else {
        pillEl.style.backgroundColor = t.bg;
        pillEl.style.color = t.color;
        pillEl.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
      }
    }
  });

  // Hiển thị gợi ý nếu người dùng thu gọn cả 3 ô
  const emptyHint = document.getElementById('dashboard-detail-empty-hint');
  if (emptyHint) {
    emptyHint.style.display = activeDashboardTab ? 'none' : 'block';
  }

  // Khi mở tab chứa biểu đồ, kích hoạt resize để Chart.js vẽ lại đúng kích thước
  if (cachedDashboardData) {
    if (activeDashboardTab === 'services' && cachedDashboardData.serviceUsage) {
      renderServiceUsageChart(cachedDashboardData.serviceUsage.services || []);
    } else if (activeDashboardTab === 'revenue' && cachedDashboardData.revenue) {
      renderRevenueTimelineChart(cachedDashboardData.revenue.timeline || { labels: [], data: [] });
    }
  }
}

// =============================================================
// MAIN API LOADER
// =============================================================
async function loadDashboardData() {
  try {
    const res = await apiRequest('/dashboard/stats');
    if (!res || !res.success || !res.data) {
      if (res && res.message && window.showToast) {
        window.showToast(res.message, 'warning');
      }
      return;
    }

    cachedDashboardData = res.data;
    const { overview, serviceUsage, revenue, returningCustomers } = res.data;

    // =========================================================
    // A. CẬP NHẬT 3 CHỈ SỐ CHÍNH (TOP CARDS)
    // =========================================================
    const statUsageEl = document.getElementById('stat-service-usage');
    if (statUsageEl) statUsageEl.innerText = (overview?.totalServiceUsage || 0).toLocaleString('vi-VN') + ' lượt';

    const statServiceSubEl = document.getElementById('stat-service-types-sub');
    if (statServiceSubEl) {
      const totalTypes = serviceUsage?.totalTypesCount || overview?.totalTypesCount || serviceUsage?.services?.length || 0;
      const sTypes = serviceUsage?.singleServiceTypesCount ?? 0;
      const pTypes = serviceUsage?.packageTypesCount ?? 0;
      if (pTypes > 0 && sTypes > 0) {
        statServiceSubEl.innerText = `${totalTypes} loại (${sTypes} dịch vụ, ${pTypes} gói)`;
      } else {
        statServiceSubEl.innerText = `${totalTypes} loại dịch vụ`;
      }
    }

    const statRevEl = document.getElementById('stat-total-revenue');
    if (statRevEl) statRevEl.innerText = formatCurrency(overview?.totalRevenue || 0);

    const statRevSubEl = document.getElementById('stat-revenue-invoices-sub');
    if (statRevSubEl) {
      statRevSubEl.innerText = `Từ ${revenue?.paidInvoicesCount || 0} hóa đơn đã thanh toán`;
    }

    const statReturnEl = document.getElementById('stat-returning-customers');
    if (statReturnEl) statReturnEl.innerText = (overview?.returningCustomersCount || 0).toLocaleString('vi-VN') + ' khách';

    const statReturnSubEl = document.getElementById('stat-returning-rate-sub');
    if (statReturnSubEl) {
      statReturnSubEl.innerHTML = `Tỷ lệ: <strong style="color:#16A34A;">${overview?.returningRate || '0%'}</strong> (${overview?.totalActiveCustomers || 0} khách)`;
    }

    const sectionRevTag = document.getElementById('section-total-revenue-tag');
    if (sectionRevTag) sectionRevTag.innerText = formatCurrency(revenue?.totalRevenue || 0);

    const badgeReturnRate = document.getElementById('badge-returning-rate');
    if (badgeReturnRate) badgeReturnRate.innerText = `Tỷ lệ quay lại: ${returningCustomers?.rate || '0%'}`;

    const badgeReturnCount = document.getElementById('badge-returning-count');
    if (badgeReturnCount) badgeReturnCount.innerText = `${returningCustomers?.count || 0} khách quay lại`;

    // =========================================================
    // B. RENDER NỘI DUNG TỪNG KHU VỰC
    // =========================================================
    renderServiceUsageTable(serviceUsage?.services || []);
    renderRevenueByServiceTable(revenue?.byService || []);
    renderReturningCustomersTable(returningCustomers?.customers || []);

    // Áp dụng trạng thái hiển thị của tab đang chọn
    applyDashboardTabVisibility();

  } catch (err) {
    console.error('Error loading dashboard data:', err);
    if (window.showToast) window.showToast('Lỗi khi tải dữ liệu thống kê.', 'error');
  }
}

// -------------------------------------------------------------
// 1. RENDER BẢNG & BIỂU ĐỒ LƯỢT DÙNG DỊCH VỤ & GÓI DỊCH VỤ
// -------------------------------------------------------------
function renderServiceUsageTable(services) {
  const container = document.getElementById('dashboard-services-usage-body');
  if (!container) return;

  if (!services || services.length === 0) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:28px; color:var(--text-muted); font-size:13px;">Chưa có dữ liệu dịch vụ hoặc gói nào được sử dụng.</td></tr>`;
    return;
  }

  container.innerHTML = services.map((s, idx) => {
    const rankNum = s.rank || (idx + 1);
    let rankBadge = `<span style="font-weight:700; color:var(--text-muted); font-size:13px;">${rankNum}</span>`;
    if (rankNum === 1) rankBadge = `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#FEF08A; color:#854D0E; font-weight:800; font-size:11px;">1</span>`;
    if (rankNum === 2) rankBadge = `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#E2E8F0; color:#475569; font-weight:800; font-size:11px;">2</span>`;
    if (rankNum === 3) rankBadge = `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#FFEDD5; color:#9A3412; font-weight:800; font-size:11px;">3</span>`;

    const isPackage = s.type === 'PACKAGE' || s.typeLabel === 'Gói dịch vụ';
    const typeBadge = isPackage
      ? `<span class="badge" style="background:#EFF6FF; color:#2563EB; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; border:1px solid #DBEAFE;"><i class="fa-solid fa-layer-group" style="font-size:10px;"></i> Gói dịch vụ</span>`
      : `<span class="badge" style="background:#FFF7ED; color:#EA580C; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; border:1px solid #FFEDD5;"><i class="fa-solid fa-hand-holding-heart" style="font-size:10px;"></i> Dịch vụ</span>`;

    const icon = isPackage
      ? `<i class="fa-solid fa-layer-group" style="color: #2563EB; margin-right: 6px;"></i>`
      : `<i class="fa-solid fa-paw" style="color: var(--primary); margin-right: 6px;"></i>`;

    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px 14px; text-align: left;">${rankBadge}</td>
        <td style="padding: 12px 14px; font-weight: 700; color: var(--text-main); font-size: 13.5px;">
          ${icon}
          ${escapeHTML(s.name)}
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          ${typeBadge}
        </td>
        <td style="padding: 12px 14px; text-align: center; font-weight: 800; color: ${isPackage ? '#2563EB' : 'var(--primary)'}; font-size: 14px;">
          ${(s.count || 0).toLocaleString('vi-VN')} <span style="font-size:11px; font-weight:600; color:var(--text-muted);">lượt</span>
        </td>
        <td style="padding: 12px 14px; text-align: right;">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
            <div style="width:75px; height:7px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
              <div style="width:${Math.min(100, s.percentage)}%; height:100%; background:${isPackage ? 'linear-gradient(90deg, #3B82F6, #1D4ED8)' : 'linear-gradient(90deg, #FF7A00, #EA5F00)'}; border-radius:4px;"></div>
            </div>
            <span style="font-size:12.5px; font-weight:800; color:var(--text-main); min-width:38px;">${s.percentage}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderServiceUsageChart(services) {
  const ctx = document.getElementById('dashboardServiceUsageChart');
  if (!ctx) return;

  if (dashboardServiceUsageChartInstance) {
    dashboardServiceUsageChartInstance.destroy();
    dashboardServiceUsageChartInstance = null;
  }

  if (!services || services.length === 0) {
    return;
  }

  // Lấy top 6 dịch vụ & gói để biểu đồ hiển thị rõ ràng, đẹp mắt
  const topList = services.slice(0, 6);
  const labels = topList.map(s => {
    const shortName = s.name.length > 18 ? s.name.slice(0, 16) + '...' : s.name;
    return s.type === 'PACKAGE' ? `[Gói] ${shortName}` : shortName;
  });
  const data = topList.map(s => s.count);

  dashboardServiceUsageChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Số lượt sử dụng',
        data: data,
        backgroundColor: topList.map((s, i) => {
          if (s.type === 'PACKAGE') return '#2563EB';
          const colors = ['#FF7A00', '#EA580C', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];
          return colors[i % colors.length];
        }),
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#17233C',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(item) {
              const count = item.raw || 0;
              const sObj = topList[item.dataIndex];
              const typeStr = sObj?.typeLabel ? ` (${sObj.typeLabel})` : '';
              return `Số lượt: ${count} lượt${typeStr} - ${sObj ? sObj.percentage : 0}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11, family: 'Nunito, sans-serif', weight: '600' },
            color: '#64748B',
            maxRotation: 25,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)', borderDash: [3, 3] },
          ticks: {
            stepSize: 1,
            color: '#64748B',
            font: { size: 11, family: 'Nunito, sans-serif' }
          }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 2. RENDER BẢNG & BIỂU ĐỒ DOANH THU
// -------------------------------------------------------------
function renderRevenueByServiceTable(services) {
  const container = document.getElementById('dashboard-services-revenue-body');
  if (!container) return;

  if (!services || services.length === 0) {
    container.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:28px; color:var(--text-muted); font-size:13px;">Chưa có hóa đơn đã thanh toán nào.</td></tr>`;
    return;
  }

  container.innerHTML = services.map((s, idx) => {
    const isPackage = s.type === 'PACKAGE' || s.typeLabel === 'Gói dịch vụ';
    const icon = isPackage
      ? `<i class="fa-solid fa-layer-group" style="color: #2563EB; margin-right: 6px;"></i>`
      : `<i class="fa-solid fa-receipt" style="color: #059669; margin-right: 6px;"></i>`;

    const typeTag = isPackage
      ? `<span style="font-size:10.5px; font-weight:700; color:#2563EB; background:#EFF6FF; padding:1px 6px; border-radius:4px; margin-left:6px; border:1px solid #DBEAFE;">Gói</span>`
      : '';

    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px 14px; font-weight: 700; color: var(--text-muted); font-size: 13px;">${idx + 1}</td>
        <td style="padding: 12px 14px; font-weight: 700; color: var(--text-main); font-size: 13.5px;">
          ${icon}
          ${escapeHTML(s.name)}
          ${typeTag}
        </td>
        <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #059669; font-size: 14px;">
          ${formatCurrency(s.revenue)}
        </td>
        <td style="padding: 12px 14px; text-align: right;">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
            <div style="width:65px; height:7px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
              <div style="width:${Math.min(100, s.percentage)}%; height:100%; background:#059669; border-radius:4px;"></div>
            </div>
            <span style="font-size:12px; font-weight:800; color:var(--text-main); min-width:34px;">${s.percentage}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRevenueTimelineChart(timeline) {
  const ctx = document.getElementById('dashboardRevenueChart');
  if (!ctx) return;

  if (dashboardRevenueChartInstance) {
    dashboardRevenueChartInstance.destroy();
    dashboardRevenueChartInstance = null;
  }

  const labels = timeline?.labels || [];
  const data = timeline?.data || [];

  if (labels.length === 0 || data.length === 0) {
    return;
  }

  const canvasContext = ctx.getContext('2d');
  let gradient = canvasContext.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(5, 150, 105, 0.25)');
  gradient.addColorStop(1, 'rgba(5, 150, 105, 0.01)');

  dashboardRevenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Doanh thu (₫)',
        data: data,
        borderColor: '#059669',
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#059669',
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#17233C',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(item) {
              return `Doanh thu: ${formatCurrency(item.raw || 0)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, family: 'Nunito, sans-serif', weight: '600' }, color: '#64748B' }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)', borderDash: [3, 3] },
          ticks: {
            color: '#64748B',
            font: { size: 11, family: 'Nunito, sans-serif' },
            callback: function(val) {
              if (val >= 1000000) return (val / 1000000) + ' Tr';
              if (val >= 1000) return (val / 1000) + ' k';
              return val;
            }
          }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 3. RENDER BẢNG KHÁCH HÀNG QUAY LẠI (Chỉ khách có >= 2 lần)
// -------------------------------------------------------------
function renderReturningCustomersTable(customers) {
  const container = document.getElementById('dashboard-returning-customers-body');
  if (!container) return;

  // Lọc chỉ khách hàng có từ 2 lần sử dụng dịch vụ trở lên
  const returningList = (customers || []).filter(c => (c.count || 0) >= 2);

  if (returningList.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:28px; color:var(--text-muted); font-size:13px;">Chưa có khách hàng nào quay lại từ 2 lần trở lên.</td></tr>`;
    return;
  }

  container.innerHTML = returningList.map((c, idx) => {
    const contactInfo = c.phone
      ? `<i class="fa-solid fa-phone" style="color:var(--text-muted); font-size:11px; margin-right:4px;"></i> ${escapeHTML(c.phone)}`
      : `<span style="color:var(--text-muted); font-size:12px; font-style:italic;">Chưa cập nhật SĐT</span>`;

    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px 14px; font-weight: 700; color: var(--text-muted); font-size: 13px;">${idx + 1}</td>
        <td style="padding: 12px 14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:50%; background:#EFF6FF; color:#2563EB; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0;">
              ${escapeHTML((c.name || 'K').charAt(0).toUpperCase())}
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">${escapeHTML(c.name)}</div>
            </div>
          </div>
        </td>
        <td style="padding: 12px 14px; color: var(--text-muted); font-size: 13px;">
          ${contactInfo}
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <span style="font-weight: 800; font-size: 14px; color: #2563EB; background: #EFF6FF; padding: 4px 12px; border-radius: 12px; border: 1px solid #BFDBFE;">
            ${c.count || 0} lần
          </span>
        </td>
        <td style="padding: 12px 14px; font-size: 13px; color: var(--text-muted);">
          <i class="fa-regular fa-clock" style="margin-right: 4px; color: var(--primary);"></i>
          ${formatDate(c.lastDate)}
        </td>
        <td style="padding: 12px 14px; text-align: center;">
          <span class="badge badge-success" style="font-size:11.5px; padding:4px 10px; font-weight:700;">
            <i class="fa-solid fa-repeat"></i> Khách quay lại
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Global exports
window.toggleDashboardTab = toggleDashboardTab;
window.loadDashboardData = loadDashboardData;
window.loadDashboardStats = loadDashboardData;
window.renderRevenueView = loadDashboardData;
