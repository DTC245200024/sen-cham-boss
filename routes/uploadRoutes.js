const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueName = `prod_${Date.now()}_${Math.floor(Math.random() * 100000)}${ext}`;
    cb(null, uniqueName);
  }
});

// File Filter (JPG, JPEG, PNG, WEBP)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng ảnh không được hỗ trợ. Vui lòng chỉ tải lên ảnh JPG, JPEG, PNG hoặc WEBP.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max limit
  fileFilter
});

router.use(authenticateToken);

// POST /api/upload - Single File Image Upload
router.post('/', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ảnh quá lớn, vui lòng chọn ảnh khác.' });
      }
      return res.status(400).json({ success: false, message: `Không thể tải ảnh lên. Lỗi: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Định dạng ảnh không được hỗ trợ.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn 1 file ảnh từ thiết bị.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      message: 'Tải ảnh lên thành công!',
      url: fileUrl,
      filename: req.file.filename
    });
  });
});

// POST /api/upload/multiple - Multiple File Upload (Max 5 images)
router.post('/multiple', (req, res) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ảnh quá lớn, vui lòng chọn ảnh khác.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: 'Chỉ được phép tải lên tối đa 5 ảnh cho mỗi sản phẩm.' });
      }
      return res.status(400).json({ success: false, message: `Không thể tải ảnh lên. Lỗi: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Định dạng ảnh không được hỗ trợ.' });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 file ảnh từ thiết bị.' });
    }

    const fileUrls = req.files.map(f => `/uploads/${f.filename}`);
    return res.json({
      success: true,
      message: 'Tải các ảnh lên thành công!',
      urls: fileUrls,
      url: fileUrls[0],
      filenames: req.files.map(f => f.filename)
    });
  });
});

module.exports = router;

