const db = require('./config/database');
const bcrypt = require('bcryptjs');

console.log('--- TESTING DIRECT BCRYPT LOGIN MATCHING ---');

const adminUser = db.findOne('users', u => u.email === 'quanly@petcare.com');
if (!adminUser) {
  console.error('❌ Admin user (quanly@petcare.com) not found!');
  process.exit(1);
}

const adminMatch = bcrypt.compareSync('123456', adminUser.password_hash);
console.log(`[ADMIN LOGIN TEST] Email: quanly@petcare.com, Password: 123456 -> Match: ${adminMatch}`);

const storeManager = db.findOne('users', u => u.email === 'quanlycuahang@petcare.com');
if (!storeManager) {
  console.error('❌ Store Manager user (quanlycuahang@petcare.com) not found!');
  process.exit(1);
}

const storeMatch = bcrypt.compareSync('123456', storeManager.password_hash);
console.log(`[STORE MANAGER LOGIN TEST] Email: quanlycuahang@petcare.com, Password: 123456 -> Match: ${storeMatch}`);

if (adminMatch && storeMatch) {
  console.log('✅ LOGIN VERIFICATION PASSED 100%!');
} else {
  console.error('❌ LOGIN MATCH FAILED!');
  process.exit(1);
}
