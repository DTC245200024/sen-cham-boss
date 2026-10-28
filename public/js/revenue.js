/* ════════════════════════════════════════════════════════
   SEN CHĂM BOSS - REVENUE MANAGEMENT & ANALYTICS (ADMIN)
════════════════════════════════════════════════════════ */

let revenueChartInstance = null;
let currentGroupBy = 'month'; // 'day' | 'month' | 'year'
let currentRange = 'all';     // 'today' | '7days' | '30days' | 'this_month' | 'this_year' | 'all'
let currentRevenueReport = null;
let activeRevenueViewId = 'view-revenue';

function formatMoney(amount) {
  return (amount || 0).toLocaleString('vi-VN') + ' ₫';
}

function getRevenueContainer() {
  let el = document.getElementById(activeRevenueViewId);
  if (!el || el.style.display === 'none') {
    el = document.getElementById('view-revenue') || document.getElementById('view-store-revenue');
  }
  return el;
}

function openRevenueReport() {
  const user = window.currentUser || JSON.parse(localStorage.getItem('petcare_user') || localStorage.getItem('user') || 'null');
  if (!user || !['ADMIN','STORE_MANAGER'].includes(user.role)) {
    if (window.showToast) showToast('Chức năng thống kê báo cáo dành riêng cho Quản lý.', 'error');
    return;
  }
  if (window.switchView) {
    window.switchView('revenue');
  } else {
    renderRevenueView('revenue');
  }
}

function closeRevenueReport() {
  if (window.switchView) {
    window.switchView('admin-users');
  }
}

async function renderRevenueView(viewName = 'revenue') {
  activeRevenueViewId = 'view-revenue';
  let container = document.getElementById(activeRevenueViewId);
  if (!container) {
    container = document.getElementById('view-revenue') || document.getElementById('view-store-revenue');
  }
  if (!container) return;

  const pageTitle = 'Báo Cáo Doanh Thu & Thống Kê Dịch Vụ';
  const pageSubtitle = 'Thống kê tổng doanh thu, lượt dịch vụ chăm sóc và tỷ lệ khách hàng quay lại';

  container.innerHTML = `
    <div class="revenue-view-wrap" style="max-width:1400px; margin:0 auto; padding:20px 0 40px 0;">
      <!-- 1. Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg, #FF7A00, #EA5F00); color:#FFF; display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 12px rgba(255,122,0,0.25);">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <h2 style="font-size:22px; font-weight:800; color:#17233C; margin:0;">${pageTitle}</h2>
            <p style="font-size:13px; color:#64748B; margin:2px 0 0 0;">${pageSubtitle}</p>
          </div>
        </div>
      </div>

      <!-- 2. Thanh lọc Group By & Range -->
      <div style="background:#FFFFFF; border-radius:16px; padding:14px 18px; border:1px solid #E2E8F0; box-shadow:0 2px 8px rgba(0,0,0,0.03); margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <!-- Group By Tabs -->
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:13px; font-weight:700; color:#17233C;"><i class="fa-regular fa-calendar" style="color:#FF7A00; margin-right:4px;"></i> Xem theo:</span>
          <div style="display:inline-flex; background:#F1F5F9; padding:3px; border-radius:10px;">
            <button id="btn-group-day" class="btn btn-sm ${currentGroupBy === 'day' ? 'active-filter-type' : ''}" style="border-radius:8px; border:none; padding:5px 14px; font-size:12px; font-weight:700; ${currentGroupBy === 'day' ? 'background:#FF7A00; color:#FFF;' : 'background:transparent; color:#17233C;'}" onclick="setRevenueGroupBy('day')">Ngày</button>
            <button id="btn-group-month" class="btn btn-sm ${currentGroupBy === 'month' ? 'active-filter-type' : ''}" style="border-radius:8px; border:none; padding:5px 14px; font-size:12px; font-weight:700; ${currentGroupBy === 'month' ? 'background:#FF7A00; color:#FFF;' : 'background:transparent; color:#17233C;'}" onclick="setRevenueGroupBy('month')">Tháng</button>
            <button id="btn-group-year" class="btn btn-sm ${currentGroupBy === 'year' ? 'active-filter-type' : ''}" style="border-radius:8px; border:none; padding:5px 14px; font-size:12px; font-weight:700; ${currentGroupBy === 'year' ? 'background:#FF7A00; color:#FFF;' : 'background:transparent; color:#17233C;'}" onclick="setRevenueGroupBy('year')">Năm</button>
          </div>
        </div>

        <!-- Range Pills -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <span style="font-size:13px; font-weight:700; color:#17233C; margin-right:2px;"><i class="fa-solid fa-clock-rotate-left" style="color:#FF7A00; margin-right:4px;"></i> Thời gian:</span>
          ${[
            { key: 'today', label: 'Hôm nay' },
            { key: '7days', label: '7 ngày' },
            { key: '30days', label: '30 ngày' },
            { key: 'this_month', label: 'Tháng này' },
            { key: 'this_year', label: 'Năm nay' },
            { key: 'all', label: 'Tất cả' }
          ].map(r => `
            <button class="btn btn-sm range-btn ${currentRange === r.key ? 'active-range' : ''}" data-range="${r.key}" style="border-radius:20px; font-size:12px; font-weight:600; padding:4px 12px; border:1px solid ${currentRange === r.key ? '#FF7A00' : '#E2E8F0'}; background:${currentRange === r.key ? '#FF7A00' : '#FFF'}; color:${currentRange === r.key ? '#FFF' : '#64748B'};" onclick="setRevenueRange('${r.key}')">${r.label}</button>
          `).join('')}
        </div>
      </div>

      <!-- 3. Dynamic Content Area (KPIs, Chart, Tables) -->
      <div id="revenue-dynamic-body">
        <div style="background:#FFF; border-radius:18px; padding:40px; text-align:center; border:1px solid #E2E8F0;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:#FF7A00; margin-bottom:12px;"></i>
          <div style="font-weight:700; color:#17233C; font-size:15px;">Đang tải dữ liệu doanh thu & dịch vụ...</div>
        </div>
      </div>
    </div>`;

  await fetchRevenueReport();
}

