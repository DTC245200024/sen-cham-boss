const localtunnel = require('localtunnel');
const http = require('https');
const httpLocal = require('http');

function getPublicIp() {
  return new Promise((resolve) => {
    http.get('https://loca.lt/mytunnelpassword', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data.trim()));
    }).on('error', () => {
      resolve('27.67.211.37');
    });
  });
}

let currentTunnel = null;
let isStarting = false;

async function checkTunnelHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 304) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startTunnel() {
  if (isStarting) return;
  isStarting = true;

  if (currentTunnel) {
    try {
      currentTunnel.close();
    } catch (e) {}
    currentTunnel = null;
  }

  try {
    const ip = await getPublicIp();
    const tunnel = await localtunnel({ port: 3000 });
    currentTunnel = tunnel;

    console.log('====================================================');
    console.log('🌐 SEN CHĂM BOSS - ONLINE INTERNET TUNNEL ĐANG CHẠY!');
    console.log(`🔗 Link truy cập:   ${tunnel.url}`);
    console.log(`🔑 Tunnel Password: ${ip}`);
    console.log('====================================================');

    tunnel.on('close', () => {
      console.log('⚠️ Tunnel đóng, tự động kết nối lại...');
      setTimeout(startTunnel, 2000);
    });

    tunnel.on('error', (err) => {
      console.warn('⚠️ Lỗi tunnel:', err.message);
      setTimeout(startTunnel, 3000);
    });

  } catch (err) {
    console.error('❌ Lỗi khởi tạo tunnel:', err.message);
    setTimeout(startTunnel, 4000);
  } finally {
    isStarting = false;
  }
}

// Health check interval every 15s to keep tunnel alive & restart if 503
setInterval(async () => {
  if (currentTunnel && currentTunnel.url) {
    const healthy = await checkTunnelHealth(currentTunnel.url);
    if (!healthy) {
      console.log('⚠️ Tunnel mất kết nối (503/timeout), khởi động lại link mới...');
      startTunnel();
    }
  } else if (!isStarting) {
    startTunnel();
  }
}, 15000);

startTunnel();
