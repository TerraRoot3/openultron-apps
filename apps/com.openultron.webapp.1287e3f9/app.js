// 邮件批量发送工具 - 前端逻辑

const API_BASE = '';

// 应用状态
let state = {
  configLoaded: false,
  smtpConfig: null,
  uploadedFile: null,
  recipients: [],
  headers: [],
  isUploading: false,
  isSending: false
};

// 安全的 fetch JSON 封装（避免 HTML 响应导致崩溃）
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`服务器返回非JSON响应: ${text.slice(0, 120)}...`);
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `请求失败 (${res.status})`);
  }
  if (data && data.success === false) {
    throw new Error(data.message || data.error || '操作失败');
  }
  return data;
}

// DOM 元素引用
const elements = {
  smtpHost: document.getElementById('smtpHost'),
  smtpPort: document.getElementById('smtpPort'),
  smtpSecure: document.getElementById('smtpSecure'),
  smtpUser: document.getElementById('smtpUser'),
  smtpPass: document.getElementById('smtpPass'),
  smtpStatus: document.getElementById('smtpStatus'),
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  totalRows: document.getElementById('totalRows'),
  detectedColumns: document.getElementById('detectedColumns'),
  previewTable: document.getElementById('previewTable'),
  emailSubject: document.getElementById('emailSubject'),
  emailBody: document.getElementById('emailBody'),
  fromEmail: document.getElementById('fromEmail'),
  fromName: document.getElementById('fromName'),
  sendRange: document.getElementById('sendRange'),
  sendDelay: document.getElementById('sendDelay'),
  sendBtn: document.getElementById('sendBtn'),
  progressSection: document.getElementById('progressSection'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  successCount: document.getElementById('successCount'),
  failCount: document.getElementById('failCount'),
  sendResults: document.getElementById('sendResults'),
  resultsSummary: document.getElementById('resultsSummary'),
  resultsList: document.getElementById('resultsList'),
  testEmail: document.getElementById('testEmail'),
  testEmailStatus: document.getElementById('testEmailStatus'),
  testSendBtn: document.getElementById('testSendBtn'),
  toast: document.getElementById('toast')
};

// 初始化
async function init() {
  setupEventListeners();
  await loadSmtpConfig();
}

// 更新测试发送按钮状态
function updateTestSendBtnState() {
  const hasTestEmail = elements.testEmail && elements.testEmail.value.trim() !== '';
  const hasSubject = elements.emailSubject && elements.emailSubject.value.trim() !== '';
  const hasBody = elements.emailBody && elements.emailBody.value.trim() !== '';
  const hasSmtp = (elements.smtpUser && elements.smtpUser.value.trim() !== '') && 
                  (elements.smtpPass && elements.smtpPass.value.trim() !== '');
  
  if (elements.testSendBtn) {
    elements.testSendBtn.disabled = !(hasTestEmail && hasSubject && hasBody && hasSmtp);
  }
}

// 设置事件监听
function setupEventListeners() {
  // 文件上传区域点击
  elements.dropZone.addEventListener('click', () => elements.fileInput.click());
  
  // 文件选择
  elements.fileInput.addEventListener('change', handleFileSelect);
  
  // 拖拽上传
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });
  
  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });
  
  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });
  
  // 测试邮箱输入框事件监听
  if (elements.testEmail) {
    elements.testEmail.addEventListener('input', updateTestSendBtnState);
  }
  if (elements.emailSubject) {
    elements.emailSubject.addEventListener('input', updateTestSendBtnState);
  }
  if (elements.emailBody) {
    elements.emailBody.addEventListener('input', updateTestSendBtnState);
  }
  if (elements.smtpHost) {
    elements.smtpHost.addEventListener('input', updateTestSendBtnState);
  }
  if (elements.smtpUser) {
    elements.smtpUser.addEventListener('input', updateTestSendBtnState);
  }
  if (elements.smtpPass) {
    elements.smtpPass.addEventListener('input', updateTestSendBtnState);
  }
}