function setRevenueGroupBy(groupBy) {
  currentGroupBy = groupBy;

  ['day', 'month', 'year'].forEach(g => {
    const btn = document.getElementById(`btn-group-${g}`);
    if (btn) {
      if (g === groupBy) {
        btn.style.backgroundColor = '#FF7A00';
        btn.style.color = '#FFFFFF';
      } else {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = '#17233C';
      }
    }
  });

  fetchRevenueReport();
}

function setRevenueRange(range) {
  currentRange = range;

  const buttons = document.querySelectorAll('.range-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-range') === range) {
      btn.style.backgroundColor = '#FF7A00';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#FF7A00';
    } else {
      btn.style.backgroundColor = '#FFFFFF';
      btn.style.color = '#64748B';
      btn.style.borderColor = '#E2E8F0';
    }
  });

  fetchRevenueReport();
}

async function fetchRevenueReport() {
  const dynamicBody = document.getElementById('revenue-dynamic-body');
  if (!dynamicBody) return;

  try {
    const res = await apiRequest(`/revenue/report?groupBy=${currentGroupBy}&range=${currentRange}`, 'GET');

    if (res && res.success && res.report) {
      currentRevenueReport = res.report;
      renderRevenueDataToDOM(res.report);
    } else {
      renderRevenueError(res ? res.message : 'Không thể tải báo cáo doanh thu.');
    }
  } catch (err) {
    console.error('Fetch revenue error:', err);
    renderRevenueError('Không thể tải dữ liệu doanh thu. Vui lòng thử lại.');
  }
}

function renderRevenueError(msg) {
  const dynamicBody = document.getElementById('revenue-dynamic-body');
  if (!dynamicBody) return;

  dynamicBody.innerHTML = `
    <div style="background:#FFF; border-radius:18px; padding:48px 24px; text-align:center; border:1px solid #E2E8F0; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
      <div style="width:56px; height:56px; margin:0 auto 12px auto; border-radius:50%; background:#FEF2F2; color:#EF4444; display:flex; align-items:center; justify-content:center; font-size:26px;">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 style="font-size:17px; font-weight:800; color:#17233C; margin-bottom:6px;">Không thể tải dữ liệu doanh thu</h3>
      <p style="color:#64748B; font-size:14px; margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto;">${msg}</p>
      <button type="button" class="btn btn-primary" style="padding:10px 24px; font-weight:700; border-radius:10px;" onclick="fetchRevenueReport()">
        <i class="fa-solid fa-rotate-right"></i> Thử lại
      </button>
    </div>`;
}

