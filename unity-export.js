// ===============================
// UNITY EXPORT SYSTEM - EXECUTABLE JSON
// ===============================

function cleanText(text) {
  return (text || "").replace(/\r/g, "").trim();
}

function splitLines(text) {
  return cleanText(text)
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

// Split on " - " only, preserving hyphenated category names like All-Out Struggle
function splitListByDelimiter(text) {
  return cleanText(text)
    .split(/\s+-\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function slugifyValue(str) {
  return cleanText(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseAllQuotedNames(raw) {
  return [...raw.matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

function parsePercentAfter(label, raw) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = raw.match(new RegExp(`${escaped}\\s*(\\d+)\\s*%`, "i"));
  return m ? Number(m[1]) : null;
}

function parseAllPercents(raw) {
  return [...raw.matchAll(/(\d+)\s*%/g)].map(m => Number(m[1]));
}

function parseKiPlus(raw) {
  const m = raw.match(/\bKi\s*\+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function inferTarget(raw) {
  if (/all enemies'/i.test(raw)) return "all_enemies";
  if (/Extreme Class allies'/i.test(raw)) return "extreme_class_allies";
  if (/Super Class allies'/i.test(raw)) return "super_class_allies";
  if (/Category allies'/i.test(raw)) return "category_allies";
  if (/all allies'/i.test(raw)) return "all_allies";
  if (/enemy/i.test(raw)) return "enemy";
  return "self";
}

function buildConditionObject(conditionRaw) {
  const raw = cleanText(conditionRaw);

  if (!raw || /^basic effect/i.test(raw)) {
    return { type: "always" };
  }

  let m;

  m = raw.match(/When attacking with (\d+) or more Ki/i);
  if (m) return { type: "ki_threshold", minKi: Number(m[1]) };

  m = raw.match(/With a (.+) Ki Sphere obtained/i);
  if (m) {
    let sphereText = m[1]
      .replace(/\bRaimbow\b/gi, "Rainbow")
      .replace(/\bTEC\b/gi, "TEQ");

    const sphereTypes = sphereText
      .split(/,|\s+or\s+/i)
      .map(s => s.trim())
      .filter(Boolean);

    return { type: "ki_sphere_obtained", sphereTypes };
  }

  m = raw.match(/When HP is (\d+)% or more/i);
  if (m) return { type: "hp_threshold", comparison: ">=", value: Number(m[1]) };

  m = raw.match(/When HP is (\d+)% or less/i);
  if (m) return { type: "hp_threshold", comparison: "<=", value: Number(m[1]) };

  m = raw.match(/As the (\d)(?:st|nd|rd|th) attacker in a turn/i);
  if (m) return { type: "slot", slots: [Number(m[1])] };

  if (/As the 1st or 2nd attacker in a turn/i.test(raw)) {
    return { type: "slot", slots: [1, 2] };
  }

  if (/As the 2nd or 3rd attacker in a turn/i.test(raw)) {
    return { type: "slot", slots: [2, 3] };
  }

  m = raw.match(/For (\d+) turns from the start of battle/i);
  if (m) return { type: "turn_range", startTurn: 1, endTurn: Number(m[1]) };

  m = raw.match(/Starting from the (\d+)(?:st|nd|rd|th) turn from the start of battle/i);
  if (m) return { type: "turn_from", startTurn: Number(m[1]) };

  m = raw.match(/When there is an ally whose name includes/i);
  if (m) {
    return {
      type: "ally_name_in_team",
      nameIncludesAny: parseAllQuotedNames(raw)
    };
  }

  m = raw.match(/If there are (\d+) or more "([^"]+)" allies on the team/i);
  if (m) {
    return {
      type: "team_category_count",
      minCount: Number(m[1]),
      category: m[2],
      excludeSelf: /self excluded/i.test(raw)
    };
  }

  m = raw.match(/When (\d+) or more "([^"]+)" Category allies are on the team/i);
  if (m) {
    return {
      type: "team_category_count",
      minCount: Number(m[1]),
      category: m[2],
      excludeSelf: false
    };
  }

  if (/When there is an Extreme Class enemy/i.test(raw)) {
    return { type: "enemy_class", enemyClass: "extreme" };
  }

  if (/When facing only 1 enemy/i.test(raw)) {
    return { type: "enemy_count", comparison: "==", value: 1 };
  }

  if (/When receiving a Super Attack/i.test(raw)) {
    return { type: "on_receive_super" };
  }

  if (/When receiving an attack/i.test(raw)) {
    return { type: "on_receive_attack" };
  }

  if (/For every attack received or evaded/i.test(raw)) {
    return { type: "per_attack_received_or_evaded" };
  }

  if (/For every attack received/i.test(raw)) {
    return { type: "per_attack_received" };
  }

  if (/For every Super Attack performed/i.test(raw)) {
    return { type: "per_super_performed" };
  }

  if (/For every attack performed/i.test(raw)) {
    return { type: "per_attack_performed" };
  }

  m = raw.match(/After launching (\d+) or more attacks in battle/i);
  if (m) return { type: "after_attacks_performed", minCount: Number(m[1]) };

  if (/For 1 turn from the character's entry turn/i.test(raw)) {
    return { type: "entry_turn_duration", turns: 1 };
  }

  m = raw.match(/Per "([^"]+)", "([^"]+)" or "([^"]+)" Category ally attacking in the same turn/i);
  if (m) {
    return {
      type: "per_attacking_turn_category_member",
      categories: [m[1], m[2], m[3]]
    };
  }

  m = raw.match(/(\d+) or more Ki Spheres obtained/i);
  if (m) {
    return {
      type: "ki_spheres_obtained",
      minCount: Number(m[1])
    };
  }

  if (/When activating the Active Skill or when attacking with 12 Ki or more/i.test(raw)) {
    return {
      type: "any_of",
      conditions: [
        { type: "on_active_skill_use" },
        { type: "ki_threshold", minKi: 12 }
      ]
    };
  }

  return { type: "custom", raw };
}

function makeEffect(type, extra = {}) {
  return { type, ...extra };
}

function pushStatBuffEffects(effects, raw, targetOverride = null, triggerData = null) {
  const target = targetOverride || inferTarget(raw);

  // If the sentence references enemy HP as a condition, it is still a self buff.
  const effectiveTarget = /enemy's HP/i.test(raw) ? "self" : target;
  const isSupport = effectiveTarget !== "self";
  const quoted = parseAllQuotedNames(raw);
  const temporary = /within the turn|temporarily/i.test(raw);

  const atkValue = parsePercentAfter("ATK", raw);
  const defValue = parsePercentAfter("DEF", raw);

  let finalTrigger = triggerData ? { ...triggerData } : null;

  const enemyHpMoreMatch = raw.match(/enemy's HP is (\d+)% or more/i);
  const enemyHpLessMatch = raw.match(/enemy's HP is (\d+)% or less/i);

  if (enemyHpMoreMatch) {
    finalTrigger = {
      ...(finalTrigger || {}),
      type: "enemy_hp_threshold",
      comparison: ">=",
      value: Number(enemyHpMoreMatch[1])
    };
  } else if (enemyHpLessMatch) {
    finalTrigger = {
      ...(finalTrigger || {}),
      type: "enemy_hp_threshold",
      comparison: "<=",
      value: Number(enemyHpLessMatch[1])
    };
  }

  if (atkValue !== null) {
    effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_stat_buff" : (isSupport ? "support_buff" : "stat_buff"), {
      target: effectiveTarget,
      stats: ["atk"],
      value: atkValue,
      mode: "percent",
      temporary,
      scope: isSupport ? undefined : "passive",
      category: /Category allies'/i.test(raw) && quoted.length ? quoted[0] : null,
      excludeSelf: /self excluded/i.test(raw),
      turns: (() => {
        const m = raw.match(/for (\d+) turns?/i);
        return m ? Number(m[1]) : null;
      })(),
      trigger: finalTrigger
    }));
  }

  if (defValue !== null) {
    effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_stat_buff" : (isSupport ? "support_buff" : "stat_buff"), {
      target: effectiveTarget,
      stats: ["def"],
      value: defValue,
      mode: "percent",
      temporary,
      scope: isSupport ? undefined : "passive",
      category: /Category allies'/i.test(raw) && quoted.length ? quoted[0] : null,
      excludeSelf: /self excluded/i.test(raw),
      turns: (() => {
        const m = raw.match(/for (\d+) turns?/i);
        return m ? Number(m[1]) : null;
      })(),
      trigger: finalTrigger
    }));
  }

  // Handle compact "ATK & DEF 300%" form
  const bothMatch = raw.match(/ATK\s*&\s*DEF\s*(\d+)\s*%/i);
  if (bothMatch) {
    const value = Number(bothMatch[1]);

    const hasAtkAlready = effects.some(e => e.type.includes("buff") && e.stats?.includes("atk"));
    const hasDefAlready = effects.some(e => e.type.includes("buff") && e.stats?.includes("def"));

    if (!hasAtkAlready) {
      effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_stat_buff" : (isSupport ? "support_buff" : "stat_buff"), {
        target: effectiveTarget,
        stats: ["atk"],
        value,
        mode: "percent",
        temporary,
        scope: isSupport ? undefined : "passive",
        category: /Category allies'/i.test(raw) && quoted.length ? quoted[0] : null,
        excludeSelf: /self excluded/i.test(raw),
        turns: (() => {
          const m = raw.match(/for (\d+) turns?/i);
          return m ? Number(m[1]) : null;
        })(),
        trigger: finalTrigger
      }));
    }

    if (!hasDefAlready) {
      effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_stat_buff" : (isSupport ? "support_buff" : "stat_buff"), {
        target: effectiveTarget,
        stats: ["def"],
        value,
        mode: "percent",
        temporary,
        scope: isSupport ? undefined : "passive",
        category: /Category allies'/i.test(raw) && quoted.length ? quoted[0] : null,
        excludeSelf: /self excluded/i.test(raw),
        turns: (() => {
          const m = raw.match(/for (\d+) turns?/i);
          return m ? Number(m[1]) : null;
        })(),
        trigger: finalTrigger
      }));
    }
  }
}

