class RenderUtil {
	static posToTransform(position, field) {
		return "translate(" + position[0] + "px, " + (field.height - position[1] - 1) + "px)";
	}

	static pointsToPath(points) {
		return "M" + points.map(p => p[0] + "," + p[1]).join("L") + "Z";
	}

	static translatePoints(points, x, y) {
		return points.map(p => [p[0] + x, p[1] + y]);
	}
}

class GameActor {
	// game
	// fieldActor
	// controlActor

	constructor(game, whoami, controller, svg, control) {
		this.game = game;
		this.fieldActor = new FieldActor(game.field, svg);
		this.controlActor = new ControlActor(game, whoami, this.fieldActor, a => controller.submitAction(a), control);
		let othis = this;
		controller.addListener(() => othis.update());
	}

	update() {
		this.fieldActor.update();
		this.controlActor.update();
	}
}

class ControlActor {
	// game
	// whoami
	// optionsActors[] // 1 per aerial - TODO: probably there is enough space to put everyone on one page, maybe make an option for that (handy when running a full team).
	
	constructor(game, whoami, fieldActor, actionCommitter, parent) {
		this.game = game;
		this.whoami = whoami;
		this.optionsActors = [];
		{
			let title = document.createElement("div");
			title.appendChild(document.createTextNode(game.teams.map(t => t.name + " (0)").join(" vs ") + " at " + game.field.name));
			parent.appendChild(title);
		}
		{
			let stat = document.createElement("div");
			stat.appendChild(document.createTextNode("Round 1 - 5:00"));
			parent.appendChild(stat);
		}
		{
			let bar = document.createElement("div");
			bar.className = "iconbar";
			parent.appendChild(bar);
			let optParent = document.createElement("div");
			parent.appendChild(optParent);
			for (let i = 0; i < game.aerials[whoami].length; i++) {
				let aerial = game.aerials[whoami][i];
				let img = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				img.setAttribute("viewBox", "0 0 1 1");
				let portraitimg = document.createElementNS("http://www.w3.org/2000/svg", "image");
				portraitimg.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "assets/portraits/" + aerial.portrait);
				portraitimg.setAttribute("width", 1);
				portraitimg.setAttribute("height", 1);
				img.appendChild(portraitimg)
				bar.appendChild(img);
				this.optionsActors.push(new OptionsActor(aerial, game, fieldActor, actionCommitter, optParent));
				let othis = this;
				img.addEventListener("click", () => {
					for (let e of bar.querySelectorAll("svg")) e.setAttribute("class", "");
					img.setAttribute("class", "active");
					for (let j = 0; j < othis.optionsActors.length; j++) {
						let e = othis.optionsActors[j];
						if (i == j) e.show();
						else e.hide();
					}
				});
			}
		}
	}

	update() {
		for (let a of this.optionsActors) a.update();
	}
}

class OptionsActor {
	// aerial
	// game
	// fieldActor
	// g
	// optionsBlock
	// actionCommitter

	// TODO: Describe abilities (and injury status)

	constructor(aerial, game, fieldActor, actionCommitter, parent) {
		this.aerial = aerial;
		this.game = game;
		this.fieldActor = fieldActor;
		this.actionCommitter = actionCommitter;
		this.g = document.createElement("div");
		this.g.style.display = "none";
		parent.appendChild(this.g);
		this.g.appendChild(document.createTextNode(aerial.name));
		this.optionsBlock = document.createElement("div");
		this.optionsBlock.setAttribute("class", "optionsblock");
		this.g.appendChild(this.optionsBlock);
		this.update(game);
	}

	hide() {
		this.g.style.display = "none";
	}

	show() {
		this.g.style.display = "block";
	}

