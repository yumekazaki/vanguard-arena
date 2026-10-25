const fs = require('fs');
const path = require('path');
const root = __dirname;
const bundledCardSpriteDir = process.env.VANGUARD_BUNDLED_CARDSPRITE_DIR || '';
const upstreamArtBase = 'https://raw.githubusercontent.com/justkidding047356/cardfight-area/c2a5aad1f1e348500f1942a890c7e39a95953719/CardSprite';
const upstreamArtIds = new Set(JSON.parse(fs.readFileSync(path.join(root, 'source-art-overrides.json'), 'utf8')));
const printedGradeCorrections = JSON.parse(fs.readFileSync(path.join(root, 'grade-corrections.json'), 'utf8'));
const sourceDir = path.join(root, 'source-text');
const artDir = path.join(root, 'full');
const miniDir = path.join(root, 'mini');
const decoder = new TextDecoder('windows-1251');
const clanNames = {1:'Shadow Paladin',2:'Megacolony',3:'Aqua Force',4:'Nova Grappler',5:'Gold Paladin',6:'Dimension Police',7:'Great Nature',8:'Granblue',9:'Neo Nectar',10:'Oracle Think Tank',11:'Dark Irregulars',12:'Kagero',13:'Bermuda Triangle',14:'Spike Brothers',15:'Royal Paladin',16:'Angel Feather',17:'Tachikaze',18:'Pale Moon',19:'Narukami',20:'Murakumo',21:'Genesis',22:'Etranger',23:'Nubatama',24:'Link Joker',25:'Cray Elemental',26:'Gear Chronicle',27:'Touken Ranbu',28:'Mask Collection',31:'BanG Dream!',32:'Game',33:'Animation',35:'Live Action'};
const triggerNames = {1:'Draw',2:'Critical',3:'Stand',4:'Heal',5:'Front',6:'Over'};
function number(block, key) { const m = block.match(new RegExp(`global\\.${key}\\[CardStat\\]\\s*=\\s*(-?\\d+)`)); return m ? Number(m[1]) : null; }
function string(block, key) { const m = block.match(new RegExp(`global\\.${key}\\[CardStat\\]\\s*=\\s*'([\\s\\S]*?)'`)); return m ? m[1].replace(/\r/g, '').trim() : ''; }
const cards = new Map();
for (const file of fs.readdirSync(sourceDir).filter(x => x.toLowerCase().endsWith('.txt'))) {
  const text = decoder.decode(fs.readFileSync(path.join(sourceDir, file)));
  const matches = [...text.matchAll(/CardStat\s*=\s*(\d+)/g)];
  for (let i=0; i<matches.length; i++) {
    const id = Number(matches[i][1]);
    const block = text.slice(matches[i].index, matches[i+1]?.index ?? text.length);
    const name = string(block, 'CardName');
    if (!name) continue;
    const old = cards.get(id) || { dbId:id, name, text:'', clans:[], grade:null, power:0, shield:0, _powerKnown:false, _shieldKnown:false, nation:'', trigger:'', type:'Unit' };
    old.name = name;
    old.text = string(block, 'CardText') || old.text;
    const g = number(block, 'UnitGrade'); if (g !== null) old.grade = g;
    const p = number(block, 'PowerStat'); if (p !== null) { old.power = p; old._powerKnown = true; }
    const sh = number(block, 'DefensePowerStat'); if (sh !== null) { old.shield = sh; old._shieldKnown = true; }
    const tr = number(block, 'TriggerUnit'); if (tr !== null && tr > 0) old.trigger = triggerNames[tr] || 'Trigger';
    const cl = [...block.matchAll(/global\.CardInClan\d*\[CardStat\]\s*=\s*(\d+)/g)].map(m => clanNames[Number(m[1])]).filter(Boolean);
    old.clans = [...new Set([...old.clans, ...cl])];
    const extra = number(block, 'ExtraDeck'); if (extra) old.type = 'G Unit';
    if (old.trigger) old.type = 'Trigger';
    cards.set(id, old);
  }
}
// Some older records omit UnitGrade. Copy it only when same-name printings
// agree on one grade; do not guess grades from power alone.
const normalizeCardName = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const gradesByName = new Map();
for (const card of cards.values()) {
  if (card.grade === null) continue;
  const key = normalizeCardName(card.name);
  if (!gradesByName.has(key)) gradesByName.set(key, new Set());
  gradesByName.get(key).add(card.grade);
}
for (const card of cards.values()) {
  if (card.grade !== null) continue;
  const grades = gradesByName.get(normalizeCardName(card.name));
  if (grades?.size === 1) card.grade = [...grades][0];
}
// Older CFA records keep printed stats in indexed UnitPower.txt arrays rather
// than beside each card's name and text. Merge those values by CardStat ID.
const unitPowerPath = path.join(sourceDir, 'UnitPower.txt');
if (fs.existsSync(unitPowerPath)) {
  const unitPowerText = decoder.decode(fs.readFileSync(unitPowerPath));
  for (const match of unitPowerText.matchAll(/global\.(PowerStat|DefensePowerStat)\[(\d+)\]\s*=\s*(-?\d+)/g)) {
    const card = cards.get(Number(match[2]));
    if (!card) continue;
    const value = Number(match[3]);
    if (match[1] === 'PowerStat' && !card._powerKnown && value > 0) { card.power = value; card._powerKnown = true; }
    if (match[1] === 'DefensePowerStat' && !card._shieldKnown && value > 0) { card.shield = value; card._shieldKnown = true; }
  }
}
// G Units normally print 15000+; G Guardians are the grade-4 exception with
// no power and 15000 shield. The older text data does not always include this.
for (const card of cards.values()) {
  if (card.type === 'G Unit' && Number(card.grade) >= 4 && !/G Guardian/i.test(card.text) && !card.power) {
    card.power = 15000;
    card._powerKnown = true;
  }
}
// Do not copy stats from a different printing of the same card name. Reprints can
// have different grades, power, or shield; missing source values remain unknown.
// CFA has a few records whose indexed stats do not match their card image.
// Keep these verified corrections here so a catalog rebuild preserves them.
const printedStatCorrections = {
  2275: { power: 9000, shield: 5000 }, // Spirited Brawler, Kohkin (BT16/090EN)
  12245: { power: 0, shield: 0 } // Energy Generator is a Ride Deck Crest, not a Grade 0 Unit
};
const printedTypeCorrections = { 12245: "Ride Deck Crest" };
for (const [id, stats] of Object.entries(printedStatCorrections)) {
  const card = cards.get(Number(id));
  if (!card) continue;
  if (stats.power !== undefined) { card.power = stats.power; card._powerKnown = true; }
  if (stats.shield !== undefined) { card.shield = stats.shield; card._shieldKnown = true; }
  if (printedTypeCorrections[id]) card.type = printedTypeCorrections[id];
  if (id === "12245") card.grade = null;
}
// Older source entries omit UnitGrade. These corrections are transcribed from matching card images.
for (const [id, grade] of Object.entries(printedGradeCorrections)) {
  const card = cards.get(Number(id));
  if (card && Number.isInteger(grade)) card.grade = grade;
}
const result = [];
for (const card of cards.values()) {
  const full = path.join(artDir, `n${card.dbId}.jpg`);
  const mini = path.join(miniDir, `n${card.dbId}.jpg`);
  const bundledFull = bundledCardSpriteDir ? path.join(bundledCardSpriteDir, `n${card.dbId}.jpg`) : '';
  const hasLocalFull = fs.existsSync(full);
  const hasBundledFull = Boolean(bundledFull && fs.existsSync(bundledFull));
  const hasMini = fs.existsSync(mini);
  const primary = card.clans[0] || '';
  const firstLine = card.text.split(/\r?\n/)[0].trim();
  if (card.grade === null && /\b(Draw|Critical|Stand|Heal|Front|Over) Trigger\b/i.test(firstLine)) card.grade = 0;
  // Trigger belongs to the final printed card line, not a stale duplicate row.
  const triggerMatch = firstLine.match(/\b(Draw|Critical|Stand|Heal|Front|Over) Trigger\b/i);
  card.trigger = triggerMatch ? triggerMatch[1][0].toUpperCase() + triggerMatch[1].slice(1).toLowerCase() : '';
  if (card.trigger) card.type = 'Trigger';
  const nationNames = ['Dragon Empire','Dark States','Keter Sanctuary','Stoicheia','Brandt Gate','Lyrical Monasterio','Cray Elemental','Touken Ranbu','BanG Dream!','Monster Strike','SHAMAN KING','Record of Ragnarok','CoroCoro','VSPO!'];
  card.nation = nationNames.find(n => firstLine.includes(n)) || '';
  const headerClan = firstLine.split('/').find(part => clanNames && Object.values(clanNames).includes(part.trim()));
  if (!card.clans.length && headerClan) card.clans.push(headerClan.trim());
  const typeMatch = firstLine.match(/(Normal Order|Blitz Order|Set Order|Trigger Order)/i);
  if (typeMatch) card.type = typeMatch[1];
  card.clan = card.clans[0] || '';
  card.id = `cfa-${card.dbId}`;
  card.image = upstreamArtIds.has(card.dbId) ? `${upstreamArtBase}/n${card.dbId}.jpg` : hasLocalFull || hasBundledFull ? `assets/cards/full/n${card.dbId}.jpg` : hasMini ? `assets/cards/mini/n${card.dbId}.jpg` : `${upstreamArtBase}/n${card.dbId}.jpg`;
  card.source = 'Cardfight Area card database (snapshot 2025-05-09)';
  card.permission = 'Personal local use';
  card.color = '#a39bff';
  card.glyph = '✦';
  if (!card._powerKnown) card.power = null;
  if (!card._shieldKnown) card.shield = null;
  const { _powerKnown, _shieldKnown, ...exportCard } = card;
  result.push(exportCard);
}
result.sort((a,b) => a.dbId-b.dbId);
fs.writeFileSync(path.join(root, 'catalog-data.js'), `window.CARD_CATALOG = ${JSON.stringify(result)};\n`, 'utf8');
const counts = {records:result.length, withGrade:result.filter(c=>c.grade!==null).length, withPower:result.filter(c=>c.power>0).length, withShield:result.filter(c=>c.shield>0).length, withClan:result.filter(c=>c.clans.length).length, withImage:result.length};
fs.writeFileSync(path.join(root, 'catalog-stats.json'), JSON.stringify(counts,null,2), 'utf8');
console.log(counts, 'Flogal', result.find(c=>c.dbId===1));
