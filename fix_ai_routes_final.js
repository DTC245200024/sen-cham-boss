const fs = require('fs');
let content = fs.readFileSync('routes/aiRoutes.js', 'utf8');

content = content.replace(
  /router\.get\('\/my-reminders', \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, reminders \}\);\n  \} catch \(err\) \{/g,
  `router.get('/my-reminders', (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Fetch directly from notifications where type = 'AI_REMINDER'
    const remindersDb = db.find('notifications', n => 
      n.type === 'AI_REMINDER' && 
      n.user_id === user_id
    );
    
    const reminders = [];

    for (const n of remindersDb) {
      if (n.appointment_id) {
        const appt = db.findById('appointments', n.appointment_id);
        // If appointment doesn't exist or is cancelled/completed, skip this reminder
        if (!appt || appt.status === 'CANCELLED' || appt.status === 'COMPLETED') {
          continue;
        }
        
        const pet = db.findById('pets', appt.petId);
        
        const dParts = (appt.appointmentDate || '').split('-');
        const fDate = dParts.length === 3 ? \`\${dParts[2]}/\${dParts[1]}/\${dParts[0]}\` : appt.appointmentDate;
        
        const serviceName = (appt.examinationType || appt.care_content || '').replace(/^\\[AI\\]\\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\\/i>\\s*/i, '');

        reminders.push({
          id: n.id,
          pet_id: appt.petId,
          pet_name: pet ? pet.name : 'Thú cưng',
          pet_species: pet ? pet.species : '',
          schedule_title: serviceName,
          date: appt.appointmentDate,
          time: appt.appointmentTime,
          status: appt.status,
          message: \`🔔 Nhắc lịch chăm sóc cho bé \${pet ? pet.name : 'Thú cưng'}: Bé có lịch \${serviceName} vào lúc \${appt.appointmentTime} ngày \${fDate}. Vui lòng đưa bé đến đúng lịch hẹn.\`,
          priority: 'CAO'
        });
      }
    }

    // Deduplicate (in case of overlap with 24h/1h reminders)
    const uniqueRemindersMap = new Map();
    for (const r of reminders) {
      const key = r.pet_id + '_' + r.date + '_' + r.time + '_' + r.schedule_title;
      uniqueRemindersMap.set(key, r);
    }
    const uniqueReminders = Array.from(uniqueRemindersMap.values());

    // Sort by date/time
    uniqueReminders.sort((a, b) => {
      const dtA = new Date(\`\${a.date}T\${a.time || '00:00'}\`);
      const dtB = new Date(\`\${b.date}T\${b.time || '00:00'}\`);
      return dtA - dtB;
    });

    res.json({ success: true, reminders: uniqueReminders });
  } catch (err) {`
);

fs.writeFileSync('routes/aiRoutes.js', content, 'utf8');
console.log('Final fix applied to /my-reminders in aiRoutes.js');
