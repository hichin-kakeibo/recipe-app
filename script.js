const STORAGE_KEY = 'recipe-app-v1';

const form = document.getElementById('recipe-form');
const recipeIdInput = document.getElementById('recipe-id');
const nameInput = document.getElementById('name');
const imageUrlInput = document.getElementById('imageUrl');
const ingredientsInput = document.getElementById('ingredients');
const stepsInput = document.getElementById('steps');
const memoInput = document.getElementById('memo');
const tagsInput = document.getElementById('tags');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit');
const searchInput = document.getElementById('search-input');
const favoriteOnlyInput = document.getElementById('favorite-only');
const recipeList = document.getElementById('recipe-list');
const template = document.getElementById('recipe-card-template');

let recipes = loadRecipes();
renderRecipes();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = collectFormData();

  if (!data) return;

  if (recipeIdInput.value) {
    recipes = recipes.map((recipe) => (recipe.id === recipeIdInput.value ? { ...recipe, ...data } : recipe));
  } else {
    recipes.unshift({ id: crypto.randomUUID(), ...data, favorite: false, createdAt: Date.now() });
  }

  saveRecipes();
  resetForm();
  renderRecipes();
});

cancelEditBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', renderRecipes);
favoriteOnlyInput.addEventListener('change', renderRecipes);

function collectFormData() {
  const name = nameInput.value.trim();
  const imageUrl = imageUrlInput.value.trim();
  const ingredients = ingredientsInput.value.trim();
  const steps = stepsInput.value.trim();
  const memo = memoInput.value.trim();
  const tags = tagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!name || !ingredients || !steps) {
    alert('レシピ名・材料・作り方は必須です。');
    return null;
  }

  return { name, imageUrl, ingredients, steps, memo, tags };
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
  formTitle.textContent = 'レシピを登録';
  cancelEditBtn.hidden = true;
}

function renderRecipes() {
  const query = searchInput.value.trim().toLowerCase();
  const favoritesOnly = favoriteOnlyInput.checked;

  const filtered = recipes.filter((recipe) => {
    if (favoritesOnly && !recipe.favorite) return false;
    if (!query) return true;

    const haystack = [
      recipe.name,
      recipe.ingredients,
      recipe.steps,
      recipe.memo,
      ...(recipe.tags || []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  recipeList.innerHTML = '';

  if (filtered.length === 0) {
    recipeList.innerHTML = '<p class="empty">レシピがありません。登録してみましょう🍴</p>';
    return;
  }

  filtered.forEach((recipe) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.recipe-card');
    const image = fragment.querySelector('.card-image');
    const title = fragment.querySelector('.card-title');
    const ingredients = fragment.querySelector('.card-ingredients');
    const steps = fragment.querySelector('.card-steps');
    const memo = fragment.querySelector('.card-memo');
    const tags = fragment.querySelector('.tag-list');
    const favoriteBtn = fragment.querySelector('.favorite-btn');
    const editBtn = fragment.querySelector('.edit-btn');
    const deleteBtn = fragment.querySelector('.delete-btn');

    title.textContent = recipe.name;
    ingredients.textContent = `材料: ${recipe.ingredients}`;
    steps.textContent = `作り方: ${recipe.steps}`;
    memo.textContent = recipe.memo ? `メモ: ${recipe.memo}` : '';

    image.src = recipe.imageUrl || 'https://placehold.co/800x450/f4e6d6/7c6a5b?text=No+Image';
    image.alt = recipe.name;

    favoriteBtn.textContent = recipe.favorite ? '★' : '☆';
    favoriteBtn.classList.toggle('active', recipe.favorite);

    (recipe.tags || []).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      tags.appendChild(span);
    });

    favoriteBtn.addEventListener('click', () => {
      recipe.favorite = !recipe.favorite;
      saveRecipes();
      renderRecipes();
    });

    editBtn.addEventListener('click', () => {
      recipeIdInput.value = recipe.id;
      nameInput.value = recipe.name;
      imageUrlInput.value = recipe.imageUrl || '';
      ingredientsInput.value = recipe.ingredients;
      stepsInput.value = recipe.steps;
      memoInput.value = recipe.memo || '';
      tagsInput.value = (recipe.tags || []).join(', ');
      formTitle.textContent = 'レシピを編集';
      cancelEditBtn.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    deleteBtn.addEventListener('click', () => {
      const ok = confirm(`「${recipe.name}」を削除しますか？`);
      if (!ok) return;
      recipes = recipes.filter((item) => item.id !== recipe.id);
      saveRecipes();
      renderRecipes();
      if (recipeIdInput.value === recipe.id) {
        resetForm();
      }
    });

    recipeList.appendChild(card);
  });
}
