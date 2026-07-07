# Run triggers, local database, and repository targeting

Date: 2026-07-06

Status: working decision note. This records the model we want before changing code.

This is a breaking architectural refactor.

The final code shape is what counts.

Do not preserve half-migrated concepts, compatibility aliases, duplicate names,
or parallel storage paths just to make the migration feel smaller.

No defensive migration path is required for this refactor. No one is depending
on the old local state shape, so do not build compatibility machinery for it.

The goal is not to keep old internals working. The goal is to arrive at a clean
architecture where the code reads as if it was designed this way from the start.

Code quality is the standard. Move slowly, refactor deliberately, and stop only
when the names, boundaries, persistence model, tests, and terminal behavior feel
excellent together. The desired end state is code we can look back on and say:
this is a 10/10 architecture for this product.

Keep applying boundary pressure while building. If a name, model, function, or
module feels like it is hiding a product concept, stop and reshape it.

Follow the Python guide: shaped data uses Pydantic models, stable choices use
enums or `Literal`, services own product verbs, stores own persistence, and
CLI code stays thin.

Prefer request objects for service entry points, following the Cosmic Python
command/request shape. A public service method should usually accept one typed
request model rather than a loose cluster of parameters once the input has real
shape.

Avoid internal-looking functions. Single-underscore functions should be
exceptional. If a function names a stable policy, workflow step, model
conversion, persistence behavior, or product concept, give it a clear public
home instead of burying it as an implementation detail.

Use consistent product errors in models and services. Do not scatter defensive
`ValueError` text, loose dictionaries, or one-off validation branches where a
typed request, model validator, enum, or domain error would make the shape
clearer.

Product errors should read like product facts. `AlreadyExists` for
`almanac/ already exists here` is the right kind of code: short, specific, and
stable enough for CLI/API rendering.

## Product model

CodeAlmanac has triggers and runs.

A trigger is why work starts.

A run is the work itself.

The same run kind can come from different triggers. `garden` can come from a manual command or from the machine schedule. `ingest` can come from a manual command, scheduled sync, or a future trigger. The runner should not care which trigger created the run.

## Simple nouns

- Run: one unit of agent work that can change `almanac/`.
- Run kind: `build`, `ingest`, or `garden`.
- Queued run: a run waiting to start.
- Worker: the process that claims queued runs and executes them.
- Repository: one registered repo root with a local `almanac/` tree.
- Local database: `~/.codealmanac/codealmanac.db`, the machine-level database for registered repositories, runs, run events, sync state, and worker locks.
- Schedule: a machine-level trigger that creates runs.

Use these names in code unless a narrower name is genuinely clearer. Avoid names like `WikiOperation`, `RunQueueWorkflow`, `PageRunWorkflow`, `Job`, and `Command`; they make the product model harder to read.

## Runs

The current run kinds are:

- `build`: create a new `almanac/` tree for a repo.
- `ingest`: read source material and update the repository's wiki.
- `garden`: maintain an existing repository wiki.

`init` is a command trigger for a `build` run. `build` does not need to be the public command name.

## Local database

The local database is machine-level state.

Use SQLite for the local database.

The target path is:

```text
~/.codealmanac/codealmanac.db
```

It owns:

- registered repositories
- runs
- run events
- sync state
- worker locks

In code, derive machine-level paths once at the composition root as
`LocalStatePaths`. Services should receive concrete paths from that value
instead of rediscovering `~/.codealmanac`, reaching through repository stores, or
repeating `database_path.parent`.

Retire `~/.codealmanac/registry.json`. Repository registration belongs in the local database.

Do not migrate `registry.json`. Do not read it as a fallback. Do not keep it as
a parallel source of truth. This is a breaking change.

Registration happens when `codealmanac init /path/to/repo` succeeds.

Read commands may also auto-register, but only in the exact current directory, and only when that directory directly contains a valid `almanac/` tree.

Auto-registration must not search parents.

Auto-registration must not use a containing registered repository.

## Root hopping is banned

Do not walk upward from the current directory to find `almanac/`.

Do not silently choose a registered parent repository.

Do not make this work:

```bash
cd project/src/codealmanac/services/repositories
codealmanac search queue
```

That command should stop unless this exact directory is a registered repository root or the user passes `--wiki`.

The standard matching rule is exact cwd matching:

```text
current directory == registered repository root
```

For auto-registration, the standard local check is:

```text
current directory contains ./almanac/
```

Nested repos are not our problem. If a user explicitly initializes a nested directory, that is their choice.

## CLI targeting

CLI commands that need an existing repository must target one of:

- the exact current directory, when it is a registered repository root
- an explicit `--wiki <name>`

If neither target is available, stop with a clear message.

Example:

```text
No repository selected.
Run from a registered repository root or pass --wiki <name>.
```

`codealmanac garden` can still exist as a manual local command.

Manual `garden` targets:

- exact cwd registered repository root
- or `--wiki <name>`

Manual `garden` must stop when neither target is present.

Manual `ingest` follows the same targeting rule unless it is given an explicit future target flag.

Read commands follow the same rule, with one extra convenience: if cwd directly contains a valid `almanac/`, they may register that exact cwd first.

In code, use separate repository selection methods for these two policies.
Operation triggers use strict registered-root selection. Read commands use the
read-target selection that may auto-register only the exact cwd.

