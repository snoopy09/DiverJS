//
// const path = require('path');
//
// const Log = function (str) {
//   console.log("[#pathModels#] "+str);
// }
//
// // エラー処理はとりあえず考えない
//
// class pathModels {
//
//   constructor(streamModels, state) {
//     this.state = state;
//     this.dirName = path.resolve("./tmp");
//   }
// 
//
//   _getTmpFilePath(hashHex) {
//     return this.dirName+"/"+hashHex;
//   }
//
//
//   _getField (base, offset) {
//     const info = this.state.getPropInfo(base, offset);
// 		const offset_t = this.state.getTaint(offset);
// 		let result_t = [info.name, info.id];
// 		result_t = result_t.concat(offset_t.filter(v => result_t.indexOf(v) === -1));
//
//     let result_s, result_p;
//     if (this.state.isSymbolic(base)) {
//       let obj = this.state.symbolicField(this.state.getConcrete(base), this.state.asSymbolic(base), this.state.asProcedure(base), this.state.getConcrete(offset), this.state.asSymbolic(offset), this.state.asProcedure(offset));
//       if (obj) {
//         result_s = obj.sym;
//         result_p = obj.proc;
//       }
//     }
//
//     let result = this.state.getConcrete(base)[this.state.getConcrete(offset)];
//     this.state.pushReadWriteVar("read", iid, this._location(iid), result, info.id, info.name);
//
//     if (this.state.isWrapped(result)) {
//       result.concatTaint(result_t);
//     } else {
//       result = new WrappedValue(result, result_t);
//     }
//     if (result_s) result = new ConcolicValue(this.state.getConcrete(result) , result_s, result_p, this.state.getTaint(result));
//     return result;
//   }
//
//
//   normalize (f, base, args, iid, location, base_s, args_s) {
//     return function () {
//       let path = args_s[0];
//
//       if (this.state.condition(this.state.binary('===', this._getField(path, "length"), 0)) {
//         return '.';
//       }
//
//       const isAbsolute = path.charCodeAt(0) === 47/*/*/;
//       const trailingSeparator = path.charCodeAt(path.length - 1) === 47/*/*/;
//
//       // Normalize the path
//       path = normalizeStringPosix(path, !isAbsolute);
//
//       if (path.length === 0 && !isAbsolute)
//       path = '.';
//       if (path.length > 0 && trailingSeparator)
//       path += '/';
//
//       if (isAbsolute)
//       return '/' + path;
//       return path;
//     }
//   }
//
//
//
//   resolve (f, base, args, iid, location, base_s, args_s) {
//     const self = this;
//     return function () {
//       var resolvedPath = '';
//       var resolvedAbsolute = false;
//       var cwd = self.tmpPath;
//
//       for (var i = self._getField(path, "length") - 1; i >= -1 && !resolvedAbsolute; i--) {
//         var path;
//         if (i >= 0)
//         path = self._getField(path, i);
//         else {
//           path = cwd;
//         }
//
//         // Skip empty entries
//         if (self.state.condition(self.state.binary('===', self._getField(path, "length"), 0)) {
//           continue;
//         }
//
//         resolvedPath = path + '/' + resolvedPath;
//         resolvedAbsolute = path.charCodeAt(0) === 47/*/*/;
//       }
//
//       // At this point the path should be resolved to a full absolute path, but
//       // handle relative paths to be safe (might happen when process.cwd() fails)
//
//       // Normalize the path
//       resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
//
//       if (resolvedAbsolute) {
//         if (resolvedPath.length > 0)
//         return '/' + resolvedPath;
//         else
//         return '/';
//       } else if (resolvedPath.length > 0) {
//         return resolvedPath;
//       } else {
//         return '.';
//       }
//     }
//   }
//
//
//   get (f, base) {
//     for (let func in path) {
//       if (typeof path[func] === "function" && path[func].toString() === f.toString()) {
//         // Log(func);
//         if (!this[func]) {
//           Log("これないよ！！" + func);
//           return;
//         }
//         return {func: this[func], base: this};
//       }
//     }
//   }
// }
//
// export default pathModels
