"use strict";

// Worker: worker-soul-clan-count. Reviewed against catalog at 826779006f4b183ac8e5190c512f26df884c9394.
// cfa-459:0 Poet of Darkness, Amon; cfa-470:0 Demon of Aspiration, Amon:
// CONT [VC/RC]: During your turn, if the number of «Dark Irregulars» in your soul is six or more, this unit gets power +3000.
// cfa-643:0 Borgal; cfa-668:0 Gigantech Dozer:
// CONT [VC/RC]: During your turn, if the number of «Royal Paladin» in your soul is six or more, this unit gets power +3000.
// Each card has exactly this one printed ability. None is fully verified.
//
// BLOCKED: continuousConditionSupported/Matches has no Soul clan-count condition.
// evaluateContinuousEffects receives soulCardNames; server continuous contexts at
// ability-server-reducer.js supply names, not authoritative Soul clan identities.
// Existing name-count and rear-guard-clan-count conditions cannot express this text.
// Export no definitions rather than silently count names, total Soul, or RC cards.
//
// Primary-session dependency request (shared files deliberately untouched):
// Add a validated clan + positive integer threshold continuous condition, using
// current controller Soul instances and authoritative effective clan identities.
// Count each distinct instance once, support multi-clan/all-clan identity rules,
// and fail closed on missing/ambiguous identity. Supply this context from client
// and server. Compose with controller-turn and existing source-only +3000 power,
// restricted to VC/RC. Recalculate immediately on Soul/identity/controller/turn/
// location changes; never persist a turn modifier or create an activation prompt.
// Validate both seats, source/target identity, malformed parameters, and state
// immutability for rejected commands before integrating definitions here.
module.exports = [];