	update() {
		this.optionsBlock.innerHTML = "";

		const makeButton = (label, consequence, action) => {
			let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "-.55 -.55 1.1 1.1")
			let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			c.setAttribute("r", 0.5);
			c.setAttribute("class", "action");
			svg.appendChild(c);
			this.optionsBlock.appendChild(svg);
			c.style.cursor = "pointer";
			let fieldActor = this.fieldActor;
			c.addEventListener("mouseout", () => fieldActor.clearOverrides());
			c.addEventListener("mouseover", () => fieldActor.setOverrides(consequence.field));
			c.addEventListener("click", () => this.actionCommitter(action));
			let t = document.createElementNS("http://www.w3.org/2000/svg", "text");
			t.appendChild(document.createTextNode(label));
			t.style.textAnchor = "middle";
			t.style.dominantBaseline = "middle";
			t.style.pointerEvents = "none";
			t.style.fontSize = "0.3px";
			svg.appendChild(t);
		}

		for (let s of this.aerial.skills) {
			let options = Skill.SKILLS[s](this.aerial, this.game);
			for (let i = 0; i < options.length; i++) {
				let consequence = this.game.clone();
				Skill.SKILLS[s](consequence.field.aerials[this.game.field.aerials.indexOf(this.aerial)], consequence)[i](); // Apply the skill use to the consequence.
				makeButton(s, consequence, {"revision": this.game.revision, "aerial": this.game.field.aerials.indexOf(this.aerial), "skill": s, "option": i});
			}
		}
		if (this.aerial.velocityRemaining[0] != 0 || this.aerial.velocityRemaining[1] != 0) {
			let consequence = this.game.clone();
			consequence.field.aerials[this.game.field.aerials.indexOf(this.aerial)].moveStep(consequence.field.collisionTester.bind(consequence.field));
			makeButton("move", consequence, {"revision": this.game.revision, "aerial": this.game.field.aerials.indexOf(this.aerial), "move": true});
		}
	}
}

class FieldActor {
	// field
	// parent
	// cellActors[][]
	// obstacleActors[]
	// aerialActors[]

	constructor(field, parent) {
		this.field = field;
		this.parent = parent;
		parent.setAttribute("viewBox", "0 0 " + field.width + " " + field.height);
		this.cellActors = [];
		let cellGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		parent.appendChild(cellGroup);
		for (let i = 0; i < field.width; i++) {
			this.cellActors.push([]);
			for (let j = 0; j < field.height; j++) {
				this.cellActors[i].push(new CellActor(field.cells[i][j], (i, j) => this.getCellActor(i, j), [i, j], field.width, field.height, cellGroup));
			}
		}
		for (let a of this.cellActors) for (let c of a) c.recolor(CellActor.colorMana);
		let obsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		parent.appendChild(obsGroup);
		this.obstacleActors = [];
		for (let o of field.obstacles) this.obstacleActors.push(new ObstacleActor(o, this.field, obsGroup));
		let aerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		parent.appendChild(aerGroup);
		this.aerialActors = [];
		for (let o of field.aerials) this.aerialActors.push(new AerialActor(o, this.field, aerGroup));
	}

	clearOverrides() {
		for (let a of this.aerialActors) {
			a.override = undefined;
			a.update();
		}
	}

	setOverrides(field) {
		for (let i = 0; i < field.aerials.length; i++) {
			this.aerialActors[i].override = field.aerials[i];
			this.aerialActors[i].update();
		}
	}

	getCellActor(i, j) { return this.cellActors[i][j]; }

	update() {
		this.clearOverrides();
		for (let a of this.aerialActors) a.update();
	}
}

class CellActor {
	// cell
	// getCellActor
	// fieldHeight
	// parent
	// rsurfaces[2] // [center, corner]
	// color
	// label
	// position

	constructor(cell, getCellActor, position, fieldWidth, fieldHeight, parent) {
		this.cell = cell;
		this.getCellActor = getCellActor;
		this.position = position;
		this.parent = parent;
		this.fieldHeight = fieldHeight;
		this.fieldWidth = fieldWidth;
		this.rsurfaces = [];
		for (let i = 0; i < 5; i++) this.rsurfaces.push(document.createElementNS("http://www.w3.org/2000/svg", "path"));
		let x = p => RenderUtil.translatePoints(p, position[0], fieldHeight - position[1] - 1);
		this.rsurfaces[0].setAttribute("d", RenderUtil.pointsToPath(x([[0, 0], [1.02, 0], [1.02, 1.02], [0, 1.02]])));
		this.rsurfaces[1].setAttribute("d", RenderUtil.pointsToPath(x([[0, .67], [.33, 1.02], [0, 1.33], [-.33, 1.02]])));
		for (let rsurface of this.rsurfaces) parent.appendChild(rsurface);
	}

