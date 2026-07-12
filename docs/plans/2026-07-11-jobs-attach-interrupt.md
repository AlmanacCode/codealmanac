# Jobs Attach Interrupt

## Scope

Handle `Ctrl-C` while `codealmanac jobs attach <run-id>` is following a run.
Stop only the foreground attach stream, leave the underlying run untouched, and
show the exact command for cancelling that run.

## Out of scope

- Changing worker process isolation.
- Changing run cancellation behavior.
- Handling broken output pipes.
- Adding a new JSON event shape for a local CLI interruption.

## Design

`jobs attach` owns the interruption boundary because it is the only command that
can truthfully say the user stopped following a background run. It catches
`KeyboardInterrupt`, renders a concise detachment notice for human output, and
returns the conventional interrupted exit code, `130`.

JSON attach output remains an uninterrupted NDJSON event stream: interruption
adds no non-JSON notice and is represented by exit code `130`.

## File changes

- `src/codealmanac/cli/dispatch/jobs.py`: catch attach interruption and return
  `130`.
- `src/codealmanac/cli/render/job_logs.py`: render the human detachment and
  cancellation guidance.
- `src/codealmanac/cli/render/admin.py`: export the renderer.
- `tests/test_cli.py`: cover human and JSON interruption behavior and prove the
  run is not mutated.
- `almanac/reference/runs/run-states-and-events.md`: document the public attach
  interruption contract.

## Test coverage

- No traceback or stderr output after `Ctrl-C`.
- Human output includes the exact cancellation command.
- Exit status is `130`.
- Run status remains unchanged.
- JSON output receives no human detachment text.

## Read before coding

- `MANUAL.md`
- `almanac/reference/runs/run-states-and-events.md`
- `src/codealmanac/cli/dispatch/jobs.py`
- `src/codealmanac/cli/render/job_logs.py`
