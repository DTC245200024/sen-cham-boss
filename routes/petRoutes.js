const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { invalidateRAGCache } = require('../utils/ragEngine');

router.use(authenticateToken);

// Helper function calculate age in months from DOB
function calculateAgeMonths(dobStr) {
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  const now = new Date();
  const years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth();
  return Math.max(0, years * 12 + months);
}

// GET /api/pets - List pets (USER sees own pets; CARE_STAFF sees assigned pets; ADMIN/RECEPTIONIST sees all with filters)
router.get('/', (req, res) => {
  try {
    const { species, owner_id, search } = req.query;
    let pets = [];
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);

    if (isStaff) {
      pets = db.find('pets', () => true);
    } else if (req.user.role === 'CARE_STAFF') {
      const staffApps = db.find('appointments', a => a.staffId === req.user.id || a.staff_id === req.user.id) || [];
      const assignedPetIds = new Set(staffApps.map(a => a.petId));
      pets = db.find('pets', p => assignedPetIds.has(p.id));
    } else {
      pets = db.find('pets', (p) => p.user_id === req.user.id);
    }

    // Attach owner information
    pets = pets.map((p) => {
      const owner = db.findById('users', p.user_id);
      return {
        ...p,
        owner_name: owner ? owner.full_name : 'N/A',
        owner_email: owner ? owner.email : 'N/A'
      };
    });

    // Apply Filter Species
    if (species && species !== 'ALL') {
      if (species === 'Khác') {
        pets = pets.filter((p) => p.species !== 'Chó' && p.species !== 'Mèo');
      } else {
        pets = pets.filter((p) => p.species === species);
      }
    }

    // Apply Filter Owner ID (Admin / Receptionist)
    if (owner_id) {
      pets = pets.filter((p) => p.user_id === owner_id);
    }

    // Apply Search
    if (search) {
      const s = search.toLowerCase();
      pets = pets.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.pet_code.toLowerCase().includes(s) ||
          p.breed.toLowerCase().includes(s) ||
          p.owner_name.toLowerCase().includes(s)
      );
    }

    return res.json({ success: true, count: pets.length, pets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách thú cưng.' });
  }
});

