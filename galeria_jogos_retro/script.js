class Item {
  constructor({ id = null, titulo, descricao, categoria, imagem, plataforma, ano, genero = "" }) {
    this.id = id;             
    this.titulo = titulo;
    this.descricao = descricao;
    this.categoria = categoria;
    this.imagem = imagem;
    this.plataforma = plataforma;
    this.ano = Number(ano);
    this.genero = genero || "";
  }
}

// Serviço Firebase
class ItemService {
  static #COLLECTION = "items";

  static async fetchItems() {
    const snap = await db.ref(ItemService.#COLLECTION).get();
    const list = [];
    if (snap.exists()) {
      const raw = snap.val();
      for (const [key, value] of Object.entries(raw)) {
        list.push(new Item({ id: key, ...value }));
      }
    }
    return list.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' }));
  }

  static async addItem(item) {
    const ref = db.ref(ItemService.#COLLECTION).push();
    const payload = { ...item };
    delete payload.id;
    await ref.set(payload);
    return ref.key;
  }

  static async updateItem(id, item) {
    const payload = { ...item };
    delete payload.id;
    await db.ref(`${ItemService.#COLLECTION}/${id}`).update(payload);
  }

  static async removeItem(id) {
    await db.ref(`${ItemService.#COLLECTION}/${id}`).remove();
  }
}

//UI / DOM 
const grid = document.getElementById("grid");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const template = document.getElementById("cardTemplate");

const form = document.getElementById("itemForm");
const formFeedback = document.getElementById("formFeedback");
const btnReload = document.getElementById("btnReload");
const btnLimpar = document.getElementById("btnLimpar");

const field = (id) => document.getElementById(id);

const filterCategoria = document.getElementById("filterCategoria");
const filterPlataforma = document.getElementById("filterPlataforma");

let state = {
  items: [],        
  filtered: [],   
};

function setLoading(v) {
  loading.style.display = v ? "block" : "none";
}

function showFeedback(msg, type = "muted") {
  formFeedback.className = "form-text mt-2 text-" + (type === "error" ? "danger" : type === "success" ? "success" : "secondary");
  formFeedback.textContent = msg;
}

function collectForm() {
  return new Item({
    id: field("itemId").value || null,
    titulo: field("titulo").value.trim(),
    descricao: field("descricao").value.trim(),
    categoria: field("categoria").value.trim(),
    imagem: field("imagem").value.trim(),
    plataforma: field("plataforma").value.trim(),
    ano: field("ano").value.trim(),
    genero: field("genero").value.trim(),
  });
}

function fillForm(item) {
  field("itemId").value = item.id || "";
  field("titulo").value = item.titulo || "";
  field("descricao").value = item.descricao || "";
  field("categoria").value = item.categoria || "";
  field("imagem").value = item.imagem || "";
  field("plataforma").value = item.plataforma || "";
  field("ano").value = item.ano || "";
  field("genero").value = item.genero || "";
}

function clearForm() {
  form.reset();
  field("itemId").value = "";
  showFeedback("");
}

function buildOptions(select, values) {
  const selected = select.value;
  const first = select.querySelector("option[value='']");
  select.innerHTML = "";
  if (first) select.appendChild(first);
  Array.from(new Set(values)).sort((a,b)=>a.localeCompare(b)).forEach(v => {
    if (!v) return;
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  if ([...select.options].some(o => o.value === selected)) {
    select.value = selected;
  }
}

function applyFilters() {
  const cat = filterCategoria.value;
  const plat = filterPlataforma.value;
  state.filtered = state.items.filter(it => {
    const c1 = !cat || it.categoria === cat;
    const c2 = !plat || it.plataforma === plat;
    return c1 && c2;
  });
  renderGrid();
}

function renderGrid() {
  grid.innerHTML = "";
  if (!state.filtered.length) {
    emptyState.classList.remove("d-none");
    return;
  }
  emptyState.classList.add("d-none");

  const frag = document.createDocumentFragment();
  state.filtered.forEach(item => {
    const cardNode = template.content.cloneNode(true);
    const img = cardNode.querySelector("img");
    const title = cardNode.querySelector(".card-title");
    const text = cardNode.querySelector(".card-text");
    const bCat = cardNode.querySelector(".categoria");
    const bPlat = cardNode.querySelector(".plataforma");
    const bAno = cardNode.querySelector(".ano");
    const btnEditar = cardNode.querySelector(".btnEditar");
    const btnRemover = cardNode.querySelector(".btnRemover");

    img.src = item.imagem || "https://via.placeholder.com/600x400?text=Capa+do+Jogo";
    img.onerror = () => { img.src = "https://via.placeholder.com/600x400?text=Capa+indispon%C3%ADvel"; };
    img.alt = `Capa de ${item.titulo}`;

    title.textContent = item.titulo;
    text.textContent = item.descricao;
    bCat.textContent = item.categoria;
    bPlat.textContent = item.plataforma;
    bAno.textContent = item.ano;

    btnEditar.addEventListener("click", () => {
      fillForm(item);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    btnRemover.addEventListener("click", async () => {
      if (!confirm(`Remover "${item.titulo}"?`)) return;
      try {
        await ItemService.removeItem(item.id);
        await loadAndRender();
      } catch (e) {
        alert("Erro ao remover: " + e.message);
      }
    });

    frag.appendChild(cardNode);
  });
  grid.appendChild(frag);
}

async function loadAndRender() {
  setLoading(true);
  try {
    const items = await ItemService.fetchItems();
    state.items = items;
    buildOptions(filterCategoria, items.map(i => i.categoria));
    buildOptions(filterPlataforma, items.map(i => i.plataforma));
    applyFilters();
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Falha ao carregar itens. Verifique sua configuração do Firebase e a conexão.</div></div>';
  } finally {
    setLoading(false);
  }
}

// Eventos
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  // validações simples
  const item = collectForm();
  if (!item.titulo || !item.descricao || !item.categoria || !item.imagem || !item.plataforma || !item.ano) {
    showFeedback("Preencha os campos obrigatórios (*).", "error");
    return;
  }
  try {
    showFeedback("Salvando...", "muted");
    if (item.id) {
      await ItemService.updateItem(item.id, item);
      showFeedback("Jogo atualizado com sucesso!", "success");
    } else {
      await ItemService.addItem(item);
      showFeedback("Jogo adicionado com sucesso!", "success");
    }
    clearForm();
    await loadAndRender();
  } catch (e) {
    console.error(e);
    showFeedback("Erro ao salvar: " + e.message, "error");
  }
});

btnLimpar.addEventListener("click", clearForm);
btnReload.addEventListener("click", loadAndRender);

filterCategoria.addEventListener("change", applyFilters);
filterPlataforma.addEventListener("change", applyFilters);

// Carregamento inicial
document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();
});
