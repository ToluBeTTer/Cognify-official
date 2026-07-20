export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'color' | 'eyes' | 'mouth' | 'nose' | 'hair' | 'accessory' | 'clothing' | 'bg';

export interface MascotItem {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  price: number;
  color?: string;
  color2?: string;
}

const PRICE: Record<Rarity, number> = { common: 40, rare: 120, epic: 300, legendary: 750 };

const colors: MascotItem[] = [
  { id: 'color-teal', name: 'Cognify Teal', category: 'color', rarity: 'common', price: 0, color: '174 65% 45%' },
  { id: 'color-blue', name: 'Sky Blue', category: 'color', rarity: 'common', price: PRICE.common, color: '210 80% 55%' },
  { id: 'color-purple', name: 'Grape', category: 'color', rarity: 'common', price: PRICE.common, color: '258 70% 60%' },
  { id: 'color-coral', name: 'Coral', category: 'color', rarity: 'rare', price: PRICE.rare, color: '10 80% 62%' },
  { id: 'color-mint', name: 'Mint', category: 'color', rarity: 'rare', price: PRICE.rare, color: '150 55% 55%' },
  { id: 'color-rose', name: 'Rose', category: 'color', rarity: 'rare', price: PRICE.rare, color: '340 75% 65%' },
  { id: 'color-gold', name: 'Gold', category: 'color', rarity: 'epic', price: PRICE.epic, color: '42 85% 55%' },
  { id: 'color-midnight', name: 'Midnight', category: 'color', rarity: 'epic', price: PRICE.epic, color: '245 45% 35%' },
  { id: 'color-holo', name: 'Holographic', category: 'color', rarity: 'legendary', price: PRICE.legendary, color: '280 70% 65%' },
];

const eyes: MascotItem[] = [
  { id: 'eyes-default', name: 'Classic', category: 'eyes', rarity: 'common', price: 0 },
  { id: 'eyes-happy', name: 'Happy Arcs', category: 'eyes', rarity: 'common', price: PRICE.common },
  { id: 'eyes-sleepy', name: 'Sleepy', category: 'eyes', rarity: 'common', price: PRICE.common },
  { id: 'eyes-wink', name: 'Wink', category: 'eyes', rarity: 'common', price: PRICE.common },
  { id: 'eyes-sparkle', name: 'Sparkle', category: 'eyes', rarity: 'rare', price: PRICE.rare },
  { id: 'eyes-focused', name: 'Focused', category: 'eyes', rarity: 'rare', price: PRICE.rare },
  { id: 'eyes-heart', name: 'Heart Eyes', category: 'eyes', rarity: 'rare', price: PRICE.rare },
  { id: 'eyes-star', name: 'Star-Struck', category: 'eyes', rarity: 'epic', price: PRICE.epic },
  { id: 'eyes-anime', name: 'Big Anime', category: 'eyes', rarity: 'epic', price: PRICE.epic },
  { id: 'eyes-galaxy', name: 'Galaxy', category: 'eyes', rarity: 'legendary', price: PRICE.legendary, color: '#8b5cf6' },
];

const mouths: MascotItem[] = [
  { id: 'mouth-default', name: 'Smile', category: 'mouth', rarity: 'common', price: 0 },
  { id: 'mouth-grin', name: 'Big Grin', category: 'mouth', rarity: 'common', price: PRICE.common },
  { id: 'mouth-smirk', name: 'Smirk', category: 'mouth', rarity: 'common', price: PRICE.common },
  { id: 'mouth-tongue', name: 'Tongue Out', category: 'mouth', rarity: 'common', price: PRICE.common },
  { id: 'mouth-open', name: 'Surprised', category: 'mouth', rarity: 'rare', price: PRICE.rare },
  { id: 'mouth-smug', name: 'Smug', category: 'mouth', rarity: 'rare', price: PRICE.rare },
  { id: 'mouth-fangs', name: 'Fangs', category: 'mouth', rarity: 'epic', price: PRICE.epic },
  { id: 'mouth-cool', name: 'Cool Flat', category: 'mouth', rarity: 'epic', price: PRICE.epic },
];

const noses: MascotItem[] = [
  { id: 'nose-none', name: 'None', category: 'nose', rarity: 'common', price: 0 },
  { id: 'nose-dot', name: 'Dot', category: 'nose', rarity: 'common', price: PRICE.common },
  { id: 'nose-round', name: 'Round', category: 'nose', rarity: 'rare', price: PRICE.rare },
  { id: 'nose-button', name: 'Button', category: 'nose', rarity: 'rare', price: PRICE.rare },
];

const hairs: MascotItem[] = [
  { id: 'hair-none', name: 'None', category: 'hair', rarity: 'common', price: 0 },
  { id: 'hair-tuft', name: 'Tuft', category: 'hair', rarity: 'common', price: PRICE.common, color: '#2d2d3a' },
  { id: 'hair-spiky', name: 'Spiky', category: 'hair', rarity: 'rare', price: PRICE.rare, color: '#2d2d3a' },
  { id: 'hair-mohawk', name: 'Mohawk', category: 'hair', rarity: 'rare', price: PRICE.rare, color: '#ef4444' },
  { id: 'hair-bow', name: 'Bow', category: 'hair', rarity: 'rare', price: PRICE.rare, color: '#ec4899' },
  { id: 'hair-curly', name: 'Curly', category: 'hair', rarity: 'epic', price: PRICE.epic, color: '#78350f' },
  { id: 'hair-crown', name: 'Crown', category: 'hair', rarity: 'legendary', price: PRICE.legendary, color: '#facc15' },
];

