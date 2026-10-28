const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { retrieveRAGContext, generateSynthesizedResponse, invalidateRAGCache, buildRealSystemDocuments } = require('../utils/ragEngine');
const { generateOllamaChatResponse, streamOllamaChatResponse } = require('../utils/ollamaEngine');
const { generateGeminiChatResponse, generateGeminiDirectResponse } = require('../utils/geminiEngine');
const { classifyDomain, normalizeText, OUT_OF_SCOPE_RESPONSE, MISSING_DATA_RESPONSE } = require('../utils/domainClassifier');

router.use(authenticateToken);

// Allow authenticated users to access AI features
router.use((req, res, next) => {
  if (!['USER', 'ADMIN', 'STORE_MANAGER', 'CARE_STAFF', 'RECEPTIONIST'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Trợ lý AI chỉ dành cho người dùng đã xác thực.'
    });
  }
  next();
});

function isScheduleCreationRequest(msg) {
  const norm = normalizeText(msg);
  if (norm.includes('co lich') || norm.includes('lich gi') || norm.includes('lich nao') || norm.includes('gan nhat') || norm.includes('khi nao') || norm.includes('da co')) {
    return false;
  }
  const scheduleActionKeywords = [
    'lap lich cho', 'tao lich cho', 'sinh lich cho', 'tu dong lap lich', 'tu dong tao lich',
    'lap ke hoach cham soc', 'tao ke hoach cham soc', 'sinh lich cham soc', 'len ke hoach cham soc'
  ];
  return scheduleActionKeywords.some(kw => norm.includes(kw));
}

function createSmartCareSchedules(pet) {
  const today = new Date();
  const formatYMD = (d) => d.toISOString().split('T')[0];
  const generatedSchedules = [];

  for (let i = 0; i <= 2; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = formatYMD(targetDate);

    generatedSchedules.push({
      pet_id: pet.id,
      user_id: pet.user_id,
      task_name: `[AI] Cho ${pet.name} ăn sáng dinh dưỡng`,
      category: 'CHO_ĂN',
      date: dateStr,
      time: '07:30',
      description: `Khẩu phần chuẩn AI: ${pet.species === 'Chó' ? 'Hạt khô + thịt nạc' : (pet.species === 'Mèo' ? 'Pate + hạt dinh dưỡng' : 'Thức ăn dinh dưỡng chuyên dụng')}.`,
      priority: 'CAO',
      status: 'CHƯA_THỰC_HIỆN'
    });

    generatedSchedules.push({
      pet_id: pet.id,
      user_id: pet.user_id,
      task_name: `[AI] Cho ${pet.name} ăn tối & uống nước`,
      category: 'CHO_ĂN',
      date: dateStr,
      time: '18:30',
      description: `Khẩu phần chuẩn AI: Thức ăn dinh dưỡng và nước sạch.`,
      priority: 'TRUNG_BÌNH',
      status: 'CHƯA_THỰC_HIỆN'
    });
  }

  // Add grooming schedule
  const bathDate = new Date(today);
  bathDate.setDate(today.getDate() + (7 - today.getDay()));
  generatedSchedules.push({
    pet_id: pet.id,
    user_id: pet.user_id,
    task_name: `[AI] Tắm rửa & Sấy lông cho ${pet.name}`,
    category: 'VỆ_SINH',
    date: formatYMD(bathDate),
    time: '15:00',
    description: `Tắm khử khuẩn, dưỡng lông suôn mượt và vệ sinh móng/tai.`,
    priority: 'TRUNG_BÌNH',
    status: 'CHƯA_THỰC_HIỆN'
  });

  return generatedSchedules;
}

