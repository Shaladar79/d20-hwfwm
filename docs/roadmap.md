# 🧭 HWFWM-D20 System Development Roadmap
**Repository:** Shaladar79/d20-hwfwm  
**System Name:** HWFWM-D20  
**Platform:** Foundry VTT v13 (Forge compatible)  
**Base Version:** Stable Legacy `ActorSheet` (white cards, black borders, blue-silver-gold gradient)

---

## ✅ Current Status
- Stable base version loaded and functional in Foundry v13.
- Actor sheet confirmed working with attributes, resources, defenses, and scroll layout.
- System files hosted successfully via GitHub → Forge manifest link.

---

## 🧱 1. Base System (Complete ✅)
- [x] `system.json` linked from GitHub (raw manifest URL)
- [x] `template.json` defines all attributes, resources, defenses
- [x] `ActorSheet` registered and rendering correctly
- [x] Layout finalized (white, bold black borders, gradient margin)
- [x] Scrollable stats layout confirmed working

---

## 📁 2. File & Folder Organization
> Keep the system modular and tidy.
- [ ] Ensure folders:
  - `/templates/actors/`
  - `/templates/items/`
  - `/scripts/`
  - `/styles/`
  - `/packs/`
  - `/docs/` *(this folder)*
- [ ] Move helper code into `/scripts/helpers/` later as project grows.
- [ ] Keep `hwfwm-d20.js` focused on registration and sheet setup.

---

## ⚔️ 3. Items & Compendiums
> Define and test item data structures.
- [ ] Review and finalize `template.json` item templates.
- [ ] Verify all item types include required fields:
  - Name, description, rank, category, rarity, and stats.
- [ ] Create compendium packs:
  - [ ] **Skills**
  - [ ] **Essences**
  - [ ] **Weapons**
  - [ ] **Armor**
  - [ ] **Abilities**
- [ ] Populate each pack with sample entries for testing.

---

## 📜 4. Actor Sheet Tabs
> Build out all character sheet tabs.
- [ ] **Skills Tab** → lists `skill` items (group by category).
- [ ] **Abilities Tab** → lists `essenceAbility` and `racialAbility` items.
- [ ] **Inventory Tab** → lists `weapon`, `armor`, `essence`, `magicStone`, and `equipment`.
- [ ] Add `+` and 🗑️ buttons for add/remove.
- [ ] Clicking an item opens its sheet.

---

## 🧾 5. Item Sheets
> Create editors for each item type.
- [ ] Build **generic item sheet** (`templates/items/item-sheet.hbs`).
- [ ] Register it in `hwfwm-d20.js`.
- [ ] Once stable, create specialized versions:
  - [ ] `weapon-sheet.hbs`
  - [ ] `armor-sheet.hbs`
  - [ ] `skill-sheet.hbs`
  - [ ] `essence-sheet.hbs`
  - [ ] `essenceAbility-sheet.hbs`

---

## 🎲 6. Rolls & Mechanics
> Add gameplay functionality.
- [ ] Implement attribute roll button (behind each stat).
- [ ] Add d20 roll + success calculation logic.
- [ ] Display roll results in Foundry chat.
- [ ] Add damage/healing calculations for abilities.
- [ ] Begin Reaction/Initiative system integration (later phase).

---

## 💅 7. UI Polish
> Cosmetic and usability improvements.
- [ ] Add tab icons and hover highlights.
- [ ] Improve typography and spacing consistency.
- [ ] Add color-coded borders for rarity (Common → Legendary).
- [ ] Optional: implement custom fonts or header emblems.
- [ ] Review mobile/tablet responsiveness (optional).

---

## 🧠 8. Versioning & Maintenance
> Maintain Forge and GitHub sync properly.
- [ ] Increment `"version"` in `system.json` for every change.
- [ ] Commit + push before testing in Forge.
- [ ] Hard refresh Foundry (`Ctrl+F5`) after updates.
- [ ] Tag releases in GitHub once major milestones are stable.

---

## 📅 Future Ideas
- [ ] Journal integration for Essence Lore entries.
- [ ] Automated “Rank-Up” logic for attributes and traits.
- [ ] Token automation: overlay life/trauma bars.
- [ ] Quick Actions menu for abilities (like power hotbar).
- [ ] Support for NPC auto-generation templates.

---

## 🕓 Version History
| Version | Date | Summary | Status |
|:--------:|:------:|:--------|:-------|
| **v0.0.5** | *(Base)* | Stable base release — attributes, resources, defenses functional. | ✅ Stable |
| **v0.0.6** | *(Planned)* | Add Skills tab with dynamic item list + basic item creation. | 🔄 In Progress |
| **v0.0.7** | *(Planned)* | Add Abilities tab (racial + essence). | ⏳ Pending |
| **v0.0.8** | *(Planned)* | Add Inventory tab (weapons, armor, items). | ⏳ Pending |
| **v0.0.9** | *(Planned)* | Implement roll mechanics and chat output. | ⏳ Pending |
| **v0.1.0+** | *(Later)* | UI polish, compendium content, optimization. | ⏳ Planned |

---

### ✨ Notes
This roadmap reflects the stable legacy `ActorSheet` implementation — **do not switch to `ApplicationV2`** until the Foundry VTT 14+ API stabilizes for third-party systems.

---

*Last Updated:* {{insert date here}}

