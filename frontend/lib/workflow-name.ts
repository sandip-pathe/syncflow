const ADJECTIVES = [
  "Amber",
  "Brisk",
  "Calm",
  "Clever",
  "Clear",
  "Copper",
  "Fresh",
  "Granite",
  "Nimble",
  "Quiet",
  "Rapid",
  "Silver",
  "Steady",
  "Swift",
  "True",
  "Vivid",
];

const NOUNS = [
  "Atlas",
  "Beacon",
  "Bridge",
  "Canvas",
  "Circuit",
  "Harbor",
  "Ledger",
  "Loop",
  "Signal",
  "Spark",
  "Thread",
  "Tower",
  "Vector",
  "Vista",
  "Wave",
  "Workflow",
];

export function generateWorkflowName(random = Math.random) {
  const adjective = pick(ADJECTIVES, random);
  const noun = pick(NOUNS, random);
  const number = Math.floor(random() * 900) + 100;

  return `${adjective} ${noun} ${number}`;
}

function pick(items: string[], random: () => number) {
  return items[Math.floor(random() * items.length)] || items[0];
}
