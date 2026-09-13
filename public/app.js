const state = {
  categories: [],
  transactions: [],
  budgets: []
};

const money = value =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const API_BASES =
  location.port === "5500"
    ? ["http://127.0.0.1:3000", "http://127.0.0.1:3001"]
    : [""];

let activeApiBase = API_BASES[0];

const $ = selector => document.querySelector(selector);


// =========================================
// INITIAL VALUES
// =========================================

$("#transactionDate").value = today;
$("#budgetMonth").value = currentMonth;
$("#budgetYear").value = currentYear;


// =========================================
// API
// =========================================

async function api(path, options = {}) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: {
          "Content-Type": "application/json"
        },
        ...options
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message || `Request failed with status ${response.status}`
        );
      }

      activeApiBase = base;
      return response.json();

    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${lastError.message}. Run node server.js, then open http://127.0.0.1:3000`
  );
}


// =========================================
// ERROR
// =========================================

function showError(error) {
  console.error(error);
  alert(`Error: ${error.message}`);
}


// =========================================
// CSV
// =========================================

function exportCsv(event) {
  if (!activeApiBase) return;

  event.preventDefault();

  window.location.href =
    `${activeApiBase}/api/export`;
}

$("#exportCsv").addEventListener(
  "click",
  exportCsv
);


// =========================================
// PDF REPORT
// =========================================

$("#printPdf").addEventListener(
  "click",
  () => {
    window.print();
  }
);


// =========================================
// LOAD ALL
// =========================================

async function loadAll() {

  try {

    await loadCategories();

    await Promise.all([
      loadTransactions(),
      loadBudgets(),
      loadSummary()
    ]);

    await processRecurringTransactions();

  } catch (error) {

    showError(error);

  }
}


// =========================================
// LOAD CATEGORIES
// =========================================

async function loadCategories() {

  state.categories =
    await api("/api/categories");

  renderCategorySelects();
  renderCategories();
}


// =========================================
// LOAD TRANSACTIONS
// =========================================

async function loadTransactions() {

  // Load all transactions.
  // Search/month/year filtering is done
  // on the browser.

  state.transactions =
    await api("/api/transactions");

  renderTransactions();
}


// =========================================
// FILTER TRANSACTIONS
// =========================================

function getFilteredTransactions() {

  const search =
    $("#searchTransaction").value
      .trim()
      .toLowerCase();

  const type =
    $("#filterType").value;

  const month =
    Number($("#filterMonth").value);

  const year =
    Number($("#filterYear").value);

  const from =
    $("#filterFrom").value;

  const to =
    $("#filterTo").value;


  return state.transactions.filter(
    transaction => {

      const transactionDate =
        String(transaction.date).slice(0, 10);

      const dateObject =
        new Date(transactionDate);

      const transactionMonth =
        dateObject.getMonth() + 1;

      const transactionYear =
        dateObject.getFullYear();


      // Search
      if (search) {

        const searchable =
          `${transaction.categoryName || ""}
           ${transaction.description || ""}
           ${transaction.type}`
            .toLowerCase();

        if (!searchable.includes(search)) {
          return false;
        }
      }


      // Type
      if (type &&
          transaction.type !== type) {
        return false;
      }


      // Month
      if (month &&
          transactionMonth !== month) {
        return false;
      }


      // Year
      if (year &&
          transactionYear !== year) {
        return false;
      }


      // From date
      if (from &&
          transactionDate < from) {
        return false;
      }


      // To date
      if (to &&
          transactionDate > to) {
        return false;
      }


      return true;
    }
  );
}


// =========================================
// LOAD BUDGETS
// =========================================

async function loadBudgets() {

  state.budgets =
    await api("/api/budgets");

  renderBudgets();
}


// =========================================
// LOAD SUMMARY
// =========================================

async function loadSummary() {

  const summary =
    await api("/api/summary");


  $("#income").textContent =
    money(summary.income);

  $("#expense").textContent =
    money(summary.expense);

  $("#balance").textContent =
    money(summary.balance);


  // Savings rate
  const income =
    Number(summary.income || 0);

  const expense =
    Number(summary.expense || 0);

  const savingsRate =
    income > 0
      ? ((income - expense) / income) * 100
      : 0;

  $("#savingsRate").textContent =
    `${savingsRate.toFixed(1)}%`;


  renderBars(
    "#categoryChart",
    summary.byCategory,
    "name",
    "total"
  );


  renderPieChart(
    summary.byCategory
  );


  renderBars(
    "#monthlyChart",
    summary.byMonth,
    "month",
    "expense"
  );
}


