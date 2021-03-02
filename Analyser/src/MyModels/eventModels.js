
const EventEmitter = require('events');
// const myEmitter = new EventEmitter();

const Log = function (str) {
  console.log("[#eventModels#] "+str);
}

// 引数concritizeしなくていいの？

class eventModels {

  constructor(state, baseId, name, evt) {
    this.state = state;
    this.baseId = baseId;
    this.name = name;
    this.base = evt;
    this.isEvent = false;
    this.invokeFun = false;

    if (evt instanceof EventEmitter) {
      this.isEvent = true;
      this.listenerMap = {};

      const self = this;
      // 自動で登録されるのはonceとみなす
      evt.on('removeListener', (eventName, listener) => {
        self._deleteListener(eventName, listener);
      });
      // これはonやonce関数に紐づいているのか
      evt.on('newListener', (eventName, listener) => {
        // self._addCallListener(eventName);
        self._mapListener(eventName, listener, true, true);
      });

      this.old_on = evt.on;
      this.old_emit = evt.emit;
      evt.addListener = this.on.bind(this);
      evt.on = this.on.bind(this);
      evt.once = this.once.bind(this);
      evt.emit = this.emit.bind(this);

    }
  }


  // _genLisnerElemId (baseId, listenerId) {
  //   return baseId+"["+listenerId+"]";
  // }


  // _addCallListener(listenerId) {
  //   const self = this;
  //   const callback = function () {
  //     self._callListener.call(self, listenerId, [].slice.call(arguments));
  //   };
  //   if (this.base.listeners(listenerId).filter(f => f.toString() === callback.toString()).length === 0) {
  //     Log(this.baseId+", "+listenerId+" 前に"+this.base.listenerCount(listenerId)+"こある");
  //     this.old_on.call(this.base, listenerId, callback);
  //   }
  // }


  // ほんとは最大数のチェック必要
  _mapListener (listenerId, func, once, auto) {
    if (!this.listenerMap[listenerId]) {
      this.listenerMap[listenerId] = [];
      const evt = this.state.registerAsyncTask(`EVENT(${this.name})[${listenerId}]`, this.base, []);
    }
    if (!auto) {
      Log(this.baseId+"の"+listenerId+"関数呼び出しで追加");
      // Log(func.toString());
      this.listenerMap[listenerId].push({func: func, once: once, auto: auto});
    } else {
      Log(this.baseId+"の"+listenerId+"自動で追加");
      // Log(func.toString());
      this.listenerMap[listenerId].push({func: func, once: once, auto: auto});
    }
  }


  _deleteListener (listenerId, func) {
    if (this.listenerMap[listenerId]) {
      this.listenerMap[listenerId] = this.listenerMap[listenerId].filter(o => o.func !== func);
    }
  }


  on (listenerId, func) {
    Log(this.baseId+"の"+listenerId+"を登録");
    this._mapListener(listenerId, func, false, false);
  }


  once　(listenerId, func) {
    Log(this.baseId+"の"+listenerId+"を登録(once)");
    this._mapListener(listenerId, func, true, false);
  }


  _execListeners (listenerId, args) {
    const callbacks = this.listenerMap[listenerId];
    Log(callbacks.length+"個呼ぶ");
    for (let i in callbacks) {
      Log(i+"個目");
      Log(callbacks[i].func.toString());
      // for (let j in args) {
      //   Log(j+": "+args[j]);
      // }
      Log(Object.keys(this.base));
      callbacks[i].func.apply(this.base, args);
    }
    this.listenerMap[listenerId] = callbacks.filter(o => !o.once);
    return callbacks.length > 0;
  }


  // 非同期でも内側で結局これが呼ばれちゃう問題
  emit (listenerId) {
    if (!this.listenerMap[listenerId]) {
      Log(this.baseId+"の"+listenerId+"なかったので元のイベントをemit");
      this.old_emit.apply(this.base, arguments);
    } else {
      Log(this.baseId+"の"+listenerId+"をemit invokeFun: "+this.invokeFun);
      const args = []
      for (let i = 1; i < Object.keys(arguments).length; i++) {
        args.push(arguments[i]);
      }
      if (this.invokeFun) {
        this.invokeFun = false; // とりあえずidは無視
        return this._execListeners(listenerId, args);
      } else {
        let evt = this.state.eventRecord.filter(e => e.name === `EVENT(${this.name})[${listenerId}]` && !e.completed)[0];
        if (!evt) {
          evt = this.state.registerAsyncTask(`EVENT(${this.name})[${listenerId}]`, this.base, []);
        }
        // evt.id = evt.name+this.state.eventRecord.filter(e => e.name === evt.name).length;
        const self = this;
        evt.callback = function () {self._execListeners.call(self, listenerId, args)}
        // evt.listenerCalledAsyncId = this.state.getExecutionAsyncId();
        evt.complete.apply(evt, args);
      }
    }
  }


  // _callListener (listenerId, args) {
  //   Log(this.baseId+"の"+listenerId+"を呼びだし");
  //   const callbacks = this.listenerMap[listenerId];
  //   const evt = this.state.registerAsyncTask(`event[${listenerId}]`, base, args);
  //   evt.id = evt.name+this.state.eventRecord.filter(e => e.name === evt.name).length;
  //   const self = this;
  //   evt.callback = function () {self._execListeners.call(self, listenerId, args)}
  //   // evt.listenerCalledAsyncId = this.state.getExecutionAsyncId();
  //   evt.complete.apply(evt, args);
  // }
}

export default eventModels
