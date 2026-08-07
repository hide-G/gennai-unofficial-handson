# ガバメントAI「源内」非公式デプロイハンズオン資料

有志が非公式で作成する、ガバメントAI「源内」デプロイハンズオン資料です。公式資料ではありません。

## 免責

本資料は有志により作成された非公式の学習資料です。
デジタル庁および「源内」の公式提供者が作成・承認・サポートするものではありません。
内容は利用者自身の責任で確認してください。

## 対象プロジェクト

- 源内 Web: <https://github.com/digital-go-jp/genai-web>
- 源内 AI アプリ: <https://github.com/digital-go-jp/genai-ai-api>

## ローカルプレビュー

Windowsでの初回構築、起動・表示確認、AWS公式資料を根拠にしたKiroレビュー、停止方法は[ローカル開発ガイド](LOCAL_DEVELOPMENT.md)を参照してください。

Python 3.11以上を用意し、リポジトリのルートで次を実行します。

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
mkdocs serve
```

ブラウザーで表示されたローカルURLを開くと、編集内容を確認できます。編集したMarkdownは自動的に再読み込みされます。公開用のビルド確認には次を実行します。

```bash
mkdocs build --strict
```

生成物は `site/` に出力されます。`site/` はビルド生成物なので、通常はコミットしません。

## GitHub Pagesで公開する方法

1. このリポジトリの **Settings > Pages > Build and deployment > Source** を **GitHub Actions** に設定します。
2. `main` ブランチへ変更をマージするか、Actionsの **Deploy MkDocs site to GitHub Pages** ワークフローで **Run workflow** を実行します。
3. ワークフローが `mkdocs build --strict` に成功すると、GitHub Pages artifactが公開されます。
4. 初回公開後の想定URLは次です。

   `https://hide-G.github.io/gennai-unofficial-handson/`

Actionsは、GitHub公式のPages関連Actions（`configure-pages`、`upload-pages-artifact`、`deploy-pages`）だけを使っています。workflowにはPages公開に必要な最小権限を設定しています。

## A4印刷またはPDF保存

ナビゲーションの **A4印刷 / PDF保存** を開くと、印刷用プラグインが全ページを1ページにまとめた画面を生成します。ブラウザーの印刷メニュー（または `Ctrl` / `Cmd` + `P`）を開き、用紙サイズを **A4**、向きを **縦**、保存先を **PDFに保存** にして保存してください。

`docs/stylesheets/print.css` で、A4の余白、見出し・表・コードブロックの改ページ、検索欄・ナビゲーション・操作ボタンの非表示を設定しています。

## 原稿の追加・更新

資料本文は `docs/` 配下のMarkdownを編集すれば更新できます。

- `docs/*.md`: 各章の本文（`mkdocs.yml` の `nav` に登録された順に表示されます）
- `docs/stylesheets/theme.css`: サイトテーマ色（AWSオレンジ）
- `docs/stylesheets/print.css`: A4印刷とPDF保存のスタイル
- `mkdocs.yml`: サイト名、ナビゲーション、テーマ、検索、コードコピー、印刷プラグインの設定

章を追加するときは、`docs/` の下にMarkdownを作成し、`mkdocs.yml` の `nav` に登録してください。`main` へマージすると、GitHub Actionsにより自動的にGitHub Pagesが更新されます。

## 章立て

- 第1章 ガバメントAI「源内」の概要
- 第2章 システムアーキテクチャの紹介
- 第3章 AWSアカウントの注意（コスト、権限、リージョン）
- 第4章 源内 Web（AI インターフェース）
- 第5章 源内 AI アプリのデプロイ
- 第6章 後片付け
- 第7章 想定質問集（FAQ）
- 第8章 用語集・参考リンク

現時点では各章のスケルトンのみが用意されています。順序や粒度は執筆時に調整します。

## リポジトリ

- リポジトリ: <https://github.com/hide-G/gennai-unofficial-handson>
- ライセンスや配布条件は今後検討します
