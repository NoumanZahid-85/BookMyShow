// Run: node tests/seatScore.test.mjs   (Node 23+ strips TypeScript types itself)
import assert from "node:assert/strict";
import { bestBlock, scoreSeats, viewBand, viewScore } from "../src/lib/seatScore.ts";

const rows = "ABCDEFGH".split("");
const seats = rows.flatMap((row) => Array.from({ length: 15 }, (_, i) => ({ seat_id: `${row}${String(i + 1).padStart(2, "0")}`, row, number: i + 1 })));
const scores = scoreSeats(seats);

// Center of a middle-back row beats the front corner.
assert.ok(scores.get("E08") > scores.get("A01"));
assert.equal(viewBand(scores.get("E08")), "best");
assert.equal(viewBand(scores.get("A01")), "side");
// Symmetric left and right.
assert.equal(viewScore(4, 8, 3, 15), viewScore(4, 8, 13, 15));

// Best pair is side by side and in a best-view row.
const pair = bestBlock(seats, scores, 2);
assert.equal(pair.length, 2);
assert.equal(pair[0][0], pair[1][0]);
assert.equal(Number(pair[1].slice(1)), Number(pair[0].slice(1)) + 1);
assert.equal(viewBand(scores.get(pair[0])), "best");

// Never picks seats with a gap between them.
const gappy = [
  { seat_id: "E07", row: "E", number: 7 },
  { seat_id: "E09", row: "E", number: 9 },
];
assert.deepEqual(bestBlock(gappy, scores, 2), []);

console.log("seatScore: all checks passed");