// 加载SMTP配置
async function loadSmtpConfig() {
  try {
    const data = await fetchJson(`${API_BASE}/api/config/smtp`);
    const config = data.data || {};
    state.smtpConfig = config;
    elements.smtpHost.value = config.host || '';
    elements.smtpPort.value = config.port || 587;
    elements.smtpSecure.value = config.secure ? 'true' : 'false';
    elements.smtpUser.value = config.user || '';
    elements.smtpPass.value = config.pass || '';
    elements.fromEmail.value = config.fromEmail || '';
    if (elements.fromName) {
      elements.fromName.value = config.fromName || '';
    }
    state.configLoaded = true;
  } catch (error) {
    console.log('未加载到保存的SMTP配置');
  }
}

// 保存SMTP配置
async function saveSmtpConfig() {
  const config = {
    host: elements.smtpHost.value.trim(),
    port: parseInt(elements.smtpPort.value),
    secure: elements.smtpSecure.value === 'true',
    user: elements.smtpUser.value.trim(),
    pass: elements.smtpPass.value,
    fromEmail: elements.fromEmail.value.trim(),
    fromName: elements.fromName ? elements.fromName.value.trim() : ''
  };
  
  if (!config.host || !config.port || isNaN(config.port) || !config.user || !config.pass || !config.fromEmail) {
    showToast('请填写完整的SMTP配置（主机、端口、用户名、密码、发件人邮箱）', 'error');
    return;
  }
  
  try {
    const data = await fetchJson(`${API_BASE}/api/config/smtp`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    showToast(data.message || 'SMTP配置已保存', 'success');
    state.smtpConfig = config;
    if (state.recipients.length > 0) {
      elements.sendBtn.disabled = false;
    }
  } catch (error) {
    showToast('保存失败: ' + error.message, 'error');
  }
}

// 测试SMTP连接
async function testSmtpConnection() {
  const config = {
    host: elements.smtpHost.value.trim(),
    port: parseInt(elements.smtpPort.value),
    secure: elements.smtpSecure.value === 'true',
    user: elements.smtpUser.value.trim(),
    pass: elements.smtpPass.value
  };
  
  if (!config.host || !config.user || !config.pass) {
    showToast('请先填写SMTP配置信息', 'error');
    return;
  }
  
  showSmtpStatus('测试中...', 'pending');
  
  try {
    const data = await fetchJson(`${API_BASE}/api/config/test`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    showSmtpStatus('✅ 连接测试成功', 'success');
  } catch (error) {
    showSmtpStatus('❌ 测试失败: ' + error.message, 'error');
  }
}

// 显示SMTP状态
function showSmtpStatus(message, type) {
  elements.smtpStatus.textContent = message;
  elements.smtpStatus.className = 'status ' + type;
  elements.smtpStatus.classList.remove('hidden');
}

// 处理文件选择
function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

// 处理上传文件
async function handleFile(file) {
  // 验证文件类型
  const validExts = ['.xlsx', '.xls'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!validExts.includes(ext)) {
    showToast('请上传 Excel 文件 (.xlsx 或 .xls)', 'error');
    return;
  }
  
  state.isUploading = true;
  showToast('正在上传并解析...', 'info');
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file
    });
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`服务器返回非JSON响应: ${text.slice(0, 120)}`);
    }
    
    if (res.ok && data.success) {
      state.uploadedFile = data;
      state.recipients = data.data;
      state.headers = data.headers;
      
      displayFileInfo(data);
      showToast(`成功加载 ${data.total} 条收件人记录`, 'success');
      
      // 如果已有SMTP配置，启用发送按钮
      if (state.configLoaded || (elements.smtpUser.value && elements.smtpPass.value)) {
        elements.sendBtn.disabled = false;
      }
      
      // 自动识别邮箱字段并填充主题
      autoDetectEmailField();
    } else {
      showToast(data.message || data.error || '文件上传失败', 'error');
    }
  } catch (error) {
    showToast('上传失败: ' + error.message, 'error');
  } finally {
    state.isUploading = false;
    elements.fileInput.value = '';
  }
}

