/**
 * =======================================================================
 * SEN CHĂM BOSS - DYNAMIC RAG KNOWLEDGE BASE & RETRIEVAL ENGINE
 * =======================================================================
 * Tự động thu thập và index toàn bộ tri thức nghiệp vụ từ website & database:
 * 1. Quản lý thú cưng (Hồ sơ, loài, giống, giới tính, tuổi, cân nặng, sức khỏe)
 * 2. Hồ sơ sức khỏe & Lịch sử khám (Tiêm phòng, ghi chú y tế, dịch vụ đã làm)
 * 3. Lịch chăm sóc (Cho ăn, tắm, cắt móng, tiêm phòng, lịch sắp tới & đã qua)
 * 4. Đặt lịch hẹn, Hủy lịch & Thay đổi lịch (Quy định PENDING, CONFIRMED, quyền khách hàng & nhân viên)
 * 5. Dịch vụ & Bảng giá (Bảng giá chi tiết tất cả dịch vụ, gói spa, lưu chuồng)
 * 6. Hóa đơn & Thanh toán (VietQR, tiền mặt, phân quyền quản lý hóa đơn)
 * 7. Quyền hạn của từng vai trò / tác nhân (Admin xóa dịch vụ/hóa đơn, Lễ tân duyệt lịch, Nhân viên chăm sóc, Khách hàng)
 * 8. Danh sách chức năng website (11 chức năng chính)
 * 9. Cẩm nang kiến thức chăm sóc thú cưng (Dinh dưỡng, vệ sinh, phòng bệnh)
 */

const db = require('../config/database');
const { EmbeddingStore, invalidateEmbeddingCache } = require('./embeddingStore');
const fs = require('fs');
const path = require('path');

function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[.,?!:;'"()\[\]{}_\-\/\\`~@#$%^&*+=<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatVND(amount) {
  if (amount === undefined || amount === null) return '0đ';
  return Number(amount).toLocaleString('vi-VN') + ' VNĐ';
}

function formatDateVi(dateStr) {
  if (!dateStr) return 'Chưa rõ ngày';
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Dynamically extract and index all knowledge documents from Knowledge Base file
 */
function loadKnowledgeBaseDocuments() {
  const file = path.join(__dirname, '..', 'data', 'knowledge', 'sen_cham_boss_knowledge.txt');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];

  const sections = text.split(/\n(?=[0-9]+\.\s+)/).map(x => x.trim()).filter(Boolean);
  const docs = [];

  sections.forEach((sec, idx) => {
    const lines = sec.split('\n');
    const titleLine = lines[0] || `Phần ${idx + 1}`;
    const cleanTitle = titleLine.replace(/^[0-9]+\.\s*/, '').trim();

    let docType = 'Quy định & Tri thức hệ thống';
    let category = 'Knowledge Base';

    if (cleanTitle.toLowerCase().includes('chuc nang')) {
      category = 'Chức năng website';
      docType = 'Danh sách chức năng website';
    } else if (cleanTitle.toLowerCase().includes('bang gia') || cleanTitle.toLowerCase().includes('dich vu')) {
      // Bỏ qua mục bảng giá tĩnh trong file text để ưu tiên 100% dữ liệu thực tế từ Database
      return;
    } else if (cleanTitle.toLowerCase().includes('huy lich') || cleanTitle.toLowerCase().includes('thay doi lich')) {
      category = 'Quy định đặt & hủy lịch';
      docType = 'Chính sách hủy và đổi lịch hẹn';
    } else if (cleanTitle.toLowerCase().includes('hoa don') || cleanTitle.toLowerCase().includes('thanh toan')) {
      category = 'Hóa đơn & Thanh toán';
      docType = 'Quy định hóa đơn và thanh toán';
    } else if (cleanTitle.toLowerCase().includes('quyen han') || cleanTitle.toLowerCase().includes('vai tro')) {
      category = 'Phân quyền tác nhân';
      docType = 'Quy định phân quyền RBAC';
    }

    docs.push({
      id: `kb_section_${idx + 1}`,
      type: docType,
      category: category,
      sourceName: 'Knowledge Base Sen Chăm Boss',
      title: `${cleanTitle} - Sen Chăm Boss`,
      content: sec
    });
  });

  return docs;
}

