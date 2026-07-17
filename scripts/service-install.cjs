const { Service } = require('node-windows')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

function fail(message) {
  console.error(`エラー: ${message}`)
  process.exit(1)
}

function requireEnvironment(name) {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    fail(`環境変数 ${name} を設定してください。`)
  }
  return value
}

function positiveIntegerEnvironment(name, fallback, maximum) {
  const value = process.env[name] || fallback
  if (!/^[1-9]\d*$/.test(value)) {
    fail(`環境変数 ${name} には正の整数を設定してください。`)
  }
  if (Number(value) > maximum) {
    fail(`環境変数 ${name} は ${maximum} 以下にしてください。`)
  }
  return value
}

function normalizeCorsOrigin(value) {
  if (value.includes('*')) {
    fail('環境変数 CORS_ORIGIN にワイルドカード（*）は指定できません。')
  }

  let url
  try {
    url = new URL(value)
  } catch {
    fail(`環境変数 CORS_ORIGIN の値が不正です: ${value}`)
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    fail(`環境変数 CORS_ORIGIN には http(s) のOriginだけを指定してください: ${value}`)
  }
  return url.origin
}

function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!isAdmin()) {
  console.error('エラー: このスクリプトは管理者権限で実行する必要があります。')
  console.error('管理者としてターミナルを開き直して再実行してください。')
  process.exit(1)
}

const TASKER_ADMIN_USERNAME = requireEnvironment('TASKER_ADMIN_USERNAME').trim()
const TASKER_ADMIN_PASSWORD = requireEnvironment('TASKER_ADMIN_PASSWORD')
if (TASKER_ADMIN_PASSWORD.length < 12) {
  fail('環境変数 TASKER_ADMIN_PASSWORD は12文字以上にしてください。')
}
if (TASKER_ADMIN_USERNAME.length > 256) {
  fail('環境変数 TASKER_ADMIN_USERNAME は256文字以下にしてください。')
}
if (TASKER_ADMIN_PASSWORD.length > 1024) {
  fail('環境変数 TASKER_ADMIN_PASSWORD は1024文字以下にしてください。')
}

const PORT = positiveIntegerEnvironment('PORT', '3208', 65535)

const TASKER_HOST = process.env.TASKER_HOST?.trim() || '127.0.0.1'
const TASKER_COOKIE_SECURE = (process.env.TASKER_COOKIE_SECURE || 'false').toLowerCase()
if (!['true', 'false'].includes(TASKER_COOKIE_SECURE)) {
  fail('環境変数 TASKER_COOKIE_SECURE には true または false を設定してください。')
}

const TASKER_SESSION_TTL_MINUTES = positiveIntegerEnvironment(
  'TASKER_SESSION_TTL_MINUTES',
  '480',
  10080
)
const TASKER_LOGIN_MAX_ATTEMPTS = positiveIntegerEnvironment(
  'TASKER_LOGIN_MAX_ATTEMPTS',
  '5',
  100
)
const TASKER_LOGIN_WINDOW_MINUTES = positiveIntegerEnvironment(
  'TASKER_LOGIN_WINDOW_MINUTES',
  '15',
  1440
)
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeCorsOrigin)

const scriptPath = path.join(__dirname, '..', 'dist-server', 'index.js')

if (!fs.existsSync(scriptPath)) {
  console.error(`エラー: サーバービルドが見つかりません: ${scriptPath}`)
  console.error('先に npm run build を実行してください。')
  process.exit(1)
}

const serviceEnvironment = [
  { name: 'PORT', value: PORT },
  { name: 'TASKER_HOST', value: TASKER_HOST },
  { name: 'TASKER_ADMIN_USERNAME', value: TASKER_ADMIN_USERNAME },
  { name: 'TASKER_ADMIN_PASSWORD', value: TASKER_ADMIN_PASSWORD },
  { name: 'TASKER_COOKIE_SECURE', value: TASKER_COOKIE_SECURE },
  { name: 'TASKER_SESSION_TTL_MINUTES', value: TASKER_SESSION_TTL_MINUTES },
  { name: 'TASKER_LOGIN_MAX_ATTEMPTS', value: TASKER_LOGIN_MAX_ATTEMPTS },
  { name: 'TASKER_LOGIN_WINDOW_MINUTES', value: TASKER_LOGIN_WINDOW_MINUTES },
]
if (CORS_ORIGINS.length > 0) {
  serviceEnvironment.push({ name: 'CORS_ORIGIN', value: CORS_ORIGINS.join(',') })
}

const svc = new Service({
  name: 'Tasker',
  description: 'Tasker タスク管理アプリ',
  script: scriptPath,
  env: serviceEnvironment,
})

svc.on('alreadyinstalled', () => {
  console.error('エラー: Tasker サービスはすでにインストールされています。')
  console.error('再インストールするには先に service:uninstall を実行してください。')
  process.exit(1)
})

svc.on('invalidinstallation', () => {
  console.error('エラー: インストールが無効です。サービスを手動で確認してください。')
  process.exit(1)
})

svc.on('install', () => {
  console.log('Tasker サービスをインストールしました。起動中...')
  svc.start()
})

svc.on('start', () => {
  console.log('Tasker サービスが起動しました。')
  console.log(`http://localhost:${PORT} でアクセスできます。`)
})

svc.install()
