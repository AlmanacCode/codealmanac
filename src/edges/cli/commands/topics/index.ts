/**
 * Public entrypoint for `almanac topics <verb>` command implementations.
 *
 * The command bodies live next to this file so each workflow stays small
 * and readable. This barrel keeps the import surface stable for CLI
 * registration and tests.
 */

export { runTopicsCreate } from "./create.js";
export { runTopicsDelete } from "./delete.js";
export { runTopicsDescribe } from "./describe.js";
export { runTopicsLink } from "./link.js";
export { runTopicsList } from "./list.js";
export { runTopicsRename } from "./rename.js";
export { runTopicsShow } from "./show.js";
export { runTopicsUnlink } from "./unlink.js";

export type {
  TopicsCommandOutput,
  TopicsCreateOptions,
  TopicsDeleteOptions,
  TopicsDescribeOptions,
  TopicsLinkOptions,
  TopicsListOptions,
  TopicsRenameOptions,
  TopicsShowOptions,
  TopicsUnlinkOptions,
} from "./types.js";
