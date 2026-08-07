# 第4章 源内 Web（AI インターフェース）

!!! info "この章の状態"
    デプロイ手順を追加しました。源内 Web の構成要素や、源内 AI アプリとの接続設定は今後追加します。

## 対象リポジトリ

- <https://github.com/digital-go-jp/genai-web>

## この章の目的

「源内 Web」は、利用者と AI 機能の間に立つフロントエンドの Web アプリケーション（AI インターフェース）です。この章では、源内 Web の役割と、手元にデプロイして次章の「源内 AI アプリ」と接続する準備までを扱います。

## 源内 Web をデプロイする（AWS CloudShell 版）

公式リポジトリの手順では、作業する端末に Node.js、AWS CLI、AWS CDK、jq などを準備する必要があります。ハンズオンの限られた時間では、この環境構築だけで進み方に差が出てしまいます。

そこでこの節では、ブラウザーの **AWS CloudShell** だけで完結する補助スクリプト `genai-web-cloudshell-helper.sh` を使って進めます。端末側へのインストールは不要です。

!!! warning "非公式のコミュニティ作成ツールです"
    `genai-web-cloudshell-helper` はデジタル庁公式のツールではありません。有志が作成した補助スクリプトであり、利用は自己責任でお願いします。実行前に中身を確認してください。

    - リポジトリ: <https://github.com/hide-G/genai-web-cloudshell-helper>

公式の手順で進めたい場合は、次のドキュメントを参照してください。

- 事前準備: <https://github.com/digital-go-jp/genai-web/blob/main/docs/事前準備.md>
- デプロイ手順: <https://github.com/digital-go-jp/genai-web/blob/main/docs/デプロイ手順.md>

### 全体の流れ

| 作業 | 内容 | 目安時間 |
| --- | --- | --- |
| AWS CloudShell を開く | ブラウザーだけで使えるシェル環境を起動する | 1分 |
| 権限を自己診断する | デプロイに必要な権限がそろっているか事前に確認する | 1分 |
| ヘルパースクリプトを取得する | `curl` で1ファイルだけ取得する | 1分 |
| ソースを取得して準備する | `setup` で clone と `npm ci` まで自動実行する | 3〜5分 |
| デプロイする | `deploy` でAWS上に源内 Web を構築する | 10〜20分 |
| アカウントを作成してサインインする | セルフサインアップでログインする | 3分 |
| ヘッダーとフッターをカスタマイズする（任意） | 表示名とコピーライトを書き換える | 3分 |
| 再デプロイして反映する | 2回目以降は変更分のみなので短時間で終わる | 3〜5分 |
| システム管理者を追加する | 「チーム管理」を使えるようにする | 1分 |

!!! tip "所要時間の実測値"
    初回のデプロイは約9.8分（585秒）、変更後の再デプロイは約3.3分（198秒）でした。時間の大半は Amazon CloudFront ディストリビューションの作成に費われます。回線や混雑状況で前後します。

### AWS CloudShell を開く

1. AWSマネジメントコンソールにサインインします
2. リージョンを **アジアパシフィック（東京） ap-northeast-1** に切り替えます
3. 画面上部のナビゲーションバー、または画面下部のアイコンから **CloudShell** を開きます
4. プロンプト `~ $` が表示されたら準備完了です

