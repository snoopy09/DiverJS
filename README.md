
## DiverJS

explanation for DiverJS

### Requirements

Requires `node` version v8.9.4 (other versions may work but are not tested), `npm`, `python2`, `python3`.

### Installation

Execute `npm install` inside the DiverJS directory for a clean installation.

### Usage

以下を実行
LEARNING=? (EXPOSE_LOG_LEVEL=3) LEARNING_ACTION_FILE=EnvFiles/ActionSwitch/*.js LEARNING_ENV_FILE=EnvFiles/LearningEnv/*.json LEARNING_STATE_FILE=EnvFiles/LearningState/*.js 

・LEARNINGは強化学習を適用するかを指定(適用時=1, 非適用時=0)

・EXPOSE_LOG_LEVEL=3の時実行前にファイルをコンパイル
  ・ファイル変更後はコンパイルが必要
  ・コンパイルが不要な場合は省略可能

・ActionSwitchは強化学習のaction or パス選択アルゴリズムを指定

・LearningEnvは強化学習のreward、学習の詳細設定、実行の詳細設定を指定
  ・jsonの各項目の詳細
    ・NNconsts : 学習の各数値の設定
    ・estimate_func : 学習に使用する関数
    ・repeat_learning : 複数エピソードに渡って学習を行うか
    ・maxExecStep : 実行パス数の上限
    ・maxEps : 実行エピソード(差分を見つけるまでが1エピソード)数の上限
    ・actions : 強化学習の行動の一覧
    ・rewards : rewardsの値
    ・play : 学習済み関数データを使用するか
    ・agentPath: 学習済み関数データのパス("./outputs/OUTPUT_DIRNAME/YYYY-MM-DD/HH:MM:SS/value_function/value_function_agent_epi??.pkl")

・LearningStateは強化学習のstateを指定

・OUTPUT_DIRNAMEは実験データの出力先ディレクトリ名を入力
  ・実験データは./outputs/OUTPUT_DIRNAME/YYYY-MM-DD/HH:MM:SSに出力される
    ・出力データ一覧
      ・graphs : 作成したグラフ等のデータ群
      ・HBjson : HB計算に用いたデータ群
      ・interGraphs : icdg, icfgのデータ群
      ・jalangiLogA/B : 記号実行エンジンjalangiのログ
      ・ActionSwitch.js, LearningEnv.json : 実験に用いた各ファイルのコピー
      ・info.log : 指定した実験条件ファイルのログ
      ・execRecord.json, learningRecord.json : 実験結果のログ
      ・result.json : 実験結果(整形後)
        ・succs : 差分検出成功割合
        ・runs : 平均実行パス数
        ・time : 平均実行時間
        ・runs_succ : 平均実行パス数(検出成功時のみ)
        ・time_succ : 平均実行時間(検出成功時のみ)

・TEST_DIRNAME
  ・ディレクトリ内にdirA/Bの2つを持つ必要あり
    ・dirAとdirBのファイルの差分を解析
  ・dirA/Bに共通して存在するテスト用のファイルTESTFILEをもとに解析

・TESTFILEは実験対象のファイル名を指定
  ・ファイルはdirA/Bの両方に存在する必要あり
  ・ファイルの構成
    ・冒頭に以下を追加
      var S$ = require('S$');
      S$.setAsyncHooks(require('async_hooks'));
    ・比較したい出力vを以下で指定
      S$.output(NAME, 変数v);
    ・入力は以下で指定
      S$.symbol(NAME, 初期値)
    ・プログラム中のリクエストreqを以下で指定(複数回呼び出し可能)
      S$.registerRequest(NAME, args, req);
      ・関数reqにリクエストの内容を(擬似的に)指定
      ・argsは関数reqの引数の初期値を指定
    ・最後に以下を追加
      S$.callRequests();

### Components

Show only important files/directories

-ExpoSE
  -ACG : コールグラフ作成ツール
  -Analyser : 記号実行用ファイル群
    -src
      -MyModels : Node.jsのコアモジュールモデル化用ファイル群
      -SymbolicExecution.js, SymolicState.js : 記号実行の詳細設定用ファイル
  -Distriubtor : 差分解析用ファイル群
    -src
      -CallbackOrder.js : コールバック順序計算用ファイル (異なるコールバック順序の生成アルゴリズム部分に相当)
      -Distributor.js, Center.js, Spawn.js : 差分解析、記号実行全体の管理用ファイル
      -CEPTList.js : CEPT計算用ファイル
      -Learning.js(, LearningFake.js), fn_framework.py, Network.py : 機械学習用ファイル
      -HBRelation.js : HB関係計算管理用ファイル
      -Informations.js : 実行パス候補の情報管理用ファイル
      -Solver.js : SMTソルバでの計算用ファイル
      -Strategy.js : パス選択アルゴリズム用ファイル
  -EnvFiles : 実験条件指定用ファイル群
    -ActionSwitch : 強化学習のaction/パス選択アルゴリズム指定用ファイル群
    -LearningEnv : 強化学習の詳細設定、reward、実行回数等指定用ファイル群
    -LearningState : 強化学習のstate指定用ファイル群
  -mytests : 実験対象ファイル群
  -outputs : 実験出力ファイル群
  -reachable : HB関係計算用ファイル群
  -scripts : 実行用シェルスクリプト群
    -analyse : 差分解析の操作用ファイル
    -calcHB : HB関係計算操作用ファイル
    -update_graphs : グラフ生成操作用ファイル
  -StaticAnalysis : 事前解析用ファイル群
    -analyseCFG : CFG解析用ファイル
    -deleteComments.js : 検査対象プログラム整形用ファイル
  -TAJS : CFG生成用ファイル群

