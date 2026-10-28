require('dotenv').config();
const db = require('./config/database');
const { classifyDomain, OUT_OF_SCOPE_RESPONSE, MISSING_DATA_RESPONSE } = require('./utils/domainClassifier');
const { retrieveRAGContext, generateSynthesizedResponse } = require('./utils/ragEngine');
const { generateGeminiChatResponse } = require('./utils/geminiEngine');

const testCases = [
  {
    id: 1,
    query: "Mèo nhà mình bị nôn thì phải làm sao?",
    expectedCategory: "GENERAL_PET_KNOWLEDGE",
    description: "Tư vấn sức khỏe - Mèo bị nôn"
  },
  {
    id: 2,
    query: "Chó ăn được trứng không?",
    expectedCategory: "GENERAL_PET_KNOWLEDGE",
    description: "Tư vấn dinh dưỡng - Chó ăn trứng"
  },
  {
    id: 3,
    query: "Mèo bao lâu nên tẩy giun?",
    expectedCategory: "GENERAL_PET_KNOWLEDGE",
    description: "Tư vấn tẩy giun định kỳ cho mèo"
  },
  {
    id: 4,
    query: "Tình trạng bé ngan hiện tại thế nào?",
    expectedCategory: "SPECIFIC_PET_DATA",
    description: "Tra cứu hồ sơ bé ngan trong hệ thống"
  },
  {
    id: 5,
    query: "Bé ngan gần đây được chăm sóc thế nào?",
    expectedCategory: "SPECIFIC_PET_DATA",
    description: "Tra cứu lịch sử chăm sóc bé ngan"
  },
  {
    id: 6,
    query: "Tôi có được hủy lịch không?",
    expectedCategory: "SEN_CHAM_BOSS_SYSTEM",
    description: "Quy định hủy lịch của Sen Chăm Boss"
  },
  {
    id: 7,
    query: "Admin có được sửa dịch vụ không?",
    expectedCategory: "SEN_CHAM_BOSS_SYSTEM",
    description: "Quyền hạn của Admin"
  },
  {
    id: 8,
    query: "giá dịch vụ tắm chó bao nhiêu?",
    expectedCategory: "SEN_CHAM_BOSS_SYSTEM",
    description: "Bảng giá dịch vụ tắm chó Sen Chăm Boss"
  },
  {
    id: 9,
    query: "Python là gì?",
    expectedCategory: "OUT_OF_SCOPE",
    description: "Câu hỏi ngoài phạm vi - Lập trình"
  },
  {
    id: 10,
    query: "Thời tiết hôm nay thế nào?",
    expectedCategory: "OUT_OF_SCOPE",
    description: "Câu hỏi ngoài phạm vi - Thời tiết"
  }
];

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 KIỂM THỬ TRỢ LÝ AI: SEN CHĂM BOSS + KIẾN THỨC THÚ CƯNG TOÀN DIỆN');
  console.log('======================================================================\n');

  // User with pet 'ngan'
  const mockUser = {
    id: 'use_1786177950113_exl4',
    full_name: 'Khách Hàng Vịt',
    name: 'Khách Hàng Vịt',
    role: 'USER'
  };

  let passed = 0;

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------------`);
    console.log(`Test #${tc.id}: "${tc.query}"`);
    console.log(`Mục tiêu: ${tc.description}`);

    const classification = classifyDomain(tc.query);

    let finalReply = '';
    let isSuccess = false;

    if (!classification.isAllowed) {
      finalReply = OUT_OF_SCOPE_RESPONSE;
      console.log(`[Domain Guard] -> OUT_OF_SCOPE`);
      console.log(`[Trả lời AI]:\n${finalReply}`);
      if (tc.expectedCategory === 'OUT_OF_SCOPE') {
        isSuccess = true;
      }
    } else {
      console.log(`[Domain Guard] -> ALLOWED (Category: ${classification.category}, Intent: ${classification.intent})`);
      
      const pet = db.findOne('pets', p => p.user_id === mockUser.id && p.name.toLowerCase() === 'ngan');
      const ragDocs = await retrieveRAGContext(tc.query, mockUser, pet, db);
      console.log(`[RAG] Tìm được ${ragDocs.length} tài liệu liên quan`);

      const geminiRes = await generateGeminiChatResponse({
        message: tc.query,
        history: [],
        pet,
        ragContext: ragDocs,
        user: mockUser
      });

      if (geminiRes && geminiRes.reply) {
        finalReply = geminiRes.reply;
      } else {
        finalReply = generateSynthesizedResponse(tc.query, pet, ragDocs, mockUser);
      }

      console.log(`[Trả lời AI]:\n${finalReply}`);

      const low = finalReply.toLowerCase();
      if (tc.id === 1) { // Mèo bị nôn
        isSuccess = (low.includes('nôn') || low.includes('thức ăn') || low.includes('theo dõi') || low.includes('bác sĩ thú y')) && !low.includes('chỉ hỗ trợ');
      } else if (tc.id === 2) { // Chó ăn trứng
        isSuccess = (low.includes('được') || low.includes('trứng') || low.includes('chín') || low.includes('protein')) && !low.includes('chỉ hỗ trợ');
      } else if (tc.id === 3) { // Mèo bao lâu tẩy giun
        isSuccess = (low.includes('tháng') || low.includes('tẩy giun') || low.includes('định kỳ')) && !low.includes('chỉ hỗ trợ');
      } else if (tc.id === 4) { // Tình trạng bé ngan
        isSuccess = (low.includes('ngan') || low.includes('khỏe mạnh') || low.includes('mèo'));
      } else if (tc.id === 5) { // Bé ngan chăm sóc thế nào
        isSuccess = (low.includes('ngan') || low.includes('tắm') || low.includes('dịch vụ') || low.includes('lịch'));
      } else if (tc.id === 6) { // Hủy lịch
        isSuccess = (low.includes('hủy') || low.includes('xác nhận') || low.includes('pending'));
      } else if (tc.id === 7) { // Admin sửa dịch vụ
        isSuccess = (low.includes('có') || low.includes('quyền') || low.includes('admin') || low.includes('dịch vụ'));
      } else if (tc.id === 8) { // Giá tắm chó
        isSuccess = (low.includes('150.000') || low.includes('tắm'));
      }
    }

    if (isSuccess) {
      console.log(`✅ KẾT QUẢ: ĐẠT (PASS)`);
      passed++;
    } else {
      console.log(`❌ KẾT QUẢ: CHƯA ĐẠT (FAIL)`);
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 TỔNG KẾT: ${passed}/${testCases.length} TEST CASES ĐẠT YÊU CẦU`);
  console.log('======================================================================\n');
}

runTests().catch(err => console.error('Test error:', err));
