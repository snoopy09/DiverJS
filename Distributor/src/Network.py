## coding: UTF-8

import os
import random
import argparse
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.linear_model import LinearRegression
from sklearn.linear_model import Ridge
from sklearn.linear_model import Lasso
from sklearn.linear_model import RidgeCV
from sklearn.linear_model import MultiTaskLassoCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
# from sklearn.externals import joblib
import joblib
# import gym
from fn_framework import FNAgent, Trainer, Observer
import sys
import json
import copy


class ValueFunctionAgent(FNAgent):

    def save(self, model_path):
        # self.my_logger.write(self.model)
        joblib.dump(self.model, model_path)

    @classmethod
    def load(cls, env, model_path, my_logger, experiences=[], estimate_func="Linear", alpha=1.0, epsilon=0.0001):
        actions = list(range(env.action_space.n))
        agent = cls(epsilon, actions, my_logger, estimate_func, alpha)
        agent.model = joblib.load(model_path)
        if not agent.model:
            agent.initialize(experiences)
        else:
            agent.initialized = True
        return agent

    def initialize(self, experiences=[]):
        scaler = StandardScaler()

        # 価値関数の定義
        if self.estimate_func == "Linear":
            estimator = LinearRegression()
        elif self.estimate_func == "NN":
            estimator = MLPRegressor(hidden_layer_sizes=(10, 10), max_iter=1)
        elif self.estimate_func == "Ridge":
            estimator = Ridge(alpha=self.alpha)
        elif self.estimate_func == "Ridge(withoutIntercept)":
            estimator = Ridge(alpha=self.alpha, fit_intercept = False)
        elif self.estimate_func == "Lasso":
            estimator = Lasso(alpha=self.alpha)
        elif self.estimate_func == "RidgeCV":
            estimator = RidgeCV(alphas=10 ** np.arange(-6, 1, 0.1), cv=5)
        elif self.estimate_func == "LassoCV":
            estimator = MultiTaskLassoCV(alphas=10 ** np.arange(-6, 1, 0.1), cv=5)
        self.model = Pipeline([("scaler", scaler), ("estimator", estimator)])

        states = np.vstack([e.s for e in experiences])
        # self.my_logger.write(states)
        self.model.named_steps["scaler"].fit(states)

        # Avoid the predict before fit.
        self.update([experiences[0]], gamma=0)
        self.initialized = True
        # print("Done initialization. From now, begin training!")

    def estimate(self, s):
        # print(s)
        # print(self.model.named_steps["estimator"].coef_)
        # print(self.model.named_steps["estimator"].intercept_)
        # print(self.model.predict(s)[0])
        self.my_logger.write_predict_log(self.model.predict(s)[0])
        estimated = self.model.predict(s)[0]
        return estimated

    def _predict(self, states):
        if self.initialized:
            predicteds = self.model.predict(states)
        else:
            size = len(self.actions) * len(states)
            predicteds = np.random.uniform(size=size)
            predicteds = predicteds.reshape((-1, len(self.actions)))
        return predicteds

    def update(self, experiences, gamma, episode=0, step_count=0):
        # print(experiences)
        states = np.vstack([e.s for e in experiences])
        n_states = np.vstack([e.n_s for e in experiences])

        estimateds = self._predict(states)
        future = self._predict(n_states)

        for i, e in enumerate(experiences):
            reward = e.r
            if not e.d:
                reward += gamma * np.max(future[i])
            estimateds[i][e.a] = reward

        estimateds = np.array(estimateds)
        states = self.model.named_steps["scaler"].transform(states)

        # print(estimateds)
        # print(states)

        if hasattr(self.model.named_steps["estimator"], "coef_"):
            pre_coef = copy.deepcopy(self.model.named_steps["estimator"].coef_)
            pre_intercept = copy.copy(self.model.named_steps["estimator"].intercept_)
            if type(pre_intercept) is float:
                pre_intercept = [self.model.named_steps["estimator"].intercept_] * len(pre_coef)

        if self.estimate_func == "Linear" or self.estimate_func == "Ridge" or self.estimate_func == "Ridge(withoutIntercept)" or self.estimate_func == "Lasso" or self.estimate_func == "RidgeCV" or self.estimate_func == "LassoCV":
            # self.my_logger.write(states)
            # self.my_logger.write(estimateds)
            self.model.named_steps["estimator"].fit(states, estimateds)
        elif self.estimate_func == "NN":
            self.model.named_steps["estimator"].partial_fit(states, estimateds)

        diff = []
        coef = self.model.named_steps["estimator"].coef_
        intercept = self.model.named_steps["estimator"].intercept_
        if type(intercept) is float:
            intercept = [self.model.named_steps["estimator"].intercept_] * len(coef)

        if 'pre_coef' in locals():
            for pre_c, pre_i, c, i in zip(pre_coef, pre_intercept, coef, intercept):
                d = 0
                for pre_v, v in zip(pre_c, c):
                    d += pow(pre_v - v, 2)
                d += pow(pre_i - i, 2)
                diff.append(d)
        else:
            for i in intercept:
                diff.append(0)

        # print(self.model.named_steps["estimator"].coef_)
        # print(self.model.named_steps["estimator"].intercept_)
        self.my_logger.write_param(coef, intercept, diff, episode, step_count)

class ActionSpace():

    def __init__(self, setting):
        # ここを変数渡しにできるようにしなきゃ
        self.n = len(setting['actions'])

class EQcheckEnvironment():

    def __init__(self, setting):
        self.action_space = ActionSpace(setting)

