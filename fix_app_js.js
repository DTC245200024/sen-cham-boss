const fs = require('fs');

let content = fs.readFileSync('public/js/app.js', 'utf8');

content = content.replace(
  /else if \(n\.type && n\.type\.includes\('OVERDUE'\)\) \{ icon = 'fa-circle-exclamation'; iconColor = '#DC2626'; \}/g,
  `else if (n.type && n.type.includes('OVERDUE')) { icon = 'fa-circle-exclamation'; iconColor = '#DC2626'; }
          else if (n.type && n.type === 'AI_REMINDER') { icon = 'fa-robot'; iconColor = '#10B981'; }`
);

fs.writeFileSync('public/js/app.js', content, 'utf8');
console.log('Fixed icon mapping in public/js/app.js');
