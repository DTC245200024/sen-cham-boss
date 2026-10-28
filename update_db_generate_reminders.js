const fs = require('fs');

let content = fs.readFileSync('config/database.js', 'utf8');

content = content.replace(
  /generateReminders\(\) \{/,
  `generateReminders() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowMs = now.getTime();
    let added = false;

    // Appointment Reminders (24h and 1h before)
    this.data.appointments.forEach(a => {
      if (a.status === 'COMPLETED' || a.status === 'CANCELLED') return;
      if (!a.appointmentDate || !a.appointmentTime) return;
      
      const apptTimeMs = new Date(\`\${a.appointmentDate}T\${a.appointmentTime}:00\`).getTime();
      const diffMs = apptTimeMs - nowMs;
      
      if (diffMs > 0) {
        const diffHours = diffMs / (1000 * 60 * 60);
        let remindPrefix = null;
        let notifId = null;
        
        // Before 24h
        if (diffHours <= 24 && diffHours > 23) {
          remindPrefix = '24 giờ';
          notifId = 'notif_24h_' + a.id;
        } 
        // Before 1h
        else if (diffHours <= 1 && diffHours > 0) {
          remindPrefix = '1 giờ';
          notifId = 'notif_1h_' + a.id;
        }

        if (notifId) {
          const exists = this.data.notifications.find(n => n.id === notifId);
          if (!exists) {
            const pet = this.findById('pets', a.petId);
            const dParts = (a.appointmentDate || '').split('-');
            const fDate = dParts.length === 3 ? \`\${dParts[2]}/\${dParts[1]}/\${dParts[0]}\` : a.appointmentDate;
            this.data.notifications.unshift({
              id: notifId,
              user_id: a.ownerId || a.userId,
              title: '<i class="fa-solid fa-bell"></i> Nhắc lịch sắp tới',
              message: \`🔔 Nhắc lịch chăm sóc cho bé \${pet ? pet.name : 'Thú cưng'}: Bé có lịch \${a.examinationType} vào lúc \${a.appointmentTime} ngày \${fDate} (chỉ còn \${remindPrefix}). Vui lòng chuẩn bị đưa bé đến đúng lịch hẹn.\`,
              type: 'AI_REMINDER',
              reference_id: a.id,
              appointment_id: a.id,
              is_read: false,
              created_at: new Date().toISOString()
            });
            added = true;
          }
        }
      }
    });
`
);

fs.writeFileSync('config/database.js', content, 'utf8');
console.log('Modified config/database.js generateReminders');
