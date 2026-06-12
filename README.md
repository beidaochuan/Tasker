# Tasker

ブラウザ完結型のタスク管理アプリ。すべてのデータはブラウザの IndexedDB に保存され、サーバー不要で動作します。

## 機能

### ビュー
| ビュー | 概要 |
|--------|------|
| **リストビュー** | プロジェクト内のトピック（グループ）ごとにタスクを一覧表示。ドラッグ＆ドロップで並び替え可能 |
| **カンバンビュー** | ステータス列（未着手・進行中・完了・キャンセル）にカードを配置。列間のドラッグ移動に対応 |
| **カレンダービュー** | 月・週・日単位の表示。FullCalendar ベース、繰り返しタスクも展開表示 |
| **ガントチャートビュー** | 開始日〜期日をバーで可視化。スケール切替（日/週/月）、バーのドラッグ移動・両端リサイズで日程変更可能。空行のドラッグでバー新規作成 |

### タスク管理
- タイトル・説明・ステータス・優先度（低/中/高/緊急）・開始日・期日
- サブタスク（チェックリスト）
- タグ付け（色付きラベル）
- **繰り返しタスク**：毎日・毎週・毎月・毎年、N 回ごとの間隔設定。完了時に次のタスクを自動生成（RRule 準拠）
- タスク一覧からドロワーを開かずに直接削除可能（確認ダイアログあり）

### フィルタ・検索
- テキスト検索（`/` キーでフォーカス）
- ステータス・優先度・タグ・期日範囲の複合フィルタ

### プロジェクト管理
- サイドバーからプロジェクトを削除（トピック・タスクを連鎖削除、確認ダイアログあり）

### データ管理
- JSON エクスポート／インポート（バックアップ・移行用）
- 7 日以上エクスポートしていない場合の警告表示

### その他
- ダーク / ライトテーマ切替
- PWA 対応（オフライン動作・インストール可能）
- キーボードショートカット（`n`: 新規タスク、`/`: 検索フォーカス）

## 技術スタック

| 分類 | ライブラリ |
|------|-----------|
| フレームワーク | React 19 + TypeScript |
| ビルド | Vite 8 |
| スタイル | Tailwind CSS v4 |
| 状態管理 | Zustand |
| DB | Dexie (IndexedDB ラッパー) |
| フォーム | React Hook Form + Zod |
| D&D | dnd-kit |
| カレンダー | FullCalendar 6 |
| 繰り返しルール | rrule |
| UI コンポーネント | Radix UI |
| テスト | Vitest + Testing Library |
| PWA | vite-plugin-pwa |

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動（http://localhost:5173）
npm run dev
```

## コマンド一覧

```bash
npm run dev          # 開発サーバー
npm run build        # プロダクションビルド
npm run preview      # ビルド結果をローカルでプレビュー
npm run test         # テスト実行
npm run test:watch   # テストをウォッチモードで実行
npm run test:ui      # Vitest UI を開く
npm run test:coverage # カバレッジ計測
npm run lint         # ESLint チェック
npm run lint:fix     # ESLint 自動修正
npm run format       # Prettier フォーマット
```

## ディレクトリ構成

```
src/
├── components/
│   ├── layout/        # AppShell, Sidebar, ViewTabs
│   ├── views/
│   │   ├── ListView/     # リストビュー
│   │   ├── KanbanView/   # カンバンビュー
│   │   ├── CalendarView/ # カレンダービュー
│   │   └── GanttView/    # ガントチャートビュー
│   ├── task/          # TaskDrawer, SortableTaskRow, TagManager
│   ├── filter/        # FilterPanel
│   └── ui/            # 汎用 UI コンポーネント (Button, Badge 等)
├── db/                # Dexie スキーマ定義
├── hooks/             # カスタムフック (useTasks, useRecurrence 等)
├── repositories/      # DB アクセス層
├── store/             # Zustand ストア (UI 状態, テーマ, フィルタ)
├── types/             # 型定義
└── utils/             # ユーティリティ (日付, フィルタ, エクスポート等)
```

## データストレージ

すべてのデータはブラウザの IndexedDB（Dexie v4）に保存されます。外部サーバーへの通信は一切ありません。データを移行・バックアップするには、サイドバーの **エクスポート** ボタンから JSON ファイルを保存してください。
