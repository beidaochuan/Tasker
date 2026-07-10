# Tasker

プロジェクト・トピック・タスクを複数ビューで管理するタスク管理アプリです。  
フロントエンドは React/Vite、バックエンドは Express + SQLite で構成されています。

---

## 機能概要

### ビュー

| ビュー | 概要 |
| --- | --- |
| リスト | トピックごとにタスクを一覧表示。トピックの開閉・作成・名称変更・削除、タスクのドラッグ並び替えに対応 |
| カンバン | 未着手 / 進行中 / 完了 / キャンセルの列でタスクを管理。ドラッグでステータス変更、進行中列は WIP 5 件制限 |
| カレンダー | FullCalendar ベースの月・週・日表示。期日付きタスクと繰り返しタスクを表示し、ドラッグで期日変更可能 |
| ガント | 開始日〜期日をタイムライン表示。日・週・月スケール切替、バーの移動・リサイズ、空行ドラッグで日程作成に対応 |

### タスク管理

- タイトル、説明、ステータス（未着手 / 進行中 / 完了 / キャンセル）、優先度（低 / 中 / 高 / 緊急）、開始日、期日を管理
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

```text
ユーザー名: admin
パスワード: tasker
```

> 認証状態は `localStorage` に保存されます。サーバー側 API の認証機構ではありません。

### キーボードショートカット

| キー | 動作 |
| --- | --- |
| `n` | 選択中プロジェクトの先頭トピックに新規タスクを作成 |
| `/` | 検索ボックスにフォーカス |

---

## 技術スタック

| 分類 | 使用技術 |
| --- | --- |
| フロントエンド | React 19, TypeScript |
| ビルド | Vite 8 |
| スタイル | Tailwind CSS v4 |
| UI | Radix UI, lucide-react |
| 状態管理 | Zustand |
| フォーム | React Hook Form, Zod |
| D&D | dnd-kit |
| カレンダー | FullCalendar |
| ガント仮想スクロール | TanStack Virtual |
| 繰り返しルール | rrule |
| API | Express |
| DB | SQLite (`better-sqlite3`) |
| テスト | Vitest, Testing Library |
| PWA | vite-plugin-pwa |

---

## インストール（リリース版）

### 前提条件

- [Node.js](https://nodejs.org/) v22 以上

### 手順

1. [GitHub Releases](https://github.com/beidaochuan/Tasker/releases) から最新の `tasker-vX.X.X.zip` をダウンロードして解凍する
2. 解凍したフォルダ内でターミナルを開き、本番依存関係をインストールする

```bash
npm ci --omit=dev
```

3. アプリを起動する

```bash
npm start
```

ブラウザで `http://localhost:3208/` を開きます。  
同一ネットワーク内の別端末からは `http://<このPCのIPアドレス>:3208/` でアクセスできます。

PC 起動時に自動起動させたい場合は [Windows サービス登録](#windows-サービス登録) を参照してください。

---

## 開発

### 起動

フロントエンドと API サーバーを同時に起動します。

```bash
npm run dev:full
```

| プロセス | URL | 内容 |
| --- | --- | --- |
| Vite dev server | `http://localhost:3208/` | React アプリ |
| Express API server | `http://localhost:3209/` | `/api/*` + SQLite |

Vite は `/api` を `http://localhost:3209` にプロキシします。`npm run dev` 単体では API サーバーが起動しないため Bad Gateway になります。

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

| エンドポイント | 概要 |
| --- | --- |
| `/api/projects` | プロジェクト CRUD |
| `/api/topics` | トピック CRUD（`projectId` 絞り込み対応） |
| `/api/tasks` | タスク CRUD（`topicId` / `projectId` 絞り込み対応） |
| `/api/tasks/:id/complete-recurring` | 繰り返しタスクの完了履歴記録と次回タスク作成 |
| `/api/subtasks` | サブタスク CRUD（`taskId` 絞り込み対応） |
| `/api/tags` | タグ一覧・作成・削除 |
| `/api/completions` | タスク完了履歴の一覧・作成 |
| `/api/import` | JSON バックアップのインポート |

開発時の CORS 許可オリジンは `http://localhost:3208`、`http://localhost:4173`、`http://localhost:5173` です。  
追加する場合は環境変数 `CORS_ORIGIN` にカンマ区切りで指定します。

---

## ディレクトリ構成

```text
server/
├── db.ts                 # SQLite 接続・テーブル作成
├── index.ts              # Express アプリ・CORS・API mount・dist 配信
└── routes/               # projects / topics / tasks / subtasks / tags / completions / import

src/
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

## Windows サービス登録

PC 起動時に自動起動させる場合は、Tasker を Windows サービスとして登録します。

### 前提条件

- `npm run build` 済みで `dist-server/index.js` が存在すること
- **管理者権限**のターミナルで実行すること

### 登録

```bash
npm run service:install
```

成功するとサービスが自動起動し、`http://localhost:3208/` でアクセスできます。  
ポートを変更する場合は `PORT` 環境変数を指定します。

```bash
PORT=8080 npm run service:install
```

### 削除

```bash
npm run service:uninstall
```

> サービスを再インストールする場合は、先に `service:uninstall` を実行してから `service:install` を実行してください。  
> サービス名は `Tasker` です。`services.msc` からも起動・停止を操作できます。

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
