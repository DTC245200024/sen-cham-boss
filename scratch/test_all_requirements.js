const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG SEN CHĂM BOSS');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // --- TEST 1: KIỂM TRA CSS CUỘN TRANG (PHẦN 1.1) ---
  console.log('\n--- 1. Kiểm tra CSS cuộn trang ---');
  const cssPath = path.join(__dirname, '../public/css/style.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert(cssContent.includes('overflow-y: auto') || cssContent.includes('overflow-y: visible'), 'body hoặc landing-container cho phép cuộn trang overflow-y');
  assert(!cssContent.includes('html, body {\n  overflow: hidden;\n  height: 100%;\n}'), 'Không có thuộc tính overflow:hidden khóa toàn bộ html, body');
  assert(cssContent.includes('.landing-container'), 'Có định nghĩa CSS cho .landing-container');
  assert(cssContent.includes('.landing-navbar'), 'Có định nghĩa thanh điều hướng sticky .landing-navbar');

  // --- TEST 2: KIỂM TRA HTML TRANG CHỦ & CÁC KHU VỰC CHỨC NĂNG (PHẦN 1.2 & 1.3) ---
  console.log('\n--- 2. Kiểm tra HTML trang chủ & các khu vực chức năng ---');
  const htmlPath = path.join(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  assert(htmlContent.includes('landing-auth-nav'), 'Có container điều hướng tài khoản landing-auth-nav');
  assert(htmlContent.includes('hero-quick-actions'), 'Có khu vực thao tác nhanh hero-quick-actions');
  assert(htmlContent.includes('landing-pets-container'), 'Có container Quản lý thú cưng landing-pets-container');
  assert(htmlContent.includes('landing-schedules-container'), 'Có container Lịch chăm sóc landing-schedules-container');
  assert(htmlContent.includes('landing-appointments-container'), 'Có container Đặt lịch khám landing-appointments-container');
  assert(htmlContent.includes('landing-services-container'), 'Có container Dịch vụ & bảng giá landing-services-container');
  assert(htmlContent.includes('landing-health-container'), 'Có container Hồ sơ sức khỏe landing-health-container');
  assert(htmlContent.includes('landing-invoices-container'), 'Có container Hóa đơn & thanh toán landing-invoices-container');
  assert(htmlContent.includes('landing-ai-container'), 'Có container Trợ lý AI landing-ai-container');
  assert(htmlContent.includes('window.navigateToFeature'), 'Nút trên trang chủ kết nối với window.navigateToFeature');
  assert(htmlContent.includes('nav-home-link'), 'Sidebar có nút Trang Chủ nav-home-link');

  // --- TEST 3: XÓA KHUNG NHẮC LỊCH AI TRÊN TRANG LỊCH CHĂM SÓC (PHẦN 2.1) ---
  console.log('\n--- 3. Kiểm tra đã xóa hoàn toàn khung Nhắc Lịch AI trên trang Lịch Chăm Sóc ---');
  assert(!htmlContent.includes('id="ai-proposed-reminders-section"'), 'Đã xóa hoàn toàn khung ai-proposed-reminders-section khỏi HTML');
  assert(!htmlContent.includes('id="open-ai-gen-modal-btn"'), 'Đã xóa hoàn toàn nút Xem Nhắc Lịch AI open-ai-gen-modal-btn');
  assert(htmlContent.includes('id="view-ai-assistant"'), 'Trang Trợ lý AI riêng vẫn được bảo toàn nguyên vẹn');

  // --- TEST 4: ĐĂNG NHẬP VÀ PHÂN QUYỀN (PHẦN 1.3 & PHẦN 3) ---
  console.log('\n--- 4. Kiểm tra Đăng nhập & Quyền truy cập các vai trò ---');
  const dbPath = path.join(__dirname, '../data/db.json');
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  const userAccount = dbData.users.find(u => u.role === 'USER');
  const recAccount = dbData.users.find(u => u.role === 'RECEPTIONIST');
  const adminAccount = dbData.users.find(u => u.role === 'ADMIN');

  assert(userAccount, `Tìm thấy tài khoản Chủ nuôi: ${userAccount?.email}`);
  assert(recAccount, `Tìm thấy tài khoản Lễ tân: ${recAccount?.email}`);
  assert(adminAccount, `Tìm thấy tài khoản Admin: ${adminAccount?.email}`);

  // Login User
  const userLogin = await request({
    hostname: 'localhost', port: 3002, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userAccount.email, password: '123' });
  const userToken = userLogin.data?.token || (await request({
    hostname: 'localhost', port: 3002, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: userAccount.email, password: '123456' })).data?.token;

  assert(userToken, 'Đăng nhập Chủ nuôi thành công, nhận token xác thực');

  // Login Receptionist
  let recLogin = await request({
    hostname: 'localhost', port: 3002, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: recAccount.email, password: '123' });
  let recToken = recLogin.data?.token;
  if (!recToken) {
    recLogin = await request({
      hostname: 'localhost', port: 3002, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: recAccount.email, password: '123456' });
    recToken = recLogin.data?.token;
  }
  assert(recToken, 'Đăng nhập Lễ tân thành công, nhận token xác thực');

  // --- TEST 5: CHỦ NUÔI ĐẶT LỊCH TIỀN MẶT (PHẦN 3.1 & 3.2) ---
  console.log('\n--- 5. Kiểm tra Chủ nuôi đặt lịch TIỀN MẶT & Trạng thái ---');
  const userPet = dbData.pets.find(p => p.user_id === userAccount.id) || dbData.pets[0];
  assert(userPet, `Dùng thú cưng cho bài test: ${userPet?.name} (ID: ${userPet?.id})`);

  const uniqueDayOffset1 = 3 + Math.floor(Math.random() * 5);
  const uniqueDayOffset2 = 10 + Math.floor(Math.random() * 5);
  const date1 = new Date(Date.now() + uniqueDayOffset1 * 86400000).toISOString().split('T')[0];
  const date2 = new Date(Date.now() + uniqueDayOffset2 * 86400000).toISOString().split('T')[0];
  const time1 = `${String(9 + Math.floor(Math.random() * 4)).padStart(2, '0')}:15`;
  const time2 = `${String(14 + Math.floor(Math.random() * 4)).padStart(2, '0')}:45`;

  const cashBooking = await request({
    hostname: 'localhost', port: 3002, path: '/api/appointments', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }
  }, {
    petId: userPet.id,
    examinationType: 'Tắm & Spa Thư Giãn',
    appointmentDate: date1,
    appointmentTime: time1,
    paymentMethod: 'TIEN_MAT',
    symptoms: 'Thú cưng cần tắm thơm tho'
  });

  if (!cashBooking.data?.success) {
    console.error('cashBooking failed:', cashBooking);
  }
  assert(cashBooking.status === 201 && cashBooking.data?.success, 'Đặt lịch thành công qua API với phương thức TIỀN MẶT');
  const cashApp = cashBooking.data?.appointment;
  assert(cashApp.status === 'PENDING', 'Lịch mới tạo có trạng thái chờ xác nhận (PENDING)');
  assert(cashApp.paymentStatus === 'CHO_XAC_NHAN', 'Trạng thái thanh toán là chờ xác nhận (CHO_XAC_NHAN), KHÔNG tự động đánh dấu đã thanh toán');
  assert(cashApp.paymentMethod === 'TIEN_MAT', 'Lưu đúng phương thức thanh toán TIEN_MAT vào database');

  // --- TEST 6: CHỦ NUÔI ĐẶT LỊCH CHUYỂN KHOẢN (PHẦN 3.1 & 3.3) ---
  console.log('\n--- 6. Kiểm tra Chủ nuôi đặt lịch CHUYỂN KHOẢN & Trạng thái ---');
  const transferBooking = await request({
    hostname: 'localhost', port: 3002, path: '/api/appointments', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }
  }, {
    petId: userPet.id,
    examinationType: 'Cắt Tỉa Lông & Tạo Kiểu (Grooming)',
    appointmentDate: date2,
    appointmentTime: time2,
    paymentMethod: 'CHUYEN_KHOAN',
    symptoms: 'Tạo kiểu lông Boo'
  });

  assert(transferBooking.status === 201 && transferBooking.data.success, 'Đặt lịch thành công với phương thức CHUYỂN KHOẢN');
  const transferApp = transferBooking.data.appointment;
  assert(transferApp.status === 'PENDING', 'Lịch chuyển khoản có trạng thái PENDING');
  assert(transferApp.paymentStatus === 'CHO_XAC_NHAN', 'Lịch chuyển khoản ở trạng thái CHO_XAC_NHAN, không tự động đánh dấu đã thanh toán');

  // --- TEST 7: LỄ TÂN XÁC NHẬN LỊCH HẸN (TÁCH BIỆT VỚI XÁC NHẬN THANH TOÁN) (PHẦN 3.4) ---
  console.log('\n--- 7. Kiểm tra Lễ tân Xác nhận Lịch hẹn (Tách biệt với Thanh toán) ---');
  const confirmAppRes = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}/confirm`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recToken}` }
  }, {});
  assert(confirmAppRes.data.success, 'Lễ tân xác nhận lịch hẹn thành công');
  
  // Kiểm tra lịch hẹn sau khi confirm: status là CONFIRMED nhưng paymentStatus VẪN LÀ CHO_XAC_NHAN!
  const getAppAfterConfirm = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(getAppAfterConfirm.data.appointment.status === 'CONFIRMED', 'Trạng thái lịch đã cập nhật thành CONFIRMED');
  assert(getAppAfterConfirm.data.appointment.paymentStatus === 'CHO_XAC_NHAN', 'ĐẢM BẢO: Xác nhận lịch KHÔNG tự động xác nhận thu tiền, paymentStatus vẫn là CHO_XAC_NHAN');

  // --- TEST 8: BẢO MẬT: CHỦ NUÔI KHÔNG ĐƯỢC TỰ XÁC NHẬN THANH TOÁN (PHẦN 3.4) ---
  console.log('\n--- 8. Kiểm tra phân quyền: Chủ nuôi không được tự xác nhận thanh toán ---');
  const userTryConfirmPayment = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}/confirm-payment`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }
  });
  assert(userTryConfirmPayment.status === 403, 'Chủ nuôi bị từ chối 403 khi cố xác nhận thanh toán');

  // --- TEST 9: LỄ TÂN XÁC NHẬN THANH TOÁN THỰC TẾ (PHẦN 3.4 & 3.5) ---
  console.log('\n--- 9. Lễ tân Xác nhận đã thanh toán sau khi nhận tiền/sao kê ---');
  const recConfirmPayment = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}/confirm-payment`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recToken}` }
  });
  assert(recConfirmPayment.status === 200 && recConfirmPayment.data.success, 'Lễ tân xác nhận thanh toán thành công (200 OK)');
  assert(recConfirmPayment.data.appointment.paymentStatus === 'DA_THANH_TOAN', 'Trạng thái thanh toán của lịch hẹn cập nhật thành DA_THANH_TOAN');
  assert(recConfirmPayment.data.appointment.payment_confirmed_by, `Lưu thông tin nhân viên xác nhận: ${recConfirmPayment.data.appointment.payment_confirmed_by}`);

  // Kiểm tra chống thanh toán trùng lặp (duplicate check)
  const duplicateConfirm = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}/confirm-payment`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${recToken}` }
  });
  assert(duplicateConfirm.status === 400, 'Ngăn chặn thành công việc xác nhận trùng lặp / ghi nhận thanh toán hai lần (400 Bad Request)');

  // Kiểm tra phía Chủ nuôi thấy trạng thái đã thanh toán
  const ownerCheckPaid = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${cashApp.id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(ownerCheckPaid.data.appointment.paymentStatus === 'DA_THANH_TOAN', 'Chủ nuôi thấy trạng thái đã thanh toán đồng bộ từ database');

  // --- TEST 10: KIỂM TRA LỊCH CHĂM SÓC HIỂN THỊ ĐÚNG MỤC CHƯA HOÀN THÀNH (PHẦN 2.2) ---
  console.log('\n--- 10. Kiểm tra hiển thị trong Lịch Chăm Sóc ---');
  const careSchedulesRes = await request({
    hostname: 'localhost', port: 3002, path: '/api/schedules?view=all', method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(careSchedulesRes.data.success, 'Lấy danh sách lịch chăm sóc thành công');
  const mySchedules = careSchedulesRes.data.schedules;
  const linkedSchedule = mySchedules.find(s => s.appointment_id === cashApp.id || s.id === 'sch_app_' + cashApp.id);
  assert(linkedSchedule, 'Lịch chăm sóc liên kết xuất hiện trong danh sách của chủ nuôi');
  assert(linkedSchedule && linkedSchedule.status !== 'ĐÃ_HOÀN_THÀNH', 'Lịch chưa hoàn thành nằm trong nhóm Lịch chưa hoàn thành');
  assert(linkedSchedule && linkedSchedule.appointment_code, `Hiển thị mã lịch rõ ràng: ${linkedSchedule?.appointment_code}`);
  assert(linkedSchedule && linkedSchedule.payment_status === 'DA_THANH_TOAN', 'Lịch chăm sóc hiển thị đúng trạng thái thanh toán DA_THANH_TOAN');

  // --- TEST 11: HỦY LỊCH VÀ LOẠI KHỎI DANH SÁCH HOẠT ĐỘNG (PHẦN 2.2 & CHECKLIST 6) ---
  console.log('\n--- 11. Kiểm tra Hủy lịch & Loại khỏi danh sách hoạt động ---');
  // Hủy transferApp (đang PENDING)
  const cancelRes = await request({
    hostname: 'localhost', port: 3002, path: `/api/appointments/${transferApp.id}/cancel`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }
  }, { cancel_reason: 'Chủ nuôi bận đột xuất' });
  assert(cancelRes.data.success, 'Hủy lịch hẹn thành công');

  // Tải lại danh sách lịch chăm sóc
  const schedulesAfterCancel = await request({
    hostname: 'localhost', port: 3002, path: '/api/schedules?view=all', method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const cancelledScheduleInList = schedulesAfterCancel.data.schedules.find(s => s.appointment_id === transferApp.id);
  assert(!cancelledScheduleInList, 'Lịch đã hủy bị LOẠI HOÀN TOÀN khỏi danh sách lịch chăm sóc đang hoạt động');

  // Kiểm tra trong database lịch sử vẫn được lưu vết (không bị xóa vĩnh viễn)
  const freshDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const cancelledAppInDb = freshDb.appointments.find(a => a.id === transferApp.id);
  assert(cancelledAppInDb && cancelledAppInDb.status === 'CANCELLED', 'Lịch sử lịch bị hủy vẫn được lưu vết trong database với status CANCELLED');

  // --- TỔNG KẾT ---
  console.log('\n====================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT YÊU CẦU!`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Lỗi thực thi test:', err);
  process.exit(1);
});
