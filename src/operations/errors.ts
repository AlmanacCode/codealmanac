export type OperationErrorOutcome = "error" | "needs-action";

export class OperationError extends Error {
  readonly outcome: OperationErrorOutcome;
  readonly fix?: string;
  readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      outcome?: OperationErrorOutcome;
      fix?: string;
      data?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.outcome = options.outcome ?? "error";
    this.fix = options.fix;
    this.data = options.data;
  }
}

export class MissingWikiError extends OperationError {
  constructor() {
    super(
      "no .almanac/ found in this directory or any parent",
      {
        outcome: "needs-action",
        fix: "run: almanac init",
      },
    );
  }
}
