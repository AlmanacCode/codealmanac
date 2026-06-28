export {
  listWikiTopics,
  readWikiTopic,
} from "./topic-read.js";
export {
  describeWikiTopic,
} from "./topic-description.js";
export {
  createWikiTopic,
} from "./topic-create.js";
export {
  linkWikiTopics,
  unlinkWikiTopics,
} from "./topic-edge-mutations.js";
export {
  deleteWikiTopic,
  renameWikiTopic,
} from "./topic-page-mutations.js";
export type {
  CreateWikiTopicRequest,
  CreateWikiTopicResult,
  DeleteWikiTopicRequest,
  DeleteWikiTopicResult,
  DescribeWikiTopicRequest,
  DescribeWikiTopicResult,
  LinkWikiTopicsRequest,
  LinkWikiTopicsResult,
  RenameWikiTopicRequest,
  RenameWikiTopicResult,
  UnlinkWikiTopicsRequest,
  UnlinkWikiTopicsResult,
  WikiTopicRecord,
  WikiTopicRequest,
  WikiTopicResult,
  WikiTopicSummary,
  WikiTopicsRequest,
} from "./topic-types.js";
