# CLI Surface Design — Mental Model and Conventions

Compiled while redesigning the `almanac` command surface (agents/setup/config and the new top-level groups). Read this when (1) adding a new command and choosing whether it should be a flat verb, a noun-verb pair, or live under an existing group; (2) deciding whether a parameter is positional, a flag, an env var, or config; (3) picking short-flag letters; (4) shaping `--json` / dangerous-action / confirmation behaviour. The goal is the *mental model* — the rationale behind the conventions — so future design calls don't need to re-derive them. Section 13 translates the findings into specific recommendations for codealmanac.

Authoritative sources, used throughout: [clig.dev](https://clig.dev/) (the modern consensus), [POSIX Utility Conventions ch. 12](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html) (the substrate everyone diverges from), [GNU Coding Standards §25](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html) (long-flag conventions), [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide), and [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46) (Jeff Dickey, oclif). Where they disagree, I say so and note where modern practice has landed.

---

## 1. The mental model in five questions

Before any per-topic detail, here is the decision tree most CLI design questions reduce to. When you're choosing the shape of a new command or parameter, walk these in order.

**Q1. Is this a verb or a noun?** Commands are verbs (`create`, `list`, `show`, `delete`); the things they act on are nouns (`pr`, `pod`, `app`, `agent`). Heroku's rule, near-verbatim: "topics are plural nouns and commands are verbs." If you can't decide, the thing is probably a noun and you haven't named the verb yet.

**Q2. Is this parameter *the thing the command operates on*, or is it *how* the command operates?** The thing is a positional argument; the how is a flag. `git commit <files>` would be wrong because `<files>` aren't what `commit` operates on — the staged index is — so the message goes in `-m` and files (when used) go after `--`. `cp <src> <dst>` is positional because both args *are* the operation. This single distinction resolves most positional-vs-flag arguments.

**Q3. How often does this value change relative to the user's session?** clig.dev's [Configuration section](https://clig.dev/#configuration) frames this as *specificity, stability, and complexity*. Per-invocation → flag. Per-shell-session or per-machine → env var (with a flag override). Per-project, version-controlled → config file. The same value can plausibly live in all three; the precedence is fixed (flag > env > project > user > system > default) and codified in [clig.dev's precedence list](https://clig.dev/#configuration).

**Q4. If you remove this parameter, does the command still make sense?** If yes, it's optional and should be a flag. If no, it's required — and even then, prefer a required flag over a positional whenever (a) there are two or more required values that aren't obviously ordered, or (b) the value would be confusing as a bare token (`heroku fork --from src --to dst` beats `heroku fork src dst`).

**Q5. Will this parameter ever be misused destructively?** If yes, it needs interactive confirmation by default and a `--yes` / `--force` to skip; or no prompt and a `--confirm=<name>` to gate. clig.dev splits this into Mild / Moderate / Severe; [section 9](#9-confirmation-force-yes) covers the matrix.

These five questions plus one taste call ("does this deserve a subcommand group, or is the surface still flat enough that a verb suffices?" — section 3) cover ~90% of CLI design. The rest of this doc is the rationale and the corner cases.

---

## 2. Positional arguments vs flags

### Definitions

clig.dev: *Arguments (or args) are positional parameters; flags are named parameters denoted with a hyphen and a letter (`-r`) or two hyphens and a word (`--recursive`), optionally with a user-specified value.* Order of args is significant (`cp foo bar` ≠ `cp bar foo`); order of flags is generally not.

POSIX uses a more careful vocabulary: *options* (the `-r`), *option-arguments* (the value after `-r`), and *operands* (the positional values after all options). [POSIX 12.1](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html) requires "All options should precede operands on the command line" (Guideline 9). Modern parsers (Cobra, clap, oclif, commander) relax this — flags can appear anywhere — but the POSIX form is still the safe assumption when scripting.

### The default: prefer flags

clig.dev: **"Prefer flags to args. It's a bit more typing, but it makes it much clearer what is going on. It also makes it easier to make changes to how you accept input in the future."** Heroku says the same thing more strongly: when `heroku fork` accepted `heroku fork destapp -a sourceapp`, "this is confusing to the user since it isn't clear which app they are forking from and which one they are forking to. By switching to required flags, we instead expect input in this form: `heroku fork --from sourceapp --to destapp`."

### When positionals are correct

Positionals are correct when the value *is* the operand of the verb and the order is either obvious or there's only one:

- `cat <file>...`, `rm <file>...` — multiple of one thing; trivially globbable (`rm *.log`).
- `cp <src> <dst>`, `mv <src> <dst>` — common enough that the order is muscle memory.
- `git show <ref>`, `gh repo clone <repo>`, `kubectl describe pod <name>` — the verb's direct object.
- `almanac show <slug>`, `almanac topics show <topic>` — same pattern.

clig.dev's rule of thumb: **"If you've got two or more arguments for different things, you're probably doing something wrong. The exception is a common, primary action, where the brevity is worth memorizing."** `cp src dst` earns it; `heroku fork src dst` doesn't.

### Why `git commit -m "msg"` is a flag, not a positional

The message is metadata about the operation, not the operation's object. The object is the staged index, which `commit` reads implicitly. If `-m` were positional, then (a) the order vs. file paths would be ambiguous (`git commit "msg" file.c` — is the message a file?), and (b) you couldn't omit it to fall through to `$EDITOR`. Flag form sidesteps both.

### When required values still belong in flags

POSIX Guideline 7 says "Option-arguments should not be optional" — but that's about whether an option's *value* is optional, not about whether the option itself is. Modern practice freely uses required flags. The Heroku case (`fork --from --to`) is the canonical justification: two values, neither obviously ordered, both required → two required flags beats two positionals.

---

## 3. Subcommands: when and how to nest

### The flat-vs-nested spectrum

| Tool | Style | Example | Why |
|------|-------|---------|-----|
| `npm` | Flat verbs | `npm install`, `npm publish`, `npm run` | Small noun set (always packages); verbs differentiate |
| `cargo` | Flat verbs | `cargo build`, `cargo test`, `cargo install` | Same — single primary noun (the crate) |
| `terraform` | Flat verbs | `terraform plan`, `terraform apply` | Single noun (the workspace state) |
| `git` | Flat-ish, with grouped subcommands | `git commit`, `git remote add`, `git submodule update` | Many nouns, but most are commit-graph operations; nesting reserved for sub-objects |
| `gh` | Noun-verb (mostly) | `gh pr create`, `gh repo clone`, `gh issue list` | Many distinct nouns (PRs, issues, repos, runs, gists) |
| `kubectl` | Verb-noun | `kubectl get pods`, `kubectl describe pod nginx` | Verbs apply uniformly to ~30 resource types |
| `aws` | Service-action | `aws s3 ls`, `aws ec2 describe-instances` | Each AWS service is its own world |
| `docker` | Both, by accident | `docker ps` (legacy) and `docker container ls` (canonical) | Migration in progress since [Docker 1.13, 2017](https://www.docker.com/blog/whats-new-in-docker-1-13/); both retained for compatibility |

### The principle behind the choice

The shape follows the noun cardinality:
- **One dominant noun** → flat verbs (npm/cargo/terraform). Adding `npm package install` would be redundant; everything `npm` does is to packages.
- **Many distinct nouns, few verbs per noun** → noun-verb (gh, docker container ls). The noun disambiguates; verbs are short and not always the same across nouns.
- **Many nouns, uniform verb set** → verb-noun (kubectl). `get / describe / delete / apply / edit` apply to almost every resource, so leading with the verb is more discoverable.
- **Independent product surfaces under one binary** → service-action (aws, gcloud). Each service is effectively its own CLI.

### Why `git remote add` and not `git add-remote`

clig.dev: *"If you've got a tool that's sufficiently complex, you can reduce its complexity by making a set of subcommands. They're useful for sharing stuff — global flags, help text, configuration, storage mechanisms."*

`git remote` is the noun group. Under it: `add`, `remove`, `rename`, `set-url`, `show`, `prune`. They share help, they share the assumption that you're operating on the remote table, they share the storage location (`.git/config` `[remote "..."]` blocks). Hyphenating to `git add-remote` would scatter related operations across the top-level help output and force everyone to remember six unrelated verbs. Grouping turns it into "you remember `git remote`, then `--help` tells you the verbs."

The same logic explains the docker migration. `docker ps`, `docker images`, `docker rmi`, `docker rm` evolved organically into a 40+ verb top-level surface where related operations had unrelated names. Docker 1.13 introduced `docker container ls`, `docker image rm`, `docker network ls`, etc., grouping by noun. The old commands [stayed as aliases](https://www.docker.com/blog/whats-new-in-docker-1-13/) because removing them would break the world; new commands typically go under the grouped form.

### When *not* to nest

- When you have one obvious noun. `npm install` is shorter and clearer than `npm package install`. clig.dev would call adding the noun "compromising usability for consistency."
- When the verbs are highly noun-specific. `git rebase` doesn't belong under `git branch rebase` because rebasing isn't a method *of* a branch — it's a top-level history operation that takes a branch as an argument.
- When the surface is small. < ~10 commands → flat is fine.

### Don't have catch-all subcommands

clig.dev: **"Don't have a catch-all subcommand."** If `mycmd run echo "hi"` works and so does `mycmd echo "hi"` (assuming `echo` isn't a known subcommand), you can never add a real `mycmd echo` without breaking scripts. Same lesson: **don't allow arbitrary abbreviations**. If `mycmd i` is an alias for `mycmd install` today, no future command can start with `i`. Aliases must be explicit and stable.

### Don't have ambiguous siblings

clig.dev: *"Having two subcommands called 'update' and 'upgrade' is quite confusing."* (Familiar to anyone who has ever typed `brew update` when they meant `brew upgrade`.)

---

## 4. Short flags vs long flags

POSIX [Guideline 3](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html#tag_12_02): *"Each option name should be a single alphanumeric character… Multi-digit options should not be allowed."* That's the strict POSIX form (`-r`, `-f`, no `--recursive`). GNU extended this with double-hyphen long flags decades ago, and modern CLIs offer both.

### The split

clig.dev: **"Have full-length versions of all flags."** Both `-h` and `--help`, both `-v` and `--verbose`. Long flags are self-documenting in scripts; short flags are ergonomic at the prompt.

clig.dev: **"Only use one-letter flags for commonly used flags, particularly at the top-level when using subcommands. That way you don't 'pollute' your namespace of short flags, forcing you to use convoluted letters and cases for flags you add in the future."**

The implication: a short flag is a *reservation*. Once `-c` means "config" in your top-level command, you can't use it for "count" later. So short flags are scarce real estate — give them only to the flags people will actually type in interactive use.

### The conventional short flags

Stable across most tools (clig.dev's list, with concrete examples):

| Short | Long | Meaning | Tools |
|-------|------|---------|-------|
| `-a` | `--all` | All / include hidden | `ps`, `ls`, `git branch -a`, `gh pr list -a` |
| `-d` | `--debug` | Debug output | many |
| `-f` | `--force` | Force / skip safety prompts | `rm -f`, `git push -f` |
| `-h` | `--help` | Help — *only* help | universal |
| `-n` | `--dry-run` | Show what would happen | `rsync -n`, `git add -n` |
| `-o` | `--output` | Output path or format | `gcc -o`, `kubectl -o json`, `gh ... -o json` |
| `-p` | `--port` | Port | `ssh -p`, `psql -p` |
| `-q` | `--quiet` | Less output | many |
| `-u` | `--user` | User | `ssh -u`, `ps -u` |
| `-v` | `--verbose` *or* `--version` | Conflict; clig.dev recommends `-V` for version, `-v` for verbose | varies |
| `-V` | `--version` | Version | when `-v` is verbose |
| `--` | — | End-of-options separator | universal (POSIX Guideline 10) |

clig.dev's specific advice on `-v`: *"This can often mean either verbose or version. You might want to use `-d` for verbose and this for version, or for nothing to avoid confusion."* Modern Rust CLIs (clap defaults) tend toward `-v` = verbose, `-V` = version; many GNU tools use `-v` = version (e.g. `gcc -v`); ripgrep uses `-V` for version. There is no universal rule. **Pick one and stay consistent within your tool.**

### Stacking short flags

POSIX Guideline 5: *"One or more options without option-arguments, followed by at most one option that takes an option-argument, should be accepted when grouped behind one '-' delimiter."* So `tar -xzvf foo.tar.gz` is the canonical form. Long flags don't stack.

### Earning a short flag

A flag earns a short form when it's typed often enough at the prompt that the keystrokes matter. `--json`, `--output=`, `--all` get short forms. `--no-color`, `--include-archive`, `--strict-trailing-newline` typically don't.

---

## 5. Boolean flags: `--foo` / `--no-foo` vs `--foo=true`

The dominant modern convention, established by [GNU Coding Standards](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html) and codified by Cobra/clap/commander, is the **`--foo` / `--no-foo` pair**:
- `--foo` enables the flag.
- `--no-foo` disables it (overrides any preceding `--foo` or config-file default).
- Default is whatever makes sense; the flag flips it.

This works because shell history typing is line-oriented — `--no-foo` is shorter to retype than re-editing `--foo=false`.

`--foo=true` / `--foo=false` shows up when:
- The default is genuinely tri-state (true / false / unset) and the parser distinguishes them — e.g. `git config color.ui auto`.
- The flag is auto-generated from a config schema (helm, kubectl from JSON merge patches).

clig.dev doesn't take a strong stance here, but recommends `--no-color` as the canonical disable-pair for `--color` — confirming the dominant convention. **Use `--foo` / `--no-foo` unless you have a tri-state.**

A specific Cobra/Go gotcha: by default Cobra only generates `--no-foo` for boolean flags whose default is `true`. If you want both forms, set them explicitly. clap (Rust) lets you opt in via `ArgAction::Set` with overrides.

---

## 6. Flag vs env var vs config file

clig.dev frames this as three categories, [§Configuration](https://clig.dev/#configuration):

> 1. **Likely to vary from one invocation to the next** (debug level, dry-run, output format) → **flag**, optionally also env var.
> 2. **Generally stable, may vary between projects/users/machines** (paths, proxy settings, color mode) → **flags + env vars** are usually enough; if complex, a config file.
> 3. **Stable within a project, for all users** (Makefile, package.json, docker-compose.yml) → **command-specific, version-controlled file**.

### The decision criteria

Four orthogonal axes determine the answer:

| Axis | Flag wins | Env var wins | Config file wins |
|------|-----------|--------------|------------------|
| Frequency of change | per invocation | per session | per project / per machine |
| Discoverability | shows in `--help` | mostly invisible | inspectable file |
| Audit / version control | none | none | yes (if file is in repo) |
| Secret-handling | bad (leaks via `ps`) | bad (leaks via env / docker inspect) | good (file with mode 0600) |
| Composability with `find`/`xargs` | excellent | implicit, brittle | invisible to invocation |
| 12-factor / container-native | weak | strong (dotenv, Heroku config) | weak |

### What clig.dev says about env vars specifically

> *"Environment variables are for behavior that **varies with the context** in which a command is run."*

Concretely:
- `EDITOR`, `PAGER`, `SHELL`, `HOME`, `TMPDIR`, `TERM`, `LINES`, `COLUMNS` — **read these**, don't reinvent them.
- `NO_COLOR` — universally honoured per [no-color.org](https://no-color.org/).
- `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` — networking.
- `DEBUG` — if you don't want to invent your own.
- Tool-prefixed: `MYAPP_*` — all tool-specific config that wants an env override.

### What clig.dev says you must NOT do

> *"**Do not read secrets from environment variables.** While environment variables may be convenient for storing secrets, they have proven too prone to leakage:*
> *- Exported environment variables are sent to every process, and from there can easily leak into logs or be exfiltrated*
> *- Shell substitutions like `curl -H "Authorization: Bearer $BEARER_TOKEN"` will leak into globally-readable process state*
> *- Docker container environment variables can be viewed by anyone with Docker daemon access via `docker inspect`*
> *- Environment variables in systemd units are globally readable via `systemctl show`*
> *Secrets should only be accepted via credential files, pipes, AF_UNIX sockets, secret management services, or another IPC mechanism."*

This is the strongest single piece of guidance in the entire document. It contradicts 12-factor (which puts secrets in env). Modern consensus has moved against 12-factor on this specific point: see Heroku's own newer docs and Docker's secrets API.

For the same reason: **don't accept secrets via flags either** — they leak into `ps` and shell history. Use `--password-file <path>` or read from `stdin`.

### Precedence

The precedence list everyone agrees on (clig.dev):
```
flags  >  shell env vars  >  project config (.env, ./config)  >  user config (~/.config)  >  system config (/etc)  >  built-in defaults
```

Higher in the list overrides lower. Document this in your tool's help. `git config --show-origin` is the gold standard for "tell me where this value came from."

### XDG

clig.dev: **"Follow the XDG-spec."** User config under `$XDG_CONFIG_HOME` (default `~/.config/`), data under `$XDG_DATA_HOME` (`~/.local/share/`), cache under `$XDG_CACHE_HOME` (`~/.cache/`). This is the difference between `~/.myapprc` (deprecated dotfile sprawl) and `~/.config/myapp/config.toml` (modern).

---

## 7. The `--` separator

POSIX Guideline 10: *"The first `--` argument that is not an option-argument should be accepted as a delimiter indicating the end of options. Any following arguments should be treated as operands, even if they begin with the `-` character."*

Concrete uses:

- **`rm -- -rf`** — delete a file literally named `-rf`. Without `--`, it would be parsed as flags.
- **`git checkout -- file.c`** — disambiguate "file.c" from a branch name "file.c" (rare but real).
- **`npm run script -- --flag-for-script`** — pass remaining args through to the wrapped script. Also: `cargo run -- --my-arg`, `yarn run -- --my-arg`.
- **`ssh host -- some-command --with-flags`** — pass through to the remote command.
- **`docker run image -- entrypoint args`** — same idea.

The semantics matter for any wrapper command: if your CLI invokes another tool (e.g. codealmanac invokes `claude`/`codex`/`cursor`), accept `--` and forward everything after it verbatim.

---

## 8. `=` vs space for option values

Both work in most parsers. Subtleties:

- **Long flags**: `--file=foo.txt` and `--file foo.txt` are equivalent in GNU `getopt_long` and most modern parsers.
- **Short flags with values**: `-f foo.txt` and `-ffoo.txt` (concatenated, POSIX form). `-f=foo.txt` is *not* universally supported.
- **Optional option-arguments**: POSIX requires the value be in the *same* argument when optional (`-fvalue`, never `-f value`). This is why optional option-arguments are discouraged — Guideline 7: *"Option-arguments should not be optional."*
- **Scripts**: `--file=$VAR` is safer than `--file $VAR` because if `$VAR` is empty or starts with `-`, the equals form treats it as the value rather than potentially the next flag.

Recommendation: support both, document the `=` form in examples, and always quote shell variables.

---

## 9. Confirmation, force, yes

clig.dev's three-tier model:

> *"Mild: A small, local change such as deleting a file. You might want to prompt for confirmation, you might not.*
> *Moderate: A bigger local change like deleting a directory, a remote change like deleting a resource, or a complex bulk modification that can't be easily undone. You usually want to prompt for confirmation here. Consider giving the user a way to 'dry run' the operation.*
> *Severe: Deleting something complex, like an entire remote application or server. You don't just want to prompt for confirmation here — you want to make it hard to confirm by accident. Consider asking them to type something non-trivial such as the name of the thing they're deleting. Let them alternatively pass a flag such as `--confirm="name-of-thing"`, so it's still scriptable."*

| Tier | Default | Skip flag | Examples |
|------|---------|-----------|----------|
| Mild | Don't prompt; the verb name (`delete`) is the consent | none needed | `rm`, `git branch -d` |
| Moderate | Prompt y/n if TTY; require flag if not | `-y` / `--yes` | `apt remove`, `gh pr close` |
| Severe | Prompt and require typing the resource name | `--confirm=name` | `heroku destroy`, `terraform destroy` |

`--force` and `-f` are conventionally for **bypassing safety checks** (force-delete a non-empty directory, force-push despite divergence) — *not* for "skip the confirmation," which is `--yes`. Many tools conflate them; ripgrep, gh, and modern Rust CLIs keep them separate.

clig.dev: **"Never *require* a prompt. Always provide a way of passing input with flags or arguments. If `stdin` is not an interactive terminal, skip prompting and just require those flags/args."** This is the rule that makes a CLI scriptable.

---

## 10. Output: human vs machine, `--json`, isatty

clig.dev:
> *"Human-readable output is paramount. Humans come first, machines second. The most simple and straightforward heuristic for whether a particular output stream is being read by a human is whether or not it's a TTY."*

> *"Display output as formatted JSON if `--json` is passed."*

The convergent modern pattern, used by gh / kubectl / docker / aws / heroku:

- Default: pretty, possibly colored, possibly tabular, possibly paged.
- `--json`: machine-readable, stable across versions.
- `--no-color`: disable color.
- `NO_COLOR=1` (env): same.
- TTY detection: auto-disable color, animations, paging when `stdout` is not a TTY.
- `-o <format>` / `--output <format>`: kubectl-style flexibility (`json`, `yaml`, `wide`, `name`, `jsonpath=...`, `go-template=...`).

### Output stability

Heroku: *"Care should be taken that in future releases of commands, commands do not change their inputs and stdout after general availability in ways that will break current scripts. Generally this means additional information is OK, but modifying existing output is problematic."*

clig.dev: *"Changing output for humans is usually OK… Encourage your users to use `--plain` or `--json` in scripts to keep output stable."* Pretty output is *not* a stable interface; JSON output *is*.

### stdout vs stderr

clig.dev:
> *"Send output to `stdout`. The primary output for your command should go to `stdout`. Anything that is machine readable should also go to `stdout` — this is where piping sends things by default."*
>
> *"Send messaging to `stderr`. Log messages, errors, and so on should all be sent to `stderr`. This means that when commands are piped together, these messages are displayed to the user and not fed into the next command."*

Progress bars and spinners: stderr (so they don't pollute pipes). Heroku's `cli.action()` does this.

### Reading stdin

clig.dev: *"If input or output is a file, support `-` to read from `stdin` or write to `stdout`."* This is POSIX Guideline 13. So `cat -`, `tar xf -`, `kubectl apply -f -` all work. Same convention should apply to anything that takes a file path.

> *"If your command is expecting to have something piped to it and `stdin` is an interactive terminal, display help immediately and quit. This means it doesn't just hang, like `cat`."*

---

## 11. Exit codes

The basics, universal:

- `0` — success
- `1` — generic failure
- `2` — usage error (bad flags, missing args)
- `>2` — domain-specific failures, documented per command

POSIX-ish reservations: `126` (cannot execute), `127` (not found), `128 + N` (killed by signal N). Avoid using these for application-level errors.

### "No results": 0 or non-zero?

This is a real disagreement.
- **`grep` exits 1 on no match.** Treats "didn't find anything" as a failure for scripting (`if grep …; then`).
- **`rg` (ripgrep)** [follows grep](https://github.com/BurntSushi/ripgrep/blob/master/FAQ.md#exit-status). Exit 1 on no matches, exit 2 on actual error.
- **`find` exits 0 even with no matches.** Treats "found nothing" as a successful search.
- **`gh issue list` exits 0 with empty output** when there are no issues.
- **clig.dev doesn't take a stance**; both are defensible.

Modern API-style consensus (gh, kubectl, jq):
- "No results found" with no error → exit 0, empty output.
- "Search/filter expression matched nothing" → exit 1 only when the *purpose* is matching (grep-likes).
- Real errors (network, parse, auth) → exit ≥2, message to stderr.

The codealmanac convention (already established): `almanac search` exits 0 with `# 0 results` on stderr when nothing matched. That's the "API list" model — correct for a query tool, wrong for a `grep`-style tool. Document the choice; users will assume one or the other.

### Make exit codes meaningful

clig.dev: **"Map the non-zero exit codes to the most important failure modes."** If you have three distinct failure categories, give them three codes. Don't reuse 1 for everything.

---

## 12. Help and discoverability

clig.dev's hard rules:
1. `-h`, `--help`, and bare invocation (`mycmd`) all show help.
2. `mycmd subcommand -h` and `mycmd help subcommand` both work.
3. **"Don't overload `-h`."** It is *only* help.
4. Help text leads with examples, not exhaustive flag listings.
5. Concise help text by default; full help on `--help`.
6. Spelling suggestions: `did you mean X?` for typo'd subcommands (Heroku, gh, brew all do this).

The most useful concrete pattern, from gh:
```
$ gh pr --help
Work with GitHub pull requests.

USAGE
  gh pr <command> [flags]

GENERAL COMMANDS
  create:      Create a pull request
  list:        List pull requests in a repository
  status:      Show status of relevant pull requests
  ...

EXAMPLES
  $ gh pr checkout 12
  $ gh pr create --fill
```

Headings, examples first, the most-used subcommands listed before less-common ones. Compare to git's dense single-page help — git's is canonical but harder to scan.

---

## 13. Recommendations for codealmanac

Applying the principles to the surface we're designing.

### 13.1 Top-level shape

Current verbs: `init`, `search`, `show`, `list`, `info`, `path`, `reindex`, `topics`, `capture`, `tag`, `untag`, `health`, `doctor`, `bootstrap`, `hook`, `uninstall`. About 16 commands. Today's surface is **flat with one nested group (`topics`)**. That's fine — we're under the threshold where a top-level grouping pays off.

For the new commands (`agents list`, `agents doctor`, `agents use <agent>`, `agents model <agent> <model>`, `setup`, `config`):

**`agents` should be a noun-group, like `topics`.** Multiple verbs (`list`, `doctor`, `use`, `model`) act on the same noun (agent providers). Flat-flagging this would give us either `--agent-list`, `--agent-use claude`, `--agent-model "claude:opus-4.7"` (ugly, doesn't scale) or four unrelated top-level verbs (`agent-list`, `agent-use`, `agent-model`, `agent-doctor` — pollutes the top-level help). The git-style group keeps the surface organized.

**`setup` is correct as a flat verb.** It's a single one-shot action, not a noun. Same as `init`, `reindex`, `capture`, `bootstrap`. clig.dev's "noun verb seems to be more common" is about subcommand groups; the top-level verbs are fine flat.

**`config` is correct as a flat verb with sub-actions** matching git's pattern: `config get <key>`, `config set <key> <value>`, `config list`, `config unset <key>`. This is the canonical config-tool shape; users coming from git/npm/gh will guess it.

### 13.2 Provider/model parameter shape

The question: should the agent be `--agent claude` (flag), `claude` (positional), or a dispatched subcommand (`almanac claude capture`)?

Apply Q2 from the mental model: *Is the agent the thing the command operates on, or how the command operates?* The agent is the *how* — `capture` operates on the wiki, using the agent as a runtime. So **flag, not positional, not subcommand**.

Recommended:
- `almanac capture --agent claude` (per-invocation override).
- `ALMANAC_AGENT=claude` (per-shell-session override).
- `~/.almanac/config.json` with `{"agent": {"default": "claude", "model": "..."}}` (persistent default).

That gives the standard 3-tier override (flag > env > config). It also means the *primary* setting interface is `almanac agents use claude` (which writes config) and `almanac agents model claude opus-4.7` (which writes config) — those are the noun-verb operations that *change configuration*, separate from the per-run `--agent` flag.

For the model parameter in the noun-verb form:
- `almanac agents model <agent> <model>` — two positionals, both required, ordered (agent first, then the model assigned to it). Matches `git remote add <name> <url>` shape: required, well-ordered, both *are* the operands.

### 13.3 Short flags — reserve carefully

Top-level today already implicitly reserves the conventional set. For new flags, only earn a short form if it'll be typed often:

| Flag | Short? | Rationale |
|------|--------|-----------|
| `--agent <name>` | `-a`? | `-a` already conflicts with `--all` in many places. Probably no short form; users will set it once via config or env. |
| `--json` | none | clig.dev convention: `--json` is the long form everyone uses; no short form. |
| `--mentions <path>` | none | typed once per query; not worth a letter. |
| `--topic <name>` | `-t`? | typed often when filtering. Worth `-t` if there's no conflict. |
| `--include-archive` | none | rare flag, long is fine. |
| `--limit <n>` | `-n`? | `-n` is conventionally `--dry-run`; avoid. Use `-l` or no short. |
| `--verbose` | `-v` | universal. |
| `--help` | `-h` | universal. |

### 13.4 Boolean flag style

Use `--foo` / `--no-foo`. Specifically: `--color` / `--no-color` (already de facto), `--include-archive` / `--no-include-archive` (the latter is rarely needed since the default is exclude).

### 13.5 Confirmation tiers

| Command | Tier | Behaviour |
|---------|------|-----------|
| `almanac untag` | Mild | No prompt — verb is consent. |
| `almanac list --drop <name>` | Moderate | Prompt y/n in TTY; require `--yes` non-interactive. |
| (hypothetical) `almanac archive <slug>` | Mild | No prompt; reversible. |
| (hypothetical) `almanac wiki destroy` | Severe | Require `--confirm=<wiki-name>`. |

We currently have *no* destructive remote operations, so the confirmation surface is small. The `--drop` case is the only non-trivial one and already correctly labels intent in its name (per clig.dev).

### 13.6 Output and exit codes

Already aligned with the modern consensus:
- `--json` for machine-readable (extend to `info`, `topics show`, `agents list`, `health`).
- Color auto-disables off TTY; honour `NO_COLOR`.
- `search` returns exit 0 with empty output + `# 0 results` on stderr — the API-list model. Document this in `--help`. Consider exit 1 for `--strict` mode if a script wants to detect "nothing found" cleanly, but don't change the default.
- All errors go to stderr, prefixed `almanac:` (already convention).

### 13.7 Env vars

Keep these tool-prefixed. Define them up front so every command knows the set:

| Env var | Effect | Equivalent flag/config |
|---------|--------|------------------------|
| `ALMANAC_AGENT` | default agent for `capture` | `--agent`, config `agent.default` |
| `ALMANAC_NO_COLOR` | disable color (also `NO_COLOR`) | `--no-color` |
| `ALMANAC_DEBUG` | verbose internal logging | `--debug` |
| `ALMANAC_HOME` | override `~/.almanac` location (testing) | none (test-only) |

Critically per clig.dev: **no secrets in env vars**. The Claude/Codex/Cursor auth tokens stay in their own auth files (already the case), not `ANTHROPIC_API_KEY` style envs in our config flow.

### 13.8 The `--` separator

If we ever expose `almanac capture --agent claude -- <extra args to claude>`, support `--` and forward verbatim. Today the agent is invoked internally so this isn't needed; flag it for the day someone wants to pass through.

### 13.9 Help text

Adopt the gh-style structure for grouped commands. When we ship `agents`, `agents --help` should look like:

```
Manage AI agent providers used by `almanac capture`.

USAGE
  almanac agents <command> [flags]

COMMANDS
  list       list configured agents and their readiness
  doctor     diagnose a specific agent's setup
  use        select the default agent
  model      set the default model for an agent

EXAMPLES
  $ almanac agents list
  $ almanac agents use claude
  $ almanac agents model claude claude-opus-4.7

Run 'almanac agents <command> --help' for command details.
```

Examples first; commands listed; flags belong on the per-subcommand help, not here.

---

## 14. Quick-reference cheat sheet

The whole doc compressed:

- **Verbs are commands; nouns are groups.** Group when there are multiple verbs per noun.
- **Positional iff *the thing the command operates on*** with obvious order. Otherwise flag.
- **Required flags are fine** when there are multiple required values that aren't obviously ordered.
- **Both `-h` and `--help`.** Both `--foo` and `--no-foo` for booleans.
- **Short flags are reservations.** Give them only to commonly-typed flags; don't pollute the namespace.
- **Precedence: flags > env > project config > user config > system > defaults.** Always.
- **Don't put secrets in env vars or flags.** Files, stdin, or IPC only.
- **`--` ends options.** Forward everything after `--` verbatim if you wrap another tool.
- **TTY detection drives color, paging, animations.** Off when not a terminal.
- **`--json` is the stable scripting interface; pretty output is not.**
- **Confirm destructive things by default; provide `--yes` to skip.** Severe actions require typing the resource name.
- **Exit 0 success, 2 usage error, 1 generic, ≥3 domain-specific.** No-results is 0 for query tools, 1 for grep-likes — pick one and document.
- **Help leads with examples.** Always.

---

## 15. Sources

- [Command Line Interface Guidelines — clig.dev](https://clig.dev/) — Aanand Prasad, Ben Firshman, Carl Tashian, Eva Parish. The primary modern source; most of this doc draws from it.
- [POSIX.1-2017 ch. 12, Utility Conventions](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html) — 14 Utility Syntax Guidelines. The substrate.
- [GNU Coding Standards §25, Command-Line Interfaces](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html) — long-flag conventions, `--help` / `--version` requirements.
- [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide) — opinionated, concrete; the `heroku fork` flag-vs-positional argument is the canonical case study.
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46) — Jeff Dickey (oclif). Concise; cited throughout clig.dev.
- [no-color.org](https://no-color.org/) — universally honoured `NO_COLOR` env var.
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) — where config files live on Linux/macOS.
- [Docker 1.13 release notes](https://www.docker.com/blog/whats-new-in-docker-1-13/) — the introduction of `docker container ls` and the management-command pattern.
- Per-tool references, all read directly: git (`git help config`, `git help cli`), kubectl (`kubectl --help`), gh (`gh --help`), npm (`npm help`), cargo (`cargo --help`), terraform (`terraform --help`), aws (`aws help`), ripgrep (`rg --help` and FAQ).
