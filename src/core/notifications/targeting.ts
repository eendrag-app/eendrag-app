import type { NotificationCategory } from "./categories";
import type { Audience, NotificationTrigger, RecipientCandidate } from "./types";

// Pure targeting logic — no database, no clock. The pipeline feeds it real
// candidates; the tests in targeting.test.ts feed it hand-built ones. These
// tests are the contract with phase two: if you change targeting behaviour,
// change the tests knowingly.

function inAudience(candidate: RecipientCandidate, audience: Audience): boolean {
  switch (audience.kind) {
    case "all":
      return true;
    case "section":
      return candidate.sectionId === audience.sectionId;
    case "sport":
      return candidate.sportIds.includes(audience.sportId);
    case "role":
      return candidate.role === audience.role;
  }
}

// A missing preference row falls back to the signup default: everything on
// except section-only mode.
export function preferenceEnabled(
  candidate: RecipientCandidate,
  category: NotificationCategory,
): boolean {
  return candidate.preferences[category] ?? (category !== "section");
}

/**
 * Resolve a trigger's audience into the users who should receive a
 * notifications row.
 *
 * Filters, in order:
 *  1. inactive accounts are never notified
 *  2. audience (section / sport / role / all)
 *  3. the recipient's toggle for the trigger's category
 *     — urgent triggers instead check only the 'urgent' toggle
 *  4. section-only mode: recipients who enabled the 'section' toggle drop
 *     anything not about their own section (urgent always passes)
 */
export function resolveRecipients(
  trigger: NotificationTrigger,
  candidates: RecipientCandidate[],
): RecipientCandidate[] {
  return candidates.filter((c) => {
    if (!c.isActive) return false;
    if (!inAudience(c, trigger.audience)) return false;

    if (trigger.urgent) {
      return preferenceEnabled(c, "urgent");
    }

    if (!preferenceEnabled(c, trigger.category)) return false;

    if (preferenceEnabled(c, "section")) {
      const aboutMySection =
        (trigger.audience.kind === "section" &&
          trigger.audience.sectionId === c.sectionId) ||
        (trigger.aboutSectionId != null && trigger.aboutSectionId === c.sectionId);
      if (!aboutMySection) return false;
    }

    return true;
  });
}
