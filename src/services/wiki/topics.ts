export {
  listWikiTopics,
  readWikiTopic,
} from "./topic-read.js";
export {
  createWikiTopic,
  describeWikiTopic,
  linkWikiTopics,
  unlinkWikiTopics,
} from "./topic-mutations.js";
export type {
  CreateWikiTopicRequest,
  CreateWikiTopicResult,
  DescribeWikiTopicRequest,
  DescribeWikiTopicResult,
  LinkWikiTopicsRequest,
  LinkWikiTopicsResult,
  UnlinkWikiTopicsRequest,
  UnlinkWikiTopicsResult,
  WikiTopicRecord,
  WikiTopicRequest,
  WikiTopicResult,
  WikiTopicSummary,
  WikiTopicsRequest,
} from "./topic-types.js";
