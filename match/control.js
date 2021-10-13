class Controller {
	// game
	// listeners[]

	constructor(game) {
		this.game = game;
		this.listeners = [];
	}

	addListener(callback) {
		this.listeners.push(callback);
	}

	// action:
	// {
	//   skill: 
	// }
	submitAction(action) {
		if (this.game.revision != action.revision) {
			// Reject the action? How to resolve conflicts? Give each action a random priority?
			return;
		}
		this.game.revision++;
		if (action.hasOwnProperty("skill")) {
			Skill.SKILLS[action.skill](this.game.field.aerials[action.aerial], this.game)[action.option]();
		} else {
			console.log(JSON.stringify(action));
		}
		for (let l of this.listeners) l();
	}
}