// =========================================
// CATEGORY OPTIONS
// =========================================

function optionHtml(categories) {

  if (!categories.length) {
    return `
      <option value="">
        No categories found
      </option>
    `;
  }

  return categories
    .map(
      category =>
        `<option value="${category.id}">
          ${escapeHtml(category.name)}
        </option>`
    )
    .join("");
}


// =========================================
// CATEGORY SELECTS
// =========================================

function renderCategorySelects() {

  const type =
    $("#transactionType").value;


  const transactionCategories =
    state.categories.filter(
      category =>
        category.type === type
    );


  const expenseCategories =
    state.categories.filter(
      category =>
        category.type === "expense"
    );


  $("#transactionCategory").innerHTML =
    optionHtml(transactionCategories);


  $("#budgetCategory").innerHTML =
    optionHtml(expenseCategories);
}


// =========================================
// ESCAPE HTML
// =========================================

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =========================================
// TRANSACTIONS
// =========================================

function renderTransactions() {

  const transactions =
    getFilteredTransactions();


  $("#transactionCount").textContent =
    `${transactions.length} records`;


  if (!transactions.length) {

    $("#transactions").innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          No transactions found.
        </td>
      </tr>
    `;

    return;
  }


  $("#transactions").innerHTML =
    transactions
      .map(
        transaction => `
          <tr>

            <td>
              ${escapeHtml(transaction.date)}
            </td>

            <td>
              <span class="type-badge ${transaction.type}">
                ${escapeHtml(transaction.type)}
              </span>
            </td>

            <td>
              ${escapeHtml(transaction.categoryName)}
            </td>

            <td>
              ${escapeHtml(
                transaction.description || "-"
              )}
            </td>

            <td class="${transaction.type}">
              ${money(transaction.amount)}
            </td>

            <td>

              <div class="actions">

                <button
                  type="button"
                  onclick="editTransaction(${transaction.id})">
                  Edit
                </button>

                <button
                  type="button"
                  class="danger"
                  onclick="deleteTransaction(${transaction.id})">
                  Delete
                </button>

              </div>

            </td>

          </tr>
        `
      )
      .join("");
}


// =========================================
// CATEGORIES
// =========================================

function renderCategories() {

  if (!state.categories.length) {

    $("#categories").innerHTML =
      `<li class="empty">No categories found.</li>`;

    return;
  }


  $("#categories").innerHTML =
    state.categories
      .map(
        category => `
          <li>

            <span>

              <strong>
                ${escapeHtml(category.name)}
              </strong>

              <span class="muted">
                ${escapeHtml(category.type)}
              </span>

            </span>

            <div class="actions">

              <button
                type="button"
                onclick="editCategory(${category.id})">
                Edit
              </button>

              <button
                type="button"
                class="danger"
                onclick="deleteCategory(${category.id})">
                Delete
              </button>

            </div>

          </li>
        `
      )
      .join("");
}


// =========================================
// BUDGETS + PROGRESS
// =========================================

function renderBudgets() {

  if (!state.budgets.length) {

    $("#budgets").innerHTML =
      `<li class="empty">No budgets added yet.</li>`;

    return;
  }


  $("#budgets").innerHTML =
    state.budgets
      .map(budget => {

        const spent =
          getBudgetSpent(budget);

        const budgetAmount =
          Number(budget.amount);

        const percentage =
          budgetAmount > 0
            ? (spent / budgetAmount) * 100
            : 0;

        const displayPercentage =
          Math.min(percentage, 100);

        const remaining =
          budgetAmount - spent;

        const exceeded =
          spent > budgetAmount;


        return `
          <li class="budget-item">

            <div class="budget-main">

              <div class="budget-heading">

                <strong>
                  ${escapeHtml(
                    budget.categoryName ||
                    "Budget"
                  )}
                </strong>

                <span class="muted">
                  ${budget.month}/${budget.year}
                </span>

              </div>


              <div class="budget-numbers">

                <span>
                  Spent:
                  <strong>
                    ${money(spent)}
                  </strong>
                </span>

                <span>
                  Budget:
                  <strong>
                    ${money(budgetAmount)}
                  </strong>
                </span>

              </div>


              <div class="progress">

                <div
                  class="progress-fill ${exceeded ? "exceeded" : ""}"
                  style="width:${displayPercentage}%">
                </div>

              </div>


              <div class="budget-message ${
                exceeded
                  ? "over"
                  : "under"
              }">

                ${
                  exceeded
                    ? `⚠️ Exceeded by ${money(
                        spent - budgetAmount
                      )}`
                    : `₹ ${remaining.toLocaleString(
                        "en-IN"
                      )} remaining`
                }

                <span>
                  ${percentage.toFixed(0)}%
                </span>

              </div>

            </div>


            <div class="actions">

              <button
                type="button"
                onclick="editBudget(${budget.id})">
                Edit
              </button>

              <button
                type="button"
                class="danger"
                onclick="deleteBudget(${budget.id})">
                Delete
              </button>

            </div>

          </li>
        `;
      })
      .join("");
}


// =========================================
// GET BUDGET SPENT
// =========================================

function getBudgetSpent(budget) {

  return state.transactions
    .filter(transaction => {

      if (
        transaction.type !==
        "expense"
      ) {
        return false;
      }


      if (
        Number(transaction.categoryId) !==
        Number(budget.categoryId)
      ) {
        return false;
      }


      const date =
        new Date(
          String(transaction.date)
            .slice(0, 10)
        );


      const month =
        date.getMonth() + 1;

      const year =
        date.getFullYear();


      return (
        month === Number(budget.month) &&
        year === Number(budget.year)
      );
    })
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0
    );
}


// =========================================
// BAR CHART
// =========================================

function renderBars(
  selector,
  rows,
  labelKey,
  valueKey
) {

  const chart =
    $(selector);


  if (!rows || !rows.length) {

    chart.innerHTML =
      `<p class="muted">No data yet.</p>`;

    return;
  }


  const max =
    Math.max(
      ...rows.map(
        row => Number(row[valueKey])
      )
    );


  chart.innerHTML =
    rows
      .map(row => {

        const width =
          max
            ? Math.round(
                (Number(row[valueKey]) /
                  max) *
                100
              )
            : 0;


        return `
          <div class="bar">

            <span>
              ${escapeHtml(row[labelKey])}
            </span>

            <div class="track">

              <div
                class="fill"
                style="width:${width}%">
              </div>

            </div>

            <strong>
              ${money(row[valueKey])}
            </strong>

          </div>
        `;
      })
      .join("");
}


// =========================================
// PIE CHART
// =========================================

function renderPieChart(rows) {

  const chart =
    $("#pieChart");

  const legend =
    $("#pieLegend");


  if (!rows || !rows.length) {

    chart.style.background =
      "none";

    chart.innerHTML =
      `<span class="pie-empty">No data</span>`;

    legend.innerHTML = "";

    return;
  }


  const total =
    rows.reduce(
      (sum, row) =>
        sum + Number(row.total || 0),
      0
    );


  if (!total) {

    chart.style.background =
      "none";

    chart.innerHTML =
      `<span class="pie-empty">No expenses</span>`;

    legend.innerHTML = "";

    return;
  }


  let current = 0;

  const colors = [
    "#2457c5",
    "#14785a",
    "#c43d32",
    "#8a5cf6",
    "#e59b27",
    "#1497a8",
    "#d6538c",
    "#6b7280"
  ];


  const sections =
    rows.map(
      (row, index) => {

        const value =
          Number(row.total || 0);

        const percentage =
          (value / total) * 100;

        const start =
          current;

        const end =
          current + percentage;

        current = end;


        return `
          ${colors[index % colors.length]}
          ${start}% ${end}%
        `;
      }
    );


  chart.style.background =
    `conic-gradient(
      ${sections.join(",")}
    )`;


  chart.innerHTML = "";


  legend.innerHTML =
    rows
      .map(
        (row, index) => {

          const value =
            Number(row.total || 0);

          const percentage =
            ((value / total) * 100)
              .toFixed(1);


          return `
            <div class="legend-item">

              <span
                class="legend-dot"
                style="background:${
                  colors[
                    index %
                    colors.length
                  ]
                }">
              </span>

              <span>
                ${escapeHtml(row.name)}
              </span>

              <strong>
                ${percentage}%
              </strong>

            </div>
          `;
        }
      )
      .join("");
}


// =========================================
// BUDGET EXCEEDED ALERT
// =========================================

function checkBudgetExceeded(
  categoryId,
  amount,
  transactionDate,
  editingId = null
) {

  const type =
    $("#transactionType").value;


  if (type !== "expense") {
    return false;
  }


  const date =
    new Date(
      String(transactionDate)
        .slice(0, 10)
    );


  const month =
    date.getMonth() + 1;

  const year =
    date.getFullYear();


  const budget =
    state.budgets.find(
      b =>
        Number(b.categoryId) ===
          Number(categoryId) &&
        Number(b.month) === month &&
        Number(b.year) === year
    );


  if (!budget) {
    return false;
  }


  let existingExpenses =
    state.transactions
      .filter(transaction => {

        if (
          transaction.type !==
          "expense"
        ) {
          return false;
        }


        if (
          Number(transaction.categoryId) !==
          Number(categoryId)
        ) {
          return false;
        }


        const transactionDateObject =
          new Date(
            String(transaction.date)
              .slice(0, 10)
          );


        return (
          transactionDateObject
            .getMonth() + 1 === month &&
          transactionDateObject
            .getFullYear() === year
        );
      })
      .reduce(
        (total, transaction) =>
          total +
          Number(transaction.amount),
        0
      );


  // Remove old amount while editing
  if (editingId !== null) {

    const oldTransaction =
      state.transactions.find(
        transaction =>
          Number(transaction.id) ===
          Number(editingId)
      );


    if (oldTransaction) {

      const oldDate =
        new Date(
          String(oldTransaction.date)
            .slice(0, 10)
        );


      if (
        oldTransaction.type ===
          "expense" &&
        Number(oldTransaction.categoryId) ===
          Number(categoryId) &&
        oldDate.getMonth() + 1 === month &&
        oldDate.getFullYear() === year
      ) {

        existingExpenses -=
          Number(oldTransaction.amount);
      }
    }
  }


  const totalAfter =
    existingExpenses +
    Number(amount);


  if (
    totalAfter >
    Number(budget.amount)
  ) {

    const exceeded =
      totalAfter -
      Number(budget.amount);


    const category =
      state.categories.find(
        c =>
          Number(c.id) ===
          Number(categoryId)
      );


    alert(
      `⚠️ BUDGET EXCEEDED!\n\n` +
      `Category: ${
        category
          ? category.name
          : "Unknown"
      }\n\n` +
      `Budget: ${money(
        budget.amount
      )}\n` +
      `Total Expense: ${money(
        totalAfter
      )}\n` +
      `Exceeded By: ${money(
        exceeded
      )}`
    );


    return true;
  }


  return false;
}


// =========================================
// SEARCH / FILTER EVENTS
// =========================================

$("#applyFilters")
  .addEventListener(
    "click",
    renderTransactions
  );


$("#searchTransaction")
  .addEventListener(
    "input",
    renderTransactions
  );


$("#filterType")
  .addEventListener(
    "change",
    renderTransactions
  );


$("#filterMonth")
  .addEventListener(
    "change",
    renderTransactions
  );


$("#filterYear")
  .addEventListener(
    "input",
    renderTransactions
  );


$("#filterFrom")
  .addEventListener(
    "change",
    renderTransactions
  );


$("#filterTo")
  .addEventListener(
    "change",
    renderTransactions
  );


// =========================================
// CLEAR FILTERS
// =========================================

$("#clearFilters")
  .addEventListener(
    "click",
    () => {

      $("#searchTransaction").value =
        "";

      $("#filterType").value =
        "";

      $("#filterMonth").value =
        "";

      $("#filterYear").value =
        "";

      $("#filterFrom").value =
        "";

      $("#filterTo").value =
        "";

      renderTransactions();
    }
  );


// =========================================
// TRANSACTION TYPE
// =========================================

$("#transactionType")
  .addEventListener(
    "change",
    renderCategorySelects
  );


// =========================================
// NEW BUTTONS
// =========================================

$("#newTransaction")
  .addEventListener(
    "click",
    resetTransactionForm
  );


$("#newCategory")
  .addEventListener(
    "click",
    resetCategoryForm
  );


$("#newBudget")
  .addEventListener(
    "click",
    resetBudgetForm
  );


// =================================================
// TRANSACTION FORM
// =================================================

$("#transactionForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

        const id =
          $("#transactionId").value;


        const payload = {

          type:
            $("#transactionType").value,

          categoryId:
            Number(
              $("#transactionCategory")
                .value
            ),

          amount:
            Number(
              $("#transactionAmount")
                .value
            ),

          date:
            $("#transactionDate").value,

          description:
            $("#transactionDescription")
              .value
        };


        // Immediate budget check
        checkBudgetExceeded(
          payload.categoryId,
          payload.amount,
          payload.date,
          id
            ? Number(id)
            : null
        );


        await api(
          id
            ? `/api/transactions/${id}`
            : "/api/transactions",
          {

            method:
              id
                ? "PUT"
                : "POST",

            body:
              JSON.stringify(payload)
          }
        );


        // Save recurring template
        const recurring =
          $("#recurringTransaction")
            .checked;


        if (
          recurring &&
          !id &&
          payload.type ===
            "expense"
        ) {

          saveRecurringTransaction(
            payload
          );
        }


        resetTransactionForm();


        await Promise.all([
          loadTransactions(),
          loadBudgets(),
          loadSummary()
        ]);


      } catch (error) {

        showError(error);

      }
    }
  );


// =================================================
// CATEGORY FORM
// =================================================

$("#categoryForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

        const id =
          $("#categoryId").value;


        const payload = {

          name:
            $("#categoryName").value,

          type:
            $("#categoryType").value
        };


        await api(
          id
            ? `/api/categories/${id}`
            : "/api/categories",
          {

            method:
              id
                ? "PUT"
                : "POST",

            body:
              JSON.stringify(payload)
          }
        );


        resetCategoryForm();

        await loadCategories();


      } catch (error) {

        showError(error);

      }
    }
  );


// =================================================
// BUDGET FORM
// =================================================

$("#budgetForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      try {

        const id =
          $("#budgetId").value;


        const payload = {

          categoryId:
            Number(
              $("#budgetCategory").value
            ),

          amount:
            Number(
              $("#budgetAmount").value
            ),

          month:
            Number(
              $("#budgetMonth").value
            ),

          year:
            Number(
              $("#budgetYear").value
            )
        };


        await api(
          id
            ? `/api/budgets/${id}`
            : "/api/budgets",
          {

            method:
              id
                ? "PUT"
                : "POST",

            body:
              JSON.stringify(payload)
          }
        );


        resetBudgetForm();

        await loadBudgets();


      } catch (error) {

        showError(error);

      }
    }
  );


// =================================================
// EDIT TRANSACTION
// =================================================

function editTransaction(id) {

  const transaction =
    state.transactions.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!transaction) return;


  $("#transactionId").value =
    transaction.id;


  $("#transactionType").value =
    transaction.type;


  renderCategorySelects();


  $("#transactionCategory").value =
    transaction.categoryId;


  $("#transactionAmount").value =
    transaction.amount;


  $("#transactionDate").value =
    String(transaction.date)
      .slice(0, 10);


  $("#transactionDescription").value =
    transaction.description || "";


  $("#recurringTransaction").checked =
    false;


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// =================================================
// DELETE TRANSACTION
// =================================================

async function deleteTransaction(id) {

  if (
    !confirm(
      "Are you sure you want to delete this transaction?"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/transactions/${id}`,
      {
        method: "DELETE"
      }
    );


    await Promise.all([
      loadTransactions(),
      loadBudgets(),
      loadSummary()
    ]);


  } catch (error) {

    showError(error);

  }
}