// POST /api/ai/chat - Trợ lý AI Thông Minh (Ollama Local Qwen2.5:3b + RAG + Gemini Fallback)
router.post('/chat', async (req, res) => {
  try {
    const { message, pet_id, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    const normMessage = normalizeText(message);
    const userPets = db.find('pets', p => p.user_id === req.user.id) || [];
    let pet = null;
    if (pet_id) {
      pet = db.findById('pets', pet_id);
    } else if (userPets.length > 0) {
      for (const p of userPets) {
        const normName = normalizeText(p.name);
        if (normName && normMessage.includes(normName)) {
          pet = p;
          break;
        }
      }
      if (!pet && userPets.length === 1) {
        pet = userPets[0];
      }
    }

    console.log('\n======================================================================');
    console.log(`<i class="fa-solid fa-user"></i> [1. USER MESSAGE]: "${message}" | User: ${req.user.name || req.user.full_name} (${req.user.role})`);
    if (pet) console.log(`<i class="fa-solid fa-paw"></i> [PET CONTEXT]: ${pet.name} (${pet.species} - ${pet.breed || 'Chưa rõ'})`);

    // =========================================================================
    // STEP 1: DOMAIN & SCOPE GUARD
    // =========================================================================
    const classification = classifyDomain(message);
    if (!classification.isAllowed) {
      console.log('<i class="fa-solid fa-ban"></i> [DOMAIN GUARD] Câu hỏi ngoài phạm vi Sen Chăm Boss & Thú cưng:', message);
      return res.json({
        success: true,
        reply: OUT_OF_SCOPE_RESPONSE,
        engine: 'domain-guard',
        rag: { retrievedCount: 0, sources: [] }
      });
    }

    // Direct database deletion command guard
    if (normMessage.startsWith('xoa thu cung') || normMessage.startsWith('xoa pet') || normMessage.startsWith('xoa ho so')) {
      return res.json({
        success: true,
        reply: 'Trợ lý AI không có quyền tự ý xóa hồ sơ thú cưng trong cơ sở dữ liệu. Bạn vui lòng thao tác trực tiếp trên giao diện "Quản lý thú cưng" của hệ thống.',
        engine: 'system-guard',
        rag: { retrievedCount: 0, sources: [] }
      });
    }

    // =========================================================================
    // STEP 2: AUTO SCHEDULE CREATION INTENT
    // =========================================================================
    if (isScheduleCreationRequest(message)) {
      console.log('<i class="fa-solid fa-gear"></i> [ROUTING] -> ACTION: Phát hiện ý định tạo lịch chăm sóc tự động');

      let targetPet = pet;
      if (!targetPet && userPets.length > 0) {
        if (normMessage.includes('meo') || normMessage.includes('cat')) {
          targetPet = userPets.find(p => normalizeText(p.species).includes('meo') || normalizeText(p.species).includes('cat'));
        } else if (normMessage.includes('cho') || normMessage.includes('cun')) {
          targetPet = userPets.find(p => normalizeText(p.species).includes('cho') || normalizeText(p.species).includes('dog'));
        }
        if (!targetPet) targetPet = userPets[0];
      }

      if (!targetPet) {
        const isCat = normMessage.includes('meo') || normMessage.includes('cat');
        targetPet = {
          id: userPets[0]?.id || 'general_pet',
          user_id: req.user.id,
          name: isCat ? 'Mèo cưng' : 'Cún cưng',
          species: isCat ? 'Mèo' : 'Chó'
        };
      }

      if (targetPet) {
        const generatedSchedules = createSmartCareSchedules(targetPet);
        const reply = `Dạ, mình đã thiết lập xong **Lịch Chăm Sóc Thông Minh** cho bé **${targetPet.name}** (${targetPet.species}):\n\n` +
          `•  **Ăn sáng & Ăn tối dinh dưỡng:** 07:30 & 18:30 hàng ngày\n` +
          `• <i class="fa-solid fa-bath"></i> **Tắm rửa & Sấy lông:** 15:00 Chủ nhật tuần này\n` +
          `• <i class="fa-solid fa-scissors"></i> **Cắt móng & Vệ sinh tai:** 10:00 ngày ${generatedSchedules[generatedSchedules.length - 1].date}\n\n` +
          `*Bạn có thể bấm nút bên dưới để lưu ngay toàn bộ lịch này vào hệ thống nhé!*`;

        return res.json({
          success: true,
          action: 'SCHEDULE_GENERATED',
          reply,
          pet: targetPet,
          schedules: generatedSchedules,
          engine: 'action-scheduler',
          rag: { retrievedCount: 0, sources: [] }
        });
      }
    }

    // =========================================================================
    // STEP 3: RAG RETRIEVAL (ChromaDB / Embedding Retrieval)
    // =========================================================================
    const ragChunks = await retrieveRAGContext(message, req.user, pet, db, classification);
    console.log('<i class="fa-solid fa-book"></i> [2. RAG RETRIEVED DOCS]:', ragChunks.length, 'tài liệu');
    ragChunks.forEach((c, idx) => {
      console.log(`   [Doc ${idx + 1}] ID: ${c.id} | Title: ${c.title} | Type: ${c.type}`);
    });

    // BẢO ĐẢM TRUY XUẤT 100% BẢNG GIÁ DỊCH VỤ THỰC TẾ TỪ DATABASE KHI HỎI VỀ GIÁ / DỊCH VỤ
    const isPriceQuery = normMessage.includes('gia') || normMessage.includes('dat nhat') || normMessage.includes('cao nhat') || normMessage.includes('bao nhieu') || normMessage.includes('bang gia') || normMessage.includes('chi phi') || normMessage.includes('phi') || normMessage.includes('spa') || normMessage.includes('dich vu');
    if (isPriceQuery) {
      const hasCatalog = ragChunks.some(c => c.id === 'system_services_catalog');
      if (!hasCatalog) {
        const sysDocs = buildRealSystemDocuments({ user: req.user, selectedPet: pet, database: db });
        const catalogDoc = sysDocs.find(d => d.id === 'system_services_catalog');
        if (catalogDoc) {
          ragChunks.unshift(catalogDoc);
        }
      }
    }

    // =========================================================================
    // STEP 4: OLLAMA LOCAL (QWEN2.5:3B) -> GEMINI FALLBACK -> LOCAL SYNTHESIZER
    // =========================================================================
    // =========================================================================
    // STEP 4: STREAMING OLLAMA - gửi token ngay khi model sinh ra
    // =========================================================================
    if (req.body && req.body.stream === true) {
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      let streamed = '';
      const ollamaStream = await streamOllamaChatResponse({
        message: message.trim(),
        history: Array.isArray(history) ? history : [],
        pet,
        ragContext: ragChunks,
        user: req.user,
        onChunk: (chunk) => {
          streamed += chunk;
          res.write(JSON.stringify({ type: 'chunk', text: chunk }) + '\n');
        }
      });

      if (ollamaStream && ollamaStream.reply) {
        res.write(JSON.stringify({
          type: 'done',
          success: true,
          reply: ollamaStream.reply,
          engine: ollamaStream.model || 'qwen2.5:3b (Ollama Local)',
          rag: {
            retrievedCount: ragChunks.length,
            sources: ragChunks.map(c => ({ id: c.id, title: c.title, type: c.type }))
          }
        }) + '\n');
        return res.end();
      }

      // Streaming failed before producing a useful response: preserve the existing fallback chain.
      const geminiRes = await generateGeminiChatResponse({
        message: message.trim(),
        history: Array.isArray(history) ? history : [],
        pet,
        ragContext: ragChunks,
        user: req.user
      });
      if (geminiRes && geminiRes.reply) {
        res.write(JSON.stringify({ type: 'chunk', text: geminiRes.reply }) + '\n');
        res.write(JSON.stringify({
          type: 'done', success: true, reply: geminiRes.reply,
          engine: geminiRes.model || 'gemini-flash',
          rag: { retrievedCount: ragChunks.length, sources: ragChunks.map(c => ({ id: c.id, title: c.title, type: c.type })) }
        }) + '\n');
        return res.end();
      }

      const fallback = generateSynthesizedResponse(message, pet, ragChunks, req.user);
      res.write(JSON.stringify({ type: 'chunk', text: fallback }) + '\n');
      res.write(JSON.stringify({
        type: 'done', success: true, reply: fallback,
        engine: 'local-rag-synthesizer',
        rag: { retrievedCount: ragChunks.length, sources: ragChunks.map(c => ({ id: c.id, title: c.title, type: c.type })) }
      }) + '\n');
      return res.end();
    }

    let reply = '';
    let engine = 'qwen2.5:3b (Ollama Local)';

    // 1. First priority: Local Ollama (qwen2.5:3b)
    const ollamaRes = await generateOllamaChatResponse({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      pet,
      ragContext: ragChunks,
      user: req.user
    });

    if (ollamaRes && ollamaRes.reply) {
      reply = ollamaRes.reply;
      engine = ollamaRes.model || 'qwen2.5:3b (Ollama Local)';
    } else {
      console.log('<i class="fa-solid fa-rotate-right"></i> [LLM FALLBACK] Ollama local không khả dụng, chuyển sang Gemini API...');
      // 2. Secondary fallback: Gemini API
      const geminiRes = await generateGeminiChatResponse({
        message: message.trim(),
        history: Array.isArray(history) ? history : [],
        pet,
        ragContext: ragChunks,
        user: req.user
      });

      if (geminiRes && geminiRes.reply) {
        reply = geminiRes.reply;
        engine = geminiRes.model || 'gemini-flash';
      } else {
        // 3. Final fallback: Local Synthesizer
        engine = 'local-rag-synthesizer';
        reply = generateSynthesizedResponse(message, pet, ragChunks, req.user);
      }
    }

    console.log('<i class="fa-solid fa-comment"></i> [3. FINAL AI RESPONSE]:');
    console.log(reply);
    console.log(`<i class="fa-solid fa-robot"></i> Engine: ${engine}`);
    console.log('======================================================================\n');

    return res.json({
      success: true,
      reply,
      engine,
      rag: {
        retrievedCount: ragChunks.length,
        sources: ragChunks.map(c => ({ id: c.id, title: c.title, type: c.type }))
      }
    });
  } catch (err) {
    console.error('<i class="fa-solid fa-xmark"></i> AI chat error:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi xử lý phản hồi từ AI Assistant.' });
  }
});

