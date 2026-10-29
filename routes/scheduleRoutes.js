const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { invalidateRAGCache } = require('../utils/ragEngine');

router.use(authenticateToken);

// Helper to check if schedule has not started yet
function isScheduleNotStarted(sch) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTimeStr = now.toTimeString().substring(0, 5);

  if (sch.status === 'ĐÃ_HOÀN_THÀNH') return false;
  if (sch.date > todayStr) return true;
  if (sch.date === todayStr && sch.time >= currentTimeStr) return true;
  return false;
}

// GET /api/schedules - List schedules with view range & filters
router.get('/', (req, res) => {
  try {
    const { view, pet_id, category, status, priority, search } = req.query;

    let schedules = [];
    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff) {
      // User views care schedules for their own pets
      schedules = db.find('care_schedules', (s) => s.user_id === req.user.id);
    } else {
      // Staff views all system care schedules
      schedules = db.find('care_schedules', () => true);
    }

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];
    const currentTimeStr = todayObj.toTimeString().substring(0, 5);

    // Helper calculate date ranges
    if (view === 'today') {
      schedules = schedules.filter((s) => s.date === todayStr);
    } else if (view === 'week') {
      const startOfWeek = new Date(todayObj);
      startOfWeek.setDate(todayObj.getDate() - todayObj.getDay() + 1); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      schedules = schedules.filter((s) => s.date >= startStr && s.date <= endStr);
    } else if (view === 'month') {
      const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
      schedules = schedules.filter((s) => s.date.startsWith(currentMonthStr));
    } else if (view === 'upcoming') {
      schedules = schedules.filter((s) => s.date >= todayStr && s.status !== 'ĐÃ_HOÀN_THÀNH');
    } else if (view === 'overdue') {
      schedules = schedules.filter((s) => s.status === 'QUÁ_HẠN');
    }

    // Filter Pet ID
    if (pet_id && pet_id !== 'ALL') {
      schedules = schedules.filter((s) => s.pet_id === pet_id);
    }

    // Filter Category
    if (category && category !== 'ALL') {
      schedules = schedules.filter((s) => s.category === category);
    }

    // Filter Status
    if (status && status !== 'ALL') {
      schedules = schedules.filter((s) => s.status === status);
    } else {
      // Loại bỏ lịch đã hủy khỏi danh sách hoạt động nếu không chỉ định lọc ĐÃ_HỦY
      schedules = schedules.filter((s) => s.status !== 'ĐÃ_HỦY' && s.status !== 'CANCELLED');
    }

    // Filter Priority
    if (priority && priority !== 'ALL') {
      schedules = schedules.filter((s) => s.priority === priority);
    }

    // Search query
    if (search) {
      const s = search.toLowerCase();
      schedules = schedules.filter(
        (item) => item.task_name.toLowerCase().includes(s) || (item.description && item.description.toLowerCase().includes(s))
      );
    }

    // Attach pet, owner & creator info + dynamic permission flags + appointment metadata
    schedules = schedules.map((item) => {
      const pet = db.findById('pets', item.pet_id);
      const owner = db.findById('users', item.user_id);
      const creator = item.created_by ? db.findById('users', item.created_by) : null;
      const linkedApp = item.appointment_id ? db.findById('appointments', item.appointment_id) : null;

      // Permission flags: Chỉ ADMIN mới có quyền sửa/xóa trực tiếp
      const can_toggle_complete = isStaff || (req.user.id === item.user_id);
      const can_edit = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);
      const can_delete = ['ADMIN', 'STORE_MANAGER'].includes(req.user.role);

      const appCode = linkedApp?.appointment_code || (item.appointment_id ? `#${item.appointment_id.slice(-4).toUpperCase()}` : `#SCH-${item.id ? item.id.slice(-4).toUpperCase() : '0000'}`);
      const isConfirmed = linkedApp 
        ? Boolean(linkedApp.receptionist_confirmed || linkedApp.confirmed || linkedApp.is_confirmed || ['CONFIRMED','ACCEPTED','IN_PROGRESS','COMPLETED'].includes(linkedApp.status))
        : (item.status === 'ĐÃ_HOÀN_THÀNH' || item.status === 'CHƯA_THỰC_HIỆN');
      
      const rawPayStatus = linkedApp ? (linkedApp.paymentStatus || linkedApp.payment_status) : (item.payment_status || item.paymentStatus);
      const isPaid = (rawPayStatus === 'DA_THANH_TOAN' || rawPayStatus === 'PAID' || rawPayStatus === 'ĐÃ_THANH_TOÁN');
      const paymentStatus = isPaid ? 'DA_THANH_TOAN' : 'CHO_XAC_NHAN';
      const paymentMethod = linkedApp ? (linkedApp.paymentMethod || 'TIEN_MAT') : (item.payment_method || 'TIEN_MAT');

      return {
        ...item,
        appointment_code: appCode,
        is_reception_confirmed: isConfirmed,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        pet_name: pet ? pet.name : 'N/A',
        pet_code: pet ? pet.pet_code : 'N/A',
        pet_species: pet ? pet.species : 'N/A',
        pet_photo: pet ? pet.photo_url : '',
        owner_name: owner ? owner.full_name : 'N/A',
        creator_name: creator ? creator.full_name : 'Hệ thống',
        can_toggle_complete,
        can_edit,
        can_delete
      };
    });

    // Sort order: date ascending, then time ascending
    schedules.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    return res.json({ success: true, count: schedules.length, schedules });
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch chăm sóc.' });
  }
});

