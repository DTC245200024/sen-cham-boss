const fs = require('fs');
const path = require('path');
const http = require('http');

async function run() {
  try {
    // 1. Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@petcare.com', password: 'Admin@123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error('Login failed: ' + loginData.message);
    const token = loginData.token;
    console.log('Login successful');

    // 2. Fetch users to get an ID
    const usersRes = await fetch('http://localhost:3000/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const usersData = await usersRes.json();
    if (!usersData.success) throw new Error('Fetch users failed');
    const targetUser = usersData.users[0];
    console.log('Target user:', targetUser.full_name, targetUser.id);

    // 3. Create a dummy test file
    const dummyPath = path.join(__dirname, 'test-avatar.txt');
    fs.writeFileSync(dummyPath, 'not a real image, just for testing upload');

    // 4. Upload file using FormData (node 18+)
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(dummyPath)], { type: 'image/jpeg' });
    formData.append('image', blob, 'test-avatar.jpg');

    const uploadRes = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error('Upload failed: ' + uploadData.message);
    console.log('Upload successful:', uploadData.url);

    // 5. Update user avatar
    const updateRes = await fetch(`http://localhost:3000/api/users/${targetUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        full_name: targetUser.full_name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        avatar: uploadData.url
      })
    });
    const updateData = await updateRes.json();
    if (!updateData.success) throw new Error('Update failed: ' + updateData.message);
    console.log('Update successful, new avatar:', updateData.user.avatar);
    
    console.log('ALL TESTS PASSED!');
  } catch (err) {
    console.error('TEST FAILED:', err);
  }
}

run();