// 显示文件信息
function displayFileInfo(data) {
  elements.fileName.textContent = data.filename;
  elements.totalRows.textContent = data.total;
  elements.detectedColumns.textContent = data.headers.join(', ');
  
  // 渲染预览表格
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  
  // 表头
  const headerRow = document.createElement('tr');
  data.headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  // 表体（前10行）
  data.data.forEach(row => {
    const tr = document.createElement('tr');
    data.headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header] || '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  
  table.appendChild(thead);
  table.appendChild(tbody);
  elements.previewTable.innerHTML = '';
  elements.previewTable.appendChild(table);
  
  elements.fileInfo.classList.remove('hidden');
}

// 自动检测邮箱字段
function autoDetectEmailField() {
  const emailFields = ['email', 'Email', 'EMAIL', '邮箱', 'mail', 'Mail'];
  const detected = state.headers.find(h => emailFields.includes(h));
  
  if (detected) {
    showToast(`已识别邮箱字段: ${detected}`, 'info');
  }
}

// 加载模板
function loadTemplate(type) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  
  const templates = {
    plain: {
      subject: '通知 - {{date}}',
      body: `尊敬的{{name}}：\n\n您好！\n\n这是一封重要通知。\n\n如有疑问，请回复本邮件。\n\n祝好！\n\n发送时间：{{date}}`
    },
    styled: {
      subject: '您好 {{name}} - 欢迎使用我们的服务',
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">\n  <h2 style="color: #2563eb;">尊敬的 {{name}}，您好！</h2>\n  <p>感谢您使用我们的服务。</p>\n  <p>我们致力于为您提供最好的体验。</p>\n  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">\n    <strong>重要日期：</strong> {{date}}<br>\n    <strong>您的邮箱：</strong> {{email}}\n  </div>\n  <p>如有任何问题，请随时联系我们。</p>\n  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">\n  <p style="color: #999; font-size: 0.9rem;">此邮件由邮件批量发送工具自动生成</p>\n</div>`
    }
  };
  
  const tmpl = templates[type];
  elements.emailSubject.value = tmpl.subject;
  elements.emailBody.value = tmpl.body;
  
  showToast(`已加载${type === 'plain' ? '纯文本' : '富文本'}模板`, 'success');
}

// 发送邮件
async function sendEmails() {
  if (state.isSending) {
    showToast('正在发送中，请稍候...', 'info');
    return;
  }
  
  const subject = elements.emailSubject.value.trim();
  let body = elements.emailBody.value.trim();
  
  if (!subject) {
    showToast('请填写邮件主题', 'error');
    return;
  }
  
  if (!body) {
    showToast('请填写邮件正文', 'error');
    return;
  }
  
  // 确定发送范围
  let recipientsToSend = [];
  if (elements.sendRange.value === 'all') {
    recipientsToSend = state.recipients;
  } else {
    recipientsToSend = state.recipients.slice(0, 5);
    showToast('测试模式：仅发送前5位', 'info');
  }
  
  // 获取发件人
  const fromEmail = elements.fromEmail.value.trim() || elements.smtpUser.value;
  const fromName = elements.fromName ? elements.fromName.value.trim() : '';
  const from = fromName ? { name: fromName, email: fromEmail } : fromEmail;
  
  const delay = parseInt(elements.sendDelay.value) || 500;
  
  // 禁用发送按钮
  state.isSending = true;
  elements.sendBtn.disabled = true;
  elements.sendBtn.textContent = '发送中...';
  
  // 显示进度区域
  elements.progressSection.classList.remove('hidden');
  elements.sendResults.classList.add('hidden');
  
  // 重置进度
  updateProgress(0, recipientsToSend.length, 0, 0);
  
  try {
    const res = await fetch(`${API_BASE}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: body,
        data: recipientsToSend,
        subject,
        from,
        smtpConfig: state.smtpConfig
      })
    });
    
    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`服务器返回非JSON响应: ${text.slice(0, 120)}`);
    }
    
    if (res.ok && result.success) {
      displayResults(result);
      showToast(`发送完成：成功 ${result.successCount}，失败 ${result.failCount}`, 'success');
    } else {
      showToast(result.message || result.error || '发送失败', 'error');
    }
  } catch (error) {
    showToast('发送失败: ' + error.message, 'error');
  } finally {
    state.isSending = false;
    elements.sendBtn.disabled = false;
    elements.sendBtn.textContent = '开始发送';
  }
}

// 更新进度
function updateProgress(current, total, success, fail) {
  const percent = (current / total) * 100;
  elements.progressFill.style.width = percent + '%';
  elements.progressText.textContent = `${current}/${total}`;
  elements.successCount.textContent = success;
  elements.failCount.textContent = fail;
}

// 显示发送结果
function displayResults(result) {
  elements.sendResults.classList.remove('hidden');
  
  // 汇总
  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.innerHTML = `
    <div class="summary-item">总计: <strong>${result.total}</strong></div>
    <div class="summary-item success-text">成功: <strong>${result.successCount}</strong></div>
    <div class="summary-item error-text">失败: <strong>${result.failCount}</strong></div>
  `;
  elements.resultsSummary.innerHTML = '';
  elements.resultsSummary.appendChild(summary);
  
  // 详细列表
  const list = document.createElement('div');
  list.className = 'results-list';
  
  result.results.forEach(item => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <span class="result-icon">${item.success ? '✅' : '❌'}</span>
      <span>第${item.index + 1}条: ${item.success ? '发送成功' : item.error}</span>
      ${item.success ? `<span class="success-text">${item.email}</span>` : ''}
    `;
    list.appendChild(div);
  });
  
  elements.resultsList.innerHTML = '';
  elements.resultsList.appendChild(list);
}

