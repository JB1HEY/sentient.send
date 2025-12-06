
function testMarketCardLogic(sidePrices, sideNames, resolved = false) {
  console.log(`Testing with prices: [${sidePrices.join(', ')}]`);

  // Logic from MarketCard.tsx
  const leadingSideIndex = sidePrices.indexOf(Math.max(...sidePrices));
  const leadingSide = sideNames[leadingSideIndex];
  const leadingPercent = sidePrices[leadingSideIndex];

  const maxPercent = Math.max(...sidePrices);
  const tiedSides = sideNames.filter((_, idx) =>
    sidePrices[idx].toFixed(1) === maxPercent.toFixed(1)
  );
  const hasActiveTie = tiedSides.length > 1 && !resolved;

  console.log(`  Max Percent: ${maxPercent}`);
  console.log(`  Tied Sides: [${tiedSides.join(', ')}]`);
  console.log(`  Has Active Tie: ${hasActiveTie}`);

  if (hasActiveTie) {
    console.log(`  Result: CURRENTLY TIED (${tiedSides.length} sides at ${maxPercent.toFixed(1)}%)`);
  } else {
    console.log(`  Result: LEADING (${leadingSide} at ${leadingPercent.toFixed(1)}%)`);
  }
  console.log('---');
}

// Test cases
const names = ['Yes', 'No', 'Maybe'];

// 1. Exact tie
testMarketCardLogic([50, 50], ['Yes', 'No']);

// 2. Close tie (within 0.1)
testMarketCardLogic([50.04, 49.96], ['Yes', 'No']);

// 3. Not a tie (just outside 0.1)
testMarketCardLogic([50.06, 49.94], ['Yes', 'No']);

// 4. Rounding edge case (visual tie but logic says leading)
// 50.05 rounds to 50.1
// 49.95 rounds to 50.0
// Diff is 0.1. 0.1 < 0.1 is FALSE.
testMarketCardLogic([50.05, 49.95], ['Yes', 'No']);

// 5. Another rounding case
// 50.049 rounds to 50.0
// 49.951 rounds to 50.0
// Diff is 0.098. < 0.1 is TRUE.
testMarketCardLogic([50.049, 49.951], ['Yes', 'No']);

// 6. 3-way tie
testMarketCardLogic([33.33, 33.33, 33.33], ['A', 'B', 'C']);

// 7. 3-way close tie
testMarketCardLogic([33.36, 33.32, 33.32], ['A', 'B', 'C']);
// Max is 33.36.
// A: 0 < 0.1 -> True
// B: 33.36 - 33.32 = 0.04 < 0.1 -> True
// C: 33.36 - 33.32 = 0.04 < 0.1 -> True
// Should be 3-way tie.