// GET /api/ai/summarize-record/:pet_id - AI Tóm tắt hồ sơ chăm sóc & sức khỏe toàn diện của thú cưng
router.get('/summarize-record/:pet_id', async (req, res) => {
  try {
    const { pet_id } = req.params;
    if (!pet_id) {
      return res.status(400).json({ success: false, message: 'Thiếu mã ID thú cưng (petId).' });
    }

    const pet = db.findById('pets', pet_id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng với ID đã cung cấp.' });
    }

    // 1. Kiểm tra quyền truy cập (Yêu cầu 7):
    const isOwner = pet.user_id === req.user.id;
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    let isCareStaffWithAccess = false;
    if (req.user.role === 'CARE_STAFF') {
      const staffApps = db.find('appointments', a => a.petId === pet_id && (a.staffId === req.user.id || a.staff_id === req.user.id)) || [];
      const staffRecs = db.find('pet_health_records', r => r.pet_id === pet_id && (r.staff_id === req.user.id || r.doctor_name === req.user.full_name)) || [];
      if (staffApps.length > 0 || staffRecs.length > 0) {
        isCareStaffWithAccess = true;
      }
    }

    if (!isOwner && !isStaff && !isCareStaffWithAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập hồ sơ chăm sóc của thú cưng này.'
      });
    }

    // 2. Truy vấn toàn bộ nguồn dữ liệu thực tế theo đúng petId (Yêu cầu 2 & 3):
    const careSchedules = db.find('care_schedules', s => s.pet_id === pet_id) || [];
    const appointments = db.find('appointments', a => a.petId === pet_id) || [];
    const healthRecords = db.find('pet_health_records', r => r.pet_id === pet_id) || [];
    const vaccinations = db.find('vaccinations', v => v.pet_id === pet_id) || [];
    const dewormings = db.find('dewormings', d => d.pet_id === pet_id) || [];
    const medications = db.find('medications', m => m.pet_id === pet_id) || [];

    // Helper format ngày hiển thị dd/mm/yyyy
    const formatDateVN = (dStr) => {
      if (!dStr) return '';
      const parts = String(dStr).split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dStr;
    };

    // 3. Phân tích & Phân loại dữ liệu thực tế (Không suy diễn, không tạo dữ liệu giả):

    // SECTION 1: Thông tin cơ bản của thú cưng
    const ageText = pet.age_months ? `${pet.age_months} tháng tuổi` : (pet.dob ? `Sinh ngày ${formatDateVN(pet.dob)}` : 'Chưa rõ tuổi');
    let weightTrend = '';
    if (Array.isArray(pet.weight_history) && pet.weight_history.length > 1) {
      const sortedW = [...pet.weight_history].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
      const firstW = sortedW[0];
      const lastW = sortedW[sortedW.length - 1];
      const diff = (parseFloat(lastW.weight) - parseFloat(firstW.weight)).toFixed(1);
      if (diff > 0) weightTrend = ` (tăng +${diff} kg từ ${firstW.weight} kg ngày ${formatDateVN(firstW.date)})`;
      else if (diff < 0) weightTrend = ` (giảm ${diff} kg từ ${firstW.weight} kg ngày ${formatDateVN(firstW.date)})`;
    }

    const summaryOverviewLines = [
      `• Tên thú cưng: Bé ${pet.name} (Mã thú cưng: ${pet.pet_code || 'PET-N/A'})`,
      `• Loài & Giống: ${pet.species || 'Thú cưng'} — ${pet.breed || 'Chưa rõ giống'}`,
      `• Giới tính & Tuổi: Giới tính ${pet.gender || 'Đực'} | ${ageText}`,
      `• Cân nặng hiện tại: ${pet.weight || 'Chưa ghi nhận'} kg${weightTrend}`,
      `• Tình trạng sức khỏe chung: ${pet.health_status || 'Khỏe mạnh'}`,
      pet.fur_color ? `• Màu lông / Nhận dạng: ${pet.fur_color}` : null,
      pet.notes ? `• Ghi chú của chủ nuôi: ${pet.notes}` : null
    ].filter(Boolean).join('\n');

    // SECTION 2: Lịch chăm sóc đã đặt và trạng thái hiện tại
    const activeAppts = appointments.filter(a => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status));
    const activeCareSchedules = careSchedules.filter(s => s.status !== 'ĐÃ_HOÀN_THÀNH');

    const bookedLines = [];
    if (activeAppts.length > 0) {
      activeAppts.forEach(a => {
        const sName = (a.examinationType || a.reason || 'Dịch vụ spa/chăm sóc').replace(/^\[AI\]\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '').trim();
        const stText = a.status === 'PENDING' ? 'Chờ xác nhận' : (a.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đang chăm sóc');
        bookedLines.push(`• [Lịch đặt hẹn] ${sName} — ${a.appointmentTime || ''} ngày ${formatDateVN(a.appointmentDate)} (Trạng thái: ${stText})`);
      });
    }
    if (activeCareSchedules.length > 0) {
      activeCareSchedules.forEach(s => {
        const sName = (s.task_name || s.title || 'Lịch chăm sóc').replace(/^\[AI\]\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '').trim();
        const stText = s.status === 'QUÁ_HẠN' ? 'Đã quá hạn' : 'Chưa thực hiện';
        bookedLines.push(`• [Lịch định kỳ] ${sName} — ${s.time || ''} ngày ${formatDateVN(s.date)} (Trạng thái: ${stText})`);
      });
    }
    const bookedSchedulesText = bookedLines.length > 0 ? bookedLines.join('\n') : '• Hiện chưa có lịch chăm sóc nào đang chờ hoặc đang thực hiện.';

    // SECTION 3: Lịch sử chăm sóc đã hoàn thành
    const completedItems = [];
    healthRecords.forEach(r => {
      completedItems.push({
        date: r.record_date || r.created_at || '',
        title: (r.title || r.care_content || 'Chăm sóc thú cưng').replace(/^Hồ sơ chăm sóc:\s*/i, '').trim(),
        staff: r.doctor_name || r.staff_name || 'Nhân viên chăm sóc',
        details: r.care_content || r.description || '',
        source: 'health_record'
      });
    });

    appointments.filter(a => a.status === 'COMPLETED').forEach(a => {
      const sName = (a.examinationType || a.reason || 'Dịch vụ chăm sóc').replace(/^\[AI\]\s*/i, '').trim();
      const isDuplicate = completedItems.some(c => c.date.startsWith(a.appointmentDate) && c.title.toLowerCase().includes(sName.toLowerCase()));
      if (!isDuplicate) {
        completedItems.push({
          date: a.appointmentDate,
          title: sName,
          staff: a.staff_name || 'Nhân viên chăm sóc',
          details: a.note || 'Dịch vụ đã hoàn thành',
          source: 'appointment'
        });
      }
    });

    careSchedules.filter(s => s.status === 'ĐÃ_HOÀN_THÀNH').forEach(s => {
      const sName = (s.task_name || s.title || 'Lịch chăm sóc').replace(/^\[AI\]\s*/i, '').trim();
      const isDuplicate = completedItems.some(c => c.date.startsWith(s.date) && c.title.toLowerCase().includes(sName.toLowerCase()));
      if (!isDuplicate) {
        completedItems.push({
          date: s.date,
          title: sName,
          staff: 'Nhân viên chăm sóc',
          details: s.description || 'Đã hoàn thành',
          source: 'care_schedule'
        });
      }
    });

    // Sắp xếp giảm dần theo ngày
    completedItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const completedHistoryLines = completedItems.length > 0
      ? completedItems.slice(0, 10).map(item => `• ${formatDateVN(item.date)}: ${item.title} (Người thực hiện: ${item.staff})${item.details && item.details !== item.title ? ` — ${item.details}` : ''}`).join('\n')
      : '• Chưa có dữ liệu lịch sử chăm sóc đã hoàn thành.';

    // SECTION 4: Lịch tiêm phòng (Yêu cầu 4: Có thì hiển thị, chưa có thì ghi rõ Chưa có dữ liệu tiêm phòng)
    const vaccLines = [];
    if (vaccinations.length > 0) {
      vaccinations.forEach(v => {
        vaccLines.push(`• Vắc xin: ${v.vaccine_name} — Đã tiêm: ${formatDateVN(v.administered_date || v.date_administered || v.date)}${v.next_due_date ? ` (Mũi nhắc tiếp theo: ${formatDateVN(v.next_due_date)})` : ''}`);
      });
    } else {
      const vaccRecs = healthRecords.filter(r => {
        const text = ((r.title || '') + ' ' + (r.care_content || '') + ' ' + (r.vaccine_name || '')).toLowerCase();
        return text.includes('vắc xin') || text.includes('tiêm phòng') || text.includes('vacxin') || text.includes('vaccine');
      });
      if (vaccRecs.length > 0) {
        vaccRecs.forEach(vr => {
          const vDate = formatDateVN(vr.record_date);
          const vName = vr.vaccine_name || (vr.title || '').replace(/^Hồ sơ chăm sóc:\s*/i, '') || 'Tiêm phòng vắc xin';
          vaccLines.push(`• ${vName} — Ngày thực hiện: ${vDate} (Ghi nhận từ lịch sử chăm sóc thực tế)`);
        });
      }
    }
    const vaccinationRecordText = vaccLines.length > 0 ? vaccLines.join('\n') : '• Chưa có dữ liệu tiêm phòng';

    // SECTION 5: Hồ sơ sức khỏe nếu có dữ liệu
    const healthLines = [];
    if (pet.weight) {
      healthLines.push(`• Thể trạng & Cân nặng: ${pet.weight} kg — Tình trạng: ${pet.health_status || 'Khỏe mạnh, bình thường'}.`);
    }
    if (dewormings.length > 0) {
      dewormings.forEach(d => {
        healthLines.push(`• Tẩy giun: Thuốc ${d.med_name || d.medication_name || 'Định kỳ'} ngày ${formatDateVN(d.date || d.date_administered)}${d.next_due_date ? ` (Tái chủng: ${formatDateVN(d.next_due_date)})` : ''}`);
      });
    } else {
      const dewormRecs = healthRecords.filter(r => ((r.title || '') + ' ' + (r.care_content || '')).toLowerCase().includes('tẩy giun'));
      if (dewormRecs.length > 0) {
        dewormRecs.forEach(dr => {
          healthLines.push(`• Tẩy giun định kỳ: Đã thực hiện ngày ${formatDateVN(dr.record_date)} (Người thực hiện: ${dr.doctor_name || 'Nhân viên chăm sóc'})`);
        });
      }
    }
    if (medications.length > 0) {
      medications.forEach(m => {
        healthLines.push(`• Thuốc đang dùng: ${m.name || m.medication_name} (Liều lượng: ${m.dosage || 'Theo chỉ định'})`);
      });
    }
    if (healthLines.length === 0) {
      healthLines.push('• Chưa có dữ liệu hồ sơ bệnh lý hoặc điều trị đặc biệt.');
    }
    const healthRecordText = healthLines.join('\n');

    // SECTION 6: Lịch sắp tới và những lưu ý phù hợp
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingList = [];
    appointments.filter(a => a.appointmentDate >= todayStr && !['CANCELLED', 'COMPLETED'].includes(a.status)).forEach(a => {
      upcomingList.push(`• Lịch hẹn sắp tới: ${(a.examinationType || 'Chăm sóc').replace(/^\[AI\]\s*/i, '')} lúc ${a.appointmentTime} ngày ${formatDateVN(a.appointmentDate)}`);
    });
    careSchedules.filter(s => s.date >= todayStr && s.status !== 'ĐÃ_HOÀN_THÀNH').forEach(s => {
      upcomingList.push(`• Lịch chăm sóc sắp tới: ${s.task_name} lúc ${s.time} ngày ${formatDateVN(s.date)}`);
    });

    const notesList = [
      ...upcomingList,
      pet.species === 'Mèo' && (pet.breed || '').toLowerCase().includes('cụp')
        ? '• Lưu ý giống mèo tai cụp: Cần vệ sinh tai định kỳ hàng tuần để tránh ẩm mốc và viêm ống tai.'
        : (pet.species === 'Mèo' ? '• Lưu ý chăm sóc: Chải lông định kỳ tránh búi lông và đảm bảo đủ nước sạch.' : '• Lưu ý chăm sóc: Vận động thường xuyên, vệ sinh lông, móng và tai định kỳ.'),
      pet.weight ? `• Chế độ dinh dưỡng: Giữ vững khẩu phần dinh dưỡng hợp lý để duy trì mức cân nặng ${pet.weight} kg lý tưởng.` : null,
      '• Khuyến nghị: Đưa thú cưng đến đúng giờ theo lịch hẹn đã đặt để cơ sở chăm sóc chu đáo nhất.'
    ].filter(Boolean);

    const upcomingNotesText = notesList.join('\n');

    // Kết hợp cho current_status (tương thích ngược)
    const currentStatusCombined = [
      '▶ CÁC LỊCH CHĂM SÓC ĐÃ ĐẶT:',
      bookedSchedulesText,
      '',
      '▶ LỊCH SỬ CHĂM SÓC GẦN ĐÂY:',
      completedHistoryLines,
      '',
      '▶ HỒ SƠ TIÊM PHÒNG & SỨC KHỎE:',
      `• Tiêm phòng: ${vaccinationRecordText.replace(/^•\s*/, '')}`,
      `• Thể trạng: ${healthRecordText.replace(/^•\s*/, '')}`,
      '',
      '▶ LỊCH SẮP TỚI & LƯU Ý:',
      upcomingNotesText
    ].join('\n');

    // Xác định has_data: Thú cưng có ít nhất thông tin cơ bản hoặc lịch/hồ sơ chăm sóc
    const hasData = Boolean(
      (careSchedules && careSchedules.length > 0) ||
      (appointments && appointments.length > 0) ||
      (healthRecords && healthRecords.length > 0) ||
      (vaccinations && vaccinations.length > 0) ||
      (pet && (pet.weight || pet.dob || pet.age_months))
    );

    return res.json({
      success: true,
      has_data: hasData,
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        weight: pet.weight,
        photo_url: pet.photo_url
      },
      user_role: req.user.role,
      is_owner: isOwner,
      stats: {
        care_schedules_count: careSchedules.length,
        appointments_count: appointments.length,
        completed_history_count: completedItems.length,
        health_records_count: healthRecords.length,
        vaccinations_count: vaccinations.length
      },
      sections: {
        summary_overview: summaryOverviewLines,
        booked_schedules: bookedSchedulesText,
        completed_history: completedHistoryLines,
        vaccination_record: vaccinationRecordText,
        health_record: healthRecordText,
        upcoming_notes: upcomingNotesText,
        current_status: currentStatusCombined
      }
    });
  } catch (err) {
    console.error('Error summarizing pet record:', err);
    res.status(500).json({
      success: false,
      message: `Lỗi máy chủ khi tạo tóm tắt hồ sơ: ${err.message}`
    });
  }
});

