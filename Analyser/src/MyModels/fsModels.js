
// jalangiのread/writeの記録をここでもとりたい
// stateを渡してどうにかする？
import {WrappedValue, ConcolicValue} from "./../Values/WrappedValue";

const path = require('path');
const fs = require('fs');
const crypto = require("crypto");


const Log = function (str) {
  console.log("[#fsModels#] "+str);
}

// エラー処理はとりあえず考えない

class fsModels {

  constructor(streamModels, state) {
    this.state = state;

    this.streamModels = streamModels;

    this.fileContentMap = {};
    this.fileStreamMap = {};

    this.dirName = path.resolve("./tmp");
    this.pathList = [this.dirName, this.dirName+"/"];
  }


  _getTmpFilePath(hashHex) {
    return this.dirName+"/"+hashHex;
  }

  _addPath (path) {
    if (this.pathList.indexOf(path) === -1) this.pathList.push(path);
    if (path.charAt(path.length-1) === '/') {
      path = path.slice(0, -1);
      if (this.pathList.indexOf(path) === -1) this.pathList.push(path);
    } else {
      path = path + '/';
      if (this.pathList.indexOf(path) === -1) this.pathList.push(path);
    }
  }

  _removePath (path) {
    this.pathList = this.pathList.filter(p => p !== path);
    if (path.charAt(path.length-1) === '/') {
      path = path.slice(0, -1);
      this.pathList = this.pathList.filter(p => p !== path);
    } else {
      path = path + '/';
      this.pathList = this.pathList.filter(p => p !== path);
    }
  }

  // 初見のファイルの場合は新たなシンボルを割り当て
  // ホントのファイルの中身を持ってきたほうがベター？
  _createFile (file, path) {
    // Log(path);
    let content;
    try {
      content = fs.readFileSync(path);
    } catch (e) {
      content = "";
    }
    this.fileContentMap[file] = this.state.createSymbolicValue(file+"_content", content);
    // Log("シンボル割り当てた "+this.fileContentMap[file]);
    const filePath = this._getTmpFilePath(file);
    fs.writeFileSync(filePath, content);
    // Log(content);
    this._addPath(filePath);
  }


  _deleteFile (file) {
    if (this.fileContentMap[file]) {
      delete this.fileContentMap[file];
      const filePath = this._getTmpFilePath(file);
      fs.unlinkSync(filePath);
      this._removePath(filePath);
    }
  }


