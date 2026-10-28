const db = require('../config/database');


function checkAndGenerateNotifications(userId) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const nowTime = today.toTimeString().substring(0, 5); // "HH:MM"

  const pets = db.find('pets', p => p.user_id === userId);
  const petIds = pets.map(p => p.id);

  // 1. Care Schedules (Upcoming & Overdue)
  const schedules = db.find('care_schedules', s => s.user_id === userId);
  schedules.forEach(s => {
    if (s.status === 'ĐÃ_HOÀN_THÀNH') return;

    const pet = pets.find(p => p.id === s.pet_id);
    const petName = pet ? pet.name : '';

    if (s.date < todayStr || (s.date === todayStr && s.time < nowTime)) {
      // Overdue
      if (s.status !== 'QUÁ_HẠN') {
        db.update('care_schedules', s.id, { status: 'QUÁ_HẠN' });
      }
      createNotificationIfNotExists(userId, 'OVERDUE', s.id, `Lịch quá hạn: ${s.task_name}`, `Công việc "${s.task_name}" cho bé ${petName} đã quá hạn vào lúc ${s.time} ${s.date}.`);
    } else if (s.date === todayStr && s.time >= nowTime) {
      // Upcoming (today)
      createNotificationIfNotExists(userId, 'UPCOMING', s.id, `Lịch sắp đến: ${s.task_name}`, `Đừng quên công việc "${s.task_name}" cho bé ${petName} vào lúc ${s.time} hôm nay.`);
    }
  });

  // 2. Vaccines
  const vaccines = db.find('vaccinations', v => petIds.includes(v.pet_id));
  vaccines.forEach(v => {
    if (v.next_date) {
      const daysUntil = (new Date(v.next_date) - today) / (1000 * 60 * 60 * 24);
      const pet = pets.find(p => p.id === v.pet_id);
      const petName = pet ? pet.name : '';

      if (daysUntil < 0) {
        createNotificationIfNotExists(userId, 'VACCINE_OVERDUE', v.id, `Quá hạn tiêm vắc xin`, `Bé ${petName} đã quá hạn tiêm nhắc lại vắc xin "${v.vaccine_name}" (${v.next_date}).`);
      } else if (daysUntil <= 3) {
        createNotificationIfNotExists(userId, 'VACCINE_UPCOMING', v.id, `Sắp đến lịch tiêm vắc xin`, `Bé ${petName} cần tiêm nhắc lại vắc xin "${v.vaccine_name}" vào ngày ${v.next_date}.`);
      }
    }
  });

  // 3. Deworming
  const dewormings = db.find('dewormings', d => petIds.includes(d.pet_id));
  dewormings.forEach(d => {
    if (d.next_date) {
      const daysUntil = (new Date(d.next_date) - today) / (1000 * 60 * 60 * 24);
      const pet = pets.find(p => p.id === d.pet_id);
      const petName = pet ? pet.name : '';

      if (daysUntil < 0) {
        createNotificationIfNotExists(userId, 'DEWORM_OVERDUE', d.id, `Quá hạn tẩy giun`, `Bé ${petName} đã quá hạn lịch tẩy giun (${d.next_date}).`);
      } else if (daysUntil <= 3) {
        createNotificationIfNotExists(userId, 'DEWORM_UPCOMING', d.id, `Sắp đến lịch tẩy giun`, `Bé ${petName} cần tẩy giun vào ngày ${d.next_date}.`);
      }
    }
  });
}

function createNotificationIfNotExists(userId, type, referenceId, title, message) {
  const exists = db.find('notifications', n => n.user_id === userId && n.type === type && n.reference_id === referenceId);
  
  if (exists.length === 0) {
    db.insert('notifications', {
      id: 'notif_' + Date.now() + Math.random().toString(36).substring(2, 9),
      user_id: userId,
      type,
      reference_id: referenceId,
      title,
      message,
      is_read: false,
      created_at: new Date().toISOString()
    });
  }
}

module.exports = { checkAndGenerateNotifications };
