# Tasker

Tasker は、プロジェクト、トピック、タスクを複数ビューで管理するタスク管理アプリです。

現在の実装は React/Vite のフロントエンドと Express + SQLite の API サーバーで構成されています。タスクデータはブラウザではなく、サーバー側で作成される `tasker.db` に保存されます。

## 主な機能

### ビュー

| ビュー | 概要 |
| --- | --- |
| リスト | プロジェクト内のトピックごとにタスクを一覧表示。トピックの開閉、作成、名称変更、削除、タスクの並び替えに対応 |
| カンバン | 未着手、進行中、完了、キャンセルの列でタスクを表示。ドラッグでステータス変更可能。進行中列は WIP 5 件制限 |
| カレンダー | FullCalendar ベースの月、週、日表示。期日付きタスクと繰り返しタスクを表示し、ドラッグで期日変更可能 |
| ガント | 開始日と期日をタイムライン表示。日、週、月スケール切替、バーの移動、左右リサイズ、空行ドラッグで日程作成に対応 |

### タスク管理

- タイトル、説明、ステータス、優先度、開始日、期日を管理
- ステータス: 未着手、進行中、完了、キャンセル
- 優先度: 低、中、高、緊急
- リスト上での完了切替、削除、ドラッグ並び替え
- タスクドロワーでの作成、編集、削除
- 繰り返しタスク: 毎日、毎週、毎月、毎年と間隔指定に対応
- 繰り返しタスクを完了すると、完了履歴を記録し、次回分のタスクを自動作成

### プロジェクトとトピック

- プロジェクトの作成、編集、削除
- プロジェクトごとの色設定
- トピックの作成、名称変更、削除
- プロジェクト削除時は配下のトピック、タスク、関連データも削除

### 検索、フィルタ、補助機能

- タスクタイトル、説明のテキスト検索
- ステータス、優先度、タグ ID によるフィルタ
- タグマスターの作成、削除
- ダーク / ライトテーマ切替
- JSON エクスポート / インポート
- 最後のエクスポートから 7 日以上経過した場合のバックアップ警告
- アプリ本体と依存ライブラリのライセンス表示
- PWA manifest と service worker 対応

### 編集モード

未ログイン時は閲覧モードです。作成、編集、削除、ドラッグ更新、インポートなどの更新操作にはログインが必要です。

```text
ユーザー名: admin
パスワード: tasker
```

このログインはローカル UI の編集ゲートです。認証状態は `localStorage` に保存され、サーバー API の認証機構ではありません。

### キーボードショートカット

| キー | 動作 |
| --- | --- |
| `n` | 選択中プロジェクトの先頭トピックに新規タスクを作成 |
| `/` | 検索ボックスにフォーカス |

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

## 開発起動

通常の開発では、フロントエンドと API サーバーを同時に起動します。

```bash
npm run dev:full
```

起動後は `http://localhost:3208/` を開きます。

| プロセス | URL | 内容 |
| --- | --- | --- |
| Vite dev server | `http://localhost:3208/` | React アプリ |
| Express API server | `http://localhost:3209/` | `/api/*` と SQLite |

Vite は `/api` を `http://localhost:3209` にプロキシします。`npm run dev` だけを起動した場合、API サーバーが立っていないため `/api` へのアクセスで Bad Gateway になります。

## 本番相当の起動

Express サーバーは `dist/` の静的ファイルと `/api/*` の両方を配信します。

```bash
npm run build
npm start
```

この場合は、デフォルトで `http://localhost:3208/` からアプリと API を同一オリジンで利用します。

## データ保存

SQLite データベースはリポジトリ直下の `tasker.db` に作成されます。

主なテーブル:

- `projects`
- `topics`
- `tasks`
- `subtasks`
- `tags`
- `task_completions`

JSON エクスポートには上記テーブルのデータが含まれます。インポート時は既存データを削除してからバックアップ内容を投入します。インポート可能な JSON は `version` と `data` を持つバックアップ形式で、ファイルサイズ上限は 50 MB です。

## API

| エンドポイント | 概要 |
| --- | --- |
| `/api/projects` | プロジェクト CRUD |
| `/api/topics` | トピック CRUD、`projectId` 絞り込み |
| `/api/tasks` | タスク CRUD、`topicId` / `projectId` 絞り込み |
| `/api/tasks/:id/complete-recurring` | 繰り返しタスクの完了履歴記録と次回タスク作成を一括実行 |
| `/api/subtasks` | サブタスク CRUD、`taskId` 絞り込み |
| `/api/tags` | タグ一覧、作成、削除 |
| `/api/completions` | タスク完了履歴の一覧、作成 |
| `/api/import` | JSON バックアップのインポート |

開発時の CORS 許可オリジンは、デフォルトで `http://localhost:3208`、`http://localhost:4173`、`http://localhost:5173` です。必要に応じて `CORS_ORIGIN` にカンマ区切りで指定できます。

## コマンド

```bash
npm run licenses:generate # public/third-party-licenses.json を生成
npm run server            # Express API server を tsx watch で起動
npm start                 # ビルド済み Express API server を起動
npm run dev               # Vite dev server のみ起動
npm run dev:full          # API server と Vite dev server を同時起動
npm run typecheck         # フロントエンドと API server の型チェック
npm run build:server      # API server を dist-server/ にビルド
npm run build             # 型チェック、API server、本番フロントエンドをビルド
npm run preview           # Vite preview
npm run preview:full      # API server と Vite preview を同時起動
npm run test              # Vitest を一度実行
npm run test:watch        # Vitest watch
npm run test:ui           # Vitest UI
npm run test:coverage     # coverage 付きテスト
npm run lint              # ESLint
npm run lint:fix          # ESLint 自動修正
npm run format            # Prettier
```

## ディレクトリ構成

```text
server/
├── db.ts                 # SQLite 接続、テーブル作成
├── index.ts              # Express アプリ、CORS、API mount、dist 配信
└── routes/               # projects/topics/tasks/subtasks/tags/completions/import

src/
├── components/
│   ├── auth/             # ログインダイアログ
│   ├── filter/           # 検索、フィルタパネル
│   ├── layout/           # AppShell, Sidebar, ViewTabs, ExportWarning
│   ├── project/          # プロジェクト作成、編集フォーム
│   ├── task/             # タスク行、タスクドロワー、タグ管理
│   ├── ui/               # Button, Badge, Skeleton
│   └── views/            # List, Kanban, Calendar, Gantt
├── hooks/                # データ取得、更新通知、繰り返し、各ビュー用 hook
├── repositories/         # API repository と Result 型ラッパー
├── store/                # Zustand stores
├── test/                 # Vitest setup
├── types/                # Project/Topic/Task などの型定義
└── utils/                # 日付、フィルタ、並び替え、エクスポート、繰り返し処理
```

## トラブルシュート

### `Bad Gateway` が出る

`npm run dev` だけでは API サーバーが起動しません。開発時は次を使ってください。

```bash
npm run dev:full
```

### `concurrently: command not found` が出る

依存関係が未インストールです。

```bash
npm install
```
