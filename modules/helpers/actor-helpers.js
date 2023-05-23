import ModifierHelpers from "./modifiers.js";

export default class ActorHelpers {
  static updateActor(event, formData) {
    formData = expandObject(formData);

    // as of Foundry v10, saving an editor only submits the single entry for that editor
    if (Object.keys(formData).length > 1) {
      if (this.object.type !== "homestead") {
        if (this.object.type !== "vehicle") {
          // Handle characteristic updates
          Object.keys(CONFIG.FFG.characteristics).forEach((key) => {
            ModifierHelpers.getActiveAEModifierValue(this.actor, key)
            // submitting the form with active effects enabled results in all values going up
            // subtract the value being added by active effects, so we only submit the true changes
            let form_value = parseInt(formData.data.attributes[key].value, 10); // value in form
            let ae_value = parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, key)); // value impacting actor
            formData.data.attributes[key].value = Math.max(0, form_value - ae_value);
          });

          // Handle stat updates
          Object.keys(CONFIG.FFG.character_stats).forEach((k) => {
            const key = CONFIG.FFG.character_stats[k].value;

            let total = parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, key)); // value being added from AEs, needed for thresholds
            if (key === 'Encumbrance') { console.log(`starting total: ${total}`)}
            let statValue = 0; // value as it exists in the form
            let isFormValueVisible = true;

            if (key === "Soak") {
              if (formData.data.stats[k]?.value) {
                statValue = parseInt(formData.data.stats[k].value, 10);
                // the soak value is autocalculated we need to account for Brawn
                statValue = statValue - parseInt(formData.data.attributes.Brawn.value, 10);
              } else {
                statValue = 0;
                isFormValueVisible = false;
              }
            } else if (key === "Encumbrance") {
              if (formData.data.stats[k]?.max) {
                statValue = parseInt(formData.data.stats[k].max, 10);
                // the encumbrance value is autocalculated we need to account for 5 + Brawn
                statValue -= parseInt(formData.data.attributes.Brawn.value, 10); // remove the Brawn in the form
                statValue -= 5; // remove the extra 5 added
                statValue -= parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, 'Brawn'));
                total += parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, 'Brawn'))
                formData.data.stats[k].value -= parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, key))
              } else {
                statValue = 0;
                isFormValueVisible = false;
              }
            } else if (key === "Defence-Melee") {
              statValue = parseInt(formData.data.stats.defence.melee, 10);
            } else if (key === "Defence-Ranged") {
              statValue = parseInt(formData.data.stats.defence.ranged, 10);
            } else {
              if (formData.data?.stats[k]?.max) {
                statValue = parseInt(formData.data.stats[k].max, 10);
              } else {
                statValue = 0;
                isFormValueVisible = false;
              }
            }

            let x = statValue - (isFormValueVisible ? total : 0);
            if (key === "Soak") {
              const autoSoakCalculation = (typeof this.actor.flags?.starwarsffg?.config?.enableAutoSoakCalculation === "undefined" && game.settings.get("starwarsffg", "enableSoakCalc")) || this.actor.flags.starwarsffg?.config.enableAutoSoakCalculation;
              if (autoSoakCalculation) {
                x = 0;
              }
            }

            formData.data.attributes[key].value = Math.max(0, x);
          });

          // Handle skill rank updates
          Object.keys(this.object.system.skills).forEach((key) => {
            let total = parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, key)); // number from active effects
            let x = parseInt(formData.data.skills[key]?.rank, 10) - total;
            if (x > 0) {
              formData.data.attributes[key].value = x;
            } else {
              formData.data.attributes[key].value = 0;
            }
          });

          // Handle credits
          if (formData.data.stats?.credits?.value) {
            const rawCredits = formData.data.stats?.credits.value
              ?.toString()
              .match(/^(?!.*\.).*|.*\./)[0]
              .replace(/[^0-9]+/g, "");
            formData.data.stats.credits.value = parseInt(rawCredits, 10);
          }
        } else {
          // Vehicles
          // Handle stat updates
          Object.keys(CONFIG.FFG.vehicle_stats).forEach((k) => {
            const key = CONFIG.FFG.vehicle_stats[k].value;

            let total = parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, key));

            let statValue = 0;
            let isFormValueVisible = true;
            if (k === "shields") {
            } else if (formData.data?.stats[k]?.max) {
              statValue = parseInt(formData.data.stats[k].max, 10);
            } else {
              if (formData.data.stats[k]?.value) {
                statValue = parseInt(formData.data.stats[k].value, 10);
              } else {
                statValue = 0;
                isFormValueVisible = false;
              }
            }

            if (k === "shields") {
              let newAttr = formData.data.attributes[key].value.split(",");
              ["fore", "port", "starboard", "aft"].forEach((position, index) => {
                let shieldValue = parseInt(formData.data.stats[k][position], 10);
                let x = shieldValue - (total[index] ? total[index] : 0);
                let y = parseInt(newAttr[index], 10) + x;
                if (y > 0) {
                  newAttr[index] = y;
                } else {
                  newAttr[index] = 0;
                }
              });
              formData.data.attributes[key].value = newAttr;
            } else {
              let allowNegative = false;
              if (statValue < 0 && k === "handling") {
                allowNegative = true;
              }
              let x = statValue - (isFormValueVisible ? total : 0);
              if (x > 0 || allowNegative) {
                formData.data.attributes[key].value = x;
              } else {
                formData.data.attributes[key].value = 0;
              }
            }
          });
          // subtract AE values for stats which can be increased by AEs so we don't add to them forever
          formData.data.stats.encumbrance.value -= parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, 'Encumbrance'));
          formData.data.stats.customizationHardPoints.value -= parseInt(ModifierHelpers.getActiveAEModifierValue(this.actor, 'customizationHardPoints'));
        }
      }
    }
    // Handle the free-form attributes list
    const formAttrs = expandObject(formData)?.data?.attributes || {};
    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let k = v["key"].trim();
      delete v["key"];
      obj[k] = v;
      return obj;
    }, {});

    // Remove attributes which are no longer used
    if (this.object.system?.attributes) {
      for (let k of Object.keys(this.object.system.attributes)) {
        if (!attributes.hasOwnProperty(k)) attributes[`-=${k}`] = null;
      }
    }

    // recombine attributes to formData
    formData.data.attributes = attributes;
    console.log(formData)

    // Update the Actor
    setProperty(formData, `flags.starwarsffg.loaded`, false);
    return this.object.update(formData);
  }
}
