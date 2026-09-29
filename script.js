/* =========================================================
   Expense Tracker — App Logic
   Author: Your Name
   ========================================================= */

// ---------- Config ----------
const STORAGE_KEY = "transactions";
const SCHEMA_VERSION = 2;

const CATEGORIES = {
  expense: ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other"],
  income: ["Salary", "Freelance", "Investment", "Gift", "Other"],
};

const ALL_CATEGORIES = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])].sort();

const CHART_COLORS = ["#5468e0", "#e04f4f", "#0e9f6e", "#e0a33a", "#8b5cf6", "#0ea5b7", "#94a3b8"];

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);

const balance = $("balance");
const moneyPlus = $("money-plus");
const moneyMinus = $("money-minus");
const flowIncome = $("flow-income");
const flowExpense = $("flow-expense");

const form = $("form");
const formPanel = $("form-panel");
const formTitle = $("form-title");
const text = $("text");
const amount = $("amount");
const category = $("category");
const dateInput = $("date");
const submitBtn = $("submit-btn");
const cancelBtn = $("cancel-btn");

const list = $("list");
const empty = $("empty");
const emptyTitle = $("empty-title");
const emptyText = $("empty-text");
const count = $("count");
const filterCategory = $("filter-category");
const chips = document.querySelectorAll(".chip");

const summaryMonth = $("summary-month");
const mIncome = $("m-income");
const mExpense = $("m-expense");
const mNet = $("m-net");
const chart = $("chart");
const chartEmpty = $("chart-empty");

const exportBtn = $("export-btn");
const importBtn = $("import-btn");
const importFile = $("import-file");

const FIELDS = { text, amount, category, date: dateInput };

// ---------- Icons ----------
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const DELETE_ICON =
  "<svg " + ICON_ATTRS + '><path d="M3 6h18"/><path d="M8 6V4h8v2"/>' +
  '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const EDIT_ICON =
  "<svg " + ICON_ATTRS + '><path d="M12 20h9"/>' +
  '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

// ---------- Date helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => toISODate(new Date());

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  return parseISODate(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isValidISODate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(parseISODate(iso).getTime());
}

// ---------- Money helpers ----------
function formatMoney(value) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const rupee = (v) => "\u20B9" + formatMoney(v);

// ---------- State ----------
let transactions = loadTransactions();
let editingId = null;
let filters = { type: "all", category: "all" };
let submitting = false;
let appDate = today();

// ---------- Storage: normalize (migration from v1) ----------
function normalize(t) {
  if (t && t.type && t.date && t.category) return t;
  const created = new Date(Math.floor(Number(t.id) / 1000));
  return {
    id: t.id,
    type: t.amount < 0 ? "expense" : "income",
    amount: Math.abs(Number(t.amount)) || 0,
    category: "Other",
    date: isNaN(created.getTime()) ? today() : toISODate(created),
    text: t.text || "",
  };
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Support both array and { version, data } shapes
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    return arr.map(normalize);
  } catch (e) {
    console.warn("Could not load transactions:", e);
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, data: transactions })
    );
  } catch (e) {
    console.warn("Could not save transactions:", e);
    showToast("Storage full — your data may not persist.");
  }
}

const generateID = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

// ---------- Toast ----------
let toastEl = null;
let toastTimer = null;
function showToast(message) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

// ---------- Form: categories ----------
const currentType = () => form.elements["type"].value;

function fillOptions(select, options, selected) {
  select.innerHTML = "";
  options.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (selected && options.includes(selected)) select.value = selected;
}

function refreshCategoryOptions(selected) {
  fillOptions(category, CATEGORIES[currentType()], selected);
}

// ---------- Form: validation ----------
function setError(field, message) {
  $("err-" + field).textContent = message;
  FIELDS[field].classList.toggle("invalid", Boolean(message));
}

function clearErrors() {
  Object.keys(FIELDS).forEach((f) => setError(f, ""));
}

function validate() {
  const errors = {};
  const name = text.value.trim();
  const value = parseFloat(amount.value);

  if (name === "") errors.text = "Add a description, like \u201CGroceries\u201D.";
  if (amount.value === "" || isNaN(value)) errors.amount = "Enter an amount.";
  else if (value <= 0) errors.amount = "Amount must be greater than 0.";
  else if (value > 1e10) errors.amount = "That amount is too large.";
  if (!CATEGORIES[currentType()].includes(category.value)) errors.category = "Choose a category.";
  if (dateInput.value === "") errors.date = "Pick a date.";
  else if (!isValidISODate(dateInput.value)) errors.date = "Enter a valid date.";

  Object.keys(FIELDS).forEach((f) => setError(f, errors[f] || ""));

  const firstBad = Object.keys(FIELDS).find((f) => errors[f]);
  if (firstBad) FIELDS[firstBad].focus();
  return !firstBad;
}

