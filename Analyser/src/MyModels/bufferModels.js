
// jalangiのread/writeの記録をここでもとりたい
// stateを渡してどうにかする？


const Log = function (str) {
  console.log("[#bufferModels#] "+str);
}

class BufferModels {

  constructor(state) {
    this.state = state;
  }


  alloc (f, base, args, iid, location) {
    return f;
  }


  get (f, base) {
    // Log(f.toString());
    if (f.toString() === Buffer.alloc.toString()) {
      return {func: this.alloc, base: this};
    }
  }
}

export default BufferModels
