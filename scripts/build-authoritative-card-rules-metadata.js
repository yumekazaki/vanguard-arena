"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");

const root = path.resolve(__dirname, "..");
const OUTPUT_FILE = "card-authoritative-rules-metadata.js";
const FIELDS = Object.freeze(["grade", "clan", "clans", "nation", "nations", "type", "name", "race", "races", "shield", "power", "trigger", "hasAutoActCont"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cardRaces(card, identities = {}) {
  const explicit = [...new Set([...(typeof card.race === "string" ? [card.race] : []), ...(Array.isArray(card.races) ? card.races : [])].map(cleanText).filter(Boolean))];
  if (explicit.length) return explicit.sort((a, b) => a.localeCompare(b, "en"));
  const firstLine = cleanText(card.text).split(/\r?\n/).map(cleanText).find(Boolean) || "";
  const tokens = firstLine.split("/").map(cleanText).filter(Boolean);
  const clans = identities.clans || new Set();
  const nations = identities.nations || new Set();
  if (!tokens.some(token => clans.has(token.toLocaleLowerCase()) || nations.has(token.toLocaleLowerCase()))) return [];
  const triggerLine = card.trigger ? `${cleanText(card.trigger)} trigger`.toLocaleLowerCase() : "";
  return [...new Set(tokens.filter(token => {
    const normalized = token.toLocaleLowerCase();
    return !clans.has(normalized) && !nations.has(normalized) && normalized !== triggerLine && !/\b(?:unit|trigger|order)\b/i.test(token);
  }))].sort((a, b) => a.localeCompare(b, "en"));
}

function cardRulesMetadata(card, identities = {}) {
  return {
    grade: cleanNumber(card.grade),
    clan: cleanText(card.clan),
    clans: [...new Set((Array.isArray(card.clans) ? card.clans : []).map(cleanText).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")),
    nation: cleanText(card.nation),
    nations: [...new Set((Array.isArray(card.nations) ? card.nations : card.nation ? [card.nation] : []).map(cleanText).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")),
    type: cleanText(card.type),
    name: cleanText(card.name),
    race: cleanText(card.race),
    races: cardRaces(card, identities),
    shield: cleanNumber(card.shield),
    power: cleanNumber(card.power),
    trigger: cleanText(card.trigger),
    // Fail closed: any printed AUTO/ACT/CONT marker means the revealed card
    // cannot satisfy text requiring a card with none of those ability types.
    hasAutoActCont: /\b(?:AUTO|ACT|CONT)\b/i.test(cleanText(card.text))
  };
}

function buildAuthoritativeCardRulesMetadata(cards) {
  if (!Array.isArray(cards)) throw new TypeError("A card catalog array is required.");
  const entries = [];
  const seenIds = new Set();
  const clans = new Set(cards.flatMap(card => [card.clan, ...(Array.isArray(card.clans) ? card.clans : [])]).map(cleanText).filter(Boolean).map(value => value.toLocaleLowerCase()));
  const nations = new Set(cards.flatMap(card => [card.nation, ...(Array.isArray(card.nations) ? card.nations : [])]).map(cleanText).filter(Boolean).map(value => value.toLocaleLowerCase()));
  for (const card of cards) {
    const id = cleanText(card?.id);
    if (!id) throw new Error("Card catalog contains a card without an ID.");
    if (seenIds.has(id)) throw new Error(`Card catalog contains duplicate card ID: ${id}.`);
    seenIds.add(id);
    entries.push([id, cardRulesMetadata(card, { clans, nations })]);
  }
  entries.sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }));
  return Object.fromEntries(entries);
}

function renderArtifact(byId) {
  const json = JSON.stringify(byId);
  return `(function registerAuthoritativeCardRulesMetadata(root) {\n` +
    `  const byId = Object.freeze(${json});\n` +
    `  const api = Object.freeze({ byId, fields: Object.freeze(${JSON.stringify(FIELDS)}), get: cardId => byId[String(cardId || "")] || null });\n` +
    `  if (root) root.VanguardCardRulesMetadata = api;\n` +
    `  if (typeof module === "object" && module.exports) module.exports = api;\n` +
    `})(typeof globalThis === "undefined" ? this : globalThis);\n`;
}

function writeArtifact(cards, destination = path.join(root, OUTPUT_FILE)) {
  const byId = buildAuthoritativeCardRulesMetadata(cards);
  const output = renderArtifact(byId);
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, output, { flag: "wx" });
  try {
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* preserve the original write error */ }
    throw error;
  }
  return { count: Object.keys(byId).length, bytes: Buffer.byteLength(output), destination };
}

if (require.main === module) {
  try {
    const result = writeArtifact(loadCatalog(root));
    process.stdout.write(`Wrote ${result.count} authoritative card rules metadata entries (${result.bytes} bytes) to ${path.basename(result.destination)}.\n`);
  } catch (error) {
    console.error(`Card rules metadata generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { FIELDS, OUTPUT_FILE, buildAuthoritativeCardRulesMetadata, cardRulesMetadata, cardRaces, renderArtifact, writeArtifact };