// =================================================
// EDIT CATEGORY
// =================================================

function editCategory(id) {

  const category =
    state.categories.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!category) return;


  $("#categoryId").value =
    category.id;

  $("#categoryName").value =
    category.name;

  $("#categoryType").value =
    category.type;
}


// =================================================
// DELETE CATEGORY
// =================================================

async function deleteCategory(id) {

  if (
    !confirm(
      "Deleting a category may affect related records. Continue?"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/categories/${id}`,
      {
        method: "DELETE"
      }
    );


    await loadCategories();


  } catch (error) {

    showError(error);

  }
}


// =================================================
// EDIT BUDGET
// =================================================

function editBudget(id) {

  const budget =
    state.budgets.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!budget) return;


  $("#budgetId").value =
    budget.id;

  $("#budgetCategory").value =
    budget.categoryId;

  $("#budgetAmount").value =
    budget.amount;

  $("#budgetMonth").value =
    budget.month;

  $("#budgetYear").value =
    budget.year;
}


// =================================================
// DELETE BUDGET
// =================================================

async function deleteBudget(id) {

  if (
    !confirm(
      "Are you sure you want to delete this budget?"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/budgets/${id}`,
      {
        method: "DELETE"
      }
    );


    await loadBudgets();


  } catch (error) {

    showError(error);

  }
}


