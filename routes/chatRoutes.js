const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Helper: Enrich conversation with participant & adoption info & appointment info
function enrichConversation(conv, currentUserId) {
  const otherUserId = (conv.participants || []).find(p => p !== currentUserId);
  const otherUser = otherUserId ? db.findById('users', otherUserId) : null;
  
  let adoption = null;
  if (conv.adoption_id) {
    adoption = db.findById('adoptions', conv.adoption_id);
  }

  let appointment = null;
  if (conv.appointment_id) {
    appointment = db.findById('appointments', conv.appointment_id);
  }
  let appointmentInfo = conv.appointment_info || null;
  if (appointment) {
    const pet = db.findById('pets', appointment.petId || appointment.pet_id);
    appointmentInfo = {
      appointment_id: appointment.id,
      service_name: appointment.examinationType || appointment.serviceName || appointment.service_name || 'Dịch vụ chăm sóc',
      pet_id: appointment.petId || appointment.pet_id || '',
      pet_name: (pet ? pet.name : appointment.petName) || 'Thú cưng',
      pet_species: pet ? pet.species : (appointment.petSpecies || 'Pet'),
      appointment_date: appointment.appointmentDate || appointment.date || '',
      appointment_time: appointment.appointmentTime || appointment.time || '',
      status: appointment.status || 'PENDING'
    };
  }

  const unreadCount = db.find('messages', m => 
    m.conversation_id === conv.id && m.recipient_id === currentUserId && !m.is_read
  ).length;

  return {
    ...conv,
    other_user: otherUser ? {
      id: otherUser.id,
      full_name: otherUser.full_name,
      avatar: otherUser.avatar || '',
      role: otherUser.role,
      phone: otherUser.phone || ''
    } : {
      id: otherUserId || '',
      full_name: 'Người dùng',
      avatar: '',
      role: 'USER',
      phone: ''
    },
    adoption: adoption ? {
      id: adoption.id,
      pet_name: adoption.pet_name,
      species: adoption.species,
      image_url: adoption.image_url || '',
      status: adoption.status
    } : null,
    appointment_info: appointmentInfo,
    unread_count: unreadCount
  };
}

// GET /api/chat/users or /api/messages/users - List users to start chatting with based on role
router.get('/users', (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    let users = [];

    if (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTIONIST') {
      users = db.find('users', u => u.id !== currentUserId && u.status !== 'LOCKED' && u.status !== 'DELETED');
    } else if (currentUserRole === 'CARE_STAFF') {
      // Care staff can chat with Admin, Store Manager, Receptionist, and owners of assigned appointments
      const assignedApps = db.find('appointments', a => a.staffId === currentUserId || a.staff_id === currentUserId);
      const ownerIds = new Set(assignedApps.map(a => a.userId || a.ownerId).filter(Boolean));
      users = db.find('users', u => {
        if (u.id === currentUserId || u.status === 'LOCKED' || u.status === 'DELETED') return false;
        if (['ADMIN', 'RECEPTIONIST'].includes(u.role)) return true;
        if (ownerIds.has(u.id)) return true;
        return false;
      });
    } else if (currentUserRole === 'USER') {
      // Owner can chat with Admin, Receptionist, and Care Staff assigned to their appointments
      const myApps = db.find('appointments', a => a.userId === currentUserId || a.ownerId === currentUserId);
      const staffIds = new Set(myApps.map(a => a.staffId || a.staff_id).filter(Boolean));
      users = db.find('users', u => {
        if (u.id === currentUserId || u.status === 'LOCKED' || u.status === 'DELETED') return false;
        if (['ADMIN', 'RECEPTIONIST'].includes(u.role)) return true;
        if (staffIds.has(u.id)) return true;
        return false;
      });
    }

    const sanitized = users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      avatar: u.avatar || '',
      phone: u.phone || ''
    }));
    return res.json({ success: true, users: sanitized });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// GET /api/chat/conversations (also GET /api/chat or GET /api/messages)
