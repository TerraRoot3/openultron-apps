'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

const host = '127.0.0.1'
const port = Number(process.env.PORT || 3000)
const root = __dirname

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
}

function serveFile(res, fp) {
  const ext = path.extname(fp).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(fp).pipe(res)
}

const server = http.createServer((req, res) => {
  const reqUrl = String(req.url || '/')
  if (reqUrl === '/health' || reqUrl === '/api/health') {
    const body = JSON.stringify({ ok: true, service: 'demo', ts: new Date().toISOString() })
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    })
    res.end(body)
    return
  }

  const pathname = reqUrl.split('?')[0]
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const abs = path.resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  serveFile(res, abs)
})

server.listen(port, host, () => {
  process.stdout.write('[demo] running at http://' + host + ':' + port + '\n')
})
