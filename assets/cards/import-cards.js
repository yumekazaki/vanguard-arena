const fs = require('fs');
const path = require('path');
const root = __dirname;
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
    const old = cards.get(id) || { dbId:id, name, text:'', clans:[], grade:null, power:0, shield:0, nation:'', trigger:'', type:'Unit' };
    old.name = name;
    old.text = string(block, 'CardText') || old.text;
    const g = number(block, 'UnitGrade'); if (g !== null) old.grade = g;
    const p = number(block, 'PowerStat'); if (p !== null) old.power = p;
    const sh = number(block, 'DefensePowerStat'); if (sh !== null) old.shield = sh;
    const tr = number(block, 'TriggerUnit'); if (tr !== null && tr > 0) old.trigger = triggerNames[tr] || 'Trigger';
    const cl = [...block.matchAll(/global\.CardInClan\d*\[CardStat\]\s*=\s*(\d+)/g)].map(m => clanNames[Number(m[1])]).filter(Boolean);
    old.clans = [...new Set([...old.clans, ...cl])];
    const extra = number(block, 'ExtraDeck'); if (extra) old.type = 'G Unit';
    if (old.trigger) old.type = 'Trigger';
    cards.set(id, old);
  }
}
const result = [];
for (const card of cards.values()) {
  const full = path.join(artDir, `n${card.dbId}.jpg`);
  const mini = path.join(miniDir, `n${card.dbId}.jpg`);
  if (!fs.existsSync(full) && !fs.existsSync(mini)) continue;
  const primary = card.clans[0] || '';
  const firstLine = card.text.split(/\r?\n/)[0].trim();
  if (card.grade === null && /\b(Draw|Critical|Stand|Heal|Front|Over) Trigger\b/i.test(firstLine)) card.grade = 0;
  if (!card.trigger) {
    const triggerMatch = firstLine.match(/\b(Draw|Critical|Stand|Heal|Front|Over) Trigger\b/i);
    if (triggerMatch) card.trigger = triggerMatch[1][0].toUpperCase() + triggerMatch[1].slice(1).toLowerCase();
  }
  if (card.trigger) card.type = 'Trigger';
  const nationNames = ['Dragon Empire','Dark States','Keter Sanctuary','Stoicheia','Brandt Gate','Lyrical Monasterio','Cray Elemental','Touken Ranbu','BanG Dream!','Monster Strike','SHAMAN KING','Record of Ragnarok','CoroCoro','VSPO!'];
  card.nation = nationNames.find(n => firstLine.includes(n)) || '';
  const headerClan = firstLine.split('/').find(part => clanNames && Object.values(clanNames).includes(part.trim()));
  if (!card.clans.length && headerClan) card.clans.push(headerClan.trim());
  const typeMatch = firstLine.match(/(Normal Order|Blitz Order|Set Order|Trigger Order)/i);
  if (typeMatch) card.type = typeMatch[1];
  card.clan = card.clans[0] || '';
  card.id = `cfa-${card.dbId}`;
  card.image = fs.existsSync(full) ? `assets/cards/full/n${card.dbId}.jpg` : `assets/cards/mini/n${card.dbId}.jpg`;
  card.source = 'Cardfight Area card database';
  card.permission = 'Personal local use';
  card.color = '#a39bff';
  card.glyph = '✦';
  result.push(card);
}
result.sort((a,b) => a.dbId-b.dbId);
fs.writeFileSync(path.join(root, 'catalog-data.js'), `window.CARD_CATALOG = ${JSON.stringify(result)};\n`, 'utf8');
const counts = {records:result.length, withGrade:result.filter(c=>c.grade!==null).length, withClan:result.filter(c=>c.clans.length).length, withImage:result.length};
fs.writeFileSync(path.join(root, 'catalog-stats.json'), JSON.stringify(counts,null,2), 'utf8');
console.log(counts, 'Flogal', result.find(c=>c.dbId===1));
