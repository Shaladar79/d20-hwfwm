// systems/hwfwm-d20/scripts/hwfwm-d20.js

const { DocumentSheetV2 } = foundry.applications.api;

/**
 * HWFWM PC Sheet (V2)
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

  /** This sheet is for Actor documents */
  static get documentTypes() {
    return ["Actor"];
  }

  /** Only apply to type "pc" */
  static match(document) {
    return document.type === "pc";
  }

  /** Our template parts */
  static PARTS = {
    main: {
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs"
    }
  };

  /**
   * Data sent to the template.
   */
  async _prepareContext(_options) {
    const actor = this.document;
    const system = actor.system;

    // Group items by type for easy access in the sheet
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
 * HWFWM NPC Sheet (V2)
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

  /** Only apply to type "npc" */
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
 * Register our sheets
 */
Hooks.once("init", () => {
  console.log("HWFWM-d20 | Initializing system and registering V2 sheets");

  // Unregister core default Actor sheets so our custom ones are available/used
  try {
    Actors.unregisterSheet("core", ActorSheet);
  } catch (err) {
    // Ignore if already unregistered / not present
  }

  if (foundry.applications.sheets?.ActorSheetV2) {
    try {
      Actors.unregisterSheet("core", foundry.applications.sheets.ActorSheetV2);
    } catch (err) {
      // Safe to ignore
    }
  }

  // Register PC sheet
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    types: ["pc"],
    label: "HWFWM PC Sheet",
    makeDefault: true
  });

  // Register NPC sheet
  Actors.registerSheet("hwfwm-d20", HWFWMNPCSheet, {
    types: ["npc"],
    label: "HWFWM NPC Sheet"
  });
});

