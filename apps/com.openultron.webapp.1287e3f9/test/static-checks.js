#!/usr/bin/env node
/**
 * 静态检查脚本 - 验证代码语法和基本结构
 * 不依赖 npm，可用系统 node 直接运行
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('🔍 开始静态检查...\n');

let errors = 0;
let warnings = 0;

// 检查文件是否存在
function checkFile(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.error(`❌ ${description} 缺失: ${filePath}`);
    errors++;
    return false;
  }
}

// 检查 JSON 文件语法
function checkJson(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    JSON.parse(content);
    console.log(`✅ ${description} 语法正确`);
    return true;
  } catch (e) {
    console.error(`❌ ${description} 语法错误: ${e.message}`);
    errors++;
    return false;
  }
}

// 检查 package.json 内容
function checkPackageJson() {
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log('📦 package.json 分析:');
    
    // 检查必需字段
    const required = ['name', 'version', 'main', 'scripts'];
    for (const field of required) {
      if (!pkg[field]) {
        console.error(`  ❌ 缺少字段: ${field}`);
        errors++;
      } else {
        console.log(`  ✅ ${field}: ${pkg[field]}`);
      }
    }
    
    // 检查依赖
    if (pkg.dependencies) {
      if (pkg.dependencies.nodemailer) {
        console.log(`  ✅ nodemailer: ${pkg.dependencies.nodemailer}`);
      } else {
        console.warn('  ⚠️  缺少 nodemailer 依赖');
        warnings++;
      }
      if (pkg.dependencies.xlsx) {
        console.log(`  ✅ xlsx: ${pkg.dependencies.xlsx}`);
      } else {
        console.warn('  ⚠️  缺少 xlsx 依赖');
        warnings++;
      }
    }
    
    // 检查脚本
    if (pkg.scripts) {
      if (pkg.scripts.start) {
        console.log(`  ✅ start: ${pkg.scripts.start}`);
      } else {
        console.warn('  ⚠️  缺少 start 脚本');
        warnings++;
      }
    }
    
    return true;
  } catch (e) {
    console.error(`❌ package.json 解析失败: ${e.message}`);
    errors++;
    return false;
  }
}

// 检查 HTML 基本结构
function checkHtml(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const checks = [
      { pattern: /<!DOCTYPE html>/i, name: 'DOCTYPE' },
      { pattern: /<html.*>/i, name: '<html>' },
      { pattern: /<head>/i, name: '<head>' },
      { pattern: /<body>/i, name: '<body>' },
      { pattern: /<script.*app\.js.*>/i, name: 'app.js 引入' }
    ];
    
    console.log(`📄 ${description} 结构检查:`);
    for (const check of checks) {
      if (check.pattern.test(content)) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.warn(`  ⚠️  缺少 ${check.name}`);
        warnings++;
      }
    }
    
    // 检查是否有重复的 DOCTYPE (常见问题)
    const doctypeCount = (content.match(/<!DOCTYPE html>/gi) || []).length;
    if (doctypeCount > 1) {
      console.warn(`  ⚠️  发现 ${doctypeCount} 个 DOCTYPE 声明 (应为1个)`);
      warnings++;
    }
    
    return true;
  } catch (e) {
    console.error(`❌ 读取 ${filePath} 失败: ${e.message}`);
    errors++;
    return false;
  }
}

// 执行检查
console.log('检查核心文件:');
checkFile('index.html', 'index.html');
checkFile('app.js', 'app.js');
checkFile('service.js', 'service.js');
checkFile('styles.css', 'styles.css');
checkFile('manifest.json', 'manifest.json');

console.log('\n检查 package.json:');
checkJson('package.json', 'package.json');
checkPackageJson();

console.log('\n检查 HTML 结构:');
checkHtml('index.html', 'index.html');

console.log('\n检查测试目录:');
if (fs.existsSync(path.join(rootDir, 'test'))) {
  console.log('✅ test/ 目录存在');
} else {
  console.error('❌ test/ 目录缺失');
  errors++;
}

console.log('\n' + '='.repeat(50));
console.log(`检查完成: ${errors} 个错误, ${warnings} 个警告`);

if (errors > 0) {
  process.exit(1);
} else {
  console.log('✅ 所有基本检查通过');
  process.exit(0);
}