	recolor(f) {
		let i = this.position[0];
		let j = this.position[1];
		let c = f(this.cell);
		let cl = i == 0 ? c : f(this.getCellActor(i - 1, j).cell);
		let cb = j == 0 ? f(new Cell(true, 0, false)) : f(this.getCellActor(i, j - 1).cell);
		let clb = i == 0 || j == 0 ? f(new Cell(true, 0, false)) : f(this.getCellActor(i - 1, j - 1).cell);

		this.rsurfaces[0].style.fill = c;
		this.rsurfaces[1].style.fill = "rgba(0, 0, 0, 0)";
		if (cl == cb && c != clb) this.rsurfaces[1].style.fill = cl;
		if (cl != cb && c == clb) this.rsurfaces[1].style.fill = c;
	}

	static colorMana(cell) {
		if (cell.ground) return "#000";
		if (cell.mana >= 4) return "#77f";
		if (cell.mana >= 3) return "#99f";
		if (cell.mana >= 2) return "#aaf";
		if (cell.mana >= 1) return "#ccf";
		return "#fff8f8";
	}
}

class ObstacleActor {
	// obstacle
	// field
	// g

	constructor(obstacle, field, parent) {
		this.obstacle = obstacle;
		this.field = field;
		this.g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		parent.appendChild(this.g);
		this.g.style.transform = RenderUtil.posToTransform(this.obstacle.position, this.field);
		let obj = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		obj.setAttribute("cx", 0.5);
		obj.setAttribute("cy", 0.5);
		obj.setAttribute("r", 0.45);
		obj.style.fill = "#000";
		this.g.appendChild(obj);
		// TODO: handle obstacles of different shapes and sizes.
	}
}

class AerialActor {
	// aerial
	// override
	// field
	// g
	// motionDest[]
	// motionDestLine[]
	// breathPips[]
	// skillCountPips[]
	// motionPlacer

	// TODO: injury pips.
	// TODO: mana/skillCount pips?

