const STORAGE_KEY = 'recipe-screenshot-manager-v1';
const SUGGEST_TAGS = ['豚肉', '冷凍', '作り置き', '子どもOK', 'レンチン', '節約', 'お弁当'];
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.7;

const form = document.getElementById('recipe-form');
const idInput = document.getElementById('recipe-id');
const imageInput = document.getElementById('image');
const nameInput = document.getElementById('name');
const tagsInput = document.getElementById('tags');
const memoInput = document.getElementById('memo');
const favoriteInput = document.getElementById('favorite');
const cancelEditBtn = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');
const openFormBtn = document.getElementById('open-form');
const closeFormBtn = document.getElementById('close-form');
const formModal = document.getElementById('form-modal');

const keywordInput = document.getElementById('keyword');
const favoriteOnlyInput = document.getElementById('favorite-only');
const tagFiltersEl = document.getElementById('tag-filters');
const activeFiltersEl = document.getElementById('active-filters');
const tagSuggestionsEl = document.getElementById('tag-suggestions');
const clearFiltersBtn = document.getElementById('clear-filters');

const cardList = document.getElementById('card-list');
const template = document.getElementById('card-template');

const modal = document.getElementById('preview-modal');
const modalImage = document.getElementById('preview-image');
const modalTitle = document.getElementById('preview-title');
const modalMemo = document.getElementById('preview-memo');
const modalTags = document.getElementById('preview-tags');
const closeModalBtn = document.getElementById('close-modal');
const previewFavoriteBtn = document.getElementById('preview-favorite');
const previewEditBtn = document.getElementById('preview-edit');
const previewDeleteBtn = document.getElementById('preview-delete');

let recipes = loadRecipes();
let selectedTags = [];
let activeRecipeId = null;

renderTagSuggestions();
renderTagFilters();
renderCards();

