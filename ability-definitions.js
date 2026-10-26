(function registerCuratedAbilityBatch(root) {
  const definitions = [
    {
      id: "cfa-103:0",
      cardId: "cfa-103",
      kind: "AUTO",
      printedText: "AUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn.",
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", review: "text and simple source-power effect manually mapped" },
      effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
    }
  ];
  if (root?.VanguardAbilityEngine) root.VanguardAbilityEngine.registerAbilityDefinitions(definitions);
  if (typeof module === "object" && module.exports) module.exports = definitions;
})(typeof globalThis === "undefined" ? this : globalThis);
