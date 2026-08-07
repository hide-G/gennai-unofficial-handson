# 第5章 源内 AI アプリのデプロイ

この章では、源内 AI アプリの AWS 版リファレンス実装である「行政実務用ＲＡＧ（検索拡張生成）の開発テンプレート」（`aws/query-expansion-rag`）を AWS CloudShell からデプロイし、[第4章 源内 Web](web.md) でデプロイした源内 Web に「外部 AI アプリ」として登録して動かすところまでを扱います。

専用のデプロイスクリプトは使わず、CloudShell にコマンドを手入力して進めます。

!!! warning "この章は発展課題です"
    [第4章 源内 Web](web.md) のデプロイが完了していることを前提にしています。源内 Web が動いていない状態でも RAG API 単体のデプロイ（5.3 〜 5.4）までは進められますが、源内 Web への登録（5.5）以降は実施できません。

!!! danger "コスト警告：必ず後片付けまで実施してください"
    この章でデプロイするアプリは、ベクトルデータベースとして **Amazon OpenSearch Serverless** のコレクションを作成します。OpenSearch Serverless は、コレクションを作成した時点でインデックス用と検索用の OCU（OpenSearch Compute Unit）が起動し、**検索も更新もしていなくても課金が続きます**。

    - 冗長化（standby replicas）を無効にした構成でも、最低 2 OCU（インデックス用 1 + 検索用 1）が常時起動します。出典: [Managing capacity limits for Amazon OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html)（確認日: 2026-08-07）
    - 最新の OCU 単価は [Amazon OpenSearch Service の料金](https://aws.amazon.com/opensearch-service/pricing/) で確認してください。常時 2 OCU が 1 か月動き続けると 1,440 OCU 時間になるため、放置すると月額で数百ドル規模になり得ます
    - [第3章](aws-notes.md) に記載した「約600円」は源内 Web 単体の見込みです。この章を実施すると想定額が大きく変わります
    - 検証が終わったら、本章の「後片付け（RAG API 側・必須）」を必ず実施してください

!!! warning "コマンドを実行する前に"
    実行するコマンドの内容を必ず確認してください。コマンドをコピーする際も、対象のリポジトリ・ブランチ・タグ、および書き換え対象のファイルが期待どおりか確認したうえで実行してください。

!!! info "このアプリは「そのままではデプロイが通りません」"
    `aws/query-expansion-rag` は IAM Identity Center（SSO）運用を前提に設計されており、`cdk.json` の既定値も一部が AWS 側の上限や仕様と整合していません。そのため、3 か所の「ハマりどころ」を順に解消する必要があります。この章は、それらを解消して実機でデプロイが通った順序で記載しています。

## この章の目的と前提

### 対象リポジトリ

- 源内 AI アプリ 公式リポジトリ: <https://github.com/digital-go-jp/genai-ai-api>
- この章で扱うディレクトリ: `aws/query-expansion-rag`

### 前提条件

- [第4章](web.md) と同じ AWS アカウント、同じリージョン（東京 / `ap-northeast-1`）で作業する
- AWS CloudShell（東京リージョン）を使う
- `AdministratorAccess` 相当の権限を持つ IAM ユーザーまたはロールで操作する
- 源内 Web 側に**システム管理者**権限のユーザーが用意されている（源内 Web の `scripts/add-system-admin.sh` で昇格させたユーザー）

### Amazon Bedrock のモデルアクセス

東京リージョンの Bedrock で、以下のモデルアクセスを有効化しておきます。有効化していないと、デプロイは通っても実行時に失敗します。

| モデル | 用途 | 使われる場所 |
| --- | --- | --- |
| Titan Text Embeddings V2（`amazon.titan-embed-text-v2:0`） | 埋め込み（ベクトル化） | `cdk.json` の `embeddingModelId` |
| Amazon Nova 2 Lite（`jp.amazon.nova-2-lite-v1:0`） | クエリ拡張、関連性評価、検索と生成、詳細回答生成 | `config/apps/qerag.toml` |
| Claude Haiku 4.5（`jp.anthropic.claude-haiku-4-5-20251001-v1:0`） | 回答生成 | `config/defaults/answer_generation.toml` |
| Claude Sonnet 4.5（`jp.anthropic.claude-sonnet-4-5-20250929-v1:0`） | 詳細回答生成・関連性評価の既定値 | `config/defaults/*.toml` |

!!! info "モデル ID は設定ファイル側で決まります（確認日: 2026-08-07）"
    上の表は `main` ブランチの `config/apps/qerag.toml` と `config/defaults/*.toml` を確認した時点の内容です。設定ファイルは更新されることがあるため、デプロイ前に自分が取得したソースの `modelId` を確認してください。

    `jp.` から始まる ID は日本国内の**クロスリージョン推論プロファイル**です。Bedrock コンソールの「モデルアクセス」画面では、プロファイルではなく基盤モデル（Amazon Nova 2 Lite、Claude Haiku 4.5 など）に対して有効化します。

CLI で確認する場合は、`jp.` を外した基盤モデル ID を指定します。

```bash
aws bedrock get-foundation-model-availability \
  --model-id amazon.titan-embed-text-v2:0 \
  --region ap-northeast-1
```

`entitlementAvailability` が `AVAILABLE`、`agreementAvailability.status` が `AVAILABLE`（または `AUTHORIZED`）であれば利用できます。

## 全体の流れ

```text
[1] CloudShell で query-expansion-rag をデプロイ   … 5.3
        ↓ ApiEndpoint と ApiKey を取得
[2] WAF の IP 制限を解除（API を呼べるようにする）   … 5.4
        ↓
[3] 源内 Web の「チーム管理 → アプリの作成」で登録   … 5.5
        ↓
[4] 源内 Web 上で RAG アプリを実行                   … 5.6
        ↓
[5] 後片付け（必須）                                 … 5.7
```

作られる CloudFormation スタックは次の 4 つです。

| スタック名 | 内容 |
| --- | --- |
| `ApiWafStack` | WAF WebACL（東京 / REGIONAL スコープ） |
| `qerag-SwitchRoleStack` | 開発者用スイッチロール |
| `qerag-qeRagKB` | OpenSearch Serverless コレクション、Knowledge Base、KMS キー |
| `qerag-qeRagApi` | Lambda（Python）と API Gateway（REST API） |

## RAG API をデプロイする

### ソースを取得する

CloudShell のホームディレクトリは 1 GB 制限があるため、源内 Web と同様に `/tmp` で作業します。

!!! warning "`/tmp` はセッション終了で消えます"
    CloudShell を切断・再接続すると `/tmp` の内容は失われます。後片付けを `cdk destroy` で行いたい場合は、デプロイから削除まで同じセッションで完了させてください。消えてしまった場合の削除手順は 5.7 に記載しています。

```bash
# Node.js v22 を準備（第4章で nvm を導入済みならそのまま使えます）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
node -v   # v22 系であることを確認

# v22 系でない場合
# nvm install 22.22.2 && nvm use 22.22.2

# /tmp に取得
cd /tmp
rm -rf genai-ai-api
git clone https://github.com/digital-go-jp/genai-ai-api
cd genai-ai-api/aws/query-expansion-rag
```

### 依存関係をインストールする

CloudShell はメモリが限られているため、Node.js のヒープ上限を明示してから `npm ci` を実行します。

```bash
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci
```

### デプロイ対象アプリを定義する

既定の `cdk.json` は `qeRagAppNames` が空配列のため、そのままデプロイしても RAG API が作られません。サンプルアプリ `qerag` を 1 つ追加します。

```bash
node -e "const fs=require('fs');const p='cdk.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.context.qeRagAppNames=[{appName:'qerag',appParamFile:'qerag.toml'}];fs.writeFileSync(p,JSON.stringify(j,null,2));console.log('qeRagAppNames set: qerag');"
```

!!! info "`idcUserNames` と `switchRoleName` は消さないでください"
    既定の `cdk.json` には `idcUserNames: ["dummy-user"]` と `switchRoleName: "DummyRole"` が入っています。`bin/qe-rag-apis.ts` がデプロイ前にこれらの存在を検証し、空だと `idcUserNames and switchRoleName must be set in cdk.json` で停止します。値はそのまま残し、次のハマりどころ①で別の対処を行います。

### ハマりどころ①：SwitchRole の信頼先を修正する

`SwitchRoleStack` は「`switchRoleName` と同じ名前の SSO 予約ロール」を信頼先（principal）に指定します。IAM Identity Center を使っていない環境ではそのロールが実在しないため、次のエラーでデプロイが失敗します。

```text
Invalid principal in policy:
"AWS":"arn:aws:iam::<account>:role/aws-reserved/sso.amazonaws.com/ap-northeast-1/DummyRole"
```

**対処**: 信頼先を、実在する**アカウントルート**に変更します。

```bash
# 置換対象の開始行を確認（main 現行版では37行目）
grep -n "assumeRolePrincipal = new iam.ArnPrincipal" lib/switch-role-stack.ts

# 37〜43行目（ArnPrincipal(...).withConditions({...}) の5行）を AccountRootPrincipal の1行に置換
sed -i '37,43c\    const assumeRolePrincipal = new iam.AccountRootPrincipal();' lib/switch-role-stack.ts

# 確認: AccountRootPrincipal の1行になり、ArnPrincipal が消えていること
grep -n "AccountRootPrincipal\|ArnPrincipal" lib/switch-role-stack.ts
```

!!! warning "行番号はリポジトリの更新でずれます"
    `sed` の `37,43` は行番号指定です。直前の `grep -n` の結果が 37 行目でなかった場合は、`lib/switch-role-stack.ts` を開いて `const assumeRolePrincipal = new iam.ArnPrincipal(` から対応する `});` までの範囲を確認し、`sed` の行範囲を読み替えてください。置換後は必ず `grep` で `ArnPrincipal` が残っていないことを確認します。

なぜこれで良いのか。`AccountRootPrincipal` は「この AWS アカウント自身」を信頼先にするため、実在しない SSO ロールに依存しなくなり IAM の検証を通過します。このスイッチロールは Knowledge Base へのデータ投入や同期を担当する開発者用のロールで、本章の範囲（RAG をデプロイして源内 Web から呼ぶ）では使わないため、支障ありません。

### ハマりどころ②：API Gateway の統合タイムアウトを上限以下にする

`cdk.json` の既定値は `apiLambdaIntegrationTimeout: 180`（180 秒）ですが、API Gateway（REST API）の統合タイムアウトは既定で最大 29 秒です。既定値が上限を超えているため、次のエラーでデプロイが失敗します。

```text
Timeout should be between 50 ms and 29000 ms
```

**対処**: 値を 29 に変更します。

```bash
node -e "const fs=require('fs');const p='cdk.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.context.apiLambdaIntegrationTimeout=29;fs.writeFileSync(p,JSON.stringify(j,null,2));console.log('apiLambdaIntegrationTimeout=29');"
grep apiLambdaIntegrationTimeout cdk.json
```

!!! info "29 秒で足りない場合"
    RAG はクエリ拡張、Knowledge Base 検索、関連性評価、回答生成を直列で実行するため、質問や設定によっては 29 秒に収まらないことがあります。その場合は API Gateway 側のクォータ引き上げを申請するか、非同期 API 型のアプリ構成を検討してください。本章のハンズオン（空の Knowledge Base に対する短い質問）では 29 秒で足ります。

### CDK Bootstrap を実行する

```bash
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
```

第4章で実施済みなら `Environment ... bootstrapped (no changes)` と表示されます。

### デプロイする

```bash
npx cdk deploy --all --require-approval never
```

スタックは依存関係の順に作られます。`qerag-qeRagKB`（OpenSearch Serverless コレクションの作成）が最も時間がかかり、5〜10 分ほどです。全体では 15〜25 分を見込んでください。

!!! warning "ハマりどころ①②を飛ばして失敗した場合"
    `ROLLBACK_COMPLETE` で残った失敗スタックは、そのままでは再デプロイできません。削除してから再実行します。

    ```bash
    aws cloudformation delete-stack --stack-name qerag-SwitchRoleStack --region ap-northeast-1
    aws cloudformation wait stack-delete-complete --stack-name qerag-SwitchRoleStack --region ap-northeast-1

    # 必要に応じて qerag-qeRagApi も同様に削除
    npx cdk deploy --all --require-approval never
    ```

### ApiEndpoint と ApiKey を取得する

デプロイが完了すると、`qerag-qeRagApi` の Outputs に `ApiEndpoint` と `ApiKeyId` が出力されます。API キーの実際の値は Outputs には出ないため、`ApiKeyId` を使って別途取得します。

```bash
# 出力一覧を確認
aws cloudformation describe-stacks --stack-name qerag-qeRagApi \
  --query "Stacks[0].Outputs" --output table

# シェル変数に格納（以降の動作確認で使います）
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name qerag-qeRagApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
API_KEY_ID=$(aws cloudformation describe-stacks --stack-name qerag-qeRagApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeyId'].OutputValue" --output text)
API_KEY=$(aws apigateway get-api-key --api-key "$API_KEY_ID" --include-value --query value --output text)

echo "ApiEndpoint: $API_ENDPOINT"
echo "ApiKey:      $API_KEY"
```

`ApiEndpoint` は `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/invoke` の形式で、末尾が `/invoke` になります。この 2 つは 5.5 の源内 Web への登録で使うので、**必ず控えておいてください**。

!!! danger "API キーの取り扱い"
    API キーは、これを知っていれば誰でも RAG API を呼び出せる資格情報です。スクリーンショット、チャット、公開リポジトリ、勉強会の画面共有に残さないよう注意してください。控える場合も、後片付けで削除するまでの一時的なメモにとどめてください。

## WAF の IP 制限を解除する

`ApiEndpoint` を取得したら API を直接呼びたくなりますが、既定の WAF 設定のままだと弾かれます。これがハマりどころ③です。

```bash
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"inputs":{"question":"テスト","n_queries":3}}'
```

この時点では、レスポンスは `{"message":"Forbidden"}` になります。

### なぜ Forbidden になるのか

`lib/constructs/common-web-acl.ts` の WebACL は次の動作をします。

- `defaultAction` が常に `block`（既定で全ブロック）
- 許可ルールは `allowedIpV4AddressRanges` などに値があるときだけ追加される
- したがって `null` や `[]` にすると「全ブロック＋許可ルールなし」で**完全に全拒否**になる

既定の `cdk.json` は `allowedIpV4AddressRanges`、`allowedIpV6AddressRanges`、`allowedCountryCodes` がすべて `null` なので、誰も呼び出せない状態でデプロイされます。

!!! info "源内 Web とは設計が逆です"
    源内 Web 側は「IP 制限を `null` にすると WAF スタック自体が作られない（=制限なし）」という挙動です。同じ `null` が逆の意味になるため、混同しないよう注意してください。

### 全 IP を許可するルールを追加する

```bash
# 全IPv4を /1 + /1 でカバーする
node -e "const fs=require('fs');const p='cdk.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.context.allowedIpV4AddressRanges=['0.0.0.0/1','128.0.0.0/1'];j.context.allowedIpV6AddressRanges=null;j.context.allowedCountryCodes=null;fs.writeFileSync(p,JSON.stringify(j,null,2));console.log('allow all v4');"

# WAF スタックだけ再デプロイ（数十秒）
npx cdk deploy ApiWafStack --require-approval never
```

!!! info "AWS WAF は `0.0.0.0/0` を受け付けません"
    IPSet に `0.0.0.0/0` を登録しようとすると `The parameter contains formatting that is not valid. parameter: 0.0.0.0/0` になります。全 IPv4 を表現したい場合は `0.0.0.0/1` と `128.0.0.0/1` の 2 つを並べます。

!!! danger "全 IP 許可はハンズオン限定の設定です"
    ハンズオンでは手軽さを優先して全 IP 許可にしています。API キー認証は引き続き有効なので、キーを知らない相手は呼び出せませんが、本番運用では「源内 Web 側の外部アプリ起動用 EIP」だけを `allowedIpV4AddressRanges: ["x.x.x.x/32","y.y.y.y/32"]` の形で許可するのが正しい運用です。源内 Web 側の EIP は、源内 Web リポジトリの [AIアプリ登録手順書](https://github.com/digital-go-jp/genai-web/blob/main/docs/AI%E3%82%A2%E3%83%97%E3%83%AA%E7%99%BB%E9%8C%B2%E6%89%8B%E9%A0%86%E6%9B%B8.md) の手順1で取得できます。

### API 単体で動作確認する

WAF ルールの反映に数十秒かかることがあります。少し待ってから、もう一度実行します。

```bash
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"inputs":{"question":"テスト","n_queries":3}}'
```

`outputs` と `usageMetadata` を含む JSON が返れば成功です。Knowledge Base にドキュメントを入れていないため、回答内容は「情報が見つからない」旨になりますが、**API としては正常**です。`usageMetadata` にクエリ拡張と回答生成のモデル呼び出しが記録されていれば、RAG の全工程（クエリ拡張 → Knowledge Base 検索 → 関連性評価 → 回答生成）が動いています。

!!! info "リクエストとレスポンスの形"
    Lambda は `inputs.question`（必須）と `inputs.n_queries`（任意、既定 3）を読み取り、`{"outputs": "...", "usageMetadata": [...]}` を返します。これは源内 Web の同期 API のレスポンス仕様と一致しています。

## 源内 Web に外部 AI アプリとして登録する

### システム管理者でログインする

源内 Web に**システム管理者**でログインします。ヘッダーの「アカウント」メニューに「チーム管理」が表示されていれば、必要な権限があります。表示されない場合は、源内 Web リポジトリの `scripts/add-system-admin.sh` でユーザーを昇格させてください。

### RAG アプリ用のチームを作る

1. ヘッダー右上の **[アカウント]** → **[チーム管理]** を開く
2. **[チームを作成]** をクリック
3. 次の内容を入力する
    - **チーム名**: `RAGハンズオン`（任意）
    - **チーム管理者のメールアドレス**: 自分のメールアドレス
4. **[作成]** をクリック

!!! info "共通チームに登録する選択肢"
    全ユーザーに公開したい場合は、源内に用意されている共通チーム（`TEAM_ID: 00000000-0000-0000-0000-000000000000`）へ登録する方法もあります。ハンズオンでは影響範囲を絞るため、専用チームを作る手順にしています。

### AI アプリを作成する

1. 作成したチーム「RAGハンズオン」のページを開く
2. **[アプリの作成]** をクリック
3. 次の表とリクエスト形式 JSON の内容を入力し、**[作成]**（または **[保存]**）をクリックする

| 項目 | 値 |
| --- | --- |
| アプリ名 | `Query Expansion RAG` |
| 説明 | `クエリ拡張RAGのデモ。質問に対してKnowledge Baseを検索して回答します。` |
| エンドポイント URL | 5.3 で控えた `ApiEndpoint`（末尾が `/invoke`） |
| API キー | 5.3 で控えた `ApiKey` |
| 同期／非同期 | **同期**（このアプリは `outputs` を直接返します） |
| リクエスト形式（JSON） | 次のコードブロックの内容 |

リクエスト形式（JSON）には、次の内容をそのまま貼り付けます。

```json
{
  "question": {
    "title": "質問",
    "desc": "社内規程やマニュアルについて質問してください。",
    "type": "text",
    "required": true
  },
  "n_queries": {
    "title": "クエリ拡張数",
    "type": "number",
    "min": 1,
    "max": 5,
    "default_value": 3
  }
}
```

!!! info "リクエスト形式 JSON の役割"
    源内 Web は、この JSON をもとに画面上へ「質問」テキスト欄と「クエリ拡張数」数値欄を描画します。実行時には `{"inputs":{"question":"...","n_queries":3}}` の形に変換して AI アプリへ送出し、AI アプリは `{"outputs":"..."}` を返します。項目の型やパラメータの一覧は、源内 Web リポジトリの [AIアプリAPI仕様](https://github.com/digital-go-jp/genai-web/blob/main/docs/AI%E3%82%A2%E3%83%97%E3%83%AAAPI%E4%BB%95%E6%A7%98.md) を参照してください。

!!! tip "詳細な回答も切り替えたい場合"
    この RAG Lambda は `inputs.output_in_detail`（真偽値、既定 `false`）も受け取り、`true` のときは詳細回答生成用のモデルで回答します。リクエスト形式 JSON にラジオボタンやチェックボックスの項目として `output_in_detail` を追加すると、画面から切り替えられます。

!!! warning "UI の項目名は源内 Web のバージョンで変わることがあります"
    上の表の項目名は、画面に表示されている項目名に読み替えてください。エンドポイント URL と API キー、リクエスト形式 JSON の 3 つが正しく入っていれば連携できます。

## 源内 Web で動作確認する

1. 登録したアプリ「Query Expansion RAG」を開く
2. **[質問]** 欄に何か入力する（例: `こんにちは`）
3. **[実行]** をクリック
4. 数秒待つと、AI の応答が画面に表示される

Knowledge Base が空なので「情報が見つからない」旨の回答になりますが、源内 Web の画面に応答が表示されれば**連携成功**です。`config/apps/qerag.toml` の `responseFooter` に定義された定型文（「※この回答文章は生成AIによって作成されており…」）も末尾に付きます。

!!! warning "応答が返らない場合の切り分け"
    まず 5.4 の `curl` が成功するか確認してください。

    - `curl` も失敗する → RAG API 側の問題（WAF、API キー、Bedrock のモデルアクセス）
    - `curl` は成功するが源内 Web からは失敗する → 登録内容の問題（エンドポイント URL の末尾 `/invoke`、API キー、リクエスト形式 JSON）

    より詳しく調べる場合は、CloudWatch Logs の RAG Lambda のロググループを確認します。

## 後片付け（RAG API 側・必須）

OpenSearch Serverless は起動しているだけで課金が続きます。検証が終わったら必ず削除してください。

!!! info "源内 Web 側の後片付け"
    この節は RAG API 側（`qerag-*` と `ApiWafStack`）の削除だけを扱います。源内 Web 側のリソースを含めた全体の後片付けは [第6章 後片付け](cleanup.md) を参照してください。

### 作業ディレクトリが残っている場合

同じ CloudShell セッション内で `/tmp/genai-ai-api` が残っていれば、`cdk destroy` で全スタックをまとめて削除できます。

```bash
cd /tmp/genai-ai-api/aws/query-expansion-rag
npx cdk destroy --all --force
```

### 作業ディレクトリが消えている場合

CloudShell を再接続して `/tmp/genai-ai-api` が消えていると `cdk destroy` は使えません。その場合は AWS CLI で CloudFormation スタックを直接削除します。依存関係（API → Knowledge Base → SwitchRole → WAF）の逆順で削除すれば確実です。

```bash
# 1. qerag-qeRagApi（Lambda + API Gateway）
aws cloudformation delete-stack --stack-name qerag-qeRagApi --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name qerag-qeRagApi --region ap-northeast-1
echo "qerag-qeRagApi: deleted"

# 2. qerag-qeRagKB（OpenSearch Serverless + Knowledge Base + KMS）★最重要（コスト発生源）
aws cloudformation delete-stack --stack-name qerag-qeRagKB --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name qerag-qeRagKB --region ap-northeast-1
echo "qerag-qeRagKB: deleted"

# 3. qerag-SwitchRoleStack
aws cloudformation delete-stack --stack-name qerag-SwitchRoleStack --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name qerag-SwitchRoleStack --region ap-northeast-1
echo "qerag-SwitchRoleStack: deleted"

# 4. ApiWafStack
aws cloudformation delete-stack --stack-name ApiWafStack --region ap-northeast-1
aws cloudformation wait stack-delete-complete --stack-name ApiWafStack --region ap-northeast-1
echo "ApiWafStack: deleted"

echo "=== 全削除完了 ==="
```

`wait stack-delete-complete` は完了まで何も出力せずに待ちます。`qerag-qeRagKB`（OpenSearch Serverless）の削除に 5 分前後、全体で 10 分前後を見込んでください。

### 削除の完了確認

```bash
aws cloudformation describe-stacks --region ap-northeast-1 \
  --query "Stacks[?contains(StackName, 'qerag') || StackName=='ApiWafStack'].{Name:StackName,Status:StackStatus}" \
  --output table

aws opensearchserverless list-collections --region ap-northeast-1 \
  --query "collectionSummaries[].name" --output table
```

両方ともリソースが表示されなければ、削除は完了です。

!!! info "残る可能性があるリソース"
    KMS キーや S3 バケットなど、CDK 側で `RemovalPolicy.RETAIN` が指定されているリソースは残る場合があります。残っていても起動コストはほぼ発生しませんが、気になる場合はマネジメントコンソールから手動で削除してください。

### 完了チェックリスト

- [ ] `qerag-qeRagApi`、`qerag-qeRagKB`、`qerag-SwitchRoleStack`、`ApiWafStack` を削除した
- [ ] OpenSearch Serverless コレクションが残っていないことを確認した
- [ ] 源内 Web 側に登録した AI アプリ（およびチーム）を削除した
- [ ] 手元のメモ・スクリーンショット・チャット履歴から `ApiEndpoint` と API キーを消した

## ハマりどころ一覧

この章で解消した 3 点は、リポジトリ側の既定値が AWS の仕様と整合していないことに起因します。公式手順書には記載がないため、実機で解消した内容をまとめておきます。

| # | 症状 | 原因 | 対処 |
| --- | --- | --- | --- |
| ① | `Invalid principal in policy` に `DummyRole` が出てデプロイ失敗 | IAM Identity Center（SSO）運用前提の設計で、SSO ロールが実在しない | `lib/switch-role-stack.ts` を `AccountRootPrincipal` に 1 行修正 |
| ② | `Timeout should be between 50 ms and 29000 ms` でデプロイ失敗 | `cdk.json` 既定の `apiLambdaIntegrationTimeout: 180` が API Gateway の上限 29 秒を超過 | 値を 29 に変更 |
| ③ | `curl` のレスポンスが `Forbidden` | WAF の `defaultAction` が常に `block` で、許可ルールが空（`null` / `[]`）だと全拒否 | `["0.0.0.0/1","128.0.0.0/1"]` で全 IPv4 を許可（`0.0.0.0/0` は WAF が受け付けない） |

## RAG が使うモデルを変更する

`config/apps/qerag.toml` または `config/defaults/*.toml` の `modelId` を編集します。設定ファイルは工程ごとに分かれています。

| ファイル | 対応する工程 |
| --- | --- |
| `config/defaults/query_expansion.toml` | クエリ拡張 |
| `config/defaults/relevance_rating.toml` | 関連性評価 |
| `config/defaults/retrieve_and_generate.toml` | 検索と生成 |
| `config/defaults/answer_generation.toml` | 回答生成 |
| `config/defaults/answer_generation_detail.toml` | 詳細回答生成 |
| `config/apps/qerag.toml` | アプリ単位の上書き（`modelId`、`systemPrompt`、`responseFooter` など） |

変更後は再デプロイすれば反映されます。設定ファイルのハッシュをもとに Lambda が再ビルドされます。

```bash
npx cdk deploy --all --require-approval never
```

!!! warning "変更したモデルのアクセス有効化を忘れずに"
    `modelId` を変更した場合は、そのモデルを東京リージョンの Bedrock で有効化してください。有効化していないと、デプロイは成功しても実行時に `AccessDeniedException` になります。

## 参考リンク

- 源内 AI アプリ 公式リポジトリ: <https://github.com/digital-go-jp/genai-ai-api>
- この章で扱ったテンプレート: <https://github.com/digital-go-jp/genai-ai-api/tree/main/aws/query-expansion-rag>
- 源内 Web ｜ AIアプリAPI仕様: <https://github.com/digital-go-jp/genai-web/blob/main/docs/AI%E3%82%A2%E3%83%97%E3%83%AAAPI%E4%BB%95%E6%A7%98.md>
- 源内 Web ｜ AIアプリ登録手順書: <https://github.com/digital-go-jp/genai-web/blob/main/docs/AI%E3%82%A2%E3%83%97%E3%83%AA%E7%99%BB%E9%8C%B2%E6%89%8B%E9%A0%86%E6%9B%B8.md>
- 源内 Web ｜ システム管理者設定手順: <https://github.com/digital-go-jp/genai-web/blob/main/docs/%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0%E7%AE%A1%E7%90%86%E8%80%85%E8%A8%AD%E5%AE%9A%E6%89%8B%E9%A0%86.md>
- Amazon OpenSearch Serverless のキャパシティー管理: <https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html>
- Amazon OpenSearch Service の料金: <https://aws.amazon.com/opensearch-service/pricing/>

## この章の出典

この章は、次の手順書をもとに構成しています。

- Query Expansion RAG API を CloudShell でデプロイし、源内 Web と連携する: <https://github.com/hide-G/genai-web-cloudshell-helper/blob/main/HANDSON-query-expansion-rag.md>

記載したコマンドと設定値は、`digital-go-jp/genai-ai-api` の `main` ブランチ（確認日: 2026-08-07）の `cdk.json`、`bin/qe-rag-apis.ts`、`lib/switch-role-stack.ts`、`lib/constructs/common-web-acl.ts`、`lib/rag-lambda-api-stack.ts`、`config/` 配下と照合しています。リポジトリが更新されると行番号や既定値が変わる可能性があるため、実行前に必ず自分が取得したソースを確認してください。
