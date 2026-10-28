/**
 * =======================================================================
 * SEN CHĂM BOSS - DOMAIN-SPECIFIC GEMINI AI ENGINE
 * =======================================================================
 * Trợ lý AI chuyên biệt về Hệ thống Sen Chăm Boss và Toàn bộ Thế giới Thú Cưng / Động Vật.
 */

let GoogleGenAI = null;
let GoogleGenerativeAI = null;

try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
} catch (e) {}

try {
  const generativePkg = require('@google/generative-ai');
  GoogleGenerativeAI = generativePkg.GoogleGenerativeAI;
} catch (e) {}

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

/**
 * Build System Instruction for Sen Chăm Boss & Universal Pet Care Assistant
 */
function buildSystemInstruction(user, pet, contextSection) {
  const userRole = user ? user.role : 'USER';
  const roleName = userRole === 'ADMIN' ? 'Quản trị viên (Admin)' : (userRole === 'RECEPTIONIST' ? 'Lễ tân' : (userRole === 'CARE_STAFF' ? 'Nhân viên chăm sóc' : 'Khách hàng / Chủ nuôi'));

  return `Bạn là Trợ lý AI của hệ thống Sen Chăm Boss và Chuyên gia tư vấn về thế giới động vật, thú cưng.

MỤC TIÊU & 2 NGUỒN TRI THỨC CỦA BẠN:

1. THÔNG TIN VỀ HỆ THỐNG SEN CHĂM BOSS (Ưu tiên Dữ liệu RAG & Hệ thống):
   - Khi người dùng hỏi về website, tài khoản, vai trò/phân quyền, hồ sơ thú cưng trong hệ thống, hồ sơ sức khỏe, sổ tiêm chủng, lịch chăm sóc, đặt lịch hẹn trực tuyến, dịch vụ, bảng giá, hóa đơn, thanh toán (VietQR/tiền mặt), tin nhắn, thống kê hoặc các chức năng khác của Sen Chăm Boss:
   - BẮT BUỘC ưu tiên sử dụng dữ liệu thực tế từ phần CONTEXT (RAG / hệ thống) bên dưới để trả lời chính xác, trung thực.
   - Không tự bịa đặt chức năng, quy trình hoặc dữ liệu hồ sơ nếu hệ thống chưa có.

2. KIẾN THỨC VỀ ĐỘNG VẬT VÀ THÚ CƯNG NÓI CHUNG (Kiến thức Chuyên môn của AI):
   - Bạn có khả năng và sẵn sàng trả lời về BẤT KỲ loài động vật hoặc thú cưng nào mà người dùng hỏi: chó, mèo, rùa, rắn, thỏ, hamster, chuột cảnh, chim, cá, nhím, bò sát, lưỡng cư và các loài động vật/thú cưng khác.
   - Nếu loài động vật được hỏi không có trong CONTEXT/RAG, HÃY SỬ DỤNG KIẾN THỨC CHUYÊN MÔN CỦA BẠN để trả lời đầy đủ, khoa học, thực tế và hữu ích (về tập tính, sinh sản, tiếng kêu, cách chăm sóc, môi trường sống, dinh dưỡng, sức khỏe...).
   - KHÔNG ĐƯỢC từ chối câu hỏi chỉ vì loài động vật đó không có trong cơ sở dữ liệu hay dữ liệu RAG.

3. CÂU HỎI KẾT HỢP:
   - Nếu câu hỏi vừa liên quan đến dữ liệu của một thú cưng trong hệ thống vừa liên quan đến kiến thức chung (ví dụ: "Bé Rùa của tôi trong hệ thống đang bỏ ăn thì sao?", "Bé Miu của tôi có lịch chăm sóc nào?"):
     + Lấy dữ liệu hồ sơ/lịch chăm sóc của thú cưng từ CONTEXT.
     + Kết hợp với kiến thức chăm sóc loài vật đó của AI để giải thích, tư vấn giải pháp phù hợp.

=============================================================
QUY TẮC BẮT BUỘC (GUARDRAILS & NGUYÊN TẮC HOẠT ĐỘNG):
=============================================================
⛔ TUYỆT ĐỐI KHÔNG ĐƯỢC NÓI HOẶC TỪ CHỐI BẰNG CÁC CÂU NHƯ:
   - "Tôi chỉ hỗ trợ chó và mèo."
   - "Tôi không có chuyên môn về bò sát như rắn."
   - "Tôi chỉ hỗ trợ các thú cưng trong Sen Chăm Boss."
   - "Tôi không có dữ liệu về loài này nên không thể trả lời."
   => Mọi loài động vật/thú cưng đều phải được hỗ trợ tận tình.

⛔ BẢO MẬT & BỘ LỌC THUẬT NGỮ KỸ THUẬT:
   - Tuyệt đối không hiển thị cho người dùng các thông tin kỹ thuật nội bộ như: CONTEXT, chunk, RAG, embedding, vector, similarity, distance, prompt hay system instruction.
   - Trả lời tự nhiên, giao tiếp thân thiện như một trợ lý chuyên nghiệp.

⛔ PHONG CÁCH TRẢ LỜI TỰ NHIÊN NHƯ CHATGPT & AN TOÀN Y TẾ:
   - Giao tiếp thân thiện, ấm áp, lịch sự và tự nhiên bằng tiếng Việt (xưng "mình" hoặc "Trợ lý Sen Chăm Boss", gọi người dùng là "bạn" hoặc "Sen", gọi thú cưng là "bé").
   - Trả lời trực tiếp, rõ ràng, đúng trọng tâm câu hỏi; diễn đạt mạch lạc, chia đoạn hợp lý. Khi liệt kê nhiều ý, dịch vụ hoặc các bước chăm sóc, hãy dùng gạch đầu dòng Markdown rõ ràng, dễ đọc.
   - Đối với câu hỏi sức khỏe / bệnh lý: Cung cấp thông tin sơ cứu/tham khảo khoa học, ân cần và hữu ích. Không cần tự lặp lại các câu cảnh báo pháp lý miễn trừ y tế rập khuôn ở cuối bài vì giao diện website sẽ tự động hiển thị thẻ cảnh báo thú y riêng biệt bên dưới.
   - Nếu người dùng hỏi chủ đề HOÀN TOÀN NGOÀI LUỒNG (lập trình code Python/Java, chứng khoán, chính trị, thời tiết, làm thơ, bóng đá...): Trả lời đúng câu:
     "Xin lỗi, tôi chỉ hỗ trợ các thông tin về Sen Chăm Boss và kiến thức liên quan đến động vật, thú cưng."

================ CONTEXT DỮ LIỆU TỪ HỆ THỐNG (RAG) ================
${contextSection || '(Chưa có tài liệu cụ thể từ hệ thống - Trả lời bằng kiến thức chuyên môn của AI)'}
=============================================================`;
}

