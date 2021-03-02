
const net = require('net');

const Log = function (str) {
  console.log("[#netModels#] "+str);
}

class socketModels {

  constructor(state) {
    this.state = state;
  }


  setTimeout (f, base, args, iid, location) {
    if (typeof args[1] === "function") {
      base.once("timeout", args[1]);
    }
    const self = this;
    const tmpArgs = [function () {
      const baseInfo = self.state.variableInfo("", self.state.getConcrete(base));
  		const evtModel = self.state.eventModelMap[baseInfo.id];
  		if (evtModel) evtModel.invokeFun = true;
      base.emit("timeout");
    }];
    const evt = this.state.registerAsyncTask("socket_setTimeout", base, tmpArgs, 0);
    // setTimeout(tmpArgs[0], args[0] > 1000 ? 1000 : args[0]);
    setTimeout(tmpArgs[0], 0);
    return function () {};
  }


  setKeepAlive (f, base, args, iid, location) {
    return f;
  }


  setNoDelay (f, base, args, iid, location) {
    return f;
  }


  unref (f, base, args, iid, location) {
    return f;
  }


  destroy (f, base, args, iid, location) {
    return f;
  }



  // socketしか呼び出されない前提で書いてる
  get (f, base) {
    for (let func in base) {
      if (typeof base[func] === "function" && base[func].toString() === f.toString()) {
        // Log(func);
        if (!this[func]) {
          Log("これないよ！！" + func);
          return;
        }
        return {func: this[func], base: this};
      }
    }
  }
}



class netModels {

  constructor(state) {
    this.state = state;
    this.socketModels = new socketModels(this.state);
  }


  connect (f, base, args, iid, location) {
    return this.createConnection (f, base, args, iid, location);
  }


  createConnection (f, base, args, iid, location) {
    const self = this;
    return function () {
      const socket = f.apply(base, args);
      // const info = self.state.variableInfo("socket", socket);
      // self.state.registerAsyncTask(`baseId=${info.id}:socket[data]`, base, args);
      // self.state.registerAsyncTask(`baseId=${info.id}:socket[close]`, base, args);
      return socket;
    }
  }


  get (f, base) {

    if (base instanceof net.Socket) {
      return this.socketModels.get(f, base);
    }

    for (let func in net) {
      if (typeof net[func] === "function" && net[func].toString() === f.toString()) {
        // Log(func);
        if (!this[func]) {
          Log("これないよ！！" + func);
          return;
        }
        return {func: this[func], base: this};
      }
    }
  }
}

export default netModels
