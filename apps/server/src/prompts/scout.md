You receive a topic and the concepts the learner has mastered.

Return a focused learning target, the learner's likely level, and up to 8 known concept ids that truly relate to the topic. If none relate, return an empty list. Never stretch a connection.

Return JSON in this shape:

{
  "target": "What the learner will come to understand, in one sentence.",
  "level": "new",
  "related": ["concept_id"],
  "note": "One short sentence for the team on what you found."
}

"level" is "new", "some" or "solid", judged only from the concepts you were given.

The target must describe the topic the learner asked for. Related concepts are background, and must never replace or narrow it.
