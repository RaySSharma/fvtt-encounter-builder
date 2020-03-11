
CONFIG.xpThresholds = {
    "easy": [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
    "medium": [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
    "hard": [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
    "deadly": [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
};
CONFIG.encounterMultipliers = [0.5, 1.0, 1.5, 2.0, 2.0, 2.0, 2.0, 2.5, 2.5, 2.5, 2.5, 3.0, 3.0, 3.0, 3.0, 4.0, 5.0];
CONFIG.dailyXPBudget = [300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500, 15000, 18000, 20000, 25000, 27000, 30000, 40000]
CONFIG.icon = "fas fa-minus"

Handlebars.registerHelper("capitalizeAll", function (str) {
    return str.toUpperCase();
});

class EncounterBuilderApplication extends Application {
    constructor(Actors, options = {}) {
        super(options);

        if ( !game.user.isGM) return;

        this.object = Actors
        this.pc = [];
        this.npc = [];
        this.pcrating = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "deadly": 0
        };
        this.totalXP = 0;
        this.perPCXP = 0;
        this.dailyXP = 0;
        this.combatDifficulty = "trivial";
        game.users.apps.push(this)
    }

    /**
     * Calculates XP thresholds for the PC characters, as well as the thresholds for monster/NPC combatants.
     *
     * @memberof EncounterBuilderApplication
     */
    calcXPThresholds() {
        let pcrating = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "deadly": 0
        };
        let totalXP = 0;
        let dailyXP = 0;

        this.pc.forEach(function (pc, index) {
            let level = parseInt(pc.data.data.details.level);
            if (level == 0) {
                level = 1;
            }
            pcrating["easy"] += CONFIG.xpThresholds.easy[level - 1];
            pcrating["medium"] += CONFIG.xpThresholds.medium[level - 1];
            pcrating["hard"] += CONFIG.xpThresholds.hard[level - 1];
            pcrating["deadly"] += CONFIG.xpThresholds.deadly[level - 1];
            dailyXP += CONFIG.dailyXPBudget[level - 1];
        });
        this.npc.forEach(function (npc, index) {
            let xp = npc.data.data.details.xp.value;
            totalXP += xp;
        });

        let multiplier = 0;
        const numNPC = this.npc.length;
        if (this.pc.length < 3) {
            if (numNPC > 15) {
                multiplier = 5.0;
            }
            else if (numNPC > 0) {
                multiplier = CONFIG.encounterMultipliers[this.npc.length + 1];
            }
        }
        else if (this.pc.length > 5) {
            if (numNPC > 15) {
                multiplier = 4.0;
            }
            else if (numNPC > 0) {
                multiplier = CONFIG.encounterMultipliers[this.npc.length - 1];
            }
        }
        else {
            if (numNPC > 15) {
                multiplier = 4.0;
            }
            else if (numNPC > 0) {
                multiplier = CONFIG.encounterMultipliers[this.npc.length];
            }
        }
        this.pcrating = pcrating;
        this.totalXP = multiplier * totalXP;
        this.dailyXP = dailyXP;

        let perPCXP = Math.floor(this.totalXP / this.pc.length)
        if (isFinite(perPCXP)) {
            this.perPCXP = perPCXP;
        }
        else {
            this.perPCXP = 0;
        }
    }

    /**
     * Calculates the final difficulty rating of the combat (easy, medium, hard, deadly)
     *
     * @memberof EncounterBuilderApplication
     */
    calcRating() {
        let pcrating = this.pcrating;
        let totalXP = this.totalXP;
        let combatDifficulty = "trivial";

        Object.keys(pcrating).forEach(function (key) {
            let threshold = pcrating[key]
            if (totalXP > threshold) {
                combatDifficulty = key;
            }
        });

        this.combatDifficulty = combatDifficulty;
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
            pcs: this.pc,
            pcrating: this.pcrating,
            npcs: this.npc,
            perpcxp: this.perPCXP,
            totalxp: this.totalXP,
            dailyxp: this.dailyXP,
            difficulty: this.combatDifficulty,
            icon: CONFIG.icon
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.actor-container').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener('dragstart', this._onDragStart, false);
            li.addEventListener('click', this._onClickPortrait.bind(this));
        });
        html[0].render = this.render;
        html[0].ondragover = this._onDragOver;
        html[0].ondrop = this._onDrop;
    }

    /**
     * Ondrop for the application form itself, should update list of PCs or NPCs.
     *
     * @param {*} event
     * @returns {Promise}
     * @memberof EncounterBuilderApplication
     */
    async _onDrop(event) {
        event.preventDefault();
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
            if (data.type !== "Actor") {
                console.log(game.i18n.localize("EB.EntityError"));
                return false;
            }
        }
        catch (err) {
            return false;
        }
        const app = game.users.apps.find(b => b.id === game.i18n.localize("EB.id"));
        
        let actor;
        try {
            if ( data.pack ) actor = await game.actors.importFromCollection(data.pack, data.id)
            else actor = game.actors.get(data.id)
        }
        catch (err) {
            console.log(game.i18n.localize("EB.ImportError"));
            return false;
        }

        let pcExists = app.pc.find(b => b.id === actor.id)
        if ((actor.data.type === 'character') && !pcExists) {
            app.pc.push(actor);
        }
        else if (actor.data.type === 'npc') {
            app.npc.push(actor);
        }
        app.calcXPThresholds();
        app.calcRating();
        app.render();
    }

    _onDragOver(event) {
        event.preventDefault();
        return false;
    }

    _onDragStart(event) {  
        event.stopPropagation(); 
        const id = this.firstElementChild.id
        const name = this.firstElementChild.title

        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: game.actors.entity,
            id: id,
            name: name
        }));
    }

    _onDragEnd(event) {
        event.preventDefault();
        return false;
    }

    /**
     * Remove actor from calculation on clicking the portrait.
     *
     * @param {*} event
     * @memberof EncounterBuilderApplication
     */
    _onClickPortrait(event) {
        event.stopPropagation();
        const isPortrait = event.srcElement.classList.value === "actor-portrait"
        const isHoverImage = event.srcElement.classList.value === CONFIG.icon
        if ((isPortrait) || (isHoverImage)) {

            let name = event.srcElement.title

            let pcExists = this.pc.find(b => b.name === name);
            let npcExists = this.npc.find(b => b.name === name);

            if (pcExists) {
                let ix = this.pc.findIndex(b => b.name === name);
                this.pc.pop(ix);
            }
            if (npcExists) {
                let ix = this.npc.findIndex(b => b.name === name);
                this.npc.pop(ix);
            }

            const app = game.users.apps.find(b => b.id === game.i18n.localize("EB.id"));
            app.calcXPThresholds();
            app.calcRating();
            app.render();
        }
    }

}