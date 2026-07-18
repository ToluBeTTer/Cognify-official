/*
  SAT Structure Data
  
  Seeds the proper SAT organization:
  - Sections: Math, Reading, Writing
  - Domains within each section
  - Skills within each domain
*/

-- ============================================================
-- 1. Clean up and update subjects
-- ============================================================

-- Ensure we have the SAT sections
INSERT INTO subjects (name, slug, description, display_order)
SELECT 'Math', 'math', 'SAT Mathematics Section', 1
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE slug = 'math');

INSERT INTO subjects (name, slug, description, display_order)
SELECT 'Reading', 'reading', 'SAT Reading Section', 2
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE slug = 'reading');

INSERT INTO subjects (name, slug, description, display_order)
SELECT 'Writing', 'writing', 'SAT Writing and Language Section', 3
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE slug = 'writing');

-- ============================================================
-- 2. SAT Domains (upsert pattern)
-- ============================================================

-- Math Domains
INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Algebra', 'algebra', 'Linear equations, linear functions, and systems', 1
FROM subjects WHERE slug = 'math'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Advanced Math', 'advanced-math', 'Nonlinear equations, nonlinear functions', 2
FROM subjects WHERE slug = 'math'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Problem Solving and Data Analysis', 'problem-solving-data', 'Ratios, percentages, data analysis', 3
FROM subjects WHERE slug = 'math'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Geometry and Trigonometry', 'geometry-trigonometry', 'Shapes, angles, trigonometric functions', 4
FROM subjects WHERE slug = 'math'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Reading Domains
INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Informational Passages', 'informational', 'Social science, science, and humanities passages', 1
FROM subjects WHERE slug = 'reading'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Literature Passages', 'literature', 'Fiction excerpts and literary analysis', 2
FROM subjects WHERE slug = 'reading'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Writing Domains
INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Standard English Conventions', 'conventions', 'Grammar, usage, and mechanics', 1
FROM subjects WHERE slug = 'writing'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO domains (subject_id, name, slug, description, display_order)
SELECT id, 'Expression of Ideas', 'expression-ideas', 'Organization, development, and effective language', 2
FROM subjects WHERE slug = 'writing'
ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================================
-- 3. Skills for each domain
-- ============================================================

-- Algebra Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Linear Equations in One Variable', 'linear-equations-one-var', 'Solving linear equations and inequalities', 'ALG.1', 1
FROM domains d WHERE d.slug = 'algebra'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Linear Functions', 'linear-functions', 'Understanding and interpreting linear functions', 'ALG.2', 2
FROM domains d WHERE d.slug = 'algebra'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Linear Inequalities', 'linear-inequalities', 'Solving and graphing linear inequalities', 'ALG.3', 3
FROM domains d WHERE d.slug = 'algebra'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Systems of Linear Equations', 'systems-linear', 'Solving systems of two linear equations', 'ALG.4', 4
FROM domains d WHERE d.slug = 'algebra'
ON CONFLICT (slug) DO NOTHING;

-- Advanced Math Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Equivalent Expressions', 'equivalent-expressions', 'Manipulating algebraic expressions', 'ADV.1', 1
FROM domains d WHERE d.slug = 'advanced-math'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Nonlinear Equations', 'nonlinear-equations', 'Quadratic, exponential, and polynomial equations', 'ADV.2', 2
FROM domains d WHERE d.slug = 'advanced-math'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Nonlinear Functions', 'nonlinear-functions', 'Analyzing quadratic, exponential, and other nonlinear functions', 'ADV.3', 3
FROM domains d WHERE d.slug = 'advanced-math'
ON CONFLICT (slug) DO NOTHING;

-- Problem Solving and Data Analysis Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Ratios and Proportions', 'ratios-proportions', 'Solving ratio and proportion problems', 'PSD.1', 1
FROM domains d WHERE d.slug = 'problem-solving-data'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Percentages', 'percentages', 'Calculating percentages and percent change', 'PSD.2', 2
FROM domains d WHERE d.slug = 'problem-solving-data'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Units and Conversions', 'units-conversions', 'Unit conversions and dimensional analysis', 'PSD.3', 3
FROM domains d WHERE d.slug = 'problem-solving-data'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Data Analysis', 'data-analysis', 'Interpreting tables, graphs, and data', 'PSD.4', 4
FROM domains d WHERE d.slug = 'problem-solving-data'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Probability', 'probability', 'Probability and conditional probability', 'PSD.5', 5
FROM domains d WHERE d.slug = 'problem-solving-data'
ON CONFLICT (slug) DO NOTHING;

-- Geometry Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Angles and Triangles', 'angles-triangles', 'Triangle properties and angle relationships', 'GEO.1', 1
FROM domains d WHERE d.slug = 'geometry-trigonometry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Circles', 'circles', 'Circle properties, arc length, and sector area', 'GEO.2', 2
FROM domains d WHERE d.slug = 'geometry-trigonometry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Area and Volume', 'area-volume', 'Calculating area, surface area, and volume', 'GEO.3', 3
FROM domains d WHERE d.slug = 'geometry-trigonometry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Trigonometry', 'trigonometry', 'Right triangle trig and trigonometric functions', 'GEO.4', 4
FROM domains d WHERE d.slug = 'geometry-trigonometry'
ON CONFLICT (slug) DO NOTHING;

-- Writing Conventions Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Subject-Verb Agreement', 'subject-verb-agreement', 'Ensuring subjects and verbs agree', 'CONV.1', 1
FROM domains d WHERE d.slug = 'conventions'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Pronoun Usage', 'pronoun-usage', 'Correct pronoun case and agreement', 'CONV.2', 2
FROM domains d WHERE d.slug = 'conventions'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Punctuation', 'punctuation', 'Commas, semicolons, colons, and dashes', 'CONV.3', 3
FROM domains d WHERE d.slug = 'conventions'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Sentence Structure', 'sentence-structure', 'Clauses, fragments, and run-ons', 'CONV.4', 4
FROM domains d WHERE d.slug = 'conventions'
ON CONFLICT (slug) DO NOTHING;

-- Writing Expression Skills
INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Organization', 'organization', 'Logical flow and paragraph structure', 'EXPR.1', 1
FROM domains d WHERE d.slug = 'expression-ideas'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Development', 'development', 'Adding and revising supporting evidence', 'EXPR.2', 2
FROM domains d WHERE d.slug = 'expression-ideas'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Effective Language', 'effective-language', 'Precision, concision, and style', 'EXPR.3', 3
FROM domains d WHERE d.slug = 'expression-ideas'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (domain_id, name, slug, description, code, display_order)
SELECT d.id, 'Transitions', 'transitions', 'Using transitions effectively', 'EXPR.4', 4
FROM domains d WHERE d.slug = 'expression-ideas'
ON CONFLICT (slug) DO NOTHING;