function renderRevenueDataToDOM(report) {
  const dynamicBody = document.getElementById('revenue-dynamic-body');
  if (!dynamicBody) return;

  const totalRev = report.totalRevenue || 0;
  const totalOrders = report.totalOrders || report.totalServices || 0;
  const returningCustomers = report.returningCustomers || 0;
  const avgOrder = report.averageOrderValue || 0;

  dynamicBody.innerHTML = `
    <!-- 4 KPI Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:22px;">
      <!-- 1. Tổng doanh thu -->
      <div style="background:#FFFFFF; border-radius:18px; padding:18px 20px; border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.03); display:flex; align-items:center; gap:14px;">
        <div style="width:50px; height:50px; border-radius:14px; background:#FFF0E5; color:#FF7A00; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">Tổng doanh thu</div>
          <div style="font-size:22px; font-weight:800; color:#FF7A00; margin-top:2px;">${formatMoney(totalRev)}</div>
        </div>
      </div>

      <!-- 2. Lượt dịch vụ & Đơn hàng -->
      <div style="background:#FFFFFF; border-radius:18px; padding:18px 20px; border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.03); display:flex; align-items:center; gap:14px;">
        <div style="width:50px; height:50px; border-radius:14px; background:#F0FDF4; color:#16A34A; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">Lượt dịch vụ & Đơn</div>
          <div style="font-size:22px; font-weight:800; color:#17233C; margin-top:2px;">${totalOrders.toLocaleString('vi-VN')}</div>
        </div>
      </div>

      <!-- 3. Khách hàng quay lại -->
      <div style="background:#FFFFFF; border-radius:18px; padding:18px 20px; border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.03); display:flex; align-items:center; gap:14px;">
        <div style="width:50px; height:50px; border-radius:14px; background:#EFF6FF; color:#2563EB; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">
          <i class="fa-solid fa-user-group"></i>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">Khách quay lại</div>
          <div style="font-size:22px; font-weight:800; color:#17233C; margin-top:2px;">${returningCustomers.toLocaleString('vi-VN')}</div>
        </div>
      </div>

      <!-- 4. Giá trị trung bình -->
      <div style="background:#FFFFFF; border-radius:18px; padding:18px 20px; border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.03); display:flex; align-items:center; gap:14px;">
        <div style="width:50px; height:50px; border-radius:14px; background:#FAF5FF; color:#9333EA; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;">
          <i class="fa-solid fa-calculator"></i>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">Giá trị TB / Lượt</div>
          <div style="font-size:22px; font-weight:800; color:#17233C; margin-top:2px;">${formatMoney(avgOrder)}</div>
        </div>
      </div>
    </div>

    <!-- Biểu Đồ Doanh Thu Card -->
    <div style="background:#FFFFFF; border-radius:18px; padding:22px 24px; border:1px solid #E2E8F0; box-shadow:0 4px 14px rgba(0,0,0,0.03); margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h3 style="font-size:16px; font-weight:800; color:#17233C; margin:0;"><i class="fa-solid fa-chart-area" style="color:#FF7A00; margin-right:6px;"></i> Biểu đồ doanh thu thực tế</h3>
          <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Rê chuột vào điểm dữ liệu để xem chi tiết doanh thu và số lượng đơn hàng</p>
        </div>
      </div>

      <div id="revenue-chart-empty-box" style="display:none; min-height:280px; align-items:center; justify-content:center;"></div>
      <div id="revenue-chart-canvas-box" style="height:300px; position:relative; width:100%;">
        <canvas id="mainRevenueChart"></canvas>
      </div>
    </div>

    <!-- 2 Cột: Dịch Vụ Sử Dụng Nhiều Nhất & Hóa Đơn Dịch Vụ Gần Đây -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:20px;">
      
      <!-- Cột 1: Dịch vụ sử dụng nhiều nhất -->
      <div style="background:#FFFFFF; border-radius:18px; padding:20px 22px; border:1px solid #E2E8F0; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:15px; font-weight:800; color:#17233C; margin:0;"><i class="fa-solid fa-hand-holding-heart" style="color:#FF7A00; margin-right:6px;"></i> Dịch vụ sử dụng nhiều nhất</h3>
          <span style="font-size:11px; font-weight:700; color:#64748B; background:#F1F5F9; padding:3px 8px; border-radius:6px;">Top dịch vụ</span>
        </div>
        <div class="table-responsive" style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#F8FAFC; border-bottom:1.5px solid #E2E8F0;">
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:left;">#</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:left;">Tên Dịch Vụ</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:center;">Số Lượt</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:right;">Doanh Thu</th>
              </tr>
            </thead>
            <tbody>
              ${renderTopServicesHtml(report.topServices || [])}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cột 2: Hóa đơn dịch vụ gần đây -->
      <div style="background:#FFFFFF; border-radius:18px; padding:20px 22px; border:1px solid #E2E8F0; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:15px; font-weight:800; color:#17233C; margin:0;"><i class="fa-solid fa-file-invoice-dollar" style="color:#3B82F6; margin-right:6px;"></i> Hóa đơn dịch vụ gần đây</h3>
          <span style="font-size:11px; font-weight:700; color:#64748B; background:#F1F5F9; padding:3px 8px; border-radius:6px;">Đã thanh toán</span>
        </div>
        <div class="table-responsive" style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#F8FAFC; border-bottom:1.5px solid #E2E8F0;">
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:left;">Mã HĐ</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:left;">Dịch Vụ</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:right;">Tổng Tiền</th>
                <th style="padding:8px 10px; font-size:11px; font-weight:700; color:#64748B; text-align:right;">Thời Gian</th>
              </tr>
            </thead>
            <tbody>
              ${renderRecentInvoicesHtml(report.recentInvoices || [])}
            </tbody>
          </table>
        </div>
      </div>

    </div>`;

  renderMainRevenueChart(report.chart);
}

