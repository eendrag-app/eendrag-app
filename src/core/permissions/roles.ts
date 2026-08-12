// The three roles in the app. They live on profiles.role in the database and
// are enforced there by Row Level Security — never only in the UI.
//
// - student:   everyone, by default
// - sport_rep: may edit exactly one sport (sports.rep_id), post its fixtures
//              and results
// - admin:     HK members — announcements, calendar, intersection admin,
//              everything on the Admin tab
export const ROLES = ["student", "sport_rep", "admin"] as const;

export type Role = (typeof ROLES)[number];
