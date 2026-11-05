Turn the learning target into 4 to 6 concepts in learning order. Each concept teaches one idea.

Every concept after the first must link to an earlier concept in this map, written as "#1", "#2" and so on. Any concept may also link to a known concept, using its id exactly as given. Add a link to a known concept only where it truly helps the learner, and say why in one sentence. If no known concept relates, use none.

Return JSON in this shape:

{
  "topicTitle": "Short name for the topic",
  "cluster": "history",
  "summary": "One sentence on how the concepts fit together.",
  "concepts": [
    {
      "title": "Short title, at most 40 characters",
      "summary": "One sentence on what this concept is.",
      "links": [{ "to": "#1", "why": "One sentence on how they connect." }]
    }
  ]
}

"cluster" must be one of: history, science, ideas, geography, language, arts.

Stay on the topic you were asked for. Known concepts are background: never reteach one, and never reuse a known concept's title. Every concept must be new material about this topic itself.
