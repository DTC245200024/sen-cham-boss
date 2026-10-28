require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 3002;

function postLogin(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
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
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log(`--- TESTING HTTP API LOGIN AT http://localhost:${PORT}/api/auth/login ---`);

  // Test Admin Login
  const adminRes = await postLogin('quanly@petcare.com', '123456');
  console.log('[TEST ADMIN LOGIN]', adminRes);

  // Test Store Manager Login
  const storeRes = await postLogin('quanlycuahang@petcare.com', '123456');
  console.log('[TEST STORE MANAGER LOGIN]', storeRes);

  const adminSuccess = adminRes.body && adminRes.body.success && adminRes.body.user && adminRes.body.user.role === 'ADMIN';
  const storeSuccess = storeRes.body && storeRes.body.success && storeRes.body.user && storeRes.body.user.role === 'STORE_MANAGER';

  if (adminSuccess && storeSuccess) {
    console.log('✅ HTTP API LOGIN TESTS PASSED 100%! BOTH ADMIN AND STORE MANAGER LOGGED IN SUCCESSFULLY.');
  } else {
    console.error('❌ HTTP API LOGIN TEST FAILED.');
    process.exit(1);
  }
}

runTests();
