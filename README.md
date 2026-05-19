# tss-stack

> Interactive full-stack project generator for Node.js + React + MySQL — built for TSS students and developers who are tired of rewriting the same boilerplate.

![npm version](https://img.shields.io/npm/v/tss-stack)
![license](https://img.shields.io/npm/l/tss-stack)
![node](https://img.shields.io/node/v/tss-stack)

---

## What It Does

Run one command, answer a few questions, and get a fully wired full-stack project — no manual setup, no copy-pasting, no forgetting to install cors.

```bash
npx tss-stack my-app
```

It asks you:
- Your project name and database name
- How many tables you need and what fields they have
- Which CRUD operations each table needs
- Whether to include login/register and a Reports page

Then it generates everything, installs all dependencies, and prints your next steps.

---

## Demo

```
🚀 TSS Stack Generator

[1] Project display name: SmartPark
[2] MySQL database name: smartpark_db
[3] Backend port number: 5000
[4] How many tables? 3
    Table 1 name: spare_parts
    Fields: name, category, quantity, unit_price
    Operations: INSERT, SELECT
    Table 2 name: stock_in
    Fields: spare_part_id, quantity, date
    Operations: INSERT, SELECT
    Table 3 name: stock_out
    Fields: spare_part_id, quantity, unit_price, total_price, date
    Operations: INSERT, SELECT, UPDATE, DELETE
[5] Add login/register system? Yes
[6] Add a Reports page? Yes

⚙️  Generating SmartPark...

SmartPark/
├── backend-project/
│   ├── config/
│   │   ├── db.js
│   │   └── database.sql
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── spare_parts.js
│   │   ├── stock_in.js
│   │   └── stock_out.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend-project/
    ├── src/
    │   ├── api/
    │   │   └── axios.js
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── SpareParts.jsx
    │   │   ├── StockIn.jsx
    │   │   ├── StockOut.jsx
    │   │   └── Reports.jsx
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json

⠸ Installing backend dependencies...
✔ Backend dependencies installed
✔ Frontend dependencies installed

✅ Done! SmartPark is ready.
```

---

## Generated Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js |
| Database | MySQL (mysql2) |
| Auth | express-session + bcryptjs |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| HTTP client | Axios (pre-configured) |
| Routing | React Router v6 |

---

## What Gets Generated

### Backend (`backend-project/`)

- **`server.js`** — Express server with CORS, sessions, and all routes wired
- **`config/db.js`** — MySQL connection using your `.env` credentials
- **`config/database.sql`** — Ready-to-import SQL with `CREATE DATABASE`, `CREATE TABLE`, primary keys and foreign keys
- **`routes/*.js`** — One route file per table, with only the operations you selected (INSERT / SELECT / UPDATE / DELETE)
- **`middleware/auth.js`** — Session protection middleware, attach to any route
- **`routes/auth.js`** — Register, login, logout endpoints (if auth selected)
- **`.env.example`** — Template for your database credentials

## Frontend (`frontend-project/`)

- **`vite.config.js`** — Vite configuration with React plugin
- **`tailwind.config.js`** — Tailwind CSS configuration
- **`postcss.config.js`** — PostCSS plugins (Tailwind + Autoprefixer)
- **`index.html`** — Entry HTML file (required by Vite)
- **`.env.local.example`** — Environment template for API URL
- **`.gitignore`** — Git ignore rules for frontend
- **`src/api/axios.js`** — Pre-configured Axios instance with environment-based URL
- **`src/pages/*.jsx`** — One page per table with:
  - Error handling and error messages
  - Loading states on form submission
  - Success notifications
  - Automatic data fetching on page load
  - Complete CRUD operations (only those selected)
- **`src/pages/Home.jsx`** — Landing page
- **`src/pages/Login.jsx`** — Login/Register page with toggle (if auth selected)
- **`src/pages/Reports.jsx`** — Reports page scaffold (if selected)
- **`src/components/PrivateRoute.jsx`** — Route protection component (if auth selected)
- **`src/context/AuthContext.jsx`** — Auth provider with session checking (if auth selected)
- **`src/App.jsx`** — React Router setup with:
  - Protected routes (if auth selected)
  - Navbar with conditional logout button
  - Auth context provider wrapping app
- **`src/main.jsx`** — React entry point
- **`src/index.css`** — Tailwind CSS imports

---

## Getting Started After Generation

### 1. Import the database

```bash
mysql -u root -p < my-app/backend-project/config/database.sql
```

### 2. Configure backend environment

```bash
cd my-app/backend-project
cp .env.example .env
```

Open `.env` and fill in your MySQL credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smartpark_db
PORT=5000
SESSION_SECRET=your_random_secret_string_here
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Configure frontend environment (optional)

```bash
cd ../frontend-project
cp .env.local.example .env.local
```

By default, the frontend connects to `http://localhost:5000`. Override in `.env.local` if needed:

```env
VITE_API_URL=http://your-api-url:5000
```

### 4. Start the backend

```bash
cd my-app/backend-project
npm install
npm run dev
```

Server runs on `http://localhost:5000`

### 5. Start the frontend

```bash
cd ../frontend-project
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 6. Open in browser

Visit `http://localhost:5173`

If auth is enabled, register or login first. Then access your data tables.

---

## Features

✅ **Authentication** (optional)
- Login/Register with bcrypt hashing
- Session management
- Route protection
- Auto session check on load
- Logout functionality

✅ **Full CRUD Interface**
- Form validation
- Error handling with messages
- Success notifications
- Loading states
- Auto data refresh

✅ **Frontend Stack**
- React 18 + Vite
- React Router v6
- Tailwind CSS
- Axios with credentials

✅ **Backend Stack**
- Express.js
- MySQL connection pooling
- CORS & security headers
- Rate limiting
- Session management

✅ **Database**
- Auto table creation
- Timestamps (created_at, updated_at)
- Proper SQL types
- Auto-increment IDs

---

## Stack Summary

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Backend | Express.js |
| Database | MySQL (mysql2) |
| Auth | express-session + bcryptjs |
| Frontend | React 18 + Vite |
| CSS | Tailwind CSS |
| HTTP | Axios |
| Routing | React Router v6 |

- Node.js 16 or higher
- npm 7 or higher
- MySQL installed and running

---

## Project Structure (Source)

```
tss-stack/
├── bin/
│   └── cli.js              ← CLI entry point and interview logic
├── src/
│   └── generators/
│       ├── backend.js      ← generates all backend files
│       ├── frontend.js     ← generates all frontend files
│       ├── database.js     ← generates the .sql file
│       └── utils.js        ← shared helpers (toPascal, toRoute, toCamel)
└── package.json
```

---

## Local Development

Clone the repo and link it globally to test before publishing:

```bash
git clone https://github.com/your-username/tss-stack.git
cd tss-stack
npm install
npm link
```

Now test it like a real user:

```bash
tss-stack test-project
```

When done testing:

```bash
npm unlink -g tss-stack
```

---

## Publishing a New Version

```bash
npm version patch   # bug fix:    1.0.0 → 1.0.1
npm version minor   # new feature: 1.0.0 → 1.1.0
npm version major   # breaking:   1.0.0 → 2.0.0

npm publish
```

---

## Roadmap

- [ ] MongoDB support
- [ ] JWT auth option alongside session auth
- [ ] Role-based access (admin / user)
- [ ] Dark mode Tailwind theme
- [ ] `--yes` flag to skip prompts with defaults

---

## Author

**Mugisha Brian**
- GitHub: [Kevin](https://github.com/mugishabrian202-rgb/tss-stack.git)
- npm: [tss-stack](https://npmjs.com/package/tss-stack)

---

## License

ISC © Mugisha Brian