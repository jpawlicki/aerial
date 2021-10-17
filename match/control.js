class Controller {
	// game
	// listeners[]
	// locked
	// backend

	constructor(game) {
		this.game = game;
		this.listeners = [];
		this.backend = new MemoryBackend();
	}

	addListener(callback) {
		this.listeners.push(callback);
	}

	submitAction(action) {
		if (this.locked) return;
		this.locked = true;
		let result = this.backend.commit(state => {
			if (state.actions.length != action.revision) return false;
			state.actions.push(action);
			return true;
		});
		console.log(result);
		this.locked = false;
	}

	onAction(action) {
		this.game.revision++;
		if (action.hasOwnProperty("skill")) {
			Skill.SKILLS[action.skill](this.game.field.aerials[action.aerial], this.game)[action.option]();
		} else if (action.hasOwnProperty("move")) {
			this.game.field.aerials[action.aerial].moveStep(this.game.field.collisionTester.bind(this.game.field));
		} else if (action.hasOwnProperty("endturn")) {
			this.game.endTurn();
		} else {
			console.log(JSON.stringify(action));
		}
		for (let l of this.listeners) l();
	}
}

class NetworkBackend {
	// Server gamestate is an action history.
	// We read the action list, make sure the length matches the game revision, and if so, add the action in that transaction.
	// If the length doesn't match, we abort the transaction and simply don't follow through on the action.
	commit(txn) {
		let pass = false;
		stateRef.transaction(s => {
			pass = txn(s);
			return s;
		});
		return pass;
	}
}

class MemoryBackend {
	// state

	commit(txn) {
		txn(this.state);
		return true;
	}
}
