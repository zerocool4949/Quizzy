// Category and artist list management from categories.json

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded categories
let categoryArtistsCache = null;
let categoryListCache = null;

// Load categories from JSON file
function loadCategoriesData() {
  try {
    const categoriesPath = join(__dirname, 'categories.json');
    return JSON.parse(readFileSync(categoriesPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to load categories.json:', err.message);
    return {};
  }
}

// Get mapping of categoryId -> artists array
export function getCategoryArtists() {
  if (!categoryArtistsCache) {
    const data = loadCategoriesData();
    categoryArtistsCache = {};
    for (const [id, category] of Object.entries(data)) {
      categoryArtistsCache[id] = category.artists;
    }
  }
  return categoryArtistsCache;
}

// Get list of categories for client display
export function getCategoryList() {
  if (!categoryListCache) {
    const data = loadCategoriesData();
    categoryListCache = Object.entries(data).map(([id, category]) => ({
      id,
      name: category.name
    }));
  }
  return categoryListCache;
}

// Get artists for a specific category
export function getArtistsForCategory(categoryId) {
  const categories = getCategoryArtists();
  return categories[categoryId] || [];
}
