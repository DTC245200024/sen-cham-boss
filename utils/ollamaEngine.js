/**
 * =======================================================================
 * SEN CHĂM BOSS - OLLAMA LOCAL AI ENGINE (QWEN2.5:3B)
 * =======================================================================
 * Tích hợp mô hình LLM cục bộ qua Ollama API (qwen2.5:3b)
 * Hỗ trợ RAG hệ thống Sen Chăm Boss và Kiến thức Thú Cưng / Động Vật.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

function buildSystemInstruction(user, pet, contextSection) {
  const role = user?.role || 'USER';
  return `Bạn là Trợ lý AI của Sen Chăm Boss và chuyên gia tư vấn về thế giới động vật, thú cưng.

PHONG CÁCH TRẢ LỜI TỰ NHIÊN, THÂN THIỆN NHƯ CHATGPT:
- Giao tiếp tự nhiên, ấm áp, lịch sự và gần gũi bằng tiếng Việt (xưng "mình" hoặc "Trợ lý Sen Chăm Boss", gọi người dùng là "bạn" hoặc "Sen", gọi thú cưng là "bé").
- Trả lời gãy gọn, đúng trọng tâm câu hỏi, diễn đạt mạch lạc, chia đoạn hợp lý. Khi liệt kê nhiều ý, dịch vụ hoặc các bước chăm sóc, hãy dùng gạch đầu dòng rõ ràng, dễ đọc.
- Tránh câu chữ khô cứng, khuôn sáo máy móc. Tuyệt đối không nhắc đến prompt, context, RAG, embedding, vector, similarity hay thông tin kỹ thuật nội bộ.
- Đối với câu hỏi sức khỏe / bệnh lý thú cưng: Giải thích rõ ràng nguyên nhân tiềm ẩn và hướng dẫn các bước sơ cứu, chăm sóc ban đầu một cách khoa học, ân cần. Không cần tự chèn các câu cảnh báo pháp lý miễn trừ trách nhiệm y tế rập khuôn ở cuối bài vì giao diện website sẽ tự động hiển thị thẻ cảnh báo thú y riêng biệt bên dưới.

QUY TẮC DỮ LIỆU & BẢO TOÀN NGHIỆP VỤ BẮT BUỘC:
- Nếu CONTEXT có dữ liệu Sen Chăm Boss (bảng giá, dịch vụ, lịch hẹn, hồ sơ...), ưu tiên sử dụng chính xác dữ liệu đó; không bịa đặt dữ liệu hồ sơ, lịch, hóa đơn hay quyền hạn.
- Nếu không có CONTEXT phù hợp, sử dụng kiến thức chuyên môn của bạn để trả lời đầy đủ, khoa học về bất kỳ loài động vật hoặc thú cưng nào người dùng hỏi (chó, mèo, thỏ, chim, cá, bò sát, chuột cảnh...). Không được từ chối các loài động vật khác.
- Vai trò hiện tại của người dùng: ${role}.
${pet ? `Thú cưng đang được nhắc đến: ${pet.name} (${pet.species || 'thú cưng'}).` : ''}

CONTEXT:
${contextSection || '(Không có dữ liệu hệ thống phù hợp; dùng kiến thức thú cưng chung.)'}`;
}

/**
 * Generate AI chat response using Local Ollama (qwen2.5:3b)
 */
async function generateOllamaChatResponse({
  message,
  history = [],
  pet = null,
  ragContext = [],
  user = null
}) {
  try {
    const validChunks = Array.isArray(ragContext) ? ragContext.filter(c => c && c.content && c.content.trim()) : [];
    const sourceNames = validChunks.map(c => c.sourceName || c.title || 'Dữ liệu Sen Chăm Boss');
    const contextSection = validChunks.map(c => `[Tài liệu: ${c.title || c.sourceName}]:\n${c.content}`).join('\n\n');

    const systemInstruction = buildSystemInstruction(user, pet, contextSection);

    // Build chat prompt with conversation history if available
    let fullPrompt = '';
    if (Array.isArray(history) && history.length > 0) {
      const recentTurns = history.slice(-2);
      for (const turn of recentTurns) {
        if (turn.text && turn.text.trim()) {
          const roleLabel = turn.role === 'user' ? 'Người dùng' : 'Trợ lý AI';
          fullPrompt += `${roleLabel}: ${turn.text.trim()}\n`;
        }
      }
    }
    fullPrompt += `Người dùng: ${message.trim()}\nTrợ lý AI:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: systemInstruction,
        prompt: fullPrompt,
        stream: false,
        keep_alive: '2h',
        options: {
          temperature: 0.2,
          top_p: 0.8,
          num_predict: 256,
          num_ctx: 2048
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OLLAMA] Response status not OK: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (data && data.response && data.response.trim()) {
      let replyText = data.response.trim();
      replyText = replyText.replace(/^Trợ lý AI:\s*/i, '').trim();

      return {
        reply: replyText,
        model: `${OLLAMA_MODEL} (Ollama Local)`,
        sources: sourceNames
      };
    }
    return null;
  } catch (err) {
    console.warn('[OLLAMA] Generate request failed:', err.message);
    return null;
  }
}


/** Stream Ollama tokens as soon as they are generated. */
async function streamOllamaChatResponse({
  message,
  history = [],
  pet = null,
  ragContext = [],
  user = null,
  onChunk
}) {
  try {
    const validChunks = Array.isArray(ragContext) ? ragContext.filter(c => c && c.content && c.content.trim()) : [];
    const contextSection = validChunks.map(c => `[Tài liệu: ${c.title || c.sourceName}]:\n${c.content}`).join('\n\n');
    const systemInstruction = buildSystemInstruction(user, pet, contextSection);

    let fullPrompt = '';
    if (Array.isArray(history) && history.length > 0) {
      const recentTurns = history.slice(-2);
      for (const turn of recentTurns) {
        if (turn.text && turn.text.trim()) {
          const roleLabel = turn.role === 'user' ? 'Người dùng' : 'Trợ lý AI';
          fullPrompt += `${roleLabel}: ${turn.text.trim()}\n`;
        }
      }
    }
    fullPrompt += `Người dùng: ${message.trim()}\nTrợ lý AI:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: systemInstruction,
        prompt: fullPrompt,
        stream: true,
        keep_alive: '2h',
        options: {
          temperature: 0.2,
          top_p: 0.8,
          num_predict: 256,
          num_ctx: 2048
        }
      }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      clearTimeout(timeoutId);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let data;
          try { data = JSON.parse(line); } catch (_) { continue; }
          if (data.response) {
            reply += data.response;
            if (typeof onChunk === 'function') onChunk(data.response);
          }
        }
      }
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.response) {
            reply += data.response;
            if (typeof onChunk === 'function') onChunk(data.response);
          }
        } catch (_) {}
      }
    } finally {
      clearTimeout(timeoutId);
      try { reader.releaseLock(); } catch (_) {}
    }

    reply = reply.replace(/^Trợ lý AI:\s*/i, '').trim();
    if (!reply) return null;

    return {
      reply,
      model: `${OLLAMA_MODEL} (Ollama Local)`,
      sources: validChunks.map(c => c.sourceName || c.title || 'Dữ liệu Sen Chăm Boss')
    };
  } catch (err) {
    console.warn('[OLLAMA STREAM] Generate request failed:', err.message);
    return null;
  }
}

module.exports = {
  generateOllamaChatResponse,
  streamOllamaChatResponse,
  buildSystemInstruction,
  OLLAMA_MODEL,
  OLLAMA_BASE_URL
};