class EQcheck():

    def __init__(self, setting):
        self.env = EQcheckEnvironment(setting)
        self.action_space = self.env.action_space
        self.msgId = 0

    def next_id(self):
        self.msgId += 1
        return self.msgId

    def step(self, action):
        msg = json.dumps({'id': self.next_id(), 'tag': 'STEP', 'action': int(action)})
        print(msg)
        s = input()
        ret = json.loads(s)
        if 'cancel' in ret and ret['cancel']:
            # 強制終了時用、念の為
            sys.exit(0)
        if 'notFind' in ret and ret['notFind']:
            return (None, None, None, {'notFind': True})
        # 以下の形で返す
        # n_state, reward, done, info = self._env.step(action)
        return (ret['n_state'], ret['reward'], ret['done'], {'notFind': False})

    def reset(self):
        msg = json.dumps({'id': self.next_id(), 'tag': "RESET"})
        print(msg)
        s = input()
        ret = json.loads(s)
        return ret['state']


class EQcheckObserver(Observer):

     def transform(self, state):
        return np.array(state).reshape((1, -1))


class ValueFunctionTrainer(Trainer):

    def train(self, env, path, epsilon=0.1, alpha=1.0, initial_count=-1,
              render=False):
        actions = list(range(env.action_space.n))

        # 2回目以降はsaveした状態を読み込んでスタートしたい
        if self.continuation and self.training:
            agent = ValueFunctionAgent.load(env, path, self.my_logger, self.experiences, self.estimate_func, alpha, epsilon)
        else:
            agent = ValueFunctionAgent(epsilon, actions, self.my_logger, self.estimate_func, alpha)

        # self.my_logger.write(("progress", progress))
        # self.my_logger.write(("agent", agent))

        self.train_one(env, agent, initial_count, render)
        return agent

    def begin_train(self, episode, agent):
        agent.initialize(self.experiences)

    def step(self, episode, step_count, agent, experience):
        if self.training:
            batch = random.sample(self.experiences, self.batch_size)
            # print(batch)
            agent.update(batch, self.gamma, episode, step_count)

    def episode_end(self, episode, step_count, agent):
        pass
        # rewards = [e.r for e in self.get_recent(step_count)]
        # self.reward_log.append(sum(rewards))

        # if self.is_event(episode, self.report_interval):
        #     recent_rewards = self.reward_log[-self.report_interval:]
        #     self.my_logger.describe("reward", recent_rewards, episode=episode)



def main(play):
    s = input()
    setting = json.loads(s)

    # 等価性検査用のクラスを作成
    eq_check = EQcheck(setting['env'])
    env = EQcheckObserver(eq_check)

    # ここで色々な変数を初期化すべき
    # def __init__(self, buffer_size=1024, batch_size=32,
    #              gamma=0.9, report_interval=10, log_dir=""):
    trainer = ValueFunctionTrainer(setting['env']['actions'], setting['env']['NNconsts']['buffer_size'], setting['env']['NNconsts']['batch_size'],
        setting['env']['NNconsts']['gamma'], setting['env']['NNconsts']['report_interval'], setting['log_dir'], setting['env']['estimate_func'], setting['env']['repeat_learning'])

    # if trainer.episode >= setting['env']['maxEps']:
    #     msg = json.dumps({'tag': 'CANCEL'})
    #     print(msg)


    if setting['env']['play']:
        agent = ValueFunctionAgent.load(env, setting['env']['agentPath'], trainer.my_logger, epsilon=setting['env']['NNconsts']['epsilon'])
        agent.play(env, trainer.my_logger)
    else:
        # 定数を指定する
        # renderは人手で何かするみたいな？初期値Falseでおっけー
        # def train(self, env, episode, epsilon=0.1, initial_count=-1,render=False):
        path = trainer.my_logger.path_of("value_function_agent.pkl")
        trained = trainer.train(env, path, setting['env']['NNconsts']['epsilon'], setting['env']['NNconsts']['alpha'])
        # trainer.logger.plot("Rewards", trainer.reward_log, trainer.report_interval)

        if trainer.training:
            trained.save(path)

        if trainer.training and trainer.episode % 10 == 9:
            trained.save(trainer.my_logger.path_of("value_function_agent_epi{}.pkl".format(trainer.episode)))

        # 経過を書き出し
        # trainer.my_logger.write(
        #     "episode: "+str(trainer.episode)+", "+
        #     # "experiences": trainer.experiences,
        #     "training: "+str(trainer.training)+", "+
        #     "training_count: "+str(trainer.training_count)+", "+
        #     # "reward_log: "+str(trainer.reward_log)
        # )

        experiences = []
        for e in trainer.experiences:
            experiences.append({
                "s": e.s.tolist(),
                "a": int(e.a),
                "r": e.r,
                "n_s": e.n_s.tolist(),
                "d": e.d
            })

        d = {
            "episode": trainer.episode,
            "experiences": experiences,
            "training": trainer.training,
            # "training_count": trainer.training_count,
            # "reward_log": trainer.reward_log
        }
        # trainer.my_logger.write(d)
        trainer.my_logger.write_progress(d)




if __name__ == "__main__":
    # pythonの引数をパース
    parser = argparse.ArgumentParser(description="VF Agent")
    parser.add_argument("--play", action="store_true",
                        help="play with trained model")

    args = parser.parse_args()
    main(args.play)
    msg = json.dumps({'tag': 'FINISH'})
    print(msg)