const listConversationsHandler = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = (req.user.role || '').toUpperCase().trim();

    let convs = db.find('conversations', c => 
      Array.isArray(c.participants) && c.participants.includes(currentUserId)
    );

    // STORE_MANAGER cannot view conversations with ADMIN
    if (currentUserRole === 'STORE_MANAGER') {
      convs = convs.filter(c => {
        const otherUserId = c.participants.find(p => p !== currentUserId);
        if (!otherUserId) return false;
        const otherUser = db.findById('users', otherUserId);
        if (!otherUser) return false;
        return otherUser.role !== 'ADMIN';
      });
    }

    // ADMIN cannot view conversations with STORE_MANAGER
    if (currentUserRole === 'ADMIN') {
      convs = convs.filter(c => {
        const otherUserId = c.participants.find(p => p !== currentUserId);
        if (!otherUserId) return false;
        const otherUser = db.findById('users', otherUserId);
        if (!otherUser) return false;
        return otherUser.role !== 'STORE_MANAGER';
      });
    }

    // Strict role check for CARE_STAFF:
    if (currentUserRole === 'CARE_STAFF') {
      const assignedApps = db.find('appointments', a => a.staffId === currentUserId || a.staff_id === currentUserId);
      const assignedOwnerIds = new Set(assignedApps.map(a => a.userId || a.ownerId).filter(Boolean));

      convs = convs.filter(c => {
        const otherUserId = c.participants.find(p => p !== currentUserId);
        if (!otherUserId) return false;
        const otherUser = db.findById('users', otherUserId);
        if (!otherUser) return false;
        if (['ADMIN', 'STORE_MANAGER', 'RECEPTIONIST'].includes(otherUser.role)) return true;
        if (assignedOwnerIds.has(otherUserId)) return true;
        return false;
      });
    }

    const enrichedList = convs
      .map(c => enrichConversation(c, currentUserId))
      .sort((a, b) => {
        const timeA = (a.last_message && a.last_message.created_at) || a.updated_at || a.created_at || '';
        const timeB = (b.last_message && b.last_message.created_at) || b.updated_at || b.created_at || '';
        return timeB.localeCompare(timeA);
      });

    return res.json({ success: true, conversations: enrichedList });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách cuộc trò chuyện.' });
  }
};

router.get('/conversations', listConversationsHandler);
router.get('/', listConversationsHandler);