// ---------- Add / edit ----------
function handleSubmit(e) {
  e.preventDefault();
  if (submitting || !validate()) return;

  submitting = true;
  try {
    const data = {
      type: currentType(),
      amount: Math.round(parseFloat(amount.value) * 100) / 100,
      category: category.value,
      date: dateInput.value,
      text: text.value.trim(),
    };

    let highlightId;
    if (editingId !== null) {
      transactions = transactions.map((t) => (t.id === editingId ? { ...t, ...data } : t));
      highlightId = editingId;
      showToast("Transaction updated");
    } else {
      highlightId = generateID();
      transactions.push({ id: highlightId, ...data });
      showToast("Transaction added");
    }

    save();
    summaryMonth.value = data.date.slice(0, 7);
    exitEditMode();
    render(highlightId);
    text.focus();
  } finally {
    submitting = false;
  }
}

function enterEditMode(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;

  editingId = id;
  form.elements["type"].value = t.type;
  refreshCategoryOptions(t.category);
  text.value = t.text;
  amount.value = t.amount;
  dateInput.value = t.date;
  clearErrors();

  formTitle.textContent = "Edit transaction";
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  formPanel.classList.add("is-editing");
  formPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  text.focus({ preventScroll: true });
  render();
}

function exitEditMode() {
  editingId = null;
  form.reset();
  refreshCategoryOptions();
  dateInput.value = appDate;
  clearErrors();

  formTitle.textContent = "Add transaction";
  submitBtn.textContent = "Add transaction";
  cancelBtn.hidden = true;
  formPanel.classList.remove("is-editing");
}

// ---------- Delete ----------
function removeTransaction(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  if (!confirm('Delete "' + t.text + '"?')) return;

  transactions = transactions.filter((x) => x.id !== id);
  save();
  if (editingId === id) exitEditMode();
  render();
  showToast("Transaction deleted");
}

