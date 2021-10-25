const COLLISION_INJURY_START = 5;
const COLLISION_INJURY_STEP = 2;
const TURNS_PER_ROUND = 8;

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
	// scores

	constructor(field, teams, aerials) {
		this.field = field;
		this.teams = teams;
		this.teamTurn = 0;
		this.aerials = aerials;
		this.revision = 0;
		this.turnsLeft = TURNS_PER_ROUND;
		this.round = 1;
		this.scores = teams.map(t => 0);
		for (let ag of aerials) for (let a of ag) this.field.addAerial(a);
		if (this.aerials.length > 0) for (let a of this.aerials[0]) a.startTurn();
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

	checkRoundEnd() {
		let aerialsRemaining = this.aerials.map(as => as.filter(a => !a.eliminated).length);
		let maxRemaining = aerialsRemaining.reduce((a, b) => Math.max(a, b));
		let knockout = aerialsRemaining.filter(c => c != 0).length <= 1;
		if ((this.turnsLeft <= 0 && !(aerialsRemaining.filter(c => c == maxRemaining).length > 1)) || knockout) {
			if (knockout) {
				let winner = 0;
				for (let i = 0; i < aerialsRemaining.length; i++) if (aerialsRemaining[i] > 0) winner = i;
				for (let i = 0; i < this.scores.length; i++) this.scores[i] = i == winner ? 3 : 0;
				this.round = 4;
			} else {
				for (let i = 0; i < aerialsRemaining.length; i++) if (aerialsRemaining[i] == maxRemaining) this.scores[i]++;
			}
			if (this.round < 3) {	
				this.teamTurn = 0;
				this.round++;
				this.turnsLeft = TURNS_PER_ROUND;
				for (let i = 0; i < this.aerials.length; i++) {
					for (let j = 0; j < this.aerials[i].length; j++) {
						this.aerials[i][j].resetForNewRound(this.field.startPositions[i][j], [this.field.startPositions[i][j][0] >= this.field.width / 2 ? -1 : 1, 0]);
					}
				}
				for (let a of this.aerials[0]) a.startTurn();
			} else {
				for (let ag of this.aerials) for (let a of ag) a.phase = Aerial.PHASE_NOTTURN;
			}
		}
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

	collisionTester(randomizer, aerial, position) {
		// Aerial-obstacle collisions.
		let v = Math.abs(aerial.velocity[0]) + Math.abs(aerial.velocity[1]);
		for (let o of this.obstacles) {
			if (o.containsPoint(position)) {
				v *= o.type.injuryFactor;
				aerial.addInjury(Math.ceil((v - COLLISION_INJURY_START + 1) / COLLISION_INJURY_STEP), randomizer);
				aerial.eliminated = true;
				return true;
			}
		}

		// Aerial-out-of-bounds collisions.
		if (position[0] < 0 || position[1] < 0 || position[0] >= this.width || position[1] >= this.height) {
			aerial.eliminated = true;
			return true;
		}

		// Aerial-ground collisions.
		if (this.cells[position[0]][position[1]].ground) {
			aerial.addInjury(Math.ceil((v - COLLISION_INJURY_START + 1) / COLLISION_INJURY_STEP), randomizer);
			aerial.eliminated = true;
			return true;
		}
		

		// Aerial-aerial collisions.
		for (let a of this.aerials) {
			if (a == aerial) continue;
			if (a.eliminated) continue;
			if (LogicUtil.equal(a.position, position)) {
				let aInjuries = Math.ceil((v - COLLISION_INJURY_START + 1) / COLLISION_INJURY_STEP);
				let aerialInjuries = Math.ceil((v - COLLISION_INJURY_START + 1) / COLLISION_INJURY_STEP);
				let dv = aerial.velocity.map(i => i);

				if (a.team != aerial.team) {
					if (aInjuries > 0 && aerial.hasSkill(Skill.SKILL_WICKED)) aInjuries++;
					if (aerialInjuries > 0 && a.hasSkill(Skill.SKILL_WICKED)) aerialInjuries++;

					if (aerial.hasSkill(Skill.SKILL_WINDING)) a.breath = Math.max(0, a.breath - 1);
					if (a.hasSkill(Skill.SKILL_WINDING)) aerial.breath = Math.max(0, aerial.breath - 1);
					if (a.hasSkill(Skill.IMPLACABLE)) {
						dv[0] -= Math.sign(dv[0]);
						dv[1] -= Math.sign(dv[1]);
					}
				}

				if (aerialInjuries > 0) aerial.addInjury(aerialInjuries, randomizer);
				if (aInjuries > 0) a.addInjury(aInjuries, randomizer);

				a.addMotion(dv);
				aerial.velocity = [0, 0];
				aerial.velocityRemaining = [0, 0];

				return true;
			}
		}
	}

	getAerialsAdjacentTo(position) {
		return this.aerials.filter(a => !a.eliminated && a.distanceTo(position) == 1);
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
		c.obstacles = this.obstacles.map(o => o.clone());
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
	// position // bottom-left

	constructor(type, position) {
		this.type = type;
		this.position = position;
	}

	containsPoint(position) {
		return position[0] >= this.position[0] && position[1] >= this.position[1] && position[0] < this.position[0] + this.type.width && position[1] < this.position[1] + this.type.height;
	}

	occupiedPositions() {
		let p = [];
		for (let i = 0; i < this.type.width; i++) {
			for (let j = 0; j < this.type.height; j++) {
				p.push([this.position[0] + i, this.position[1] + j]);
			}
		}
		return p;
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
	// referee

	constructor(height, width, movable, referee, injuryFactor, description) {
		this.height = height;
		this.width = width;
		this.movable = movable;
		this.referee = referee;
		this.injuryFactor = injuryFactor;
		this.description = description;
	}

	static TYPES = {
		"balloon": new ObstacleType(1, 1, true, false, 0, "A balloon. Aerials that collide with it are eliminated but never injured."),
		"referee": new ObstacleType(1, 1, true, true, 1, "A referee. Aerials that collide with them are eliminated, and they can assign penalties."),
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
	// historyPoints[] // Previous fractional positions this turn

	static PHASE_PREFLIGHT = 1;
	static PHASE_MIDLIGHT = 2;
	static PHASE_NOTTURN = 3;

	constructor(position, velocity, portrait, name, team, skills, injuries) {
		this.position = [position[0], position[1]];
		this.velocity = velocity;
		this.portrait = portrait;
		this.name = name;
		this.team = team;
		this.skills = skills;
		this.injuries = injuries;
		this.breath = this.getMaxBreath();
		this.velocityRemaining = [velocity[0], velocity[1]];
		this.skillCount = 0;
		this.phase = Aerial.PHASE_NOTTURN;
		this.fractionalPosition = [position[0] + 0.5, position[1] + 0.5];
		this.eliminated = false;
		this.historyPoints = [];
	}

	static fromData(data, team, position, velocity) {
		return new Aerial(
				position,
				velocity,
				data.portrait,
				data.name,
				team,
				data.skills,
				data.hasOwnProperty("injuries") ? data.injuries : []);
	}

	addInjury(amount, randomizer) {
		if (this.hasSkill(Skill.SKILL_TOUGH)) amount--;
		while (amount > 0) {
			let possibilities = [];
			for (let i = 0; i < this.skills.length; i++) if (this.injuries.indexOf(i) == -1) possibilities.push(i);
			if (possibilities.length == 0) return;
			this.injuries.push(possibilities[Math.floor(randomizer() * possibilities.length)]);
			amount--;
		}
	}

	addMotion(dv) {
		this.velocityRemaining[0] += dv[0];
		this.velocityRemaining[1] += dv[1];
		this.velocity[0] += dv[0];
		this.velocity[1] += dv[1];
	}

	changePosition(newPosition) {
		this.historyPoints.push(this.fractionalPosition);
		this.fractionalPosition = [this.fractionalPosition[0] - this.position[0] + newPosition[0], this.fractionalPosition[1] - this.position[1] + newPosition[1]];
		this.position = newPosition.map(i => i);
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
		this.historyPoints = [];
		this.velocity[1]--;
		this.velocityRemaining[0] = this.velocity[0];
		this.velocityRemaining[1] = this.velocity[1];
		this.skillCount = 0;
		this.phase = Aerial.PHASE_NOTTURN;
		{
			let breathRegain = 2;
			if (this.hasSkill(Skill.SKILL_SKYDIVER) && field.getCell(this.position).mana <= 1) breathRegain += 2;
			if (this.hasSkill(Skill.SKILL_GROUND_EFFECT) && field.getCell(this.position).mana >= 2) breathRegain++;
			while (breathRegain > 0) {
				if (this.breath + 1 <= this.getMaxBreath()) this.breath++;
				breathRegain--;
			}
		}
	}

	resetForNewRound(position, velocity) {
		this.position = [position[0], position[1]];
		this.velocity = velocity;
		this.velocityRemaining = [velocity[0], velocity[1]];
		this.breath = this.getMaxBreath();
		this.phase = Aerial.PHASE_NOTTURN;
		this.fractionalPosition = [position[0] + 0.5, position[1] + 0.5];
		this.eliminated = false;
	}

	moveStep(collider) {
		this.phase = Aerial.PHASE_MIDFLIGHT;
		this.historyPoints.push(this.fractionalPosition);
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
	
	penalty() {
		this.eliminated = true;
	}

	getMaxBreath() {
		return 5 + (this.hasSkill(Skill.SKILL_ENDURANCE) ? 2 : 0);
	}

	hasSkill(skillId) {
		for (let i = 0 ; i < this.skills.length; i++) {
			if (this.skills[i] == skillId && !this.injuries.includes(i)) return true;
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
						this.injuries.map(i => i));
		a.velocityRemaining = this.velocityRemaining.map(i => i);
		a.fractionalPosition = this.fractionalPosition;
		a.skillCount = this.skillCount;
		a.phase = this.phase;
		a.eliminated = this.eliminated;
		a.breath = this.breath;
		a.historyPoints = this.historyPoints;
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
