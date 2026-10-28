const fs = require('fs');

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG CHỨC NĂNG ĐỒNG BỘ NHẮC LỊCH AI');
  console.log('======================================================================\n');

  // 1. Kiểm tra dữ liệu gốc của lịch #APP_1793
  console.log('👉 [BƯỚC 1]: Kiểm tra dữ liệu gốc của lịch #APP_1793 trong database:');
  const dbJson = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
  const app1793 = dbJson.appointments.find(a => a.id.includes('1793196713508_hpyj'));
  if (!app1793) {
    throw new Error('❌ Không tìm thấy lịch app_1793196713508_hpyj trong appointments!');
  }
  console.log(`✅ Tìm thấy lịch hẹn gốc: ID=${app1793.id}`);
  console.log(`   - Thú cưng: petId=${app1793.petId}`);
  console.log(`   - Dịch vụ: ${app1793.examinationType}`);
  console.log(`   - Ngày giờ: ${app1793.appointmentDate} lúc ${app1793.appointmentTime}`);
  console.log(`   - Trạng thái: ${app1793.status} (paymentStatus: ${app1793.paymentStatus})`);
  console.log(`   - Chủ nuôi: userId=${app1793.userId}`);

  // 2. Đăng nhập chủ nuôi vit@gmail.com
  console.log('\n👉 [BƯỚC 2]: Đăng nhập tài khoản chủ nuôi vit@gmail.com:');
  const loginRes = await fetch('http://localhost:3002/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vit@gmail.com', password: '123456' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Đăng nhập thất bại: ' + loginData.message);
  const token = loginData.token;
  console.log(`✅ Đăng nhập thành công: ${loginData.user.full_name} (${loginData.user.role})`);

  // 3. Kiểm tra API GET /api/ai/my-reminders
  console.log('\n👉 [BƯỚC 3]: Kiểm tra API GET /api/ai/my-reminders:');
  const remRes = await fetch('http://localhost:3002/api/ai/my-reminders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const remData = await remRes.json();
  if (!remData.success) throw new Error('Lỗi lấy my-reminders: ' + remData.message);
  console.log(`✅ Lấy thành công ${remData.reminders.length} nhắc lịch AI`);
  const found1793Reminder = remData.reminders.find(r => r.appointment_id === app1793.id);
  if (!found1793Reminder) {
    throw new Error('❌ Nhắc lịch cho #APP_1793 không có trong /api/ai/my-reminders!');
  }
  console.log('✅ Tìm thấy nhắc lịch cho #APP_1793:');
  console.log(`   - Appointment ID: ${found1793Reminder.appointment_id}`);
  console.log(`   - Thú cưng: ${found1793Reminder.pet_name}`);
  console.log(`   - Dịch vụ: ${found1793Reminder.schedule_title}`);
  console.log(`   - Ngày giờ: ${found1793Reminder.date} lúc ${found1793Reminder.time}`);
  console.log(`   - Trạng thái: ${found1793Reminder.status} (Chờ xác nhận)`);
  console.log(`   - Tin nhắn: ${found1793Reminder.message}`);

  // 4. Kiểm tra API GET /api/ai/pet-schedules/:pet_id
  console.log('\n👉 [BƯỚC 4]: Kiểm tra API GET /api/ai/pet-schedules/' + app1793.petId);
  const petSchedRes = await fetch(`http://localhost:3002/api/ai/pet-schedules/${app1793.petId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const petSchedData = await petSchedRes.json();
  if (!petSchedData.success) throw new Error('Lỗi lấy pet-schedules: ' + petSchedData.message);
  const foundPetSched1793 = petSchedData.schedules.find(s => s.appointment_id === app1793.id);
  if (!foundPetSched1793) {
    throw new Error('❌ Lịch #APP_1793 không có trong /api/ai/pet-schedules/:pet_id!');
  }
  console.log(`✅ Tìm thấy lịch #APP_1793 trong pet-schedules của bé ngan:`);
  console.log(`   - Tiêu đề: ${foundPetSched1793.title}`);
  console.log(`   - Danh mục: ${foundPetSched1793.category}`);
  console.log(`   - Nguồn: ${foundPetSched1793.source}`);
  console.log(`   - Ngày giờ: ${foundPetSched1793.date} lúc ${foundPetSched1793.time}`);
  console.log(`   - Trạng thái: ${foundPetSched1793.status}`);

  // 5. Kiểm tra API GET /api/schedules
  console.log('\n👉 [BƯỚC 5]: Kiểm tra API GET /api/schedules:');
  const schedRes = await fetch('http://localhost:3002/api/schedules', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const schedData = await schedRes.json();
  if (!schedData.success) throw new Error('Lỗi lấy schedules: ' + schedData.message);
  const foundInCareSched = schedData.schedules.find(s => s.appointment_id === app1793.id);
  if (!foundInCareSched) {
    throw new Error('❌ Lịch #APP_1793 không xuất hiện trong /api/schedules!');
  }
  console.log(`✅ Lịch #APP_1793 đã được đồng bộ trong /api/schedules:`);
  console.log(`   - ID: ${foundInCareSched.id}`);
  console.log(`   - Tên công việc: ${foundInCareSched.task_name}`);
  console.log(`   - Trạng thái: ${foundInCareSched.status}`);

  // 6. Đặt lịch mới tự động và xác minh reminder tự sinh không cần bấm nút
  console.log('\n👉 [BƯỚC 6]: Đặt thêm một lịch mới và kiểm tra tự động tạo nhắc lịch:');
  const randDay = Math.floor(Math.random() * 10 + 18);
  const randHour = Math.floor(Math.random() * 6 + 10).toString().padStart(2, '0');
  const randMin = (Math.random() > 0.5 ? '15' : '45');
  const newApptPayload = {
    petId: app1793.petId,
    appointmentDate: `2026-11-${randDay}`,
    appointmentTime: `${randHour}:${randMin}`,
    examinationType: 'Khám Sức Khỏe Tổng Quát',
    reason: 'Khám định kỳ cho bé',
    paymentMethod: 'CHUYEN_KHOAN'
  };
  const bookRes = await fetch('http://localhost:3002/api/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(newApptPayload)
  });
  const bookData = await bookRes.json();
  if (!bookData.success) throw new Error('Lỗi khi đặt lịch mới: ' + bookData.message);
  const newlyCreatedId = bookData.appointment.id;
  console.log(`✅ Đã đặt lịch mới thành công: ID=${newlyCreatedId}, Trạng thái=${bookData.appointment.status}`);

  // Kiểm tra nhắc lịch AI của lịch mới
  const checkNewRemRes = await fetch('http://localhost:3002/api/ai/my-reminders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const checkNewRemData = await checkNewRemRes.json();
  const newReminder = checkNewRemData.reminders.find(r => r.appointment_id === newlyCreatedId);
  if (!newReminder) {
    throw new Error('❌ Không tìm thấy nhắc lịch tự động cho lịch mới vừa đặt!');
  }
  console.log(`✅ Nhắc lịch AI tự động xuất hiện ngay lập tức (không cần bấm nút):`);
  console.log(`   - Appointment ID: ${newReminder.appointment_id}`);
  console.log(`   - Dịch vụ: ${newReminder.schedule_title}`);
  console.log(`   - Ngày giờ: ${newReminder.date} lúc ${newReminder.time}`);
  console.log(`   - Trạng thái: ${newReminder.status}`);

  // 7. Kiểm tra refresh/gọi lại nhiều lần không sinh bản ghi trùng
  console.log('\n👉 [BƯỚC 7]: Kiểm tra refresh và chống trùng lặp:');
  const countBefore = checkNewRemData.reminders.length;
  // Fetch thêm 3 lần
  await fetch('http://localhost:3002/api/ai/my-reminders', { headers: { Authorization: `Bearer ${token}` } });
  await fetch('http://localhost:3002/api/ai/my-reminders', { headers: { Authorization: `Bearer ${token}` } });
  const finalRemRes = await fetch('http://localhost:3002/api/ai/my-reminders', { headers: { Authorization: `Bearer ${token}` } });
  const finalRemData = await finalRemRes.json();
  const countAfter = finalRemData.reminders.length;
  if (countBefore !== countAfter) {
    throw new Error(`❌ Phát hiện bị trùng lặp: trước = ${countBefore}, sau = ${countAfter}`);
  }
  const duplicates = finalRemData.reminders.filter(r => r.appointment_id === newlyCreatedId);
  if (duplicates.length !== 1) {
    throw new Error(`❌ Lịch ${newlyCreatedId} bị trùng lặp: số lượng = ${duplicates.length}`);
  }
  console.log(`✅ Xác minh chống trùng lặp hoàn hảo: tổng số reminder không đổi (${countAfter}), lịch ${newlyCreatedId} chỉ xuất hiện duy nhất 1 lần.`);

  // 8. Kiểm tra khi hủy lịch: nhắc lịch tự động biến mất
  console.log('\n👉 [BƯỚC 8]: Kiểm tra hủy lịch hẹn -> Nhắc lịch tự động biến mất:');
  const cancelRes = await fetch(`http://localhost:3002/api/appointments/${newlyCreatedId}/cancel`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ cancel_reason: 'Kiểm thử hoàn tất việc hủy lịch' })
  });
  const cancelData = await cancelRes.json();
  if (!cancelData.success) throw new Error('Lỗi khi hủy lịch hẹn: ' + cancelData.message);
  console.log(`✅ Đã hủy lịch hẹn test: ${newlyCreatedId}`);

  const postCancelRemRes = await fetch('http://localhost:3002/api/ai/my-reminders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const postCancelRemData = await postCancelRemRes.json();
  const canceledReminder = postCancelRemData.reminders.find(r => r.appointment_id === newlyCreatedId);
  if (canceledReminder) {
    throw new Error('❌ Lịch đã hủy nhưng nhắc lịch AI vẫn còn tồn tại!');
  }
  console.log(`✅ Lịch đã hủy không còn tiếp tục được nhắc nhở theo đúng quy tắc!`);

  console.log('\n======================================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐÃ THÀNH CÔNG 100%!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err.message);
  process.exit(1);
});
