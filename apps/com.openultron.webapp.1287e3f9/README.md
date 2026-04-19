# 邮件批量发送工具

这是一个 OpenUltron 沙盒应用（Web App）。

## 应用信息

- id: `com.openultron.webapp.1287e3f9`
- version: `0.1.0`
- 入口页面: `index.html`
- 服务命令: `node service.js`

## 目录约定

- `manifest.json`: 应用元数据、运行时与服务配置
- `index.html`: 页面入口
- `README.md`: 本开发文档

## 开发方式（推荐）

1. 在 OpenUltron 的「应用工作室」打开该应用。
2. 左侧预览默认会尝试启动服务并打开本地服务地址（localhost）。
3. 右侧 AI 可在应用目录执行命令与改写文件。

## manifest 关键字段

```json
{
  "entry": {
    "html": "index.html",
    "service": {
      "command": "node service.js",
      "cwd": ".",
      "portEnv": "PORT",
      "startupTimeoutMs": 20000
    }
  },
  "runtime": {
    "browser": true,
    "node": true
  }
}
```

## 调试建议

- Node 检查:
```bash
node --check server.js
```

- Python（如需）:
```bash
python3 -c "print('python ok')"
```

## 主题兼容（必须）

沙箱预览会跟随宿主主题在 **light / dark** 间切换。实现页面时必须保证两套主题可用，避免只适配一种导致不可读。

- 不要把文字和背景颜色写死为单一深浅组合。
- 优先使用 CSS 变量承载颜色，再通过主题态切换变量值。
- 兼容选择器建议：`html[data-theme="light"]` / `html[data-theme="dark"]` 或 `.theme-light` / `.theme-dark`。
- 对比度至少保证正文可读（避免浅色字配浅底、深色字配深底）。

## 注意事项

- 仅在应用目录内读写文件，避免越界到主程序目录。
- 若服务启动失败，可先检查服务命令、端口环境变量和日志输出。
- 可通过版本号管理多个应用版本目录。
