const STORAGE_KEY = 'recipe-screenshot-manager-v1';
const SUGGEST_TAGS = ['豚肉', '冷凍', '作り置き', '子どもOK', 'レンチン', '節約', 'お弁当'];

const form = document.getElementById('recipe-form');
const idInput = document.getElementById('recipe-id');
const imageInput = document.getElementById('image');
const nameInput = document.getElementById('name');
const tagsInput = document.getElementById('tags');
const memoInput = document.getElementById('memo');
const favoriteInput = document.getElementById('favorite');
const cancelEditBtn = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');

const keywordInput = document.getElementById('keyword');
const favoriteOnlyInput = document.getElementById('favorite-only');
const tagFiltersEl = document.getElementById('tag-filters');
const activeFiltersEl = document.getElementById('active-filters');
const tagSuggestionsEl = document.getElementById('tag-suggestions');

const cardList = document.getElementById('card-list');
const template = document.getElementById('card-template');

const modal = document.getElementById('preview-modal');
const modalImage = document.getElementById('preview-image');
const modalTitle = document.getElementById('preview-title');
const closeModalBtn = document.getElementById('close-modal');

let recipes = loadRecipes();
let selectedTags = [];

renderTagSuggestions();
renderTagFilters();
renderCards();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editingId = idInput.value;
  const current = editingId ? recipes.find((r) => r.id === editingId) : null;
  const imageData = await toDataUrl(imageInput.files?.[0], current?.imageData ?? '');

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

  persist();
  resetForm();
  renderTagFilters();
  renderCards();
});

cancelEditBtn.addEventListener('click', resetForm);
keywordInput.addEventListener('input', renderCards);
favoriteOnlyInput.addEventListener('change', renderCards);
closeModalBtn.addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

function parseTags(text) {
  return [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))];
}

function toDataUrl(file, fallback) {
  if (!file) return Promise.resolve(fallback);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsDataURL(file);
  }).catch(() => '');
}

function loadRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'スクショを登録';
  cancelEditBtn.hidden = true;
}

function renderTagSuggestions() {
  tagSuggestionsEl.innerHTML = '';
  SUGGEST_TAGS.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = `+ ${tag}`;
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
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = tag;
    if (selectedTags.includes(tag)) btn.classList.add('active');
    btn.addEventListener('click', () => {
      selectedTags = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
      renderTagFilters();
      renderCards();
    });
    tagFiltersEl.appendChild(btn);
  });
}

function renderActiveFilters() {
  activeFiltersEl.innerHTML = '';
  selectedTags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `絞り込み: ${tag}`;
    activeFiltersEl.appendChild(span);
  });
}

function renderCards() {
  const tokens = keywordInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const favoriteOnly = favoriteOnlyInput.checked;

  const filtered = recipes
    .slice()
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .filter((r) => {
      if (favoriteOnly && !r.favorite) return false;
      if (selectedTags.length && !selectedTags.every((tag) => (r.tags || []).includes(tag))) return false;
      if (!tokens.length) return true;
      const target = [r.name, r.memo, ...(r.tags || [])].join(' ').toLowerCase();
      return tokens.every((t) => target.includes(t));
    });

  renderActiveFilters();
  cardList.innerHTML = '';

  if (filtered.length === 0) {
    cardList.innerHTML = '<p class="empty">該当するレシピスクショがありません。</p>';
    return;
  }

  filtered.forEach((recipe) => {
    const node = template.content.cloneNode(true);
    const imageBtn = node.querySelector('.image-btn');
    const thumb = node.querySelector('.thumb');
    const title = node.querySelector('.title');
    const memo = node.querySelector('.memo');
    const tags = node.querySelector('.tags');
    const favoriteBtn = node.querySelector('.favorite-btn');
    const editBtn = node.querySelector('.edit-btn');
    const deleteBtn = node.querySelector('.delete-btn');

    thumb.src = recipe.imageData;
    thumb.alt = recipe.name;
    title.textContent = recipe.name;
    memo.textContent = recipe.memo || '';

    favoriteBtn.textContent = recipe.favorite ? '★' : '☆';
    favoriteBtn.classList.toggle('active', recipe.favorite);

    (recipe.tags || []).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      tags.appendChild(span);
    });

    imageBtn.addEventListener('click', () => {
      modalImage.src = recipe.imageData;
      modalTitle.textContent = recipe.name;
      modal.showModal();
    });

    favoriteBtn.addEventListener('click', () => {
      recipe.favorite = !recipe.favorite;
      recipe.updatedAt = Date.now();
      persist();
      renderCards();
    });

    editBtn.addEventListener('click', () => {
      idInput.value = recipe.id;
      nameInput.value = recipe.name;
      tagsInput.value = (recipe.tags || []).join(', ');
      memoInput.value = recipe.memo || '';
      favoriteInput.checked = Boolean(recipe.favorite);
      formTitle.textContent = 'スクショを編集';
      cancelEditBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    deleteBtn.addEventListener('click', () => {
      if (!confirm(`「${recipe.name}」を削除しますか？`)) return;
      recipes = recipes.filter((r) => r.id !== recipe.id);
      persist();
      renderTagFilters();
      renderCards();
      if (idInput.value === recipe.id) resetForm();
    });

    cardList.appendChild(node);
  });
}
