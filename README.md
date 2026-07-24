# Tasker

プロジェクト、トピック、タスクをひとつのアプリで管理できる、セルフホスト型のタスク管理アプリです。カンバン、ガント、リスト、カレンダーを用途に合わせて切り替えられます。

[リリースをダウンロード](https://github.com/beidaochuan/Tasker/releases) · [更新履歴](CHANGELOG.md) · [ライセンス](LICENSE)

## 目次

- [できること](#できること)
- [手動で起動する](#手動で起動する)
- [Windows で常駐させる](#windows-で常駐させる)
- [設定とセキュリティ](#設定とセキュリティ)
- [開発](#開発)
- [データのバックアップ](#データのバックアップ)
- [API](#api)
- [トラブルシュート](#トラブルシュート)

## できること

### 4 つのビュー

| ビュー     | 主な用途         | できること                                                                                   |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------- |
| カンバン   | 日々の進捗管理   | 未着手 / 進行中 / 完了をドラッグで移動。進行中は WIP 5 件まで。                              |
| ガント     | スケジュール管理 | 開始日から期日までをタイムライン表示。日・週・月表示、バーの移動・リサイズ、並び替えに対応。 |
| リスト     | タスクの整理     | トピックごとに表示。トピックの開閉・編集とタスクの並び替えに対応。                           |
| カレンダー | 日程確認         | 月・週・日表示。期日・繰り返しタスクを表示し、ドラッグで日付を変更。                         |

### タスクとプロジェクト

- タイトル、説明、ステータス、優先度、開始日、期日、タグを管理
- チェックボックス付き作業リスト、関連タスク、繰り返しタスクに対応
- 毎日 / 毎週 / 毎月 / 毎年の繰り返しと間隔を指定可能。完了時には履歴を記録して次回タスクを作成
- プロジェクト・トピックの作成、編集、削除。プロジェクトにはカラーを設定可能で、削除時には配下のデータも削除
- タイトル・説明の検索、ステータス・優先度・タグによる絞り込み

### そのほか

- JSON による全データのエクスポート / インポート
- ダーク / ライトテーマ、PWA、アプリ・依存ライブラリのライセンス表示
- `n` で新規タスクを作成、`/` で検索ボックスへフォーカス

## 手動で起動する

ここでは、ターミナルから Tasker を一時的に起動する手順を説明します。`npm start` を実行している間だけ動作し、終了するには `Ctrl+C` を押します。

Windows で PC の起動後も常駐させる場合は、この手順ではなく [Windows で常駐させる](#windows-で常駐させる) を使用してください。推奨のセットアップスクリプトは、リリースの取得・依存関係のインストール・サービス登録を自動で行います。

リリース版はビルド済みです。ソースコードから開発する場合は、[開発](#開発) を参照してください。

### 前提条件

- [Node.js](https://nodejs.org/) v22 以上
- Windows サービスとして登録する場合のみ、管理者権限を持つユーザー

### 1. リリースを展開する

1. [GitHub Releases](https://github.com/beidaochuan/Tasker/releases) から最新リリースの `tasker-vX.X.X.zip` をダウンロードします。
2. `D:\app\Tasker` など、継続して利用するフォルダへ ZIP を解凍します。

> `Source code (zip)` ではなく、Assets に添付された `tasker-vX.X.X.zip` を使用してください。配布 ZIP には `dist/` と `dist-server/` が含まれています。サービス登録後は解凍先を移動・削除しないでください。

### 2. 実行時の依存関係を入れる

解凍したフォルダで PowerShell またはターミナルを開き、実行します。

```bash
npm ci --omit=dev
```

### 3. 管理者アカウントを設定する

`TASKER_ADMIN_USERNAME` と `TASKER_ADMIN_PASSWORD` は必須です。パスワードは 12〜1024 文字、ユーザー名は 256 文字以下にしてください。

macOS / Linux（bash、zsh）:

```bash
export TASKER_ADMIN_USERNAME='your-admin-name'
export TASKER_ADMIN_PASSWORD='replace-with-12-or-more-characters'
```

Windows PowerShell:

```powershell
$env:TASKER_ADMIN_USERNAME = 'your-admin-name'
$env:TASKER_ADMIN_PASSWORD = 'replace-with-12-or-more-characters'
```

これらの値は現在のターミナルだけに設定されます。資格情報を README、ソースコード、共有スクリプトへ書き込まないでください。

### 4. 手動で起動する

```bash
npm start
```

ブラウザで [http://localhost:3208/](http://localhost:3208/) を開きます。既定ではこの PC からだけ接続できます。終了するには `Ctrl+C` を押します。

> 配布 ZIP はビルド済みのため、`npm run build` は不要です。

## Windows で常駐させる

Windows を主に使う場合は、セットアップスクリプトがもっとも簡単です。Windows サービスとして登録すると、ターミナルを開いたままにしなくても Windows の起動時に Tasker が自動で起動します。いずれの場合も、PowerShell または Windows Terminal を**管理者として実行**してください。

### セットアップスクリプトを使う（推奨）

手動起動の 1〜4 は不要です。任意のフォルダで次を実行します。

```powershell
.\setup-windows.ps1
```

#### 既定値について

特に指定しなければ、セットアップは次の値を使用します。通常は変更する必要がありません。

| 項目           | 既定値          | 意味                                                                                                                          |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| インストール先 | `D:\app\Tasker` | Tasker 本体とデータベース（`tasker.db`）を保存するフォルダです。インストール先の確認で Enter を押すと、この場所が使われます。 |
| ポート         | `3208`          | Tasker に接続するための番号です。ブラウザでは [http://localhost:3208/](http://localhost:3208/) を開きます。                   |

ポートを変更した場合は、URL と LAN 用ファイアウォール規則でも同じ番号を使用してください。たとえば `8080` を指定した場合の接続先は `http://localhost:8080/` です。

対話形式でインストール先、LAN 利用の有無、管理者アカウントを設定します。このスクリプトは次を自動で行います。

- Node.js v22 以上がなければ Node.js LTS をインストール
- 管理者アカウントを画面に表示せず入力・ログイン確認
- Tasker を Windows サービスとして登録
- LAN 利用時のみ、ローカルサブネットからの受信を許可するファイアウォール規則を追加

主なオプション:

```powershell
# インストール先とポートを変更
.\setup-windows.ps1 -InstallPath 'D:\Apps\Tasker' -Port 8080

# 同じバージョンでも再インストール
.\setup-windows.ps1 -Force
```

### 手動でサービス登録する

すでにリリースを展開し、依存関係をインストール済みで、環境変数を自分で管理したい場合はこちらを使います。手動起動の **1〜3** を行ってから実行してください（**4 の `npm start` は不要**です）。

```powershell
$env:TASKER_ADMIN_USERNAME = 'your-admin-name'
$env:TASKER_ADMIN_PASSWORD = 'replace-with-12-or-more-characters'
npm run service:install
```

登録後は `Tasker` サービスが自動起動します。`services.msc` または [http://localhost:3208/](http://localhost:3208/) で動作を確認してください。登録時点の認証・ネットワーク・セッション・CORS 設定がサービスに保存されます。設定を変えるときは、サービスを削除してから再登録してください。

### 更新と削除

既存のサービスを更新する場合も、セットアップスクリプトを使います。インストール先がすでに存在すると、既存のサービス設定を維持した更新処理に自動で切り替わります。データベースをバックアップし、ダウンロードした Release の SHA-256 を検証してから更新します。失敗時はアプリ本体と依存関係を自動復旧します。

インストール済みの Tasker フォルダにある `scripts\` で、PowerShell または Windows Terminal を**管理者として実行**して次を実行します。

```powershell
.\setup-windows.ps1
```

特定のリリースや、既定以外のポートを使っている場合の例:

```powershell
.\setup-windows.ps1 -InstallPath 'D:\Apps\Tasker' -ReleaseTag 'v0.14.0' -Port 8080
```

サービスだけを削除するには次を実行します。`tasker.db` は削除されません。

```powershell
npm run service:uninstall
```

セットアップ時に LAN 用ファイアウォール規則を作成した場合は、使っていたポートに合わせて削除してください。

```powershell
Remove-NetFirewallRule -DisplayName 'Tasker (LAN TCP 3208)'
```

## 設定とセキュリティ

### 環境変数

| 変数                          | 既定値      | 説明                                                              |
| ----------------------------- | ----------- | ----------------------------------------------------------------- |
| `TASKER_ADMIN_USERNAME`       | 必須        | 単一管理者のログイン名（256 文字以下）                            |
| `TASKER_ADMIN_PASSWORD`       | 必須        | 単一管理者のパスワード（12〜1024 文字）                           |
| `PORT`                        | `3208`      | 未指定時に使う接続ポート。通常の接続先は `http://localhost:3208/` |
| `TASKER_HOST`                 | `127.0.0.1` | 待受アドレス。LAN 公開時だけ `0.0.0.0` を指定                     |
| `TASKER_COOKIE_SECURE`        | `false`     | HTTPS 経由で利用するときだけ `true`                               |
| `TASKER_SESSION_TTL_MINUTES`  | `480`       | ログインセッションの有効時間（1〜10080 分）                       |
| `TASKER_LOGIN_MAX_ATTEMPTS`   | `5`         | 時間枠内に許可するログイン失敗回数（1〜100 回）                   |
| `TASKER_LOGIN_WINDOW_MINUTES` | `15`        | ログイン試行を数える時間枠（1〜1440 分）                          |
| `CORS_ORIGIN`                 | 未設定      | 追加で許可する Origin。完全な Origin をカンマ区切りで指定         |

開発時と `npm run preview:full` では、`.env.example` を `.env` にコピーして設定できます。

```bash
cp .env.example .env
```

`.env` は Git の管理対象外です。`npm start` と Windows サービスは `.env` を読み込まないため、上記のように環境変数を明示するか、サービスを再登録してください。

### 認証と公開範囲

- 未ログイン時は閲覧専用です。作成・編集・削除・並び替え・インポートにはログインが必要です。
- 認証は HttpOnly Cookie とサーバー側セッションで管理します。資格情報やログイン状態はフロントエンドの bundle・`localStorage` に保存しません。
- セッションはサーバーのメモリ内に保存されるため、Tasker を再起動すると失効します。
- 更新系 API は認証済みセッションに加え、CSRF token を必要とします。

### LAN に公開する場合

`TASKER_HOST=0.0.0.0` を指定すると LAN から接続できます。

```bash
export TASKER_HOST='0.0.0.0'
npm start
```

```powershell
$env:TASKER_HOST = '0.0.0.0'
npm start
```

その場合は `http://<この PC の IP アドレス>:3208/` でアクセスします。必要に応じてファイアウォールで受信ポートを許可してください。同一 Express サーバーから画面と API を配信する通常構成では、`CORS_ORIGIN` は不要です。

> **重要:** 読み取り用の GET API は認証なしで利用できます。Tasker へ到達できる端末はタスクを含む読み取りデータ全体を閲覧・エクスポートできます。また HTTP ではログイン情報と Cookie が暗号化されません。信頼できる LAN に限定し、可能なら HTTPS リバースプロキシと `TASKER_COOKIE_SECURE=true` を使ってください。インターネットへ直接公開しないでください。

> **リバースプロキシ利用時:** Tasker は偽装可能な `X-Forwarded-For` を既定では信用しません。そのためログイン試行制限は、プロキシ配下の全クライアントで同じ IP 枠を共有します。プロキシ側でも接続元を制限し、試行回数と時間枠を適切に設定してください。

## 開発

### 起動

依存関係をインストールし、`.env` を作成してからフロントエンドと API サーバーを同時に起動します。

```bash
npm install
cp .env.example .env
npm run dev:full
```

| プロセス           | URL                                              | 内容               |
| ------------------ | ------------------------------------------------ | ------------------ |
| Vite dev server    | [http://localhost:3208/](http://localhost:3208/) | React アプリ       |
| Express API server | [http://127.0.0.1:3209/](http://127.0.0.1:3209/) | `/api/*` と SQLite |

Vite は `/api` を API サーバーへプロキシします。通常の `npm run dev:full` で `CORS_ORIGIN` を追加する必要はありません。`npm run dev` 単体では API サーバーが起動しないため、API リクエストは `Bad Gateway` になります。

### 本番相当で確認する

```bash
npm run build
npm start
```

`dist/` の静的ファイルと `/api/*` を同じ Express サーバーから配信します。`npm start` は `.env` を読み込まないため、管理者資格情報を環境変数に設定してください。`npm run preview:full` は開発用の `.env` を使えます。

### コマンド一覧

| コマンド                                                  | 内容                                      |
| --------------------------------------------------------- | ----------------------------------------- |
| `npm run dev:full`                                        | API サーバーと Vite dev server を同時起動 |
| `npm run dev` / `npm run server`                          | Vite のみ / Express API のみを起動        |
| `npm run build`                                           | 型チェック、API、フロントエンドをビルド   |
| `npm run build:server`                                    | Express API サーバーのみをビルド          |
| `npm start`                                               | ビルド済み Express サーバーを起動         |
| `npm run preview:full`                                    | API サーバーと Vite preview を同時起動    |
| `npm run preview`                                         | Vite preview を起動                       |
| `npm run typecheck`                                       | 型チェック                                |
| `npm run test` / `npm run test:watch` / `npm run test:ui` | Vitest を実行 / watch / UI で起動         |
| `npm run test:coverage`                                   | カバレッジ付きでテスト                    |
| `npm run lint` / `npm run lint:fix`                       | ESLint の検査 / 自動修正                  |
| `npm run format` / `npm run format:check`                 | Prettier の整形 / 検査                    |
| `npm run licenses:generate`                               | `public/third-party-licenses.json` を生成 |
| `npm run service:install` / `npm run service:uninstall`   | Windows サービスの登録 / 削除             |

### 技術スタック

| 分類              | 使用技術                                              |
| ----------------- | ----------------------------------------------------- |
| フロントエンド    | React 19, TypeScript, Vite 8, Tailwind CSS v4         |
| UI / 状態         | Radix UI, lucide-react, Zustand, React Hook Form, Zod |
| 表示 / 操作       | dnd-kit, FullCalendar, TanStack Virtual, rrule        |
| バックエンド / DB | Express, SQLite (`better-sqlite3`)                    |
| テスト / PWA      | Vitest, Testing Library, vite-plugin-pwa              |

## データのバックアップ

SQLite データベースはアプリケーション直下の `tasker.db` に保存されます。主なテーブルは `projects`、`topics`、`tasks`、`subtasks`、`tags`、`task_completions`、`task_relations` です。

画面の JSON エクスポートには全テーブルのデータが含まれます。最終エクスポートから 7 日を超えると、アプリがバックアップを促します。インポートでは既存データを削除してからバックアップを復元します。インポート可能なファイルは `version` と `data` キーを持つバックアップ形式で、上限は 50 MB です。

> 更新前には JSON エクスポートを追加のバックアップとして取ることをおすすめします。

## API

| エンドポイント                      | 概要                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `POST /api/auth/login`              | ログインしてサーバーセッションを開始                      |
| `POST /api/auth/logout`             | 現在のセッションを失効してログアウト                      |
| `GET /api/auth/session`             | 現在の認証状態・セッション有効期限・CSRF token を取得     |
| `/api/projects`                     | プロジェクト CRUD                                         |
| `/api/topics`                       | トピック CRUD（`projectId` による絞り込み対応）           |
| `/api/tasks`                        | タスク CRUD（`topicId` / `projectId` による絞り込み対応） |
| `/api/tasks/gantt-order`            | 同一トピック内のガント表示順を一括更新                    |
| `/api/tasks/:id/complete-recurring` | 繰り返しタスクの完了履歴記録と次回タスク作成              |
| `/api/subtasks`                     | 作業リスト CRUD（`taskId` による絞り込み対応）            |
| `/api/tags`                         | タグの一覧・作成・削除                                    |
| `/api/completions`                  | タスク完了履歴の一覧・作成                                |
| `/api/import`                       | JSON バックアップをインポート                             |

GET API は未認証でも利用できます。POST、PUT、PATCH、DELETE、インポート、タグ管理、繰り返し完了は、認証済みセッションと有効な CSRF token が必要です。

主な認証関連のステータスコード:

| status | 意味                                             |
| ------ | ------------------------------------------------ |
| `401`  | 未認証、Cookie なし、またはセッション失効        |
| `403`  | CSRF token または Origin が不正                  |
| `429`  | ログイン試行回数が上限を超過。時間を置いて再試行 |

別 Origin のブラウザアプリから API を直接利用する場合のみ、信頼できる Origin を `CORS_ORIGIN` に完全一致で指定してください。ワイルドカード `*` は使えません。CORS は公開 GET API のアクセス制限にはなりません。

## ディレクトリ構成

```text
server/                   # Express、認証、SQLite、API ルート
├── auth.ts               # セッション・Cookie・CSRF・ログイン試行制限
├── config.ts             # 認証・待受・CORS の環境変数検証
├── db.ts                 # SQLite 接続・テーブル作成
└── routes/               # projects / topics / tasks / subtasks / tags / completions / import

src/
├── components/           # レイアウト、フォーム、ビュー、UI 部品
├── hooks/                # データ取得・更新・各ビュー用 hook
├── repositories/         # API repository と Result 型ラッパー
├── store/                # Zustand stores
├── types/                # Project / Topic / Task などの型定義
└── utils/                # 日付・フィルタ・並び替え・エクスポート・繰り返し処理

scripts/                  # Windows サービス、セットアップ、更新用スクリプト
```

## トラブルシュート

### `Bad Gateway` が出る

`npm run dev` だけでは API サーバーが起動していません。次を使用してください。

```bash
npm run dev:full
```

### `concurrently: command not found` が出る

開発用の依存関係が未インストールです。

```bash
npm install
```

### ログイン後も編集できない、または再起動後にログアウトされた

セッションは Tasker サーバーのメモリに保存されます。サーバー再起動後は再ログインしてください。ログイン後も編集できない場合は、ブラウザを再読み込みして認証状態を更新してください。

## ライセンス

[MIT License](LICENSE)