// =================================================
// RESET TRANSACTION
// =================================================

function resetTransactionForm() {

  $("#transactionForm").reset();

  $("#transactionId").value =
    "";

  $("#transactionType").value =
    "expense";

  $("#transactionDate").value =
    today;

  $("#recurringTransaction")
    .checked = false;

  renderCategorySelects();
}


// =================================================
// RESET CATEGORY
// =================================================

function resetCategoryForm() {

  $("#categoryForm").reset();

  $("#categoryId").value =
    "";

  $("#categoryType").value =
    "expense";
}


// =================================================
// RESET BUDGET
// =================================================

function resetBudgetForm() {

  $("#budgetForm").reset();

  $("#budgetId").value =
    "";

  $("#budgetMonth").value =
    currentMonth;

  $("#budgetYear").value =
    currentYear;
}


// =================================================
// DARK MODE
// =================================================

function applyDarkMode() {

  const enabled =
    localStorage.getItem(
      "expenseTrackerDarkMode"
    ) === "true";


  document.body.classList.toggle(
    "dark-mode",
    enabled
  );


  $("#darkModeBtn").textContent =
    enabled
      ? "☀️ Light Mode"
      : "🌙 Dark Mode";
}


$("#darkModeBtn")
  .addEventListener(
    "click",
    () => {

      const enabled =
        document.body.classList.contains(
          "dark-mode"
        );


      localStorage.setItem(
        "expenseTrackerDarkMode",
        String(!enabled)
      );


      applyDarkMode();
    }
  );


