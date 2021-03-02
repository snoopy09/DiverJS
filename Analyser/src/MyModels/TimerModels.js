
// jalangiのread/writeの記録をここでもとりたい
// stateを渡してどうにかする？


const Log = function (str) {
  console.log("[#timerModels#] "+str);
}

let timerId = 0;
// エラー処理はとりあえず考えない

class TimerModels {

  constructor(state) {
    this.state = state;
    this.immediateQueue = {};
    this.timeoutQueue = {};
    this.eventMap = {};
  }


  nextTick (f, base, args, iid, location) {
    return f;
  }


  setImmediate (f, base, args, iid, location) {
    const id = timerId++;
    const self = this;
    this.eventMap[id] = this.state.registerAsyncTask("setImmediate", base, args, 0, function () {
      delete self.immediateQueue[id];
    });

    return function () {
      const obj = f.apply(base, args);
      self.immediateQueue[id] = obj;
      return obj;
    }
  }

  // setInterval (f, base, args, iid, location) {
  //   this.state.registerAsyncTask("setTimeout", base, args, 0);
  //   return f;
  // }


  setTimeout (f, base, args, iid, location) {
    const id = timerId++;
    const self = this;
    this.eventMap[id] = this.state.registerAsyncTask("setTimeout", base, args, 0, function () {
      delete self.timeoutQueue[id];
    });
    if (args[1] > 1000) args[1] = 1000; // 待ってらんないので早くする

    return function () {
      const obj = f.apply(base, args);
      self.timeoutQueue[id] = obj;
      return obj;
    }
  }

  // setメソッドで返されるオブジェクトを引数にとる
  clearImmediate (f, base, args, iid, location) {
    for (let id in this.immediateQueue) {
      if (this.immediateQueue[id] === args[0]) {
        delete this.immediateQueue[id];
        const evt = this.state.eventRecord.filter(e => e === this.eventMap[id])[0];
        if (evt) {
          // evt.cancelled = true;
          this.state.eventRecord = this.state.eventRecord.filter(e => e !== evt);
        }
      }
    }
    return f;
  }

  // clearInterval (f, base, args, iid, location) {
  //   this.state.registerAsyncTask("setTimeout", base, args, 0);
  //   return f;
  // }

  clearTimeout (f, base, args, iid, location) {
    for (let id in this.timeoutQueue) {
      if (this.timeoutQueue[id] === args[0]) {
        delete this.timeoutQueue[id];
        const evt = this.state.eventRecord.filter(e => e === this.eventMap[id])[0];
        if (evt) {
          // evt.cancelled = true;
          Log("削除した "+evt.toString())
          this.state.eventRecord = this.state.eventRecord.filter(e => e !== evt);
        }
      }
    }
    return f;
  }


  get (f, base) {
    // Log(f.toString());
    if (f.toString() === setImmediate.toString()) {
      return {func: this.setImmediate, base: this};
    }
    if (f.toString() === setTimeout.toString()) {
      return {func: this.setTimeout, base: this};
    }
    if (f.toString() === clearImmediate.toString()) {
      return {func: this.clearImmediate, base: this};
    }
    if (f.toString() === clearTimeout.toString()) {
      return {func: this.clearTimeout, base: this};
    }
    if (f.toString() === process.nextTick.toString()) {
      return {func: this.nextTick, base: this};
    }
  }
}

export default TimerModels
