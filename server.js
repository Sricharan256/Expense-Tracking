const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, "public");
const DB_PATH = path.join(BASE_DIR, "db.json");

const defaultData = {
  nextIds: { categories: 9, transactions: 1, budgets: 1 },
  categories: [
    { id: 1, name: "Salary", type: "income" },
    { id: 2, name: "Freelance", type: "income" },
    { id: 3, name: "Food", type: "expense" },
    { id: 4, name: "Rent", type: "expense" },
    { id: 5, name: "Travel", type: "expense" },
    { id: 6, name: "Shopping", type: "expense" },
    { id: 7, name: "Bills", type: "expense" },
    { id: 8, name: "Education", type: "expense" }
  ],
  transactions: [],
  budgets: []
};

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, text, status = 200, contentType = "text/plain") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(text);
}

function badRequest(res, message) {
  return sendJson(res, { error: message }, 400);
}

function isValidType(type) {
  return type === "income" || type === "expense";
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value));
}

function findCategory(db, categoryId, type) {
  return db.categories.find(item => item.id === Number(categoryId) && (!type || item.type === type));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, "Forbidden", 403);
  }

  if (!fs.existsSync(filePath)) {
    return sendText(res, "Not found", 404);
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function withCategoryName(db, transaction) {
  const category = db.categories.find(item => item.id === transaction.categoryId);
  return {
    ...transaction,
    categoryName: category ? category.name : "Unknown"
  };
}

function getFilteredTransactions(db, searchParams) {
  let rows = db.transactions.map(transaction => withCategoryName(db, transaction));
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (type) rows = rows.filter(row => row.type === type);
  if (from) rows = rows.filter(row => row.date >= from);
  if (to) rows = rows.filter(row => row.date <= to);

  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function handleGet(req, res, url) {
  const db = readDb();

  if (url.pathname === "/api/categories") {
    return sendJson(res, db.categories.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
  }

  if (url.pathname === "/api/transactions") {
    return sendJson(res, getFilteredTransactions(db, url.searchParams));
  }

  if (url.pathname === "/api/budgets") {
    const rows = db.budgets.map(budget => {
      const category = db.categories.find(item => item.id === budget.categoryId);
      return { ...budget, categoryName: category ? category.name : "Unknown" };
    });
    return sendJson(res, rows.sort((a, b) => b.year - a.year || b.month - a.month));
  }

  if (url.pathname === "/api/summary") {
    const income = db.transactions
      .filter(item => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = db.transactions
      .filter(item => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const byCategoryMap = new Map();
    db.transactions.filter(item => item.type === "expense").forEach(item => {
      const category = db.categories.find(row => row.id === item.categoryId);
      const name = category ? category.name : "Unknown";
      byCategoryMap.set(name, (byCategoryMap.get(name) || 0) + Number(item.amount));
    });

    const byMonthMap = new Map();
    db.transactions.forEach(item => {
      const month = item.date.slice(0, 7);
      const current = byMonthMap.get(month) || { month, income: 0, expense: 0 };
      current[item.type] += Number(item.amount);
      byMonthMap.set(month, current);
    });

    return sendJson(res, {
      income,
      expense,
      balance: income - expense,
      byCategory: [...byCategoryMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      byMonth: [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month))
    });
  }

  if (url.pathname === "/api/export") {
    const rows = getFilteredTransactions(db, url.searchParams);
    const header = "id,date,type,category,amount,description";
    const lines = rows.map(row => [
      row.id,
      row.date,
      row.type,
      row.categoryName,
      row.amount,
      `"${String(row.description || "").replaceAll('"', '""')}"`
    ].join(","));

    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=transactions.csv"
    });
    return res.end([header, ...lines].join("\n"));
  }

  return serveStatic(res, url.pathname);
}

async function handlePost(req, res, url) {
  const db = readDb();
  const body = await readBody(req);

  if (url.pathname === "/api/categories") {
    const name = String(body.name || "").trim();
    if (!name) return badRequest(res, "Category name is required.");
    if (!isValidType(body.type)) return badRequest(res, "Category type must be income or expense.");

    const category = {
      id: db.nextIds.categories++,
      name,
      type: body.type
    };
    db.categories.push(category);
    writeDb(db);
    return sendJson(res, category, 201);
  }

  if (url.pathname === "/api/transactions") {
    if (!isValidType(body.type)) return badRequest(res, "Transaction type must be income or expense.");
    if (!findCategory(db, body.categoryId, body.type)) return badRequest(res, "Choose a valid category for this transaction type.");
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return badRequest(res, "Transaction amount must be greater than zero.");
    if (!isValidDate(body.date)) return badRequest(res, "Transaction date is required.");

    const transaction = {
      id: db.nextIds.transactions++,
      categoryId: Number(body.categoryId),
      amount: Number(body.amount),
      type: body.type,
      description: String(body.description || "").trim(),
      date: body.date,
      createdAt: new Date().toISOString()
    };
    db.transactions.push(transaction);
    writeDb(db);
    return sendJson(res, withCategoryName(db, transaction), 201);
  }

  if (url.pathname === "/api/budgets") {
    if (!findCategory(db, body.categoryId, "expense")) return badRequest(res, "Choose a valid expense category.");
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0) return badRequest(res, "Budget amount cannot be negative.");
    if (!Number.isInteger(Number(body.month)) || Number(body.month) < 1 || Number(body.month) > 12) return badRequest(res, "Budget month must be between 1 and 12.");
    if (!Number.isInteger(Number(body.year)) || Number(body.year) < 2000) return badRequest(res, "Budget year must be 2000 or later.");

    const existing = db.budgets.find(item =>
      item.categoryId === Number(body.categoryId) &&
      item.month === Number(body.month) &&
      item.year === Number(body.year)
    );

    if (existing) {
      existing.amount = Number(body.amount);
      writeDb(db);
      return sendJson(res, existing);
    }

    const budget = {
      id: db.nextIds.budgets++,
      categoryId: Number(body.categoryId),
      amount: Number(body.amount),
      month: Number(body.month),
      year: Number(body.year)
    };
    db.budgets.push(budget);
    writeDb(db);
    return sendJson(res, budget, 201);
  }

  return sendText(res, "Not found", 404);
}

async function handlePut(req, res, url) {
  const db = readDb();
  const body = await readBody(req);
  const id = Number(url.pathname.split("/").pop());

  if (url.pathname.startsWith("/api/categories/")) {
    const category = db.categories.find(item => item.id === id);
    if (!category) return sendText(res, "Not found", 404);
    const name = String(body.name || "").trim();
    if (!name) return badRequest(res, "Category name is required.");
    if (!isValidType(body.type)) return badRequest(res, "Category type must be income or expense.");
    category.name = name;
    category.type = body.type;
    writeDb(db);
    return sendJson(res, category);
  }

  if (url.pathname.startsWith("/api/transactions/")) {
    const transaction = db.transactions.find(item => item.id === id);
    if (!transaction) return sendText(res, "Not found", 404);
    if (!isValidType(body.type)) return badRequest(res, "Transaction type must be income or expense.");
    if (!findCategory(db, body.categoryId, body.type)) return badRequest(res, "Choose a valid category for this transaction type.");
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return badRequest(res, "Transaction amount must be greater than zero.");
    if (!isValidDate(body.date)) return badRequest(res, "Transaction date is required.");
    transaction.categoryId = Number(body.categoryId);
    transaction.amount = Number(body.amount);
    transaction.type = body.type;
    transaction.description = String(body.description || "").trim();
    transaction.date = body.date;
    writeDb(db);
    return sendJson(res, withCategoryName(db, transaction));
  }

  if (url.pathname.startsWith("/api/budgets/")) {
    const budget = db.budgets.find(item => item.id === id);
    if (!budget) return sendText(res, "Not found", 404);
    if (!findCategory(db, body.categoryId, "expense")) return badRequest(res, "Choose a valid expense category.");
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0) return badRequest(res, "Budget amount cannot be negative.");
    if (!Number.isInteger(Number(body.month)) || Number(body.month) < 1 || Number(body.month) > 12) return badRequest(res, "Budget month must be between 1 and 12.");
    if (!Number.isInteger(Number(body.year)) || Number(body.year) < 2000) return badRequest(res, "Budget year must be 2000 or later.");
    budget.categoryId = Number(body.categoryId);
    budget.amount = Number(body.amount);
    budget.month = Number(body.month);
    budget.year = Number(body.year);
    writeDb(db);
    return sendJson(res, budget);
  }

  return sendText(res, "Not found", 404);
}

function handleDelete(res, url) {
  const db = readDb();
  const id = Number(url.pathname.split("/").pop());
  const routeMap = {
    "/api/categories/": "categories",
    "/api/transactions/": "transactions",
    "/api/budgets/": "budgets"
  };
  const prefix = Object.keys(routeMap).find(key => url.pathname.startsWith(key));

  if (!prefix) return sendText(res, "Not found", 404);

  const table = routeMap[prefix];
  db[table] = db[table].filter(item => item.id !== id);
  writeDb(db);
  return sendJson(res, { deleted: true, id });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") return sendText(res, "", 204);
    if (req.method === "GET") return handleGet(req, res, url);
    if (req.method === "POST") return handlePost(req, res, url);
    if (req.method === "PUT") return handlePut(req, res, url);
    if (req.method === "DELETE") return handleDelete(res, url);

    return sendText(res, "Method not allowed", 405);
  } catch (error) {
    return sendJson(res, { error: error.message }, 500);
  }
});

function startServer(port) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Expense Tracker running at http://127.0.0.1:${port}`);
  });
}

server.on("error", error => {
  if (error.code === "EADDRINUSE" && !process.env.PORT) {
    const fallbackPort = PORT + 1;
    console.log(`Port ${PORT} is busy. Trying http://127.0.0.1:${fallbackPort}`);
    return startServer(fallbackPort);
  }

  throw error;
});

ensureDb();
startServer(PORT);
