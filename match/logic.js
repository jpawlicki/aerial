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
	// turnsLeft
	// round

	constructor(field, teams, aerials) {
		this.field = field;
		this.teams = teams;
		this.teamTurn = 0;
		this.aerials = aerials;
		this.revision = 0;
		this.turnsLeft = 20;
		this.round = 1;
		for (let ag of aerials) for (let a of ag) this.field.addAerial(a);
	}

	static fromData(field, teams, aerials) {
		let fieldOut = Field.fromData(field);
		let teamsOut = teams.map(t => Team.fromData(t));
		let aerialsOut = [];
		for (let i = 0; i < aerials.length; i++) {
			aerialsOut.push([]);
			for (let j = 0; j < aerials[i].length; j++) {
				aerialsOut[i].push(Aerial.fromData(aerials[i][j], teamsOut[i], fieldOut.startPositions[i][j], [fieldOut.startPositions[i][j][0] >= fieldOut.width / 2 ? -1 : 1, 0]));
			}
		}
		return new Game(fieldOut, teamsOut, aerialsOut);
	}

	clone() {
		let g = new Game(this.field.clone(), this.teams, []);
		g.aerials = this.aerials; // TODO: buggy - this is a shallow copy, but the field clone will do a deep copy.
		g.teamTurn = this.teamTurn;
		g.revision = this.revision;
		return g;
	}

	endTurn() {
		for (let a of this.aerials[this.teamTurn]) a.endTurn(this.field);
		this.teamTurn = (this.teamTurn + 1) % this.teams.length;
		for (let a of this.aerials[this.teamTurn]) a.startTurn(this.field);
		if (this.teamTurn == 0) this.turnsLeft--;
	}
}

class Field {
	// height
	// width
	// cells[][] // of Cell
	// obstacles[]
	// aerials[]
	// startPositions
	// name

	static fromData(o) {
		let f = new Field();
		f.name = o.name;
		f.width = o.dimensions[0];
		f.height = o.dimensions[1];
		f.obstacles = [];
		if (o.hasOwnProperty("obstacles")) {
			for (let oo of o.obstacles) f.obstacles.push(new Obstacle(ObstacleType.TYPES[oo.type], oo.position));
		}
		f.cells = [];
		for (let i = 0; i < f.width; i++) {
			f.cells.push([]);
			for (let j = 0; j < f.height; j++) {
				f.cells[i][j] = new Cell(o.cells[i][j].ground, o.cells[i][j].mana, true);
			}
		}
		f.startPositions = o.startPositions;
		f.aerials = [];
		return f;
	}

	addAerial(aerial) {
		this.aerials.push(aerial);
	}

	collisionTester(aerial, position) {
		// TODO Aerial-obstacle collisions.

		// TODO Aerial-ground collisions.

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

	constructor(height, width, movable, referee, injuryFactor, description) {
		this.height = height;
		this.width = width;
		this.movable = movable;
		this.injuryFactor = injuryFactor;
		this.description = description;
	}

	static TYPES = {
		"balloon": new ObstacleType(1, 1, true, false, 0.1, "A balloon. Touching it eliminates an aerial but rarely injures them."),
	};
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
	// eliminated

	static PHASE_PREFLIGHT = 1;
	static PHASE_MIDLIGHT = 2;
	static PHASE_NOTTURN = 3;

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
		this.eliminated = false;
	}

	static fromData(data, team, position, velocity) {
		return new Aerial(
				position,
				velocity,
				data.portrait,
				data.name,
				team,
				data.skills,
				data.hasOwnProperty("injuries") ? data.injuries : [],
				6);
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

	startTurn(field) {
		this.phase = Aerial.PHASE_PREFLIGHT;
	}

	endTurn(field) {
		this.velocity[1]--;
		this.velocityRemaining[0] = this.velocity[0];
		this.velocityRemaining[1] = this.velocity[1];
		this.skillCount = 0;
		this.phase = Aerial.PHASE_NOTTURN;
		{
			let breathRegain = 2;
			while (breathRegain > 0) {
				if (this.breath + 1 <= this.getMaxBreath()) this.breath++;
				breathRegain--;
			}
		}
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
		return 6 + (this.hasSkill(Skill.SKILL_ENDURANCE) ? 2 : 0);
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
		a.eliminated = this.eliminated;
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

	static fromData(data) {
		return new Team(data.color1, data.color2, data.name);
	}
}
