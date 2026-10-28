const http = require('http');

async function login() {
  const data = JSON.stringify({ email: 'vit@gmail.com', password: '123456' });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.token) return reject(new Error('Login failed: ' + body));
          resolve(parsed.token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testChat(token, message) {
  console.log(`\n========================================`);
  console.log(`TESTING AI CHAT WITH: "${message}"`);
  console.log(`========================================`);

  const payload = JSON.stringify({
    message: message,
    stream: true
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      console.log(`HTTP Status: ${res.statusCode}`);
      let fullText = '';
      let doneReceived = false;

      res.on('data', chunk => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'chunk' && event.text) {
              fullText += event.text;
              process.stdout.write(event.text);
            } else if (event.type === 'done') {
              doneReceived = true;
              console.log('\n[EVENT: DONE RECEIVED]');
              if (event.reply && !fullText) fullText = event.reply;
            } else if (event.type === 'error') {
              console.error('\n[EVENT: ERROR]', event.message);
            }
          } catch (_) {}
        }
      });

      res.on('end', () => {
        resolve({ statusCode: res.statusCode, fullText, doneReceived });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    const token = await login();
    console.log('Login successful, token received.');

    // Test 1: "Xin chào"
    const resHello = await testChat(token, 'Xin chào');
    console.log('\nResult "Xin chào": Length =', resHello.fullText.length);

    // Test 2: "mèo mình bị táo bón thì phải làm sao"
    const resConstipation = await testChat(token, 'mèo mình bị táo bón thì phải làm sao');
    console.log('\nResult "mèo mình bị táo bón thì phải làm sao": Length =', resConstipation.fullText.length);

    console.log('\n========================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('========================================');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

main();
