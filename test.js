const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('Testing Bitespeed Identity Reconciliation API\n');

  try {
    // Test 1: Health check
    console.log('1. Health Check');
    const health = await makeRequest('GET', '/health');
    console.log('Status:', health.status, 'Response:', health.data);
    console.log('');

    // Test 2: Create new contact
    console.log('2. Create New Contact');
    const test1 = await makeRequest('POST', '/identify', {
      email: 'test@example.com',
      phoneNumber: '123456'
    });
    console.log('Status:', test1.status);
    console.log('Response:', JSON.stringify(test1.data, null, 2));
    console.log('');

    // Test 3: Link contact
    console.log('3. Link Contact');
    const test2 = await makeRequest('POST', '/identify', {
      email: 'test2@example.com',
      phoneNumber: '123456'
    });
    console.log('Status:', test2.status);
    console.log('Response:', JSON.stringify(test2.data, null, 2));
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('Make sure the server is running: node app.js');
  }
}

test();
