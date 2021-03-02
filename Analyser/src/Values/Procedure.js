
let count = 0;
let procList = [];

class Procedure {
	constructor (funcname, args) {
		this.func = funcname;
		this.args = args;
		this.count = count++;
		this.proc = true;
		procList.push(this);
	}

	getFinalProcList () {
		procList.pop(); //最後のオブジェクトはこれの呼び出し用なので無視
		return procList;
	}
}

export default Procedure;
