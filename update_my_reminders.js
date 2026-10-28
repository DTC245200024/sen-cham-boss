const fs = require('fs');

let content = fs.readFileSync('routes/aiRoutes.js', 'utf8');

// Replace the previous /my-reminders logic
content = content.replace(
  /router\.get\('\/my-reminders', \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, reminders \}\);\n  \} catch \(err\) \{/g,
  `router.get('/my-reminders', (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Fetch directly from notifications where type = 'AI_REMINDER' and status != CANCELLED/COMPLETED
    const remindersDb = db.find('notifications', n => 
      n.type === 'AI_REMINDER' && 
      n.user_id === user_id &&
      n.status !== 'CANCELLED' && 
      n.status !== 'COMPLETED'
    );
    
    const reminders = remindersDb.map(n => {
      const pet = db.findById('pets', n.pet_id);
      return {
        id: n.id,
        pet_id: n.pet_id,
        pet_name: pet ? pet.name : 'Thú cưng',
        pet_species: pet ? pet.species : '',
        schedule_title: n.service,
        date: n.date,
        time: n.time,
        status: n.status,
        message: n.message,
        priority: 'CAO'
      };
    });

    // Sort by date/time
    reminders.sort((a, b) => {
      const dtA = new Date(\`\${a.date}T\${a.time || '00:00'}\`);
      const dtB = new Date(\`\${b.date}T\${b.time || '00:00'}\`);
      return dtA - dtB;
    });

    res.json({ success: true, reminders });
  } catch (err) {`
);

fs.writeFileSync('routes/aiRoutes.js', content, 'utf8');
console.log('Modified routes/aiRoutes.js for /my-reminders');