function renderMainRevenueChart(chartData) {
  const chartCanvas = document.getElementById('mainRevenueChart');
  const emptyBox = document.getElementById('revenue-chart-empty-box');
  const canvasBox = document.getElementById('revenue-chart-canvas-box');

  if (!chartCanvas) return;

  const hasData = chartData && chartData.hasData && chartData.labels && chartData.labels.length > 0;

  if (!hasData) {
    if (canvasBox) canvasBox.style.display = 'none';
    if (emptyBox) {
      emptyBox.style.display = 'flex';
      emptyBox.innerHTML = `
        <div style="text-align:center; padding:36px 20px;">
          <div style="width:50px; height:50px; margin:0 auto 10px auto; border-radius:50%; background:#FFF0E5; color:#FF7A00; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <h4 style="font-size:15px; font-weight:700; color:#17233C; margin-bottom:4px;">Chưa có dữ liệu doanh thu trong khoảng thời gian này</h4>
          <p style="font-size:13px; color:#64748B; margin:0;">Hãy thử chọn mốc thời gian khác hoặc kiểm tra lại sau khi có hóa đơn dịch vụ thanh toán.</p>
        </div>`;
    }
    if (revenueChartInstance) {
      revenueChartInstance.destroy();
      revenueChartInstance = null;
    }
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';
  if (canvasBox) canvasBox.style.display = 'block';

  const ctx = chartCanvas.getContext('2d');
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }

  let gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(255, 122, 0, 0.28)');
  gradient.addColorStop(1, 'rgba(255, 122, 0, 0.01)');

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: 'Doanh thu (₫)',
          data: chartData.data,
          borderColor: '#FF7A00',
          backgroundColor: gradient,
          borderWidth: 3,
          pointBackgroundColor: '#FFFFFF',
          pointBorderColor: '#FF7A00',
          pointBorderWidth: 2.5,
          pointRadius: 4.5,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#FF7A00',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 2.5,
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#17233C',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: function(items) { return items[0].label || ''; },
            label: function(context) {
              const idx = context.dataIndex;
              const rev = context.parsed.y || 0;
              const ordersCount = chartData.orders ? (chartData.orders[idx] || 0) : 0;
              return [
                ` Doanh thu: ${formatMoney(rev)}`,
                ` Số lượt dịch vụ: ${ordersCount} lượt`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748B', font: { size: 11, family: 'Inter, sans-serif' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F1F5F9', borderDash: [3, 3] },
          ticks: {
            color: '#64748B',
            font: { size: 11, family: 'Inter, sans-serif' },
            callback: function(value) {
              if (value >= 1000000) return (value / 1000000) + ' Tr';
              if (value >= 1000) return (value / 1000) + ' k';
              return value;
            }
          }
        }
      }
    }
  });
}

