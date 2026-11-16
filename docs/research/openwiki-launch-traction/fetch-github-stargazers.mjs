#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_REPO = "langchain-ai/openwiki";
const DEFAULT_OUTPUT = "docs/research/openwiki-launch-traction/openwiki-stargazers.csv";

function parseArgs(argv) {
  const options = {
    repo: DEFAULT_REPO,
    output: DEFAULT_OUTPUT,
    delayMs: 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if ((arg === "--repo" || arg === "-r") && next) {
      options.repo = next;
      index += 1;
      continue;
    }

    if ((arg === "--output" || arg === "-o") && next) {
      options.output = next;
      index += 1;
      continue;
    }

    if (arg === "--delay-ms" && next) {
      const delayMs = Number.parseInt(next, 10);

      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new Error(`Expected --delay-ms to be a non-negative integer, got ${next}`);
      }

      options.delayMs = delayMs;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  const [owner, name] = options.repo.split("/");

  if (!owner || !name) {
    throw new Error(`Expected --repo owner/name, got ${options.repo}`);
  }

  return { ...options, owner, name };
}

function getToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Set GITHUB_TOKEN or run `gh auth login` before using this script.");
  }
}

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

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function extractLinkedInUrl(...values) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const match = String(value).match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company|pub)\/[^\s"'<>),]+/iu,
    );

    if (!match) {
      continue;
    }

    const raw = match[0].replace(/[.,;:]+$/u, "");
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }

  return null;
}

async function graphQL(token, query, variables) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "codealmanac-openwiki-stargazer-export",
      },
      body: JSON.stringify({ query, variables }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      if (response.status === 403 && bodyText.includes("secondary rate limit")) {
        const waitMs = Math.min(300_000, 60_000 * attempt);
        console.error(
          `GitHub secondary rate limit; waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/8`,
        );
        await sleep(waitMs);
        continue;
      }

      throw new Error(`GitHub GraphQL HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
    }

    const body = JSON.parse(bodyText);

    if (body.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${JSON.stringify(body.errors, null, 2)}`);
    }

    return body.data;
  }

  throw new Error("GitHub GraphQL secondary rate limit persisted after all retries.");
}

async function canReadPublicEmail(token) {
  const query = `
    query EmailScopeCheck {
      repository(owner: "langchain-ai", name: "openwiki") {
        stargazers(first: 1) {
          edges {
            node {
              login
              email
            }
          }
        }
      }
    }
  `;

  try {
    await graphQL(token, query, {});
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("'email' field requires")) {
      return false;
    }

    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = getToken();
  const outputPath = resolve(options.output);
  const rows = [];
  let cursor = null;
  let page = 0;
  let reportedTotal = null;
  const includeEmail = await canReadPublicEmail(token);

  if (!includeEmail) {
    console.error(
      "email unavailable: GitHub token lacks read:user/user:email; leaving email column blank",
    );
  }

  const query = `
    query Stargazers($owner: String!, $name: String!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        stargazerCount
        stargazers(first: 100, after: $cursor, orderBy: { field: STARRED_AT, direction: ASC }) {
          edges {
            starredAt
            node {
              login
              name
              ${includeEmail ? "email" : ""}
              url
              avatarUrl
              company
              location
              bio
              websiteUrl
              twitterUsername
              createdAt
              isSiteAdmin
              followers {
                totalCount
              }
              following {
                totalCount
              }
              repositories {
                totalCount
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      rateLimit {
        remaining
        resetAt
      }
    }
  `;

  for (;;) {
    page += 1;
    const data = await graphQL(token, query, {
      owner: options.owner,
      name: options.name,
      cursor,
    });
    const repo = data.repository;
    const stargazers = repo.stargazers;

    reportedTotal = repo.stargazerCount;

    for (const edge of stargazers.edges) {
      const user = edge.node;
      rows.push({
        repo: options.repo,
        starred_at: edge.starredAt,
        login: user.login,
        name: user.name,
        email: includeEmail ? user.email : null,
        github_url: user.url,
        avatar_url: user.avatarUrl,
        company: user.company,
        location: user.location,
        bio: user.bio,
        website_url: user.websiteUrl,
        linkedin_url: extractLinkedInUrl(user.websiteUrl, user.bio, user.company),
        twitter_username: user.twitterUsername,
        account_created_at: user.createdAt,
        is_site_admin: user.isSiteAdmin,
        followers_count: user.followers.totalCount,
        following_count: user.following.totalCount,
        public_repositories_count: user.repositories.totalCount,
      });
    }

    if (page % 10 === 0 || !stargazers.pageInfo.hasNextPage) {
      console.error(
        `page ${page}: fetched ${rows.length}/${reportedTotal}; rate remaining ${data.rateLimit.remaining}`,
      );
    }

    if (!stargazers.pageInfo.hasNextPage) {
      break;
    }

    cursor = stargazers.pageInfo.endCursor;

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const headers = [
    "repo",
    "starred_at",
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
  ];
  const csv = [
    csvRow(headers),
    ...rows.map((row) => csvRow(headers.map((header) => row[header]))),
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${csv}\n`, "utf8");

  console.error(`wrote ${rows.length} stargazers to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
