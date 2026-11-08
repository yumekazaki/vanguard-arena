const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
const helperStart = app.indexOf("function countFaceDownEquipGauges(");
const helperEnd = app.indexOf("\n  function renderZone(", helperStart);
assert.notEqual(helperStart, -1, "the UI must define the face-down gauge counter");
assert.notEqual(helperEnd, -1, "the gauge counter must precede the field renderer");
const gaugeCounter = vm.runInNewContext(`${app.slice(helperStart, helperEnd)}; countFaceDownEquipGauges;`);
const renderZoneStart = app.indexOf("function renderZone(", helperEnd);
const renderZoneEnd = app.indexOf("\n  function renderDamageCards(", renderZoneStart);
const renderZoneSource = app.slice(renderZoneStart, renderZoneEnd);

test("counts only face-down equip gauges linked to this exact field instance", () => {
  const player = {
    equipGauges: [
      { uid: "hidden-a", cardId: "secret-a", zone: "equip-gauge", faceDown: true, attachedToInstanceId: "unit-a" },
      { uid: "hidden-b", cardId: "secret-b", zone: "equip-gauge", faceDown: true, attachedToInstanceId: "unit-a" },
      { uid: "visible", cardId: "public", zone: "equip-gauge", faceDown: false, attachedToInstanceId: "unit-a" },
      { uid: "wrong-zone", zone: "soul", faceDown: true, attachedToInstanceId: "unit-a" },
      { uid: "other-unit", zone: "equip-gauge", faceDown: true, attachedToInstanceId: "unit-b" }
    ]
  };
  assert.equal(gaugeCounter(player, "unit-a"), 2);
  assert.equal(gaugeCounter(player, "unit-b"), 1);
});

test("counts a remote seat's redacted gauges without reading their hidden identities", () => {
  const remotePlayer = {
    equipGauges: [
      { zone: "equip-gauge", faceDown: true, attachedToInstanceId: "remote-unit" },
      { zone: "equip-gauge", faceDown: true, attachedToInstanceId: "remote-unit" }
    ]
  };
  assert.equal(gaugeCounter(remotePlayer, "remote-unit"), 2);
  assert.equal(gaugeCounter({ equipGauges: [] }, "remote-unit"), 0);
});

test("missing state fields produce no badge and the shared renderer handles either seat", () => {
  assert.equal(gaugeCounter(undefined, "unit-a"), 0);
  assert.equal(gaugeCounter({}, "unit-a"), 0);
  assert.equal(gaugeCounter({ equipGauges: [{ zone: "equip-gauge", faceDown: true }] }, "unit-a"), 0);
  assert.match(renderZoneSource, /countFaceDownEquipGauges\(match\.players\[side\], instance\.uid\)/);
  assert.match(renderZoneSource, /if \(equipGaugeCount > 0\)/);
  assert.match(renderZoneSource, /field\.appendChild\(badge\)/);
  assert.match(renderZoneSource, /badge\.textContent = `EQG \$\{equipGaugeCount\}`/);
});
