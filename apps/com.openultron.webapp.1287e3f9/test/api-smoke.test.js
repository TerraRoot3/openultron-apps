'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const serviceJs = fs.readFileSync(path.join(root, 'service.js'), 'utf8')

test('index.html 包含测试邮箱与发件人名称输入', () => {
  assert.match(html, /id="fromName"/)
  assert.match(html, /id="testEmail"/)
  assert.match(html, /id="testSendBtn"/)
})

test('app.js 包含 SMTP 配置读写与测试发信逻辑', () => {
  assert.match(appJs, /\/api\/config\/smtp/)
  assert.match(appJs, /\/api\/send-test/)
  assert.match(appJs, /updateTestSendBtnState/)
})

test('service.js 暴露 SMTP 配置持久化与健康检查接口', () => {
  assert.match(serviceJs, /smtp-config\.json/)
  assert.match(serviceJs, /\/api\/config\/smtp/)
  assert.match(serviceJs, /\/api\/health/)
  assert.match(serviceJs, /split\('\?'\)\[0\]/)
})
