require('dotenv').config();
const { spawn } = require('child_process');
const os = require('os');
const localtunnel = require('localtunnel');
const https = require('https');

const PORT = parseInt(process.env.PORT, 10) || 3002;

// Get Local LAN IPs
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, ip: iface.address });
      }
    }
  }
  return addresses;
}

// Get Public IP for localtunnel password
function getPublicIp() {
  return new Promise((resolve) => {
    https.get('https://loca.lt/mytunnelpassword', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data.trim()));
    }).on('error', () => {
      resolve('171.255.69.175');
    });
  });
}

let sshProcess = null;
let currentLhrUrl = '';
let currentLtUrl = '';
let publicPassword = '';

function startSshTunnel() {
  if (sshProcess) {
    try { sshProcess.kill(); } catch (e) {}
    sshProcess = null;
  }

  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', `80:localhost:${PORT}`,
    'nokey@localhost.run'
  ];

  sshProcess = spawn('ssh', args);

  sshProcess.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9.\-]+\.lhr\.life/);
    if (match) {
      currentLhrUrl = match[0];
      printBanner();
    }
  });

  sshProcess.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9.\-]+\.lhr\.life/);
    if (match) {
      currentLhrUrl = match[0];
      printBanner();
    }
  });

  sshProcess.on('close', (code) => {
    console.log(`[SSH Tunnel] Đã ngắt kết nối (code: ${code}). Đang kết nối lại sau 3s...`);
    setTimeout(startSshTunnel, 3000);
  });

  sshProcess.on('error', (err) => {
    console.error('[SSH Tunnel] Lỗi:', err.message);
    setTimeout(startSshTunnel, 3000);
  });
}

let ltTunnel = null;
async function startLocaltunnel() {
  try {
    publicPassword = await getPublicIp();
    const subdomain = 'senchamboss-' + Math.floor(1000 + Math.random() * 9000);
    ltTunnel = await localtunnel({ port: PORT, subdomain });
    currentLtUrl = ltTunnel.url;
    printBanner();

    ltTunnel.on('close', () => {
      console.log('[Localtunnel] Đã đóng. Khởi động lại sau 5s...');
      setTimeout(startLocaltunnel, 5000);
    });

    ltTunnel.on('error', (err) => {
      console.warn('[Localtunnel] Lỗi:', err.message);
      setTimeout(startLocaltunnel, 5000);
    });
  } catch (err) {
    console.error('[Localtunnel] Lỗi khởi tạo:', err.message);
    setTimeout(startLocaltunnel, 5000);
  }
}

function printBanner() {
  const localIps = getLocalIps();
  console.log('\n================================================================');
  console.log('🐾 SEN CHĂM BOSS - HỆ THỐNG TRUY CẬP ĐA THIẾT BỊ ĐÃ SẴN SÀNG! 🐾');
  console.log('================================================================');
  
  if (currentLhrUrl) {
    console.log(`🌐 1. LINK INTERNET TRỰC TIẾP (MỌI MÁY / 4G / NGOÀI NHÀ - KHÔNG CẦN PASS):`);
    console.log(`   👉 ${currentLhrUrl}`);
  }

  if (localIps.length > 0) {
    console.log(`\n📶 2. LINK MẠNG NỘI BỘ WI-FI (ĐIỆN THOẠI & LAPTOP CHUNG MẠNG - TỐC ĐỘ CỰC CAO):`);
    localIps.forEach(net => {
      console.log(`   👉 http://${net.ip}:${PORT}  (${net.name})`);
    });
  }

  if (currentLtUrl) {
    console.log(`\n🛡️ 3. LINK DỰ PHÒNG LOCALTUNNEL:`);
    console.log(`   👉 ${currentLtUrl}`);
    console.log(`   🔑 Mật khẩu (nếu web hỏi): ${publicPassword}`);
  }

  console.log('================================================================\n');
}

// Start both
startSshTunnel();
startLocaltunnel();
