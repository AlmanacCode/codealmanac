#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INPUT_PATHS = [
  "docs/research/openwiki-launch-traction/twitter-stargazers.csv",
  "docs/research/openwiki-launch-traction/twitter-stargazers-sample-300-assigned.csv",
];

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

function parseArguments(argv) {
  const loginIndex = argv.findIndex((arg) => arg === "--login");
  const login = argv[loginIndex + 1]?.trim();
  const statusIndex = argv.findIndex((arg) => arg === "--status");
  const status = statusIndex === -1 ? "DM_SENT" : argv[statusIndex + 1]?.trim();

  if (loginIndex === -1 || !login || !status) {
    throw new Error(
      "Usage: mark-twitter-dm-sent.mjs --login <github-login> [--status <status>]",
    );
  }

  return { login: login.toLowerCase(), status };
}

async function markStatus(path, login, status) {
  const rows = parseCsv(await readFile(path, "utf8"));
  const [headers, ...dataRows] = rows;
  const loginIndex = headers.indexOf("login");
  const statusIndex = headers.indexOf("review_status");

  if (loginIndex === -1 || statusIndex === -1) {
    throw new Error(`${path} must have login and review_status columns.`);
  }

  let matches = 0;
  for (const row of dataRows) {
    if (row[loginIndex]?.trim().toLowerCase() === login) {
      row[statusIndex] = status;
      matches += 1;
    }
  }

  if (matches !== 1) {
    throw new Error(`${path} expected one ${login} row; found ${matches}.`);
  }

  await writeFile(path, [csvRow(headers), ...dataRows.map(csvRow)].join("\n"));
  return path;
}

async function main() {
  const { login, status } = parseArguments(process.argv.slice(2));
  const updatedPaths = [];

  for (const inputPath of INPUT_PATHS) {
    updatedPaths.push(await markStatus(resolve(inputPath), login, status));
  }

  console.log(JSON.stringify({ login, review_status: status, updatedPaths }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
