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

### Frontend (`frontend-project/`)

- **`src/api/axios.js`** — Pre-configured Axios instance pointed at your backend, `withCredentials` enabled
- **`src/pages/*.jsx`** — One page per table with form, table display, and only the action buttons matching your selected operations
- **`src/pages/Login.jsx`** — Login form wired to `/auth/login` (if auth selected)
- **`src/pages/Reports.jsx`** — Reports page scaffold (if selected)
- **`src/App.jsx`** — React Router setup with Navbar and all routes configured

---

## Getting Started After Generation

### 1. Import the database

```bash
mysql -u root -p < my-app/backend-project/config/database.sql
```

### 2. Configure environment

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
SESSION_SECRET=any_random_string_here
```

### 3. Start the backend

```bash
npm run dev
```

### 4. Start the frontend

```bash
cd ../frontend-project
npm run dev
```

### 5. Open the app

```
http://localhost:5173
```

---

## Requirements

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