const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { invalidateRAGCache } = require('../utils/ragEngine');

router.use(authenticateToken);

// Helper check pet access permission
function canAccessPet(user, petId) {
  const pet = db.findById('pets', petId);
  if (!pet) return false;
  if (['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(user.role)) return true;
  if (user.role === 'CARE_STAFF') {
    const staffApps = db.find('appointments', a => a.petId === petId && (a.staffId === user.id || a.staff_id === user.id)) || [];
    if (staffApps.length > 0) return true;
    const staffRecs = db.find('pet_health_records', r => r.pet_id === petId && (r.staff_id === user.id || r.doctor_name === user.full_name)) || [];
    return staffRecs.length > 0;
  }
  return pet.user_id === user.id;
}

// GET /api/health/all-summary - Get health summary for all accessible pets
router.get('/all-summary', (req, res) => {
  try {
    let pets = [];
    if (['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role)) {
      pets = db.find('pets', () => true);
    } else if (req.user.role === 'CARE_STAFF') {
      const staffApps = db.find('appointments', a => a.staffId === req.user.id || a.staff_id === req.user.id) || [];
      const assignedPetIds = new Set(staffApps.map(a => a.petId));
      pets = db.find('pets', p => assignedPetIds.has(p.id));
    } else {
      pets = db.find('pets', (p) => p.user_id === req.user.id);
    }

    const summaries = pets.map(pet => {
      // Get owner info
      const owner = db.findById('users', pet.user_id);
      pet.owner_name = owner ? owner.full_name : 'N/A';

      const records = db.find('pet_health_records', h => h.pet_id === pet.id);
      const vaccinations = db.find('vaccinations', v => v.pet_id === pet.id);
      const medications = db.find('medications', m => m.pet_id === pet.id);
      const dewormings = db.find('dewormings', d => d.pet_id === pet.id);

      records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
      vaccinations.sort((a, b) => new Date(b.administered_date) - new Date(a.administered_date));
      dewormings.sort((a, b) => new Date(b.date) - new Date(a.date));
      medications.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

      return {
        pet,
        latest_record: records.length > 0 ? records[0] : null,
        latest_vaccination: vaccinations.length > 0 ? vaccinations[0] : null,
        latest_deworming: dewormings.length > 0 ? dewormings[0] : null,
        current_medications: medications.filter(m => !m.end_date || new Date(m.end_date) >= new Date()),
        total_records: records.length,
        total_vaccinations: vaccinations.length,
        total_dewormings: dewormings.length
      };
    });

    return res.json({ success: true, summaries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy tổng quan sức khỏe.' });
  }
});

// GET /api/health/pet/:petId - Get full health records for a pet
router.get('/pet/:petId', (req, res) => {
  try {
    const { petId } = req.params;
    if (!canAccessPet(req.user, petId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem hồ sơ thú cưng này.' });
    }

    const pet = db.findById('pets', petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const records = db.find('pet_health_records', (h) => h.pet_id === petId);
    const vaccinations = db.find('vaccinations', (v) => v.pet_id === petId);
    const medications = db.find('medications', (m) => m.pet_id === petId);
    const dewormings = db.find('dewormings', (d) => d.pet_id === petId);

    // Sort timeline descending by date
    records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));

    // Aggregate weight history from all sources
    const weightMap = new Map();

    // 1. From pet.weight_history array if present
    if (pet && Array.isArray(pet.weight_history)) {
      pet.weight_history.forEach(item => {
        if (item && item.date && parseFloat(item.weight) > 0) {
          weightMap.set(`${item.date}_${item.weight}`, {
            date: item.date,
            weight: parseFloat(item.weight),
            note: item.note || 'Cập nhật từ hồ sơ thú cưng'
          });
        }
      });
    }

    // 2. From health records
    records.forEach((h) => {
      const w = parseFloat(h.weight);
      if (w > 0) {
        const d = (h.record_date || h.created_at || '').split('T')[0];
        if (d) {
          weightMap.set(`${d}_${w}`, {
            date: d,
            weight: w,
            note: h.title ? `Khám bệnh: ${h.title}` : 'Khám sức khỏe'
          });
        }
      }
    });

    // 3. From dewormings
    dewormings.forEach((dw) => {
      const w = parseFloat(dw.weight);
      if (w > 0) {
        const d = (dw.date || dw.created_at || '').split('T')[0];
        if (d) {
          weightMap.set(`${d}_${w}`, {
            date: d,
            weight: w,
            note: dw.med_name ? `Tẩy giun: ${dw.med_name}` : 'Tẩy giun'
          });
        }
      }
    });

    // 4. Ensure current pet.weight from pet profile is included if pet.weight > 0
    if (pet && parseFloat(pet.weight) > 0) {
      const currentW = parseFloat(pet.weight);
      const hasCurrent = Array.from(weightMap.values()).some(v => v.weight === currentW);
      if (!hasCurrent) {
        const pDate = (pet.updated_at || pet.created_at || pet.dob || new Date().toISOString()).split('T')[0];
        weightMap.set(`${pDate}_${currentW}`, {
          date: pDate,
          weight: currentW,
          note: 'Hồ sơ thú cưng'
        });
      }
    }

    const weightTimeline = Array.from(weightMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({
      success: true,
      pet,
      records,
      vaccinations,
      medications,
      dewormings,
      weightTimeline
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy hồ sơ sức khỏe.' });
  }
});

// POST /api/health - Add health record (Care Staff & Admin only)
router.post('/', (req, res) => {
  try {
    if (req.user.role === 'USER') {
      return res.status(403).json({ success: false, message: 'Chủ nuôi không có quyền ghi nhận hồ sơ chăm sóc.' });
    }
    if (req.user.role === 'RECEPTIONIST') {
      return res.status(403).json({ success: false, message: 'Lễ tân không có quyền ghi nhận hồ sơ chăm sóc thay Nhân viên chăm sóc.' });
    }

    const { pet_id, record_date, record_type, title, description, weight, doctor_name } = req.body;

    if (!pet_id || !title) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Thú cưng và nhập Tiêu đề/Dịch vụ.' });
    }

    if (!canAccessPet(req.user, pet_id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập thú cưng này.' });
    }

    const parsedWeight = parseFloat(weight) || 0;

    const newRecord = db.insert('pet_health_records', {
      ...req.body,
      pet_id,
      record_date: record_date || new Date().toISOString().split('T')[0],
      record_type: record_type || 'CHĂM_SÓC',
      title: title.trim(),
      description: description || '',
      care_content: req.body.care_content || description || '',
      condition_after: req.body.condition_after || req.body.notes || '',
      weight: parsedWeight,
      vaccine_name: (req.body.vaccine_name || '').trim(),
      vaccine_next_date: req.body.vaccine_next_date || '',
      deworm_name: (req.body.deworm_name || '').trim(),
      deworm_next_date: req.body.deworm_next_date || '',
      med_name: (req.body.med_name || '').trim(),
      med_dosage: (req.body.med_dosage || '').trim(),
      doctor_name: doctor_name ? doctor_name.trim() : (req.user.full_name || 'Nhân viên chăm sóc'),
      staff_name: req.user.full_name || 'Nhân viên chăm sóc',
      staff_id: req.user.id,
      id: undefined
    });

    // Update current pet weight and weight_history if provided
    if (parsedWeight > 0) {
      const pet = db.findById('pets', pet_id);
      if (pet) {
        const todayStr = (record_date || new Date().toISOString()).split('T')[0];
        const existingHistory = Array.isArray(pet.weight_history) ? [...pet.weight_history] : [];
        existingHistory.push({
          date: todayStr,
          weight: parsedWeight,
          note: title ? `Chăm sóc: ${title.trim()}` : 'Cân nặng'
        });
        db.update('pets', pet_id, {
          weight: parsedWeight,
          weight_history: existingHistory
        });
        invalidateRAGCache('pet');
      }
    }

    // Auto-sync into vaccinations table if vaccine_name is provided
    if (req.body.vaccine_name && req.body.vaccine_name.trim()) {
      db.insert('vaccinations', {
        pet_id,
        vaccine_name: req.body.vaccine_name.trim(),
        administered_date: record_date || new Date().toISOString().split('T')[0],
        next_due_date: req.body.vaccine_next_date || '',
        notes: `Ghi nhận trong hồ sơ chăm sóc: ${title.trim()}`,
        health_record_id: newRecord.id
      });
    }

    // Auto-sync into dewormings table if deworm_name is provided
    if (req.body.deworm_name && req.body.deworm_name.trim()) {
      db.insert('dewormings', {
        pet_id,
        med_name: req.body.deworm_name.trim(),
        date: record_date || new Date().toISOString().split('T')[0],
        next_due_date: req.body.deworm_next_date || '',
        status: 'Đã tẩy',
        notes: `Ghi nhận trong hồ sơ chăm sóc: ${title.trim()}`,
        health_record_id: newRecord.id
      });
    }

    // Auto-sync into medications table if med_name is provided
    if (req.body.med_name && req.body.med_name.trim()) {
      db.insert('medications', {
        pet_id,
        medicine_name: req.body.med_name.trim(),
        dosage: req.body.med_dosage || '',
        start_date: record_date || new Date().toISOString().split('T')[0],
        notes: `Ghi nhận trong hồ sơ chăm sóc: ${title.trim()}`,
        confirmed: true,
        health_record_id: newRecord.id
      });
    }

    invalidateRAGCache('health');
    return res.status(201).json({ success: true, message: 'Thêm hồ sơ chăm sóc mới thành công!', record: newRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm hồ sơ chăm sóc.' });
  }
});

// DELETE /api/health/:id - Delete health record (Care Staff & Admin only)
router.delete('/:id', (req, res) => {
  try {
    if (req.user.role === 'USER') {
      return res.status(403).json({ success: false, message: 'Chủ nuôi không có quyền xóa hồ sơ chăm sóc.' });
    }
    if (req.user.role === 'RECEPTIONIST') {
      return res.status(403).json({ success: false, message: 'Lễ tân không có quyền xóa hồ sơ chăm sóc.' });
    }

    const record = db.findById('pet_health_records', req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Hồ sơ chăm sóc không tồn tại.' });
    }

    if (!canAccessPet(req.user, record.pet_id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa hồ sơ này.' });
    }

    db.delete('pet_health_records', req.params.id);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Xóa hồ sơ chăm sóc thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa hồ sơ chăm sóc.' });
  }
});

// POST /api/health/weight - Record new weight measurement for pet
router.post('/weight', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp ghi nhận cân nặng nghiệp vụ của cửa hàng.' });
    }
    const { pet_id, weight, recorded_date, notes } = req.body;
    if (!pet_id || !weight) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Thú cưng và nhập Cân nặng (kg).' });
    }

    if (!canAccessPet(req.user, pet_id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật cân nặng cho thú cưng này.' });
    }

    const pet = db.findById('pets', pet_id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      return res.status(400).json({ success: false, message: 'Cân nặng phải là số dương hợp lệ.' });
    }

    const dateStr = recorded_date || new Date().toISOString().split('T')[0];
    const weightHistory = Array.isArray(pet.weight_history) ? [...pet.weight_history] : [];

    weightHistory.push({
      date: dateStr,
      weight: parsedWeight,
      note: notes || 'Ghi nhận cân nặng định kỳ'
    });

    db.update('pets', pet_id, {
      weight: parsedWeight,
      weight_history: weightHistory
    });

    invalidateRAGCache('pet');
    invalidateRAGCache('health');

    return res.status(201).json({
      success: true,
      message: `Đã ghi nhận cân nặng ${parsedWeight} kg cho bé ${pet.name}!`,
      weight: parsedWeight,
      date: dateStr,
      weightHistory
    });
  } catch (err) {
    console.error('Record weight error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi ghi nhận cân nặng.' });
  }
});

// DELETE /api/health/weight - Delete a weight record
router.delete('/weight', (req, res) => {
  try {
    const { pet_id, date, weight } = req.body;
    if (!pet_id || !date) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin để xóa bản ghi cân nặng.' });
    }

    if (!canAccessPet(req.user, pet_id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa thú cưng này.' });
    }

    const pet = db.findById('pets', pet_id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    let weightHistory = Array.isArray(pet.weight_history) ? [...pet.weight_history] : [];
    const initialLen = weightHistory.length;
    weightHistory = weightHistory.filter(w => !(w.date === date && (!weight || parseFloat(w.weight) === parseFloat(weight))));

    const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : pet.weight;

    db.update('pets', pet_id, {
      weight: latestWeight,
      weight_history: weightHistory
    });

    invalidateRAGCache('pet');
    invalidateRAGCache('health');

    return res.json({ success: true, message: 'Đã xóa bản ghi cân nặng thành công!', weightHistory });
  } catch (err) {
    console.error('Delete weight error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa bản ghi cân nặng.' });
  }
});

// POST /api/health/vaccination - Add vaccination record
router.post('/vaccination', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp ghi nhận tiêm phòng nghiệp vụ của cửa hàng.' });
    }
    const { pet_id, vaccine_name, next_due_date, notes, doctor_name } = req.body;
    // Accept date from either field name the frontend might send
    const administered_date = req.body.administered_date || req.body.date_administered || new Date().toISOString().split('T')[0];

    if (!pet_id || !vaccine_name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Thú cưng và Tên vắc xin.' });
    }

    if (!canAccessPet(req.user, pet_id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập thú cưng này.' });
    }

    const newVac = db.insert('vaccinations', {
      ...req.body,
      pet_id,
      vaccine_name: vaccine_name.trim(),
      administered_date,           // consistently store as administered_date
      date_administered: undefined, // clear alias
      next_due_date: next_due_date || '',
      notes: notes || '',
      id: undefined
    });

    // Also auto-add health record timeline
    db.insert('pet_health_records', {
      pet_id,
      record_date: administered_date,
      record_type: 'TIÊM_PHÒNG',
      title: `Tiêm vắc xin: ${vaccine_name}`,
      description: `Mũi tiêm ngày ${administered_date}. Lịch nhắc tiếp theo: ${next_due_date || 'Chưa đặt'}`,
      weight: 0,
      doctor_name: 'Phòng khám thú y'
    });

    invalidateRAGCache('health');

    return res.status(201).json({ success: true, message: 'Lưu lịch tiêm phòng thành công!', vaccination: newVac });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm lịch tiêm.' });
  }
});


// PUT /api/health/:id - Edit health record (Care Staff & Admin only)
router.put('/:id', (req, res) => {
  try {
    if (req.user.role === 'USER') {
      return res.status(403).json({ success: false, message: 'Chủ nuôi không có quyền chỉnh sửa hồ sơ chăm sóc.' });
    }
    if (req.user.role === 'RECEPTIONIST') {
      return res.status(403).json({ success: false, message: 'Lễ tân không có quyền chỉnh sửa hồ sơ chăm sóc thay Nhân viên chăm sóc.' });
    }

    const record = db.findById('pet_health_records', req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Hồ sơ chăm sóc không tồn tại.' });
    
    if (!canAccessPet(req.user, record.pet_id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập hồ sơ của thú cưng này.' });
    }

    const safeUpdate = { ...req.body };
    delete safeUpdate.pet_id; // Preserve original pet_id
    delete safeUpdate.id;     // Preserve original ID
    const updated = db.update('pet_health_records', req.params.id, {
      ...safeUpdate,
      updated_at: new Date().toISOString()
    });

    if (req.body.weight && parseFloat(req.body.weight) > 0) {
      db.update('pets', record.pet_id, { weight: parseFloat(req.body.weight) });
      invalidateRAGCache('pet');
    }

    // If record is linked to an appointment, synchronize notes & care content
    if (record.appointment_id) {
      db.update('appointments', record.appointment_id, {
        care_content: req.body.care_content || req.body.title || record.care_content || '',
        notes: req.body.notes !== undefined ? req.body.notes : (record.notes || ''),
        condition_result: req.body.condition_after !== undefined ? req.body.condition_after : (req.body.notes || record.condition_after || ''),
        condition_after: req.body.condition_after !== undefined ? req.body.condition_after : (record.condition_after || ''),
        updatedAt: new Date().toISOString()
      });
      invalidateRAGCache('appointment');
    }

    invalidateRAGCache('health');

    return res.json({ success: true, message: 'Cập nhật hồ sơ chăm sóc thành công.', record: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật hồ sơ chăm sóc.' });
  }
});


// PUT /api/health/vaccination/:id - Edit vaccination
router.put('/vaccination/:id', (req, res) => {
  try {
    const vac = db.findById('vaccinations', req.params.id);
    if (!vac) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, vac.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    const safeUpdate = { ...req.body };
    delete safeUpdate.pet_id; // Preserve original pet_id
    delete safeUpdate.id;
    const updated = db.update('vaccinations', req.params.id, safeUpdate);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Cập nhật vắc xin thành công.', vaccination: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// DELETE /api/health/vaccination/:id - Delete vaccination
router.delete('/vaccination/:id', (req, res) => {
  try {
    const vac = db.findById('vaccinations', req.params.id);
    if (!vac) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, vac.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    db.delete('vaccinations', req.params.id);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Xóa vắc xin thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// POST /api/health/deworming - Add deworming
router.post('/deworming', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp ghi nhận tẩy giun nghiệp vụ của cửa hàng.' });
    }
    const { pet_id, medicine_name, date, next_due_date, notes, doctor_name } = req.body;
    if (!pet_id || !date) return res.status(400).json({ success: false, message: 'Vui lòng nhập Thú cưng và Ngày tẩy.' });
    if (!canAccessPet(req.user, pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    const newDew = db.insert('dewormings', {
      ...req.body,
      pet_id,
      date: date.trim(),
      next_due_date: next_due_date || '',
      status: status || 'Đã tẩy',
      notes: notes || '',
      id: undefined
    });
    
    // Auto-add health record
    db.insert('pet_health_records', {
      pet_id,
      record_date: date,
      record_type: 'TẨY_GIUN',
      title: 'Tẩy giun định kỳ',
      description: `Lịch nhắc tiếp theo: ${next_due_date || 'Chưa đặt'}. Ghi chú: ${notes || ''}`,
      weight: 0,
      doctor_name: 'Người chăm sóc'
    });

    invalidateRAGCache('health');

    return res.status(201).json({ success: true, message: 'Lưu lịch tẩy giun thành công!', deworming: newDew });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// PUT /api/health/deworming/:id - Edit deworming
router.put('/deworming/:id', (req, res) => {
  try {
    const dew = db.findById('dewormings', req.params.id);
    if (!dew) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, dew.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    const safeUpdate = { ...req.body };
    delete safeUpdate.pet_id; // Preserve original pet_id
    delete safeUpdate.id;
    const updated = db.update('dewormings', req.params.id, safeUpdate);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Cập nhật thành công.', deworming: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// DELETE /api/health/deworming/:id - Delete deworming
router.delete('/deworming/:id', (req, res) => {
  try {
    const dew = db.findById('dewormings', req.params.id);
    if (!dew) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, dew.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    db.delete('dewormings', req.params.id);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Xóa tẩy giun thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// POST /api/health/medication - Add medication
router.post('/medication', (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Quản trị viên (ADMIN) không trực tiếp kê thuốc nghiệp vụ của cửa hàng.' });
    }
    const { pet_id, medicine_name, dosage, frequency, start_date, end_date, notes, doctor_name } = req.body;
    if (!pet_id || !medicine_name) return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    if (!canAccessPet(req.user, pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    const newMed = db.insert('medications', {
      ...req.body,
      pet_id,
      medicine_name: medicine_name.trim(),
      dosage: dosage || '',
      frequency: frequency || '',
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || '',
      notes: notes || '',
      confirmed: false,
      doctor_id: null,
      id: undefined
    });

    invalidateRAGCache('health');

    return res.status(201).json({ success: true, message: 'Thêm thuốc thành công!', medication: newMed });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// PUT /api/health/medication/:id - Edit medication
router.put('/medication/:id', (req, res) => {
  try {
    const med = db.findById('medications', req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, med.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    const safeUpdate = { ...req.body };
    delete safeUpdate.pet_id; // Preserve original pet_id
    delete safeUpdate.id;
    const updated = db.update('medications', req.params.id, safeUpdate);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Cập nhật thành công.', medication: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// DELETE /api/health/medication/:id - Delete medication
router.delete('/medication/:id', (req, res) => {
  try {
    const med = db.findById('medications', req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!canAccessPet(req.user, med.pet_id)) return res.status(403).json({ success: false, message: 'Không có quyền.' });

    db.delete('medications', req.params.id);
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Xóa thuốc thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// PATCH /api/health/medication/:id/confirm - Confirm medication (RECEPTIONIST/ADMIN only)
router.patch('/medication/:id/confirm', (req, res) => {
  try {
    const med = db.findById('medications', req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role) && req.user.role !== 'RECEPTIONIST') {
      return res.status(403).json({ success: false, message: 'Chỉ Lễ tân hoặc Quản trị viên mới có quyền xác nhận.' });
    }

    const updated = db.update('medications', req.params.id, {
      confirmed: true,
      staff_id: req.user.id,
      staff_name: req.user.full_name
    });
    invalidateRAGCache('health');
    return res.json({ success: true, message: 'Đã xác nhận thuốc thành công.', medication: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// GET /api/health/summarize-record/:pet_id - Alias to AI summary
router.get('/summarize-record/:pet_id', (req, res, next) => {
  req.url = `/summarize-record/${req.params.pet_id}`;
  const aiRoutes = require('./aiRoutes');
  return aiRoutes(req, res, next);
});

module.exports = router;
