const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const aiRoutes = require('../routes/aiRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'petcare_secret_key_udttnt_2026';

// Setup minimal express app for testing the route directly
const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 KIỂM THỬ CHỨC NĂNG: AI TÓM TẮT HỒ SƠ THÚ CƯNG — BÉ NGAN');
  console.log('======================================================================');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/ai`;

  try {
    // 1. Lấy thông tin user chủ nuôi (vịt) và bé ngan
    const petId = 'pet_1788798725935_chtp';
    const pet = db.findById('pets', petId);
    console.log(`\n🐾 [TEST DATA] Thú cưng được chọn:`, {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      owner_id: pet.user_id
    });

    const owner = db.findById('users', pet.user_id);
    const ownerToken = createToken(owner);

    // 2. Test 1: Chủ nuôi gọi AI tóm tắt hồ sơ bé ngan
    console.log(`\n▶ [TEST 1]: Chủ nuôi (${owner.full_name} - ${owner.email}) gọi AI Tóm Tắt Hồ Sơ bé ngan...`);
    const res1 = await fetch(`${baseUrl}/summarize-record/${petId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    const data1 = await res1.json();

    console.log(`  - HTTP Status:`, res1.status);
    console.log(`  - API Success:`, data1.success);
    console.log(`  - Has Data:`, data1.has_data);
    console.log(`  - Pet Info:`, data1.pet);
    console.log(`  - User Role:`, data1.user_role, '| Is Owner:', data1.is_owner);
    console.log(`  - Stats đối chiếu:`, data1.stats);

    if (!data1.success || !data1.has_data || data1.pet.name !== 'ngan') {
      throw new Error(`Test 1 Failed: Dữ liệu tóm tắt không chính xác!`);
    }

    console.log('\n--- CÁC PHẦN TÓM TẮT THỰC TẾ ĐƯỢC SINH RA ---');
    console.log('1. [Thông tin cơ bản & Thể trạng]:\n', data1.sections.summary_overview);
    console.log('\n2. [Lịch chăm sóc đã đặt & Trạng thái hiện tại]:\n', data1.sections.booked_schedules);
    console.log('\n3. [Lịch sử chăm sóc đã hoàn thành]:\n', data1.sections.completed_history);
    console.log('\n4. [Lịch tiêm phòng]:\n', data1.sections.vaccination_record);
    console.log('\n5. [Hồ sơ sức khỏe]:\n', data1.sections.health_record);
    console.log('\n6. [Lịch sắp tới & Những lưu ý phù hợp]:\n', data1.sections.upcoming_notes);

    // 3. Test 2: Admin (quanly@petcare.com) có quyền xem tóm tắt của bất kỳ thú cưng nào
    console.log(`\n▶ [TEST 2]: Quản trị viên (ADMIN) gọi AI Tóm Tắt Hồ Sơ bé ngan...`);
    const adminUser = db.findOne('users', u => u.role === 'ADMIN');
    const adminToken = createToken(adminUser);
    const res2 = await fetch(`${baseUrl}/summarize-record/${petId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data2 = await res2.json();
    console.log(`  - HTTP Status:`, res2.status, '| Success:', data2.success, '| Role:', data2.user_role);
    if (!data2.success) throw new Error('Test 2 Failed: Admin không truy cập được hồ sơ!');

    // 4. Test 3: Chủ nuôi khác (USER) cố truy cập bé ngan của vịt
    console.log(`\n▶ [TEST 3]: Khách hàng khác (không sở hữu bé ngan) truy cập hồ sơ...`);
    const otherUser = db.findOne('users', u => u.role === 'USER' && u.id !== pet.user_id) || {
      id: 'use_fake_other',
      email: 'other@user.com',
      role: 'USER',
      full_name: 'Người dùng khác'
    };
    const otherToken = createToken(otherUser);
    const res3 = await fetch(`${baseUrl}/summarize-record/${petId}`, {
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    console.log(`  - HTTP Status:`, res3.status);
    const data3 = await res3.json();
    console.log(`  - Message:`, data3.message);
    if (res3.status !== 403) throw new Error('Test 3 Failed: Lẽ ra phải bị chặn 403 Forbidden!');

    // 5. Test 4: Pet ID không tồn tại
    console.log(`\n▶ [TEST 4]: Kiểm tra petId không tồn tại...`);
    const res4 = await fetch(`${baseUrl}/summarize-record/pet_non_existing_999`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    console.log(`  - HTTP Status:`, res4.status);
    if (res4.status !== 404) throw new Error('Test 4 Failed: Lẽ ra phải trả về 404 Not Found!');

    console.log('\n======================================================================');
    console.log('✅ TẤT CẢ 4 BÀI TEST KIỂM THỬ ĐÃ VƯỢT QUA 100%!');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
