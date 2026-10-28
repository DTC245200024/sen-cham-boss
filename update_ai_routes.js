const fs = require('fs');

let content = fs.readFileSync('routes/aiRoutes.js', 'utf8');

// We will add a new endpoint GET /api/ai/my-reminders
const newEndpoint = `
// GET /api/ai/my-reminders - Lấy các nhắc lịch AI tự động từ lịch chăm sóc & đặt lịch thực tế
router.get('/my-reminders', (req, res) => {
  try {
    const user_id = req.user.id;
    const reminders = [];
    
    // 1. Fetch from care_schedules
    const schedules = db.find('care_schedules', s => s.user_id === user_id && s.status !== 'ĐÃ_HOÀN_THÀNH');
    for (const s of schedules) {
      if (s.status === 'ĐÃ_HỦY' || s.status === 'CANCELLED') continue;
      const pet = db.findById('pets', s.pet_id);
      if (!pet) continue;
      
      const timeStr = s.time ? \` lúc \${s.time}\` : '';
      const dateParts = s.date.split('-');
      const formattedDate = dateParts.length === 3 ? \`\${dateParts[2]}/\${dateParts[1]}/\${dateParts[0]}\` : s.date;
      
      reminders.push({
        id: s.id,
        pet_id: pet.id,
        pet_name: pet.name,
        pet_species: pet.species,
        schedule_title: s.title || s.task_name,
        category: s.category || 'CHĂM_SÓC',
        date: s.date,
        time: s.time || '',
        status: s.status,
        message: \`🔔 Nhắc lịch chăm sóc cho bé \${pet.name}: Bé có lịch \${s.title || s.task_name}\${timeStr} ngày \${formattedDate}. Chủ nuôi vui lòng sắp xếp thời gian đưa bé đến đúng lịch hẹn.\`,
        priority: s.priority || 'BÌNH THƯỜNG',
        source: 'care_schedule'
      });
    }

    // 2. Fetch from appointments
    const appointments = db.find('appointments', a => a.ownerId === user_id || a.userId === user_id);
    for (const a of appointments) {
      if (a.status === 'COMPLETED' || a.status === 'CANCELLED') continue;
      const pet = db.findById('pets', a.petId);
      if (!pet) continue;

      const timeStr = a.appointmentTime ? \` lúc \${a.appointmentTime}\` : '';
      const dateParts = (a.appointmentDate || '').split('-');
      const formattedDate = dateParts.length === 3 ? \`\${dateParts[2]}/\${dateParts[1]}/\${dateParts[0]}\` : a.appointmentDate;

      reminders.push({
        id: a.id,
        pet_id: pet.id,
        pet_name: pet.name,
        pet_species: pet.species,
        schedule_title: a.examinationType || a.care_content,
        category: 'DỊCH_VỤ',
        date: a.appointmentDate,
        time: a.appointmentTime || '',
        status: a.status,
        message: \`🔔 Nhắc lịch chăm sóc cho bé \${pet.name}: Bé có lịch \${a.examinationType || a.care_content}\${timeStr} ngày \${formattedDate}. Chủ nuôi vui lòng sắp xếp thời gian đưa bé đến đúng lịch hẹn.\`,
        priority: a.priority || 'CAO',
        source: 'appointment'
      });
    }

    // Sort by date/time
    reminders.sort((a, b) => {
      const dtA = new Date(\`\${a.date}T\${a.time || '00:00'}\`);
      const dtB = new Date(\`\${b.date}T\${b.time || '00:00'}\`);
      return dtA - dtB;
    });

    res.json({ success: true, reminders });
  } catch (err) {
    console.error('Error fetching AI reminders:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy nhắc lịch AI.' });
  }
});
`;

content = content.replace("module.exports = router;", newEndpoint + "\nmodule.exports = router;");

fs.writeFileSync('routes/aiRoutes.js', content, 'utf8');
console.log('Added /my-reminders endpoint to aiRoutes.js');