// 显示Toast提示
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.style.background = type === 'success' ? 'var(--success-color)' : 
                                   type === 'error' ? 'var(--error-color)' : 
                                   'var(--text-color)';
  elements.toast.classList.add('show');
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// 路径工具（用于文件扩展名检查）
const path = {
  extname: (filename) => {
    const match = filename.match(/\.[^.]*$/);
    return match ? match[0] : '';
  }
};

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', init);

// 发送测试邮件
async function sendTestEmail() {
  const testEmail = elements.testEmail.value.trim();
  if (!testEmail) {
    showToast('请输入测试邮箱地址', 'error');
    return;
  }
  
  const subject = elements.emailSubject.value.trim();
  const body = elements.emailBody.value.trim();
  
  if (!subject || !body) {
    showToast('请先填写邮件主题和正文', 'error');
    return;
  }
  
  const fromEmail = elements.fromEmail.value.trim() || elements.smtpUser.value;
  const fromName = elements.fromName ? elements.fromName.value.trim() : '';
  const from = fromName ? { name: fromName, email: fromEmail } : fromEmail;
  
  if (!fromEmail) {
    showToast('请配置发件人邮箱', 'error');
    return;
  }
  
  const smtpConfig = {
    host: elements.smtpHost.value.trim(),
    port: parseInt(elements.smtpPort.value),
    secure: elements.smtpSecure.value === 'true',
    user: elements.smtpUser.value.trim(),
    pass: elements.smtpPass.value
  };
  
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    showToast('请先配置SMTP信息', 'error');
    return;
  }
  
  // 显示测试状态
  elements.testSendBtn.disabled = true;
  elements.testSendBtn.textContent = '🧪 发送中...';
  elements.testEmailStatus.textContent = '正在发送测试邮件...';
  elements.testEmailStatus.className = 'status pending';
  elements.testEmailStatus.classList.remove('hidden');
  
  try {
    const res = await fetch(`${API_BASE}/api/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtpConfig,
        from,
        to: testEmail,
        subject: `[测试] ${subject}`,
        html: body
      })
    });
    
    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`服务器返回非JSON响应: ${text.slice(0, 120)}`);
    }
    
    if (res.ok && result.success) {
      elements.testEmailStatus.textContent = '✅ 测试邮件发送成功！请检查收件箱（包括垃圾邮件）';
      elements.testEmailStatus.className = 'status success';
      showToast('测试邮件发送成功', 'success');
    } else {
      elements.testEmailStatus.textContent = '❌ 发送失败: ' + (result.message || result.error);
      elements.testEmailStatus.className = 'status error';
      showToast('测试邮件发送失败', 'error');
    }
  } catch (error) {
    elements.testEmailStatus.textContent = '❌ 请求失败: ' + error.message;
    elements.testEmailStatus.className = 'status error';
    showToast('测试邮件发送失败: ' + error.message, 'error');
  } finally {
    elements.testSendBtn.disabled = false;
    elements.testSendBtn.textContent = '🧪 发送测试邮件';
  }
}