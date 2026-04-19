'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const xlsx = require('xlsx')

const host = '127.0.0.1'
const port = Number(process.env.PORT || 3000)
const root = __dirname

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendFile(res, fp) {
  const ext = path.extname(fp).toLowerCase()
  const contentType = ext === '.html'
    ? 'text/html; charset=utf-8'
    : ext === '.js'
      ? 'application/javascript; charset=utf-8'
      : ext === '.css'
        ? 'text/css; charset=utf-8'
        : ext === '.ico'
          ? 'image/x-icon'
          : 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType })
  fs.createReadStream(fp).pipe(res)
}

// 解析Excel文件
function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 })
  if (jsonData.length === 0) return { headers: [], rows: [] }
  const headers = jsonData[0]
  const rows = jsonData.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] || ''
    })
    return obj
  })
  return { headers, rows }
}

// 发送邮件的API处理函数
async function sendEmails(reqData) {
  const { smtpHost, smtpPort, smtpUser, smtpPass, from, subject, body, templateVars, records } = reqData

  // 验证必需字段
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !from || !subject || !body || !records || records.length === 0) {
    throw new Error('缺少必需参数或记录为空')
  }

  // 创建SMTP transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  // 验证连接
  await transporter.verify()

  const results = []
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    try {
      // 替换模板变量
      let personalizedSubject = subject
      let personalizedBody = body
      for (const [key, value] of Object.entries(record)) {
        const regex = new RegExp(`{{${key}}}`, 'gi')
        personalizedSubject = personalizedSubject.replace(regex, value)
        personalizedBody = personalizedBody.replace(regex, value)
      }

      await transporter.sendMail({
        from,
        to: record.email || record.to || record.Email || record.To,
        subject: personalizedSubject,
        html: personalizedBody,
        // 也可以支持纯文本备用
        text: personalizedBody.replace(/<[^>]*>/g, ''),
      })

      results.push({ index: i, success: true, email: record.email || record.to || record.Email || record.To })
      successCount++
    } catch (err) {
      results.push({ index: i, success: false, error: err.message, email: record.email || record.to || record.Email || record.To })
      failCount++
    }
  }

  return { success: true, successCount, failCount, results }
}

