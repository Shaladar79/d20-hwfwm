// systems/hwfwm-d20/scripts/hwfwm-d20.js

// Use Foundry's v2 sheet framework (v13+)
const { DocumentSheetV2 } = foundry.applications.api;

/**
 * PC Sheet
 */
class HWFWMPCSheet extends DocumentSheetV2 {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      id: "hwfwm-pc-sheet",
      classes: ["hwfwm", "sheet", "actor", "pc"],
      window: {
        title: "HWFWM PC",
        resizable: true
      }
    };
  }

  /** Tell Foundry which document type this sheet is for */
  static get documentTypes() {
    return ["Actor"];
  }

  /** Limit this sheet to pc type */
  static match(document) {
    return document.type === "pc";
  }

  /** Define our template parts */
  static PARTS = {
    main: {
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs"
    }
  };

  /**
   * Supply data to the template.
   * context is what your .hbs sees (actor, system, items grouped, etc.)
   */
  async _prepareContext(_options) {
    const actor = this.document;
    const system = actor.system;

    // Group items by type for easier use in the sheet
    const items = actor.items.contents ?? [];
    const itemTypes = items.reduce((acc, item) => {
      const t = item.type;
      if (!acc[t]) acc[t] = [];
      acc[t].push(item);
      return acc;
    }, {});

    return {
      actor,
      system,
      itemTypes,
      editable: this.isEditable,
      owner: actor.isOwner
    };
  }
}

/**
 * NPC Sheet - simplified, uses npc-sheet.hbs
 */
class HWFWMNPCSheet extends DocumentSheetV2 {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      id: "hwfwm-npc-sheet",
      classes: ["hwfwm", "sheet", "actor", "npc"],
      window: {
        title: "HWFWM NPC",
        resizable: true
      }
    };
  }

  static get documentTypes() {
    return ["Actor"];
  }

  static match(document) {
    return document.type === "npc";
  }

  static PARTS = {
    main: {
      template: "systems/hwfwm-d20/templates/actors/npc-sheet.hbs"
    }
  };

  async _prepareContext(_options) {
    const actor = this.document;
    const system = actor.system;
    const items = actor.items.contents ?? [];
    const itemTypes = items.reduce((acc, item) => {
      const t = item.type;
      if (!acc[t]) acc[t] = [];
      acc[t].push(item);
      return acc;
    }, {});

    return {
      actor,
      system,
      itemTypes,
      editable: this.isEditable,
      owner: actor.isOwner
    };
  }
}

/**
 * Register sheets on init
 */
Hooks.once("init", function () {
  console.log("HWFWM-d20 | Initializing system and registering sheets (V2)");

  // Unregister the default core sheets so ours become primary
  Actors.unregisterSheet("core", foundry.applications.sheets.ActorSheetV2 || ActorSheet);

  // Register PC sheet
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    label: "HWFWM PC Sheet",
    makeDefault: true
  });

  // Register NPC sheet
  Actors.registerSheet("hwfwm-d20", HWFWMNPCSheet, {
    label: "HWFWM NPC Sheet"
  });
});
