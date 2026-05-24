const STORAGE_KEY = 'recipe-screenshot-app-v2';
const POPULAR_TAGS = ['豚肉', '冷凍', '作り置き', '子どもOK', 'レンチン', '節約', 'お弁当'];

const form = document.getElementById('recipe-form');
const recipeIdInput = document.getElementById('recipe-id');
const imageFileInput = document.getElementById('imageFile');
const nameInput = document.getElementById('name');
const tagsInput = document.getElementById('tags');
const memoInput = document.getElementById('memo');
const favoriteInput = document.getElementById('favorite');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit');

const searchInput = document.getElementById('search-input');
const favoriteOnlyInput = document.getElementById('favorite-only');
const toggleTagsBtn = document.getElementById('toggle-tags');
const filterTagsWrap = document.getElementById('filter-tags');
const activeFiltersWrap = document.getElementById('active-filters');
const tagSuggestions = document.getElementById('tag-suggestions');

const recipeList = document.getElementById('recipe-list');
const template = document.getElementById('recipe-card-template');

const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal');

let recipes = loadRecipes();
let selectedFilterTags = [];

renderSuggestedTags();
renderRecipes();
renderFilterTags();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const existing = recipeIdInput.value ? recipes.find((r) => r.id === recipeIdInput.value) : null;
  const imageData = await getImageData(existing?.imageData || '');

  if (!imageData) {
    alert('画像は必須です。');
    return;
  }

  const payload = collectFormData(imageData);
  if (!payload) return;

  if (existing) {
    recipes = recipes.map((recipe) =>
      recipe.id === existing.id
        ? { ...recipe, ...payload, createdAt: recipe.createdAt, updatedAt: Date.now() }
        : recipe
    );
  } else {
    recipes.unshift({ id: crypto.randomUUID(), ...payload, createdAt: Date.now(), updatedAt: Date.now() });
  }

  saveRecipes();
  resetForm();
  renderFilterTags();
  renderRecipes();
});

cancelEditBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', renderRecipes);
favoriteOnlyInput.addEventListener('change', renderRecipes);
toggleTagsBtn.addEventListener('click', () => {
  filterTagsWrap.hidden = !filterTagsWrap.hidden;
});
closeModalBtn.addEventListener('click', () => imageModal.close());
imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) imageModal.close();
});

function collectFormData(imageData) {
  const name = nameInput.value.trim();
  const memo = memoInput.value.trim();
  const favorite = favoriteInput.checked;
  const tags = normalizeTags(tagsInput.value);

  if (!name || tags.length === 0) {
    alert('レシピ名とタグは必須です。');
    return null;
  }

  return { name, memo, favorite, tags, imageData };
}

async function getImageData(currentImageData) {
  const file = imageFileInput.files?.[0];
  if (!file) return currentImageData;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('画像読み込み失敗'));
    reader.readAsDataURL(file);
  }).catch(() => {
    alert('画像の読み込みに失敗しました。');
    return '';
  });
}

function normalizeTags(input) {
  return [...new Set(input.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function loadRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function resetForm() {
  form.reset();
  recipeIdInput.value = '';
  formTitle.textContent = 'スクショを保存';
  cancelEditBtn.hidden = true;
}

function renderSuggestedTags() {
  tagSuggestions.innerHTML = '';
  POPULAR_TAGS.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-chip';
    button.textContent = `+ ${tag}`;
    button.addEventListener('click', () => {
      const currentTags = normalizeTags(tagsInput.value);
      if (!currentTags.includes(tag)) currentTags.push(tag);
      tagsInput.value = currentTags.join(', ');
    });
    tagSuggestions.appendChild(button);
  });
}

function renderFilterTags() {
  const allTags = [...new Set(recipes.flatMap((recipe) => recipe.tags || []))].sort((a, b) => a.localeCompare(b, 'ja'));
  filterTagsWrap.innerHTML = '';

  allTags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.classList.toggle('active', selectedFilterTags.includes(tag));
    chip.addEventListener('click', () => {
      if (selectedFilterTags.includes(tag)) {
        selectedFilterTags = selectedFilterTags.filter((t) => t !== tag);
      } else {
        selectedFilterTags.push(tag);
      }
      renderFilterTags();
      renderRecipes();
    });
    filterTagsWrap.appendChild(chip);
  });
}

function renderActiveFilters() {
  activeFiltersWrap.innerHTML = '';
  selectedFilterTags.forEach((tag) => {
    const label = document.createElement('span');
    label.className = 'tag';
    label.textContent = `絞り込み: ${tag}`;
    activeFiltersWrap.appendChild(label);
  });
}

function renderRecipes() {
  const queryTokens = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const favoriteOnly = favoriteOnlyInput.checked;

  const filtered = recipes
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .filter((recipe) => {
      if (favoriteOnly && !recipe.favorite) return false;

      if (selectedFilterTags.length > 0) {
        const recipeTags = recipe.tags || [];
        const hasAllTags = selectedFilterTags.every((tag) => recipeTags.includes(tag));
        if (!hasAllTags) return false;
      }

      if (queryTokens.length === 0) return true;

      const haystack = [recipe.name, recipe.memo, ...(recipe.tags || [])].join(' ').toLowerCase();
      return queryTokens.every((token) => haystack.includes(token));
    });

  renderActiveFilters();
  recipeList.innerHTML = '';

  if (filtered.length === 0) {
    recipeList.innerHTML = '<p class="empty">条件に合うスクショがありません。</p>';
    return;
  }

  filtered.forEach((recipe) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.recipe-card');
    const imageButton = fragment.querySelector('.image-button');
    const image = fragment.querySelector('.card-image');
    const title = fragment.querySelector('.card-title');
    const memo = fragment.querySelector('.card-memo');
    const tags = fragment.querySelector('.tag-list');
    const favoriteBtn = fragment.querySelector('.favorite-btn');
    const editBtn = fragment.querySelector('.edit-btn');
    const deleteBtn = fragment.querySelector('.delete-btn');

    image.src = recipe.imageData;
    image.alt = recipe.name;
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

    imageButton.addEventListener('click', () => {
      modalImage.src = recipe.imageData;
      modalTitle.textContent = recipe.name;
      imageModal.showModal();
    });

    favoriteBtn.addEventListener('click', () => {
      recipe.favorite = !recipe.favorite;
      recipe.updatedAt = Date.now();
      saveRecipes();
      renderRecipes();
    });

    editBtn.addEventListener('click', () => {
      recipeIdInput.value = recipe.id;
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
      recipes = recipes.filter((item) => item.id !== recipe.id);
      selectedFilterTags = selectedFilterTags.filter((tag) => recipes.some((r) => (r.tags || []).includes(tag)));
      saveRecipes();
      renderFilterTags();
      renderRecipes();
      if (recipeIdInput.value === recipe.id) resetForm();
    });

    recipeList.appendChild(card);
  });
}
