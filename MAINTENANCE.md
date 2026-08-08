# メンテナンス運用メモ

資料の一部を「メンテナンス中」として非公開にしている状態と、その解除・再公開の手順、
コンフリクトの対処方法を記録しています。作業を引き継ぐ人（生成AIエージェントを含む）が
最初に読むことを想定した引き継ぎ文書です。

最終更新: 2026-08-08（JST）

> このファイルは `docs/` の外にあるため MkDocs のビルド対象外です。サイトには公開されません。

---

## 1. 現在の状態

| 章 | 公開サイト | 本文の実体 |
| --- | --- | --- |
| 第4章 源内 Web（AI インターフェース） | メンテナンス表示 | `docs/web_draft.md` |
| 第5章 源内 AI アプリのデプロイ | メンテナンス表示 | `docs/deploy-ai-api_draft.md` |

上記以外の章（第1〜3章、第6〜8章）は通常どおり公開しています。

`docs/web.md` と `docs/deploy-ai-api.md` には、次の告知だけを置いています。

```markdown
# 第4章 源内 Web（AI インターフェース）

!!! warning "この章はメンテナンス中です"
    内容の見直しと整備を行っています。公開できる状態になりましたら、改めて掲載します。

    対象リポジトリ: <https://github.com/digital-go-jp/genai-web>
```

---

## 2. 仕組み

`mkdocs.yml` に次の設定を入れています。

```yaml
draft_docs: |
  *_draft.md

not_in_nav: |
  *_draft.md
```

`*_draft.md` にマッチするファイルは、`mkdocs serve`（ローカルプレビュー）では表示されますが、
`mkdocs build` の出力には含まれません。MkDocs 1.6 の `draft_docs` 機能です。
GitHub Actions（`.github/workflows/deploy-pages.yml`）は `mkdocs build --strict` を
実行するため、下書きが公開されることはありません。