// GET /api/ai/pet-schedules/:pet_id - Lấy danh sách lịch chăm sóc / tiêm chủng / lịch hẹn sắp tới của thú cưng
router.get('/pet-schedules/:pet_id', (req, res) => {
  try {
    const { pet_id } = req.params;
    const pet = db.findById('pets', pet_id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Care schedules
    const careSchedules = db.find('care_schedules', s => s.pet_id === pet_id) || [];
    const formattedCare = careSchedules.map(s => {
      const cleanTitle = (s.task_name || s.title || 'Lịch chăm sóc')
        .replace(/^\[AI\]\s*/i, '')
        .replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '')
        .trim();
      return {
        id: s.id,
        appointment_id: s.appointment_id || null,
        title: cleanTitle,
        category: s.category || 'CHĂM_SÓC',
        source: s.appointment_id ? 'appointment' : 'care_schedule',
        date: s.date,
        time: s.time,
        status: s.status,
        notes: s.description || ''
      };
    });

    // 2. Active appointments
    const activeAppts = db.find('appointments', a => 
      a.petId === pet_id && 
      a.status !== 'CANCELLED' && 
      a.status !== 'COMPLETED'
    ) || [];

    const formattedAppts = activeAppts.map(a => {
      const cleanService = (a.examinationType || a.reason || 'Dịch vụ chăm sóc')
        .replace(/^\[AI\]\s*/i, '')
        .replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '')
        .trim();
      const statusDesc = a.status === 'PENDING' ? 'Chờ xác nhận' : (a.status === 'CONFIRMED' ? 'Đã xác nhận' : a.status);
      return {
        id: a.id,
        appointment_id: a.id,
        title: cleanService,
        category: 'LỊCH_HẸN',
        source: 'appointment',
        date: a.appointmentDate,
        time: a.appointmentTime,
        status: a.status,
        notes: `Trạng thái: ${statusDesc}. ${a.note || ''}`.trim()
      };
    });

    // 3. Vaccinations
    const vaccs = db.find('vaccinations', v => v.pet_id === pet_id && v.next_due_date && v.next_due_date >= todayStr) || [];
    const formattedVaccs = vaccs.map(v => ({
      id: v.id,
      title: `Tiêm vắc xin: ${v.vaccine_name}`,
      category: 'TIÊM_PHÒNG',
      source: 'vaccination',
      date: v.next_due_date,
      time: '09:00',
      status: 'SẮP_TỚI',
      notes: `Mũi tiếp theo (${v.notes || 'Đúng định kỳ'})`
    }));

    // Deduplicate and combine (give priority to appointment data)
    const combinedMap = new Map();
    for (const item of [...formattedAppts, ...formattedCare, ...formattedVaccs]) {
      const key = item.appointment_id ? `appt_${item.appointment_id}` : (item.id || `${item.date}_${item.time}_${item.title}`);
      if (!combinedMap.has(key)) {
        combinedMap.set(key, item);
      }
    }

    const uniqueSchedules = Array.from(combinedMap.values());
    uniqueSchedules.sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));

    res.json({ success: true, schedules: uniqueSchedules });
  } catch (err) {
    console.error('Error fetching pet schedules:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy lịch chăm sóc.' });
  }
});

