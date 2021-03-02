
const http = require('http');

const Log = function (str) {
  console.log("[#httpModels#] "+str);
}

class requestModels {
  constructor(state) {
    this.state = state;
  }

  end (f, base, args, iid, location) {
    if (typeof args[Object.keys(args).length-1] === "function") {
      this.state.registerAsyncTask("http_request_end", base, args, -1);
    }
    return f;
  }

  onSocket (f, base, args, iid, location) {
    return f;
  }

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


class httpModels {

  constructor(state) {
    this.state = state;
    this.requestModels = new requestModels(this.state);
  }


  request (f, base, args, iid, location) {
    return f;
  }


  get (f, base) {

    if (base instanceof http.ClientRequest) {
      return this.requestModels.get(f, base);
    }

    for (let func in http) {
      if (typeof http[func] === "function" && http[func].toString() === f.toString()) {
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

export default httpModels
