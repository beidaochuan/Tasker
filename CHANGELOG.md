# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-07-06

### Added
- Windows サービスへの登録・削除スクリプトを追加 (`npm run service:install` / `npm run service:uninstall`)
- `node-windows` パッケージを依存関係に追加

## [0.3.1] - 2026-07-04

### Fixed
- GitHub Release の配布物に API サーバーを同梱し、静的ファイル単体では動作しない問題を修正
- JSON インポートのサーバー側リクエストサイズ上限を 50 MB に合わせるよう修正
- 繰り返しタスク完了時の完了履歴記録と次回タスク作成をトランザクション化
- タグ削除時にタスク内へ残る孤立タグ ID を削除するよう修正
- API の 400 / 409 系エラーを validation / conflict として扱うよう修正

### Changed
- ビルド時に API サーバーも型チェックとビルドの対象に含めるよう変更

## [0.3.0] - 2026-06-16

### Added
- 簡易ログインによる編集モード切替
- 未ログイン時の閲覧モード
- 未ログイン時の作成・編集・削除・ドラッグ更新・インポート操作の制限

## [0.1.0] - 2026-06-12

### Added
- プロジェクト・トピック・タスクの作成・編集・削除
- タスクのリストビュー（DnD によるソート・フィルタ対応）
- カンバンビュー（列間ドラッグ＆ドロップ）
- カレンダービュー（FullCalendar ベース）
- ガントビュー（バーのドラッグ・リサイズ対応）
- 繰り返しタスク（RRule ベース、全発生日展開表示）
- タグ管理機能
- JSONエクスポート・インポート
- PWA 対応（オフライン利用可能）
- ダークモード対応
- プロジェクト削除（トピック・タスクの連鎖削除）
- タスク一覧の削除ボタン（ホバー表示・確認ダイアログ）
