import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FACTS, SCENES, STORY, resolveText } from "../src/story.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "audit");
const findings = [];

function assert(condition, message) {
  if (!condition) findings.push(message);
}

function cartesian(lengths) {
  return lengths.reduce(
    (rows, length) => rows.flatMap((row) => Array.from({ length }, (_, index) => [...row, index])),
    [[]],
  );
}

const ids = new Set();
const choiceLines = STORY.filter((line) => line.choices);
const optionsByKey = new Map();

for (const [index, line] of STORY.entries()) {
  assert(Boolean(line.id), `node ${index} is missing an id`);
  assert(!ids.has(line.id), `duplicate story id: ${line.id}`);
  ids.add(line.id);
  assert(Boolean(SCENES[line.scene]), `${line.id} references missing scene: ${line.scene}`);
  assert(Boolean(line.time), `${line.id} is missing a time`);
  assert(Boolean(line.text) || Boolean(line.variants), `${line.id} has no text or variants`);

  if (line.choices) {
    assert(line.choices.length >= 2, `${line.id} has fewer than two choices`);
    for (const choice of line.choices) {
      assert(Boolean(choice.label), `${line.id} has a choice without a label`);
      assert(Boolean(choice.key), `${line.id}/${choice.label} has no decision key`);
      assert(Boolean(choice.value), `${line.id}/${choice.label} has no decision value`);
      assert(Boolean(choice.response), `${line.id}/${choice.label} has no visible response`);
      if (!optionsByKey.has(choice.key)) optionsByKey.set(choice.key, new Set());
      optionsByKey.get(choice.key).add(choice.value);
    }
  }

  if (line.fact) assert(Boolean(FACTS[line.fact]), `${line.id} references missing fact: ${line.fact}`);
  if (line.variants) {
    assert(Boolean(line.decisionKey), `${line.id} has variants without a decision key`);
    const possible = optionsByKey.get(line.decisionKey) ?? new Set();
    for (const value of possible) assert(Boolean(line.variants[value]), `${line.id} does not handle ${line.decisionKey}=${value}`);
  }
}

let segment = 1;
let lastMinutes = -1;
for (const line of STORY) {
  if (line.id === "reset") {
    segment += 1;
    lastMinutes = -1;
  }
  const [hours, minutes] = line.time.split(":").map(Number);
  const total = hours * 60 + minutes;
  assert(total >= lastMinutes, `${line.id} moves backward in loop ${segment}: ${line.time}`);
  lastMinutes = total;
}

const combinations = cartesian(choiceLines.map((line) => line.choices.length));
const routeSummaries = [];

for (const combination of combinations) {
  const decisions = {};
  const acquiredFacts = [];
  const selected = [];
  let choiceIndex = 0;

  for (const line of STORY) {
    if (line.choices) {
      const choice = line.choices[combination[choiceIndex]];
      decisions[choice.key] = choice.value;
      selected.push(choice.label);
      assert(Boolean(choice.response.trim()), `${line.id}/${choice.label} resolves to an empty response`);
      choiceIndex += 1;
    } else {
      const text = resolveText(line, decisions);
      assert(Boolean(text?.trim()), `${line.id} resolves to empty text for ${JSON.stringify(decisions)}`);
    }
    if (line.fact && !acquiredFacts.includes(line.fact)) acquiredFacts.push(line.fact);
  }

  assert(acquiredFacts.length === 2, `route ${combination.join("-")} acquires ${acquiredFacts.length} facts instead of 2`);
  assert(STORY.at(-1).ending === true, "final story node is not marked as an ending");
  routeSummaries.push({ combination, decisions, facts: acquiredFacts, selected });
}

const requiredOrder = ["yuma-name", "coffee-memory", "human-haruka"];
const positions = requiredOrder.map((id) => STORY.findIndex((line) => line.id === id));
assert(positions.every((position) => position >= 0), "Yuma confession/memory nodes are incomplete");
assert(positions[0] < positions[1] && positions[1] < positions[2], "Haruka's ordinary memory does not follow Yuma's admission");
assert(STORY.findIndex((line) => line.fact === "roster") >= positions[2], "roster fact interrupts Haruka's ordinary-memory beat");

const report = {
  choiceNodes: choiceLines.map((line) => ({ id: line.id, options: line.choices.map((choice) => choice.label) })),
  combinationsChecked: combinations.length,
  factsExpected: Object.keys(FACTS),
  findings,
  routesPassed: findings.length === 0 ? combinations.length : 0,
  sampleRoutes: [routeSummaries[0], routeSummaries[Math.floor(routeSummaries.length / 2)], routeSummaries.at(-1)],
  storyNodes: STORY.length,
};

await mkdir(output, { recursive: true });
await writeFile(join(output, "route-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (findings.length) process.exitCode = 1;
