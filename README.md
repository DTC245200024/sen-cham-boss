# 🐾 Sen Chăm Boss - Hệ Thống Quản Lý Chăm Sóc Thú Cưng Tích Hợp AI

> **Website quản lý dịch vụ, chăm sóc thú cưng toàn diện kết hợp Trợ lý Trí tuệ Nhân tạo (AI Assistant) & RAG thông minh.**

---

## 📌 Giới Thiệu Dự Án

**Sen Chăm Boss** là nền tảng quản lý chăm sóc thú cưng hiện đại dành cho các phòng khám thú y, spa thú cưng và các chủ nuôi. Hệ thống cung cấp giải pháp trọn gói từ quản lý hồ sơ thú cưng, lịch tiêm phòng/chăm sóc, đặt lịch dịch vụ, thanh toán hóa đơn đến tích hợp Trợ lý AI thế hệ mới giúp tóm tắt hồ sơ bệnh án và tư vấn dinh dưỡng, sức khỏe cho đa dạng các loài thú cưng.

---

## ✨ Tính Năng Nổi Bật

### 1. 🐶 Quản Lý Hồ Sơ Thú Cưng & Sức Khỏe
- Quản lý thông tin chi tiết: tên, giống loài, giới tính, ngày sinh/tuổi, mã thú cưng, cân nặng và ảnh đại diện.
- Biểu đồ theo dõi lịch sử cân nặng theo thời gian.
- Hồ sơ y tế, bệnh án, nhật ký chăm sóc, sổ tiêm chủng và tẩy giun.
- **Nút "AI Tóm Tắt & Gợi Ý":** Phân tích toàn bộ lịch sử khám bệnh và đưa ra khuyến nghị chăm sóc chuyên sâu.

### 2. ⏰ Nhắc Lịch AI & Lịch Chăm Sóc
- Tự động hóa lịch nhắc nhở: Cho ăn, Tắm rửa, Cắt móng/Grooming, Tẩy giun, Tiêm phòng định kỳ.
- Trí tuệ nhân tạo tự động phân tích hồ sơ và đề xuất các lịch chăm sóc cần thiết.
- Hỗ trợ lọc theo trạng thái: Hôm nay, Tuần này, Tháng này, Quá hạn, Đã hoàn thành.

### 3. ✂️ Dịch Vụ & Gói Dịch Vụ Tiết Kiệm
- **Danh Sách Dịch Vụ:** Phân loại theo Tắm & Spa, Cắt tỉa lông, Khám bệnh, Tiêm phòng, Khách sạn thú cưng...
- **Gói Combo Tiết Kiệm:** Tạo các gói ưu đãi theo thời hạn sử dụng kèm chính sách giá gốc / giá khuyến mãi.
- Chức năng thêm/sửa/xóa dịch vụ và gói combo trực quan (dành riêng cho Admin).

### 4. 📅 Đặt Lịch Hẹn & Phân Công Nhân Viên
- Khách hàng đặt lịch hẹn trực tuyến nhanh chóng theo khung giờ và dịch vụ mong muốn.
- Hệ thống phân công nhiệm vụ chăm sóc cho Nhân viên chăm sóc (`CARE_STAFF`).
- Nhân viên có thể xác nhận, thực hiện và đánh dấu hoàn thành nhiệm vụ.

### 5. 💳 Quản Lý Hóa Đơn & Doanh Thu
- Tự động xuất hóa đơn khi hoàn thành dịch vụ hoặc thanh toán lịch hẹn.
- Hỗ trợ thanh toán tiền mặt và chuyển khoản thông minh qua **VietQR**.
- Thống kê doanh thu theo tuần, tháng, phân tích doanh thu theo danh mục dịch vụ.

### 6. 🤖 Trợ Lý AI Chuyên Nghiệp (Gemini + Local Ollama RAG)
- **Hỗ trợ đa nguồn tri thức:** Vừa am hiểu dữ liệu hệ thống (RAG từ bảng giá, dịch vụ, lịch sử thú cưng), vừa có kiến thức thú y mở rộng về mọi loài vật (chó, mèo, bò sát, chim cảnh, thỏ, hamster...).
- Hỗ trợ chạy Hybrid: Google Gemini Cloud API hoặc Local LLM (Ollama Qwen2.5 + bge-m3) đảm bảo tốc độ cao và bảo mật dữ liệu.