参照: [MkDocs Configuration](https://www.mkdocs.org/user-guide/configuration/)
（ライセンス上の制約に配慮して表現を変更しています）

### 前提として知っておくこと

- **GitHub Pages（public リポジトリ）では IP 制限も Basic 認証も使えません。** アクセス制御は
  GitHub Enterprise Cloud の機能です。したがってこの構成でできるのは「サイトに出力しない」ことだけです。
- **`docs/*_draft.md` は GitHub 上では誰でも読めます。** リポジトリが public であるためです。
  閲覧者を本当に限定する必要が出た場合は、次のいずれかを検討してください。
    - リポジトリを private にする（private リポジトリからでも Pages は公開できます）
    - 下書きをコミットせず手元だけに置く（`.gitignore` に `docs/*_draft.md` を追加）

---

## 3. 下書きを読む（ローカル）

```bash
pip install -r requirements.txt
mkdocs serve
```

- 第4章: <http://127.0.0.1:8000/gennai-unofficial-handson/web_draft/>
- 第5章: <http://127.0.0.1:8000/gennai-unofficial-handson/deploy-ai-api_draft/>

起動ログに次のような行が出るのが正常な状態です。

```text
The following pages are being built only for the preview
but will be excluded from `mkdocs build` per `draft_docs` config
```

ポートを変えたい場合は `mkdocs serve -a 127.0.0.1:8123` のように指定します。

---

## 4. メンテナンスを解除して再公開する手順

第4章を再公開する例です。

```bash
git switch main
git pull
git switch -c docs/publish-chapter4

# 下書きを本編へ戻す（メンテナンス表示は上書きされて消える）
git mv -f docs/web_draft.md docs/web.md
```

すべての章を再公開して下書きが残らなくなった場合は、`mkdocs.yml` の `draft_docs` と
`not_in_nav` の設定を削除してかまいません。下書きが1つでも残るなら設定は残します。

検証してからコミットします。

```bash
mkdocs build --strict --site-dir _verify_site
# 手順が公開対象に含まれることを確認したら削除
```

---

## 5. コンフリクトが起きる理由と対処

### なぜ起きるか

メンテナンス表示と本文が `docs/<章>.md` という同じパスを取り合うためです。次の順序で必ず衝突します。

1. 本文を更新する PR が main にマージされる
2. その後にメンテナンス化 PR をマージしようとする → `docs/<章>.md` でコンフリクト

実際に 2026-08-08 に発生しました。PR #15（第4章の本文）と PR #16（第5章の本文）が main に
マージされた後、メンテナンス化の PR #17 が両方と衝突しました。

### 解決の原則

**メンテナンス中の章は `docs/<章>.md` を必ずメンテナンス表示のままにし、本文の変更は
`docs/<章>_draft.md` 側に入れる。**

この原則を守れば、どちらの側から更新が来ても解決方法は一つに定まります。

### 手順

```bash
git switch <作業ブランチ>
git fetch origin main
git merge origin/main
# docs/web.md, docs/deploy-ai-api.md が CONFLICT になる
```

コンフリクトしたファイルは、第1節に載せたメンテナンス表示の内容で**上書き**して `git add` します。
コンフリクトマーカー（`<<<<<<<`、`=======`、`>>>>>>>`）が残っていないか必ず確認してください。

そのうえで、main 側に入った本文の変更を取りこぼしていないか確認します。

```bash
# blob ハッシュが一致すれば下書きは最新
git rev-parse origin/main:docs/web.md
git rev-parse HEAD:docs/web_draft.md
```

一致しない場合は、main 側の本文で下書きを更新します。

```bash
# Windows PowerShell のリダイレクトは UTF-8 が壊れるため cmd 経由で実行する
cmd /c "git show origin/main:docs/web.md > docs\web_draft.md"
```

`git rev-parse` と `git hash-object` の比較で、内容が完全一致していることを確認できます。

```bash
git rev-parse origin/main:docs/web.md
git hash-object docs/web_draft.md
```

### force push は使えない

ルールセットで `non_fast_forward` が禁止されています。リベースで履歴を書き換える運用はできません。
main の取り込みは `git merge` で行ってください。

---

## 6. マージ時の制約（ルールセット Protect main）

リポジトリのルールセット `Protect main`（id: 19182238、enforcement: active）が有効です。

| ルール | 設定 |
| --- | --- |
| `required_approving_review_count` | 1（承認1件が必須） |
| `require_last_push_approval` | true（最後の push に対する承認が必要） |
| `require_code_owner_review` | true |
| `dismiss_stale_reviews_on_push` | true（push すると既存の承認が無効化される） |
| `required_linear_history` | true |
| `non_fast_forward` | 禁止（force push 不可） |
| `deletion` | 禁止 |
| `allowed_merge_methods` | merge / squash / rebase |

実務上のポイントです。

- 自分が作成した PR は自分で Approve できないため、通常ルートでは承認が足りず
  GitHub API の `mergeable_state` が `blocked` になります。コンフリクトがある状態（`dirty`）とは
  別の原因なので、混同しないでください。
- `bypass_actors` に RepositoryRole（admin 相当）が `always` で登録されているため、
  リポジトリオーナーはバイパスしてマージできます。
- **Squash and merge を使ってください。** `required_linear_history` が有効です。
  過去の PR #15・#16 も squash でマージされています（コミットメッセージが `... (#15)` の形式）。
- マージ後は main への push で GitHub Actions が走り、1〜2分でサイトが更新されます。

状態の確認コマンド例です。

```bash
gh api repos/hide-G/gennai-unofficial-handson/pulls/<番号> --jq .mergeable
gh api repos/hide-G/gennai-unofficial-handson/pulls/<番号> --jq .mergeable_state
gh api repos/hide-G/gennai-unofficial-handson/rulesets
```

---

## 7. 変更前後の検証チェックリスト

```bash
mkdocs build --strict --site-dir _verify_site
```

- [ ] `--strict` で警告・エラーが出ないこと
- [ ] `_verify_site` に `*_draft*` のディレクトリが生成されていないこと
- [ ] `_verify_site/search/search_index.json` に下書き本文が含まれないこと（**見落としやすい**）
- [ ] `_verify_site/print_page/index.html`（A4印刷ページ）に下書き本文が含まれないこと
- [ ] 公開ページがメンテナンス表示のみで、手順が混入していないこと
- [ ] 確認が終わったら `_verify_site` を削除すること（リポジトリに残さない）

検索インデックスと印刷ページは HTML を目視しただけでは気づけません。次のように文字列で確認できます。

```powershell
$idx = Get-Content "_verify_site\search\search_index.json" -Raw -Encoding UTF8
$idx -match "cloudshell-helper|OpenSearch"   # False であること
```

見出し番号（4.3、5.1 など）は `enumerate-headings` プラグインが nav 順で自動採番します。
Markdown 側に番号を手書きしないでください。`strict: true` かつ `toc_depth: 3` の設定です。

---

## 8. 経緯

| 日付（JST） | 内容 |
| --- | --- |
| 2026-08-08 | 第4章 4.3 を、AWS CloudShell でのデプロイ手順に書き換え（PR #15） |
| 2026-08-08 | 第5章に Query Expansion RAG API のデプロイ手順を追加（PR #16） |
| 2026-08-08 | PR #15・#16 が main にマージされ、両章の全文が公開状態になった |
| 2026-08-08 | 第4章・第5章をメンテナンス表示にし、本文を下書きへ退避（PR #17） |
| 2026-08-08 | PR #17 が #15・#16 とコンフリクト。`origin/main` を取り込んで解決（マージコミット `2119675`） |

第4章・第5章の本文は、資料 `源内ハンズオン資料-01-源内 Web（AI インターフェース）_マスク済.pdf`
のスライド9〜32を基に作成したものです。

---

## 9. 環境メモ（つまずいた点）

- **MkDocs のバージョン依存**: `draft_docs` は MkDocs 1.6 以降の機能です。1.5 では `exclude_docs` が
  同様の役割を持っていましたが、1.6 で挙動が分離されました（`exclude_docs` は serve でも除外）。
  `requirements.txt` は mkdocs-material 9.6.14 / mkdocs-print-site-plugin 2.8 /
  mkdocs-enumerate-headings-plugin 0.7.0 を指定しています。
- **GitHub Actions の実行環境**: Python 3.11、`mkdocs build --strict --site-dir site`。
  ローカルで `--strict` が通れば CI も通ります。
- **single-branch クローンの罠**: ローカルの `remote.origin.fetch` が
  `+refs/heads/main:refs/remotes/origin/main` に限定されている場合、main 以外のブランチが
  remote-tracking されません。`git push -u` をしても upstream の追跡設定が完了せず、
  `git status` に ahead/behind が出ません。push 自体は成功しているので、
  `git ls-remote --heads origin <branch>` でリモートの SHA を突き合わせて確認してください。
- **Windows PowerShell と UTF-8**: PowerShell 経由で git に日本語文字列を渡すと文字化けします。
  また `$HOME` などが変数展開される事故も起きます。コミットメッセージは UTF-8 のファイルに書いて
  `git commit -F <ファイル>` で渡してください。`git log` の出力を PowerShell のパイプで読むと
  文字化けして見えますが、多くの場合リポジトリ内のデータは正常です。実データを確認するには
  `cmd /c "git log -1 --format=%B > out.txt"` のように cmd 経由でリダイレクトします。
- **gh コマンドの日本語**: `gh pr create --title "日本語"` は文字化けします。JSON ファイルを
  UTF-8 で用意して `gh api --method POST repos/<owner>/<repo>/pulls --input <file>` を使うと
  確実です。

---

## 10. ファイル構成と履歴の在り処

### docs 配下と章の対応

`mkdocs.yml` の `nav` に登録された順に表示されます。見出し番号（4.3 など）は
`enumerate-headings` プラグインが自動採番するため、Markdown 側に番号を書かないでください。

| ファイル | 章 | 状態 |
| --- | --- | --- |
| `docs/index.md` | 第1章 ガバメントAI「源内」の概要 | 公開 |
| `docs/architecture.md` | 第2章 システムアーキテクチャの紹介 | 公開 |
| `docs/aws-notes.md` | 第3章 AWSアカウントの注意 | 公開 |
| `docs/web.md` | 第4章 源内 Web | **メンテナンス表示** |
| `docs/web_draft.md` | 第4章の本文 | サイト非公開（`mkdocs serve` のみ） |
| `docs/deploy-ai-api.md` | 第5章 源内 AI アプリのデプロイ | **メンテナンス表示** |
| `docs/deploy-ai-api_draft.md` | 第5章の本文 | サイト非公開（`mkdocs serve` のみ） |
| `docs/cleanup.md` | 第6章 後片付け | 公開 |
| `docs/faq.md` | 第7章 想定質問集（FAQ） | 公開 |
| `docs/glossary.md` | 第8章 用語集・参考リンク | 公開 |

その他のリソースです。

| パス | 役割 |
| --- | --- |
| `docs/images/` | 図と画像 |
| `docs/stylesheets/theme.css` | サイトテーマ色 |
| `docs/stylesheets/print.css` | A4印刷・PDF保存のスタイル |
| `docs/javascripts/sidebar-toggle.js` | サイドバー開閉 |
| `docs/sovereignty-globe/index.html` | リージョン主権の図 |

### ルートのファイル

| ファイル | 役割 |
| --- | --- |
| `mkdocs.yml` | サイト設定。`nav`、プラグイン、`draft_docs`（非公開指定） |
| `README.md` | サイトの説明、ローカルプレビュー、公開手順、章立て |
| `MAINTENANCE.md` | このファイル。メンテナンス運用と引き継ぎ情報 |
| `LOCAL_DEVELOPMENT.md` | Windows での初回構築と起動・停止手順 |
| `requirements.txt` | MkDocs と3つのプラグインのバージョン指定 |
| `.github/workflows/deploy-pages.yml` | `main` への push で Pages へデプロイ |

`build.log` が残っている場合は `mkdocs build` の出力です。不要なので削除してかまいません
（Git の追跡対象外です）。

### 履歴の調べ方

| 知りたいこと | 調べ方 |
| --- | --- |
| 何が起きたかの要約 | 本ファイルの第8節「経緯」 |
| マージ済みの変更 | `git log origin/main --oneline`。squash merge のため `... (#15)` の形式で PR 番号が入る |
| 進行中の作業 | `gh api repos/hide-G/gennai-unofficial-handson/pulls?state=open` |
| 個別の変更の詳細 | GitHub の PR ページ。PR 本文に変更内容と検証結果を書く運用 |

`git branch --merged` は使えません。squash merge でコミット SHA が変わるため、マージ済みの
ブランチも未マージと判定されます。ブランチの生死は GitHub の PR 一覧で判断してください。

### 原稿の元資料

第4章・第5章の本文は、スライド資料
`源内ハンズオン資料-01-源内 Web（AI インターフェース）_マスク済.pdf`（全34ページ）の
スライド9〜32を元に作成しました。PDF そのものと、そこから抽出した画像・テキストは
このリポジトリには含まれず、作成者のローカル環境にあります。原稿を書き直す場合は
元資料の保有者に確認してください。
