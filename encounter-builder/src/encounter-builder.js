class EncounterBuilder {
    static getSceneControlButtons(buttons) {
        let tokenButton = buttons.find(b => b.name === "token");

        if (tokenButton && game.user.isGM) {
            tokenButton.tools.push({
                name: "encounter-builder",
                title: game.i18n.localize('EB.Title'),
                icon: "fas fa-crown",
                visible: game.user.isGM,
                onClick: () => EncounterBuilder.openForm()
            });
        }
    }

    static openForm() {
        if (this.form === undefined) {
            this.form = new EncounterBuilderApplication(game.actors);
        }
        this.form.render(true);
    }
}
Hooks.on('getSceneControlButtons', EncounterBuilder.getSceneControlButtons);