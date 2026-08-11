-- Eendrag's sections do not have colours.
--
-- 0100 gave `sections` a `color` column and phase one filled it with invented
-- hex values, flagged in docs/BUILD-LOG.md as placeholders for the HK to
-- confirm. The HK's answer (2026-08-11) is that there is nothing to confirm:
-- the res has no section colours, so the app should not imply that it does.
--
-- Dropping the column rather than leaving it unused, because a NOT NULL column
-- full of made-up values is exactly the kind of thing that reads as meaningful
-- to whoever inherits this.
--
-- Calendar CATEGORY colours are unaffected — a section event still gets its own
-- dot on the calendar, the same way social and sport events do. What is gone is
-- the idea that a particular section has a particular colour.
--
-- If the res ever adopts section colours, add the column back in a new
-- migration and put it through src/core/ui/event-categories.ts again.

alter table sections drop column color;