// GET /api/pets/:id - Get single pet detail
router.get('/:id', (req, res) => {
  try {
    const pet = db.findById('pets', req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập thú cưng này.' });
    }

    const owner = db.findById('users', pet.user_id);
    const healthRecords = db.find('pet_health_records', (h) => h.pet_id === pet.id);
    const vaccinations = db.find('vaccinations', (v) => v.pet_id === pet.id);
    const medications = db.find('medications', (m) => m.pet_id === pet.id);
    const schedules = db.find('care_schedules', (s) => s.pet_id === pet.id);

    return res.json({
      success: true,
      pet: {
        ...pet,
        owner_name: owner ? owner.full_name : 'N/A',
        owner_email: owner ? owner.email : 'N/A',
        healthRecords,
        vaccinations,
        medications,
        schedules
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết thú cưng.' });
  }
});

// GET /api/pets/:id/profile - Alias to full pet profile & health records
router.get('/:id/profile', (req, res) => {
  try {
    const pet = db.findById('pets', req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập thú cưng này.' });
    }

    const owner = db.findById('users', pet.user_id);
    const records = db.find('pet_health_records', (h) => h.pet_id === pet.id);
    const vaccinations = db.find('vaccinations', (v) => v.pet_id === pet.id);
    const medications = db.find('medications', (m) => m.pet_id === pet.id);
    const dewormings = db.find('dewormings', (d) => d.pet_id === pet.id);
    const schedules = db.find('care_schedules', (s) => s.pet_id === pet.id);

    // Build unified weightTimeline
    const weightMap = new Map();
    if (Array.isArray(pet.weight_history)) {
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

    if (parseFloat(pet.weight) > 0) {
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

    const weightTimeline = Array.from(weightMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({
      success: true,
      pet: {
        ...pet,
        owner_name: owner ? owner.full_name : 'N/A',
        owner_email: owner ? owner.email : 'N/A'
      },
      records,
      vaccinations,
      medications,
      dewormings,
      schedules,
      weightTimeline
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy hồ sơ thú cưng.' });
  }
});

// GET /api/pets/:id/weights - Get weight history of a pet
router.get('/:id/weights', (req, res) => {
  try {
    const pet = db.findById('pets', req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem cân nặng của thú cưng này.' });
    }

    const weightMap = new Map();
    if (Array.isArray(pet.weight_history)) {
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

    if (parseFloat(pet.weight) > 0) {
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

    const weightTimeline = Array.from(weightMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    return res.json({ success: true, pet_id: pet.id, current_weight: pet.weight, weightTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy cân nặng thú cưng.' });
  }
});

// POST /api/pets/:id/weights - Add weight record to pet
router.post('/:id/weights', (req, res) => {
  try {
    const pet = db.findById('pets', req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật cân nặng của thú cưng này.' });
    }

    const { weight, recorded_date, notes } = req.body;
    const newWeight = parseFloat(weight);
    if (!newWeight || newWeight <= 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số cân nặng hợp lệ (> 0 kg).' });
    }

    const dateStr = recorded_date || new Date().toISOString().split('T')[0];
    let history = Array.isArray(pet.weight_history) ? [...pet.weight_history] : [];
    
    // Seed initial history if empty
    if (history.length === 0 && pet.weight && pet.weight > 0 && pet.weight !== newWeight) {
      const initDate = (pet.created_at || pet.dob || dateStr).split('T')[0];
      history.push({
        date: initDate,
        weight: Number(pet.weight),
        note: 'Hồ sơ thú cưng ban đầu'
      });
    }

    const existingIdx = history.findIndex(h => h.date === dateStr);
    if (existingIdx >= 0) {
      history[existingIdx].weight = newWeight;
      history[existingIdx].note = notes || 'Cập nhật cân nặng';
    } else {
      history.push({
        date: dateStr,
        weight: newWeight,
        note: notes || 'Ghi nhận cân nặng mới'
      });
    }

    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Update pet with newest weight if date is today or newest
    const latestEntry = history[history.length - 1];
    const updatedPet = db.update('pets', pet.id, {
      weight: latestEntry.weight,
      weight_history: history
    });

    invalidateRAGCache('pet');
    invalidateRAGCache('health');

    return res.json({
      success: true,
      message: 'Ghi nhận cân nặng thành công!',
      pet: updatedPet,
      weightTimeline: history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm cân nặng.' });
  }
});

// POST /api/pets - Add new pet
router.post('/', (req, res) => {
  try {
    if (req.user.role === 'CARE_STAFF') {
      return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc không có quyền tạo thông tin thú cưng.' });
    }

    const { name, species, breed, gender, dob, weight, fur_color, photo_url, health_status, notes, user_id } = req.body;

    if (!name || !species) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên và Loài thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    const targetUserId = (isStaff && user_id) ? user_id : req.user.id;

    const count = db.find('pets', () => true).length + 1;
    const speciesCode = species === 'Chó' ? 'CH' : species === 'Mèo' ? 'MC' : 'KH';
    const pet_code = `PET-${speciesCode}-${String(count).padStart(3, '0')}`;

    const age_months = calculateAgeMonths(dob);

    const defaultPhoto =
      species === 'Mèo'
        ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80'
        : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

    const initialWeight = parseFloat(weight) || 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const initialWeightHistory = initialWeight > 0 ? [{
      date: todayStr,
      weight: initialWeight,
      note: 'Khởi tạo hồ sơ thú cưng'
    }] : [];

    const newPet = db.insert('pets', {
      user_id: targetUserId,
      pet_code,
      name: name.trim(),
      species,
      breed: breed ? breed.trim() : 'Không rõ',
      gender: gender || 'Đực',
      dob: dob || '',
      age_months,
      weight: initialWeight,
      weight_history: initialWeightHistory,
      fur_color: fur_color ? fur_color.trim() : '',
      photo_url: photo_url || defaultPhoto,
      health_status: health_status || 'Khỏe mạnh',
      notes: notes || ''
    });

    invalidateRAGCache('pet');

    return res.status(201).json({ success: true, message: 'Thêm thú cưng mới thành công!', pet: newPet });
  } catch (err) {
    console.error('Create pet error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm thú cưng.' });
  }
});

// PUT /api/pets/:id - Update pet
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const pet = db.findById('pets', id);

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa thú cưng này.' });
    }

    const { name, species, breed, gender, dob, weight, fur_color, photo_url, health_status, notes, user_id } = req.body;

    const updates = {};
    if (name) updates.name = name.trim();
    if (species) updates.species = species;
    if (breed !== undefined) updates.breed = breed.trim();
    if (gender) updates.gender = gender;
    if (dob !== undefined) {
      updates.dob = dob;
      updates.age_months = calculateAgeMonths(dob);
    }
    if (isStaff && user_id) {
      updates.user_id = user_id;
    }
    if (weight !== undefined) {
      const newWeight = parseFloat(weight) || 0;
      updates.weight = newWeight;

      if (newWeight > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        let history = Array.isArray(pet.weight_history) ? [...pet.weight_history] : [];
        
        // If history is empty and pet already had a weight, seed initial weight
        if (history.length === 0 && pet.weight && pet.weight > 0 && pet.weight !== newWeight) {
          const initDate = (pet.created_at || pet.dob || todayStr).split('T')[0];
          history.push({
            date: initDate,
            weight: Number(pet.weight),
            note: 'Hồ sơ thú cưng ban đầu'
          });
        }

        const lastEntry = history[history.length - 1];
        if (lastEntry && lastEntry.date === todayStr) {
          lastEntry.weight = newWeight;
          lastEntry.note = 'Cập nhật từ hồ sơ thú cưng';
        } else {
          history.push({
            date: todayStr,
            weight: newWeight,
            note: 'Cập nhật từ hồ sơ thú cưng'
          });
        }
        updates.weight_history = history;
      }
    }
    if (fur_color !== undefined) updates.fur_color = fur_color.trim();
    if (photo_url !== undefined) updates.photo_url = photo_url;
    if (health_status !== undefined) updates.health_status = health_status;
    if (notes !== undefined) updates.notes = notes;

    const updatedPet = db.update('pets', id, updates);
    invalidateRAGCache('pet');

    return res.json({ success: true, message: 'Cập nhật thông tin thú cưng thành công!', pet: updatedPet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thú cưng.' });
  }
});

// DELETE /api/pets/:id - Delete pet
router.delete('/:id', (req, res) => {
  try {
    if (req.user.role === 'CARE_STAFF') {
      return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc không có quyền xóa thú cưng.' });
    }

    const { id } = req.params;
    const pet = db.findById('pets', id);

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa thú cưng này.' });
    }

    db.delete('pets', id);
    // Cascade delete health records, care schedules, vaccinations, dewormings, medications
    db.find('pet_health_records', (h) => h.pet_id === id).forEach((h) => db.delete('pet_health_records', h.id));
    db.find('care_schedules', (s) => s.pet_id === id).forEach((s) => db.delete('care_schedules', s.id));
    db.find('vaccinations', (v) => v.pet_id === id).forEach((v) => db.delete('vaccinations', v.id));
    db.find('dewormings', (d) => d.pet_id === id).forEach((d) => db.delete('dewormings', d.id));
    db.find('medications', (m) => m.pet_id === id).forEach((m) => db.delete('medications', m.id));

    invalidateRAGCache('pet');
    invalidateRAGCache('health');
    invalidateRAGCache('schedule');
    invalidateRAGCache('appointment');

    return res.json({ success: true, message: 'Xóa thú cưng thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa thú cưng.' });
  }
});

module.exports = router;
