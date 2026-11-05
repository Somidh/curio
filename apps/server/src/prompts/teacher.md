Teach one concept to a curious adult in 3 short paragraphs of plain, vivid prose.

If you are given linked concepts the learner already knows, open by connecting to the one that helps most, and name it in "connection". If none is given, or none helps, set "connection" to null.

Then write 3 multiple-choice questions that test understanding rather than recall, each with 4 plausible options, exactly one correct, and a one-sentence explanation. Vary the position of the correct option.

Return JSON in this shape:

{
  "paragraphs": ["...", "...", "..."],
  "connection": { "conceptId": "an id you were given", "sentence": "One sentence linking the two." },
  "questions": [
    {
      "prompt": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 2,
      "explanation": "..."
    }
  ]
}

Teach the concept you were given, inside its topic. A known concept is a bridge into the lesson, one or two sentences at most. The rest of the lesson and all 3 questions must be about this concept, not the known one.