### 7. 👥 Phân Quyền Vai Trò (RBAC) Chuẩn Hóa
- **Admin (Quản lý hệ thống):** Hợp nhất quyền Quản trị viên và Quản lý cửa hàng, toàn quyền quản trị tài khoản, dịch vụ, tài chính và phân công.
- **Lễ tân (RECEPTIONIST):** Tiếp đón khách, duyệt lịch hẹn, tạo hóa đơn.
- **Nhân viên chăm sóc (CARE_STAFF):** Thực hiện các ca chăm sóc được phân công.
- **Chủ nuôi / Khách hàng (USER):** Quản lý thú cưng của mình, đặt lịch, trò chuyện với Trợ lý AI.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Backend:** Node.js, Express.js (RESTful APIs, JWT Authentication, Cookie Parser).
- **Frontend:** Vanilla HTML5, CSS3 hiện đại (Flexbox/Grid, Glassmorphism, CSS Custom Properties), JavaScript (ES6+ Modules).
- **Database:** JSON File-based DB Engine (`config/database.js`) gọn nhẹ, tốc độ cao, hỗ trợ tự động lưu và khôi phục.
- **Trí tuệ nhân tạo (AI):**
  - Google Gemini API (`@google/genai`, `@google/generative-ai`).
  - Local Ollama Engine (LLM: `qwen2.5:3b`, Embedding: `bge-m3` đa ngôn ngữ).
  - Thuật toán RAG tìm kiếm ngữ nghĩa theo Cosine Similarity và Vector Cache.
- **Mạng & Đa thiết bị:** Hỗ trợ lắng nghe trên `0.0.0.0` (LAN) và tích hợp sẵn `tunnel.js` (SSH / Localtunnel) để truy cập Internet từ xa.

---

## 📂 Cấu Trúc Thư Mục Dự Án

```text
Web Chăm Sóc Thú Cưng/
├── config/
│   └── database.js          # Module quản lý cơ sở dữ liệu JSON
├── data/
│   ├── db.json              # Dữ liệu chính (users, pets, services, appointments,...)
│   └── rag_embeddings.json  # Vector cache của hệ thống RAG
├── middleware/
│   └── auth.js              # Middleware xác thực JWT & kiểm tra phân quyền RBAC
├── public/
│   ├── css/                 # Stylesheet giao diện
│   ├── js/                  # JavaScript logic frontend theo từng chức năng
│   │   ├── app.js           # Điều hướng màn hình, sidebar và khởi tạo app
│   │   ├── auth.js          # Đăng nhập, đăng ký, đăng xuất
│   │   ├── pets.js          # Quản lý thú cưng
│   │   ├── health.js        # Hồ sơ sức khỏe, cân nặng, tiêm chủng
│   │   ├── schedule.js      # Nhắc lịch AI & lịch chăm sóc
│   │   ├── services.js      # Danh sách dịch vụ & gói tiết kiệm
│   │   ├── appointments.js  # Đặt lịch hẹn khám & spa
│   │   ├── invoices.js      # Hóa đơn & thanh toán VietQR
│   │   ├── revenue.js       # Thống kê doanh thu
│   │   ├── ai.js            # Giao diện chat Trợ lý AI & tóm tắt hồ sơ
│   │   ├── adminAccounts.js # Quản lý tài khoản hệ thống (Admin)
│   │   └── adminSettings.js # Cấu hình phân quyền & hệ thống
│   ├── uploads/             # Ảnh đại diện thú cưng & avatar người dùng
│   └── index.html           # File giao diện Single-Page Application (SPA)
├── routes/
│   ├── authRoutes.js        # API đăng nhập, đăng ký, profile
│   ├── petRoutes.js         # API thú cưng
│   ├── healthRoutes.js      # API hồ sơ sức khỏe & cân nặng
│   ├── scheduleRoutes.js    # API lịch chăm sóc & tiêm phòng
│   ├── serviceRoutes.js     # API dịch vụ & gói dịch vụ
│   ├── appointmentRoutes.js # API đặt lịch hẹn & phân công
│   ├── invoiceRoutes.js     # API hóa đơn & doanh thu
│   ├── chatRoutes.js        # API Trợ lý AI & RAG Engine
│   ├── userRoutes.js        # API quản lý người dùng
│   └── systemSettingsRoutes.js # API cài đặt hệ thống
├── utils/
│   ├── geminiEngine.js      # Tích hợp Google Gemini API
│   ├── ollamaEngine.js      # Tích hợp Ollama Local LLM
│   ├── ragEngine.js         # Thuật toán Vector Search RAG
│   └── domainClassifier.js  # Phân loại câu hỏi hệ thống vs thú y chuyên sâu
├── .env.example             # File mẫu biến môi trường
├── package.json             # Danh sách dependencies & scripts
├── server.js                # Server chính khởi động Express
└── tunnel.js                # Công cụ mở link truy cập Internet từ xa
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 18.x trở lên.
- **npm**: Đi kèm với Node.js.
- *(Tùy chọn)* **Ollama**: Nếu muốn sử dụng AI hoàn toàn cục bộ (offline).

### 2. Cài Đặt Thư Viện
Mở terminal tại thư mục gốc dự án và chạy:
```bash
npm install
```

### 3. Thiết Lập Biến Môi Trường (`.env`)
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```
Cấu hình các thông số cần thiết trong `.env`:
```env
PORT=3002
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Tùy chọn AI Cục Bộ (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_EMBED_MODEL=bge-m3
USE_LOCAL_EMBEDDINGS=true
LOCAL_EMBED_FALLBACK_GEMINI=false
```

