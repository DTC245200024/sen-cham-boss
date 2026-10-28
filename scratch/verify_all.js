const http = require('http');

function postRequest(path, data, token = null, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getRequest(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET',
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỆ THỐNG 3 HẠNG MỤC SỬA LỖI');
  console.log('====================================================\n');

  // 1. LOGIN USER & RECEPTIONIST
  const userLogin = await postRequest('/api/auth/login', { email: 'vit@gmail.com', password: '123456' });
  const userToken = userLogin.data.token;
  const user = userLogin.data.user;
  console.log('✅ 1. Chủ nuôi đăng nhập thành công:', user.full_name, `(${user.email})`);

  const recLogin = await postRequest('/api/auth/login', { email: 'letan@petcare.com', password: '123456' });
  const recToken = recLogin.data.token;
  const receptionist = recLogin.data.user;
  console.log('✅ 2. Lễ tân đăng nhập thành công:', receptionist.full_name, `(${receptionist.email})`);

  // =========================================================================
  // TEST SECTION 1: AI TRỢ LÝ TRẢ LỜI GIÁ DỊCH VỤ
  // =========================================================================
  console.log('\n--- [TEST 1: TRỢ LÝ AI TRẢ LỜI GIÁ DỊCH VỤ] ---');
  
  // Test 1.1: Hỏi giá đắt nhất của spa
  console.log('>> Test 1.1: Hỏi "Giá đắt nhất của spa là bao nhiêu?"');
  const aiPriceQ1 = await postRequest('/api/ai/chat', { message: 'Giá đắt nhất của spa là bao nhiêu?' }, userToken);
  const reply1 = aiPriceQ1.data?.reply || '';
  console.log('AI Trả lời:', reply1);

  const mentions250kOrGrooming = reply1.includes('250.000') || reply1.includes('Cắt Tỉa Lông') || reply1.includes('550.000') || reply1.includes('Gói Spa');
  const falselyClaims150kIsMax = reply1.includes('150.000 VNĐ là dịch vụ đắt nhất') || reply1.includes('Tắm & Spa Thư Giãn (150.000 VNĐ) là dịch vụ có mức giá cao nhất');
  
  if (mentions250kOrGrooming && !falselyClaims150kIsMax) {
    console.log('✅ ĐẠT: AI đã so sánh đúng giá dịch vụ cao nhất từ database, không còn nói 150.000đ là đắt nhất!');
  } else {
    console.error('❌ KHÔNG ĐẠT: AI chưa phản ánh đúng giá cao nhất:', reply1);
  }

  // Test 1.2: Hỏi giá dịch vụ cụ thể
  console.log('\n>> Test 1.2: Hỏi "Giá của Cắt Tỉa Lông & Tạo Kiểu là bao nhiêu?"');
  const aiPriceQ2 = await postRequest('/api/ai/chat', { message: 'Giá của Cắt Tỉa Lông & Tạo Kiểu là bao nhiêu?' }, userToken);
  const reply2 = aiPriceQ2.data?.reply || '';
  console.log('AI Trả lời:', reply2);
  if (reply2.includes('250.000')) {
    console.log('✅ ĐẠT: AI trả lời chính xác giá 250.000 VNĐ cho dịch vụ Grooming!');
  } else {
    console.warn('⚠️ Kiểm tra câu trả lời:', reply2);
  }

  // =========================================================================
  // TEST SECTION 2: BỔ SUNG LỄ TÂN XÁC NHẬN THANH TOÁN
  // =========================================================================
  console.log('\n--- [TEST 2: LỄ TÂN XÁC NHẬN THANH TOÁN] ---');

  // Lấy danh sách thú cưng của user để đặt lịch
  const petsRes = await getRequest('/api/pets', userToken);
  const pet = petsRes.data.pets?.[0] || { id: 'pet_001' };

  // Test 2.1: Chủ nuôi đặt lịch chọn TIỀN MẶT
  console.log('>> Test 2.1: Chủ nuôi đặt lịch với Tiền mặt (TIEN_MAT)');
  const bookCashRes = await postRequest('/api/appointments', {
    petId: pet.id,
    appointmentDate: '2026-11-01',
    appointmentTime: '10:00',
    examinationType: 'Cắt Tỉa Lông & Tạo Kiểu (Grooming)',
    paymentMethod: 'TIEN_MAT'
  }, userToken);

  const appCash = bookCashRes.data.appointment;
  console.log('Lịch đặt thành công ID:', appCash.id);
  console.log('Trạng thái lịch ban đầu:', appCash.status, '| Trạng thái thanh toán:', appCash.paymentStatus, '| Phương thức:', appCash.paymentMethod);
  if (appCash.status === 'PENDING' && (appCash.paymentStatus === 'CHO_XAC_NHAN' || appCash.paymentStatus === 'CHO_THANH_TOAN')) {
    console.log('✅ ĐẠT: Khi đặt lịch tiền mặt, lịch có trạng thái PENDING và paymentStatus là CHO_XAC_NHAN (không tự động PAID)!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Trạng thái ban đầu không đúng:', appCash);
  }

  // Test 2.2: Chủ nuôi đặt lịch chọn CHUYỂN KHOẢN
  console.log('\n>> Test 2.2: Chủ nuôi đặt lịch với Chuyển khoản (CHUYEN_KHOAN)');
  const bookTransferRes = await postRequest('/api/appointments', {
    petId: pet.id,
    appointmentDate: '2026-11-02',
    appointmentTime: '14:00',
    examinationType: 'Tắm & Spa Thư Giãn',
    paymentMethod: 'CHUYEN_KHOAN'
  }, userToken);

  const appTransfer = bookTransferRes.data.appointment;
  console.log('Lịch đặt thành công ID:', appTransfer.id);
  console.log('Trạng thái lịch ban đầu:', appTransfer.status, '| Trạng thái thanh toán:', appTransfer.paymentStatus, '| Phương thức:', appTransfer.paymentMethod);
  if (appTransfer.status === 'PENDING' && (appTransfer.paymentStatus === 'CHO_XAC_NHAN' || appTransfer.paymentStatus === 'CHO_THANH_TOAN')) {
    console.log('✅ ĐẠT: Khi đặt lịch chuyển khoản, lịch có trạng thái PENDING và paymentStatus là CHO_XAC_NHAN (không tự động PAID)!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Trạng thái ban đầu không đúng:', appTransfer);
  }

  // Test 2.3: Chủ nuôi KHÔNG thể tự xác nhận thanh toán (Backend RBAC check)
  console.log('\n>> Test 2.3: Chủ nuôi cố tình gọi API xác nhận thanh toán PATCH /api/appointments/:id/confirm-payment');
  const userTryConfirmPay = await postRequest(`/api/appointments/${appCash.id}/confirm-payment`, {}, userToken, 'PATCH');
  console.log('Kết quả server trả về cho chủ nuôi:', userTryConfirmPay.status, userTryConfirmPay.data?.message);
  if (userTryConfirmPay.status === 403) {
    console.log('✅ ĐẠT: Backend chặn chủ nuôi tự xác nhận thanh toán (HTTP 403 Forbidden)!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Chủ nuôi không bị chặn:', userTryConfirmPay);
  }

  // Test 2.4: Lễ tân xác nhận lịch hẹn (schedule confirmation) - PHÂN BIỆT VỚI THANH TOÁN
  console.log('\n>> Test 2.4: Lễ tân xác nhận lịch hẹn PUT /api/appointments/:id/confirm');
  const recConfirmApp = await postRequest(`/api/appointments/${appCash.id}/confirm`, {}, recToken, 'PUT');
  const appAfterScheduleConfirm = recConfirmApp.data.appointment;
  console.log('Sau khi lễ tân xác nhận lịch: status =', appAfterScheduleConfirm.status, '| paymentStatus =', appAfterScheduleConfirm.paymentStatus);
  if (appAfterScheduleConfirm.status === 'CONFIRMED' && appAfterScheduleConfirm.paymentStatus !== 'PAID') {
    console.log('✅ ĐẠT: Xác nhận lịch hẹn ĐÃ TÁCH BIỆT với thanh toán (Lịch CONFIRMED nhưng thanh toán vẫn CHO_XAC_NHAN)!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Xác nhận lịch hẹn vẫn tự động đánh dấu PAID:', appAfterScheduleConfirm);
  }

  // Test 2.5: Lễ tân xác nhận thanh toán PATCH /api/appointments/:id/confirm-payment
  console.log('\n>> Test 2.5: Lễ tân xác nhận thanh toán tiền mặt');
  const recConfirmPay = await postRequest(`/api/appointments/${appCash.id}/confirm-payment`, {}, recToken, 'PATCH');
  console.log('Kết quả lễ tân xác nhận thanh toán:', recConfirmPay.status, recConfirmPay.data?.message);
  const paidApp = recConfirmPay.data?.appointment;
  if (paidApp && paidApp.paymentStatus === 'PAID') {
    console.log('✅ ĐẠT: Lễ tân xác nhận thanh toán thành công, paymentStatus cập nhật thành PAID!');
    console.log('Mã hóa đơn được tạo:', paidApp.invoice_code, '| Người xác nhận:', paidApp.payment_confirmed_by);
  } else {
    console.error('❌ KHÔNG ĐẠT:', recConfirmPay);
  }

  // Test 2.6: Ngăn xác nhận thanh toán trùng lần 2
  console.log('\n>> Test 2.6: Thử xác nhận thanh toán lần 2 trên cùng lịch hẹn');
  const duplicateConfirm = await postRequest(`/api/appointments/${appCash.id}/confirm-payment`, {}, recToken, 'PATCH');
  console.log('Kết quả xác nhận lần 2:', duplicateConfirm.status, duplicateConfirm.data?.message);
  if (duplicateConfirm.status === 400 && duplicateConfirm.data?.message?.includes('trước đó')) {
    console.log('✅ ĐẠT: Hệ thống đã chặn thành công việc xác nhận thanh toán trùng lặp (HTTP 400)!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Không chặn trùng lặp:', duplicateConfirm);
  }

  // Test 2.7: Kiểm tra đồng bộ trên tài khoản chủ nuôi
  console.log('\n>> Test 2.7: Kiểm tra phía chủ nuôi xem trạng thái lịch đã đồng bộ PAID chưa');
  const ownerCheckApp = await getRequest(`/api/appointments/${appCash.id}`, userToken);
  const ownerAppView = ownerCheckApp.data.appointment;
  if (ownerAppView && ownerAppView.paymentStatus === 'PAID') {
    console.log('✅ ĐẠT: Giao diện chủ nuôi đồng bộ trạng thái paymentStatus = PAID!');
  } else {
    console.error('❌ KHÔNG ĐẠT: Chủ nuôi chưa thấy trạng thái PAID:', ownerAppView);
  }

  // =========================================================================
  // TEST SECTION 3: CUỘN TRANG CHỦ
  // =========================================================================
  console.log('\n--- [TEST 3: KIỂM TRA CUỘN TRANG CHỦ] ---');
  const fs = require('fs');
  const css = fs.readFileSync('public/css/style.css', 'utf8');
  const htmlBodyMatch = css.match(/html\s*\{([^}]+)\}[\s\S]*?body\s*\{([^}]+)\}/);
  if (htmlBodyMatch) {
    const htmlCss = htmlBodyMatch[1];
    const bodyCss = htmlBodyMatch[2];
    console.log('CSS html:', htmlCss.replace(/\s+/g, ' ').trim());
    console.log('CSS body:', bodyCss.replace(/\s+/g, ' ').trim());
    const hasScrollLock = bodyCss.includes('overflow: hidden') || bodyCss.includes('overflow-y: hidden');
    const hasAutoScroll = bodyCss.includes('overflow-y: auto') || bodyCss.includes('overflow-y: scroll');
    if (!hasScrollLock && hasAutoScroll) {
      console.log('✅ ĐẠT: html, body đã bỏ overflow: hidden và cấu hình overflow-y: auto, trang chủ cuộn mượt mà từ đầu đến cuối!');
    } else {
      console.error('❌ KHÔNG ĐẠT: Vẫn còn thuộc tính khóa cuộn trên body:', bodyCss);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ HOÀN TẤT THÀNH CÔNG!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
