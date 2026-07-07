# Expense Tracker Web Application

A complete full-stack CRUD project for recording income, expenses, categories, and monthly budgets with a dashboard and visual analytics.

## Objective

Build an expense tracking application that helps users record income and expenses, organize transactions by category, set monthly budgets, and understand spending patterns through summaries and charts.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js HTTP server
- Database: JSON file storage (`db.json`)
- Dependencies: none

## Features

- Create, read, update, and delete transactions
- Create, read, update, and delete categories
- Create, read, update, and delete budgets
- Dashboard cards for income, expense, and balance
- Expense by category chart
- Monthly trend chart
- Transaction filters
- CSV export
- Server-side validation for clean data

## Database Design

`db.json` stores:

- `categories`: category id, name, and type (`income` or `expense`)
- `transactions`: transaction id, category id, amount, type, description, date, and created date
- `budgets`: budget id, category id, amount, month, and year
- `nextIds`: auto-increment counters for each collection

## Run the Project

```bash
cd expense_tracker_node_app
node server.js
```

Open:

```text
http://127.0.0.1:3000
```

If port `3000` is busy:

```bash
$env:PORT=3001
node server.js
```

## API Routes

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/budgets`
- `POST /api/budgets`
- `PUT /api/budgets/:id`
- `DELETE /api/budgets/:id`
- `GET /api/summary`
- `GET /api/export`

## Project Folder

```text
expense_tracker_node_app/
  server.js
  db.json
  public/
    index.html
    style.css
    app.js
```
