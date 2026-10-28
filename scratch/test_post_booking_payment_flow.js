const http = require('http');

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3002,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: resBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING POST-BOOKING PAYMENT & INVOICE FLOW TESTS ===\n');

  // 1. Log in as USER
  console.log('1. Logging in as USER (customer)...');
  const userLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'user@petcare.vn',
    password: 'password123'
  });
  if (!userLogin.body.token) {
    console.error('USER login failed:', userLogin.body);
    process.exit(1);
  }
  const userToken = userLogin.body.token;
  const userId = userLogin.body.user.id;
  console.log('✅ USER logged in successfully. User ID:', userId);

  // Get user pets
  const petsRes = await makeRequest('GET', '/api/pets', null, userToken);
  const userPet = petsRes.body.pets && petsRes.body.pets[0];
  if (!userPet) {
    console.error('No pet found for USER!');
    process.exit(1);
  }
  console.log('Found pet:', userPet.name, 'ID:', userPet.id);

  // 2. USER books appointment with CHUYEN_KHOAN
  console.log('\n2. USER books appointment with payment method = CHUYEN_KHOAN...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const bookRes = await makeRequest('POST', '/api/appointments', {
    petId: userPet.id,
    appointmentDate: dateStr,
    appointmentTime: '14:30',
    examinationType: 'Tắm & Vệ sinh toàn diện',
    reason: 'Tắm thơm chuẩn bị đi chơi',
    paymentMethod: 'CHUYEN_KHOAN'
  }, userToken);

  console.log('Book appointment response:', bookRes.status, bookRes.body.message);
  if (!bookRes.body.success || !bookRes.body.appointment) {
    console.error('❌ Failed to book appointment:', bookRes.body);
    process.exit(1);
  }
  const appointment = bookRes.body.appointment;
  console.log('✅ Appointment created:', appointment.id);
  console.log('   - Status:', appointment.status, '(Expected: PENDING)');
  console.log('   - Payment Method:', appointment.paymentMethod, '(Expected: CHUYEN_KHOAN)');
  console.log('   - Payment Status:', appointment.paymentStatus, '(Expected: CHO_XAC_NHAN)');
  console.log('   - Estimated Price:', appointment.estimatedPrice);

  if (appointment.status !== 'PENDING' || appointment.paymentStatus !== 'CHO_XAC_NHAN') {
    console.error('❌ Status or paymentStatus incorrect!');
    process.exit(1);
  }

  // 3. Verify NO invoice exists for this appointment
  console.log('\n3. Checking invoices for USER (should NOT have invoice for this appointment yet)...');
  const userInvoices = await makeRequest('GET', '/api/invoices', null, userToken);
  const unconfirmedInv = (userInvoices.body.invoices || []).find(inv => inv.appointment_id === appointment.id);
  if (unconfirmedInv) {
    console.error('❌ Invoice should NOT exist yet before confirmation! Found:', unconfirmedInv);
    process.exit(1);
  } else {
    console.log('✅ Verified: No invoice created yet before Receptionist confirmation.');
  }

  // 4. Log in as RECEPTIONIST
  console.log('\n4. Logging in as RECEPTIONIST...');
  const recLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'receptionist@petcare.vn',
    password: 'password123'
  });
  if (!recLogin.body.token) {
    console.error('RECEPTIONIST login failed:', recLogin.body);
    process.exit(1);
  }
  const recToken = recLogin.body.token;
  console.log('✅ RECEPTIONIST logged in successfully.');

  // 5. RECEPTIONIST confirms appointment and payment
  console.log('\n5. RECEPTIONIST confirms appointment and payment...');
  const confirmRes = await makeRequest('PUT', `/api/appointments/${appointment.id}/confirm`, {}, recToken);
  console.log('Confirm response:', confirmRes.status, confirmRes.body.message);
  if (!confirmRes.body.success) {
    console.error('❌ Reception confirmation failed:', confirmRes.body);
    process.exit(1);
  }
  console.log('✅ Appointment confirmed successfully.');
  console.log('   - Updated status:', confirmRes.body.appointment.status, '(Expected: CONFIRMED)');
  console.log('   - Updated paymentStatus:', confirmRes.body.appointment.paymentStatus, '(Expected: PAID)');
  console.log('   - Generated Invoice Code:', confirmRes.body.invoiceCode);

  // 6. Verify invoice is now available to USER
  console.log('\n6. Checking invoices for USER (should now have the official PAID invoice)...');
  const updatedUserInvoices = await makeRequest('GET', '/api/invoices', null, userToken);
  const confirmedInv = (updatedUserInvoices.body.invoices || []).find(inv => inv.appointment_id === appointment.id);
  if (!confirmedInv) {
    console.error('❌ Invoice not found after confirmation!');
    process.exit(1);
  }
  console.log('✅ Official invoice found for USER:');
  console.log('   - Invoice Code:', confirmedInv.invoice_code);
  console.log('   - Service:', confirmedInv.service_name);
  console.log('   - Total Amount:', confirmedInv.total_amount);
  console.log('   - Status:', confirmedInv.status, '(Expected: PAID)');
  console.log('   - Payment Method:', confirmedInv.payment_method);

  // 7. Verify ADMIN is strictly blocked from viewing invoices & revenue
  console.log('\n7. Testing ADMIN restrictions on invoices & revenue...');
  const adminLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@petcare.vn',
    password: 'password123'
  });
  const adminToken = adminLogin.body.token;

  const adminInvoicesRes = await makeRequest('GET', '/api/invoices', null, adminToken);
  console.log('ADMIN GET /api/invoices status:', adminInvoicesRes.status, '(Expected: 403)');
  if (adminInvoicesRes.status !== 403) {
    console.error('❌ ADMIN was not blocked from /api/invoices!');
    process.exit(1);
  }
  console.log('✅ ADMIN successfully blocked from invoices (403 Forbidden).');

  const adminRevenueRes = await makeRequest('GET', '/api/revenue', null, adminToken);
  console.log('ADMIN GET /api/revenue status:', adminRevenueRes.status, '(Expected: 403)');
  if (adminRevenueRes.status !== 403) {
    console.error('❌ ADMIN was not blocked from /api/revenue!');
    process.exit(1);
  }
  console.log('✅ ADMIN successfully blocked from revenue (403 Forbidden).');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
