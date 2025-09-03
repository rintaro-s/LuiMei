const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

// Configure axios with timeout
axios.defaults.timeout = 5000;

// Test health check
async function testHealthCheck() {
  try {
    console.log('🔍 Testing health check...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Server is not running on port 3000');
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

// Test user registration
async function testRegistration() {
  try {
    console.log('🔍 Testing user registration...');
    
    const registrationData = {
      email: 'test@example.com',
      password: 'password123',
      displayName: 'テストユーザー',
      personality: {
        mode: 'friendly',
        voice: {
          language: 'ja-JP',
          gender: 'neutral'
        },
        responseStyle: {
          formality: 'polite',
          emoji: true
        }
      },
      preferences: {
        language: 'ja',
        theme: 'auto',
        notifications: {
          push: true,
          email: true
        }
      },
      deviceInfo: {
        deviceId: 'test_device_001',
        deviceName: 'Test Device',
        deviceType: 'mobile',
        platform: 'test',
        capabilities: {
          hasCamera: true,
          hasMicrophone: true,
          hasSpeaker: true,
          supportsNotifications: true
        }
      }
    };

    const response = await axios.post(`${BASE_URL}/api/auth/register`, registrationData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Registration successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Registration failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Server is not running on port 3000');
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Check if server is running
async function checkServerRunning() {
  console.log('🔍 Checking if server is running...');
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
    console.log('✅ Server is running!');
    return true;
  } catch (error) {
    console.log('❌ Server is not responding. Please ensure:');
    console.log('1. Server is running: npm start');
    console.log('2. Server is accessible on port 3000');
    console.log('3. No firewall blocking the connection');
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API tests...\n');
  
  // First check if server is running
  const isServerRunning = await checkServerRunning();
  if (!isServerRunning) {
    console.log('\n🔴 Cannot proceed with tests - server is not running');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testHealthCheck();
  console.log('\n' + '='.repeat(50) + '\n');
  
  const registrationResult = await testRegistration();
  
  console.log('\n🏁 Tests completed!');
}

// Run tests
runTests().catch(console.error);
