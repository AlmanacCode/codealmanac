# Supabase Agent Wiki Coverage Map

This is the demo sitemap for a broad Supabase agent wiki. The map is meant to
make the wiki feel deep and navigable without requiring every page to be fully
written. A small number of pages are polished articles; most pages are stubs.

```text
docs/almanac/

  start-here/
    Building Supabase with Agents

  auth/
    architecture/
      Supabase Auth Session Model
      JWT Claims and Authorization
      Server-Side Auth Boundaries
    how-to-guides/
      Add Auth to a Next.js App
      Protect a Route with Supabase Auth
    skills/
      Supabase Auth Agent Skill
    known-failure-modes/
      Cookie Drift in Server-Side Auth
      Using user_metadata for Authorization
      Deleted Users with Still-Valid JWTs

  database/
    architecture/
      Supabase Postgres Architecture
      Migrations and Schema State
      Data API Grants and Exposed Schemas
    how-to-guides/
      Change a Database Safely
      Create a Migration
      Add an Index for a Slow Query
    skills/
      Supabase Postgres Best Practices Skill
    known-failure-modes/
      Schema Drift
      Missing Foreign Key Indexes
      Long-Running Migration Locks

  rls-security/
    architecture/
      Row Level Security in Supabase
      Policy Evaluation Model
      SECURITY DEFINER and Security Invoker
    how-to-guides/
      Write RLS Policies
      Debug RLS Policies
      Run Security Advisors
    skills/
      RLS Policy Writing Skill
      Security Advisor Review Skill
    known-failure-modes/
      RLS Disabled on Public Tables
      Policies Exist but RLS Is Off
      Views Bypassing RLS
      Overly Permissive Policies

  storage/
    architecture/
      Supabase Storage Access Model
      Storage Buckets and Object Policies
    how-to-guides/
      Create an Avatar Upload Flow
      Write Storage Policies
    skills/
      Storage Policy Agent Skill
    known-failure-modes/
      Upsert Without SELECT and UPDATE
      Public Bucket Listing Exposure

  edge-functions/
    architecture/
      Supabase Edge Functions Runtime
      Function Secrets and Environment Variables
    how-to-guides/
      Deploy an Edge Function
      Call a Function from an App
    skills/
      Edge Functions Agent Skill
    known-failure-modes/
      Missing Secrets in Production
      Function Auth Bypass

  realtime/
    architecture/
      Supabase Realtime Model
      Realtime and RLS
    how-to-guides/
      Subscribe to Table Changes
      Filter Realtime Events
    skills/
      Realtime Agent Skill
    known-failure-modes/
      Client-Side Filtering of Sensitive Events

  ai-agent-tooling/
    architecture/
      Supabase MCP Server
      Supabase CLI for Agents
      Supabase Agent Skills
    how-to-guides/
      Configure Supabase MCP in Codex
      Use the CLI Without Guessing Commands
    skills/
      Core Supabase Agent Skill
      Postgres Best Practices Skill
    known-failure-modes/
      Invalid Codex MCP Config
      Stale Docs and API Drift
      MCP Connected to Production
```

Demo writing target: 1-2 polished articles, with the rest as empty or near-empty
stubs that show the intended wiki graph.