// POST /api/chat/conversations (also POST /api/chat or POST /api/messages)
const createConversationHandler = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    let { recipient_id, adoption_id, appointment_id, appointment_info, content } = req.body;

    // If no recipient_id provided, default to Receptionist
    if (!recipient_id) {
      const allowedRoles = currentUserRole === 'STORE_MANAGER' ? ['RECEPTIONIST'] : ['RECEPTIONIST', 'ADMIN'];
      const staffUser = db.findOne('users', u => allowedRoles.includes(u.role) && u.id !== currentUserId && u.status !== 'LOCKED');
      if (staffUser) {
        recipient_id = staffUser.id;
      }
    }

    if (!recipient_id) {
      return res.status(400).json({ success: false, message: 'Thiếu ID người nhận trò chuyện.' });
    }

    if (recipient_id === currentUserId) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự nhắn tin cho chính mình.' });
    }

    const recipient = db.findById('users', recipient_id);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản người nhận.' });
    }

    // Role-based permission checks:

    // Care staff can chat with Receptionist, Admin, and owners of assigned appointments
    if (req.user.role === 'CARE_STAFF') {
      const isTargetStaff = ['ADMIN', 'RECEPTIONIST'].includes(recipient.role);
      const isTargetAssignedOwner = db.findOne('appointments', a => 
        (a.staffId === currentUserId || a.staff_id === currentUserId) && (a.userId === recipient_id || a.ownerId === recipient_id)
      );
      if (!isTargetStaff && !isTargetAssignedOwner) {
        const existing = db.findOne('conversations', c => Array.isArray(c.participants) && c.participants.includes(currentUserId) && c.participants.includes(recipient_id));
        if (!existing) {
          return res.status(403).json({ success: false, message: 'Nhân viên chăm sóc chỉ có thể nhắn tin với Chủ nuôi được phân công hoặc Lễ tân/Quản lý.' });
        }
      }
    }

    // Owner can chat with Admin, Receptionist, and assigned Care Staff
    if (req.user.role === 'USER') {
      const isTargetStaff = ['ADMIN', 'RECEPTIONIST'].includes(recipient.role);
      const isTargetCareStaff = recipient.role === 'CARE_STAFF' && db.findOne('appointments', a =>
        (a.userId === currentUserId || a.ownerId === currentUserId) && (a.staffId === recipient_id || a.staff_id === recipient_id)
      );
      if (!isTargetStaff && !isTargetCareStaff) {
        const existing = db.findOne('conversations', c => Array.isArray(c.participants) && c.participants.includes(currentUserId) && c.participants.includes(recipient_id));
        if (!existing) {
          return res.status(403).json({ success: false, message: 'Chủ nuôi chỉ có thể nhắn tin với Lễ tân, Quản lý hoặc Nhân viên chăm sóc được phân công cho thú cưng của mình.' });
        }
      }
    }

    let conv = db.findOne('conversations', c => {
      if (!Array.isArray(c.participants)) return false;
      return c.participants.includes(currentUserId) && c.participants.includes(recipient_id);
    });

    if (!conv) {
      conv = db.insert('conversations', {
        participants: [currentUserId, recipient_id],
        adoption_id: adoption_id || null,
        appointment_id: appointment_id || null,
        appointment_info: appointment_info || null,
        last_message: null,
        unread_count: {
          [currentUserId]: 0,
          [recipient_id]: 0
        }
      });
    } else {
      const updates = {};
      if (appointment_id) updates.appointment_id = appointment_id;
      if (appointment_info) updates.appointment_info = appointment_info;
      if (adoption_id) updates.adoption_id = adoption_id;
      if (Object.keys(updates).length > 0) {
        conv = db.update('conversations', conv.id, updates);
      }
    }

    // If content was sent with the conversation creation, insert the initial message
    if (content && content.trim()) {
      const trimmedContent = content.trim();
      const newMsg = db.insert('messages', {
        conversation_id: conv.id,
        sender_id: currentUserId,
        recipient_id: recipient_id,
        content: trimmedContent,
        is_read: false
      });
      db.update('conversations', conv.id, {
        last_message: {
          id: newMsg.id,
          content: trimmedContent,
          sender_id: currentUserId,
          created_at: newMsg.created_at
        }
      });
      const sender = db.findById('users', currentUserId);
      const senderName = sender ? sender.full_name : 'Người dùng';
      const previewText = trimmedContent.length > 60 ? trimmedContent.substring(0, 60) + '...' : trimmedContent;
      const isCancelReq = /yêu\s*cầu\s*hủy|hủy\s*lịch/i.test(trimmedContent);
      let notifTitle = `<i class="fa-solid fa-comment"></i> Tin nhắn từ ${senderName}`;
      let notifMessage = previewText;

      if (isCancelReq && conv.appointment_id) {
        const app = db.findById('appointments', conv.appointment_id);
        if (app) {
          const pet = db.findById('pets', app.petId || app.pet_id);
          const petName = (pet ? pet.name : app.petName) || 'Thú cưng';
          const svcName = app.examinationType || app.serviceName || 'Dịch vụ chăm sóc';
          const appDate = app.appointmentDate || app.date || '';
          const appTime = app.appointmentTime || app.time || '';
          notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới: Bé ${petName}`;
          notifMessage = `Chủ nuôi ${senderName} yêu cầu hủy lịch ${svcName} (Bé ${petName}) ngày ${appDate} lúc ${appTime}`;
        } else {
          notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới từ ${senderName}`;
        }
      } else if (isCancelReq) {
        notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới từ ${senderName}`;
      }

      db.insert('notifications', {
        user_id: recipient_id,
        type: isCancelReq ? 'APPOINTMENT' : 'CHAT',
        reference_id: conv.appointment_id || conv.id,
        title: notifTitle,
        message: notifMessage,
        is_read: false
      });
    }

    const enriched = enrichConversation(conv, currentUserId);
    return res.json({ success: true, conversation: enriched });
  } catch (err) {
    console.error('Error initiating conversation:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi bắt đầu trò chuyện.' });
  }
};

router.post('/conversations', createConversationHandler);
router.post('/', createConversationHandler);

// GET /api/chat/conversations/:id/messages
const getMessagesHandler = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    const convId = req.params.id;

    const conv = db.findById('conversations', convId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    if (!Array.isArray(conv.participants) || !conv.participants.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập cuộc trò chuyện này.' });
    }

    const otherUserId = (conv.participants || []).find(p => p !== currentUserId);
    const otherUser = otherUserId ? db.findById('users', otherUserId) : null;

    if (currentUserRole === 'CARE_STAFF') {
      const assignedApps = db.find('appointments', a => a.staffId === currentUserId || a.staff_id === currentUserId);
      const assignedOwnerIds = new Set(assignedApps.map(a => a.userId || a.ownerId).filter(Boolean));
      const isAllowed = otherUser && (['ADMIN', 'RECEPTIONIST'].includes(otherUser.role) || assignedOwnerIds.has(otherUserId));
      if (!isAllowed) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập cuộc trò chuyện này.' });
      }
    }

    const messages = db.find('messages', m => m.conversation_id === convId);
    messages.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    let markedCount = 0;
    messages.forEach(m => {
      if (m.recipient_id === currentUserId && !m.is_read) {
        m.is_read = true;
        markedCount++;
      }
    });

    if (markedCount > 0) {
      db.save();
    }

    const enriched = enrichConversation(conv, currentUserId);
    return res.json({
      success: true,
      conversation: enriched,
      messages
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy tin nhắn.' });
  }
};

router.get('/conversations/:id/messages', getMessagesHandler);
router.get('/messages/:id', getMessagesHandler);
router.get('/:id/messages', getMessagesHandler);
router.get('/:id', (req, res) => {
  // If id is for a conversation, return messages
  const conv = db.findById('conversations', req.params.id);
  if (conv) return getMessagesHandler(req, res);
  return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
});

// POST /api/chat/conversations/:id/messages - Send message
const sendMessageHandler = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    let convId = req.params.id || req.body.conversation_id;
    let recipientId = req.body.recipient_id || req.body.receiver_id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    let conv = null;
    if (convId) {
      conv = db.findById('conversations', convId);
    }

    if (!conv && recipientId) {
      conv = db.findOne('conversations', c => 
        Array.isArray(c.participants) && c.participants.includes(currentUserId) && c.participants.includes(recipientId)
      );
      if (!conv) {
        conv = db.insert('conversations', {
          participants: [currentUserId, recipientId],
          last_message: null,
          unread_count: { [currentUserId]: 0, [recipientId]: 0 }
        });
      }
      convId = conv.id;
    }

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    if (!Array.isArray(conv.participants) || !conv.participants.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này.' });
    }

    if (!recipientId) {
      recipientId = conv.participants.find(p => p !== currentUserId);
    }
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy người nhận.' });
    }

    if (currentUserRole === 'CARE_STAFF') {
      const assignedApps = db.find('appointments', a => a.staffId === currentUserId || a.staff_id === currentUserId);
      const assignedOwnerIds = new Set(assignedApps.map(a => a.userId || a.ownerId).filter(Boolean));
      const isAllowed = recipient && (['ADMIN', 'RECEPTIONIST'].includes(recipient.role) || assignedOwnerIds.has(recipientId));
      if (!isAllowed) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.' });
      }
    }

    const trimmedContent = content.trim();
    const newMsg = db.insert('messages', {
      conversation_id: convId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      content: trimmedContent,
      is_read: false
    });

    const unreadMap = conv.unread_count || {};
    unreadMap[recipientId] = (unreadMap[recipientId] || 0) + 1;

    db.update('conversations', convId, {
      last_message: {
        id: newMsg.id,
        content: trimmedContent,
        sender_id: currentUserId,
        created_at: newMsg.created_at
      },
      unread_count: unreadMap
    });

    const sender = db.findById('users', currentUserId);
    const senderName = sender ? sender.full_name : 'Người dùng';
    const previewText = trimmedContent.length > 60 ? trimmedContent.substring(0, 60) + '...' : trimmedContent;

    const isCancelReq = /yêu\s*cầu\s*hủy|hủy\s*lịch/i.test(trimmedContent);
    let notifTitle = `<i class="fa-solid fa-comment"></i> Tin nhắn từ ${senderName}`;
    let notifMessage = previewText;

    if (isCancelReq && conv.appointment_id) {
      const app = db.findById('appointments', conv.appointment_id);
      if (app) {
        const pet = db.findById('pets', app.petId || app.pet_id);
        const petName = (pet ? pet.name : app.petName) || 'Thú cưng';
        const svcName = app.examinationType || app.serviceName || 'Dịch vụ chăm sóc';
        const appDate = app.appointmentDate || app.date || '';
        const appTime = app.appointmentTime || app.time || '';
        notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới: Bé ${petName}`;
        notifMessage = `Chủ nuôi ${senderName} yêu cầu hủy lịch ${svcName} (Bé ${petName}) ngày ${appDate} lúc ${appTime}`;
      } else {
        notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới từ ${senderName}`;
      }
    } else if (isCancelReq) {
      notifTitle = `<i class="fa-solid fa-bell"></i> Yêu cầu hủy lịch mới từ ${senderName}`;
    }

    db.insert('notifications', {
      user_id: recipientId,
      type: isCancelReq ? 'APPOINTMENT' : 'CHAT',
      reference_id: conv.appointment_id || convId,
      title: notifTitle,
      message: notifMessage,
      is_read: false
    });

    return res.status(201).json({
      success: true,
      message: newMsg,
      conversation_id: convId
    });
  } catch (err) {
    console.error('Error sending message:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi gửi tin nhắn.' });
  }
};

router.post('/conversations/:id/messages', sendMessageHandler);
router.post('/messages/:id', sendMessageHandler);
router.post('/:id/messages', sendMessageHandler);
router.post('/send', sendMessageHandler);

// GET /api/chat/unread-count - Total unread message count
router.get('/unread-count', (req, res) => {
  try {
    const currentUserId = req.user.id;
    const unreadList = db.find('messages', m => m.recipient_id === currentUserId && !m.is_read);
    return res.json({ success: true, unread_count: unreadList.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

// PATCH /api/chat/conversations/:id/read - Mark conversation as read
const markReadHandler = (req, res) => {
  try {
    const currentUserId = req.user.id;
    const convId = req.params.id;

    const conv = db.findById('conversations', convId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
    }

    if (!Array.isArray(conv.participants) || !conv.participants.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền.' });
    }

    const messages = db.find('messages', m => m.conversation_id === convId && m.recipient_id === currentUserId && !m.is_read);
    messages.forEach(m => {
      m.is_read = true;
    });

    if (messages.length > 0) {
      db.save();
    }

    return res.json({ success: true, message: 'Đã đánh dấu đã đọc.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

router.patch('/conversations/:id/read', markReadHandler);
router.patch('/:id/read', markReadHandler);

module.exports = router;
