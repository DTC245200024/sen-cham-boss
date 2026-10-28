const fs = require('fs');

let content = fs.readFileSync('public/index.html', 'utf8');

// Find the button and add style="display:none;"
content = content.replace(
  /<button id="open-ai-gen-modal-btn" class="btn btn-secondary" style="background:linear-gradient\(135deg, #10b981, #06b6d4\);">/g,
  `<button id="open-ai-gen-modal-btn" class="btn btn-secondary" style="display:none; background:linear-gradient(135deg, #10b981, #06b6d4);">`
);

fs.writeFileSync('public/index.html', content, 'utf8');
console.log('Hid AI Gen Modal button in index.html');
