#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INPUT_PATH = "docs/research/openwiki-launch-traction/combined-stargazers-deduped.csv";
const TWITTER_OUTPUT_PATH =
  "docs/research/openwiki-launch-traction/twitter-stargazers.csv";
const SAMPLE_OUTPUT_PATH =
  "docs/research/openwiki-launch-traction/twitter-stargazers-sample-300-assigned.csv";
const OWNERS = ["Rohan", "Kushagra", "Divit"];
const SAMPLE_SIZE = 300;
const RANDOM_SEED = 20260709;

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function csvRow(values) {
  return values.map(csvCell).join(",");
}

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

function rowsToObjects(rows) {
  const [headers, ...dataRows] = rows;

  return dataRows
    .filter((row) => row.length > 1 || row[0])
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    );
}

function mulberry32(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled(rows, seed) {
  const shuffledRows = [...rows];
  const random = mulberry32(seed);

  for (let index = shuffledRows.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffledRows[index], shuffledRows[randomIndex]] = [
      shuffledRows[randomIndex],
      shuffledRows[index],
    ];
  }

  return shuffledRows;
}

function toCsv(headers, rows) {
  return [
    csvRow(headers),
    ...rows.map((row) => csvRow(headers.map((header) => row[header] ?? ""))),
  ].join("\n");
}

async function main() {
  const inputPath = resolve(INPUT_PATH);
  const twitterOutputPath = resolve(TWITTER_OUTPUT_PATH);
  const sampleOutputPath = resolve(SAMPLE_OUTPUT_PATH);
  const rows = rowsToObjects(parseCsv(await readFile(inputPath, "utf8")));
  const twitterRows = rows.filter((row) => row.twitter_username.trim());

  if (twitterRows.length < SAMPLE_SIZE) {
    throw new Error(`Need ${SAMPLE_SIZE} Twitter profiles; found ${twitterRows.length}.`);
  }

  const sample = shuffled(twitterRows, RANDOM_SEED).slice(0, SAMPLE_SIZE);
  const perOwner = SAMPLE_SIZE / OWNERS.length;

  if (!Number.isInteger(perOwner)) {
    throw new Error("Sample size must divide evenly among owners.");
  }

  const selectedByLogin = new Map(
    sample.map((row, index) => {
      const ownerIndex = Math.floor(index / perOwner);
      return [
        row.login.toLowerCase(),
        {
          sample_number: index + 1,
          assigned_to: OWNERS[ownerIndex],
          assignee_sample_number: (index % perOwner) + 1,
        },
      ];
    }),
  );

  const assignmentHeaders = [
    "sampled_for_review",
    "sample_number",
    "assigned_to",
    "assignee_sample_number",
    "review_status",
  ];
  const sourceHeaders = Object.keys(twitterRows[0]);
  const headers = [...assignmentHeaders, ...sourceHeaders];
  const markedTwitterRows = twitterRows.map((row) => {
    const assignment = selectedByLogin.get(row.login.toLowerCase());

    return {
      ...row,
      sampled_for_review: assignment ? "TRUE" : "FALSE",
      sample_number: assignment?.sample_number ?? "",
      assigned_to: assignment?.assigned_to ?? "",
      assignee_sample_number: assignment?.assignee_sample_number ?? "",
      review_status: assignment ? "UNREVIEWED" : "",
    };
  });
  const sampleRows = sample.map((row) => {
    const assignment = selectedByLogin.get(row.login.toLowerCase());

    return {
      ...row,
      sampled_for_review: "TRUE",
      sample_number: assignment.sample_number,
      assigned_to: assignment.assigned_to,
      assignee_sample_number: assignment.assignee_sample_number,
      review_status: "UNREVIEWED",
    };
  });

  await writeFile(twitterOutputPath, toCsv(headers, markedTwitterRows));
  await writeFile(sampleOutputPath, toCsv(headers, sampleRows));

  const counts = Object.fromEntries(
    OWNERS.map((owner) => [
      owner,
      sampleRows.filter((row) => row.assigned_to === owner).length,
    ]),
  );
  console.log(
    JSON.stringify(
      {
        seed: RANDOM_SEED,
        twitterProfiles: twitterRows.length,
        sampleSize: sampleRows.length,
        assignments: counts,
        twitterOutputPath,
        sampleOutputPath,
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
