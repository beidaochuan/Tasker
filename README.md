# Tasker

プロジェクト・トピック・タスクを複数ビューで管理するタスク管理アプリです。  
フロントエンドは React/Vite、バックエンドは Express + SQLite で構成されています。

---

## 機能概要

### ビュー

| ビュー     | 概要                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| リスト     | トピックごとにタスクを一覧表示。トピックの開閉・作成・名称変更・削除、タスクのドラッグ並び替えに対応                                 |
| カンバン   | 未着手 / 進行中 / 完了の列でタスクを管理。ドラッグでステータス変更、進行中列は WIP 5 件制限                                          |
| カレンダー | FullCalendar ベースの月・週・日表示。期日付きタスクと繰り返しタスクを表示し、ドラッグで期日変更可能                                  |
| ガント     | 開始日〜期日をタイムライン表示。日・週・月スケール切替、タスクのドラッグ並び替え、バーの移動・リサイズ、空行ドラッグで日程作成に対応 |

### タスク管理

- タイトル、説明、ステータス（未着手 / 進行中 / 完了）、優先度（低 / 中 / 高 / 緊急）、開始日、期日を管理
- タスクドロワーで作成・編集・削除。リスト上での完了切替・削除・ドラッグ並び替えにも対応
- タスクごとにチェックボックス付きの作業リストを作成し、項目名の編集・完了切替・削除が可能
- **繰り返しタスク**: 毎日 / 毎週 / 毎月 / 毎年と間隔指定に対応。完了時に履歴を記録し、次回分を自動作成

### プロジェクト・トピック

- プロジェクトの作成・編集・削除（カラー設定あり）
- トピックの作成・名称変更・削除
- プロジェクト削除時は配下のトピック・タスク・関連データを一括削除

### 補助機能

- タスクタイトル・説明のテキスト検索
- ステータス・優先度・タグ ID によるフィルタ
- タグマスターの作成・削除
- JSON エクスポート / インポート（最終エクスポートから 7 日超でバックアップ警告）
- ダーク / ライトテーマ切替
- アプリ・依存ライブラリのライセンス表示
- PWA（manifest・service worker）対応

### 編集モード

未ログイン時は閲覧専用です。作成・編集・削除・ドラッグ更新・インポートにはログインが必要です。

管理者のユーザー名とパスワードはサーバーの環境変数で設定します。認証は HttpOnly Cookie を使ったサーバー管理セッションで行い、資格情報やログイン状態をフロントエンドのソースコード、bundle、`localStorage` には保存しません。

セッションはサーバーのメモリ内に保持されるため、Taskerサーバーを再起動するとログイン状態は失効します。

### キーボードショートカット

| キー | 動作                                               |
| ---- | -------------------------------------------------- |
| `n`  | 選択中プロジェクトの先頭トピックに新規タスクを作成 |
| `/`  | 検索ボックスにフォーカス                           |

---

## 技術スタック

| 分類                 | 使用技術                  |
| -------------------- | ------------------------- |
| フロントエンド       | React 19, TypeScript      |
| ビルド               | Vite 8                    |
| スタイル             | Tailwind CSS v4           |
| UI                   | Radix UI, lucide-react    |
| 状態管理             | Zustand                   |
| フォーム             | React Hook Form, Zod      |
| D&D                  | dnd-kit                   |
| カレンダー           | FullCalendar              |
| ガント仮想スクロール | TanStack Virtual          |
| 繰り返しルール       | rrule                     |
| API                  | Express                   |
| DB                   | SQLite (`better-sqlite3`) |
| テスト               | Vitest, Testing Library   |
| PWA                  | vite-plugin-pwa           |

---

## インストール（リリース版）

### 前提条件