function parseEffectLine(rawEffect, conditionObj) {
  const raw = cleanText(rawEffect);
  const effects = [];
  const target = inferTarget(raw);
  const quoted = parseAllQuotedNames(raw);

  const subTriggerOnReceiveAttack = /when receiving an attack/i.test(raw);
  const subTriggerOnReceiveSuper = /when receiving a Super Attack/i.test(raw);

  // ---------- GUARD / TYPE / HIT / EVADE / INTERRUPT ----------

  if (/Guards all attacks/i.test(raw)) {
    effects.push(makeEffect("guard_all", { target: "self" }));
  }

  if (/Attacks are effective against all Types/i.test(raw)) {
    effects.push(makeEffect("effective_against_all_types", { target: "self" }));
  }

  if (/Attacks guaranteed to hit/i.test(raw)) {
    effects.push(makeEffect("guaranteed_hit", { target: "self" }));
  }

  if (/Performs a critical hit/i.test(raw) && !/chance of/i.test(raw)) {
    effects.push(makeEffect("crit_guaranteed", { target: "self" }));
  }

  if (/Evades enemy's attack/i.test(raw) && !/%/.test(raw)) {
    effects.push(makeEffect("auto_evade", {
      target: "self",
      includesSuper: /including Super Attack/i.test(raw)
    }));
  }

  if (/Directs enemy's attack towards the character/i.test(raw)) {
    effects.push(makeEffect("target_enemy_attacks", {
      target: "self",
      duration: 1
    }));
  }

  if (/Interrupts the attacked enemy/i.test(raw)) {
    effects.push(makeEffect("interrupt", {
      target: "enemy",
      maxPerTurn: /once within a turn/i.test(raw) ? 1 : null
    }));
  }

  if (/Seals the attacked enemy's Super Attack/i.test(raw)) {
    const m = raw.match(/for (\d+) turn/i);
    effects.push(makeEffect("seal_super", {
      target: "enemy",
      turns: m ? Number(m[1]) : 1
    }));
  }

  if (/Foresees enemy's Super Attack/i.test(raw)) {
    const m = raw.match(/for (\d+) turns?/i);
    effects.push(makeEffect("scouter", {
      target: "team",
      turns: m ? Number(m[1]) : 1,
      startsNextAttackingTurn: /next attacking turn/i.test(raw)
    }));
  }

  if (/Recovers \d+% HP/i.test(raw)) {
    const m = raw.match(/Recovers (\d+)% HP/i);
    effects.push(makeEffect("heal_percent", {
      target: "team",
      value: m ? Number(m[1]) : 0,
      timing: /start of the character's attacking turn/i.test(raw)
        ? "start_of_attacking_turn"
        : "instant"
    }));
  }

  // ---------- ORB CHANGE ----------

  if (/Changes Ki Spheres:/i.test(raw)) {
    const m = raw.match(/Changes Ki Spheres:\s*([A-Z]+)\s*to\s*([A-Z]+)/i);
    if (m) {
      effects.push(makeEffect("orb_change", {
        from: [m[1].toUpperCase()],
        to: m[2].toUpperCase()
      }));
    }
  }

  if (/Randomly changes Ki Spheres/i.test(raw)) {
    const excludedPairs = [...raw.matchAll(/([A-Z]+)\s*&\s*([A-Z]+)/g)];
    const excludedTypes = excludedPairs.flatMap(m => [m[1], m[2]]);
    effects.push(makeEffect("orb_change_random", {
      to: "RAINBOW",
      excludedTypes
    }));
  }

  // ---------- ADDITIONALS ----------

  if (/Launches (\d+) additional attacks/i.test(raw)) {
    const m = raw.match(/Launches (\d+) additional attacks/i);
    effects.push(makeEffect("additional_attack", {
      target: "self",
      count: Number(m[1]),
      superChance:
        parsePercentAfter("chance of becoming a Super Attack", raw) ||
        parseAllPercents(raw).slice(-1)[0] ||
        0
    }));
  } else if (/Launches an additional attack/i.test(raw)) {
    effects.push(makeEffect("additional_attack", {
      target: "self",
      count: 1,
      superChance:
        parsePercentAfter("chance of becoming a Super Attack", raw) ||
        parseAllPercents(raw).slice(-1)[0] ||
        0
    }));
  } else if (/Launches an additional Super Attack/i.test(raw)) {
    effects.push(makeEffect("additional_super", {
      target: "self",
      count: 1
    }));
  } else if (/chance of launching an additional Super Attack/i.test(raw)) {
    const pct = parseAllPercents(raw)[0] || 0;
    effects.push(makeEffect("additional_super_chance", {
      target: "self",
      chance: pct
    }));
  }

  // ---------- KI ----------

  if (/\bKi\s*\+\d+/i.test(raw)) {
    const ki = parseKiPlus(raw);
    if (ki !== null) {
      if (/all allies'|Category allies'|Super Class allies'|Extreme Class allies'/i.test(raw)) {
        effects.push(makeEffect("support_ki", {
          target,
          value: ki,
          category: /Category allies'/i.test(raw) && quoted.length ? quoted[0] : null,
          excludeSelf: /self excluded/i.test(raw)
        }));
      } else {
        effects.push(makeEffect("ki_bonus", {
          target: "self",
          value: ki
        }));
      }
    }
  }

  // ---------- SPECIAL SUPPORT CRIT / SUPPORT DR ----------
  // This is the part that fixes Nepgear and Uni.

  // Example: All allies' chance of performing a critical hit & damage reduction rate 8% [UP]
  if (/all allies'.*chance of performing a critical hit/i.test(raw)) {
    const pct = parseAllPercents(raw)[0] || 0;
    effects.push(makeEffect("support_crit_chance", {
      target: "all_allies",
      value: pct,
      excludeSelf: /self excluded/i.test(raw)
    }));
  }

  if (/all allies'.*damage reduction rate/i.test(raw)) {
    const dr = parsePercentAfter("damage reduction rate", raw);
    if (dr !== null) {
      effects.push(makeEffect("support_damage_reduction", {
        target: "all_allies",
        value: dr,
        excludeSelf: /self excluded/i.test(raw)
      }));
    }
  }

  // Example:
  // "Crossover" Category allies' ATK & DEF 40% [UP], plus an additional chance
  // of performing a critical hit 10% [UP] for characters whose name includes "Noire"
  if (/characters whose name includes/i.test(raw) && /chance of performing a critical hit/i.test(raw)) {
    const pctMatches = parseAllPercents(raw);
    const value = pctMatches.length > 1 ? pctMatches[pctMatches.length - 1] : (pctMatches[0] || 0);
    const names = parseAllQuotedNames(raw);
    const lastName = names.length > 1 ? names[names.length - 1] : (names[0] || null);

    effects.push(makeEffect("support_crit_chance_for_name", {
      target: "category_allies",
      category: names.length > 1 ? names[0] : null,
      value,
      nameIncludes: lastName
    }));
  }

  // ---------- SUPPORT BUFFS ----------
  // Handle mixed support lines like:
  // Super Class allies' Ki +2 and ATK & DEF 30% [UP], plus an additional ATK & DEF 30% [UP]
  // for characters who also belong to the "Peppy Gals" Category

  const isSupportLine =
    /all allies'|Category allies'|Super Class allies'|Extreme Class allies'/i.test(raw);

  if (isSupportLine) {
    const supportTarget = inferTarget(raw);
    const quotedNames = parseAllQuotedNames(raw);

    // Base support part: only parse the part before ", plus an additional ..."
    const baseSupportPart = raw.split(/,\s*plus an additional/i)[0];

    const atkBaseMatch = baseSupportPart.match(/ATK\s*&\s*DEF\s*(\d+)\s*%/i);
    const defBaseMatch = baseSupportPart.match(/ATK\s*&\s*DEF\s*(\d+)\s*%/i);

    const atkOnlyBaseMatch = baseSupportPart.match(/ATK\s+(\d+)\s*%/i);
    const defOnlyBaseMatch = baseSupportPart.match(/DEF\s+(\d+)\s*%/i);

    const baseTurnsMatch = baseSupportPart.match(/for (\d+) turns?/i);
    const baseTurns = baseTurnsMatch ? Number(baseTurnsMatch[1]) : null;

    const baseCategory =
      /Category allies'/i.test(baseSupportPart) && quotedNames.length > 0
        ? quotedNames[0]
        : null;

    // ATK & DEF together
    if (atkBaseMatch) {
      const value = Number(atkBaseMatch[1]);

      effects.push(makeEffect("support_buff", {
        target: supportTarget,
        stats: ["atk"],
        value,
        mode: "percent",
        temporary: /within the turn|temporarily/i.test(baseSupportPart),
        category: baseCategory,
        excludeSelf: /self excluded/i.test(baseSupportPart),
        turns: baseTurns
      }));

      effects.push(makeEffect("support_buff", {
        target: supportTarget,
        stats: ["def"],
        value,
        mode: "percent",
        temporary: /within the turn|temporarily/i.test(baseSupportPart),
        category: baseCategory,
        excludeSelf: /self excluded/i.test(baseSupportPart),
        turns: baseTurns
      }));
    }
    else
    {
      if (atkOnlyBaseMatch) {
        effects.push(makeEffect("support_buff", {
          target: supportTarget,
          stats: ["atk"],
          value: Number(atkOnlyBaseMatch[1]),
          mode: "percent",
          temporary: /within the turn|temporarily/i.test(baseSupportPart),
          category: baseCategory,
          excludeSelf: /self excluded/i.test(baseSupportPart),
          turns: baseTurns
        }));
      }

      if (defOnlyBaseMatch) {
        effects.push(makeEffect("support_buff", {
          target: supportTarget,
          stats: ["def"],
          value: Number(defOnlyBaseMatch[1]),
          mode: "percent",
          temporary: /within the turn|temporarily/i.test(baseSupportPart),
          category: baseCategory,
          excludeSelf: /self excluded/i.test(baseSupportPart),
          turns: baseTurns
        }));
      }
    }

    // Additional conditional support part
    const additionalMatch = raw.match(
      /plus an additional ATK & DEF (\d+)% \[UP\] for characters who also belong to the "([^"]+)" Category/i
    );

    if (additionalMatch) {
      effects.push(makeEffect("support_buff_conditional_category", {
        target: supportTarget,
        stats: ["atk", "def"],
        value: Number(additionalMatch[1]),
        mode: "percent",
        requiredCategory: additionalMatch[2],
        excludeSelf: /self excluded/i.test(raw)
      }));
    }
  }

  // ---------- DAMAGE REDUCTION ----------
  // Only self lines here, not ally support lines

  if (!/all allies'/i.test(raw) && /damage reduction rate/i.test(raw)) {
    const dr = parsePercentAfter("damage reduction rate", raw);
    if (dr !== null) {
      effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_damage_reduction" : "damage_reduction", {
        target: "self",
        value: dr,
        perKiSphere: /per Ki Sphere obtained/i.test(raw),
        temporary: /temporarily|within the turn/i.test(raw),
        max: (() => {
          const m = raw.match(/up to (\d+)%/i);
          return m ? Number(m[1]) : null;
        })()
      }));
    }
  }

  // ---------- CRIT CHANCE ----------
  // Only self lines here, not support lines and not the special "whose name includes" support line

  if (
    !/all allies'/i.test(raw) &&
    !/characters whose name includes/i.test(raw) &&
    /chance of performing a critical hit/i.test(raw)
  ) {
    const pct = parseAllPercents(raw)[0] || 0;
    effects.push(makeEffect(/\[INF\]/i.test(raw) ? "stack_crit_chance" : "crit_chance", {
      target: "self",
      value: pct,
      temporary: /within the turn/i.test(raw),
      max: (() => {
        const m = raw.match(/up to (\d+)%/i);
        return m ? Number(m[1]) : null;
      })()
    }));
  }

  // ---------- DODGE CHANCE ----------

  if (/chance of evading enemy's attack/i.test(raw)) {
    const all = parseAllPercents(raw);
    const pct = /critical hit/i.test(raw) && all.length > 1 ? all[1] : (all[0] || 0);
    effects.push(makeEffect("dodge_chance", {
      target: "self",
      value: pct,
      temporary: /within the turn/i.test(raw)
    }));
  }

  // ---------- ENEMY DEBUFF ----------

  if (/All enemies' ATK & DEF/i.test(raw)) {
    const pct = parsePercentAfter("ATK & DEF", raw) || parseAllPercents(raw)[0] || 0;
    effects.push(makeEffect("enemy_debuff", {
      target: "all_enemies",
      stats: ["atk", "def"],
      value: pct,
      mode: "percent",
      temporary: /within the turn/i.test(raw)
    }));
  }

  // ---------- STAT BUFFS / SUPPORT BUFFS ----------
  // Do not run this on enemy debuff lines

  if (!isSupportLine && !/All enemies'/i.test(raw) && /\bATK\b|\bDEF\b/i.test(raw) && /%/.test(raw)) {
    let triggerData = null;

    if (subTriggerOnReceiveAttack) {
      triggerData = { type: "on_receive_attack" };
    } else if (subTriggerOnReceiveSuper) {
      triggerData = { type: "on_receive_super" };
    }

    pushStatBuffEffects(effects, raw, null, triggerData);
  }

  return effects;
}

