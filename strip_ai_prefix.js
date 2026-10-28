const fs = require('fs');
let content = fs.readFileSync('routes/aiRoutes.js', 'utf8');

content = content.replace(
  /schedule_title: s\.title \|\| s\.task_name,/g,
  `schedule_title: (s.title || s.task_name || '').replace(/^\\[AI\\]\\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\\/i>\\s*/i, ''),`
);

content = content.replace(
  /schedule_title: a\.examinationType \|\| a\.care_content,/g,
  `schedule_title: (a.examinationType || a.care_content || '').replace(/^\\[AI\\]\\s*/i, '').replace(/^<i class="fa-solid fa-robot"><\\/i>\\s*/i, ''),`
);

fs.writeFileSync('routes/aiRoutes.js', content, 'utf8');
console.log('Stripped [AI] prefix from titles');