!!! warning "永続化されるのはホームディレクトリだけです"
    CloudShell で保存が保証されるのは `$HOME` 配下（1GBまで）です。それ以外のディレクトリはセッションが終わると破棄されます。また、キーボード入力がない状態が続くと環境は自動的に停止します。

    後述の `setup` は源内 Web のソースを `/tmp/genai-web` に配置するため、長時間放置してセッションが切れた場合は `setup` からやり直してください。ヘルパースクリプト自体はホームディレクトリに置かれるので残ります。

    出典: [AWS CloudShell のサービスクォータと制限](https://docs.aws.amazon.com/cloudshell/latest/userguide/limits.html) の内容を要約しました（ライセンス上の制約に配慮して表現を変更しています）。

### 権限を自己診断する

源内 Web のデプロイでは、CloudFormation、IAM、Lambda、CloudFront、Cognito、DynamoDB、S3、API Gateway、KMS、Amazon Bedrock を操作します。作業を始める前に、必要な権限がそろっているか確認します。

CloudShell で次のコマンドを実行してください。

```bash
ARN=$(aws sts get-caller-identity --query Arn --output text)
echo "Caller: $ARN"
aws iam simulate-principal-policy \
  --policy-source-arn "$ARN" \
  --action-names \
    cloudformation:CreateStack \
    iam:CreateRole \
    iam:PassRole \
    lambda:CreateFunction \
    cloudfront:CreateDistribution \
    cognito-idp:CreateUserPool \
    dynamodb:CreateTable \
    s3:CreateBucket \
    apigateway:POST \
    kms:CreateKey \
    bedrock:InvokeModel \
    bedrock:ListFoundationModels \
  --query "EvaluationResults[].{Action:EvalActionName,Decision:EvalDecision}" \
  --output table
```

すべての行が `allowed` になっていれば準備完了です。

```text
+----------------------------------+-----------+
|  cloudformation:CreateStack      |  allowed  |
|  iam:CreateRole                  |  allowed  |
|  iam:PassRole                    |  allowed  |
|  lambda:CreateFunction           |  allowed  |
|  cloudfront:CreateDistribution   |  allowed  |
|  cognito-idp:CreateUserPool      |  allowed  |
|  dynamodb:CreateTable            |  allowed  |
|  s3:CreateBucket                 |  allowed  |
|  apigateway:POST                 |  allowed  |
|  kms:CreateKey                   |  allowed  |
|  bedrock:InvokeModel             |  allowed  |
|  bedrock:ListFoundationModels    |  allowed  |
+----------------------------------+-----------+
```

!!! warning "implicitDeny や explicitDeny が出た場合"
    そのままデプロイを進めても途中で失敗します。[第3章 AWSアカウントの注意](aws-notes.md) の権限の項目を確認し、必要な権限を持つIAMユーザーに切り替えてから再実行してください。

### ヘルパースクリプトを取得する

CloudShell には `curl` がプリインストールされています。1行で取得できます。

```bash
curl -fsSL https://raw.githubusercontent.com/hide-G/genai-web-cloudshell-helper/main/genai-web-cloudshell-helper.sh -o genai-web-cloudshell-helper.sh
```

取得できたか確認します。

```bash
ll
```

```text
total 20
-rw-r--r--. 1 cloudshell-user cloudshell-user 18296 May 30 00:36 genai-web-cloudshell-helper.sh
```

!!! tip "実行する前に中身を読む"
    ダウンロードしたシェルスクリプトをそのまま実行するのは、内容を確認してからにしてください。`less genai-web-cloudshell-helper.sh` で読めます（`q` で終了）。

### ソースを取得して準備する（setup）

実行権限を付けて `setup` を実行します。

```bash
chmod +x genai-web-cloudshell-helper.sh
./genai-web-cloudshell-helper.sh setup
```

`setup` は次の処理をまとめて実行します。

1. Node.js のバージョン確認（v22系）
2. 源内 Web のリポジトリを `/tmp/genai-web` に clone（branch: main）
3. `npm ci` で依存パッケージをインストール（数分かかります）

進行中は次のようなログが流れます。

```text
  [setup] ソース取得・準備
  ----------------------------------------------------------------
[INFO]  Node.js バージョン OK: v22.22.2
[INFO]  源内 Web をクローンしています (branch: main) -> /tmp/genai-web
Cloning into '/tmp/genai-web'...
Receiving objects: 100% (1483/1483), 1.67 MiB | 3.13 MiB/s, done.
Resolving deltas: 100% (545/545), done.
[INFO]  依存パッケージをインストールしています (npm ci)... 数分かかります
```

次のメッセージが出れば完了です。カスタマイズ対象のファイルパスと、次に実行するコマンドが案内されます。

```text
*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
 セットアップ完了 ✅    ソース: /tmp/genai-web

 次の操作:
  1. （任意）カスタマイズ:
      /tmp/genai-web/packages/web/src/components/ui/Logo.tsx     （ヘッダー/ロゴ）
      /tmp/genai-web/packages/web/src/components/ui/Footer.tsx   （フッター/コピーライト）
  2. デプロイ:
      ./genai-web-cloudshell-helper.sh deploy -e -handson
*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
```

!!! info "ソースの配置先"
    ヘルパースクリプトの説明文には `~/genai-web` と記載されている箇所がありますが、実行ログで確認できる実際の配置先は `/tmp/genai-web` です。以降の手順でも `/tmp/genai-web` を前提にしています。

### デプロイする（deploy）

```bash
./genai-web-cloudshell-helper.sh deploy -e -handson
```

`-e -handson` は環境名の指定です。この名前がCloudFormationスタック名の末尾に付き、`GenerativeAiUseCasesStack-handson` というスタックが作られます。

実行するとハンズオン向けの構成が自動で適用され、次の1行が表示されます。

```text
cdk.json updated: env=-handson, appEnv=handson, selfSignUp=true, allowedIpV4=null, monitoring=false
```

| 設定 | 値 | 意味 |
| --- | --- | --- |
| `selfSignUp` | `true` | 参加者が自分でアカウントを作成できる |
| `allowedIpV4` | `null` | 接続元IPアドレスによる制限をかけない |
| `monitoring` | `false` | 監視ダッシュボードを作成しない（コストを抑える） |

!!! warning "この構成はハンズオン専用です"
    セルフサインアップ有効かつIP制限なしは、参加者が各自でログインできるようにするための設定です。URLを知っていれば誰でもアカウントを作成できる状態になります。実運用ではIP制限や認証方式の見直しが必要です。ハンズオン後は [第6章 後片付け](cleanup.md) まで進めて削除してください。

デプロイが始まると、CloudFormationのリソース作成状況が流れます。`AWS::CloudFront::Distribution` の作成に時間がかかるため、しばらく進捗が止まったように見えることがあります。

```text
[■■■■■■■■■■■■■■■■■■■■■■■■] (439/101)

12:52:46 AM | CREATE_IN_PROGRESS   | AWS::CloudFormation::Stack        | GenerativeAiUseCasesStack-handson
12:53:52 AM | CREATE_IN_PROGRESS   | AWS::CloudFront::Distribution     | Api/Web/CloudFrontDistribution
12:56:05 AM | CREATE_IN_PROGRESS   | AWS::IAM::Role                    | TeamAccessControlS...eExApp/ServiceRole
```

完了すると、CloudFormationのOutputsとURLが表示されます。

```text
GenerativeAiUseCasesStack-handson.UserPoolClientId = <各自の値>
GenerativeAiUseCasesStack-handson.UserPoolId = ap-northeast-1_<各自の値>
GenerativeAiUseCasesStack-handson.WebUrl = https://<各自の値>.cloudfront.net

 ✨  Total time: 585.72s

*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
 デプロイ完了 🎉
 源内 Web URL: https://<各自の値>.cloudfront.net
*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
```

!!! tip "URLは参加者ごとに異なります"
    表示された `源内 Web URL` をコピーして、ブラウザーの新しいタブに貼り付けてください。資料に載っているURLではなく、自分の環境で表示された値を使います。

### アカウントを作成してサインインする

URLを開くと、源内 Web のサインイン画面が表示されます。この時点ではヘッダーが「ここにロゴが入る」のままです。ここまで表示されればデプロイは成功しています。

1. **アカウントを作る** タブを選びます
2. メールアドレス、パスワード、パスワードの確認を入力します
3. **アカウントを作る** を押します
4. 「コードを送信しました」の画面に変わり、入力したメールアドレスに確認コードが届きます
5. 確認コードを入力して **確認** を押します

確認コードのメールは送信元が `no-reply@verificationemail.com`、本文は英文で届きます。

!!! tip "メールが届かないとき"
    迷惑メールフォルダーを確認してください。到着まで1分ほどかかることがあります。それでも届かない場合は **コードを再送信** を押します。

サインインするとトップページに「おすすめアプリ」として **チャット**、**文章を生成**、**翻訳** が並びます。ここまでで源内 Web が動く状態になりました。

### ヘッダーとフッターをカスタマイズしてみる（任意）

表示される文言を書き換えて、自分の環境であることを確認してみます。対象は2ファイルです。

| ファイル | 置き換える文字列 |
| --- | --- |
| `packages/web/src/components/ui/Logo.tsx` | `ここにロゴが入る`（2か所） |
| `packages/web/src/components/ui/Footer.tsx` | `ここにロゴが入る`、`ここにコピーライトが入る` |

ヘッダー（`Logo.tsx`）はエディターで開いて書き換えます。

```bash
vi /tmp/genai-web/packages/web/src/components/ui/Logo.tsx
```

`ここにロゴが入る` は、ランディングページ用の `<h1>` と、それ以外のページ用の `<Link>` に1か所ずつ、合わせて2か所あります。**両方とも** 書き換えてください。

```tsx
{isLandingPage ? (
  <h1 className={`${logoTypographyStyles}`}>ここにロゴが入る</h1>
) : (
  <Link to='/' className={`${logoTypographyStyles} ...`}>
    ここにロゴが入る
  </Link>
```

!!! tip "vi の操作に不安がある場合"
    `sed` で一括置換すれば、エディターを使わずに書き換えられます。`/g` を付けているので2か所とも置き換わります。

    ```bash
    sed -i 's/ここにロゴが入る/源内ハンズオン/g' /tmp/genai-web/packages/web/src/components/ui/Logo.tsx
    ```

フッター（`Footer.tsx`）は `sed` で置き換えます。

```bash
sed -i 's/ここにロゴが入る/源内ハンズオン/g' /tmp/genai-web/packages/web/src/components/ui/Footer.tsx
sed -i 's/ここにコピーライトが入る/© JAWS-UG AIML支部/g' /tmp/genai-web/packages/web/src/components/ui/Footer.tsx
```

### 変更を反映するために再デプロイする

ファイルを編集しただけでは画面は変わりません。デプロイし直して反映します。コマンドは初回と同じです。

```bash
./genai-web-cloudshell-helper.sh deploy -e -handson
```

2回目以降は変更のあったリソースだけが更新されるため、初回より短時間で終わります。

```text
 ✨  Total time: 198.33s

*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
 デプロイ完了 🎉
 源内 Web URL: https://<各自の値>.cloudfront.net
*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
```

URLを再度開くと、ヘッダーとフッターが書き換えた文字列に変わっています。

!!! tip "表示が変わらないときは"
    CloudFrontやブラウザーのキャッシュが残っている可能性があります。スーパーリロード（Windowsは Ctrl + F5、macOSは Command + Shift + R）を試すか、シークレットウィンドウで開いてください。

### システム管理者を追加する

このあと源内 AI アプリを追加するには、システム管理者の権限が必要です。付属のスクリプトで、自分のアカウントを `SystemAdminGroup` に追加します。

```bash
cd /tmp/genai-web
./scripts/add-system-admin.sh -handson <サインインに使ったメールアドレス>
```

```text
env: -handson
ユーザー名: <メールアドレス>
スタック名: GenerativeAiUseCasesStack-handson
UserPoolIdを取得中...
UserPoolId: ap-northeast-1_<各自の値>
ユーザーの存在を確認中...
ユーザーを SystemAdminGroup に追加中...
完了: ユーザー '<メールアドレス>' を SystemAdminGroup に追加しました。
```

ブラウザーに戻ってページを再読み込みすると、**アカウント** メニューに **チーム管理** が増えています。開くと「チームが登録されていません」と表示される空の状態です。

参照:

- スクリプト: <https://github.com/digital-go-jp/genai-web/blob/main/scripts/add-system-admin.sh>
- 関連ドキュメント: <https://github.com/digital-go-jp/genai-web/blob/main/docs/システム管理者設定手順.md>

!!! tip "「チーム管理」が出てこないとき"
    グループの所属はサインイン時のトークンに反映されます。再読み込みで変わらない場合は、いったんサインアウトしてからサインインし直してください。

### ここまでの完了チェックリスト

- [ ] `ap-northeast-1` でAWS CloudShellを開いた
- [ ] 権限の自己診断がすべて `allowed` だった
- [ ] `setup` が完了し、`/tmp/genai-web` にソースが配置された
- [ ] `deploy` が完了し、`源内 Web URL` を取得した
- [ ] アカウントを作成し、確認コードを入力してサインインできた
- [ ] （任意）ヘッダーとフッターを書き換え、再デプロイで反映を確認した
- [ ] `add-system-admin.sh` を実行し、**チーム管理** が表示された

### つまずきやすいポイント

| 症状 | 考えられる原因 | 対処 |
| --- | --- | --- |
| 権限の自己診断で `allowed` 以外が出る | IAMユーザーの権限不足 | [第3章](aws-notes.md) の権限を満たすユーザーに切り替える |
| しばらく放置したあとコマンドが失敗する | CloudShellのセッションが切れ、`/tmp` が破棄された | `setup` からやり直す |
| `npm ci` が容量不足で失敗する | ホームディレクトリの1GB上限に近づいている | 不要なファイルを削除する。CloudShellの **アクション** からホームディレクトリを削除して作り直す方法もある（保存物は消えます） |
| デプロイが途中で失敗する | 権限不足、または同名スタックが `ROLLBACK` 状態で残っている | CloudFormationコンソールでスタックの状態とエラー内容を確認する |
| 確認コードのメールが届かない | 迷惑メールに振り分けられている | 迷惑メールフォルダーを確認し、**コードを再送信** を押す |
| 再デプロイしても表示が変わらない | CloudFrontまたはブラウザーのキャッシュ | スーパーリロード、またはシークレットウィンドウで開く |
| **チーム管理** が表示されない | 指定したメールアドレスがサインインに使ったものと違う、またはトークンが古い | アドレスを確認して再実行し、サインアウトとサインインをやり直す |

### 次の章へ

ここまでで、源内 Web（AI インターフェース）がAWS上で動き、システム管理者としてチーム管理を操作できる状態になりました。[第5章 源内 AI アプリのデプロイ](deploy-ai-api.md) で、この源内 Web に接続するAIアプリを追加します。

## 参考リンク

- 源内 Web 公式リポジトリ: <https://github.com/digital-go-jp/genai-web>
