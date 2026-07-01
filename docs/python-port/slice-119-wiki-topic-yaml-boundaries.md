# Slice 119: Wiki Topic YAML Boundaries

## Scope

Keep topic YAML behavior unchanged while splitting the wiki topic module by
data model, forgiving read path, and round-trip mutation file mechanics.

## Out of scope

- No topic command behavior change.
- No `topics.yaml` schema change.
- No change to comments/quote/line-ending preservation.
- No index projection change.

## Design

Cosmic Python chapter 2 frames repositories as a way to hide persistence
mechanics from the model. In CodeAlmanac, `topics.yaml` has two persistence
paths: a forgiving read path for indexing and a strict round-trip mutation path
for organization commands. They should not live in the same module as the
topic data model.

Target shape:

```python
definitions = load_topics_yaml(workspace.almanac_path)  # read/index path
topic_file = load_topics_file(workspace.almanac_path)   # mutation path
topic_file.rename_topic("old", "new")
topic_file.write()
```

`topic_models.py` owns `TopicDefinition`, `TopicsYaml`, and `title_for_slug`.
`topic_read.py` owns forgiving PyYAML reads for index refresh.
`topic_file.py` owns ruamel round-trip loading, mutation helpers, and writes.
`topics.py` remains a small import facade for current callers.

## Verification

- Focused topic mutation, health, and read-model tests.
- Architecture guard keeping `topics.py` facade-only and read/mutation
  mechanics split.
- Isolated topic command dogfood after the split.
