class Skill {
	static TYPE_PREFLIGHT = 0;
	static TYPE_MIDFLIGHT = 1;
	static TYPE_REACTION = 2;
	static TYPE_PASSIVE = 3;

	// type
	// name
	// choiceGenerator
	constructor(type, name, description, choiceGenerator) {
		this.type = type;
		this.name = name;
		this.description = description;
		this.choiceGenerator = choiceGenerator;
	}

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
	static SKILL_SINKING_THROW = "sinking throw";

	static SKILL_ENDURANCE = "endurance";

	static SKILLS = {};
}

{
	// A skill is implemented as a function of (aerial-doing-the-skill, game-state) to an array of
	// functions. Each element in the array represents a possible legal use of that skill, and the
	// function, if called, will transform the game state by taking the action. These skills are
	// built up through partial application.
	function common(aerial, game, manaReq, breathReq, effect) {
		let mana = game.field.getCell(aerial.position).mana;
		if (aerial.breath < breathReq || mana <= aerial.skillCount || mana < manaReq) return [];
		return and(effect, [() => { aerial.breath -= breathReq; aerial.skillCount++; }]);
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

	function allAdjacentAndSelf(who, game, inner) {
		let adjs = game.field.getAerialsAdjacentTo(who.position);
		return inner.map(i => {
			let fs = [];
			for (let a of adjs) fs.push(i.bind(null, a));
			fs.push(i.bind(null, who));
			return () => { for (let f of fs) f(); };
		});
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
			who => who.addMotion([-1, 0]),
			who => who.addMotion([1, 0]),
		];
	}

	// These two take the subject as well, and don't support or need a subject binder.
	function oppositeVerticalPlusHorizontals(amtV, amountH, a) {
		if (a.velocity[1] == 0) return [];
		return [
			() => a.addMotion([amountH, amountV * -Math.sign(a.velocity[1])]),
			() => a.addMotion([-amountH, amountV * -Math.sign(a.velocity[1])]),
		];
	}
	
	function oppositeHorizontalPlusVertical(amtV, amountH, a) {
		if (a.velocity[0] == 0) return [];
		return [
			() => a.addMotion([amountH * -Math.sign(a.velocity[0]), amountV]),
			() => a.addMotion([amountH * -Math.sign(a.velocity[0]), -amountV]),
		];
	}

	// Preflight skills.
	Skill.SKILLS[Skill.SKILL_LIFT] = (a, g) => common(a, g, 2, 1, aerial(a, up(1)));
	Skill.SKILLS[Skill.SKILL_DROP] = (a, g) => common(a, g, 1, 1, aerial(a, down(1)));
	Skill.SKILLS[Skill.SKILL_FLY] = (a, g) => common(a, g, 1, 1, aerial(a, horizontals(1)));

	Skill.SKILLS[Skill.SKILL_GLIDE] = (a, g) => common(a, g, 1, 1, aerial(a, up(1)));
	Skill.SKILLS[Skill.SKILL_SOAR] = (a, g) => common(a, g, 3, 2, aerial(a, up(2)));
	Skill.SKILLS[Skill.SKILL_SPRINT] = (a, g) => common(a, g, 3, 2, aerial(a, horizontals(2)));
	Skill.SKILLS[Skill.SKILL_DIVE] = (a, g) => common(a, g, 2, 2, aerial(a, down(2)));

	Skill.SKILLS[Skill.SKILL_GROUP_LIFT] = (a, g) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, up(1)));
	Skill.SKILLS[Skill.SKILL_GROUP_FLY] = (a, g) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, horizontals(1)));
	Skill.SKILLS[Skill.SKILL_GROUP_DROP] = (a, g) => common(a, g, 3, 2, allAdjacentAndSelf(a, g, drop(1)));

	Skill.SKILLS[Skill.SKILL_LEVEL] = (a, g) => common(a, g, 1, 1, oppositeVerticalPlusHorizontal(1, 1, a));
	Skill.SKILLS[Skill.SKILL_STEEPEN] = (a, g) => common(a, g, 1, 1, oppositeHorizontalPlusVertical(1, 1, a));

	// Midflight skills.
	Skill.SKILLS[Skill.SKILL_BOOST] = (a, g) => common(a, g, 2, 1, adjacentAerial(a, g, up(2)));
	Skill.SKILLS[Skill.SKILL_SINKING_THROW] = (a, g) => common(a, g, 2, 1, and(adjacentAerial(a, g, down(1)), aerial(a, up(1))));

	// Reaction skills.

	// Passive skills.
	//Skill.SKILL_ENDURANCE: new Skill(Skill.TYPE_PASSIVE, "Endurance"),
}
