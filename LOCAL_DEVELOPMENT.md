# ローカル開発ガイド

このガイドは、Windows上で本リポジトリのMkDocsサイトをローカル表示しながら各章を執筆・確認するための手順です。公開用のGitHub PagesやAWSアカウントを操作せず、ローカルだけで表示確認と品質確認を行えます。

## 1. 前提条件

- Windows 10 / 11
- Git
- Python 3.11以上（CIはPython 3.11でビルドします）
- 最新のブラウザー
- Visual Studio CodeとKiro（AWS情報のレビュー時に推奨）

リポジトリのルートでPowerShellを開いてください。`site/`と`.venv/`はGit管理対象外です。

```powershell
Set-Location <リポジトリのパス>\gennai-unofficial-handson
python --version
git --version
```

## 2. 初回セットアップ

以下は初回だけ実行します。仮想環境を有効化せず、プロジェクト専用のPythonを明示して実行するため、PowerShellの実行ポリシーに影響されません。

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

`requirements.txt`にはMkDocs Material、印刷ページ、見出し採番プラグインの固定バージョンが記載されています。`requirements.txt`が更新された場合は、次を再実行して同期してください。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

## 3. ローカルサーバーの起動

次のコマンドを実行します。サーバーは実行中のPowerShellを使い続けるため、執筆用に別のターミナルを開いておくと便利です。

```powershell
.\.venv\Scripts\python.exe -m mkdocs serve --strict --dev-addr 127.0.0.1:8000
```

`mkdocs.yml`の`site_url`にリポジトリ名のパスが含まれるため、ローカルでもGitHub Pagesと同じサブパスで配信されます。ブラウザーで次を開きます。

- 通常表示: <http://127.0.0.1:8000/gennai-unofficial-handson/>
- A4印刷用ページ: <http://127.0.0.1:8000/gennai-unofficial-handson/print_page/>

起動時のログに表示される`Serving on ...`のURLが正しい入口です。`http://127.0.0.1:8000/print_page/`のようにサブパスを省略すると404になります。

Markdown、CSS、JavaScript、`mkdocs.yml`を保存すると、MkDocsが自動で再ビルドし、ブラウザーを再読み込みして結果を確認できます。画面が古い場合は`Ctrl + F5`で強制再読み込みするか、シークレットウィンドウで開いてください。

## 4. 執筆とテスト表示

| 変更対象 | 操作 |
| --- | --- |
| 章本文 | `docs/*.md`を編集する |
| 章の追加 | `docs/`にMarkdownを追加し、`mkdocs.yml`の`nav`へ登録する |
| 画面テーマ | `docs/stylesheets/theme.css`を編集する |
| A4印刷・PDF | `docs/stylesheets/print.css`を編集し、`/print_page/`を開く |
| サイドバー操作 | `docs/javascripts/sidebar-toggle.js`を編集する |

章を追加・更新したら、少なくとも次をブラウザーで確認します。

1. 変更した章がナビゲーションから開け、見出し・目次・コードブロックが正しく表示される。
2. ページ内リンクと章間リンクをクリックして、404ページにならない。
3. 検索候補と検索結果が表示される。
4. `A4印刷 / PDF保存`（`/gennai-unofficial-handson/print_page/`）を開き、ブラウザーの印刷プレビューでA4・縦向きの改ページを確認する。
5. デスクトップ幅で本文、左側目次、サイドバー表示・非表示の切り替えが崩れない。

## 5. 公開前の自動検証

ローカルサーバーの表示確認に加え、変更を共有する前に次を実行します。

```powershell
.\.venv\Scripts\python.exe -m mkdocs build --strict
git diff --check
git status --short
```

`mkdocs build --strict`は警告もエラーとして扱い、設定・プラグイン・リンクに問題がないことを確認します。生成物は`site/`に出力されますが、Gitへコミットしません。`git diff --check`は不要な末尾空白や不正なパッチ形式を検出します。

## 6. AWS公式情報を根拠にしたKiroレビュー

MkDocsのビルドだけでは、AWSサービスの仕様、対応リージョン、IAM権限、料金、クォータ、CLI/APIの説明が最新かどうかは検証できません。各章の技術的な記述は、KiroにAWS公式資料だけを根拠としてレビューさせ、人が内容を確認してから反映します。

### 実施手順

1. Kiroのチャットで対象章を`#File`として指定します。
2. 以下のプロンプトを貼り付けてレビューを依頼します。
3. 指摘の根拠URLを開き、修正案と本文の意図を人が確認します。
4. 採用する修正だけを本文へ反映し、[公開前の自動検証](#5-公開前の自動検証)を再実行します。

```text
#File <対象のMarkdownファイル>

この章を、AWS公式ドキュメントを根拠に技術レビューしてください。

- 仕様、対応リージョン、IAM、料金、クォータ、AWS CLI/API、サービス提供状況に関する記述を確認する。
- 根拠は docs.aws.amazon.com または aws.amazon.com の公式ページに限定する。公式根拠を確認できない場合は推測で補わず、「要人間確認」とする。
- 本文は変更しない。指摘だけを表形式で返す。
- 各指摘に「重要度」「元の記述」「修正案」「AWS公式URL」「確認日（YYYY-MM-DD）」「確度」「要人間確認事項」を必ず含める。
- 公式資料の更新時期、リージョン差、料金・クォータの変動可能性を明記する。
- 非公式ブログや検索結果の要約を根拠にしない。
```

この手順は、Kiroによる情報収集と比較を自動化するものです。事実関係の最終判断、修正の適用、GitHub Pagesへの公開は必ず人が行ってください。AWS認証情報、アクセスキー、外部LLMのAPIキーをローカル開発用に追加する必要はありません。

## 7. サーバーの停止

通常は、`mkdocs serve`を実行しているPowerShellで`Ctrl + C`を一度押します。終了メッセージが表示されたら、ブラウザーのタブを閉じて構いません。

`8000`番ポートが残っていて次回起動できない場合だけ、所有プロセスを確認してから停止します。

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess

Stop-Process -Id <OwningProcess>
```

`Stop-Process`は、表示された`OwningProcess`が自分のMkDocs用Pythonプロセスであることを確認してから実行してください。

## 8. よくある問題

| 状況 | 対処 |
| --- | --- |
| `No module named mkdocs` | `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`を実行する |
| ブラウザーに変更が反映されない | サーバーのログにビルドエラーがないか確認し、`Ctrl + F5`で強制再読み込みする |
| ローカルで404になる | `/gennai-unofficial-handson/`を含むURLで開く。起動ログの`Serving on ...`のURLを使う |
| ポート8000が使用中 | [サーバーの停止](#7-サーバーの停止)の手順で所有プロセスを確認するか、`--dev-addr 127.0.0.1:8001`を指定する |
| 厳格ビルドが失敗する | エラーに示されたMarkdownリンク、`mkdocs.yml`の`nav`、プラグイン設定を修正して再実行する |
| AWSの記述に公式根拠がない | 推測で書き換えず、公式資料の確認先と確認事項を本文またはレビュー結果に残す |

## 9. 日常の最短手順

セットアップ済みなら、執筆開始時は次の1行だけです。

```powershell
.\.venv\Scripts\python.exe -m mkdocs serve --strict --dev-addr 127.0.0.1:8000
```

執筆を終えたら`Ctrl + C`で停止し、共有前に`mkdocs build --strict`と`git diff --check`を実行します。

