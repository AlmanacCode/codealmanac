#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const INPUT_PATH =
  "docs/research/openwiki-launch-traction/twitter-stargazers-sample-300-assigned.csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toObjects(rows) {
  const [headers, ...dataRows] = rows;

  return dataRows
    .filter((row) => row.length > 1 || row[0])
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    );
}

function assignee(argv) {
  const index = argv.findIndex((argument) => argument === "--assignee");
  return index === -1 ? "Rohan" : argv[index + 1]?.trim() || "Rohan";
}

function firstName(name) {
  return name.trim().split(/\s+/u)[0] || null;
}

async function main() {
  const owner = assignee(process.argv.slice(2));
  const rows = toObjects(parseCsv(await readFile(resolve(INPUT_PATH), "utf8")));
  const pending = rows
    .filter((row) => row.assigned_to === owner && row.review_status === "UNREVIEWED")
    .sort(
      (left, right) =>
        Number(left.assignee_sample_number) - Number(right.assignee_sample_number),
    );
  const next = pending[0];

  if (!next) {
    console.log(JSON.stringify({ assignee: owner, next: null, remaining: 0 }, null, 2));
    return;
  }

  const greetingName = firstName(next.name);
  const messages = greetingName
    ? [
        `Hey ${greetingName}, I'm Rohan, a cofounder at Almanac. We're in YC S26.`,
        "We're building CodeAlmanac: open-source, Karpathy-style LLM wikis for coding agents.\nhttps://github.com/AlmanacCode/codealmanac",
        "I'm early and looking for blunt feedback. Would you be open to trying it out?",
      ]
    : null;

  console.log(
    JSON.stringify(
      {
        assignee: owner,
        remaining: pending.length,
        next: {
          login: next.login,
          github_url: next.github_url,
          x_handle: next.twitter_username,
          display_name: next.name,
          queue_position: Number(next.assignee_sample_number),
          requires_name_review: !greetingName,
          messages,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