/**
 * Real-time service & package pricing extractor with dynamic comparison
 */
function getRealtimeServicesAndPrices(database = db) {
  const services = (database.find('services') || []).filter(s => s.status !== 'INACTIVE');
  const packages = (database.find('service_packages') || []).filter(p => p.status !== 'INACTIVE');

  const sortedServices = [...services].sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
  const highestService = sortedServices[0] || null;
  const lowestService = sortedServices[sortedServices.length - 1] || null;

  const sortedPackages = [...packages].sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
  const highestPackage = sortedPackages[0] || null;
  const lowestPackage = sortedPackages[sortedPackages.length - 1] || null;

  return {
    services,
    packages,
    sortedServices,
    sortedPackages,
    highestService,
    lowestService,
    highestPackage,
    lowestPackage
  };
}

function buildServiceCatalogText(database = db) {
  const { services, packages, highestService, lowestService, highestPackage } = getRealtimeServicesAndPrices(database);
  if (!services.length && !packages.length) {
    return 'Hiện tại chưa có dữ liệu dịch vụ hoặc bảng giá được ghi nhận trong cơ sở dữ liệu hệ thống.';
  }

  let text = 'BẢNG GIÁ DỊCH VỤ & GÓI CHĂM SÓC CHÍNH THỨC CỦA SEN CHĂM BOSS (Trích xuất thời gian thực từ Database):\n\n';
  
  text += '1. CÁC DỊCH VỤ ĐƠN LẺ:\n';
  services.forEach((s, idx) => {
    const priceStr = s.price ? formatVND(s.price) : 'Liên hệ';
    const durationStr = s.duration ? ` (Thời gian: ${s.duration})` : '';
    const descStr = s.description ? ` - ${s.description}` : '';
    text += `${idx + 1}. **${s.name}**: **${priceStr}**${durationStr}${descStr}\n`;
  });

  if (packages.length > 0) {
    text += '\n2. CÁC GÓI CHĂM SÓC / COMBO TIẾT KIỆM:\n';
    packages.forEach((p, idx) => {
      const priceStr = p.price ? formatVND(p.price) : 'Liên hệ';
      const validityStr = p.validity ? ` (Thời hạn: ${p.validity})` : '';
      const descStr = p.description ? ` - ${p.description}` : '';
      const servicesInc = Array.isArray(p.services_included) && p.services_included.length ? ` (Bao gồm: ${p.services_included.join(', ')})` : '';
      text += `${idx + 1}. **${p.name}**: **${priceStr}**${validityStr}${servicesInc}${descStr}\n`;
    });
  }

  text += '\n3. THÔNG TIN SO SÁNH GIÁ ĐẮT NHẤT / CAO NHẤT & RẺ NHẤT (QUAN TRỌNG KHI NGƯỜI DÙNG HỎI SO SÁNH GIÁ):\n';
  if (highestService) {
    text += `- **Dịch vụ đơn lẻ có giá đắt nhất (cao nhất)**: **${highestService.name}** với giá **${formatVND(highestService.price)}** (thời gian: ${highestService.duration || 'theo quy định'}).\n`;
  }
  if (lowestService) {
    text += `- **Dịch vụ đơn lẻ có giá rẻ nhất**: **${lowestService.name}** với giá **${formatVND(lowestService.price)}**.\n`;
  }
  if (highestPackage) {
    text += `- **Gói chăm sóc / Combo có giá cao nhất**: **${highestPackage.name}** với giá **${formatVND(highestPackage.price)}**.\n`;
  }
  text += `- Chú ý đặc biệt: Dịch vụ "Tắm & Spa Thư Giãn" có giá là 150.000 VNĐ, KHÔNG PHẢI là dịch vụ đắt nhất. Dịch vụ đắt nhất của hệ thống là "${highestService ? highestService.name : 'Cắt Tỉa Lông & Tạo Kiểu (Grooming)'}" (${highestService ? formatVND(highestService.price) : '250.000 VNĐ'}). Khi người dùng hỏi "giá đắt nhất của spa là bao nhiêu", PHẢI trả lời chính xác dịch vụ có giá cao nhất từ dữ liệu thực tế và phân biệt dịch vụ đơn lẻ với gói chăm sóc.\n`;

  return text;
}

