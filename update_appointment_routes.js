const fs = require('fs');

let content = fs.readFileSync('routes/appointmentRoutes.js', 'utf8');

// Inside POST /
content = content.replace(
  /const saved = db\.insert\('appointments', newApp\);/g,
  `const saved = db.insert('appointments', newApp);

    // AI REMINDER REQUIREMENT
    const reminderDateParts = appointmentDate.split('-');
    const formattedReminderDate = reminderDateParts.length === 3 ? \`\${reminderDateParts[2]}/\${reminderDateParts[1]}/\${reminderDateParts[0]}\` : appointmentDate;
    const reminderMsg = \`🔔 Nhắc lịch chăm sóc cho bé \${pet.name}: Bé có lịch \${examinationType} vào lúc \${appointmentTime} ngày \${formattedReminderDate}. Vui lòng đưa bé đến đúng lịch hẹn.\`;
    
    db.insert('notifications', {
      user_id: targetUserId,
      title: '<i class="fa-solid fa-robot"></i> Nhắc Lịch AI',
      message: reminderMsg,
      type: 'AI_REMINDER',
      reference_id: saved.id,
      appointment_id: saved.id,
      pet_id: petId,
      owner_id: targetUserId,
      service: examinationType,
      date: appointmentDate,
      time: appointmentTime,
      is_read: false,
      status: 'PENDING'
    });
`
);

// We need to find the update endpoint for appointments
// `router.put('/:id', `
content = content.replace(
  /Object\.assign\(appointment, updates, { updatedAt: new Date\(\)\.toISOString\(\) }\);[\s\S]*?db\.save\(\);/,
  `Object.assign(appointment, updates, { updatedAt: new Date().toISOString() });
    db.save();

    // UPDATE AI REMINDER
    const reminder = db.find('notifications', n => n.type === 'AI_REMINDER' && n.appointment_id === id)[0];
    if (reminder) {
      const pet = db.findById('pets', appointment.petId);
      if (pet) {
        const dParts = (appointment.appointmentDate || '').split('-');
        const fDate = dParts.length === 3 ? \`\${dParts[2]}/\${dParts[1]}/\${dParts[0]}\` : appointment.appointmentDate;
        reminder.message = \`🔔 Nhắc lịch chăm sóc cho bé \${pet.name}: Bé có lịch \${appointment.examinationType} vào lúc \${appointment.appointmentTime} ngày \${fDate}. Vui lòng đưa bé đến đúng lịch hẹn.\`;
        reminder.date = appointment.appointmentDate;
        reminder.time = appointment.appointmentTime;
        reminder.service = appointment.examinationType;
        reminder.pet_id = appointment.petId;
        reminder.is_read = false;
        db.save();
      }
    }
`
);

// Find cancel endpoint logic to cancel reminder
// Search for `appointment.status = 'CANCELLED';` or similar
content = content.replace(
  /appointment\.status = 'CANCELLED';[\s\S]*?db\.save\(\);/g,
  `appointment.status = 'CANCELLED';
    db.save();
    
    // CANCEL AI REMINDER
    const reminder = db.find('notifications', n => n.type === 'AI_REMINDER' && n.appointment_id === appointment.id)[0];
    if (reminder) {
      reminder.status = 'CANCELLED';
      reminder.is_read = true;
      db.save();
    }
`
);

// Complete endpoint logic to mark reminder as completed
content = content.replace(
  /appointment\.status = 'COMPLETED';[\s\S]*?db\.save\(\);/g,
  `appointment.status = 'COMPLETED';
    db.save();
    
    // COMPLETE AI REMINDER
    const reminder = db.find('notifications', n => n.type === 'AI_REMINDER' && n.appointment_id === appointment.id)[0];
    if (reminder) {
      reminder.status = 'COMPLETED';
      reminder.is_read = true;
      db.save();
    }
`
);

fs.writeFileSync('routes/appointmentRoutes.js', content, 'utf8');
console.log('Modified routes/appointmentRoutes.js');
