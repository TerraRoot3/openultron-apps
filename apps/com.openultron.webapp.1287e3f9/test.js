const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// 测试数据
const testConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: 'test@gmail.com',
  pass: 'test-password',
  fromEmail: 'test@gmail.com',
  fromName: 'Test User'
};

const testParseData = {
  file: path.join(__dirname, 'test-recipients.xlsx')
};

// 工具函数：发送请求
function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 测试用例
async function runTests() {
  console.log('=== 邮件批量发送工具 API 测试 ===\n');

  // 1. 健康检查
  console.log('1. 测试健康检查...');
  try {
    const res = await request('/health');
    console.log(`   状态码: ${res.status}`);
    console.log(`   响应: ${JSON.stringify(res.data)}\n`);
  } catch (e) {
    console.error(`   失败: ${e.message}\n`);
  }

  // 2. 获取配置（初始应为空）
  console.log('2. 测试获取配置...');
  try {
    const res = await request('/api/config/smtp');
    console.log(`   状态码: ${res.status}`);
    console.log(`   响应: ${JSON.stringify(res.data)}\n`);
  } catch (e) {
    console.error(`   失败: ${e.message}\n`);
  }

  // 3. 保存配置
  console.log('3. 测试保存配置...');
  try {
    const res = await request('/api/config/smtp', 'POST', testConfig);
    console.log(`   状态码: ${res.status}`);
    console.log(`   响应: ${JSON.stringify(res.data)}\n`);
  } catch (e) {
    console.error(`   失败: ${e.message}\n`);
  }

  // 4. 再次获取配置（应包含刚才保存的数据）
  console.log('4. 测试获取配置（验证保存）...');
  try {
    const res = await request('/api/config/smtp');
    console.log(`   状态码: ${res.status}`);
    console.log(`   响应: ${JSON.stringify(res.data)}\n`);
  } catch (e) {
    console.error(`   失败: ${e.message}\n`);
  }

  // 5. 测试连接（使用假数据，预期失败）
  console.log('5. 测试连接（假数据，预期失败）...');
  try {
    const res = await request('/api/config/test', 'POST', {
      host: 'invalid.smtp.com',
      port: 587,
      user: 'test@example.com',
      pass: 'wrong-password'
    });
    console.log(`   状态码: ${res.status}`);
    console.log(`   响应: ${JSON.stringify(res.data)}\n`);
  } catch (e) {
    console.error(`   失败: ${e.message}\n`);
  }

  console.log('=== 测试完成 ===');
}

// 检查服务是否运行
async function checkServer() {
  try {
    await request('/health');
    return true;
  } catch (e) {
    return false;
  }
}

// 主程序
(async () => {
  console.log('正在检查服务器状态...');
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.error('❌ 服务器未运行！请先启动服务: node service.js');
    process.exit(1);
  }

  console.log('✅ 服务器运行中，开始测试...\n');
  await runTests();
})();