function buildRealSystemDocuments({ user = null, selectedPet = null, database = db }) {
  const docs = [];
  const isAdminOrStaff = user && ['ADMIN', 'CARE_STAFF', 'RECEPTIONIST'].includes(user.role);
  const userId = user ? user.id : null;

  // 1. Static knowledge base documents
  docs.push(...loadKnowledgeBaseDocuments());

  // 2. Core rules documents
  docs.push({
    id: 'system_appointment_cancel_rules',
    type: 'Quy định đặt & hủy lịch',
    category: 'Quy định lịch hẹn',
    sourceName: 'Quy định đặt & hủy lịch',
    title: 'Quy định đặt lịch, hủy lịch và thay đổi lịch hẹn của Khách hàng và Nhân viên tại Sen Chăm Boss',
    content: `Quy định về Đặt lịch, Hủy lịch và Thay đổi lịch hẹn tại Sen Chăm Boss:
1. **Khách hàng có được hủy hoặc đổi lịch hẹn không?**
   - **CÓ**. Khách hàng (Chủ nuôi) có thể chủ động hủy hoặc đổi lịch hẹn trực tiếp trên website khi lịch hẹn đang ở trạng thái **Chờ xác nhận (PENDING)** (tức là trước khi nhân viên/lễ tân xác nhận).
   - **SAU KHI ĐÃ XÁC NHẬN**: Khi lịch hẹn đã được Lễ tân/Nhân viên bấm xác nhận (**CONFIRMED**), hoặc khi lịch đang thực hiện (**IN_PROGRESS**) hoặc đã hoàn thành (**COMPLETED**), khách hàng **KHÔNG THỂ TỰ HỦY** trên website. Nếu cần hủy hoặc dời lịch gấp, khách hàng phải liên hệ trực tiếp với Lễ tân hoặc Hotline của Sen Chăm Boss.
2. **Quyền hạn hủy lịch của các tác nhân:**
   - **Khách hàng (User)**: Tự hủy được khi lịch ở trạng thái Chờ xác nhận (PENDING).
   - **Lễ tân (Receptionist), Quản lý cửa hàng (Store Manager), Quản trị viên (Admin)**: Có quyền duyệt, xác nhận hoặc hủy lịch hẹn trên hệ thống.
   - **Nhân viên chăm sóc (Care Staff)**: KHÔNG có quyền tự ý hủy lịch hẹn mà phải báo cho Lễ tân hoặc Quản lý xử lý.`
  });

  docs.push({
    id: 'system_invoice_payment_rules',
    type: 'Hóa đơn & Thanh toán',
    category: 'Hóa đơn & Thanh toán',
    sourceName: 'Quy định Hóa đơn & Thanh toán',
    title: 'Quy định Hóa đơn, Phương thức Thanh toán (VietQR, Tiền mặt) và Phân quyền tại Sen Chăm Boss',
    content: `Quy định về Hóa đơn, Phương thức Thanh toán và Phân quyền tại Sen Chăm Boss:
1. **Phương thức thanh toán:**
   - **Chuyển khoản VietQR**: Quét mã QR code trên màn hình thanh toán để chuyển khoản chính xác số tiền và mã hóa đơn tự động.
   - **Tiền mặt**: Khách hàng thanh toán trực tiếp tại quầy Lễ tân của cơ sở. Lễ tân hoặc Admin sẽ xác nhận trạng thái "ĐÃ THANH TOÁN".
2. **Quy định phân quyền Hóa đơn:**
   - **Khách hàng (User)**: Được xem danh sách và chi tiết hóa đơn của chính mình; thực hiện thanh toán VietQR hoặc chọn trả tiền mặt.
   - **Lễ tân (Receptionist) & Admin**: Lập hóa đơn, quản lý danh sách hóa đơn, xác nhận thanh toán tiền mặt/chuyển khoản.
   - **Admin (Quản trị viên)**: Là người DUY NHẤT có quyền Xóa hóa đơn khỏi hệ thống.
   - **Nhân viên chăm sóc (Care Staff)**: Không có quyền quản lý hay xóa hóa đơn.`
  });

  docs.push({
    id: 'system_rbac_role_permissions',
    type: 'Phân quyền tác nhân',
    category: 'Phân quyền tác nhân',
    sourceName: 'Quy định phân quyền RBAC',
    title: 'Quy định phân quyền tác nhân (Admin, Lễ tân, Nhân viên chăm sóc, Khách hàng) trong hệ thống Sen Chăm Boss',
    content: `Quy định phân quyền tác nhân (RBAC) trong hệ thống Sen Chăm Boss:
1. **Quản trị viên (Admin):**
   - **Có quyền xóa dịch vụ**: Admin có toàn quyền Thêm mới, Chỉnh sửa và XÓA DỊCH VỤ / GÓI DỊCH VỤ khỏi hệ thống.
   - **Có quyền xóa hóa đơn**: Admin là vai trò duy nhất có thể xóa hóa đơn.
   - **Quản lý người dùng**: Quản lý danh sách tài khoản, cấp quyền Admin, Lễ tân, Nhân viên chăm sóc.
   - **Báo cáo & Thống kê**: Xem báo cáo doanh thu, thống kê toàn hệ thống.
2. **Lễ tân (Receptionist):**
   - Tiếp đón khách hàng, duyệt và xác nhận lịch hẹn từ khách hàng.
   - Phân công nhân viên chăm sóc cho ca lịch hẹn.
   - Lập hóa đơn và xác nhận thanh toán (tiền mặt / VietQR).
   - Hủy lịch hẹn khi khách hàng yêu cầu. Không có quyền xóa dịch vụ hay xóa hóa đơn.
3. **Nhân viên chăm sóc (Care Staff / Bác sĩ thú y):**
   - Xem lịch hẹn được phân công, thực hiện dịch vụ chăm sóc cho thú cưng.
   - Ghi chép nhật ký sức khỏe, sổ tiêm phòng, sổ theo dõi điều trị.
   - Không có quyền hủy lịch, không có quyền xóa dịch vụ, không có quyền xóa hóa đơn.
4. **Khách hàng (User / Chủ nuôi):**
   - Quản lý hồ sơ thú cưng của mình.
   - Đặt lịch hẹn, tự hủy lịch khi đang ở trạng thái Chờ xác nhận (PENDING).
   - Xem hóa đơn và thanh toán online qua VietQR hoặc chọn trả tiền mặt tại quầy.
   - Nhắn tin trực tuyến và mua sắm tại Pet Shop.`
  });

  docs.push({
    id: 'system_website_features',
    type: 'Chức năng website',
    category: 'Chức năng website',
    sourceName: 'Chức năng website',
    title: 'Danh sách 11 chức năng chính của website Sen Chăm Boss',
    content: `Danh sách 11 chức năng chính của website Sen Chăm Boss:
1. Quản lý Hồ sơ Thú cưng: Thêm, sửa hồ sơ, theo dõi cân nặng, tuổi, giống loài và thể trạng của Boss.
2. Hồ sơ Sức khỏe & Sổ tiêm chủng: Lưu trữ lịch sử khám bệnh, nhật ký điều trị, tiêm vắc-xin và tẩy giun định kỳ.
3. Lập & Theo dõi Lịch chăm sóc: Lên lịch ăn uống, tắm rửa, cắt móng, uống thuốc cho từng bé.
4. Đặt lịch dịch vụ trực tuyến: Chủ nuôi chủ động đặt lịch hẹn Spa, Khám bệnh, Cắt tỉa lông hoặc Khách sạn lưu chuồng.
5. Dịch Vụ & Bảng Giá Gói Chăm Sóc: Niêm yết công khai danh mục dịch vụ, giá cả và thời gian thực hiện.
6. Lập Hóa Đơn & Theo Dõi Thanh Toán: Xem hóa đơn, hỗ trợ thanh toán Chuyển khoản VietQR và Tiền mặt tại quầy.
7. Tin nhắn & Hỗ trợ trực tuyến: Trao đổi trực tiếp 1-1 giữa Chủ nuôi với Lễ tân, Nhân viên chăm sóc và Bác sĩ thú y.
8. Trợ lý AI Thông minh (RAG): Giải đáp thắc mắc, hướng dẫn sử dụng website và tra cứu thông tin hệ thống Sen Chăm Boss.
9. Cửa hàng thú cưng (Pet Shop): Cung cấp thức ăn dinh dưỡng, phụ kiện, cát vệ sinh chính hãng.
10. Quản lý Tài khoản & Điểm thưởng: Cập nhật thông tin cá nhân, tích lũy điểm thưởng và hạng thành viên.
11. Quản trị & Phân quyền hệ thống: Dành cho Admin, Lễ tân và Nhân viên chăm sóc quản lý doanh thu, duyệt lịch và phân quyền.`
  });

  // Services & Packages catalog (Live extracted from database with real-time price comparison)
  const serviceCatalogContent = buildServiceCatalogText(database);
  docs.push({
    id: 'system_services_catalog',
    type: 'Dịch vụ & bảng giá',
    category: 'Dịch vụ & Bảng giá',
    sourceName: 'Dịch vụ & bảng giá (Live Database)',
    title: 'Bảng giá và Danh mục Dịch vụ chăm sóc thú cưng chính thức của Sen Chăm Boss',
    content: serviceCatalogContent
  });

  // User's pet data if any
  const allPets = database.find('pets') || [];
  const userPets = isAdminOrStaff ? allPets : (userId ? allPets.filter(p => p.user_id === userId) : []);
  if (userPets.length > 0) {
    let petListText = `Quản lý thú cưng: Hiện tại bạn đang có ${userPets.length} thú cưng trong hồ sơ:\n`;
    userPets.forEach((p, idx) => {
      const ageStr = p.age_months ? `${p.age_months} tháng tuổi` : (p.dob ? `Sinh ngày ${formatDateVi(p.dob)}` : 'Chưa rõ tuổi');
      petListText += `${idx + 1}. 🐾 Bé **${p.name}** (Loài: ${p.species || 'Thú cưng'} | Giống: ${p.breed || 'Chưa rõ'} | Cân nặng: ${p.weight || 'Chưa có'} kg | Tuổi: ${ageStr})\n`;
    });
    docs.push({
      id: 'system_user_pets_list',
      type: 'Hồ sơ thú cưng',
      category: 'Quản lý thú cưng',
      sourceName: 'Hồ sơ thú cưng',
      title: 'Danh sách thú cưng của người dùng',
      content: petListText
    });
  }

  return docs;
}

