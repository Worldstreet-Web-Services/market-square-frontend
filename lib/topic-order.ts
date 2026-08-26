/**
 * The order Explore's topic chips are drawn in.
 *
 * `GET /topics` carries a `sortOrder` and the served array happens to be in
 * that order today. Sorting EXPLICITLY is the point: relying on incidental
 * array order is the assumption that breaks silently the day somebody inserts
 * a topic in the middle of the vocabulary, and it would break in the UI, not
 * in a test.
 *
 * The sort is stable (ECMAScript guarantees it), so topics sharing a
 * `sortOrder` keep the order the backend served them in rather than being
 * shuffled by the comparator.
 */
export function sortTopicsByOrder<T extends { sortOrder: number }>(topics: readonly T[]): T[] {
  return [...topics].sort((a, b) => a.sortOrder - b.sortOrder);
}