function renderTopServicesHtml(services) {
  if (!services.length) {
    return `
      <tr>
        <td colspan="4" style="text-align:center; padding:24px; color:#64748B; font-size:13px;">
          <i class="fa-solid fa-hand-holding-heart" style="font-size:22px; color:#CBD5E1; margin-bottom:6px; display:block;"></i>
          Chưa có dịch vụ nào được sử dụng trong khoảng thời gian này.
        </td>
      </tr>`;
  }

  return services.map((s, idx) => {
    return `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:10px 8px; font-weight:700; color:#64748B; width:36px;">
          ${idx < 3 ? `<span class="badge" style="background:${idx === 0 ? '#FEF08A' : (idx === 1 ? '#E2E8F0' : '#FFEDD5')}; color:${idx === 0 ? '#854D0E' : (idx === 1 ? '#475569' : '#9A3412')}; font-weight:800; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:11px;">${idx + 1}</span>` : `#${idx + 1}`}
        </td>
        <td style="padding:10px 8px;">
          <div style="font-weight:700; color:#17233C; font-size:13px; line-height:1.3; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.name}">
            <i class="fa-solid fa-paw" style="color:#FF7A00; margin-right:4px;"></i> ${s.name}
          </div>
          <div style="font-size:11px; color:#64748B;">${s.category || 'Dịch vụ chăm sóc'}</div>
        </td>
        <td style="padding:10px 8px; text-align:center; font-weight:700; color:#17233C; font-size:13px;">
          ${(s.used_count || 0).toLocaleString('vi-VN')}
        </td>
        <td style="padding:10px 8px; text-align:right; font-weight:800; color:#FF7A00; font-size:13px;">
          ${formatMoney(s.revenue || 0)}
        </td>
      </tr>`;
  }).join('');
}

function renderRecentInvoicesHtml(invoices) {
  if (!invoices.length) {
    return `
      <tr>
        <td colspan="4" style="text-align:center; padding:24px; color:#64748B; font-size:13px;">
          <i class="fa-solid fa-file-invoice" style="font-size:22px; color:#CBD5E1; margin-bottom:6px; display:block;"></i>
          Chưa có hóa đơn dịch vụ hoàn thành nào trong khoảng thời gian này.
        </td>
      </tr>`;
  }

  return invoices.map(inv => {
    const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    }) : 'Vừa xong';

    return `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:10px 8px; font-weight:800; font-family:monospace; color:#FF7A00; font-size:12px;">
          #${inv.invoice_code || inv.id}
        </td>
        <td style="padding:10px 8px; font-size:12px; color:#17233C; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${inv.service_summary}">
          ${inv.service_summary}
        </td>
        <td style="padding:10px 8px; text-align:right; font-weight:800; color:#17233C; font-size:13px;">
          ${formatMoney(inv.total_amount || 0)}
        </td>
        <td style="padding:10px 8px; font-size:11px; color:#64748B; text-align:right; white-space:nowrap;">
          ${dateStr}
        </td>
      </tr>`;
  }).join('');
}

// Global exports
window.renderRevenueView = renderRevenueView;
window.openRevenueReport = openRevenueReport;
window.closeRevenueReport = closeRevenueReport;
window.setRevenueGroupBy = setRevenueGroupBy;
window.setRevenueRange = setRevenueRange;
window.fetchRevenueReport = fetchRevenueReport;
