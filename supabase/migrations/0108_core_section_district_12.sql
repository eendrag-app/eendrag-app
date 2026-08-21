-- The section is "District 12" on the competition's own scoreboard. This app
-- seeded it as "District", and this app was the one that was wrong — the old
-- intersection app hit the same bug and corrected it there first
-- (eendrag-intersection, src/store.js migrate()).
--
-- Renamed rather than left alone because the two apps have to agree on section
-- names while both are live: the intersection import matches sections BY NAME,
-- and a mismatch would silently drop a twelfth of the competition.
--
-- Safe to run twice, and safe on a database that never had the wrong name.

update sections set name = 'District 12' where name = 'District';
