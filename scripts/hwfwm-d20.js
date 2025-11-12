// ============================================================================
// HWFWM-D20 | Last-working style to match hwfwm-d20.css you provided
// ============================================================================

class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      // IMPORTANT: contentSelector matches your CSS: .sheet-content
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-content", initial: "stats" }]
    });
  }

  /** Provide template data */
  getData(options) {
    const data = super.getData(options);
    const sys = this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    // Only show Willpower for Gold/Diamond
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    // (Hooks for future UI actions can go here)
  }
}

Hooks.once("init", () => {
  console.log("HWFWM-D20 | init (classic sheet)");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});

