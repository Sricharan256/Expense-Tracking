# Expense Tracker

A full-stack personal Expense Tracker application for managing income, expenses, categories, and monthly budgets.

## Features

- Add, edit, and delete income and expense transactions
- Create, edit, and delete categories
- Create, edit, and delete monthly budgets
- Dashboard with total income, expenses, balance, and savings rate
- Search transactions by category, description, or type
- Filter by type, month, year, and date range
- Expense-by-category bar chart
- Expense distribution pie chart
- Monthly expense trend
- Budget progress bars
- Immediate budget-exceeded popup
- Dark mode
- Recurring monthly expense support
- CSV export
- Print / Save-as-PDF report
- Responsive desktop/tablet/mobile UI
- Clean amount inputs without number spinner arrows

## Tech Stack

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- REST API
- JSON data storage in the current version
- LocalStorage for UI preferences and recurring templates

## Project Structure

```text
expense-tracker/
├── index.html
├── style.css
├── app.js
├── server.js
├── db.json
├── package.json
├── package-lock.json
└── README.md
```

## Run Locally

```bash
npm install
node server.js
```

Then open:

```text
http://127.0.0.1:3000
```

Use the port printed by your server if it is different.

## API Endpoints

```text
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id

GET    /api/budgets
POST   /api/budgets
PUT    /api/budgets/:id
DELETE /api/budgets/:id

GET    /api/summary
GET    /api/export
```

## Budget Alert

The application checks the selected category, month, and year before saving an expense.

Example:

```text
Budget:           Rs 5,000
Existing Expense: Rs 4,000
New Expense:      Rs 1,500
Total:            Rs 5,500
Exceeded:         Rs 500
```

An immediate popup is shown when the budget is exceeded.

## Important Note

The updated frontend uses the existing REST endpoints listed above. MongoDB/JWT authentication from the separate MERN backend setup is not wired into these frontend files yet.

## Future Improvements

- User registration and login
- JWT authentication
- MongoDB persistence
- Per-user expense isolation
- Deployment
- Email budget notifications
- Automated tests

## Author

Sricharan Medaboina
