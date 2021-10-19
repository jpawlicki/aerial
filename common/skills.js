class Skill {
	static TYPE_PREFLIGHT = 0;
	static TYPE_MIDFLIGHT = 1;
	static TYPE_REACTION = 2;
	static TYPE_PASSIVE = 3;

	static SKILL_LIFT = "lift";
	static SKILL_DROP = "drop";
	static SKILL_FLY = "fly";
	static SKILL_GLIDE = "glide";
	static SKILL_SOAR = "soar";
	static SKILL_SPRINT = "sprint";
	static SKILL_DIVE = "dive";
	static SKILL_GROUP_LIFT = "group lift";
	static SKILL_GROUP_FLY = "group fly";
	static SKILL_GROUP_DROP = "group drop";
	static SKILL_LEVEL = "level";
	static SKILL_STEEPEN = "steepen";
	static SKILL_BOOST = "boost";
	static SKILL_THROW = "throw";
	static SKILL_CHOKE = "choke";
	static SKILL_STRIKE = "strike";
	static SKILL_SWITCH = "switch";
	static SKILL_DOWNDRAFT = "downdraft";
	static SKILL_SIDEDRAFT = "sidedraft";
	static SKILL_UPDRAFT = "updraft";

	static SKILL_ENDURANCE = "endurance";
	static SKILL_TOUGH = "tough";
	static SKILL_SNEAKY = "sneaky";
	static SKILL_MANA_FLOW = "mana flow";
	static SKILL_SKYDIVER = "skydiver";
	static SKILL_GROUND_EFFECT = "ground effect";
	static SKILL_WICKED = "wicked";
	static SKILL_WINDING = "winding";
	static SKILL_IMPLACABLE = "implacable";

	static SKILLS = {};
}

