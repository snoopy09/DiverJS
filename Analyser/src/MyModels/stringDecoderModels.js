
// jalangiのread/writeの記録をここでもとりたい
// stateを渡してどうにかする？

const { StringDecoder } = require('string_decoder');

const Log = function (str) {
  console.log("[#stringDecorderModels#] "+str);
}


class StringDecoderModels {

  constructor(state) {
    this.state = state;
  }

  objConstructor (f, base, args, iid, location) {
    return f;
  }

  write (f, base, args, iid, location) {
    return f;
  }

  get (f, base) {
    if (f.toString() === StringDecoder.toString()) {
      return {func: this.objConstructor, base: this}
    }

    if (base instanceof StringDecoder) {
      for (let func in base) {
        if (typeof base[func] === "function" && base[func].toString() === f.toString()) {
          if (!this[func]) {
            Log("これないよ！！(StringDecoder)" + func);
            return;
          }
          return {func: this[func], base: this};
        }
      }
    }
  }
}

export default StringDecoderModels
