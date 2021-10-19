class Controller {
	// game
	// listeners[]
	// locked
	// backend

	constructor(game, actionSubmitter) {
		this.game = game;
		this.listeners = [];
		this.actionSubmitter = actionSubmitter;
	}

	addListener(callback) {
		this.listeners.push(callback);
	}

	submitAction(action) {
		if (this.locked) return;
		this.locked = true;
		let othis = this;
		this.actionSubmitter(actions => {
			if (actions.length != action.revision) {
				othis.locked = false;
			} else {
				actions.push(action);
			}
		});
	}

	// a should be between 0 and 1.
	random(a) {
		a *= 2 ^ 31;
		return function() { // mulberry32
			var t = a += 0x6D2B79F5;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		}
	}

	onAction(actions) {
		if (actions == null) actions = [];
		for (let a = this.game.revision; a < actions.length; a++) {
			let action = actions[a];
			this.game.revision++;
			let randomizer = this.random(action.random);
			if (action.hasOwnProperty("skill")) {
				Skill.SKILLS[action.skill](this.game.field.aerials[action.aerial], this.game, randomizer)[action.option]();
			} else if (action.hasOwnProperty("move")) {
				this.game.field.aerials[action.aerial].moveStep(this.game.field.collisionTester.bind(this.game.field, randomizer));
			} else if (action.hasOwnProperty("endturn")) {
				this.game.endTurn();
			} else {
				console.log(JSON.stringify(action));
			}
			this.game.checkRoundEnd();
		}
		for (let l of this.listeners) l();
		this.locked = false;
	}
}