const accessories: MascotItem[] = [
  { id: 'acc-none', name: 'None', category: 'accessory', rarity: 'common', price: 0 },
  { id: 'acc-glasses', name: 'Glasses', category: 'accessory', rarity: 'common', price: PRICE.common },
  { id: 'acc-round-glasses', name: 'Round Glasses', category: 'accessory', rarity: 'common', price: PRICE.common },
  { id: 'acc-graduation-cap', name: 'Graduation Cap', category: 'accessory', rarity: 'rare', price: PRICE.rare },
  { id: 'acc-headphones', name: 'Headphones', category: 'accessory', rarity: 'rare', price: PRICE.rare },
  { id: 'acc-cap', name: 'Backwards Cap', category: 'accessory', rarity: 'rare', price: PRICE.rare, color: '#3b82f6' },
  { id: 'acc-bowtie', name: 'Bow Tie', category: 'accessory', rarity: 'epic', price: PRICE.epic, color: '#ef4444' },
  { id: 'acc-headband', name: 'Star Headband', category: 'accessory', rarity: 'epic', price: PRICE.epic, color: '#f59e0b' },
  { id: 'acc-halo', name: 'Halo', category: 'accessory', rarity: 'legendary', price: PRICE.legendary, color: '#facc15' },
  { id: 'acc-crown-gem', name: 'Jeweled Crown', category: 'accessory', rarity: 'legendary', price: PRICE.legendary, color: '#a855f7' },
];

const clothing: MascotItem[] = [
  { id: 'cloth-none', name: 'None', category: 'clothing', rarity: 'common', price: 0 },
  { id: 'cloth-scarf', name: 'Scarf', category: 'clothing', rarity: 'common', price: PRICE.common, color: '#3b82f6' },
  { id: 'cloth-bandana', name: 'Bandana', category: 'clothing', rarity: 'common', price: PRICE.common, color: '#ef4444' },
  { id: 'cloth-hoodie', name: 'Hoodie Collar', category: 'clothing', rarity: 'rare', price: PRICE.rare, color: '#64748b' },
  { id: 'cloth-varsity', name: 'Varsity Jacket', category: 'clothing', rarity: 'epic', price: PRICE.epic, color: '#1e3a8a' },
  { id: 'cloth-cape', name: 'Cape', category: 'clothing', rarity: 'legendary', price: PRICE.legendary, color: '#7c3aed' },
];

const backgrounds: MascotItem[] = [
  { id: 'bg-default', name: 'Cognify Sky', category: 'bg', rarity: 'common', price: 0, color: '#eef2ff', color2: '#e0e7ff' },
  { id: 'bg-sunrise', name: 'Sunrise', category: 'bg', rarity: 'common', price: PRICE.common, color: '#fef3c7', color2: '#fecaca' },
  { id: 'bg-mint', name: 'Fresh Mint', category: 'bg', rarity: 'common', price: PRICE.common, color: '#d1fae5', color2: '#a7f3d0' },
  { id: 'bg-lavender', name: 'Lavender Field', category: 'bg', rarity: 'rare', price: PRICE.rare, color: '#ede9fe', color2: '#ddd6fe' },
  { id: 'bg-midnight', name: 'Midnight Study', category: 'bg', rarity: 'epic', price: PRICE.epic, color: '#1e1b4b', color2: '#312e81' },
  { id: 'bg-sunset', name: 'Golden Hour', category: 'bg', rarity: 'epic', price: PRICE.epic, color: '#7c2d12', color2: '#ea580c' },
  { id: 'bg-aurora', name: 'Aurora', category: 'bg', rarity: 'legendary', price: PRICE.legendary, color: '#065f46', color2: '#7c3aed' },
  { id: 'bg-cosmic', name: 'Cosmic', category: 'bg', rarity: 'legendary', price: PRICE.legendary, color: '#0f0a2e', color2: '#4c1d95' },
];

export const MASCOT_CATALOG: MascotItem[] = [
  ...colors, ...eyes, ...mouths, ...noses, ...hairs, ...accessories, ...clothing, ...backgrounds,
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#94a3b8',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const DEFAULT_OWNED = [
  'color-teal', 'eyes-default', 'mouth-default', 'nose-none', 'hair-none', 'acc-none', 'cloth-none', 'bg-default',
];

export const DEFAULT_EQUIPPED: Record<ItemCategory, string> = {
  color: 'color-teal',
  eyes: 'eyes-default',
  mouth: 'mouth-default',
  nose: 'nose-none',
  hair: 'hair-none',
  accessory: 'acc-none',
  clothing: 'cloth-none',
  bg: 'bg-default',
};

export function itemById(id: string): MascotItem | undefined {
  return MASCOT_CATALOG.find((i) => i.id === id);
}

export function itemsByCategory(category: ItemCategory): MascotItem[] {
  return MASCOT_CATALOG.filter((i) => i.category === category);
}
