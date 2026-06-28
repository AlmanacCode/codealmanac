export interface ReviewMarkdownInput {
  markdown?: string;
  stdinInput?: string;
}

export function reviewMarkdownInput(
  options: ReviewMarkdownInput,
): string | undefined {
  return options.markdown ?? options.stdinInput;
}