{
	// A skill is implemented as a function of (aerial-doing-the-skill, game-state) to an array of
	// functions. Each element in the array represents a possible legal use of that skill, and the
	// function, if called, will transform the game state by taking the action. These skills are
	// built up through partial application.
	function common(aerial, game, manaReq, breathReq, effect) {
		let mana = game.field.getCell(aerial.position).mana;
		if (aerial.hasSkill(Skill.SKILL_MANA_FLOW)) mana++;
		if (aerial.breath < breathReq || mana <= aerial.skillCount || mana < manaReq) return [];
		return and(effect, [() => { aerial.breath -= breathReq; aerial.skillCount++; }]);
	}

	function midflight(aerial, inner) {
		if (aerial.phase != Aerial.PHASE_MIDFLIGHT) return [];
		return inner;
	}

	function passive() {
		return [];
	}

	// Cross product.
	function and(effect1, effect2) {
		return effect1.flatMap(e1 => effect2.map(e2 => () => { e1(); e2(); }));
	}


	// The following functions bind effects to subjects.
	function aerial(aerial, inner) {
		return inner.map(i => i.bind(null, aerial));
	}

	function adjacentAerial(who, game, inner) {
		let adjs = game.field.getAerialsAdjacentTo(who.position);
		return inner.flatMap(i => adjs.map(a => i.bind(null, a)));
	}

	function sameAltitudeAerial(who, game, inner) {
		let aerials = game.field.aerials.filter(a => a != who && a.position[1] == who.position[1]);
		return inner.flatMap(i => aerials.map(a => i.bind(null, a)));
	}

	function allAdjacentAndSelf(who, game, inner) {
		let adjs = game.field.getAerialsAdjacentTo(who.position);
		return inner.map(i => {
			let fs = [];
			for (let a of adjs) fs.push(i.bind(null, a));
			fs.push(i.bind(null, who));
			return () => { for (let f of fs) f(); };
		});
	}

	function penaltyRisk(who, game, randomizer) {
		let minDist = Number.POSITIVE_INFINITY;
		for (let loc of game.field.obstacles.filter(o => o.referee).flatMap(r => r.occupiedPositions())) {
			let dist = who.distanceTo(loc);
			if (dist < minDist) minDist = dist;
		}
		if (minDist == Number.POSITIVE_INFINITY) return [() => {}];
		let diceCount = Math.ceiling(minDist);
		if (who.hasSkill(Skill.SKILL_SNEAKY)) diceCount += 3;
		for (let i = 0; i < diceCount; i++) if (randomizer() * 6 < 1) return [() => {}];
		return [() => who.penalty()];
	}

	// The following functions are basic effects.
	function up(amt) {
		return [who => who.addMotion([0, amt])];
	}

	function down(amt) {
		return [who => who.addMotion([0, -amt])];
	}

	function horizontals(amt) {
		return [
			who => who.addMotion([-amt, 0]),
			who => who.addMotion([amt, 0]),
		];
	}

	// These two take the subject as well, and don't support or need a subject binder.
	function oppositeVerticalPlusHorizontal(amountV, amountH, a) {
		if (a.velocity[1] == 0) return [];
		return [
			() => a.addMotion([amountH, amountV * -Math.sign(a.velocity[1])]),
			() => a.addMotion([-amountH, amountV * -Math.sign(a.velocity[1])]),
		];
	}
	
	function oppositeHorizontalPlusVertical(amountV, amountH, a) {
		if (a.velocity[0] == 0) return [];
		return [
			() => a.addMotion([amountH * -Math.sign(a.velocity[0]), amountV]),
			() => a.addMotion([amountH * -Math.sign(a.velocity[0]), -amountV]),
		];
	}

	function setBreath(amt) {
		return [who => who.breath = amt];
	}

	function injure(amt, r) {
		return [who => who.addInjury(amt, r)];
	}

	function swapLocation(a) {
		return [who => { let tmp = a.position; a.changePosition(who.position); who.changePosition(tmp); }];
	}

	// Preflight skills.
	Skill.SKILLS[Skill.SKILL_LIFT] = (a, g, r) => common(a, g, 2, 1, aerial(a, up(1)));
	Skill.SKILLS[Skill.SKILL_DROP] = (a, g, r) => common(a, g, 1, 1, aerial(a, down(1)));
	Skill.SKILLS[Skill.SKILL_FLY] = (a, g, r) => common(a, g, 1, 1, aerial(a, horizontals(1)));
	Skill.SKILLS[Skill.SKILL_GLIDE] = (a, g, r) => common(a, g, 1, 1, aerial(a, up(1)));
	Skill.SKILLS[Skill.SKILL_SOAR] = (a, g, r) => common(a, g, 3, 2, aerial(a, up(2)));
	Skill.SKILLS[Skill.SKILL_SPRINT] = (a, g, r) => common(a, g, 3, 2, aerial(a, horizontals(2)));
	Skill.SKILLS[Skill.SKILL_DIVE] = (a, g, r) => common(a, g, 2, 2, aerial(a, down(2)));
	Skill.SKILLS[Skill.SKILL_GROUP_LIFT] = (a, g, r) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, up(1)));
	Skill.SKILLS[Skill.SKILL_GROUP_FLY] = (a, g, r) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, horizontals(1)));
	Skill.SKILLS[Skill.SKILL_GROUP_DROP] = (a, g, r) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, down(1)));
	Skill.SKILLS[Skill.SKILL_LEVEL] = (a, g, r) => common(a, g, 1, 1, oppositeVerticalPlusHorizontal(1, 1, a));
	Skill.SKILLS[Skill.SKILL_STEEPEN] = (a, g, r) => common(a, g, 1, 1, oppositeHorizontalPlusVertical(1, 1, a));

	// Midflight skills.
	Skill.SKILLS[Skill.SKILL_BOOST] = (a, g, r) => common(a, g, 2, 1, midflight(a, adjacentAerial(a, g, up(2))));
	Skill.SKILLS[Skill.SKILL_THROW] = (a, g, r) => common(a, g, 2, 1, midflight(a, and(adjacentAerial(a, g, down(1)), aerial(a, up(1)))));
	Skill.SKILLS[Skill.SKILL_CHOKE] = (a, g, r) => common(a, g, 0, 1, midflight(a, and(penaltyRisk(a, g, r), adjacentAerial(a, g, setBreath(1)))));
	Skill.SKILLS[Skill.SKILL_STRIKE] = (a, g, r) => common(a, g, 0, 1, midflight(a, and(penaltyRisk(a, g, r), adjacentAerial(a, g, injure(2, r)))));
	Skill.SKILLS[Skill.SKILL_SWITCH] = (a, g, r) => common(a, g, 0, 1, midflight(a, adjacentAerial(a, g, swapLocation(a))));
	Skill.SKILLS[Skill.SKILL_DOWNDRAFT] = (a, g, r) => common(a, g, 2, 2, midflight(a, sameAltitudeAerial(a, g, down(1))));
	Skill.SKILLS[Skill.SKILL_SIDEDRAFT] = (a, g, r) => common(a, g, 2, 2, midflight(a, sameAltitudeAerial(a, g, horizontals(1))));
	Skill.SKILLS[Skill.SKILL_UPDRAFT] = (a, g, r) => common(a, g, 2, 2, midflight(a, sameAltitudeAerial(a, g, up(1))));

	// Passive skills.
	Skill.SKILLS[Skill.SKILL_ENDURANCE] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_TOUGH] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_SNEAKY] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_MANA_FLOW] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_SKYDIVER] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_GROUND_EFFECT] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_WICKED] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_WINDING] = (a, g, r) => passive();
	Skill.SKILLS[Skill.SKILL_IMPLACABLE] = (a, g, r) => passive();
}