// GET /api/schedules/:id - Get single schedule details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.findById('care_schedules', id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch chăm sóc.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && schedule.user_id !== req.user.id && schedule.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập lịch này.' });
    }

    const pet = db.findById('pets', schedule.pet_id);
    const owner = db.findById('users', schedule.user_id);
    const creator = schedule.created_by ? db.findById('users', schedule.created_by) : null;

    return res.json({
      success: true,
      schedule: {
        ...schedule,
        pet_name: pet ? pet.name : 'N/A',
        pet_code: pet ? pet.pet_code : 'N/A',
        pet_species: pet ? pet.species : 'N/A',
        owner_name: owner ? owner.full_name : 'N/A',
        creator_name: creator ? creator.full_name : 'Hệ thống'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết lịch.' });
  }
});


// POST /api/schedules - Create care schedule
router.post('/', (req, res) => {
  try {

    const { pet_id, task_name, category, date, time, description, priority } = req.body;

    if (!pet_id || !task_name || !date || !time) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Thú cưng, nhập Tên công việc, Ngày và Giờ.' });
    }

    const pet = db.findById('pets', pet_id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thú cưng.' });
    }

    if (req.user.role === 'USER' && pet.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ được tạo lịch chăm sóc cho thú cưng của mình.' });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().substring(0, 5);

    let status = 'CHƯA_THỰC_HIỆN';
    if (date < todayStr || (date === todayStr && time < currentTimeStr)) {
      status = 'QUÁ_HẠN';
    }

    const newSchedule = db.insert('care_schedules', {
      pet_id,
      user_id: pet.user_id,
      created_by: req.user.id,
      creator_role: req.user.role,
      creator_name: req.user.full_name || 'Hệ thống',
      task_name: task_name.trim(),
      category: category || 'KHÁC',
      date,
      time,
      description: description || '',
      priority: priority || 'TRUNG_BÌNH',
      status,
      execution_note: '',
      payment_method: null,
      payment_status: 'CHƯA_THANH_TOÁN'
    });

    // If created by Care Staff or Admin for an owner, notify owner
    if (req.user.role !== 'USER' && pet.user_id) {
      db.insert('notifications', {
        user_id: pet.user_id,
        title: '<i class="fa-solid fa-clipboard"></i> Lịch chăm sóc mới cho thú cưng',
        message: `Nhân viên ${req.user.full_name || ''} đã thêm lịch chăm sóc "${task_name.trim()}" cho bé ${pet.name} vào ngày ${date} lúc ${time}.`,
        type: 'UPCOMING',
        is_read: false
      });
    }

    // Làm mới cache RAG khi tạo lịch chăm sóc
    invalidateRAGCache('schedule');

    return res.status(201).json({ success: true, message: 'Tạo lịch chăm sóc thành công!', schedule: newSchedule });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo lịch chăm sóc.' });
  }
});