Do not hide this difference behind one generic resolver. That is how root
hopping comes back.

## Init

`codealmanac init /path/to/repo` targets exactly `/path/to/repo`.

It creates and registers:

```text
/path/to/repo/almanac/
```

`init` must not root-hop.

`init` must not refresh a parent repository.

`init` must stop if the target directory already contains `almanac/`.

The failure should be plain:

```text
almanac/ already exists here.
Use the existing repository wiki or choose a different directory.
```

We are not adding a remove command just to protect users from nested setup mistakes.

`init` owns deterministic setup only:

- create the repository row in the local database
- create `almanac/`
- create the minimal home files, including `almanac/README.md` and `almanac/topics.yaml`

The `build` run owns the first real wiki creation:

- initial pages
- topic shape beyond the minimal file
- source-backed repository understanding
- agent-authored wiki content

That means `init` is deterministic repository setup plus a `build` run trigger.
If deterministic setup fails, `init` fails. If the agent fails, the `build` run
fails and the repository still has its minimal wiki home.

## Run queue

There is one machine-level run queue.

The queue is stored in the local database.

The queue is not file-based.

The queue is not per-repository.

Every queued run has an explicit target repository.

`codealmanac jobs` reads this machine-level queue by default.

`codealmanac jobs --wiki <name>` filters the queue to one repository.

Run workers drain this same queue. A worker may be spawned from a repository
context, but that does not create a separate repository queue.

The worker claims the next queued run, executes it, records the result, and moves on.

On success, the run is done.

On failure, the run is failed and removed from active queue processing. Do not add retry, retryable, or needs-attention behavior yet.

`--now` is a future manual trigger option. It should mean "put this run at the
front" or "run it immediately if nothing is active." It should still create a
normal run record.

Example:

```bash
codealmanac ingest note.md --now
```

The shared runner for page-changing work is `OperationRunner`. It owns the
common begin, preflight, harness execution, run events, health validation, and
failure recording path for build, ingest, and garden.

Do not call this `PageRunWorkflow`. It is not a separate product feature. It is
the common runner for operations that change the repository wiki.

## Scheduled sync

Scheduled sync is a machine-level trigger.

Every few hours it:

1. Reads registered repositories from the local database.
2. Finds transcript files active in the sync window.
3. Reads each transcript identity, including its cwd.
4. Matches each transcript cwd to a registered repository path.
5. Groups active transcript files by repository.
6. Queues one ingest run per repository with that repository's active transcript files.
7. Ignores transcripts whose cwd does not match a registered repository.

Scheduled sync must not root-hop.

Scheduled sync must not infer a repository from a parent directory.

Transcript discovery should report transcript facts only: app, session id,
transcript path, cwd, modified time, and size. It should not precompute a
repository root or an `almanac/` path. Repository matching belongs to sync and
uses registered repository roots.

Use one skipped bucket for transcript-level misses, including inactive,
unregistered cwd, queue failure, or worker spawn failure. Do not add a separate
`needs_attention` category.

## Scheduled garden

Scheduled garden is a machine-level trigger.

Every few hours it:

1. Reads registered repositories from the local database.
2. Queues one garden run for every registered repository.
3. Lets the single worker process those runs.

Garden configuration is machine-level, not wiki-level.

There is no special per-repository garden scheduler.

Future automation can change this policy. Today's policy is simple: garden all registered repositories on the schedule.

Automatic triggers may avoid duplicate queued/running runs when the check is
simple and general. Manual triggers can intentionally create another run.

Do not overbuild duplicate prevention. If avoiding duplicates requires special
case logic that makes the run model harder to read, queue the run and keep the
system simple.

## Terminal output requirements

Terminal output is product behavior.

When a run is queued, show:

- run kind
- run id
- repository
- queue position or runs ahead
- attach/follow command

Example:

```text
◆ garden queued  garden-20260706-def456
│ repo:    codealmanac
│ ahead:   3 runs
│ follow:  codealmanac jobs attach garden-20260706-def456
```

There is no separate foreground execution mode.

The command always creates a run.

The terminal can attach to that run.

`--wait` is shorthand for "create the run, then attach until it finishes."

When a terminal attaches to a run, show the same identity immediately:

```text
◆ ingest started  ingest-20260706-abc123
│ repo:    codealmanac
│ source:  note.md
│ follow:  codealmanac jobs attach ingest-20260706-abc123
```

When it finishes, show the result:

```text
✓ ingest finished  ingest-20260706-abc123
│ status:   done
│ changed:  3 files
│ health:   clean
```

When it fails, keep it simple:

```text
✗ garden failed  garden-20260706-def456
│ repo:   codealmanac
│ error:  agent exited with status 1
│ logs:   codealmanac jobs logs garden-20260706-def456
```

Do not hide the real terminal UI behind vague "started successfully" text. The queue and run identity should be visible because users need to understand what the machine is doing.

## Architecture direction

Keep these responsibilities separate:

- CLI parser: reads command flags.
- Trigger handler: turns a command or schedule into a run request.
- Local database: stores repository registration, run order, run state, run events, sync state, and worker locks.
- Worker: runs queued runs.
- Run services: implement `build`, `ingest`, and `garden`.
- Renderer: prints human output from run state and run results.

The trigger handler chooses what work should happen.

The run service performs the work.

The renderer describes what happened.

Do not let CLI dispatch become the place that knows all run choreography.
