import { readStdin } from "./helpers.js";

export interface ReviewMarkdownInput {
  markdown: string | undefined;
  stdinInput: string | undefined;
}

export async function reviewMarkdownInput(
  markdownArg: string[],
): Promise<ReviewMarkdownInput> {
  const markdown = markdownFromArgs(markdownArg);
  return {
    markdown,
    stdinInput: markdown === undefined ? await readStdin() : undefined,
  };
}

function markdownFromArgs(markdownArg: string[]): string | undefined {
  return markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
}
