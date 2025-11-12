// systems/hwfwm-d20/scripts/hwfwm-d20.js

const {
  DocumentSheetV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

/* -------------------------------------------- */
/*  PC Sheet (V2 + Handlebars)                  */
/* -------------------------------------------- */

class HWFWMPCSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "hwfwm-pc-sheet",
    classes: ["hwfwm", "sheet", "actor", "pc"],
    window: {
      title: "HWFWM PC",
      resizable: true
    }
  };

  static get documentTypes() {
    return ["Actor"];
  }

  static match(document) {
    return document.type === "pc";
  }

  static PARTS = {
    main: {
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs"
    }
  };

  static TABS = {
    primary: {
      navSelector: ".sheet-tabs",
      contentSelector: ".sheet-content",
      initial: "stats"
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

/* -------------------------------------------- */
/*  NPC Sheet (V2 + Handlebars)                 */
/* -------------------------------------------- */

class HWFWMNPCSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "hwfwm-npc-sheet",
    classes: ["hwfwm", "sheet", "actor", "npc"],
    window: {
      title: "HWFWM NPC",
      resizable: true
    }
  };

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

  static TABS = {
    primary: {
      navSelector: ".sheet-tabs",
      contentSelector: ".sheet-content",
      initial: "stats"
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

/* -------------------------------------------- */
/*  Register Sheets                             */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log("HWFWM-d20 | Initializing system and registering V2 sheets");

  try {
    Actors.unregisterSheet("core", ActorSheet);
  } catch (err) { /* ignore */ }

  try {
    if (foundry.applications.sheets?.ActorSheetV2) {
      Actors.unregisterSheet("core", foundry.applications.sheets.ActorSheetV2);
    }
  } catch (err) { /* ignore */ }

  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    types: ["pc"],
    label: "HWFWM PC Sheet",
    makeDefault: true
  });

  Actors.registerSheet("hwfwm-d20", HWFWMNPCSheet, {
    types: ["npc"],
    label: "HWFWM NPC Sheet"
  });
});
