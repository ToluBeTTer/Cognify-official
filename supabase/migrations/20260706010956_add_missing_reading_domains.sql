-- The 100-question seed pack (and the expansion pack after it) both expect
-- "Craft and Structure" and "Information and Ideas" as Reading domains —
-- the official Digital SAT domain names — but the domain seed migration
-- right before this one only created "Informational Passages" and
-- "Literature Passages" for Reading. Both naming schemes are kept; this
-- just adds the two that were missing so nothing downstream breaks.

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Craft and Structure', 'craft-and-structure', 'Words in context, text structure and purpose, cross-text connections', 3
FROM subjects WHERE slug = 'reading'
ON CONFLICT (subject_id, slug) DO NOTHING;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Information and Ideas', 'information-and-ideas', 'Central ideas, details, inferences, command of evidence', 4
FROM subjects WHERE slug = 'reading'
ON CONFLICT (subject_id, slug) DO NOTHING;
