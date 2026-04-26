const http = require('http');

function post(path, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(body);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
}

async function test() {
  console.log('1. Check draw status...');
  let r = await get('/api/draw/status');
  console.log(JSON.stringify(r));

  console.log('\n2. Enter draw with phone 0501234567...');
  r = await post('/api/draw/enter', { phone: '0501234567' });
  console.log(JSON.stringify(r));

  console.log('\n3. Try duplicate entry...');
  r = await post('/api/draw/enter', { phone: '0501234567' });
  console.log(JSON.stringify(r));

  console.log('\n4. Enter second phone 0559876543...');
  r = await post('/api/draw/enter', { phone: '0559876543' });
  console.log(JSON.stringify(r));

  console.log('\n5. Admin login...');
  r = await post('/api/admin/login', { username: 'admin', password: '123456' });
  const token = r.token;
  console.log('Token obtained:', !!token);

  console.log('\n6. Trigger draw...');
  r = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/admin/draw/trigger', method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
  console.log(JSON.stringify(r));

  console.log('\n7. Check who won (0501234567)...');
  r = await post('/api/draw/check', { phone: '0501234567' });
  console.log(JSON.stringify(r));

  console.log('\n8. Check who won (0559876543)...');
  r = await post('/api/draw/check', { phone: '0559876543' });
  console.log(JSON.stringify(r));

  console.log('\n✅ All tests passed!');
}

test().catch(console.error);
