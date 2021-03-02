
const stream = require('stream');

const Log = function (str) {
  console.log("[#streamModels#] "+str);
}

// エラー処理はとりあえず考えない

class WritableModels {
  constructor(state) {
    this.state = state;
    this.streamMap = {};
  }

  write (f, base, args, iid, location) {
    this.state.pushReadWriteVar("write", iid, location, args[0], this.opt ? this.opt.filename : undefined);
    this.state.registerAsyncTask("stream_writable_write", base, args, -1);
    return f;
  }

  destroySoon (f, base, args, iid, location) {
    return f;
  }

  end (f, base, args, iid, location) {
    return this.destroySoon(f, base, args, iid, location);
  }

  get (f, str, opt) {
    this.opt = opt;

    for (let func in str) {
      if (typeof str[func] === "function" && str[func].toString() === f.toString()) {
        if (!this[func]) {
          Log("これないよ！！(stream.Writable)" + func);
          return;
        }
        return {func: this[func], base: this};
      }
    }
  }
}

class streamModels {

  constructor(state) {
    this.state = state;
    this.writableModels = new WritableModels(this.state);
  }


  get (f, str, opt) {
    let func;
    if (str instanceof stream.Writable) {
      func = this.writableModels.get(f, str, opt);
      if (func) return func;
    }
  }
}

export default streamModels
