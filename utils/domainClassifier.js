/**
 * =======================================================================
 * SEN CHĂM BOSS - DOMAIN & INTENT CLASSIFIER (ALL PETS & ANIMALS EXPANDED)
 * =======================================================================
 * Xác định chính xác phạm vi câu hỏi:
 * 1. Sen Chăm Boss (Hồ sơ, lịch hẹn, bảng giá, hóa đơn, admin, quy định, chức năng website...)
 * 2. Kiến thức động vật & thú cưng toàn diện (Chó, mèo, rùa, rắn, thỏ, hamster, chim, cá, nhím, bò sát, dinh dưỡng, sức khỏe, tập tính...)
 * 3. Ngoài phạm vi (Lập trình, thời tiết, làm thơ, tin tức, bóng đá, toán học, chứng khoán...)
 */

function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[.,?!:;'"()[\]{}_\\/`~@#$%^&*+=<> -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OUT_OF_SCOPE_RESPONSE = 'Xin lỗi, tôi chỉ hỗ trợ các thông tin về Sen Chăm Boss và kiến thức liên quan đến động vật, thú cưng.';
const MISSING_DATA_RESPONSE = 'Thông tin này hiện chưa có trong dữ liệu của Sen Chăm Boss.';

// Explicitly banned / out-of-scope non-pet, non-system patterns
const OUT_OF_SCOPE_PATTERNS = [
  // Programming & IT general knowledge
  /\b(python|java|javascript|golang|c\+\+|c#|php|ruby|rust|swift|kotlin|typescript|html|css|react|vue|angular|django|flask|spring boot)\b/i,
  /\b(viet code|lap trinh|thuat toan|viet chuong trinh|sua loi code|debug code|cau truc du lieu)\b/i,
  
  // General sciences & math
  /\b(giai toan|phuong trinh|tich phan|dao ham|hinh hoc|dai so|hoa hoc|vat ly|sinh hoc nguoi)\b/i,
  
  // Finance, stocks, crypto (unrelated to pet store payment)
  /\b(chung khoan|bitcoin|crypto|tien dien tu|co phieu|bat dong san|dau tu tai chinh|ty gia usd|thi truong vang)\b/i,
  
  // Politics, history, geography
  /\b(chinh tri|bau cu|chien tranh|quan su|dang cong san|tong thong|thu do|dien tich nuoc|dan so the gioi|lich su the gioi|lich su viet nam)\b/i,
  
  // Creative writing / Entertainment / General news & weather
  /\b(viet (cho toi )?(mot )?bai tho|lam tho|sang tac tho|ke chuyen cuoi|ke chuyen ma|viet van|viet tieu thuyet|tan gai|hen ho)\b/i,
  /\b(thoi tiet|du bao thoi tiet|nhiet do hom nay|tin tuc hom nay|tin tuc thoi su|thoi su hom nay)\b/i,
  /\b(bong da|world cup|ngoai hang anh|champions league|euro|tennis|cau long|game lien quan|pubg|fifa)\b/i,
  
  // Human medical / affairs
  /\b(nguoi lon|tre em|em be|phu nu mang thai|ba bau|bau bi|hoc sinh|sinh vien|kham suc khoe nguoi)\b/i
];

// In-scope keywords related to Sen Chăm Boss AND All Pets / Animals
const IN_SCOPE_KEYWORDS = [
  // 1. Sen Chăm Boss system keywords
  'sen cham boss', 'sen', 'boss', 'he thong', 'website', 'web', 'tinh nang', 'chuc nang', 'ung dung',
  'lich', 'dat lich', 'huy lich', 'doi lich', 'thay doi lich', 'hen', 'lich hen', 'lich cham soc', 'tao lich', 'lap lich',
  'dich vu', 'tam', 'spa', 'cat tia', 'grooming', 'cat mong', 've sinh tai', 'kham', 'tiem phong', 'vac xin', 'vaxin', 'tay giun', 'luu chuong', 'khach san',
  'gia', 'bang gia', 'bao nhieu tien', 'chi phi', 'don gia', 'phi', 'combo', 'goi',
  'hoa don', 'thanh toan', 'tien mat', 'vietqr', 'qr', 'chuyen khoan', 'ngan hang',
  'tai khoan', 'dang nhap', 'dang ky', 'phan quyen', 'quyen', 'admin', 'quan tri', 'le tan', 'nhan vien', 'care staff', 'receptionist', 'khach hang', 'chu nuoi', 'user',
  'xoa dich vu', 'sua dich vu', 'them dich vu', 'xoa hoa don', 'duyet lich',
  'cua hang', 'pet shop', 'san pham', 'thuc an', 'pate', 'hat', 'phu kien', 'cat ve sinh',
  'ho so', 'so suc khoe', 'suc khoe', 'so tiem', 'benh an', 'tiem chung',

  // 2. All Animals & Pet Species (Không giới hạn chó mèo)
  'thu cung', 'thu nuoi', 'dong vat', 'pet', 'animal', 'thu canh', 'kieng', 'canh',
  'cho', 'cun', 'cún', 'chó', 'puppy', 'dog',
  'meo', 'miu', 'mèo', 'kitten', 'cat',
  'rua', 'rùa', 'rua nuoc', 'rua can', 'turtle', 'tortoise',
  'ran', 'rắn', 'snake',
  'tho', 'thỏ', 'rabbit', 'bunny',
  'hamster', 'chuot', 'chuột', 'chuot canh', 'chuot lang', 'guinea pig', 'chinchilla', 'gerbil',
  'chim', 'vet', 'vẹt', 'yen phung', 'yến phụng', 'chao mao', 'chào mào', 'hoa mi', 'họa mi', 'chich choe', 'chích chòe', 'bo cau', 'bồ câu', 'bird', 'parrot',
  'ca', 'cá', 'ca canh', 'ca vang', 'betta', 'guppy', 'ca rong', 'thuy sinh', 'tep', 'tep canh', 'fish',
  'nhim', 'nhím', 'nhim kieng', 'hedgehog',
  'bo sat', 'bò sát', 'reptile', 'ky da', 'kỳ đà', 'tac ke', 'tắc kè', 'gecko', 'iguana', 'rong uc', 'rồng úc', 'bearded dragon', 'than lan', 'thằn lằn',
  'chon', 'chồn', 'ferret', 'soc', 'sóc', 'soc bay', 'sugar glider',

  // 3. Animal Behaviors, Care, Nutrition, Health & Biology
  'an gi', 'an duoc khong', 'uong gi', 'uong duoc khong', 'dinh duong', 'thuc an', 'khau phan', 'trung', 'thit', 'rau', 'co', 'trai cay', 'pate', 'hat', 'sua', 'xuong', 'socola', 'hanh tay', 'toi', 'nho',
  'biet keu', 'keu', 'tieng keu', 'sua', 'hot', 'rieng', 'rit', 'ren', 'suyt',
  'khong chiu an', 'bo an', 'khong an', 'bo uong', 'u ru', 'nam mot cho', 'met moi', 'lo do', 'sot', 'non', 'oi', 'tieu chay', 'ia chay', 'phan long', 'co giat', 'kho tho', 'tho gap', 'tao bon', 'táo bón', 'kho di ve sinh', 'kho di ngoai', 'bi tao', 'phan cung', 'bi tieu', 'kho di tieu',
  'ngua', 'rung long', 'rung vay', 'thay long', 'lot da', 'thay da', 'viem tai', 'nam da', 'ghe', 've', 'ran', 'bo chet', 'ky sinh trung',
  'ngu dong', 'den suoi', 'nhiet do', 'do am', 'chuong', 'long', 'be ca', 'be kinh', 'lot chuong', 'cat ve sinh',
  'sinh san', 'de trung', 'de con', 'dong duc', 'giao phoi', 'ap trung',
  'cach cham soc', 'cach tam', 've sinh', 'huan luyen', 'tap tinh', 'moi truong song', 'tuoi tho', 'can', 'cap', 'canh bao',
  'tay giun', 'tiem phong', 'kham benh', 'thu y', 'bac si thu y', 'uong thuoc', 'so cuu', 'bao lau', 'may thang', 'may tuan', 'khi nao',
  'be', 'em', 'con'
];

/**
 * Classifies if the query belongs to Sen Chăm Boss or Pet Care domain
 */
function classifyDomain(query) {
  if (!query || typeof query !== 'string') {
    return { isAllowed: false, reason: 'EMPTY_QUERY' };
  }

  const norm = normalizeText(query);
  if (!norm) {
    return { isAllowed: false, reason: 'EMPTY_NORMALIZED' };
  }

  // 1. Check explicit out-of-scope patterns
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(norm) || pattern.test(query)) {
      const hasPetOrAnimalKeyword = [
        'sen cham boss', 'thu cung', 'dong vat', 'cho', 'meo', 'cun', 'boss', 'pet', 'miu',
        'rua', 'ran', 'tho', 'hamster', 'chuot', 'chim', 'ca', 'nhim', 'bo sat', 'vet'
      ].some(k => norm.includes(k));
      
      const isPureOffTopic = /\b(python|java|javascript|c\+\+|viet (cho toi )?(mot )?bai tho|lam tho|thoi tiet|tin tuc|giai toan|world cup|thu do|chung khoan|bitcoin|ty gia)\b/i.test(norm);
      if (!hasPetOrAnimalKeyword || isPureOffTopic) {
        return {
          isAllowed: false,
          category: 'OUT_OF_SCOPE',
          reason: 'BANNED_PATTERN_MATCHED'
        };
      }
    }
  }

  // 2. Check if it matches any Sen Chăm Boss / Animal keywords
  const matchesInScope = IN_SCOPE_KEYWORDS.some(k => norm.includes(k));

  if (!matchesInScope) {
    const greetings = ['xin chao', 'chao ban', 'hello', 'hi', 'alo', 'ban la ai', 'tro ly gi', 'giup gi'];
    if (greetings.some(g => norm.includes(g))) {
      return {
        isAllowed: true,
        category: 'GREETING',
        intent: 'GREETING'
      };
    }
    return {
      isAllowed: false,
      category: 'OUT_OF_SCOPE',
      reason: 'NO_DOMAIN_KEYWORDS'
    };
  }

  // 3. Determine Category & Intent
  let category = 'GENERAL_PET_KNOWLEDGE';
  let intent = 'TRA_CUU_CHUNG';
  let targetPetName = null;

  // Specific pet query detection
  const petNamePatterns = [
    /tinh trang (be|em|con|thu cung|cho|meo|rua|ran|tho|hamster|chim|ca|nhim)\s+([a-zA-Z0-9_\u00C0-\u1EF9]+)/i,
    /(be|em|con)\s+([a-zA-Z0-9_\u00C0-\u1EF9]+)\s+(nha toi|cua toi|trong he thong|hien tai|gan day|duoc cham soc|sao roi|the nao|dang)/i,
    /ho so (cua |ve )?(be|em|con)?\s*([a-zA-Z0-9_\u00C0-\u1EF9]+)/i
  ];
  for (const pat of petNamePatterns) {
    const match = query.match(pat);
    if (match) {
      category = 'SPECIFIC_PET_DATA';
      intent = 'XEM_HO_SO_THU_CUNG';
      targetPetName = match[2] || match[3] || null;
      break;
    }
  }

  if (norm.includes('nha toi') || norm.includes('cua toi') || norm.includes('trong he thong') || norm.includes('be miu') || norm.includes('be ngan') || norm.includes('be ngong') || norm.includes('be rua')) {
    category = 'SPECIFIC_PET_DATA';
  }

  // Sen Chăm Boss system intents
  const isCancelOrReschedule = (
    norm.includes('huy lich') || norm.includes('doi lich') || norm.includes('thay doi lich') ||
    (norm.includes('huy') && (norm.includes('lich') || norm.includes('dat') || norm.includes('xac nhan'))) ||
    (norm.includes('doi') && (norm.includes('lich') || norm.includes('dat'))) ||
    norm.includes('lo dat') || norm.includes('toi muon huy')
  );

  if (isCancelOrReschedule) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'HUY_THAY_DOI_LICH';
  } else if (norm.includes('dat lich') || norm.includes('tao lich') || (norm.includes('cach') && norm.includes('dat') && norm.includes('lich')) || norm.includes('hen')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'DAT_LICH';
  } else if (norm.includes('gia') || norm.includes('bang gia') || norm.includes('bao nhieu tien') || norm.includes('chi phi') || norm.includes('don gia')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'BANG_GIA_DICH_VU';
  } else if (norm.includes('thanh toan') || norm.includes('hoa don') || norm.includes('vietqr') || norm.includes('tien mat')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'THANH_TOAN_HOA_DON';
  } else if (norm.includes('admin') || norm.includes('quan tri') || norm.includes('xoa dich vu') || norm.includes('sua dich vu') || norm.includes('xoa hoa don') || norm.includes('quyen')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'QUYEN_HAN_TAC_NHAN';
  } else if (norm.includes('chuc nang') || norm.includes('tinh nang') || norm.includes('website') || norm.includes('co nhung')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'CHUC_NANG_WEBSITE';
  } else if (norm.includes('pet shop') || norm.includes('cua hang') || norm.includes('mua') || norm.includes('cat ve sinh')) {
    category = 'SEN_CHAM_BOSS_SYSTEM';
    intent = 'PET_SHOP';
  } else if (
    norm.includes('non') || norm.includes('oi') || norm.includes('tieu chay') || norm.includes('sot') || norm.includes('bo an') || norm.includes('khong chiu an') || norm.includes('co giat') || norm.includes('kho tho')
  ) {
    if (category !== 'SPECIFIC_PET_DATA') category = 'GENERAL_PET_KNOWLEDGE';
    intent = 'SUC_KHOE_THU_CUNG';
  } else if (
    norm.includes('an duoc') || norm.includes('trung') || norm.includes('thit') || norm.includes('dinh duong') || norm.includes('an gi')
  ) {
    if (category !== 'SPECIFIC_PET_DATA') category = 'GENERAL_PET_KNOWLEDGE';
    intent = 'DINH_DUONG_THU_CUNG';
  } else if (
    norm.includes('tay giun') || norm.includes('tiem phong') || norm.includes('bao lau') || norm.includes('may thang')
  ) {
    if (category !== 'SPECIFIC_PET_DATA') category = 'GENERAL_PET_KNOWLEDGE';
    intent = 'TIEM_PHONG_TAY_GIUN';
  }

  return {
    isAllowed: true,
    category,
    intent,
    targetPetName
  };
}

module.exports = {
  classifyDomain,
  normalizeText,
  OUT_OF_SCOPE_RESPONSE,
  MISSING_DATA_RESPONSE
};
