const { Service } = require('node-windows');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!isAdmin()) {
  console.error('エラー: このスクリプトは管理者権限で実行する必要があります。');
  console.error('管理者としてターミナルを開き直して再実行してください。');
  process.exit(1);
}

const PORT = process.env.PORT || '3208';
const scriptPath = path.join(__dirname, '..', 'dist-server', 'index.js');

if (!fs.existsSync(scriptPath)) {
  console.error(`エラー: サーバービルドが見つかりません: ${scriptPath}`);
  console.error('先に npm run build を実行してください。');
  process.exit(1);
}

const svc = new Service({
  name: 'Tasker',
  description: 'Tasker タスク管理アプリ',
  script: scriptPath,
  env: {
    name: 'PORT',
    value: PORT
  }
});

svc.on('alreadyinstalled', () => {
  console.error('エラー: Tasker サービスはすでにインストールされています。');
  console.error('再インストールするには先に service:uninstall を実行してください。');
  process.exit(1);
});

svc.on('invalidinstallation', () => {
  console.error('エラー: インストールが無効です。サービスを手動で確認してください。');
  process.exit(1);
});

svc.on('install', () => {
  console.log('Tasker サービスをインストールしました。起動中...');
  svc.start();
});

svc.on('start', () => {
  console.log('Tasker サービスが起動しました。');
  console.log(`http://localhost:${PORT} でアクセスできます。`);
});

svc.install();
