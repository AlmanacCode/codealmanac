---
title: Row Level Security in Supabase
page_type: concept
manuals:
  - src/codealmanac/manual/how-to-write.md
  - src/codealmanac/manual/links.md
  - src/codealmanac/manual/sources.md
sources:
  - id: row-level-security-doc
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/official/security-and-production/row-level-security.md
    note: Official Supabase RLS guide covering exposed schemas, policies, roles, helper functions, and performance recommendations.
  - id: securing-api-doc
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/official/security-and-production/securing-your-api.md
    note: Official Data API security guide explaining grants, RLS, exposed schemas, and function access.
  - id: rls-disabled-lint
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/github/splinter-docs/0013_rls_disabled_in_public.md
    note: Supabase linter warning for public tables without RLS.
  - id: supabase-skill
    type: file
    path: /Users/kushagrachitkara/Documents/almanac/supabase/github/agent-skills/skills/supabase/SKILL.md
    note: Supabase agent skill requiring RLS on exposed schemas and real access-model policies.
---

# Row Level Security in Supabase

Row Level Security in Supabase is the database layer that decides which rows a request can read or change. It sits between [[supabase-auth-session-model]], [[supabase-jwt-claims-and-authorization]], [[data-api-grants-and-exposed-schemas]], and application features such as [[supabase-storage-access-model]] or [[realtime-and-rls]]. Supabase's official guidance says RLS must always be enabled on tables in exposed schemas, with `public` exposed by default. [@row-level-security-doc]

RLS matters because Supabase is designed for direct browser-to-database access through generated APIs. Supabase says that browser access is convenient and secure as long as RLS is enabled, and it warns that a granted table without RLS can be reached by roles such as `anon`. [@row-level-security-doc] [@securing-api-doc] That makes [[rls-disabled-on-public-tables]], [[policies-exist-but-rls-is-off]], and [[overly-permissive-policies]] first-class failure modes rather than edge cases.

## Exposed Schemas

Supabase separates object reachability from row authorization. [[data-api-grants-and-exposed-schemas|Grants]] determine whether roles such as `anon`, `authenticated`, and `service_role` can reach a table, view, or function through the Data API, while RLS policies decide which rows those roles can access. [@securing-api-doc]

This distinction is essential for [[supabase-cli-for-agents]], [[supabase-mcp-server]], and [[changing-a-supabase-database-safely]] work. If an agent creates a SQL table in an exposed schema, it must check both grants and RLS instead of assuming the table is private by default. [@securing-api-doc] The [[core-supabase-agent-skill]] makes this rule explicit: enable RLS on every table in an exposed schema and write policies for the actual access model. [@supabase-skill]

## Policies as Row Filters

Supabase describes policies as Postgres rules attached to tables and evaluated whenever a table is accessed. [@row-level-security-doc] A simple select policy using `(select auth.uid()) = user_id` behaves like an implicit `where` clause that filters rows to the current user. [@row-level-security-doc] The planned [[policy-evaluation-model]] page is the deeper architecture page for how those checks compose.

Policies are operation-specific. Supabase documents `USING` for `SELECT` and `DELETE`, `WITH CHECK` for `INSERT`, and both `USING` and `WITH CHECK` for `UPDATE`. [@row-level-security-doc] Those exact rules are the basis for [[writing-rls-policies]], [[rls-policy-writing-skill]], and [[run-security-advisors]].

## Auth Roles and Claims

Supabase maps unauthenticated requests to the `anon` Postgres role and authenticated requests to the `authenticated` Postgres role. [@row-level-security-doc] Policies can target those roles with the `TO` clause, which also prevents unnecessary policy evaluation for roles that should never pass. [@row-level-security-doc] That role boundary is easy to blur when adding [[add-auth-to-a-nextjs-app]] or [[protect-a-route-with-supabase-auth]].

Policies can read identity through `auth.uid()` and claims through `auth.jwt()`. [@row-level-security-doc] That connects RLS to [[supabase-auth-session-model]] and [[supabase-jwt-claims-and-authorization]] because a missing session, stale JWT, or unsafe claim source changes what the policy sees. [@row-level-security-doc] The failure-mode side of that contract includes [[using-user-metadata-for-authorization]], [[deleted-users-with-still-valid-jwts]], and [[cookie-drift-in-server-side-auth]].

## Failure Mode

The Supabase linter treats a public table without RLS as an error because anyone with the project URL can access all data allowed by grants. [@rls-disabled-lint] The same lint recommends enabling RLS with `alter table <schema>.<table> enable row level security`. [@rls-disabled-lint] This is why [[run-security-advisors]], [[security-advisor-review-skill]], and [[stale-docs-and-api-drift]] belong close to the core RLS article.

RLS is not a complete security program by itself. Supabase's Data API guide says functions are not governed by RLS and must be controlled with `EXECUTE` grants and careful review of any `SECURITY DEFINER` functions. [@securing-api-doc] That edge is covered in [[security-definer-and-security-invoker]], [[views-bypassing-rls]], and [[function-auth-bypass]].

## Adjacent Product Surfaces

RLS also shows up outside ordinary table reads. [[storage-buckets-and-object-policies]] and [[upsert-without-select-and-update]] cover Storage policy behavior, while [[client-side-filtering-of-sensitive-events]] covers the Realtime mistake of sending sensitive events and filtering them only in the browser.

Database work brings its own adjacent pages. [[migrations-and-schema-state]], [[create-a-migration]], and [[schema-drift]] explain how policy changes become durable files, while [[supabase-postgres-best-practices-skill]], [[add-an-index-for-a-slow-query]], and [[missing-foreign-key-indexes]] cover the performance side of policy predicates.
