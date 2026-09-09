import type { FactTag } from './types';

export type Reaction = 'like' | 'dislike';

/** Used when the user has selected nothing, matching the priority order in intent.md. */
export const DEFAULT_TAGS: FactTag[] = ['History', 'Architecture'];

export interface ReactedFact {
  tag: FactTag;
  reaction: Reaction;
}

/**
 * One-line summary of likes and dislikes by tag, sent with each LLM request so
 * the model leans towards what the user enjoyed. The device stays the source of
 * truth; nothing is stored anywhere else. Pure, so it is testable under Node.
 */
export function summariseFeedback(reacted: readonly ReactedFact[]): string | null {
  const byTag = (reaction: Reaction) => {
    const counts = new Map<FactTag, number>();
    for (const r of reacted) {
      if (r.reaction === reaction) counts.set(r.tag, (counts.get(r.tag) ?? 0) + 1);
    }
    return [...counts].map(([tag, n]) => `${tag} x${n}`).join(', ');
  };
  const liked = byTag('like');
  const disliked = byTag('dislike');
  if (!liked && !disliked) return null;
  return [liked && `Liked: ${liked}.`, disliked && `Disliked: ${disliked}.`]
    .filter(Boolean)
    .join(' ');
}