- [Node.js](https://nodejs.org/) v22 以上
- Windows サービスとして登録する場合は、管理者権限を持つユーザー

### 1. リリースZIPをダウンロードする

1. [GitHub Releases](https://github.com/beidaochuan/Tasker/releases) を開く
2. 最新リリースの **Assets** から `tasker-vX.X.X.zip` をダウンロードする
3. `C:\Tasker` など、継続して利用するフォルダへZIPを解凍する

> `Source code (zip)` ではなく、Assets に添付された `tasker-vX.X.X.zip` を使用してください。配布ZIPにはビルド済みの `dist/` と `dist-server/` が含まれています。サービス登録後は、解凍したフォルダを移動・削除しないでください。

### 2. 依存関係をインストールする

解凍したフォルダ内でPowerShellまたはターミナルを開き、次のコマンドを実行します。

```bash
npm ci --omit=dev
```

### 3. 環境変数を設定する

`TASKER_ADMIN_USERNAME` と `TASKER_ADMIN_PASSWORD` は必須です。ユーザー名は256文字以下、パスワードは12〜1024文字の推測されにくい値を設定してください。

macOS / Linux（bash、zsh）の例:

```bash
export TASKER_ADMIN_USERNAME='your-admin-name'
export TASKER_ADMIN_PASSWORD='replace-with-12-or-more-characters'
```

Windows PowerShellの例:

```powershell
$env:TASKER_ADMIN_USERNAME = 'your-admin-name'
$env:TASKER_ADMIN_PASSWORD = 'replace-with-12-or-more-characters'
```

設定値は現在のターミナルにだけ反映されます。実際の資格情報をソースコード、README、共有スクリプトへ書き込まないでください。

| 環境変数                      | 必須 / 既定値 | 説明                                                                                          |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `TASKER_ADMIN_USERNAME`       | 必須          | 単一管理者のログイン名（256文字以下）                                                         |
| `TASKER_ADMIN_PASSWORD`       | 必須          | 単一管理者のパスワード（12〜1024文字）                                                        |
| `PORT`                        | `3208`        | Expressサーバーのポート                                                                       |
| `TASKER_HOST`                 | `127.0.0.1`   | 待受アドレス。LAN公開時だけ `0.0.0.0` を明示                                                  |
| `TASKER_COOKIE_SECURE`        | `false`       | HTTPS経由で利用するときだけ `true`。HTTPのまま `true` にするとCookieを送信できません          |
| `TASKER_SESSION_TTL_MINUTES`  | `480`         | ログインセッションの有効時間（1〜10080分）                                                    |
| `TASKER_LOGIN_MAX_ATTEMPTS`   | `5`           | 試行制限時間内に許可するログイン失敗回数（1〜100回）                                          |
| `TASKER_LOGIN_WINDOW_MINUTES` | `15`          | ログイン試行を数える時間枠（1〜1440分）                                                       |
| `CORS_ORIGIN`                 | 未設定        | 追加で許可するOriginをカンマ区切りで指定。完全なOriginを指定し、ワイルドカード `*` は使用不可 |

### 4. 手動起動して動作を確認する

```bash
npm start
```

ブラウザで `http://localhost:3208/` を開き、Taskerが表示されることを確認します。確認後はターミナルで `Ctrl+C` を押して終了します。

既定では `127.0.0.1` のみで待ち受けるため、同じPCからだけ接続できます。

LANへ公開するときは、信頼できるネットワークであることを確認したうえで `TASKER_HOST=0.0.0.0` を明示します。

```bash
export TASKER_HOST='0.0.0.0'
npm start
```

```powershell
$env:TASKER_HOST = "0.0.0.0"
npm start
```

LAN公開時は `http://<このPCのIPアドレス>:3208/` で接続します。必要に応じてファイアウォールで使用するポートへの受信接続を許可してください。同じExpressサーバーから画面とAPIを配信する通常構成では、`CORS_ORIGIN` の追加は不要です。

> **LAN公開時の注意:** 閲覧用GET APIは認証なしで利用できるため、Taskerへ到達できる端末からタスクを含む読み取りデータ全体を閲覧・エクスポートできます。また、HTTP通信ではログイン情報とセッションCookieが暗号化されません。信頼済みLANに限定し、可能な限りHTTPSリバースプロキシを使用して `TASKER_COOKIE_SECURE=true` を設定してください。インターネットへ直接公開しないでください。

> **リバースプロキシ利用時:** Taskerは偽装可能な `X-Forwarded-For` を既定では信用しません。そのため、ログイン試行制限はプロキシ配下の全クライアントで同じIP枠を共有し、合計5回失敗すると既定で15分間ログインできません。プロキシ側でも接続元を制限し、この挙動を考慮して試行回数と時間枠を設定してください。

### 5. Windowsサービスとして登録する

PCの起動時にTaskerを自動起動する場合は、PowerShellまたはWindows Terminalを**管理者として実行**し、解凍したフォルダ内で次のコマンドを実行します。

```powershell
$env:TASKER_ADMIN_USERNAME = 'your-admin-name'
$env:TASKER_ADMIN_PASSWORD = 'replace-with-12-or-more-characters'
npm run service:install
```

登録時に、上記の資格情報と現在設定されている `PORT`、`TASKER_HOST`、Cookie、セッション、試行制限、CORSの環境変数がWindowsサービスへ保存されます。パスワードはインストール処理のログには出力されません。登録後にターミナル側の環境変数を変更してもサービス設定は変わらないため、設定変更時はサービスを削除してから再登録してください。

LAN公開やHTTPSリバースプロキシを使用する場合は、`npm run service:install` より前に必要な値も設定します。

```powershell
$env:TASKER_HOST = "0.0.0.0"
$env:TASKER_COOKIE_SECURE = "true" # ブラウザからHTTPSで接続する場合だけ
```

登録が完了すると `Tasker` サービスが自動起動します。ブラウザで `http://localhost:3208/` を開き、利用できることを確認してください。`services.msc` からサービスの状態も確認できます。サービス設定は管理者権限を持つユーザーから参照できるため、PC自体も適切に保護してください。

ポートを変更して登録する場合は、PowerShellで環境変数を設定してから登録します。

```powershell
$env:PORT = "8080"
npm run service:install
```

この場合は `http://localhost:8080/` へアクセスします。

> リリースZIPはビルド済みのため、`npm run build` は不要です。

### GitHub取得からLAN公開まで一括セットアップする

新規のWindows環境では、`scripts/setup-windows.ps1` を使うと次を一度に実行できます。

- GitHub Releasesから最新のTasker配布ZIPを取得し、Release記載のSHA-256を検証
- Node.js v22以上がなければwingetでNode.js LTSをインストール
- Tasker管理者のユーザー名・パスワードを画面に表示せず入力し、実際のログインを確認
- Taskerを `0.0.0.0` 待受でWindowsサービスへ登録
- Windowsファイアウォールで現在のネットワークプロファイルのローカルサブネットだけにTCPポートを許可

この方法は、同じ社内・家庭内LANにある別PCから利用するためのものです。インターネット公開、Cloudflare、ルーターのポート転送は使用しません。

管理者としてPowerShellまたはWindows Terminalを開きます。実行前に内容を確認できるよう、ダウンロードと実行は分けています。

```powershell
$setup = Join-Path $env:TEMP 'tasker-setup-windows.ps1'
Invoke-WebRequest `
  -UseBasicParsing `
  -Uri 'https://raw.githubusercontent.com/beidaochuan/Tasker/main/scripts/setup-windows.ps1' `
  -OutFile $setup
Get-Content $setup
Unblock-File $setup
& $setup
```

実行すると、このWindows PCに設定されているIPv4アドレスの候補が表示され、社内の他PCから接続するときに使うIPアドレスを質問します。WindowsのDomain、Private、Publicの判定とファイアウォール規則の選択もスクリプトが自動で行います。いずれの場合も接続元は同じローカルサブネットだけに限定します。

既定のインストール先は `C:\Tasker`、Taskerのポートは `3208` です。変更する場合は次のように指定します。

```powershell
& $setup `
  -InstallPath 'D:\Apps\Tasker' `
  -Port 8080
```

セットアップ完了時に、別PCから開くURLを画面へ表示します。既定ポートでは `http://<入力したIPアドレス>:3208` という形式です。特定バージョンを導入する場合は `-ReleaseTag 'v0.11.0'` を追加します。既存のTaskerサービス、同名のファイアウォール規則、または空でないインストール先がある場合は、誤上書きを避けるため処理を中止します。

> **LAN利用時の制約:** HTTP通信なのでログイン情報とCookieは暗号化されません。信頼できるLANだけで使用し、可能ならWindowsのネットワークプロファイルはDomainまたはPrivateにしてください。未ログインでも閲覧用GET APIは利用できるため、同じローカルサブネットから到達できる利用者はTaskerの閲覧データを参照できます。作成・編集・削除にはTasker管理者ログインが必要です。ルーターでこのポートをインターネットへ転送しないでください。

---

## 開発

### 起動

フロントエンドと API サーバーを同時に起動します。

最初に、インストール手順の「環境変数を設定する」と同様に `TASKER_ADMIN_USERNAME` と `TASKER_ADMIN_PASSWORD` を現在のターミナルへ設定してください。

```bash
npm run dev:full
```

| プロセス           | URL                      | 内容              |
| ------------------ | ------------------------ | ----------------- |
| Vite dev server    | `http://localhost:3208/` | React アプリ      |
| Express API server | `http://127.0.0.1:3209/` | `/api/*` + SQLite |

Vite は `/api` を `http://127.0.0.1:3209` にプロキシし、backendへ送るHostとOriginをbackend自身のOriginに揃えます。そのため、通常の `npm run dev:full` では開発用Originを `CORS_ORIGIN` へ追加する必要はありません。`npm run dev` 単体では API サーバーが起動しないため Bad Gateway になります。

### 本番相当の起動

```bash
npm run build
npm start
```

`dist/` の静的ファイルと `/api/*` を同一 Express サーバーで配信します。

### コマンド一覧

```bash
npm run dev:full          # API server + Vite dev server を同時起動
npm run dev               # Vite dev server のみ起動
npm run server            # Express API server を tsx watch で起動
npm run build             # 型チェック + API server + フロントエンドをビルド
npm run build:server      # API server を dist-server/ にビルド
npm start                 # ビルド済み Express API server を起動
npm run preview:full      # API server + Vite preview を同時起動
npm run preview           # Vite preview
npm run typecheck         # 型チェック
npm run test              # Vitest を一度実行
npm run test:watch        # Vitest watch
npm run test:ui           # Vitest UI
npm run test:coverage     # coverage 付きテスト
npm run lint              # ESLint
npm run lint:fix          # ESLint 自動修正
npm run format            # Prettier
npm run licenses:generate # public/third-party-licenses.json を生成
```

---

## データ

### 保存先

SQLite データベースはリポジトリ直下の `tasker.db` に作成されます。

主なテーブル: `projects` / `topics` / `tasks` / `subtasks` / `tags` / `task_completions`

### エクスポート / インポート

JSON エクスポートには全テーブルのデータが含まれます。  
インポート時は既存データを削除してからバックアップ内容を投入します。  
インポート可能な JSON は `version` と `data` キーを持つバックアップ形式で、ファイルサイズ上限は 50 MB です。

---

## API

| エンドポイント                      | 概要                                                |
| ----------------------------------- | --------------------------------------------------- |
| `POST /api/auth/login`              | ログインしてサーバーセッションを開始                |
| `POST /api/auth/logout`             | 現在のセッションを失効してログアウト                |
| `GET /api/auth/session`             | 現在の認証状態・セッション有効期限を取得            |
| `/api/projects`                     | プロジェクト CRUD                                   |
| `/api/topics`                       | トピック CRUD（`projectId` 絞り込み対応）           |
| `/api/tasks`                        | タスク CRUD（`topicId` / `projectId` 絞り込み対応） |
| `/api/tasks/gantt-order`            | 同一トピック内のガント表示順を一括更新              |
| `/api/tasks/:id/complete-recurring` | 繰り返しタスクの完了履歴記録と次回タスク作成        |
| `/api/subtasks`                     | サブタスク CRUD（`taskId` 絞り込み対応）            |
| `/api/tags`                         | タグ一覧・作成・削除                                |
| `/api/completions`                  | タスク完了履歴の一覧・作成                          |
| `/api/import`                       | JSON バックアップのインポート                       |

データ取得用のGET APIは未認証でも利用できます。POST、PUT、PATCH、DELETEによる作成・更新・削除、インポート、タグ管理、繰り返し完了は、認証済みセッションと有効なCSRF tokenが必要です。通常の画面操作では、クライアントが認証状態APIから受け取ったCSRF tokenを自動的に送信します。

認証状態はHttpOnly Cookie内のセッションIDとサーバー側セッションで管理されます。JavaScriptからCookieを読み取ることはできません。ログイン・ログアウト・認証状態レスポンスはキャッシュされません。サーバーを再起動した場合や有効期限を過ぎた場合は、再ログインが必要です。

認証関連の主なHTTP statusは次のとおりです。

| status | 意味                                             |
| ------ | ------------------------------------------------ |
| `401`  | 未認証、Cookieなし、またはセッション失効         |
| `403`  | CSRF tokenまたはOriginが不正                     |
| `429`  | ログイン試行回数が上限を超過。時間を置いて再試行 |

既定で許可されるのは同一Originからの通常利用だけです。Vite開発サーバーはproxy時にbackend向けのOriginを同一化するため、開発用Originの追加設定は不要です。ブラウザ上の別OriginからAPIへ直接アクセスさせる場合だけ、十分に信頼できるOriginを `CORS_ORIGIN` に完全一致・カンマ区切りで指定します。許可したOriginはcredential付き認証APIへ到達できるため、安易に追加しないでください。配布版フロントエンドは相対 `/api` を使う同一Origin構成を前提としています。ワイルドカード `*` は利用できません。CORSはブラウザの通信制御であり、公開GET APIのアクセス制限にはなりません。

---

## ディレクトリ構成

```text
server/
├── app.ts                # Express middleware・CORS・API mount・dist 配信
├── auth.ts               # セッション・Cookie・CSRF・ログイン試行制限
├── config.ts             # 認証・待受・CORSの環境変数検証
├── db.ts                 # SQLite 接続・テーブル作成
├── index.ts              # 設定読込とHTTPサーバー起動
└── routes/               # projects / topics / tasks / subtasks / tags / completions / import

src/
├── auth/                 # 認証APIクライアント
├── components/
│   ├── auth/             # ログインダイアログ
│   ├── filter/           # 検索・フィルタパネル
│   ├── layout/           # AppShell, Sidebar, ViewTabs, ExportWarning
│   ├── project/          # プロジェクト作成・編集フォーム
│   ├── task/             # タスク行・タスクドロワー・タグ管理
│   ├── ui/               # Button, Badge, Skeleton
│   └── views/            # List, Kanban, Calendar, Gantt
├── hooks/                # データ取得・更新通知・繰り返し・各ビュー用 hook
├── repositories/         # API repository と Result 型ラッパー
├── store/                # Zustand stores
├── test/                 # Vitest setup
├── types/                # Project / Topic / Task などの型定義
└── utils/                # 日付・フィルタ・並び替え・エクスポート・繰り返し処理
```

---

## Windowsサービスの更新・削除

サービスの更新や削除は、PowerShellまたはWindows Terminalを**管理者として実行**し、Taskerを解凍したフォルダ内で行います。

### 新しいバージョンへ更新する

1. アプリのJSONエクスポートでバックアップを取得する
2. 現在のサービスを削除する

```powershell
npm run service:uninstall
```

3. 新しいリリースZIPをダウンロードし、別のフォルダへ解凍する
4. 以前のフォルダにある `tasker.db` を新しいフォルダへコピーする
5. 新しいフォルダで依存関係をインストールし、サービスを登録する

```powershell
npm ci --omit=dev
$env:TASKER_ADMIN_USERNAME = 'your-admin-name'
$env:TASKER_ADMIN_PASSWORD = 'replace-with-12-or-more-characters'
npm run service:install
```

必要に応じて `PORT`、`TASKER_HOST`、Cookie、セッション、試行制限、CORSの環境変数も再設定してください。以前のサービス設定は新しいサービスへ自動では引き継がれません。

更新後にTaskerを開き、データとバージョンを確認してから以前のフォルダを削除してください。サービスの再起動により以前のログインセッションは失効します。

### サービスを削除する

```powershell
npm run service:uninstall
```

サービスを削除しても、Taskerフォルダ内の `tasker.db` は削除されません。再登録やポート変更を行う場合も、先にサービスを削除してから `service:install` を実行してください。

`setup-windows.ps1`でLAN用ファイアウォール規則も登録した場合は、使用していたポート番号に合わせて規則を削除します。

```powershell
Remove-NetFirewallRule -DisplayName 'Tasker (LAN TCP 3208)'
```

---

## トラブルシュート

### `Bad Gateway` が出る

`npm run dev` だけでは API サーバーが起動しません。

```bash
npm run dev:full
```

### `concurrently: command not found` が出る

依存関係が未インストールです。

```bash
npm install
```
