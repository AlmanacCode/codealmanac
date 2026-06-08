export class MissingWikiError extends Error {
  fix = "run: almanac init";

  constructor() {
    super("no .almanac/ found in this directory or any parent");
    this.name = "MissingWikiError";
  }
}
