const state = {
  categories: [],
  transactions: [],
  budgets: []
};

const money = value => `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();
const API_BASES = location.port === "5500" ? ["http://127.0.0.1:3000", "http://127.0.0.1:3001"] : [""];
let activeApiBase = API_BASES[0];

document.querySelector("#transactionDate").value = today;
document.querySelector("#budgetMonth").value = currentMonth;
document.querySelector("#budgetYear").value = currentYear;

async function api(path, options = {}) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
      }

      activeApiBase = base;
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`${lastError.message}. Run node server.js, then open http://127.0.0.1:3000 or http://127.0.0.1:3001`);
}

function exportCsv(event) {
  if (!activeApiBase) return;
  event.preventDefault();
  window.location.href = `${activeApiBase}/api/export`;
}

function showError(error) {
  console.error(error);
  alert(`Error: ${error.message}`);
}

document.querySelector("#exportCsv").addEventListener("click", exportCsv);

async function loadAll() {
  try {
    await loadCategories();
    await Promise.all([loadTransactions(), loadBudgets(), loadSummary()]);
  } catch (error) {
    showError(error);
  }
}

async function loadCategories() {
  state.categories = await api("/api/categories");
  renderCategorySelects();
  renderCategories();
}

async function loadTransactions() {
  const params = new URLSearchParams();
  if (document.querySelector("#filterType").value) params.set("type", document.querySelector("#filterType").value);
  if (document.querySelector("#filterFrom").value) params.set("from", document.querySelector("#filterFrom").value);
  if (document.querySelector("#filterTo").value) params.set("to", document.querySelector("#filterTo").value);
  state.transactions = await api(`/api/transactions?${params.toString()}`);
  renderTransactions();
}

async function loadBudgets() {
  state.budgets = await api("/api/budgets");
  renderBudgets();
}

async function loadSummary() {
  const summary = await api("/api/summary");
  document.querySelector("#income").textContent = money(summary.income);
  document.querySelector("#expense").textContent = money(summary.expense);
  document.querySelector("#balance").textContent = money(summary.balance);
  renderBars("#categoryChart", summary.byCategory, "name", "total");
  renderBars("#monthlyChart", summary.byMonth, "month", "expense");
}

function optionHtml(categories) {
  if (!categories.length) return `<option value="">No categories found</option>`;
  return categories.map(category => `<option value="${category.id}">${category.name}</option>`).join("");
}

function renderCategorySelects() {
  const type = document.querySelector("#transactionType").value;
  const transactionCategories = state.categories.filter(category => category.type === type);
  const expenseCategories = state.categories.filter(category => category.type === "expense");
  document.querySelector("#transactionCategory").innerHTML = optionHtml(transactionCategories);
  document.querySelector("#budgetCategory").innerHTML = optionHtml(expenseCategories);
}

