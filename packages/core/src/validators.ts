import type { ConceptMapDraft, LessonDraft, MapDocument } from './schemas';

const LOCAL_LINK = /^#(\d+)$/;

/** Returns what's wrong with a model's concept map, or null if every link is real. */
export function checkMapLinks(
  draft: ConceptMapDraft,
  knownIds: Set<string>,
  knownTitles: string[] = [],
): string | null {
  const taken = new Set(knownTitles.map((title) => title.trim().toLowerCase()));
  for (const [index, concept] of draft.concepts.entries()) {
    const position = index + 1;
    if (taken.has(concept.title.trim().toLowerCase())) {
      return `"${concept.title}" is already a known concept. Teach something new about this topic.`;
    }
    if (position > 1 && concept.links.length === 0) {
      return `Concept #${position} "${concept.title}" needs a link to an earlier concept or a known one.`;
    }
    for (const link of concept.links) {
      const local = LOCAL_LINK.exec(link.to);
      if (local) {
        if (Number(local[1]) >= position || Number(local[1]) < 1) {
          return `Concept #${position} links to ${link.to}, which is not an earlier concept.`;
        }
      } else if (!knownIds.has(link.to)) {
        return `Concept #${position} links to "${link.to}", which is not a known concept id. Use only ids you were given, or #n.`;
      }
    }
  }
  return null;
}

/** Turns "#n" links into real concept ids. Run checkMapLinks first. */
export function resolveConcepts(
  topicId: string,
  draft: ConceptMapDraft,
): MapDocument['concepts'] {
  const idAt = (position: number) => `${topicId}_c${position}`;
  return draft.concepts.map((concept, index) => ({
    id: idAt(index + 1),
    order: index + 1,
    title: concept.title,
    summary: concept.summary,
    links: concept.links.map((link) => {
      const local = LOCAL_LINK.exec(link.to);
      return local
        ? { toId: idAt(Number(local[1])), kind: 'within' as const, why: link.why }
        : { toId: link.to, kind: 'prior' as const, why: link.why };
    }),
  }));
}

/** Returns what's wrong with a lesson, or null. */
export function checkLesson(draft: LessonDraft, connectableIds: Set<string>): string | null {
  if (draft.connection && !connectableIds.has(draft.connection.conceptId)) {
    return `connection.conceptId "${draft.connection.conceptId}" is not one you were given. Use a given id, or null.`;
  }
  for (const question of draft.questions) {
    if (new Set(question.options).size !== question.options.length) {
      return `The question "${question.prompt}" repeats an option.`;
    }
  }
  return null;
}