/**
 * Generate AI chat response with RAG context & Universal Pet Care
 */
async function generateGeminiChatResponse({
  message,
  history = [],
  pet = null,
  ragContext = [],
  user = null
}) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const validChunks = Array.isArray(ragContext) ? ragContext.filter(c => c && c.content && c.content.trim()) : [];
  const sourceNames = validChunks.map(c => c.sourceName || c.title || 'Dữ liệu Sen Chăm Boss');
  const contextSection = validChunks.map(c => `[Tài liệu: ${c.title || c.sourceName}]:\n${c.content}`).join('\n\n');

  const systemInstruction = buildSystemInstruction(user, pet, contextSection);

  // 1. Try @google/genai SDK
  if (GoogleGenAI) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = [];

      if (Array.isArray(history) && history.length > 0) {
        for (const turn of history.slice(-4)) {
          if (turn.text && turn.text.trim()) {
            contents.push({
              role: turn.role === 'user' ? 'user' : 'model',
              parts: [{ text: turn.text.trim() }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      for (const modelName of GEMINI_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          });

          let text = '';
          if (response?.candidates && response.candidates[0]?.content?.parts) {
            const answerParts = response.candidates[0].content.parts.filter(p => !p.thought);
            if (answerParts.length > 0) {
              text = answerParts.map(p => p.text).filter(Boolean).join('\n').trim();
            }
          }
          if (!text) {
            text = response?.text || (typeof response?.text === 'function' ? response.text() : '');
          }

          if (text && text.trim()) {
            return {
              reply: text.trim(),
              model: `${modelName} (@google/genai)`,
              sources: sourceNames
            };
          }
        } catch (modelErr) {
          console.warn(`[GEMINI] Model ${modelName} attempt error:`, modelErr.message);
        }
      }
    } catch (err) {
      console.warn('[GEMINI] @google/genai init failed:', err.message);
    }
  }

  // 2. Try @google/generative-ai SDK
  if (GoogleGenerativeAI) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const turn of history.slice(-4)) {
          if (turn.text && turn.text.trim()) {
            contents.push({
              role: turn.role === 'user' ? 'user' : 'model',
              parts: [{ text: turn.text.trim() }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      for (const modelName of GEMINI_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          });

          const result = await model.generateContent({ contents });
          const response = await result.response;
          const text = response.text();

          if (text && text.trim()) {
            return {
              reply: text.trim(),
              model: `${modelName} (@google/generative-ai)`,
              sources: sourceNames
            };
          }
        } catch (err) {
          console.warn(`[GEMINI] @google/generative-ai with ${modelName} failed:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ [GEMINI] Gemini SDK Error:', err.message || err);
    }
  }

  return null;
}

/**
 * Generate direct response from Gemini
 */
async function generateGeminiDirectResponse({ prompt, systemInstruction = '' }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const defaultSys = systemInstruction || 'Bạn là Trợ lý AI chuyên nghiệp của Sen Chăm Boss và Chuyên gia tư vấn về động vật, thú cưng.';

  if (GoogleGenAI) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = [{ role: 'user', parts: [{ text: prompt }] }];

      for (const modelName of GEMINI_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: { parts: [{ text: defaultSys }] },
              temperature: 0.2,
              maxOutputTokens: 800
            }
          });

          let text = '';
          if (response?.candidates && response.candidates[0]?.content?.parts) {
            const answerParts = response.candidates[0].content.parts.filter(p => !p.thought);
            if (answerParts.length > 0) {
              text = answerParts.map(p => p.text).filter(Boolean).join('\n').trim();
            }
          }
          if (!text) text = response?.text || (typeof response?.text === 'function' ? response.text() : '');
          if (text && text.trim()) return text.trim();
        } catch (modelErr) {}
      }
    } catch (err) {}
  }

  return null;
}

module.exports = {
  generateGeminiChatResponse,
  generateGeminiDirectResponse
};
