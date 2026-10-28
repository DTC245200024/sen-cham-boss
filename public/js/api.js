/* =========================================================
   API CLIENT WRAPPER (Fetch API with JWT Auth Token)
   ========================================================= */

const API_BASE = '/api';

function getAuthToken() {
  return localStorage.getItem('petcare_token') || 
         localStorage.getItem('token') || 
         (window.currentUser && window.currentUser.token) || 
         '';
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    
    let json;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      json = await res.json();
    } else {
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      json = { success: true }; 
    }

    if (res.status === 401) {
      localStorage.removeItem('petcare_token');
      localStorage.removeItem('petcare_user');
      if (window.onAuthExpired) {
        window.onAuthExpired();
      }
    }

    if (!res.ok && !json.message) {
      json.message = `Lỗi hệ thống: ${res.status} ${res.statusText}`;
      json.success = false;
    }

    return json;
  } catch (err) {
    console.error(`API Error [${method} ${endpoint}]:`, err);
    return { success: false, message: `Lỗi kết nối: ${err.message}` };
  }
}

async function apiUpload(fileOrFormData) {
  const token = getAuthToken();
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body;
  if (fileOrFormData instanceof FormData) {
    body = fileOrFormData;
  } else if (fileOrFormData instanceof File || fileOrFormData instanceof Blob) {
    body = new FormData();
    body.append('image', fileOrFormData);
  } else {
    return { success: false, message: 'Dữ liệu file tải lên không hợp lệ.' };
  }

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers,
      body
    });

    let json;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      json = await res.json();
    } else {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      json = { success: true };
    }

    if (!res.ok && !json.message) {
      json.message = `Lỗi tải ảnh lên: ${res.status} ${res.statusText}`;
      json.success = false;
    }

    return json;
  } catch (err) {
    console.error('API Upload Error:', err);
    return { success: false, message: `Lỗi kết nối khi tải ảnh: ${err.message}` };
  }
}

window.apiRequest = apiRequest;
window.apiUpload = apiUpload;
window.getAuthToken = getAuthToken;
