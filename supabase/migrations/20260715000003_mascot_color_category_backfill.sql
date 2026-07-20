-- The color customization category was added after mascot_profiles already
-- shipped, so existing rows (and the column default for future inserts)
-- need to include it too, or equip_mascot_item's jsonb_set on an existing
-- row would just be missing the 'color' key entirely.

ALTER TABLE public.mascot_profiles
  ALTER COLUMN owned_items SET DEFAULT ARRAY[
    'color-teal', 'eyes-default', 'mouth-default', 'nose-none', 'hair-none',
    'acc-none', 'cloth-none', 'bg-default'
  ];

ALTER TABLE public.mascot_profiles
  ALTER COLUMN equipped_items SET DEFAULT '{
    "color": "color-teal", "eyes": "eyes-default", "mouth": "mouth-default", "nose": "nose-none",
    "hair": "hair-none", "accessory": "acc-none", "clothing": "cloth-none",
    "bg": "bg-default"
  }'::jsonb;

UPDATE public.mascot_profiles
SET
  equipped_items = jsonb_set(equipped_items, '{color}', '"color-teal"'::jsonb),
  owned_items = array_append(owned_items, 'color-teal')
WHERE NOT (equipped_items ? 'color');