// PATCH /api/schedules/:id/toggle-complete - Mark complete/uncomplete
router.patch('/:id/toggle-complete', (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};
    const schedule = db.findById('care_schedules', id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch chăm sóc.' });
    }

    const isStaff = ['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(req.user.role);
    if (!isStaff && schedule.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật lịch này.' });
    }

    if (schedule.status === 'ĐÃ_HOÀN_THÀNH') {
      return res.status(400).json({ success: false, message: 'Lịch chăm sóc đã hoàn thành, không thể thay đổi trạng thái.' });
    }

    const newStatus = 'ĐÃ_HOÀN_THÀNH';
    const updateData = { status: newStatus };
    if (note !== undefined) updateData.execution_note = note;

    const updated = db.update('care_schedules', id, updateData);

    if (newStatus === 'ĐÃ_HOÀN_THÀNH') {
      const nowIso = new Date().toISOString();
      const existingHistory = db.findOne('care_schedule_history', h => h.schedule_id === id);
      if (!existingHistory) {
        db.insert('care_schedule_history', {
          schedule_id: id,
          pet_id: schedule.pet_id,
          completed_at: nowIso,
          completed_by: req.user.full_name || 'Người chăm sóc',
          task_name: schedule.task_name,
          content: schedule.description,
          execution_note: note || schedule.execution_note || ''
        });
      }

      // Đồng bộ lịch hẹn tương ứng nếu có
      if (schedule.appointment_id) {
        const linkedApp = db.findById('appointments', schedule.appointment_id);
        if (linkedApp && linkedApp.status !== 'COMPLETED') {
          db.update('appointments', linkedApp.id, {
            status: 'COMPLETED',
            completed_at: nowIso,
            completedAt: nowIso,
            completed_by: req.user.full_name,
            completed_by_id: req.user.id,
            care_content: schedule.task_name || linkedApp.examinationType || '',
            notes: note || linkedApp.notes || '',
            updatedAt: nowIso
          });

          const existingRec = db.findOne('pet_health_records', r => r.appointment_id === linkedApp.id);
          if (existingRec) {
            db.update('pet_health_records', existingRec.id, {
              status: 'COMPLETED',
              care_content: schedule.task_name || linkedApp.examinationType || '',
              notes: note || existingRec.notes || '',
              completed_at: nowIso,
              updated_at: nowIso
            });
          } else {
            db.insert('pet_health_records', {
              pet_id: linkedApp.petId || schedule.pet_id,
              appointment_id: linkedApp.id,
              record_date: linkedApp.appointmentDate || nowIso.split('T')[0],
              record_type: 'CHĂM_SÓC',
              title: `Hồ sơ chăm sóc: ${linkedApp.examinationType || schedule.task_name}`,
              description: schedule.description || schedule.task_name,
              care_content: schedule.task_name || linkedApp.examinationType,
              condition_before: 'Bình thường',
              condition_after: note || 'Bình thường',
              treatment: linkedApp.examinationType || schedule.task_name,
              doctor_name: req.user.full_name,
              staff_id: req.user.id,
              staff_name: req.user.full_name,
              completed_at: nowIso,
              notes: note || '',
              status: 'COMPLETED',
              created_at: nowIso,
              updated_at: nowIso
            });
          }
        }
      }
    }

    invalidateRAGCache('schedule');
    invalidateRAGCache('appointment');
    invalidateRAGCache('health');

    return res.json({
      success: true,
      message: `Đã đánh dấu "${schedule.task_name}" là ${newStatus === 'ĐÃ_HOÀN_THÀNH' ? 'Đã hoàn thành' : 'Chưa hoàn thành'}.`,
      schedule: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái lịch.' });
  }
});

// PUT /api/schedules/:id - Edit schedule (Chỉ ADMIN)
router.put('/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ Quản trị viên (ADMIN) mới có quyền chỉnh sửa lịch chăm sóc.' 
      });
    }

    const { id } = req.params;
    const schedule = db.findById('care_schedules', id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch chăm sóc.' });
    }

    if (schedule.status === 'ĐÃ_HOÀN_THÀNH') {
      return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa lịch chăm sóc đã hoàn thành.' });
    }

    const { pet_id, task_name, category, date, time, description, priority, execution_note } = req.body;

    const updates = {};
    if (pet_id) {
      updates.pet_id = pet_id;
      const pet = db.findById('pets', pet_id);
      if (pet && pet.user_id) updates.user_id = pet.user_id;
    }
    if (task_name) updates.task_name = task_name.trim();
    if (category) updates.category = category;
    if (date) updates.date = date;
    if (time) updates.time = time;
    if (description !== undefined) updates.description = description;
    if (priority) updates.priority = priority;
    if (execution_note !== undefined) updates.execution_note = execution_note;

    // Recalculate status if not completed
    if (schedule.status !== 'ĐÃ_HOÀN_THÀNH') {
      const targetDate = date || schedule.date;
      const targetTime = time || schedule.time;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeStr = now.toTimeString().substring(0, 5);

      if (targetDate < todayStr || (targetDate === todayStr && targetTime < currentTimeStr)) {
        updates.status = 'QUÁ_HẠN';
      } else {
        updates.status = 'CHƯA_THỰC_HIỆN';
      }
    }

    const updated = db.update('care_schedules', id, updates);
    invalidateRAGCache('schedule');

    return res.json({ success: true, message: 'Cập nhật lịch chăm sóc thành công!', schedule: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi chỉnh sửa lịch.' });
  }
});

// DELETE /api/schedules/:id - Delete schedule (Chỉ ADMIN)
router.delete('/:id', (req, res) => {
  try {
    if (!['ADMIN', 'STORE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa lịch chăm sóc.' 
      });
    }

    const { id } = req.params;
    const schedule = db.findById('care_schedules', id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch chăm sóc.' });
    }

    db.delete('care_schedules', id);
    invalidateRAGCache('schedule');
    return res.json({ success: true, message: 'Xóa lịch chăm sóc thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa lịch.' });
  }
});

// GET /api/schedules/history - List history
router.get('/history', (req, res) => {
  try {
    let history = [];
    if (req.user.role === 'USER') {
      const userPets = db.find('pets', (p) => p.user_id === req.user.id);
      const userPetIds = userPets.map(p => p.id);
      history = db.find('care_schedule_history', (h) => userPetIds.includes(h.pet_id));
    } else {
      history = db.find('care_schedule_history', () => true);
    }
    
    history = history.map(h => {
      const pet = db.findById('pets', h.pet_id);
      return { ...h, pet_name: pet ? pet.name : 'Đã xóa' };
    });

    history.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    return res.json({ success: true, count: history.length, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử.' });
  }
});

module.exports = router;