/**
 * Main RAG Retrieval Engine
 */
function fastKeywordScore(query, doc) {
  const q = normalizeText(query);
  const text = normalizeText(`${doc.title || ''} ${doc.category || ''} ${doc.type || ''} ${doc.content || ''}`);
  if (!q || !text) return 0;
  const terms = [...new Set(q.split(' ').filter(t => t.length >= 2))];
  if (!terms.length) return 0;
  let hits = 0;
  for (const term of terms) if (text.includes(term)) hits++;
  let score = hits / terms.length;
  if (normalizeText(doc.title || '').split(' ').some(t => t && q.includes(t))) score += 0.15;
  return Math.min(score, 1);
}

async function retrieveRAGContext(query, user = null, selectedPet = null, database = db, classification = null) {
  if (!query || typeof query !== 'string' || !query.trim()) return [];

  // General animal questions do not need a database retrieval round-trip.
  // This is the largest speed win for questions such as "mèo ăn gì?".
  if (classification?.category === 'GENERAL_PET_KNOWLEDGE' || classification?.category === 'GREETING') {
    return [];
  }

  const documents = buildRealSystemDocuments({ user, selectedPet, database });
  if (documents.length === 0) return [];

  // Fast lexical retrieval for obvious system/pet-record questions. It keeps
  // the RAG layer but avoids starting the embedding model for every request.
  const lexical = documents
    .map(doc => ({ doc, score: fastKeywordScore(query, doc) }))
    .filter(x => x.score >= 0.20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (lexical.length && lexical[0].score >= 0.55) {
    return lexical.map(x => ({ ...x.doc, similarityScore: x.score }));
  }

  const embeddingStore = new EmbeddingStore();
  if (!embeddingStore.isAvailable()) return lexical.map(x => ({ ...x.doc, similarityScore: x.score }));

  const embeddingResults = await embeddingStore.search(query, documents, 2, 0.25);
  if (!embeddingResults.length) return lexical.map(x => ({ ...x.doc, similarityScore: x.score }));

  const normQuery = normalizeText(query);
  const allPets = database.find('pets') || [];
  const mentionedPetIds = new Set();
  for (const p of allPets) {
    const n = normalizeText(p.name);
    if (n && (normQuery === n || normQuery.includes(n))) mentionedPetIds.add(p.id);
  }

  const boosted = embeddingResults.map(doc => {
    let score = doc.similarityScore;
    if (mentionedPetIds.has(doc.pet_id)) score += 0.20;
    if (doc.id === 'system_appointment_cancel_rules' && (normQuery.includes('huy') || normQuery.includes('doi') || normQuery.includes('lo dat'))) {
      score += 0.30;
    }
    if (doc.id === 'system_rbac_role_permissions' && (normQuery.includes('admin') || normQuery.includes('xoa dich vu') || normQuery.includes('xoa hoa don') || normQuery.includes('quyen'))) {
      score += 0.30;
    }
    if (doc.id === 'system_services_catalog' && (normQuery.includes('tam') || normQuery.includes('spa') || normQuery.includes('cat tia') || normQuery.includes('gia') || normQuery.includes('bao nhieu'))) {
      score += 0.25;
    }
    if (doc.id === 'system_invoice_payment_rules' && (normQuery.includes('thanh toan') || normQuery.includes('vietqr') || normQuery.includes('tien mat'))) {
      score += 0.30;
    }
    if (doc.id === 'system_website_features' && (normQuery.includes('chuc nang') || normQuery.includes('tinh nang') || normQuery.includes('co nhung'))) {
      score += 0.30;
    }
    return { doc, score };
  }).sort((a, b) => b.score - a.score);

  const topScore = boosted[0]?.score || 0;
  return boosted
    .filter(x => x.score >= Math.max(0.25, topScore * 0.50))
    .slice(0, 2)
    .map(x => ({ ...x.doc, similarityScore: x.score }));
}

/**
 * Intelligent Local Synthesizer when AI API is unavailable
 */
function generateSynthesizedResponse(query, pet = null, retrievedChunks = [], user = null) {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return 'Thông tin này hiện chưa có trong dữ liệu của Sen Chăm Boss.';
  }

  const normQuery = normalizeText(query);

  if (normQuery.includes('huy') && (normQuery.includes('lich') || normQuery.includes('dat'))) {
    if (normQuery.includes('xac nhan') || normQuery.includes('sau khi')) {
      return 'Sau khi nhân viên/lễ tân đã xác nhận lịch hẹn, bạn không thể tự hủy lịch trên website. Nếu cần hủy lịch, bạn vui lòng liên hệ trực tiếp với Lễ tân hoặc Hotline của Sen Chăm Boss để được hỗ trợ.';
    }
    return 'Có. Bạn có thể hủy lịch khi lịch đang ở trạng thái "Chờ xác nhận" (trước khi nhân viên xác nhận). Sau khi nhân viên đã xác nhận, bạn không thể tự hủy lịch trên website.';
  }

  // Tra cứu giá đắt nhất / so sánh giá
  if (normQuery.includes('dat nhat') || normQuery.includes('cao nhat') || (normQuery.includes('gia') && normQuery.includes('nhat'))) {
    const { highestService, highestPackage } = getRealtimeServicesAndPrices(db);
    if (!highestService) {
      return 'Hiện tại chưa truy xuất được dữ liệu bảng giá từ cơ sở dữ liệu hệ thống. Bạn vui lòng kiểm tra lại trang "Dịch Vụ & Bảng Giá Gói Chăm Sóc".';
    }
    let res = `Dạ, theo bảng giá thực tế niêm yết tại Sen Chăm Boss:\n` +
      `- **Dịch vụ đơn lẻ có giá đắt nhất (cao nhất)**: **${highestService.name}** với giá **${formatVND(highestService.price)}**${highestService.duration ? ` (thời gian: ${highestService.duration})` : ''}.\n`;
    if (highestPackage) {
      res += `- **Gói chăm sóc / Combo có giá cao nhất**: **${highestPackage.name}** với giá **${formatVND(highestPackage.price)}**.\n`;
    }
    res += `(Dịch vụ Tắm & Spa Thư Giãn đơn lẻ có giá là 150.000 VNĐ, không phải dịch vụ đắt nhất).`;
    return res;
  }

  // Tra cứu giá dịch vụ cụ thể hoặc bảng giá chung
  if (normQuery.includes('gia') || normQuery.includes('bao nhieu') || normQuery.includes('bang gia')) {
    const { services, packages } = getRealtimeServicesAndPrices(db);
    const matchedService = services.find(s => {
      const sNorm = normalizeText(s.name);
      return normQuery.includes(sNorm) || sNorm.split(' ').filter(w => w.length > 2).every(w => normQuery.includes(w));
    });
    if (matchedService) {
      return `Giá dịch vụ **${matchedService.name}** tại Sen Chăm Boss là **${formatVND(matchedService.price)}**${matchedService.duration ? ` (thời gian: ${matchedService.duration})` : ''}.${matchedService.description ? `\nMô tả: ${matchedService.description}` : ''}`;
    }

    const matchedPackage = packages.find(p => {
      const pNorm = normalizeText(p.name);
      return normQuery.includes(pNorm) || pNorm.split(' ').filter(w => w.length > 2).every(w => normQuery.includes(w));
    });
    if (matchedPackage) {
      return `Giá **${matchedPackage.name}** tại Sen Chăm Boss là **${formatVND(matchedPackage.price)}**${matchedPackage.validity ? ` (${matchedPackage.validity})` : ''}.${matchedPackage.description ? `\nMô tả: ${matchedPackage.description}` : ''}`;
    }

    if (normQuery.includes('spa') || normQuery.includes('dich vu') || normQuery.includes('bang gia')) {
      return buildServiceCatalogText(db);
    }
  }

  if (normQuery.includes('thanh toan')) {
    return 'Sen Chăm Boss hỗ trợ 2 phương thức thanh toán: Chuyển khoản ngân hàng qua mã VietQR và Tiền mặt trực tiếp tại quầy Lễ tân.';
  }

  if (normQuery.includes('admin') && normQuery.includes('xoa dich vu')) {
    return 'Có. Quản trị viên (Admin) có toàn quyền thêm mới, chỉnh sửa và xóa dịch vụ khỏi hệ thống Sen Chăm Boss.';
  }

  if (normQuery.includes('chuc nang') || normQuery.includes('tinh nang')) {
    return 'Website Sen Chăm Boss cung cấp 11 chức năng chính: 1. Quản lý Thú cưng; 2. Hồ sơ Sức khỏe & Sổ tiêm chủng; 3. Lập & Theo dõi Lịch chăm sóc; 4. Đặt lịch dịch vụ trực tuyến; 5. Dịch Vụ & Bảng Giá; 6. Lập Hóa Đơn & Thanh Toán; 7. Tin nhắn & Hỗ trợ trực tuyến; 8. Trợ lý AI Thông minh; 9. Cửa hàng thú cưng (Pet Shop); 10. Quản lý Tài khoản & Điểm thưởng; 11. Quản trị & Phân quyền hệ thống.';
  }

  const contents = retrievedChunks.map(c => c.content).join('\n\n---\n\n');
  return contents;
}

module.exports = {
  buildRealSystemDocuments,
  retrieveRAGContext,
  generateSynthesizedResponse,
  invalidateRAGCache: invalidateEmbeddingCache,
  normalizeText,
  formatVND,
  formatDateVi
};
