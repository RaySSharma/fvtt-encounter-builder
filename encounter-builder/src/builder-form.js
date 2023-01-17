let EB = {};
EB.xpThresholds = {
    "easy": [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
    "medium": [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
    "hard": [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
    "deadly": [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
};
EB.CRtoXP = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000

};
EB.encounterMultipliers = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
EB.encounterMultiByNbMonsters = [0.5, 1.0, 1.5, 2.0, 2.0, 2.0, 2.0, 2.5, 2.5, 2.5, 2.5, 3.0, 3.0, 3.0, 3.0, 4.0, 5.0];
EB.dailyXPBudget = [300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500, 15000, 18000, 20000, 25000, 27000, 30000, 40000];
EB.difficultyToTreatPC = "deadly";

EB.borderStyle = "2px solid rgb(120, 46, 34)";
EB.highlightStyle = "";

Handlebars.registerHelper("capitalizeAll", function (str) {
    return str.toUpperCase();
});

class EncounterBuilderApplication extends Application {
    constructor(Actors, options = {}) {
        super(options);

        if (!game.user.isGM) return;

        this.object = Actors
        this.allies = [];
        this.opponents = [];
        this.allyRating = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "deadly": 0
        };
        this.totalXP = 0;
        this.perAllyXP = 0;
        this.dailyXP = 0;
        this.combatDifficulty = "trivial";
        game.users.apps.push(this)
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = game.i18n.localize("EB.Title");
        options.id = game.i18n.localize("EB.id");
        options.template = "modules/encounter-builder/templates/builder-app.html";
        options.closeOnSubmit = true;
        options.popOut = true;
        options.width = 510;
        options.height = "auto";
        options.classes = ["encounter-builder", "builder-form"];
        return options;
    }

    async getData() {
        return {
            allies: this.allies,
            opponents: this.opponents,
            ratings: this.allyRating,
            allyxp: this.perAllyXP,
            totalxp: this.totalXP,
            dailyxp: this.dailyXP,
            difficulty: this.combatDifficulty
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find("#EBContainers .actor-container").each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", this._onDragStart, false);
            li.addEventListener("click", this._onClickPortrait.bind(this));
        });
        html.find("#EBContainers .group-container").each((i, li) => {
            li.addEventListener("dragover", this._onDragOverHighlight);
            li.addEventListener("dragleave", this._onDragLeaveHighlight);
        })
        html.find("#EBContainers .ally-container")[0].addEventListener("drop", this._onDropAlly.bind(this));
        html.find("#EBContainers .opponent-container")[0].addEventListener("drop", this._onDropOpponent.bind(this));
        html.find("#EBXP .clear")[0].addEventListener("click", this._onClickButton);
        html[0].render = this.render;
        html[0].ondragover = this._onDragOver;
        html[0].ondrop = this._onDrop;
    }

    /**
     * Calculates XP thresholds for the PC characters, as well as the thresholds for monster/NPC combatants.
     *
     * @memberof EncounterBuilderApplication
     */
    calcXPThresholds() {
        let allyRating = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "deadly": 0
        };
        let totalXP = 0;
        let dailyXP = 0;

        this.allies.forEach(function (ally, index) {

            let level;
            if (ally.type === "character") {
                level = parseInt(ally.system.details.level);
                if (level === 0) {
                    level = 1;
                }
            }
            else if (ally.type === "npc") {
                let xp = EB.CRtoXP[ally.system.details.cr];
                level = EB.xpThresholds.deadly.findIndex(e => e >= xp)
                if (level < 0) {
                    level = 19;
                }
                level += 1
            }
            allyRating["easy"] += EB.xpThresholds.easy[level - 1];
            allyRating["medium"] += EB.xpThresholds.medium[level - 1];
            allyRating["hard"] += EB.xpThresholds.hard[level - 1];
            allyRating["deadly"] += EB.xpThresholds.deadly[level - 1];
            dailyXP += EB.dailyXPBudget[level - 1];
        });
        this.opponents.forEach(function (opponent, index) {
            let xp;
            if (opponent.type === "character") {
                let level = opponent.system.details.level
                if (level === 0) {
                    level = 1;
                }
                xp = EB.xpThresholds[EB.difficultyToTreatPC][level - 1]
            }
            else if (opponent.type === "npc") {
                xp = opponent.system.details.xp.value;
            }
            totalXP += xp;
        });

        let multiplier = 0;
        const numOpponents = this.opponents.length;
        const numAllies = this.allies.length
        if (numAllies < 3) {
            if (numOpponents > 15) {
                multiplier = 5.0;
            }
            else if (numOpponents > 0) {
                multiplier = EB.encounterMultiByNbMonsters[this.opponents.length + 1];
            }
        }
        else if (numAllies > 5) {
            if (numOpponents > 15) {
                multiplier = 4.0;
            }
            else if (numOpponents > 0) {
                multiplier = EB.encounterMultiByNbMonsters[this.opponents.length];
                multiplier = EB.encounterMultipliers[EB.encounterMultipliers.findIndex(multi => multi === multiplier) - 1];
            }
        }
        else {
            if (numOpponents > 15) {
                multiplier = 4.0;
            }
            else if (numOpponents > 0) {
                multiplier = EB.encounterMultiByNbMonsters[this.opponents.length];
            }
        }

        this.allyRating = allyRating;
        this.totalXP = multiplier * totalXP;
        this.dailyXP = dailyXP;

        let perAllyXP = Math.floor(this.totalXP / this.allies.length)

        if (isFinite(perAllyXP)) {
            this.perAllyXP = perAllyXP;
        }
        else {
            this.perAllyXP = 0;
        }
    }

    /**
     * Calculates the final difficulty rating of the combat (easy, medium, hard, deadly)
     *
     * @memberof EncounterBuilderApplication
     */
    calcRating() {
        let allyRating = this.allyRating;
        let totalXP = this.totalXP;
        let combatDifficulty = "trivial";

        Object.keys(allyRating).forEach(function (key) {
            let threshold = allyRating[key]
            if (totalXP > threshold) {
                combatDifficulty = key;
            }
        });

        this.combatDifficulty = combatDifficulty;
    }

    /**
     * Ondrop template for ally and opponent fields. Attempts to return builder Application and Actor of interest.
     *
     * @param {*} event
     * @returns {Array}
     * @memberof EncounterBuilderApplication
     */
    async _onDropGeneral(event) {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const actors = []

        function recur_folder(folder) {
            const actors = folder.contents
            const subfolders = folder.getSubfolders()
            for (let i = 0; i < subfolders.length; i++) {
                actors.push(...recur_folder(subfolders[i]))
            }

            return actors
        }
        if (data.type === game.folders.documentName && data.documentName === game.actors.documentName) {
            const folder = await Folder.fromDropData(data)
            actors.push(...recur_folder(folder))
        }
        else if (data.type === game.actors.documentName) {
            const actor = await Actor.fromDropData(data);
            actors.push(actor)
        }

        else {
                throw new Error(game.i18n.localize("EB.EntityError"));
        }

        const app = game.users.apps.find(e => e.id === game.i18n.localize("EB.id"));
        return [app, actors]
    }

    /**
     * Ondrop for allies. Cannot have a playable character multiple times. Can have monsters/npcs multiple times.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    async _onDropAlly(event) {
        event.preventDefault();
        let [app, actors] = await this._onDropGeneral(event);
        await this.processDrop(event, app.allies, app.opponents, app, actors)
    }


    /**
     * Ondrop for opponents. Cannot have a playable character multiple times. Can have monsters/npcs multiple times.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    async _onDropOpponent(event) {
        event.preventDefault();
        let [app, actors] = await this._onDropGeneral(event);
        await this.processDrop(event, app.opponents, app.allies, app, actors)
    }

    async processDrop(event, currentDropZone, opposingDropZone, app, actors) {

        let actorExists;
        let actorExistsOpposing;
        actors.forEach(function (actor) {
            if (actor.type === "character") {
                actorExists = currentDropZone.find(e => e.id === actor.id)
                actorExistsOpposing = opposingDropZone.find(e => e.id === actor.id);

                if (actorExistsOpposing) {
                    let ix = opposingDropZone.findIndex(e => e.id === actor.id);
                    opposingDropZone.splice(ix, 1);
                }
                if (!actorExists) {
                    currentDropZone.push(actor)
                }
            }
            else if (actor.type === "npc") {
                currentDropZone.push(actor);
            }
        })

        app.calcXPThresholds();
        app.calcRating();
        app.render();
    }

    _onDragOverHighlight(event) {
        const li = this;
        li.style["border"] = EB.borderStyle;
        li.style["background"] = EB.highlightStyle;
    }

    _onDragLeaveHighlight(event) {
        const li = this;
        li.style["border"] = "";
        li.style["background"] = "";
    }

    /**
     * Ondragstart for character portraits, sets data necessary to drag to canvas.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    _onDragStart(event) {
        event.stopPropagation();
        const id = this.firstElementChild.id
        const actor = game.actors.get(id)

        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: game.actors.documentName,
            uuid: actor.uuid
        }));
    }

    /**
     * Remove actor from calculation on clicking the portrait.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    _onClickPortrait(event) {
        event.stopPropagation();

        const srcClass = event.srcElement.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const app = game.users.apps.find(e => e.id === game.i18n.localize("EB.id"));
            let name = event.srcElement.title;
            let actorExists;

            const parentClass = event.srcElement.parentElement.parentElement.classList.value;
            const parentParentClass = event.srcElement.parentElement.parentElement.parentElement.classList.value;
            if ((parentClass === "group-field ally-field") || (parentParentClass === "group-field ally-field")) {
                let actorExists = this.allies.find(e => e.name === name);
                if (actorExists) {
                    let ix = this.allies.findIndex(e => e.name === name);
                    this.allies.splice(ix, 1);
                }
            }
            else if ((parentClass === "group-field opponent-field") || (parentParentClass === "group-field opponent-field")) {
                let actorExists = this.opponents.find(e => e.name === name);
                if (actorExists) {
                    let ix = this.opponents.findIndex(e => e.name === name);
                    this.opponents.splice(ix, 1);
                }
            }
            app.calcXPThresholds();
            app.calcRating();
            app.render();
        }
    }

    /**
     * Clears list of allies and opponents.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    _onClickButton(event) {
        event.stopPropagation();
        const app = game.users.apps.find(e => e.id === game.i18n.localize("EB.id"));
        app.allies = [];
        app.opponents = [];

        app.calcXPThresholds();
        app.calcRating();
        app.render();
    }

}
