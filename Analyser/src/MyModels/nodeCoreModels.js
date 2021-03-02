
// jalangiのread/writeの記録をここでもとりたい
// stateを渡してどうにかする？
import fsModels from "./fsModels";
// import pathModels from "./pathModels";
import streamModels from "./streamModels";
import timerModels from "./timerModels";
import bufferModels from "./bufferModels";
import stringDecoderModels from "./stringDecoderModels";
import httpModels from "./httpModels";
import netModels from "./netModels";

const Log = function (str) {
  console.log("[#coreModels#] "+str);
}

// エラー処理はとりあえず考えない

class nodeCoreModels {

  constructor(state) {
    this.state = state;

    this.streamModels = new streamModels(this.state);
    // this.pathModels = new pathModels(this.state);
    this.fsModels = new fsModels(this.streamModels, this.state);
    this.timerModels = new timerModels(this.state);
    this.bufferModels = new bufferModels(this.state);
    this.stringDecoderModels = new stringDecoderModels(this.state);
    this.httpModels = new httpModels(this.state);
    this.netModels = new netModels(this.state);

    this.doNoting = {func: function (f) {return f}}

    this.core_modules = ["assert", "async_hooks", "path", "util"]; // いっぱいあるよ
  }


  compareModuleObj(mod, base) {
    const mod_keys = Object.keys(mod).sort();
    const base_keys = Object.keys(base).sort();

    if (mod_keys.length !== base_keys.length) return false;
    for (let i in mod_keys) {
      if (mod_keys[i] !== base_keys[i]) return false;
    }

    return false;
  }


  get (f, base) {

    if (f.toString() === require.toString()) {
      return this.doNoting;
    }

    let func;
    let models = [this.timerModels, this.bufferModels, this.stringDecoderModels, this.httpModels, this.netModels, this.fsModels];

    for (let i in models) {
      func = models[i].get(f, base);
      if (func) return func;
    }

    // func = this.pathModels.get(f, base);
    // if (func) return func;

    for (let i in this.core_modules) {
      const mod = require(this.core_modules[i]);
      for (let func in mod) {
        if (typeof mod[func] === "function" && f.toString() === mod[func].toString()) {
          return this.doNoting;
        }
      }
    }
  }
}

export default nodeCoreModels
