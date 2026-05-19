const fs = require("fs-extra");
const path = require("path");

const { toPascal, toRoute } = require("./utils");

async function generateBackend(config) {
    const { dbName, port, tables, needsAuth, targetDir } = config;
    const root = path.join(targetDir, "backend-project");

    const dependencies = {
        express: "^4.18.2",
        mysql2: "^3.6.0",
        cors: "^2.8.5",
        dotenv: "^16.3.1",
        helmet: "^7.1.0",
        "express-session": "^1.17.3",
        bcryptjs: "^2.4.3",
        "express-rate-limit": "^7.1.5",
    };

    await fs.outputFile(
        path.join(root, "package.json"),
        JSON.stringify(
            {
                name: "backend-project",
                version: "1.0.0",
                scripts: {
                    dev: "nodemon server.js",
                    start: "node server.js",
                },
                dependencies: needsAuth
                    ? dependencies
                    : {
                        express: dependencies.express,
                        mysql2: dependencies.mysql2,
                        cors: dependencies.cors,
                        dotenv: dependencies.dotenv,
                        helmet: dependencies.helmet,
                    },
                devDependencies: {
                    nodemon: "^3.0.1",
                },
            },
            null,
            2
        )
    );

    await fs.outputFile(
        path.join(root, ".env.example"),
        `DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=${dbName}
PORT=${port}
SESSION_SECRET=change_me_to_random_string
CLIENT_URL=http://localhost:5173
NODE_ENV=development
`
    );

    await fs.outputFile(
        path.join(root, ".gitignore"),
        `node_modules/
.env
.env.local
*.log
npm-debug.log*
.DS_Store
.idea/
.vscode/
`
    );

    await fs.outputFile(
        path.join(root, "config", "db.js"),
        `const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("[ERROR] MySQL connection failed:", err.message);
    process.exit(1);
  }

  console.log("[✓] MySQL connected");
  connection.release();
});

module.exports = pool.promise();
`
    );

    if (needsAuth) {
        await fs.outputFile(
            path.join(root, "middleware", "auth.js"),
            `module.exports = (req, res, next) => {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
};
`
        );

        await fs.outputFile(
            path.join(root, "routes", "auth.js"),
            `const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const db = require("../config/db");
const isAuthenticated = require("../middleware/auth");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      await db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash]);
      res.json({ message: "User registered successfully" });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "Username already exists" });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const [results] = await db.query("SELECT id, username FROM users WHERE username = ? LIMIT 1", [username]);

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = results[0];
    const [userWithPassword] = await db.query("SELECT password FROM users WHERE id = ?", [user.id]);
    const passwordMatch = await bcrypt.compare(password, userWithPassword[0].password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
    };

    res.json({
      message: "Login successful",
      user: req.session.user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", isAuthenticated, (req, res) => {
  res.json(req.session.user);
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out" });
  });
});

module.exports = router;
`
        );
    }

    for (const table of tables) {
        const routeName = toRoute(table.name);
        const insertFields = table.fields.join(", ");
        const placeholders = table.fields.map(() => "?").join(", ");
        const values = table.fields.map((field) => `req.body.${field}`).join(", ");
        const updateSet = table.fields.map((field) => `${field} = ?`).join(", ");
        const updateValues = [...table.fields.map((field) => `req.body.${field}`), "req.params.id"].join(", ");

        let route = `const express = require("express");
const router = express.Router();
const db = require("../config/db");
${needsAuth ? 'const isAuthenticated = require("../middleware/auth");' : ""}

`;

        if (table.operations.includes("insert")) {
            route += `router.post(
  "/",
  ${needsAuth ? "isAuthenticated," : ""}
  async (req, res) => {
    try {
      const sql = "INSERT INTO ${table.name} (${insertFields}) VALUES (${placeholders})";
      await db.query(sql, [${values}]);
      res.json({ message: "${toPascal(table.name)} created" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

`;
        }

        if (table.operations.includes("select")) {
            route += `router.get(
  "/",
  ${needsAuth ? "isAuthenticated," : ""}
  async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM ${table.name}");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

`;
        }

        if (table.operations.includes("update")) {
            route += `router.put(
  "/:id",
  ${needsAuth ? "isAuthenticated," : ""}
  async (req, res) => {
    try {
      const sql = "UPDATE ${table.name} SET ${updateSet} WHERE id = ?";
      await db.query(sql, [${updateValues}]);
      res.json({ message: "${toPascal(table.name)} updated" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

`;
        }

        if (table.operations.includes("delete")) {
            route += `router.delete(
  "/:id",
  ${needsAuth ? "isAuthenticated," : ""}
  async (req, res) => {
    try {
      await db.query("DELETE FROM ${table.name} WHERE id = ?", [req.params.id]);
      res.json({ message: "${toPascal(table.name)} deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

`;
        }

        route += `module.exports = router;
`;

        await fs.outputFile(path.join(root, "routes", `${routeName}.js`), route);
    }

    const routeImports = tables
        .map((t) => `const ${toPascal(t.name)}Route = require("./routes/${toRoute(t.name)}");`)
        .join("\n");

    const routeMounts = tables
        .map((t) => `app.use("/${toRoute(t.name)}", ${toPascal(t.name)}Route);`)
        .join("\n");

    const authImport = needsAuth ? 'const authRoutes = require("./routes/auth");' : "";
    const authMount = needsAuth ? 'app.use("/auth", authRoutes);' : "";
    const authMiddleware = needsAuth
        ? `const session = require("express-session");

app.use(session({
  secret: process.env.SESSION_SECRET || "change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  },
}));
`
        : "";

    const server = `const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const db = require("./config/db");
${authImport}
${routeImports}

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
${authMiddleware}
app.get("/health", (req, res) => res.json({ ok: true }));
${authMount}
${routeMounts}

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(\`[✓] Server running on port \${port}\`);
});
`;

    await fs.outputFile(path.join(root, "server.js"), server);
    console.log("  [✓] backend files");
}

module.exports = {
    generateBackend,
};