function renderTransactions() {
  document.querySelector("#transactionCount").textContent = `${state.transactions.length} records`;
  document.querySelector("#transactions").innerHTML = state.transactions.map(transaction => `
    <tr>
      <td>${transaction.date}</td>
      <td>${transaction.type}</td>
      <td>${transaction.categoryName}</td>
      <td>${transaction.description || "-"}</td>
      <td class="${transaction.type}">${money(transaction.amount)}</td>
      <td>
        <div class="actions">
          <button type="button" onclick="editTransaction(${transaction.id})">Edit</button>
          <button type="button" class="danger" onclick="deleteTransaction(${transaction.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderCategories() {
  document.querySelector("#categories").innerHTML = state.categories.map(category => `
    <li>
      <span><strong>${category.name}</strong> <span class="muted">${category.type}</span></span>
      <div class="actions">
        <button type="button" onclick="editCategory(${category.id})">Edit</button>
        <button type="button" class="danger" onclick="deleteCategory(${category.id})">Delete</button>
      </div>
    </li>
  `).join("");
}

function renderBudgets() {
  document.querySelector("#budgets").innerHTML = state.budgets.map(budget => `
    <li>
      <span><strong>${budget.categoryName || "Budget"}</strong> ${money(budget.amount)} <span class="muted">${budget.month}/${budget.year}</span></span>
      <div class="actions">
        <button type="button" onclick="editBudget(${budget.id})">Edit</button>
        <button type="button" class="danger" onclick="deleteBudget(${budget.id})">Delete</button>
      </div>
    </li>
  `).join("");
}

function renderBars(selector, rows, labelKey, valueKey) {
  const chart = document.querySelector(selector);
  if (!rows.length) {
    chart.innerHTML = `<p class="muted">No data yet.</p>`;
    return;
  }
  const max = Math.max(...rows.map(row => Number(row[valueKey])));
  chart.innerHTML = rows.map(row => {
    const width = max ? Math.round((Number(row[valueKey]) / max) * 100) : 0;
    return `
      <div class="bar">
        <span>${row[labelKey]}</span>
        <div class="track"><div class="fill" style="width:${width}%"></div></div>
        <strong>${money(row[valueKey])}</strong>
      </div>
    `;
  }).join("");
}

document.querySelector("#transactionType").addEventListener("change", renderCategorySelects);
document.querySelector("#applyFilters").addEventListener("click", loadTransactions);
document.querySelector("#clearFilters").addEventListener("click", async () => {
  document.querySelector("#filterType").value = "";
  document.querySelector("#filterFrom").value = "";
  document.querySelector("#filterTo").value = "";
  await loadTransactions();
});

document.querySelector("#newTransaction").addEventListener("click", resetTransactionForm);
document.querySelector("#newCategory").addEventListener("click", resetCategoryForm);
document.querySelector("#newBudget").addEventListener("click", resetBudgetForm);

document.querySelector("#transactionForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const id = document.querySelector("#transactionId").value;
    const payload = {
      type: document.querySelector("#transactionType").value,
      categoryId: Number(document.querySelector("#transactionCategory").value),
      amount: Number(document.querySelector("#transactionAmount").value),
      date: document.querySelector("#transactionDate").value,
      description: document.querySelector("#transactionDescription").value
    };
    await api(id ? `/api/transactions/${id}` : "/api/transactions", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    resetTransactionForm();
    await Promise.all([loadTransactions(), loadSummary()]);
  } catch (error) {
    showError(error);
  }
});

document.querySelector("#categoryForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const id = document.querySelector("#categoryId").value;
    const payload = {
      name: document.querySelector("#categoryName").value,
      type: document.querySelector("#categoryType").value
    };
    await api(id ? `/api/categories/${id}` : "/api/categories", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    resetCategoryForm();
    await loadCategories();
  } catch (error) {
    showError(error);
  }
});

document.querySelector("#budgetForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const id = document.querySelector("#budgetId").value;
    const payload = {
      categoryId: Number(document.querySelector("#budgetCategory").value),
      amount: Number(document.querySelector("#budgetAmount").value),
      month: Number(document.querySelector("#budgetMonth").value),
      year: Number(document.querySelector("#budgetYear").value)
    };
    await api(id ? `/api/budgets/${id}` : "/api/budgets", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    resetBudgetForm();
    await loadBudgets();
  } catch (error) {
    showError(error);
  }
});

function editTransaction(id) {
  const transaction = state.transactions.find(item => item.id === id);
  document.querySelector("#transactionId").value = transaction.id;
  document.querySelector("#transactionType").value = transaction.type;
  renderCategorySelects();
  document.querySelector("#transactionCategory").value = transaction.categoryId;
  document.querySelector("#transactionAmount").value = transaction.amount;
  document.querySelector("#transactionDate").value = transaction.date;
  document.querySelector("#transactionDescription").value = transaction.description || "";
}

async function deleteTransaction(id) {
  await api(`/api/transactions/${id}`, { method: "DELETE" });
  await Promise.all([loadTransactions(), loadSummary()]);
}

function editCategory(id) {
  const category = state.categories.find(item => item.id === id);
  document.querySelector("#categoryId").value = category.id;
  document.querySelector("#categoryName").value = category.name;
  document.querySelector("#categoryType").value = category.type;
}

async function deleteCategory(id) {
  await api(`/api/categories/${id}`, { method: "DELETE" });
  await loadCategories();
}

function editBudget(id) {
  const budget = state.budgets.find(item => item.id === id);
  document.querySelector("#budgetId").value = budget.id;
  document.querySelector("#budgetCategory").value = budget.categoryId;
  document.querySelector("#budgetAmount").value = budget.amount;
  document.querySelector("#budgetMonth").value = budget.month;
  document.querySelector("#budgetYear").value = budget.year;
}

async function deleteBudget(id) {
  await api(`/api/budgets/${id}`, { method: "DELETE" });
  await loadBudgets();
}

function resetTransactionForm() {
  document.querySelector("#transactionForm").reset();
  document.querySelector("#transactionId").value = "";
  document.querySelector("#transactionType").value = "expense";
  document.querySelector("#transactionDate").value = today;
  renderCategorySelects();
}

function resetCategoryForm() {
  document.querySelector("#categoryForm").reset();
  document.querySelector("#categoryId").value = "";
  document.querySelector("#categoryType").value = "expense";
}

function resetBudgetForm() {
  document.querySelector("#budgetForm").reset();
  document.querySelector("#budgetId").value = "";
  document.querySelector("#budgetMonth").value = currentMonth;
  document.querySelector("#budgetYear").value = currentYear;
}

loadAll();