// ---------- Filtering ----------
function filteredTransactions() {
  return transactions
    .filter((t) => filters.type === "all" || t.type === filters.type)
    .filter((t) => filters.category === "all" || t.category === filters.category)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

function setTypeFilter(type) {
  filters.type = type;
  chips.forEach((chip) => {
    const active = chip.dataset.type === type;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
  render();
}

// ---------- Render: list ----------
function addTransactionDOM(t, highlightId) {
  const isExpense = t.type === "expense";

  const item = document.createElement("li");
  item.classList.add(isExpense ? "minus" : "plus");
  if (t.id === highlightId) item.classList.add("is-new");
  if (t.id === editingId) item.classList.add("is-editing");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = (t.text.trim()[0] || "?").toUpperCase();

  const info = document.createElement("div");
  info.className = "item-info";

  const name = document.createElement("p");
  name.className = "item-name";
  name.textContent = t.text;
  name.title = t.text;

  const meta = document.createElement("p");
  meta.className = "item-type";
  meta.textContent = t.category + ", " + formatDate(t.date);

  info.append(name, meta);

  const value = document.createElement("span");
  value.className = "item-amount";
  value.textContent = (isExpense ? "-" : "+") + rupee(t.amount);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const edit = document.createElement("button");
  edit.className = "edit-btn";
  edit.type = "button";
  edit.dataset.id = t.id;
  edit.setAttribute("aria-label", "Edit " + t.text);
  edit.innerHTML = EDIT_ICON;

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.type = "button";
  del.dataset.id = t.id;
  del.setAttribute("aria-label", "Delete " + t.text);
  del.innerHTML = DELETE_ICON;

  actions.append(edit, del);
  item.append(avatar, info, value, actions);
  list.appendChild(item);
}

function renderList(highlightId) {
  list.innerHTML = "";
  const shown = filteredTransactions();
  shown.forEach((t) => addTransactionDOM(t, highlightId));

  const total = transactions.length;
  const filtering = filters.type !== "all" || filters.category !== "all";

  if (total === 0) {
    emptyTitle.textContent = "No transactions yet";
    emptyText.textContent = "Add your first income or expense using the form.";
  } else {
    emptyTitle.textContent = "No matching transactions";
    emptyText.textContent = "Try a different filter to see more.";
  }
  empty.classList.toggle("show", shown.length === 0);

  count.textContent = filtering
    ? shown.length + " of " + total + (total === 1 ? " transaction" : " transactions")
    : total + (total === 1 ? " transaction" : " transactions");
}

// ---------- Render: totals ----------
const sumBy = (items, type) =>
  items.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);

function renderTotals() {
  const income = sumBy(transactions, "income");
  const expense = sumBy(transactions, "expense");
  const total = income - expense;

  balance.textContent = (total < 0 ? "-" : "") + rupee(Math.abs(total));
  moneyPlus.textContent = "+" + rupee(income);
  moneyMinus.textContent = "-" + rupee(expense);

  const flow = income + expense;
  flowIncome.style.width = flow ? (income / flow) * 100 + "%" : "0%";
  flowExpense.style.width = flow ? (expense / flow) * 100 + "%" : "0%";
}

// ---------- Render: monthly summary + category chart ----------
function renderSummary() {
  const month = summaryMonth.value;
  const inMonth = transactions.filter((t) => t.date.slice(0, 7) === month);

  const income = sumBy(inMonth, "income");
  const expense = sumBy(inMonth, "expense");
  const net = income - expense;

  mIncome.textContent = rupee(income);
  mExpense.textContent = rupee(expense);
  mNet.textContent = (net < 0 ? "-" : "") + rupee(Math.abs(net));
  mNet.className = "summary-value " + (net < 0 ? "minus" : net > 0 ? "plus" : "");

  const totals = {};
  inMonth
    .filter((t) => t.type === "expense")
    .forEach((t) => (totals[t.category] = (totals[t.category] || 0) + t.amount));

  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  chart.innerHTML = "";
  chartEmpty.classList.toggle("show", rows.length === 0);

  rows.forEach(([name, sum], i) => {
    const pct = expense ? (sum / expense) * 100 : 0;

    const li = document.createElement("li");
    li.setAttribute("role", "img");
    li.setAttribute(
      "aria-label",
      name + ": " + rupee(sum) + ", " + Math.round(pct) + " percent of expenses"
    );

    const head = document.createElement("div");
    head.className = "chart-row-head";
    const label = document.createElement("span");
    label.textContent = name;
    const figures = document.createElement("span");
    figures.textContent = rupee(sum) + " (" + Math.round(pct) + "%)";
    head.append(label, figures);

    const track = document.createElement("div");
    track.className = "chart-track";
    const fill = document.createElement("span");
    fill.className = "chart-fill";
    fill.style.background = CHART_COLORS[i % CHART_COLORS.length];
    track.appendChild(fill);

    li.append(head, track);
    chart.appendChild(li);

    requestAnimationFrame(() => (fill.style.width = pct + "%"));
  });
}

// ---------- Render everything ----------
function render(highlightId) {
  renderList(highlightId);
  renderTotals();
  renderSummary();
}

// ---------- Import / Export ----------
function exportData() {
  if (transactions.length === 0) {
    showToast("Nothing to export yet.");
    return;
  }
  const payload = { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: transactions };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses-" + today() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Data exported");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : null;
      if (!arr) throw new Error("Invalid file format");

      const normalized = arr.map(normalize).filter((t) => t && t.id && t.amount >= 0);
      if (normalized.length === 0) throw new Error("No transactions found");

      if (!confirm("Import " + normalized.length + " transaction(s)? This will replace your current data.")) {
        return;
      }

      transactions = normalized;
      save();
      render();
      showToast("Imported " + normalized.length + " transaction(s)");
    } catch (err) {
      showToast("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- Events ----------
form.addEventListener("submit", handleSubmit);

cancelBtn.addEventListener("click", () => {
  exitEditMode();
  render();
});

form.querySelectorAll('input[name="type"]').forEach((radio) =>
  radio.addEventListener("change", () => refreshCategoryOptions())
);

Object.entries(FIELDS).forEach(([name, field]) => {
  const evt = field.tagName === "SELECT" ? "change" : "input";
  field.addEventListener(evt, () => setError(name, ""));
});

list.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".edit-btn");
  if (editBtn) return enterEditMode(Number(editBtn.dataset.id));

  const delBtn = e.target.closest(".delete-btn");
  if (delBtn) removeTransaction(Number(delBtn.dataset.id));
});

chips.forEach((chip) => chip.addEventListener("click", () => setTypeFilter(chip.dataset.type)));

filterCategory.addEventListener("change", () => {
  filters.category = filterCategory.value;
  render();
});

summaryMonth.addEventListener("change", () => {
  if (!summaryMonth.value) summaryMonth.value = today().slice(0, 7);
  renderSummary();
});

exportBtn.addEventListener("click", exportData);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importData(file);
  importFile.value = "";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editingId !== null) {
    exitEditMode();
    render();
  }
});

// Refresh "today" if the tab is left open past midnight
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    const now = today();
    if (now !== appDate && dateInput.value === appDate) {
      dateInput.value = now;
    }
    appDate = now;
  }
});

// ---------- Init ----------
fillOptions(filterCategory, ["all", ...ALL_CATEGORIES]);
filterCategory.options[0].textContent = "All categories";
refreshCategoryOptions();
dateInput.value = appDate;
summaryMonth.value = appDate.slice(0, 7);
render();