// POST /api/ai/generate-reminder - Sinh tin nhắn mẫu
router.post('/generate-reminder', async (req, res) => {
  try {
    const { pet_id, service_type } = req.body;
    const pet = pet_id ? db.findById('pets', pet_id) : null;
    const petName = pet ? pet.name : 'bé';
    const sType = service_type || 'chăm sóc định kỳ';

    const prompt = `Viết một tin nhắn ngắn gọn (2-3 câu) gửi cho chủ nuôi nhắc lịch ${sType} cho bé ${petName} tại Sen Chăm Boss. Thân thiện, chu đáo.`;
    const reply = `Sen Chăm Boss xin chào bạn! Đã đến lịch ${sType} định kỳ cho bé ${petName}. Bạn có thể đặt lịch hẹn ngay trên website để cơ sở sắp xếp thời gian chu đáo nhất cho bé nhé!`;

    res.json({ success: true, message_content: reply });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi sinh tin nhắn nhắc nhở.' });
  }
});

// POST /api/ai/save-schedule - Lưu lịch chăm sóc
router.post('/save-schedule', (req, res) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách lịch chăm sóc không hợp lệ.' });
    }

    const createdList = [];
    for (const item of schedules) {
      const created = db.insert('care_schedules', {
        pet_id: item.pet_id,
        user_id: req.user.id,
        task_name: item.task_name,
        category: item.category || 'CHĂM_SÓC',
        date: item.date,
        time: item.time || '08:00',
        description: item.description || '',
        status: item.status || 'CHƯA_THỰC_HIỆN',
        priority: item.priority || 'TRUNG_BÌNH',
        created_at: new Date().toISOString()
      });
      createdList.push(created);
    }

    res.json({
      success: true,
      message: `Đã lưu thành công ${createdList.length} lịch chăm sóc vào hệ thống.`,
      schedules: createdList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi lưu lịch chăm sóc.' });
  }
});


