

class LearningFake {

	constructor (center) {
		this.center = center;
	}

	start () {
		this.send_message();
	}

	read_message() {
		this.center.moveStep();
	}

	send_message() {
		this.read_message();
	}

	update(reward, finish) {
		if (!finish) this.send_message();
		else this.center._finishedTesting();
	}
}

export default LearningFake;
