const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'petcare_secret_key_udttnt_2026';

function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Length'] = Buffer.byteLength(dataStr);

    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api' + path,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });

    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ HOÀN TẤT LỊCH CHĂM SÓC (API E2E) ===');

  const receptionistToken = generateToken('usr_receptionist_default');
  const careStaffToken = generateToken('use_1788690356107_rqnb');
  const ownerToken = generateToken('use_1786177950113_exl4');
  const adminToken = generateToken('usr_admin001_default');

  // Lấy danh sách thú cưng
  const petsRes = await request('GET', '/pets', null, receptionistToken);
  const pets = petsRes.body.pets || [];
  const testPet = pets[0];
  console.log('Thú cưng thử nghiệm:', testPet.name, 'ID:', testPet.id);

  // 1. Tạo một lịch hẹn mới qua API (Lễ tân tạo cho khách)
  const appDate = '2026-11-28';
  const appTime = '14:30';
  const bookRes = await request('POST', '/appointments', {
    petId: testPet.id,
    appointmentDate: appDate,
    appointmentTime: appTime,
    examinationType: 'Tắm & Spa Thư Giãn',
    paymentMethod: 'TIEN_MAT'
  }, receptionistToken);

  console.log('Đặt lịch Status:', bookRes.status);
  console.log('Đặt lịch Message:', bookRes.body.message);
  if (bookRes.status !== 201 || !bookRes.body.success) {
    throw new Error('Đặt lịch thất bại: ' + JSON.stringify(bookRes.body));
  }
  const createdApp = bookRes.body.appointment;
  const appId = createdApp.id;
  console.log('Mã lịch hẹn vừa tạo:', appId, 'Status ban đầu:', createdApp.status);

  // 2. Lễ tân xác nhận lịch hẹn
  const confirmRes = await request('PUT', `/appointments/${appId}/confirm`, {}, receptionistToken);
  console.log('Xác nhận lịch Status:', confirmRes.status, 'Message:', confirmRes.body.message);

  // 3. Phân công nhân viên
  const assignRes = await request('PUT', `/appointments/${appId}/assign`, {
    staffId: 'use_1788690356107_rqnb'
  }, receptionistToken);
  console.log('Phân công nhân viên Status:', assignRes.status, 'Message:', assignRes.body.message);

  // --- TEST 1: HOÀN TẤT MỘT LỊCH CHƯA HOÀN THÀNH ---
  console.log('\n--- TEST 1: XÁC NHẬN HOÀN TẤT LỊCH CHĂM SÓC (LỄ TÂN / NHÂN VIÊN) ---');
  const careContent = 'Tắm thảo dược, sấy lông, chải mượt, vệ sinh tai và cắt móng chân';
  const postCareNotes = 'Da bé sạch, lông mượt, không có ve rận hay nấm da. Dặn chủ nuôi giữ tai khô ráo.';
  
  const completeRes = await request('PUT', `/appointments/${appId}/complete`, {
    care_content: careContent,
    notes: postCareNotes,
    condition_after: postCareNotes,
    weight: '5.8'
  }, receptionistToken);

  console.log('Complete Response Status:', completeRes.status);
  console.log('Complete Response Message:', completeRes.body.message);
  console.log('Complete Response Success:', completeRes.body.success);
  if (completeRes.status !== 200 || !completeRes.body.success) {
    throw new Error('Test 1 thất bại: Không hoàn tất được lịch chăm sóc!');
  }

  // --- TEST 2: KIỂM TRA TRẠNG THÁI VÀ DỮ LIỆU ĐƯỢC LƯU TRONG DATABASE ---
  console.log('\n--- TEST 2: KIỂM TRA TRẠNG THÁI TRONG DATABASE QUA GET /api/appointments/:id ---');
  const getAppRes = await request('GET', `/appointments/${appId}`, null, receptionistToken);
  const appData = getAppRes.body.appointment;
  console.log('Appointment status:', appData.status);
  console.log('Appointment care_content:', appData.care_content);
  console.log('Appointment notes:', appData.notes);
  console.log('Appointment completed_by:', appData.completed_by);
  console.log('Appointment completed_at:', appData.completed_at || appData.completedAt);
  if (appData.status !== 'COMPLETED') {
    throw new Error('Test 2 thất bại: Trạng thái lịch chưa chuyển thành COMPLETED!');
  }
  if (appData.care_content !== careContent || appData.notes !== postCareNotes) {
    throw new Error('Test 2 thất bại: Nội dung chăm sóc hoặc ghi chú lưu không chính xác!');
  }

  // Kiểm tra hồ sơ sức khỏe / chăm sóc của pet
  const healthRes = await request('GET', `/health/pet/${testPet.id}`, null, receptionistToken);
  const healthRecords = (healthRes.body && (healthRes.body.records || healthRes.body.data || healthRes.body.health_records)) || [];
  const linkedRecord = healthRecords.find(r => r.appointment_id === appId || (r.description && r.description.includes(careContent)));
  console.log('Đã tìm thấy hồ sơ chăm sóc được lưu:', Boolean(linkedRecord));
  if (linkedRecord) {
    console.log('Record care_content / description:', linkedRecord.care_content || linkedRecord.description);
    console.log('Record notes:', linkedRecord.notes);
  }

  // --- TEST 3: MỞ LẠI LỊCH VỪA HOÀN THÀNH VÀ THỬ XÁC NHẬN LẦN NỮA ---
  console.log('\n--- TEST 3: THỬ XÁC NHẬN HOÀN TẤT LẦN 2 TRÊN LỊCH ĐÃ HOÀN THÀNH ---');
  const duplicateRes = await request('PUT', `/appointments/${appId}/complete`, {
    care_content: 'Cố tình bấm hoàn tất lần 2',
    notes: 'Gửi lại'
  }, receptionistToken);

  console.log('Duplicate Status:', duplicateRes.status);
  console.log('Duplicate Message:', duplicateRes.body.message);
  if (duplicateRes.status !== 400) {
    throw new Error('Test 3 thất bại: Lịch đã hoàn thành nhưng backend không trả mã 400!');
  }
  if (duplicateRes.body.message !== 'Lịch chăm sóc này đã được hoàn thành trước đó.') {
    throw new Error('Test 3 thất bại: Thông báo không đúng chuẩn: ' + duplicateRes.body.message);
  }

  // --- TEST 4: THỬ HOÀN TẤT LỊCH ĐÃ HỦY ---
  console.log('\n--- TEST 4: KIỂM TRA LỊCH ĐÃ HỦY KHÔNG THỂ HOÀN TẤT ---');
  // Tạo 1 lịch và hủy
  const bookCancelRes = await request('POST', '/appointments', {
    petId: testPet.id,
    appointmentDate: '2026-11-29',
    appointmentTime: '16:00',
    examinationType: 'Cắt Tỉa Lông & Tạo Kiểu (Grooming)',
    paymentMethod: 'TIEN_MAT'
  }, receptionistToken);
  const cancelAppId = bookCancelRes.body.appointment.id;

  // Hủy lịch
  const cancelRes = await request('PUT', `/appointments/${cancelAppId}/cancel`, {
    cancel_reason: 'Khách hàng có lịch bận'
  }, receptionistToken);
  console.log('Đã hủy lịch:', cancelAppId, 'Status hủy:', cancelRes.status);

  // Thử hoàn tất lịch đã hủy
  const tryCompleteCancelled = await request('PUT', `/appointments/${cancelAppId}/complete`, {
    care_content: 'Thử hoàn tất',
    notes: 'Ghi chú'
  }, careStaffToken);

  console.log('Complete Cancelled Status:', tryCompleteCancelled.status);
  console.log('Complete Cancelled Message:', tryCompleteCancelled.body.message);
  if (tryCompleteCancelled.status !== 400 || tryCompleteCancelled.body.message !== 'Lịch chăm sóc này đã bị hủy, không thể hoàn tất.') {
    throw new Error('Test 4 thất bại: Cho phép hoàn tất lịch đã hủy hoặc sai thông báo lỗi!');
  }

  // --- TEST 5: CHỦ NUÔI (USER) KHÔNG CÓ QUYỀN ĐÁNH DẤU HOÀN THÀNH ---
  console.log('\n--- TEST 5: KIỂM TRA CHỦ NUÔI KHÔNG CÓ QUYỀN HOÀN TẤT ---');
  const bookActiveRes = await request('POST', '/appointments', {
    petId: testPet.id,
    appointmentDate: '2026-11-30',
    appointmentTime: '09:00',
    examinationType: 'Tẩy Giun Định Kỳ',
    paymentMethod: 'TIEN_MAT'
  }, receptionistToken);
  const activeAppId = bookActiveRes.body.appointment.id;

  const userAttempt = await request('PUT', `/appointments/${activeAppId}/complete`, {
    care_content: 'Khách hàng tự đánh dấu'
  }, ownerToken);
  console.log('User attempt status:', userAttempt.status);
  console.log('User attempt message:', userAttempt.body.message);
  if (userAttempt.status !== 403 || userAttempt.body.message !== 'Chủ nuôi không có quyền đánh dấu hoàn thành lịch chăm sóc.') {
    throw new Error('Test 5 thất bại: Không chặn chủ nuôi đánh dấu hoàn tất!');
  }

  // Dọn dẹp bản ghi kiểm thử
  await request('DELETE', `/appointments/${appId}`, null, adminToken);
  await request('DELETE', `/appointments/${cancelAppId}`, null, adminToken);
  await request('DELETE', `/appointments/${activeAppId}`, null, adminToken);

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ 5 HẠNG MỤC KIỂM THỬ ĐÃ VƯỢT QUA 100% THÀNH CÔNG!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  process.exit(1);
});