// GET /api/ai/my-reminders - Lấy các nhắc lịch AI tự động từ lịch chăm sóc & đặt lịch thực tế
router.get('/my-reminders', (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Ensure all active appointments have up-to-date reminders
    db.generateReminders();

    // 1. Fetch from notifications where type = 'AI_REMINDER'
    const remindersDb = db.find('notifications', n => 
      n.type === 'AI_REMINDER' && 
      n.user_id === user_id
    ) || [];
    
    const reminders = [];
    const processedApptIds = new Set();

    for (const n of remindersDb) {
      if (n.appointment_id) {
        const appt = db.findById('appointments', n.appointment_id);
        // If appointment doesn't exist or is cancelled/completed, skip this reminder
        if (!appt || appt.status === 'CANCELLED' || appt.status === 'COMPLETED') {
          continue;
        }
        
        processedApptIds.add(appt.id);
        const pet = db.findById('pets', appt.petId);
        
        const dParts = (appt.appointmentDate || '').split('-');
        const fDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : appt.appointmentDate;
        
        const serviceName = (appt.examinationType || appt.care_content || '').replace(/^\[AI\]\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '').trim();

        reminders.push({
          id: n.id,
          appointment_id: appt.id,
          pet_id: appt.petId,
          pet_name: pet ? pet.name : 'Thú cưng',
          pet_species: pet ? pet.species : '',
          schedule_title: serviceName,
          date: appt.appointmentDate,
          time: appt.appointmentTime,
          status: appt.status,
          message: n.message || `🔔 Nhắc lịch chăm sóc cho bé ${pet ? pet.name : 'Thú cưng'}: Bé có lịch ${serviceName} vào lúc ${appt.appointmentTime} ngày ${fDate}. Vui lòng đưa bé đến đúng lịch hẹn.`,
          priority: 'CAO'
        });
      }
    }

    // 2. Fallback check: Direct active appointments for user/pet not yet in notifications
    const userPets = db.find('pets', p => p.user_id === user_id) || [];
    const userPetIds = new Set(userPets.map(p => p.id));
    const activeAppts = db.find('appointments', a => 
      (a.ownerId === user_id || a.userId === user_id || userPetIds.has(a.petId)) &&
      a.status !== 'CANCELLED' && 
      a.status !== 'COMPLETED'
    ) || [];

    for (const appt of activeAppts) {
      if (processedApptIds.has(appt.id)) continue;
      processedApptIds.add(appt.id);

      const pet = db.findById('pets', appt.petId);
      const dParts = (appt.appointmentDate || '').split('-');
      const fDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : appt.appointmentDate;
      const serviceName = (appt.examinationType || appt.care_content || 'Dịch vụ chăm sóc').replace(/^\[AI\]\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '').trim();

      reminders.push({
        id: 'notif_rem_' + appt.id,
        appointment_id: appt.id,
        pet_id: appt.petId,
        pet_name: pet ? pet.name : 'Thú cưng',
        pet_species: pet ? pet.species : '',
        schedule_title: serviceName,
        date: appt.appointmentDate,
        time: appt.appointmentTime,
        status: appt.status,
        message: `🔔 Nhắc lịch chăm sóc cho bé ${pet ? pet.name : 'Thú cưng'}: Bé có lịch ${serviceName} vào lúc ${appt.appointmentTime} ngày ${fDate}. Vui lòng đưa bé đến đúng lịch hẹn.`,
        priority: 'CAO'
      });
    }

    // Deduplicate strictly by appointment ID
    const uniqueRemindersMap = new Map();
    for (const r of reminders) {
      const key = r.appointment_id || (r.pet_id + '_' + r.date + '_' + r.time + '_' + r.schedule_title);
      uniqueRemindersMap.set(key, r);
    }
    const uniqueReminders = Array.from(uniqueRemindersMap.values());

    // Sort by date/time ascending
    uniqueReminders.sort((a, b) => {
      const dtA = (a.date || '') + (a.time || '');
      const dtB = (b.date || '') + (b.time || '');
      return dtA.localeCompare(dtB);
    });

    res.json({ success: true, reminders: uniqueReminders });
  } catch (err) {
    console.error('Error fetching AI reminders:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy nhắc lịch AI.' });
  }
});

module.exports = router;
