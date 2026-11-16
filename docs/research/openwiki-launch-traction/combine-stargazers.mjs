#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const INPUTS = [
  {
    key: "openwiki",
    repo: "langchain-ai/openwiki",
    path: "docs/research/openwiki-launch-traction/openwiki-stargazers-enriched.csv",
  },
  {
    key: "graphify",
    repo: "Graphify-Labs/graphify",
    path: "docs/research/openwiki-launch-traction/graphify-stargazers-enriched.csv",
  },
  {
    key: "codealmanac",
    repo: "AlmanacCode/codealmanac",
    path: "docs/research/openwiki-launch-traction/codealmanac-stargazers-enriched.csv",
  },
  {
    key: "google_okf",
    repo: "GoogleCloudPlatform/knowledge-catalog",
    path: "docs/research/openwiki-launch-traction/google-knowledge-catalog-okf-stargazers-enriched.csv",
  },
];

const DEFAULT_OUTPUT =
  "docs/research/openwiki-launch-traction/combined-stargazers-deduped.csv";

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n\r]/u.test(text)) {
    return `"${text.replace(/"/gu, '""')}"`;
  }

  return text;
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
    const ch = text[index];

    if (ch === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch !== "\r") {
      cell += ch;
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

function firstNonEmpty(existing, next) {
  return existing || next || "";
}

function countTrue(values) {
  return values.filter(Boolean).length;
}

function parseOutputArg(argv) {
  const outputIndex = argv.findIndex((arg) => arg === "--output" || arg === "-o");

  if (outputIndex === -1) {
    return DEFAULT_OUTPUT;
  }

  const output = argv[outputIndex + 1];

  if (!output) {
    throw new Error("Missing output path after --output");
  }

  return output;
}

async function main() {
  const outputPath = resolve(parseOutputArg(process.argv.slice(2)));
  const byLogin = new Map();

  for (const input of INPUTS) {
    const text = await readFile(input.path, "utf8");
    const rows = rowsToObjects(parseCsv(text));

    for (const row of rows) {
      const login = row.login?.trim();

      if (!login) {
        continue;
      }

      const key = login.toLowerCase();
      const existing =
        byLogin.get(key) ??
        {
          login,
          name: "",
          email: "",
          github_url: "",
          avatar_url: "",
          company: "",
          location: "",
          bio: "",
          website_url: "",
          linkedin_url: "",
          twitter_username: "",
          account_created_at: "",
          is_site_admin: "",
          followers_count: "",
          following_count: "",
          public_repositories_count: "",
          repos_starred: [],
        };

      existing.login = existing.login || login;
      existing.name = firstNonEmpty(existing.name, row.name);
      existing.email = firstNonEmpty(existing.email, row.email);
      existing.github_url = firstNonEmpty(existing.github_url, row.github_url);
      existing.avatar_url = firstNonEmpty(existing.avatar_url, row.avatar_url);
      existing.company = firstNonEmpty(existing.company, row.company);
      existing.location = firstNonEmpty(existing.location, row.location);
      existing.bio = firstNonEmpty(existing.bio, row.bio);
      existing.website_url = firstNonEmpty(existing.website_url, row.website_url);
      existing.linkedin_url = firstNonEmpty(existing.linkedin_url, row.linkedin_url);
      existing.twitter_username = firstNonEmpty(
        existing.twitter_username,
        row.twitter_username,
      );
      existing.account_created_at = firstNonEmpty(
        existing.account_created_at,
        row.account_created_at,
      );
      existing.is_site_admin = firstNonEmpty(existing.is_site_admin, row.is_site_admin);
      existing.followers_count = firstNonEmpty(
        existing.followers_count,
        row.followers_count,
      );
      existing.following_count = firstNonEmpty(
        existing.following_count,
        row.following_count,
      );
      existing.public_repositories_count = firstNonEmpty(
        existing.public_repositories_count,
        row.public_repositories_count,
      );

      existing[`starred_${input.key}`] = "TRUE";
      existing[`starred_at_${input.key}`] = row.starred_at;

      if (!existing.repos_starred.includes(input.repo)) {
        existing.repos_starred.push(input.repo);
      }

      byLogin.set(key, existing);
    }
  }

  const headers = [
    "login",
    "name",
    "email",
    "github_url",
    "avatar_url",
    "company",
    "location",
    "bio",
    "website_url",
    "linkedin_url",
    "twitter_username",
    "account_created_at",
    "is_site_admin",
    "followers_count",
    "following_count",
    "public_repositories_count",
    "repo_count",
    "repos_starred",
    "starred_openwiki",
    "starred_graphify",
    "starred_codealmanac",
    "starred_google_okf",
    "starred_at_openwiki",
    "starred_at_graphify",
    "starred_at_codealmanac",
    "starred_at_google_okf",
  ];
  const repoKeys = INPUTS.map((input) => input.key);
  const combinedRows = [...byLogin.values()]
    .map((row) => {
      for (const repoKey of repoKeys) {
        row[`starred_${repoKey}`] = row[`starred_${repoKey}`] || "FALSE";
        row[`starred_at_${repoKey}`] = row[`starred_at_${repoKey}`] || "";
      }

      row.repo_count = countTrue(repoKeys.map((repoKey) => row[`starred_${repoKey}`] === "TRUE"));
      row.repos_starred = row.repos_starred.join("|");
      return row;
    })
    .sort((left, right) => {
      const byRepoCount = Number(right.repo_count) - Number(left.repo_count);
      return byRepoCount || left.login.localeCompare(right.login);
    });

  const csv = [
    csvRow(headers),
    ...combinedRows.map((row) => csvRow(headers.map((header) => row[header]))),
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${csv}\n`, "utf8");

  console.error(`wrote ${combinedRows.length} deduped stargazers to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