function parsePassive(rawText) {
  const lines = splitLines(rawText);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (!line.startsWith("-")) {
      current = {
        conditionRaw: line,
        condition: buildConditionObject(line),
        effects: [],
        rawEffects: [],
        unparsedEffects: []
      };
      sections.push(current);
    } else {
      if (!current) {
        current = {
          conditionRaw: "Basic effect(s)",
          condition: { type: "always" },
          effects: [],
          rawEffects: [],
          unparsedEffects: []
        };
        sections.push(current);
      }

      const effectLine = line.replace(/^-+\s*/, "").trim();
      current.rawEffects.push(effectLine);

      const parsed = parseEffectLine(effectLine, current.condition);
      if (parsed.length > 0) {
        current.effects.push(...parsed);
      } else {
        current.unparsedEffects.push(effectLine);
      }
    }
  }

  return sections;
}

function parseSuperEffect(text) {
  const raw = cleanText(text);
  const effects = [];

  function addRaise(stats, multiplier, turns = null, isInfinite = false) {
    effects.push({
      type: "super_raise",
      stats,
      multiplier,
      turns,
      isInfinite
    });
  }

  // Combined ATK & DEF with explicit duration
  let m = raw.match(/greatly raises ATK\s*&\s*DEF for (\d+) turn/i);
  if (m) {
    addRaise(["atk", "def"], "greatly_raise", Number(m[1]), false);
  } else {
    m = raw.match(/raises ATK\s*&\s*DEF for (\d+) turn/i);
    if (m) {
      addRaise(["atk", "def"], "raise", Number(m[1]), false);
    } else {
      // Combined ATK & DEF without duration = infinite
      if (/greatly raises ATK\s*&\s*DEF/i.test(raw)) {
        addRaise(["atk", "def"], "greatly_raise", null, true);
      } else if (/raises ATK\s*&\s*DEF/i.test(raw)) {
        addRaise(["atk", "def"], "raise", null, true);
      }
    }
  }

  const alreadyHasAtk = effects.some(e => e.type === "super_raise" && e.stats.includes("atk"));
  const alreadyHasDef = effects.some(e => e.type === "super_raise" && e.stats.includes("def"));

  // ATK only
  if (!alreadyHasAtk) {
    if (/massively raises ATK for (\d+) turn/i.test(raw)) {
      m = raw.match(/massively raises ATK for (\d+) turn/i);
      addRaise(["atk"], "massively_raise", Number(m[1]), false);
    } else if (/massively raises ATK/i.test(raw)) {
      addRaise(["atk"], "massively_raise", null, true);
    } else if (/greatly raises ATK for (\d+) turn/i.test(raw)) {
      m = raw.match(/greatly raises ATK for (\d+) turn/i);
      addRaise(["atk"], "greatly_raise", Number(m[1]), false);
    } else if (/greatly raises ATK/i.test(raw)) {
      addRaise(["atk"], "greatly_raise", null, true);
    } else if (/raises ATK for (\d+) turn/i.test(raw)) {
      m = raw.match(/raises ATK for (\d+) turn/i);
      addRaise(["atk"], "raise", Number(m[1]), false);
    } else if (/raises ATK/i.test(raw)) {
      addRaise(["atk"], "raise", null, true);
    }
  }

  // DEF only
  if (!alreadyHasDef) {
    if (/massively raises DEF for (\d+) turn/i.test(raw)) {
      m = raw.match(/massively raises DEF for (\d+) turn/i);
      addRaise(["def"], "massively_raise", Number(m[1]), false);
    } else if (/massively raises DEF/i.test(raw)) {
      addRaise(["def"], "massively_raise", null, true);
    } else if (/greatly raises DEF for (\d+) turn/i.test(raw)) {
      m = raw.match(/greatly raises DEF for (\d+) turn/i);
      addRaise(["def"], "greatly_raise", Number(m[1]), false);
    } else if (/greatly raises DEF/i.test(raw)) {
      addRaise(["def"], "greatly_raise", null, true);
    } else if (/raises DEF for (\d+) turn/i.test(raw)) {
      m = raw.match(/raises DEF for (\d+) turn/i);
      addRaise(["def"], "raise", Number(m[1]), false);
    } else if (/raises DEF/i.test(raw)) {
      addRaise(["def"], "raise", null, true);
    }
  }

  // Ally support from super: raises [qualifier] allies' ATK/DEF/ATK & DEF by N% for N turns
  for (const sm of [...raw.matchAll(/raises ([A-Za-z\s"'-]*allies')\s*(ATK\s*&\s*DEF|ATK|DEF)\s*by\s*(\d+)%\s*for\s*(\d+)\s*turns?/gi)]) {
    const qualifierRaw = sm[1];
    const statStr = sm[2].replace(/\s/g, '').toUpperCase();
    const value = Number(sm[3]);
    const turns = Number(sm[4]);
    const target = /extreme\s*class/i.test(qualifierRaw) ? "extreme_class_allies"
      : /super\s*class/i.test(qualifierRaw) ? "super_class_allies"
      : "all_allies";
    const stats = statStr === 'ATK&DEF' ? ['atk', 'def']
      : statStr === 'ATK' ? ['atk'] : ['def'];
    effects.push({ type: "support_buff", target, stats, value, mode: "percent", turns });
  }

  if (/high chance of stunning the enemy/i.test(raw)) {
    effects.push({
      type: "stun_chance",
      target: "enemy",
      chance: 50
    });
  }

  if (/greatly lowers ATK & DEF/i.test(raw)) {
    effects.push({
      type: "enemy_debuff",
      target: "enemy",
      stats: ["atk", "def"],
      multiplier: "greatly_lower"
    });
  }

  return effects;
}

function parseActive(conditionText, effectText) {
  const conditionRaw = cleanText(conditionText);
  const effectRaw = cleanText(effectText);

  const condition = { raw: conditionRaw };
  const effects = [];

  let m;

  m = conditionRaw.match(/starting from the (\d+)(?:st|nd|rd|th) turn from the start of battle/i);
  if (m) condition.startTurn = Number(m[1]);

  m = conditionRaw.match(/after evading (\d+) or more attacks in battle/i);
  if (m) condition.evadesRequired = Number(m[1]);

  m = conditionRaw.match(/there are (\d+) or more "([^"]+)" Category allies on the team/i);
  if (m) {
    condition.teamCategoryCount = {
      minCount: Number(m[1]),
      category: m[2]
    };
  }

  if (/once only/i.test(conditionRaw)) {
    condition.onceOnly = true;
  }

  if (/Massively raises ATK temporarily/i.test(effectRaw)) {
    effects.push({ type: "active_skill_attack_effect", subType: "massively_raise_atk_temporarily" });
  }

  if (/causes ultimate damage to enemy/i.test(effectRaw)) {
    effects.push({ type: "active_damage", multiplier: "ultimate" });
  }

  if (/all attacks become critical hits/i.test(effectRaw)) {
    effects.push({ type: "crit_guaranteed", target: "self", duration: 1 });
  }

  m = effectRaw.match(/ATK & DEF \+(\d+)% and chance of evading enemy's attack (\d+)% in battle/i);
  if (m) {
    effects.push({ type: "stat_buff", target: "self", stats: ["atk", "def"], value: Number(m[1]), mode: "percent", scope: "battle" });
    effects.push({ type: "dodge_chance", target: "self", value: Number(m[2]), scope: "battle" });
  }

  const supportMatches = [...effectRaw.matchAll(/"([^"]+)" Category allies' ATK & DEF \+(\d+)%/gi)];
  for (const match of supportMatches) {
    effects.push({
      type: "support_buff",
      target: "all_allies",
      category: match[1],
      stats: ["atk", "def"],
      value: Number(match[2]),
      mode: "percent",
      turns: (() => {
        const tm = effectRaw.match(/for (\d+) turns?/i);
        return tm ? Number(tm[1]) : null;
      })()
    });
  }

  if (/Directs enemy's attack towards the character/i.test(effectRaw)) {
    effects.push({ type: "target_enemy_attacks", target: "self", duration: 1 });
  }

  if (/evades enemy's attack/i.test(effectRaw)) {
    effects.push({
      type: "auto_evade",
      target: "self",
      duration: 1,
      includesSuper: /including Super Attack/i.test(effectRaw)
    });
  }

  return {
    rawCondition: conditionRaw,
    rawEffect: effectRaw,
    condition,
    effects
  };
}

function buildForm(binds, isTransformed, rarity, hasActiveSkill) {
  const superText = isTransformed ? binds.t_superAtkText : binds.superAtkText;
  const ultraText = isTransformed ? binds.t_ultraSuperAtkText : binds.ultraSuperAtkText;
  const passiveText = isTransformed ? binds.t_passiveText : binds.passiveText;
  const activeCond = isTransformed ? binds.t_activeCond : binds.activeCond;
  const activeText = isTransformed ? binds.t_activeText : binds.activeText;

  return {
    super: {
      name: cleanText(isTransformed ? binds.t_superAtkName : binds.superAtkName),
      rawText: cleanText(superText),
      effects: parseSuperEffect(superText)
    },
    ultraSuper: rarity === "LR" ? {
      name: cleanText(isTransformed ? binds.t_ultraSuperAtkName : binds.ultraSuperAtkName),
      rawText: cleanText(ultraText),
      effects: parseSuperEffect(ultraText)
    } : null,
    passive: {
      name: cleanText(isTransformed ? binds.t_passiveName : binds.passiveName),
      rawText: cleanText(passiveText),
      sections: parsePassive(passiveText)
    },
    active: hasActiveSkill ? {
      name: cleanText(isTransformed ? binds.t_activeName : binds.activeName),
      ...parseActive(activeCond, activeText)
    } : null
  };
}

function buildUnityCard(data) {
  const b = data.binds;
  const rarity = data.rarity;
  const hasTransform = !!data.hasTransform;
  const hasActiveSkill = !!data.hasActiveSkill;

  return {
    schemaVersion: 2,
    id: slugifyValue(`${b.titleMain}_${b.titleSub}`),

    identity: {
      titleMain: cleanText(b.titleMain),
      titleSub: cleanText(b.titleSub),
      rarity,
      type: data.type
    },

    progression: {
      maxLevel: Number(b.maxLv || 0),
      saLevel: Number(b.saLv || 0),
      cost: Number(b.cost || 0)
    },

    stats: {
      hp: {
        base: Number(b.hpBase || 0),
        max: Number(b.hpMax || 0),
        p55: Number(b.hp55 || 0),
        p100: Number(b.hp100 || 0)
      },
      atk: {
        base: Number(b.atkBase || 0),
        max: Number(b.atkMax || 0),
        p55: Number(b.atk55 || 0),
        p100: Number(b.atk100 || 0)
      },
      def: {
        base: Number(b.defBase || 0),
        max: Number(b.defMax || 0),
        p55: Number(b.def55 || 0),
        p100: Number(b.def100 || 0)
      }
    },

    leaderSkill: {
      rawText: cleanText(b.leaderText)
    },

    links: splitListByDelimiter(b.linksText),
    categories: splitListByDelimiter(b.categoriesText),

    forms: {
      base: buildForm(b, false, rarity, hasActiveSkill),
      transformed: hasTransform ? buildForm(b, true, rarity, hasActiveSkill) : null
    },

    flags: {
      hasTransform,
      hasActiveSkill
    }
  };
}

function setupUnityExportButton() {
  const btn = document.getElementById("exportUnityJsonBtn");

  if (!btn) {
    console.error("Unity export button not found: #exportUnityJsonBtn");
    return;
  }

  btn.addEventListener("click", () => {
    try {
      const data = collectCardData();
      const unityCard = buildUnityCard(data);

      const fileName = slugifyValue(`${unityCard.identity.titleMain}_${unityCard.identity.titleSub}`);

      const blob = new Blob([JSON.stringify(unityCard, null, 2)], {
        type: "application/json"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}_unity.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Unity JSON export failed:", err);
      alert("Unity JSON export failed. Check console.");
    }
  });
}