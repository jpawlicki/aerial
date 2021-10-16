class LogicUtil {
	// Compares two positions for equality.
	static equal(a, b) {
		return a[0] == b[0] && a[1] == b[1];
	}
}

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
		this.width = 12;
		this.height = 12;
		this.cells = [];
		for (let i = 0; i < this.width; i++) {
			this.cells.push([]);
			for (let j = 0; j < this.height; j++) {
				this.cells[i].push(new Cell(j <= Math.round(Math.random()) - 1, Math.floor((this.height - j - 1 + Math.random() * 2) / 3), true));
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

	collisionTester(aerial, position) {
		// Aerial-obstacle collisions.

		// Aerial-ground collisions.

		// Aerial-aerial collisions.
		for (let a of this.aerials) {
			if (a == aerial) continue;
			// TODO: Don't count eliminated aerials.
			if (LogicUtil.equal(a.position, position)) {
				a.addMotion(aerial.velocity);
				aerial.velocity = [0, 0];
				aerial.velocityRemaining = [0, 0];
				return true;
			}
		}
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
	// fractionalPos[] // The "true" position of aerial as they move along the flight line.
	// travelled[] // spaces this aerial has travelled during MIDFLIGHT

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
		this.fractionalPosition = [position[0] + 0.5, position[1] + 0.5];
	}

	addMotion(dv) {
		this.velocityRemaining[0] += dv[0];
		this.velocityRemaining[1] += dv[1];
		this.velocity[0] += dv[0];
		this.velocity[1] += dv[1];
	}

	distanceTo(position) {
		let dx = this.position[0] - position[0];
		let dy = this.position[1] - position[1];
		return Math.sqrt(dx * dx + dy * dy);
	}

	moveStep(collider) {
		this.phase = Aerial.PHASE_MIDFLIGHT;
		let ray = [this.position[0] + this.velocityRemaining[0] - this.fractionalPosition[0] + .5, this.position[1] + this.velocityRemaining[1] - this.fractionalPosition[1] + .5];
		let rayLength = Math.sqrt(ray[0] * ray[0] + ray[1] * ray[1]);

		let dx = this.fractionalPosition[0] - this.position[0];
		let dxToEdge = ray[0] < 0 ? -dx : 1 - dx;
		let tToInterceptX = ray[0] == 0 ? Number.POSITIVE_INFINITY : dxToEdge / (ray[0] / rayLength);
		let dy = this.fractionalPosition[1] - this.position[1];
		let dyToEdge = ray[1] < 0 ? -dy : 1 - dy;
		let tToInterceptY = ray[1] == 0 ? Number.POSITIVE_INFINITY : dyToEdge / (ray[1] / rayLength);

		let step = tToInterceptX <= tToInterceptY ? [Math.sign(this.velocityRemaining[0]), 0] : [0, Math.sign(this.velocityRemaining[1])];
		this.velocityRemaining = [this.velocityRemaining[0] - step[0], this.velocityRemaining[1] - step[1]];

		let dest = [this.position[0] + step[0], this.position[1] + step[1]];

		if (!collider(this, dest)) {
			this.position = dest;
			this.fractionalPosition = [this.fractionalPosition[0] + Math.min(tToInterceptX, tToInterceptY) * (ray[0] / rayLength), this.fractionalPosition[1] + Math.min(tToInterceptX, tToInterceptY) * (ray[1] / rayLength)];
		}
	
		if (this.velocityRemaining[0] == 0 && this.velocityRemaining[1] == 0) {
			this.fractionalPosition = [this.position[0] + .5, this.position[1] + .5];
		} else {
			dx = this.fractionalPosition[0] - this.position[0];
			dxToEdge = ray[0] < 0 ? -dx : 1 - dx;
			tToInterceptX = ray[0] == 0 ? Number.POSITIVE_INFINITY : dxToEdge / (ray[0] / rayLength);
			dy = this.fractionalPosition[1] - this.position[1];
			dyToEdge = ray[1] < 0 ? -dy : 1 - dy;
			tToInterceptY = ray[1] == 0 ? Number.POSITIVE_INFINITY : dyToEdge / (ray[1] / rayLength);
			this.fractionalPosition = [this.fractionalPosition[0] + Math.min(tToInterceptX, tToInterceptY) * (ray[0] / rayLength) / 2, this.fractionalPosition[1] + Math.min(tToInterceptX, tToInterceptY) * (ray[1] / rayLength) / 2];
		}
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
		a.fractionalPosition = this.fractionalPosition;
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
