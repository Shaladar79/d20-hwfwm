// systems/hwfwm-d20/scripts/hwfwm-d20.js

const HWFWM_SYSTEM_ID = "hwfwm-d20";

/**
 * Base HWFWM Actor Sheet
 * Shared helpers for PC and NPC sheets
 */
class HWFWMActorSheet extends ActorSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      classes: ["hwfwm", "sheet", "actor"],
      width: 840,
      height: 640,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-content",
          initial: "stats"
        }
      ]
    });
  }

  /** Use the actor type to pick the right template */
  get template() {
    const path = `systems/${HWFWM_SYSTEM_ID}/templates/actors`;
    if (this.actor.type === "npc") {
      return `${path}/npc-sheet.hbs`;
    }
    // default to pc sheet for anything else
    return `${path}/actor-sheet.hbs`;
  }
}

/**
 * PC Sheet
 */
class HWFWMPCSheet extends HWFWMActorSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-content",
          initial: "stats"
        }
      ]
    });
  }
}

/**
 * NPC Sheet
 */
class HWFWMNPCSheet extends HWFWMActorSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return foundry.utils.mergeObject(options, {
      classes: ["hwfwm", "sheet", "actor", "npc"],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-content",
          initial: "overview"
        }
      ]
    });
  }
}

/**
 * System init: register sheets
 */
Hooks.once("init", function () {
  console.log("HWFWM | Initializing HWFWM System (d20)");

  // Unregister the core sheets so ours can be default
  Actors.unregisterSheet("core", ActorSheet);

  // Register PC sheet for type "pc"
  Actors.registerSheet(HWFWM_SYSTEM_ID, HWFWMPCSheet, {
    types: ["pc"],
    makeDefault: true,
    label: "HWFWM PC Sheet"
  });

  // Register NPC sheet for type "npc"
  Actors.registerSheet(HWFWM_SYSTEM_ID, HWFWMNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "HWFWM NPC Sheet"
  });
});
