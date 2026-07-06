---
title: Building Supabase with Agents
page_type: concept
manuals:
  - src/codealmanac/manual/how-to-write.md
  - src/codealmanac/manual/links.md
  - src/codealmanac/manual/sources.md
sources:
  - id: supabase-agent-skills-blog
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/blogs/supabase-agent-skills.md
    note: Supabase announcement explaining why agents need skills, MCP, current docs, and security guidance.
  - id: supabase-skill
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/github/agent-skills/skills/supabase/SKILL.md
    note: Supabase core agent skill with current workflow, security, CLI, MCP, and schema-change rules.
  - id: mcp-docs
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/official/ai-tools/mcp.md
    note: Official Supabase MCP setup and security guidance.
  - id: postgres-agent-skills-blog
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/blogs/postgres-best-practices-for-ai-agents.md
    note: Supabase explanation of Postgres best-practice skills for agents.
---

# Building Supabase with Agents

Building Supabase with agents means giving an AI coding agent both access and judgment. Supabase gives agents access through the [[supabase-mcp-server]] and the [[supabase-cli-for-agents]], while agent skills tell them to verify current docs, protect user data with [[row-level-security-in-supabase]], and avoid common Supabase-specific mistakes. [@supabase-agent-skills-blog] [@supabase-skill]

The main risk is that an agent can know Supabase in general while still using it incorrectly. Supabase says agents have skipped RLS policies, hallucinated CLI commands, created views that bypass RLS, and ignored current documentation in favor of stale training data. [@supabase-agent-skills-blog] The safe workflow is to combine current documentation, scoped tooling, schema verification, advisor checks, and explicit security rules before a migration reaches production. [@supabase-skill]

## Tooling Surface

Supabase exposes two agent-facing work surfaces. MCP gives structured tools for database queries, schema inspection, migrations, advisors, logs, project metadata, docs search, Edge Functions, branching, and optional Storage access. [@mcp-docs] The CLI gives a shell interface that agents can inspect with `supabase --help`, `supabase <group> --help`, and command-specific help before running commands. [@supabase-skill]

These tools are not interchangeable. MCP is built for agent workflows and can be scoped with `project_ref`, `read_only`, and `features` URL parameters. [@mcp-docs] The CLI is useful when the agent has a local shell, a Supabase project directory, and migrations or local development commands to run. [@supabase-skill]

## Security Baseline

Supabase's agent skill puts the critical security checks directly in `SKILL.md` because agents may skip extra reference files. [@supabase-agent-skills-blog] The checks include never using `user_metadata` for authorization, never exposing service-role or secret keys in public clients, setting `security_invoker = true` on views that should respect RLS, and treating `SECURITY DEFINER` functions as privileged code. [@supabase-skill]

RLS is the center of the model. Tables in exposed schemas should have RLS enabled, and policies should encode the real access model instead of copying a single `auth.uid()` pattern everywhere. [@supabase-skill] That makes [[supabase-auth-session-model]], [[supabase-jwt-claims-and-authorization]], and [[writing-rls-policies]] part of one authorization system rather than separate implementation details.

## Schema Workflow

Agents can iterate on schema changes with MCP `execute_sql` or CLI `supabase db query` before creating a migration. [@supabase-skill] Supabase's agent skill warns against using MCP `apply_migration` for local iterative schema changes because it writes migration history entries on every call. [@supabase-skill]

Once the schema stabilizes, the agent should run advisors, review the security checklist, generate a migration with `supabase db pull <name> --local --yes`, and verify the local migration list. [@supabase-skill] This separates development exploration from [[migrations-and-schema-state]], where committed files become the durable database history.

## Why Skills Matter

Supabase's Postgres best-practices work packages query performance, connection management, security and RLS, schema design, locking, data access, monitoring, and advanced Postgres features into agent-readable rules. [@postgres-agent-skills-blog] The MCP server gives an agent the ability to change a project, but the skills give it the operating rules for using that ability correctly. [@postgres-agent-skills-blog]

The practical starting point is therefore simple: load Supabase guidance, connect only to local or development data, inspect current docs, make the smallest safe database change, run advisors, and write the migration only after the model is stable. [@supabase-skill] That workflow is the common base for the rest of this wiki.