// =================================================
// RECURRING TRANSACTIONS
// =================================================

function getRecurringTransactions() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "expenseTrackerRecurring"
      ) || "[]"
    );

  } catch {

    return [];
  }
}


function saveRecurringTransaction(
  payload
) {

  const recurring =
    getRecurringTransactions();


  recurring.push({

    id:
      Date.now(),

    type:
      payload.type,

    categoryId:
      payload.categoryId,

    amount:
      payload.amount,

    description:
      payload.description,

    nextDate:
      addOneMonth(payload.date)

  });


  localStorage.setItem(
    "expenseTrackerRecurring",
    JSON.stringify(recurring)
  );
}


function addOneMonth(dateString) {

  const date =
    new Date(
      `${dateString}T00:00:00`
    );


  date.setMonth(
    date.getMonth() + 1
  );


  return date
    .toISOString()
    .slice(0, 10);
}


async function processRecurringTransactions() {

  const recurring =
    getRecurringTransactions();


  if (!recurring.length) {
    return;
  }


  const todayString =
    new Date()
      .toISOString()
      .slice(0, 10);


  let changed = false;


  for (
    const item of recurring
  ) {

    while (
      item.nextDate <=
      todayString
    ) {

      try {

        await api(
          "/api/transactions",
          {

            method: "POST",

            body:
              JSON.stringify({

                type:
                  item.type,

                categoryId:
                  Number(
                    item.categoryId
                  ),

                amount:
                  Number(
                    item.amount
                  ),

                date:
                  item.nextDate,

                description:
                  item.description
                    ? `${item.description} (Recurring)`
                    : "Recurring expense"

              })
          }
        );


        item.nextDate =
          addOneMonth(
            item.nextDate
          );


        changed = true;


      } catch (error) {

        console.error(
          "Recurring transaction error:",
          error
        );

        break;
      }
    }
  }


  if (changed) {

    localStorage.setItem(
      "expenseTrackerRecurring",
      JSON.stringify(recurring)
    );


    await Promise.all([
      loadTransactions(),
      loadBudgets(),
      loadSummary()
    ]);
  }
}


// =================================================
// START
// =================================================

applyDarkMode();

loadAll();
