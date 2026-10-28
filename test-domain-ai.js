require('dotenv').config();
const db = require('./config/database');
const { classifyDomain, OUT_OF_SCOPE_RESPONSE, MISSING_DATA_RESPONSE } = require('./utils/domainClassifier');
const { retrieveRAGContext, generateSynthesizedResponse } = require('./utils/ragEngine');
const { generateGeminiChatResponse } = require('./utils/geminiEngine');

const testCases = [
  {
    id: 1,
    query: "khi tôi đặt lịch xong tôi có huỷ dc lịch không",
    expectedCategory: "IN_DOMAIN",
    description: "Quy định hủy lịch của khách hàng"
  },
  {
    id: 2,
    query: "giá dịch vụ tắm chó bao nhiêu?",
    expectedCategory: "IN_DOMAIN",
    description: "Bảng giá dịch vụ tắm chó"
  },
  {
    id: 3,
    query: "thanh toán như thế nào?",
    expectedCategory: "IN_DOMAIN",
    description: "Phương thức thanh toán"
  },
  {
    id: 4,
    query: "admin có thể xóa dịch vụ không?",
    expectedCategory: "IN_DOMAIN",
    description: "Quyền hạn của Admin xóa dịch vụ"
  },
  {
    id: 5,
    query: "Sen Chăm Boss có những chức năng gì?",
    expectedCategory: "IN_DOMAIN",
    description: "Danh sách chức năng của website"
  },
  {
    id: 6,
    query: "Python là gì?",
    expectedCategory: "OUT_OF_SCOPE",
    description: "Câu hỏi ngoài phạm vi - Lập trình Python"
  },
  {
    id: 7,
    query: "Thời tiết hôm nay thế nào?",
    expectedCategory: "OUT_OF_SCOPE",
    description: "Câu hỏi ngoài phạm vi - Thời tiết"
  },
  {
    id: 8,
    query: "Viết cho tôi một bài thơ.",
    expectedCategory: "OUT_OF_SCOPE",
    description: "Câu hỏi ngoài phạm vi - Làm thơ"
  },
  {
    id: 9,
    query: "Tôi muốn hủy lịch.",
    expectedCategory: "IN_DOMAIN",
    description: "Intent hủy lịch"
  },
  {
    id: 10,
    query: "Sau khi nhân viên xác nhận tôi có hủy được không?",
    expectedCategory: "IN_DOMAIN",
    description: "Quy định hủy lịch sau khi xác nhận"
  }
];

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ 10 TEST CASES CHO DOMAIN-SPECIFIC AI SEN CHĂM BOSS');
  console.log('======================================================================\n');

  // Mock user: Normal customer (USER)
  const mockUser = {
    id: 'user_test',
    full_name: 'Khách Hàng Test',
    name: 'Khách Hàng Test',
    role: 'USER'
  };

  let passed = 0;

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------------`);
    console.log(`Test #${tc.id}: "${tc.query}"`);
    console.log(`Mục tiêu: ${tc.description} (Kỳ vọng: ${tc.expectedCategory})`);

    const classification = classifyDomain(tc.query);

    let finalReply = '';
    let isSuccess = false;

    if (!classification.isSenChamBoss) {
      finalReply = OUT_OF_SCOPE_RESPONSE;
      console.log(`[Domain Guard] -> OUT_OF_SCOPE`);
      console.log(`[Trả lời]: ${finalReply}`);
      if (tc.expectedCategory === 'OUT_OF_SCOPE') {
        isSuccess = true;
      }
    } else {
      console.log(`[Domain Guard] -> IN_SCOPE (Intent: ${classification.intent})`);
      const ragDocs = await retrieveRAGContext(tc.query, mockUser, null, db);
      console.log(`[RAG] Tìm được ${ragDocs.length} tài liệu liên quan`);

      if (ragDocs.length === 0) {
        finalReply = MISSING_DATA_RESPONSE;
      } else {
        const geminiRes = await generateGeminiChatResponse({
          message: tc.query,
          history: [],
          pet: null,
          ragContext: ragDocs,
          user: mockUser
        });

        if (geminiRes && geminiRes.reply) {
          finalReply = geminiRes.reply;
        } else {
          finalReply = generateSynthesizedResponse(tc.query, null, ragDocs, mockUser);
        }
      }

      console.log(`[Trả lời AI]:\n${finalReply}`);

      if (tc.expectedCategory === 'IN_DOMAIN') {
        // Validation per case
        if (tc.id === 1 || tc.id === 9) {
          isSuccess = finalReply.toLowerCase().includes('hủy') || finalReply.toLowerCase().includes('xác nhận') || finalReply.toLowerCase().includes('website');
        } else if (tc.id === 2) {
          isSuccess = finalReply.includes('150.000') || finalReply.toLowerCase().includes('tắm');
        } else if (tc.id === 3) {
          isSuccess = finalReply.toLowerCase().includes('vietqr') || finalReply.toLowerCase().includes('tiền mặt');
        } else if (tc.id === 4) {
          isSuccess = finalReply.toLowerCase().includes('có') || finalReply.toLowerCase().includes('xóa dịch vụ') || finalReply.toLowerCase().includes('admin');
        } else if (tc.id === 5) {
          isSuccess = finalReply.toLowerCase().includes('quản lý thú cưng') || finalReply.toLowerCase().includes('chức năng');
        } else if (tc.id === 10) {
          isSuccess = finalReply.toLowerCase().includes('không') || finalReply.toLowerCase().includes('lễ tân') || finalReply.toLowerCase().includes('xác nhận');
        }
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