  // 置き換え後の引数を渡している
  // ファイルが存在するかどうかのエラーとかをモデル化できていない
  readFile (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    this.state.pushReadWriteVar("read", iid, location, this.fileContentMap[hashHex], "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);

    const data = this.fileContentMap[hashHex];
    this.state.registerAsyncTask("fs_readFile", base, args, -1, function (args) {args[1] = data});

    return f;
  }


  writeFile (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    this.fileContentMap[hashHex] = data;
    this.state.pushReadWriteVar("write", iid, location, this.fileContentMap[hashHex], "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);
    this.state.registerAsyncTask("fs_writeFile", base, args, -1);

    return f;
  }


  appendFile (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    this.fileContentMap[hashHex] += data;
    this.state.pushReadWriteVar("write", iid, location, this.fileContentMap[hashHex], "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);
    this.state.registerAsyncTask("fs_appendFile", base, args, -1);

    return f;
  }


  _getDirEnvValue () {
    this.pathList.sort(); // 順番揃えてから返す
    return this.pathList.join(":");
  }


  // tmpディレクトリ直下に対する操作としてみる
  mkdir (f, base, args, iid, location) {
    this.state.pushReadWriteVar("read", iid, location, this._getDirEnvValue(), "[global]DirEnv");

    let tmpPath;
    if (args[0].charAt(0) != '/') {
      const absolutePath = path.resolve(args[0]);
      const relativePath = path.relative(path.resolve(""), absolutePath);
      tmpPath = path.resolve(this.dirName, relativePath);
    } else {
      tmpPath = this.dirName + args[0];
    }

    this._addPath(tmpPath);
    args[0] = tmpPath;

    const self = this;
    this.state.registerAsyncTask("fs_mkdir", base, args, -1, function (res_args) {
      // eidがまずそう
      self.state.pushReadWriteVar("write", iid, location, self._getDirEnvValue(), "[global]DirEnv");
      self._taintResult(res_args, ["[global]DirEnv"]);
    });

    return f;
  }


  exists (f, base, args, iid, location, base_s, args_s) {
    this.state.pushReadWriteVar("read", iid, location, this._getDirEnvValue(), "[global]DirEnv");

    // この辺も制約にしないとなあ
    let tmpPath, result;
    if (args[0].charAt(0) != '/') {
      const absolutePath = path.resolve(args[0]);
      const relativePath = path.relative(path.resolve(""), absolutePath);
      tmpPath = path.resolve(this.dirName, relativePath);
    } else {
      tmpPath = this.dirName + args[0];
      const tmpPath_s = this.state.binary('+', this.dirName, args_s[0]);
      // 制約を追加
      result = new WrappedValue(false, ["[global]DirEnv"]);
      Log(this.pathList);
      for (let i in this.pathList) {
        let exists = this.state.binary('===', this.pathList[i], tmpPath_s);
        result = this.state.binary('||', result, exists);
      }
    }
    args[0] = tmpPath;

    const self = this;
    this.state.registerAsyncTask("fs_exists", base, args, -1, function (res_args) {
      if (result) {
        Log(result);
        res_args[0] = result;
      } else {
        self._taintResult(res_args, ["[global]DirEnv"]);
      }
    });

    return f;
  }


  _taintResult (args, taint) {
    for (let i in args) {
      args[i] = new WrappedValue(args[i], taint);
    }
    return args;
  }


  stat (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    const read = fs.statSync(this._getTmpFilePath(hashHex)); // 間の書き換えとかに対応できるのか不安よ
    this.state.pushReadWriteVar("read", iid, location, read, "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);
    this.state.registerAsyncTask("fs_stat", base, args, -1);

    return f;
  }


  statSync (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    const read = fs.statSync(this._getTmpFilePath(hashHex));
    this.state.pushReadWriteVar("read", iid, location, read, "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);

    return f;
  }


  readdir (f, base, args, iid, location) {
    const absolutePath = path.resolve(args[0]);
    this.state.pushReadWriteVar("read", iid, location, this._getDirEnvValue(), "[global]DirEnv");
    const relativePath = path.relative(path.resolve(""), absolutePath);
    const tmpPath = path.resolve(this.dirName, relativePath);

    args[0] = tmpPath;
    this.state.registerAsyncTask("fs_readdir", base, args, -1);

    return f;
  }


  unlink (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    this._deleteFile(hashHex);
    this.state.pushReadWriteVar("write", iid, location, "delete", "[global]File_"+hashHex);
    this.state.pushReadWriteVar("write", iid, location, "delete", "[global]DirEnv");

    args[0] = this._getTmpFilePath(hashHex);
    this.state.registerAsyncTask("fs_unlink", base, args, -1);

    return f;
  }


  // これにコールバックはないけどこれのopenとかerrorでは非同期な処理が発生
  // リスナー登録時にフックをかけるのが無難か
  createWriteStream (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");


    args[0] = this._getTmpFilePath(hashHex);

    const self = this;
    return function () {
      const stream = f.apply(base, args);
      self.fileStreamMap[hashHex] = stream;
      // const info = self.state.variableInfo("writeStream", stream);
      // self.state.registerAsyncTask(`baseId=${info.id}:writeStream[open]`, base, args);
      // Log(self.fileStreamMap);
      // Log(stream);
      return stream;
    }
  }


  open (f, base, args, iid, location) {
    const p = path.resolve(args[0]);
    const hashHex = crypto.createHash("sha256").update(p, "utf8").digest("hex");
    if (!(hashHex in this.fileContentMap)) this._createFile(hashHex, p);
    this.state.pushReadWriteVar("write", iid, location, this.fileContentMap[hashHex], "[global]File_"+hashHex);

    args[0] = this._getTmpFilePath(hashHex);

    this.state.registerAsyncTask("fs_open", base, args, -1);

    return f;
  }


  // fdの対応マップ作成しても良いのかも
  read (f, base, args, iid, location) {
    // this.state.pushReadWriteVar("read", iid, location, this.fileContentMap[hashHex], "[global]File_"+hashHex);
    this.state.registerAsyncTask("fs_read", base, args, -1);
    return f;
  }


  close (f, base, args, iid, location) {
    return f;
  }


  get (f, base) {

    for (let name in this.fileStreamMap) {
      if (this.fileStreamMap[name] === base) {
        return this.streamModels.get(f, base, {filename: "[global]File_"+name});
      }
    }

    for (let func in fs) {
      if (typeof fs[func] === "function" && fs[func].toString() === f.toString()) {
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

export default fsModels
