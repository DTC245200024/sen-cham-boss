const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');


const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB Structure
const initialData = {
  users: [],
  pets: [],
  pet_health_records: [],
  vaccinations: [],
  medications: [],
  dewormings: [],
  care_schedules: [],
  notifications: [],
  care_schedule_history: [],
  products: [],
  orders: [],
  adoptions: [],
  store_config: [],
  vouchers: [],
  voucher_usages: [],
  payments: [],
  saved_addresses: [],
  appointments: [],
  services: [],
  service_packages: [],
  invoices: [],
  conversations: [],
  messages: []
};

// Database Memory Storage with Persistence
class Database {
  constructor() {
    this.data = initialData;
    this.saveTimeout = null;
    this.isWriting = false;
    this.pendingWrite = false;
    this.load();
    this.seedDefaults();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileData = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(fileData);
        // Backward compatibility for all entity tables
        Object.keys(initialData).forEach(key => {
          if (!parsed[key]) parsed[key] = [];
        });
        this.data = { ...initialData, ...parsed };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database:', err);
      this.data = initialData;
    }
  }

  save() {
    this.saveSync();
  }

  saveSync() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      const jsonStr = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_FILE, jsonStr, 'utf8');
    } catch (err) {
      console.error('Error saving database synchronously:', err);
    }
  }

  async doWrite() {
    this.saveSync();
  }

  seedDefaults() {
    // If DB is already initialized with users, never re-seed or override user data!
    if (this.data._initialized && this.data.users && this.data.users.length > 0) {
      return;
    }

    let changed = false;
    if (!this.data.users) this.data.users = [];

    // Helper to ensure role user exists on initial setup
    const ensureUser = (email, fullName, role, defaultPass) => {
      let existing = this.data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (!existing) {
        this.data.users.push({
          id: `usr_${role.toLowerCase()}_default_${Date.now().toString(36)}`,
          full_name: fullName,
          email: email.toLowerCase(),
          password_hash: bcrypt.hashSync(defaultPass, 10),
          role: role,
          status: 'ACTIVE',
          phone: '0987654321',
          address: 'Hà Nội',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fullName)}`,
          created_at: new Date().toISOString()
        });
        changed = true;
      }
    };

    // Ensure system roles on clean initial DB
    ensureUser('quanly@petcare.com', 'Quản Trị Viên (Admin)', 'ADMIN', '123456');
    ensureUser('quanlycuahang@petcare.com', 'Quản Lý Cửa Hàng', 'STORE_MANAGER', '123456');
    ensureUser('letan@petcare.com', 'Lễ Tân Hệ Thống', 'RECEPTIONIST', '123456');
    ensureUser('nhanvien@gmail.com', 'Nhân Viên Chăm Sóc', 'CARE_STAFF', '123456');
    ensureUser('chamsoc@petcare.com', 'Nhân Viên Chăm Sóc', 'CARE_STAFF', '123456');
    ensureUser('user@petcare.com', 'Chủ Nuôi Mẫu', 'USER', '123456');

    // Migrate any legacy DOCTOR users to CARE_STAFF
    this.data.users.forEach(u => {
      if (u.role === 'DOCTOR') {
        u.role = 'CARE_STAFF';
        changed = true;
      }
    });

    this.data._initialized = true;
    changed = true;

    if (changed) {
      this.saveSync();
    }
  }

  // Auto update Overdue statuses
  updateOverdueStatuses() {
    if (this.isUpdatingStatuses) return;
    this.isUpdatingStatuses = true;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeStr = now.toTimeString().substring(0, 5);

      let updatedCount = 0;
      if (this.data.care_schedules) {
        this.data.care_schedules.forEach((sch) => {
          if (sch.status === 'CHƯA_THỰC_HIỆN') {
            if (sch.date < todayStr || (sch.date === todayStr && sch.time < currentTimeStr)) {
              sch.status = 'QUÁ_HẠN';
              updatedCount++;

              // Check if notification exists
              const existing = this.data.notifications.find(
                (n) => n.schedule_id === sch.id && n.type === 'OVERDUE'
              );
              if (!existing) {
                this.data.notifications.unshift({
                  id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                  user_id: sch.user_id,
                  schedule_id: sch.id,
                  title: '⚠️ Lịch chăm sóc đã quá hạn',
                  message: `Lịch "${sch.task_name}" (${sch.date} ${sch.time}) đã quá hạn chưa hoàn thành.`,
                  type: 'OVERDUE',
                  is_read: false,
                  created_at: new Date().toISOString()
                });
              }
            }
          }
        });
      }

      if (updatedCount > 0) {
        this.save();
      }
    } finally {
      this.isUpdatingStatuses = false;
    }
  }

  generateReminders() {
    if (this.isGeneratingReminders) return;
    this.isGeneratingReminders = true;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      let added = false;

      if (!this.data.appointments) this.data.appointments = [];
      if (!this.data.notifications) this.data.notifications = [];

      // Map of active appointments by ID
      const activeAppointmentMap = new Map();
      const allAppointmentMap = new Map();

      this.data.appointments.forEach(a => {
        allAppointmentMap.set(a.id, a);
        if (a.status !== 'CANCELLED' && a.status !== 'COMPLETED') {
          activeAppointmentMap.set(a.id, a);
        }
      });

      // 1. Remove or clean up orphaned, cancelled, or completed appointment reminders
      const beforeCount = this.data.notifications.length;
      this.data.notifications = this.data.notifications.filter(n => {
        if (n.type === 'AI_REMINDER' && n.appointment_id) {
          const app = allAppointmentMap.get(n.appointment_id);
          // If appointment does not exist, or is CANCELLED, or COMPLETED -> do not keep active reminder
          if (!app || app.status === 'CANCELLED' || app.status === 'COMPLETED') {
            return false;
          }
        }
        return true;
      });
      if (this.data.notifications.length !== beforeCount) {
        added = true;
      }

      // 2. Synchronize / Create reminders for each active appointment
      activeAppointmentMap.forEach(a => {
        if (!a.appointmentDate || !a.appointmentTime) return;

        const pet = (this.data.pets || []).find(p => p.id === a.petId);
        const petName = pet ? pet.name : 'Thú cưng';
        const targetUserId = a.ownerId || a.userId || (pet ? pet.user_id : null);
        if (!targetUserId) return;

        const dParts = (a.appointmentDate || '').split('-');
        const formattedDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : a.appointmentDate;
        const cleanService = (a.examinationType || 'Dịch vụ chăm sóc')
          .replace(/^\[AI\]\s*/i, '')
          .replace(/^<i class="fa-solid fa-robot"><\/i>\s*/i, '')
          .trim();

        const expectedTitle = '<i class="fa-solid fa-robot"></i> Nhắc Lịch AI';
        const expectedMessage = `🔔 Nhắc lịch chăm sóc cho bé ${petName}: Bé có lịch ${cleanService} vào lúc ${a.appointmentTime} ngày ${formattedDate}. Vui lòng đưa bé đến đúng lịch hẹn.`;
        const notifId = 'notif_rem_' + a.id;

        // Find existing reminder linked to this appointment
        let existing = this.data.notifications.find(n => 
          n.type === 'AI_REMINDER' && 
          (n.appointment_id === a.id || n.reference_id === a.id || n.id === notifId)
        );

        if (existing) {
          // Sync any updated fields (rescheduled date/time, service, pet, user)
          let needsUpdate = false;
          if (existing.message !== expectedMessage) { existing.message = expectedMessage; needsUpdate = true; }
          if (existing.user_id !== targetUserId) { existing.user_id = targetUserId; needsUpdate = true; }
          if (existing.date !== a.appointmentDate) { existing.date = a.appointmentDate; needsUpdate = true; }
          if (existing.time !== a.appointmentTime) { existing.time = a.appointmentTime; needsUpdate = true; }
          if (existing.service !== cleanService) { existing.service = cleanService; needsUpdate = true; }
          if (existing.pet_id !== a.petId) { existing.pet_id = a.petId; needsUpdate = true; }
          if (existing.appointment_id !== a.id) { existing.appointment_id = a.id; needsUpdate = true; }
          if (existing.status !== a.status) { existing.status = a.status; needsUpdate = true; }
          if (needsUpdate) {
            added = true;
          }
        } else {
          // Create new reminder directly from appointment data
          this.data.notifications.unshift({
            id: notifId,
            user_id: targetUserId,
            title: expectedTitle,
            message: expectedMessage,
            type: 'AI_REMINDER',
            reference_id: a.id,
            appointment_id: a.id,
            pet_id: a.petId,
            owner_id: targetUserId,
            service: cleanService,
            date: a.appointmentDate,
            time: a.appointmentTime,
            is_read: false,
            status: a.status,
            created_at: a.createdAt || new Date().toISOString()
          });
          added = true;
        }

        // Synchronize care_schedules record
        if (!this.data.care_schedules) this.data.care_schedules = [];
        const schId = 'sch_app_' + a.id;
        let schStatus = 'CHỜ_XÁC_NHẬN';
        if (a.status === 'COMPLETED') {
          schStatus = 'ĐÃ_HOÀN_THÀNH';
        } else if (a.status === 'CANCELLED') {
          schStatus = 'ĐÃ_HỦY';
        } else if (['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status)) {
          schStatus = 'CHƯA_THỰC_HIỆN';
        } else {
          schStatus = 'CHỜ_XÁC_NHẬN';
        }

        let existingSch = this.data.care_schedules.find(s => 
          s.appointment_id === a.id || s.appointmentId === a.id || s.id === schId
        );

        if (existingSch) {
          let needsSchUpdate = false;
          if (existingSch.date !== a.appointmentDate) { existingSch.date = a.appointmentDate; needsSchUpdate = true; }
          if (existingSch.time !== a.appointmentTime) { existingSch.time = a.appointmentTime; needsSchUpdate = true; }
          if (existingSch.task_name !== cleanService) { existingSch.task_name = cleanService; needsSchUpdate = true; }
          if (existingSch.user_id !== targetUserId) { existingSch.user_id = targetUserId; needsSchUpdate = true; }
          if (existingSch.status !== schStatus) { existingSch.status = schStatus; needsSchUpdate = true; }
          if (existingSch.appointment_id !== a.id) { existingSch.appointment_id = a.id; needsSchUpdate = true; }
          const isAppPaid = (a.paymentStatus === 'PAID' || a.paymentStatus === 'DA_THANH_TOAN');
          const expectedSchPayStatus = isAppPaid ? 'DA_THANH_TOAN' : 'CHO_XAC_NHAN';
          if (existingSch.payment_status !== expectedSchPayStatus) { existingSch.payment_status = expectedSchPayStatus; needsSchUpdate = true; }
          if (needsSchUpdate) added = true;
        } else {
          this.data.care_schedules.unshift({
            id: schId,
            appointment_id: a.id,
            pet_id: a.petId,
            user_id: targetUserId,
            created_by: targetUserId,
            creator_role: 'USER',
            task_name: cleanService,
            category: 'LỊCH_HẸN',
            date: a.appointmentDate,
            time: a.appointmentTime,
            description: `Lịch hẹn dịch vụ ${cleanService} cho bé ${petName} (Mã lịch: #${a.id.slice(-8)}).`,
            priority: a.priority || 'CAO',
            status: schStatus,
            payment_method: a.paymentMethod || 'TIEN_MAT',
            payment_status: (a.paymentStatus === 'PAID' || a.paymentStatus === 'DA_THANH_TOAN') ? 'DA_THANH_TOAN' : 'CHO_XAC_NHAN',
            is_ai: false,
            created_at: a.createdAt || new Date().toISOString()
          });
          added = true;
        }
      });

      // Synchronize care_schedules linked status with current appointments
      if (this.data.care_schedules) {
        this.data.care_schedules.forEach(s => {
          if (s.appointment_id) {
            const app = allAppointmentMap.get(s.appointment_id);
            if (app) {
              if (app.status === 'COMPLETED' && s.status !== 'ĐÃ_HOÀN_THÀNH') {
                s.status = 'ĐÃ_HOÀN_THÀNH';
                added = true;
              } else if (app.status === 'CANCELLED' && s.status !== 'ĐÃ_HỦY') {
                s.status = 'ĐÃ_HỦY';
                added = true;
              }
            }
          }
        });
      }

      // 3. Vaccine Reminders
      if (this.data.vaccinations) {
        this.data.vaccinations.forEach(v => {
          if (v.next_due_date && v.next_due_date >= todayStr) {
            const diffDays = Math.floor((new Date(v.next_due_date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) { // Remind 7 days before
              const notifId = 'notif_vac_' + v.id;
              const exists = this.data.notifications.find(n => n.id === notifId);
              if (!exists) {
                const pet = (this.data.pets || []).find(p => p.id === v.pet_id);
                this.data.notifications.unshift({
                  id: notifId,
                  user_id: pet ? pet.user_id : 'sys',
                  title: '💉 Nhắc tiêm phòng sắp tới',
                  message: `Vắc xin "${v.vaccine_name}" cho bé cần tiêm vào ngày ${v.next_due_date}.`,
                  type: 'UPCOMING',
                  is_read: false,
                  created_at: new Date().toISOString()
                });
                added = true;
              }
            }
          }
        });
      }

      // 4. Deworming Reminders
      if (this.data.dewormings) {
        this.data.dewormings.forEach(d => {
          if (d.next_due_date && d.next_due_date >= todayStr) {
            const diffDays = Math.floor((new Date(d.next_due_date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) {
              const notifId = 'notif_dew_' + d.id;
              const exists = this.data.notifications.find(n => n.id === notifId);
              if (!exists) {
                const pet = (this.data.pets || []).find(p => p.id === d.pet_id);
                this.data.notifications.unshift({
                  id: notifId,
                  user_id: pet ? pet.user_id : 'sys',
                  title: '💊 Nhắc tẩy giun',
                  message: `Bé cần tẩy giun vào ngày ${d.next_due_date}.`,
                  type: 'UPCOMING',
                  is_read: false,
                  created_at: new Date().toISOString()
                });
                added = true;
              }
            }
          }
        });
      }

      if (added) this.save();
    } finally {
      this.isGeneratingReminders = false;
    }
  }

  // Generic Query Helpers
  find(table, predicate) {
    this.updateOverdueStatuses();
    this.generateReminders();
    if (!this.data[table]) return [];
    return typeof predicate === 'function' ? this.data[table].filter(predicate) : this.data[table];
  }

  findOne(table, predicate) {
    this.updateOverdueStatuses();
    this.generateReminders();
    if (!this.data[table]) return null;
    return typeof predicate === 'function' ? this.data[table].find(predicate) : (this.data[table][0] || null);
  }

  findById(table, id) {
    return this.findOne(table, (item) => item.id === id);
  }

  insert(table, item) {
    if (!this.data[table]) this.data[table] = [];
    if (!item.id) {
      item.id = table.substring(0, 3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    if (!item.created_at) {
      item.created_at = new Date().toISOString();
    }
    this.data[table].push(item);
    this.save();
    return item;
  }

  update(table, id, updates) {
    const item = this.findById(table, id);
    if (item) {
      Object.assign(item, updates, { updated_at: new Date().toISOString() });
      this.save();
      return item;
    }
    return null;
  }

  delete(table, id) {
    if (!this.data[table]) return false;
    const index = this.data[table].findIndex((item) => item.id === id);
    if (index !== -1) {
      this.data[table].splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }
}

const db = new Database();
module.exports = db;