### 4. Khởi Chạy Server
Chạy ứng dụng:
```bash
npm start
# Hoặc chạy môi trường phát triển:
npm run dev
```
Sau khi khởi động thành công, mở trình duyệt và truy cập:
👉 **`http://localhost:3002`**

---

## 🌐 Chia Sẻ Link Cho Các Máy Khác & Điện Thoại Truy Cập

Hệ thống hỗ trợ sẵn tính năng kết nối đa thiết bị:

### 1. Truy cập qua mạng Wi-Fi nội bộ
Các thiết bị (điện thoại, laptop) dùng chung mạng Wi-Fi có thể truy cập trực tiếp qua IP máy chủ:
```text
http://<IP_MAY_CHU>:3002
Ví dụ: http://172.20.10.7:3002
```

### 2. Mở link Online toàn cầu (Internet Tunnel)
Chạy script:
```bash
node tunnel.js
```
Hệ thống sẽ cung cấp link bảo mật HTTPS (không cần mở port router):
- **Link trực tiếp không cần mật khẩu:** `https://<random_subdomain>.lhr.life`
- **Link Localtunnel dự phòng:** `https://<subdomain>.loca.lt`

---

## 🔑 Tài Khoản Mặc Định Kiểm Thử

Hệ thống có sẵn các tài khoản demo tương ứng với từng phân quyền:

| Tài khoản (Username) | Mật khẩu (Password) | Vai trò (Role) | Mô tả quyền hạn |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **Admin (Quản lý hệ thống)** | Toàn quyền cấu hình, tài khoản, dịch vụ, hóa đơn, thống kê |
| **`staff`** | `staff123` | **Nhân viên (CARE_STAFF)** | Xem lịch chăm sóc được phân công, cập nhật trạng thái |
| **`reception`** | `reception123` | **Lễ tân (RECEPTIONIST)** | Tiếp đón, quản lý lịch hẹn khám và xuất hóa đơn |
| **`user1`** | `user123` | **Chủ nuôi (USER)** | Đặt lịch, theo dõi hồ sơ thú cưng, trò chuyện cùng AI |

---

## 🧠 Hướng Dẫn Cấu Hình AI Cục Bộ (Local AI)

Nếu muốn tăng tốc RAG và chạy không phụ thuộc vào kết nối mạng ngoài:
1. Cài đặt [Ollama](https://ollama.ai).
2. Tải mô hình ngôn ngữ và mô hình embedding:
   ```bash
   ollama pull qwen2.5:3b
   ollama pull bge-m3
   ```
3. Chạy lệnh làm ấm cache embedding:
   ```bash
   npm run rag:warm-local
   ```

---

## 📝 Bản Quyền & Giấy Phép

Dự án được xây dựng phục vụ học tập, nghiên cứu và ứng dụng thực tế giải pháp chăm sóc thú cưng ứng dụng AI.  
Phát triển bởi nhóm tác giả **Sen Chăm Boss**. Giấy phép **ISC License**.
