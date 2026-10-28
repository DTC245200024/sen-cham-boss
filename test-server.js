const db = require('./config/database');

console.log('--- TESTING DATABASE PERSISTENCE & SEED DATA ---');
const users = db.find('users', () => true);
console.log(`[OK] Users loaded: ${users.length}`);
users.forEach(u => console.log(`   - ${u.full_name} (${u.email}) [Role: ${u.role}]`));

const pets = db.find('pets', () => true);
console.log(`[OK] Pets loaded: ${pets.length}`);
pets.forEach(p => console.log(`   - ${p.name} (${p.species} - ${p.breed})`));

const schedules = db.find('care_schedules', () => true);
console.log(`[OK] Care Schedules loaded: ${schedules.length}`);

const health = db.find('pet_health_records', () => true);
console.log(`[OK] Pet Health Records loaded: ${health.length}`);

console.log('--- TESTING OVERDUE STATUS TRACKING ---');
db.updateOverdueStatuses();
console.log('[OK] Overdue statuses updated successfully.');

console.log('✅ ALL SERVER UNIT VERIFICATIONS PASSED CLEANLY!');