	constructor(aerial, field, parent) {
		this.aerial = aerial;
		this.field = field;
		this.g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		parent.appendChild(this.g);
		this.g.style.transform = RenderUtil.posToTransform(this.aerial.position, this.field);
		this.g.style.transition = "0.3s";
		this.motionDest = [];
		this.motionDestLine = [];
		{
			this.motionDestLine.push(document.createElementNS("http://www.w3.org/2000/svg", "path"));
			this.motionDestLine[0].style.transition = "0.3s";
			this.motionDestLine[0].style.fill = "none";
			this.motionDestLine[0].style.stroke = this.aerial.team.color2;
			this.motionDestLine[0].style.strokeWidth = 0.022
			this.g.appendChild(this.motionDestLine[0]);
		}
		{
			this.motionDestLine.push(document.createElementNS("http://www.w3.org/2000/svg", "path"));
			this.motionDestLine[1].style.transition = "0.3s";
			this.motionDestLine[1].style.fill = "none";
			this.motionDestLine[1].style.stroke = this.aerial.team.color2;
			this.motionDestLine[1].style.strokeWidth = 0.022
			this.g.appendChild(this.motionDestLine[1]);
		}
		{
			this.motionDest.push(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
			this.motionDest[0].setAttribute("cx", 0.5);
			this.motionDest[0].setAttribute("cy", 0.5);
			this.motionDest[0].setAttribute("r", 0.1);
			this.motionDest[0].style.transition = "transform 0.3s";
			this.motionDest[0].style.fill = this.aerial.team.color1;
			this.motionDest[0].style.stroke = this.aerial.team.color2;
			this.motionDest[0].style.strokeWidth = 0.02;
			this.g.appendChild(this.motionDest[0]);
		}
		{
			this.motionDest.push(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
			this.motionDest[1].setAttribute("cx", 0.5);
			this.motionDest[1].setAttribute("cy", 0.5);
			this.motionDest[1].setAttribute("r", 0.1);
			this.motionDest[1].style.transition = "transform 0.3s";
			this.motionDest[1].style.fill = this.aerial.team.color1;
			this.motionDest[1].style.stroke = this.aerial.team.color2;
			this.motionDest[1].style.strokeWidth = 0.02;
			this.g.appendChild(this.motionDest[1]);
		}
		{
			let portraitimg = document.createElementNS("http://www.w3.org/2000/svg", "image");
			portraitimg.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "assets/portraits/" + this.aerial.portrait);
			portraitimg.setAttribute("clip-path", "circle()");
			portraitimg.setAttribute("width", 0.95);
			portraitimg.setAttribute("height", 0.95);
			portraitimg.setAttribute("x", 0.025);
			portraitimg.setAttribute("y", 0.025);
			this.g.appendChild(portraitimg)
		}
		{
			this.motionPlacer = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			this.motionPlacer.setAttribute("cx", 0.5);
			this.motionPlacer.setAttribute("cy", 0.5);
			this.motionPlacer.setAttribute("r", 0.475);
			this.motionPlacer.style.fill = "none";
			this.motionPlacer.style.strokeWidth = 0.04;
			this.motionPlacer.style.strokeDasharray = "0.1 0.1";
			this.g.appendChild(this.motionPlacer);
		}
		let makePip = (shape, angle, fill, stroke) => {
			let pip = document.createElementNS("http://www.w3.org/2000/svg", "path");
			pip.setAttribute("d", shape);
			pip.dataset.baseTransform = "translate(.5px, .5px) scale(%S) rotate(" + angle + "rad) translate(-.5px, -.5px)";
			pip.style.transform = pip.dataset.baseTransform.replace("%S", 1);
			pip.style.transition = "transform 0.3s";
			pip.style.fill=fill;
			pip.style.stroke=stroke;
			pip.style.strokeWidth=0.01;
			this.g.appendChild(pip);
			return pip;
		}
		this.breathPips = [];
		this.skillCountPips = [];
		this.injuryPips = [];
		{
			let startAngle = Math.PI / 8;
			let stepAngle = Math.PI / 4 / 10 * 3;
			let op = [Math.sin(stepAngle) * .5 + .5, (1 - Math.cos(stepAngle) * .5 - .5)];
			let ip = [Math.sin(stepAngle) * .3 + .5, (1 - Math.cos(stepAngle) * .3 - .5)];
			for (let i = 0; i < 10; i++) this.breathPips.push(makePip("M.5 .2V0A.5 .5 0 0 1 " + op[0] + " " + op[1] + "L" + ip[0] + " " + ip[1] + "A.3 .3 0 0 0 .5 .2Z", startAngle + stepAngle * i, "#eee", "#444"));
			startAngle = startAngle + stepAngle * 11;
			stepAngle *= 1.5;
			op = [Math.sin(stepAngle) * .5 + .5, (1 - Math.cos(stepAngle) * .5 - .5)];
			ip = [Math.sin(stepAngle) * .3 + .5, (1 - Math.cos(stepAngle) * .3 - .5)];
			for (let i = 0; i < 4; i++) this.skillCountPips.push(makePip("M.5 .2V0A.5 .5 0 0 1 " + op[0] + " " + op[1] + "L" + ip[0] + " " + ip[1] + "A.3 .3 0 0 0 .5 .2Z", startAngle + stepAngle * i, "#66e", "#000"));
			startAngle = Math.PI / 8 - stepAngle;
			stepAngle /= -1.5;
			op = [Math.sin(stepAngle) * .5 + .5, (1 - Math.cos(stepAngle) * .5 - .5)];
			ip = [Math.sin(stepAngle / 2) * .3 + .5, (1 - Math.cos(stepAngle / 2) * .3 - .5)];
			for (let i = 0; i < 8; i++) this.injuryPips.push(makePip("M.5 .2V0A.5 .5 0 0 1 " + op[0] + " " + op[1] + "L" + ip[0] + " " + ip[1] + "Z", startAngle + stepAngle * i, "#a20", "#000"));
		}
		this.update();
	}

	update() {
		let a = this.override != undefined ? this.override : this.aerial;
		this.g.style.transform = RenderUtil.posToTransform(this.aerial.position, this.field);
		let dp = [a.position[0] - this.aerial.position[0], a.position[1] - this.aerial.position[1]];
		this.motionDest[0].style.transform = "translate(" + (dp[0] + a.velocityRemaining[0]) + "px, " + -(dp[1] + a.velocityRemaining[1]) + "px)";
		this.motionDest[1].style.transform = "translate(" + (dp[0] + a.velocityRemaining[0] + a.velocity[0]) + "px, " + (-dp[1] - a.velocityRemaining[1] - a.velocity[1] + 1) + "px)";
		this.motionDestLine[0].setAttribute("d", "M" + (a.fractionalPosition[0] - this.aerial.position[0]) + " " + (1 - (a.fractionalPosition[1] - this.aerial.position[1])) + "L" + (dp[0] + a.velocityRemaining[0] + .5) + " " + (1 - (dp[1] + a.velocityRemaining[1] + .5)));
		this.motionDestLine[1].setAttribute("d", "M.5 .5m" + (dp[0] + a.velocityRemaining[0]) + " " + -(dp[1] + a.velocityRemaining[1]) + "l" + a.velocity[0] + " " + (-a.velocity[1] + 1));
		{ // Motion placer
			if (dp[0] != 0 || dp[1] != 0) {
				this.motionPlacer.style.stroke = "#000";
				this.motionPlacer.style.transform = "translate(" + dp[0] + "px," + -dp[1] + "px)";
			} else {
				this.motionPlacer.style.stroke = "none";
			}
		}
		{ // Breath pips
			for (let i = 0; i < this.breathPips.length; i++) {
				let scale = 0;
				if (a.breath > i && this.aerial.breath > i) scale = 1;
				else if (a.breath > i || this.aerial.breath > i) scale = 0.67;
				this.breathPips[i].style.transform = this.breathPips[i].dataset.baseTransform.replace("%S", scale);
			}
		}
		{ // Skill pips
			for (let i = 0; i < this.skillCountPips.length; i++) {
				let aCapacity = this.field.getCell(a.position).mana;
				let aerialCapacity = this.field.getCell(this.aerial.position).mana;

				let scale = 0;
				if (aCapacity > i && aerialCapacity > i) scale = 1;
				else if (aCapacity > i || aerialCapacity > i) scale = 0.67;
				this.skillCountPips[i].style.transform = this.skillCountPips[i].dataset.baseTransform.replace("%S", scale);

				let fill = "#ccf";
				if (a.skillCount > i && this.aerial.skillCount > i) fill = "#44f";
				else if (a.skillCount > i || this.aerial.skillCount > i) fill = "#88f";
				this.skillCountPips[i].style.fill = fill;
			}
		}
		{ // Injury pips
			for (let i = 0; i < this.injuryPips.length; i++) {
				let aInjuries = 0;
				let aerialInjuries = 0;
				for (let i = 0; i < a.injuries.length; i++) if (a.injuries[i]) aInjuries++;
				for (let i = 0; i < this.aerial.injuries.length; i++) if (this.aerial.injuries[i]) aerialInjuries++;
				let scale = 0;
				if (aInjuries > i && aerialInjuries > i) scale = 1;
				else if (aInjuries > i || aerialInjuries > i) scale = 1.3;
				this.injuryPips[i].style.transform = this.injuryPips[i].dataset.baseTransform.replace("%S", scale);
			}
		}

	}
}