openFormBtn.addEventListener('click', () => formModal.showModal());
closeFormBtn.addEventListener('click', () => formModal.close());
formModal.addEventListener('click', (e) => { if (e.target === formModal) formModal.close(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editingId = idInput.value;
  const current = editingId ? recipes.find((r) => r.id === editingId) : null;
  const imageData = await toOptimizedDataUrl(imageInput.files?.[0], current?.imageData ?? '');

  const name = nameInput.value.trim();
  const tags = parseTags(tagsInput.value);
  const memo = memoInput.value.trim();
  const favorite = favoriteInput.checked;

  if (!imageData || !name || tags.length === 0) {
    alert('画像・レシピ名・タグは必須です。');
    return;
  }

  if (current) {
    recipes = recipes.map((r) => (r.id === current.id ? { ...r, imageData, name, tags, memo, favorite, updatedAt: Date.now() } : r));
  } else {
    recipes.unshift({ id: crypto.randomUUID(), imageData, name, tags, memo, favorite, createdAt: Date.now(), updatedAt: Date.now() });
  }

  if (!persist()) {
    recipes = loadRecipes();
    return;
  }

  resetForm();
  formModal.close();
  renderTagFilters();
  renderCards();
});

cancelEditBtn.addEventListener('click', resetForm);
keywordInput.addEventListener('input', renderCards);
favoriteOnlyInput.addEventListener('change', renderCards);
clearFiltersBtn.addEventListener('click', () => { selectedTags = []; renderTagFilters(); renderCards(); });
closeModalBtn.addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

previewFavoriteBtn.addEventListener('click', () => {
  const recipe = recipes.find((r) => r.id === activeRecipeId);
  if (!recipe) return;
  recipe.favorite = !recipe.favorite;
  recipe.updatedAt = Date.now();
  if (!persist()) {
    recipe.favorite = !recipe.favorite;
    return;
  }
  renderCards();
  renderPreview(recipe.id);
});

previewEditBtn.addEventListener('click', () => {
  const recipe = recipes.find((r) => r.id === activeRecipeId);
  if (!recipe) return;
  idInput.value = recipe.id;
  nameInput.value = recipe.name;
  tagsInput.value = (recipe.tags || []).join(', ');
  memoInput.value = recipe.memo || '';
  favoriteInput.checked = Boolean(recipe.favorite);
  formTitle.textContent = 'スクショを編集';
  cancelEditBtn.hidden = false;
  modal.close();
  formModal.showModal();
});

previewDeleteBtn.addEventListener('click', () => {
  const recipe = recipes.find((r) => r.id === activeRecipeId);
  if (!recipe) return;
  if (!confirm(`「${recipe.name}」を削除しますか？`)) return;
  recipes = recipes.filter((r) => r.id !== recipe.id);
  if (!persist()) recipes = loadRecipes();
  modal.close();
  renderTagFilters();
  renderCards();
  if (idInput.value === recipe.id) resetForm();
});

function parseTags(text) { return [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))]; }
async function toOptimizedDataUrl(file, fallback) {
  if (!file) return fallback;
  try {
    const sourceDataUrl = await readFileAsDataUrl(file);
    return await resizeAndCompressImage(sourceDataUrl);
  } catch { return ''; }
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsDataURL(file);
  });
}
function resizeAndCompressImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas context unavailable'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('image load error'));
    img.src = dataUrl;
  });
}
function loadRecipes() {
  try { const raw = localStorage.getItem(STORAGE_KEY); const data = raw ? JSON.parse(raw) : []; return Array.isArray(data) ? data : []; }
  catch { return []; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes)); return true; }
  catch { alert('画像が大きすぎます。小さい画像で試してください'); return false; }
}
function resetForm() {
  form.reset(); idInput.value = ''; formTitle.textContent = 'スクショを登録'; cancelEditBtn.hidden = true;
}
function renderTagSuggestions() {
  tagSuggestionsEl.innerHTML = '';
  SUGGEST_TAGS.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tag-chip'; btn.textContent = `+ ${tag}`;
    btn.addEventListener('click', () => {
      const tags = parseTags(tagsInput.value);
      if (!tags.includes(tag)) tags.push(tag);
      tagsInput.value = tags.join(', ');
    });
    tagSuggestionsEl.appendChild(btn);
  });
}
function renderTagFilters() {
  const allTags = [...new Set(recipes.flatMap((r) => r.tags || []))].sort((a, b) => a.localeCompare(b, 'ja'));
  selectedTags = selectedTags.filter((tag) => allTags.includes(tag));
  tagFiltersEl.innerHTML = '';
  allTags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tag-chip'; btn.textContent = tag;
    if (selectedTags.includes(tag)) btn.classList.add('active');
    btn.addEventListener('click', () => { selectedTags = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]; renderTagFilters(); renderCards(); });
    tagFiltersEl.appendChild(btn);
  });
}
function renderActiveFilters() {
  activeFiltersEl.innerHTML = '';
  selectedTags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag'; span.textContent = `#${tag}`; activeFiltersEl.appendChild(span);
  });
}
function renderCards() {
  const tokens = keywordInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const favoriteOnly = favoriteOnlyInput.checked;
  const filtered = recipes.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).filter((r) => {
    if (favoriteOnly && !r.favorite) return false;
    if (selectedTags.length && !selectedTags.every((tag) => (r.tags || []).includes(tag))) return false;
    if (!tokens.length) return true;
    const target = [r.name, r.memo, ...(r.tags || [])].join(' ').toLowerCase();
    return tokens.every((t) => target.includes(t));
  });

  renderActiveFilters();
  cardList.innerHTML = '';
  if (filtered.length === 0) { cardList.innerHTML = '<p class="empty">該当するスクショがありません</p>'; return; }

  filtered.forEach((recipe) => {
    const node = template.content.cloneNode(true);
    const imageBtn = node.querySelector('.image-btn');
    const thumb = node.querySelector('.thumb');
    const title = node.querySelector('.title');
    const tags = node.querySelector('.tags');
    const favMark = node.querySelector('.fav-mark');
    thumb.src = recipe.imageData; thumb.alt = recipe.name; title.textContent = recipe.name;
    favMark.textContent = recipe.favorite ? '★' : '☆';
    (recipe.tags || []).slice(0, 3).forEach((tag) => {
      const span = document.createElement('span'); span.className = 'tag'; span.textContent = `#${tag}`; tags.appendChild(span);
    });
    imageBtn.addEventListener('click', () => renderPreview(recipe.id));
    cardList.appendChild(node);
  });
}
function renderPreview(recipeId) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  activeRecipeId = recipe.id;
  modalImage.src = recipe.imageData;
  modalTitle.textContent = recipe.name;
  modalMemo.textContent = recipe.memo || '';
  modalTags.innerHTML = '';
  (recipe.tags || []).forEach((tag) => {
    const span = document.createElement('span'); span.className = 'tag'; span.textContent = `#${tag}`; modalTags.appendChild(span);
  });
  previewFavoriteBtn.textContent = recipe.favorite ? '★ お気に入り' : '☆ お気に入り';
  modal.showModal();
}
