const { Service } = require('node-windows');
const path = require('path');
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

const svc = new Service({
  name: 'Tasker',
  script: path.join(__dirname, '..', 'dist-server', 'index.js'),
});

svc.on('alreadyuninstalled', () => {
  console.log('Tasker サービスはすでに削除されています（または未登録）。');
});

svc.on('uninstall', () => {
  console.log('Tasker サービスを削除しました。');
});

svc.uninstall();
