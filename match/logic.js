class Game {
	// field
	// teams[]
	// teamTurn
	// aerials[][]
	// revision

	constructor(field, teams, aerials) {
		this.field = field;
		this.teams = teams;
		this.teamTurn = 0;
		this.aerials = aerials;
		this.revision = 0;
		for (let ag of aerials) for (let a of ag) this.field.addAerial(a);
	}

	clone() {
		let g = new Game(this.field.clone(), this.teams, []);
		g.aerials = this.aerials; // TODO: buggy
		g.teamTurn = this.teamTurn;
		g.revision = this.revision;
		return g;
	}
}

class Field {
	// height
	// width
	// cells[][] // of Cell
	// obstacles[]
	// aerials[]
	// name

	constructor() {
		this.width = 20;
		this.height = 17;
		this.cells = [];
		for (let i = 0; i < this.width; i++) {
			this.cells.push([]);
			for (let j = 0; j < this.height; j++) {
				this.cells[i].push(new Cell(j <= Math.round(Math.random()) - 1, Math.floor((this.height - j - 5 + Math.random() * 2) / 3), true));
			}
		}
		this.obstacles = [];
		for (let i = 0; i < 2; i++) {
			this.obstacles.push(new Obstacle({}, [Math.floor(Math.random() * this.width), Math.floor(Math.random() * (this.height - 1) + 1)]));
		}
		this.aerials = [];
		this.name = "Random Field " + Math.floor(Math.random() * 1000);
	}

	addAerial(aerial) {
		this.aerials.push(aerial);
	}

	getAerialsAdjacentTo(position) {
		return this.aerials.filter(a => a.distanceTo(position) == 1);
	}

	getCell(position) {
		if (position[1] < 0) return new Cell(true, 0, false);
		if (position[1] >= this.height) return new Cell(false, 0, false);
		if (position[0] < 0 || position[0] >= this.width) return new Cell(false, 0, false);
		return this.cells[position[0]][position[1]];
	}

	clone() {
		let c = new Field();
		c.height = this.height;
		c.width = this.width;
		c.cells = this.cells; // shallow copy
		c.obstalces = this.obstacles.map(o => o.clone());
		c.aerials = this.aerials.map(a => a.clone());
		c.name = this.name;
		return c;
	}
}

class Cell {
	// mana
	// ground (bool)
	// inBounds

	constructor(ground, mana, inBounds) {
		this.ground = ground;
		this.mana = mana;
		this.inBounds = inBounds;
	}
}


class Obstacle {
	// type
	// position // top-left

	constructor(type, position) {
		this.type = type;
		this.position = position;
	}

	clone() {
		return new Obstacle(this.type, this.position.map(p => p));
	}
}

class ObstacleType {
	// height
	// width
	// movable
	// injuryFactor
	// description

	constructor(height, width, movable, injuryFactor, description) {
		this.height = height;
		this.width = width;
		this.movable = movable;
		this.injuryFactor = injuryFactor;
		this.description = description;
	}
}

class Aerial {
	// position
	// velocity
	// portrait
	// name
	// team
	// skills[]
	// injuries[]
	// breath
	// velocityRemaining[]
	// skillCount // number of skills used this turn.
	// phase

	static PHASE_PREFLIGHT = 1;
	static PHASE_MIDLIGHT = 2;

	constructor(position, velocity, portrait, name, team, skills, injuries, breath) {
		this.position = position;
		this.velocity = velocity;
		this.portrait = portrait;
		this.name = name;
		this.team = team;
		this.skills = skills;
		this.injuries = injuries;
		this.breath = breath;
		this.velocityRemaining = [velocity[0], velocity[1]];
		this.skillCount = 0;
		this.phase = Aerial.PHASE_PREFLIGHT;
	}

	addMotion(dv) {
		if (this.phase == Aerial.PHASE_PREFLIGHT) {
			this.velocityRemaining[0] += dv[0];
			this.velocityRemaining[1] += dv[1];
		}
		this.velocity[0] += dv[0];
		this.velocity[1] += dv[1];
	}

	distanceTo(position) {
		let dx = this.position[0] - position[0];
		let dy = this.position[1] - position[1];
		return Math.sqrt(dx * dx + dy * dy);
	}

	getMaxBreath() {
		return 6 + this.hasSkill(Skill.SKILL_ENDURANCE) ? 4 : 0;
	}

	hasSkill(skillId) {
		for (let i = 0 ; i < this.skills.length; i++) {
			if (this.skills[i] == skillId && !this.injuries[i]) return true;
		}
		return false;
	}

	clone() {
		let a =
				new Aerial(
						this.position.map(i => i),
						this.velocity.map(i => i),
						this.portrait,
						this.name,
						this.team,
						this.skills.map(i => i),
						this.injuries.map(i => i),
						this.breath);
		a.velocityRemaining = this.velocityRemaining.map(i => i);
		a.skillCount = this.skillCount;
		a.phase = this.phase;
		return a;
	}
}

class Team {
	// color1
	// color2
	// name

	constructor(color1, color2, name) {
		this.color1 = color1;
		this.color2 = color2;
		this.name = name;
	}
}
