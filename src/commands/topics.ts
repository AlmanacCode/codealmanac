/**
 * Public entrypoint for `almanac topics <verb>` command implementations.
 *
 * The command bodies live under `src/commands/topics/` so each workflow
 * stays small and readable. This barrel keeps the import surface stable
 * for CLI registration and tests.
 */

export { runTopicsCreate } from "./topics/create.js";
export { runTopicsDelete } from "./topics/delete.js";
export { runTopicsDescribe } from "./topics/describe.js";
export { runTopicsLink } from "./topics/link.js";
export { runTopicsList } from "./topics/list.js";
export { runTopicsRename } from "./topics/rename.js";
export { runTopicsShow } from "./topics/show.js";
export { runTopicsUnlink } from "./topics/unlink.js";

export type {
  TopicsBaseOptions,
  TopicsCommandOutput,
  TopicsCreateOptions,
  TopicsDeleteOptions,
  TopicsDescribeOptions,
  TopicsLinkOptions,
  TopicsListOptions,
  TopicsRenameOptions,
  TopicsShowOptions,
  TopicsUnlinkOptions,
} from "./topics/types.js";

export {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  writeTopicsFile,
  type TopicEntry,
  type TopicsFile,
} from "../topics/yaml.js";