const CONFIG_PATH = path.join(root, 'smtp-config.json')

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {}
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch (e) {
    return {}
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
    console.log('配置已保存到:', CONFIG_PATH)
    return true
  } catch (e) {
    console.error('保存配置失败:', e.message)
    return false
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = String(req.url || '/')
  const urlPath = reqUrl.split('?')[0] // 去掉查询参数

  // CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.writeHead(200).end()
  }

  // API路由
  if (urlPath === '/health' || urlPath === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'email-batch-sender', ts: new Date().toISOString() })
  }

  if (urlPath === '/favicon.ico') {
    const iconPath = path.join(root, 'favicon.ico')
    if (fs.existsSync(iconPath)) {
      return sendFile(res, iconPath)
    }
    res.writeHead(204)
    return res.end()
  }

  // 获取SMTP配置
  if (urlPath === '/api/config/smtp' && req.method === 'GET') {
    const config = readConfig()
    return sendJson(res, 200, { success: true, data: config })
  }

  // 保存SMTP配置
  if (urlPath === '/api/config/smtp' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const config = JSON.parse(Buffer.concat(chunks))
      // 验证必需字段
      const { host, port, secure, user, pass, fromEmail, fromName } = config
      if (!host || !port || !user || !pass || !fromEmail) {
        return sendJson(res, 400, { success: false, message: 'SMTP配置不完整（缺少主机、端口、用户名、密码或发件人邮箱）' })
      }
      const saved = saveConfig({ host, port, secure: !!secure, user, pass, fromEmail, fromName: fromName || '' })
      if (saved) {
        return sendJson(res, 200, { success: true, message: '配置已保存' })
      } else {
        return sendJson(res, 500, { success: false, message: '保存配置失败，请检查文件权限' })
      }
    } catch (err) {
      return sendJson(res, 500, { success: false, message: '保存配置失败', error: err.message })
    }
  }

  // 测试SMTP连接
  if (urlPath === '/api/config/test' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const { host, port, secure, user, pass } = JSON.parse(Buffer.concat(chunks))
      if (!host || !port || !user || !pass) {
        return sendJson(res, 400, { success: false, message: '测试参数不完整' })
      }
      const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: !!secure,
        auth: { user, pass }
      })
      await transporter.verify()
      return sendJson(res, 200, { success: true, message: '连接测试成功' })
    } catch (err) {
      return sendJson(res, 500, { success: false, message: `测试失败: ${err.message}` })
    }
  }

  // 上传Excel文件
  if (urlPath === '/api/upload' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      // 保存上传的文件
      const uploadDir = path.join(root, 'uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const timestamp = Date.now()
      const filePath = path.join(uploadDir, `upload_${timestamp}.xlsx`)
      fs.writeFileSync(filePath, buffer)
      // 解析Excel
      const result = parseExcel(filePath)
      return sendJson(res, 200, { 
        success: true, 
        data: result.rows, 
        headers: result.headers,
        total: result.rows.length,
        filename: 'uploaded_file.xlsx'
      })
    } catch (err) {
      return sendJson(res, 500, { success: false, message: `上传失败: ${err.message}` })
    }
  }

  // 解析Excel文件
  if (urlPath === '/api/parse' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const { filePath } = JSON.parse(Buffer.concat(chunks))
      if (!filePath || !fs.existsSync(filePath)) {
        return sendJson(res, 400, { success: false, message: '文件不存在' })
      }
      const result = parseExcel(filePath)
      return sendJson(res, 200, { success: true, data: result.rows, headers: result.headers })
    } catch (err) {
      return sendJson(res, 500, { success: false, message: `解析失败: ${err.message}` })
    }
  }

  // 批量发送邮件
  if (urlPath === '/api/send' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks))
      const { template, data, subject, from, smtpConfig } = body
      if (!template || !data || !subject || !from) {
        return sendJson(res, 400, { success: false, message: '参数不完整' })
      }
      // 使用传入的smtpConfig或读取保存的配置
      const config = smtpConfig || readConfig()
      if (!config.host || !config.port || !config.user || !config.pass) {
        return sendJson(res, 400, { success: false, message: 'SMTP配置不完整，请先保存SMTP配置' })
      }
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: Number(config.port),
        secure: !!config.secure,
        auth: { user: config.user, pass: config.pass }
      })
      const results = []
      let successCount = 0
      let failCount = 0
      for (let i = 0; i < data.length; i++) {
        const record = data[i]
        try {
          let personalizedSubject = subject
          let personalizedBody = template
          for (const [key, value] of Object.entries(record)) {
            const regex = new RegExp(`{{${key}}}`, 'gi')
            personalizedSubject = personalizedSubject.replace(regex, value)
            personalizedBody = personalizedBody.replace(regex, value)
          }
          await transporter.sendMail({
            from,
            to: record.email || record.to || record.Email || record.To,
            subject: personalizedSubject,
            html: personalizedBody,
            text: personalizedBody.replace(/<[^>]*>/g, '')
          })
          results.push({ index: i, success: true, email: record.email || record.to || record.Email || record.To })
          successCount++
        } catch (err) {
          results.push({ index: i, success: false, error: err.message, email: record.email || record.to || record.Email || record.To })
          failCount++
        }
      }
      return sendJson(res, 200, { success: true, total: data.length, successCount, failCount, results })
    } catch (err) {
      return sendJson(res, 500, { success: false, message: `发送失败: ${err.message}` })
    }
  }

  // 发送测试邮件
  if (urlPath === '/api/send-test' && req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const { smtpConfig, from, to, subject, html } = JSON.parse(Buffer.concat(chunks))
      if (!smtpConfig || !from || !to || !subject || !html) {
        return sendJson(res, 400, { success: false, message: '参数不完整' })
      }
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: Number(smtpConfig.port),
        secure: !!smtpConfig.secure,
        auth: { user: smtpConfig.user, pass: smtpConfig.pass }
      })
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, '')
      })
      return sendJson(res, 200, { success: true, message: '测试邮件发送成功' })
    } catch (err) {
      return sendJson(res, 500, { success: false, message: `测试邮件发送失败: ${err.message}` })
    }
  }

  if (urlPath === '/' || urlPath === '/index.html') {
    return sendFile(res, path.join(root, 'index.html'))
  }

  const filePath = path.join(root, urlPath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath)
  }

  // 404
  sendJson(res, 404, { success: false, message: 'Not Found', path: reqUrl })
})

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`)
})
