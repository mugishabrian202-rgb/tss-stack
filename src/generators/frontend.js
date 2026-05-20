const fs = require("fs-extra");
const path = require("path");
const { toPascal, toRoute } = require("./utils");

function generateFrontend(config) {
  const { projectName, tables, needsAuth, needsReports, targetDir } = config;
  const root = path.join(targetDir, "frontend-project");

  fs.outputFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "frontend-project",
        version: "1.0.0",
        scripts: { dev: "vite", build: "vite build" },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.18.0",
          axios: "^1.6.0",
        },
        devDependencies: {
          vite: "^5.0.0",
          "@vitejs/plugin-react": "^4.2.0",
          tailwindcss: "^3.3.0",
          autoprefixer: "^10.4.16",
          postcss: "^8.4.31",
        },
      },
      null,
      2
    )
  );

  fs.outputFileSync(
    path.join(root, "vite.config.js"),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
`
  );

  fs.outputFileSync(
    path.join(root, "tailwind.config.js"),
    `export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`
  );

  fs.outputFileSync(
    path.join(root, "postcss.config.js"),
    `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`
  );

  fs.outputFileSync(
    path.join(root, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"><\/script>
  </body>
</html>
`
  );

  fs.outputFileSync(
    path.join(root, ".env.local.example"),
    `VITE_API_URL=http://localhost:5000
`
  );

  fs.outputFileSync(
    path.join(root, ".gitignore"),
    `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.idea/
.vscode/
`
  );

  fs.outputFileSync(
    path.join(root, "src", "api", "axios.js"),
    `import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});

export default API;
`
  );

  fs.outputFileSync(
    path.join(root, "src", "main.jsx"),
    `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
  );

  fs.outputFileSync(
    path.join(root, "src", "index.css"),
    `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, sans-serif;
}
`
  );

  if (needsAuth) {
    fs.outputFileSync(
      path.join(root, "src", "context", "AuthContext.jsx"),
      `import React, { createContext, useState, useEffect } from "react";
import API from "../api/axios";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await API.get("/auth/me");
        setUser(res.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
`
    );

    fs.outputFileSync(
      path.join(root, "src", "components", "PrivateRoute.jsx"),
      `import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="p-6">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}
`
    );
  }

  fs.outputFileSync(
    path.join(root, "src", "pages", "Home.jsx"),
    `export default function Home() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-4">Welcome</h1>
      <p className="text-gray-600">Select an option from the navigation above to get started.</p>
    </div>
  );
}
`
  );

  for (const table of tables) {
    const name = toPascal(table.name);
    const route = toRoute(table.name);
    const fields = table.fields;
    const ops = table.operations;

    const stateFields = fields.map((f) => `    ${f}: ""`).join(",\n");
    const formReset = fields.map((f) => `${f}: ""`).join(", ");
    const editSet = fields.map((f) => `${f}: item.${f}`).join(", ");
    const inputs = fields
      .map(
        (f) => `        <input
          type="text"
          placeholder="${f}"
          value={form.${f}}
          onChange={(e) => setForm({ ...form, ${f}: e.target.value })}
          className="border p-2 rounded w-full"
          required
        />`
      )
      .join("\n");

    const tableHeaders = ["id", ...fields, "created_at"]
      .map((f) => `          <th className="border px-4 py-2">${f}</th>`)
      .join("\n");

    const tableRow = ["id", ...fields, "created_at"]
      .map((f) => `          <td className="border px-4 py-2">{item.${f}}</td>`)
      .join("\n");

    let page = `import { useState, useEffect } from "react";
import API from "../api/axios";

export default function ${name}() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
${stateFields}
  });
${ops.includes("update") ? "  const [editId, setEditId] = useState(null);" : ""}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAll = async () => {
    try {
      setError("");
      const res = await API.get("/${route}");
      setItems(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load data");
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

`;

    if (ops.includes("insert")) {
      page += `  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
${ops.includes("update") ? `      if (editId) {
        await API.put(\`/${route}/\${editId}\`, form);
        setSuccess("Updated successfully");
        setEditId(null);
      } else {
        await API.post("/${route}", form);
        setSuccess("Created successfully");
      }` : `      await API.post("/${route}", form);
      setSuccess("Created successfully");`}
      setForm({ ${formReset} });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

`;
    }

    if (ops.includes("delete")) {
      page += `  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    setLoading(true);
    setError("");
    try {
      await API.delete(\`/${route}/\${id}\`);
      setSuccess("Deleted successfully");
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

`;
    }

    if (ops.includes("update")) {
      page += `  const handleEdit = (item) => {
    setEditId(item.id);
    setForm({ ${editSet} });
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ ${formReset} });
  };

`;
    }

    page += `  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">${name}</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4">{success}</div>}

${ops.includes("insert") ? `      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6 max-w-md">
${inputs}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Processing..." : (${ops.includes("update") ? 'editId ? "Update" : "Add"' : '"Add"'})}
          </button>
${ops.includes("update") ? '          {editId && <button type="button" onClick={handleCancel} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>}' : ""}
        </div>
      </form>` : ""}

      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
${tableHeaders}
${(ops.includes("update") || ops.includes("delete")) ? '          <th className="border px-4 py-2">Actions</th>' : ""}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
${tableRow}
${(ops.includes("update") || ops.includes("delete")) ? `          <td className="border px-4 py-2 space-x-2">
${ops.includes("update") ? '            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">Edit</button>' : ""}
${ops.includes("delete") ? '            <button onClick={() => handleDelete(item.id)} disabled={loading} className="text-red-600 hover:underline disabled:opacity-50">Delete</button>' : ""}
          </td>` : ""}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;

    fs.outputFileSync(path.join(root, "src", "pages", `${name}.jsx`), page);
    console.log(`  [✓] pages/${name}.jsx`);
  }

  if (needsAuth) {
    fs.outputFileSync(
      path.join(root, "src", "pages", "Login.jsx"),
      `import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import API from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegistering ? "/auth/register" : "/auth/login";
      const res = await API.post(endpoint, form);
      setUser(res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || (isRegistering ? "Registration failed" : "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">{isRegistering ? "Register" : "Login"}</h1>
        {error && <p className="text-red-600 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="border p-2 rounded"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            className="border p-2 rounded"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Processing..." : isRegistering ? "Register" : "Login"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsRegistering(!isRegistering)}
          className="text-blue-600 hover:underline mt-3 w-full text-sm"
        >
          {isRegistering ? "Have an account? Login" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}
`
    );
  }

  if (needsReports) {
    fs.outputFileSync(
      path.join(root, "src", "pages", "Reports.jsx"),
      `export default function Reports() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <p className="text-gray-600">Build your reports dashboard here. Add charts, analytics, and visualizations.</p>
    </div>
  );
}
`
    );
  }

  const imports = tables
    .map((t) => `import ${toPascal(t.name)} from "./pages/${toPascal(t.name)}";`)
    .join("\n");

  const routes = tables
    .map((t) => {
      const route = `<Route path="/${toRoute(t.name)}" element={<${toPascal(t.name)} />} />`;
      return needsAuth
        ? `          <Route path="/${toRoute(t.name)}" element={<PrivateRoute><${toPascal(t.name)} /></PrivateRoute>} />`
        : `          ${route}`;
    })
    .join("\n");

  const navLinks = tables
    .map((t) => `          <Link to="/${toRoute(t.name)}" className="hover:underline">${toPascal(t.name)}</Link>`)
    .join("\n");

  let app = `import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
${imports}
${needsAuth ? 'import Login from "./pages/Login";\nimport PrivateRoute from "./components/PrivateRoute";\nimport { AuthContext, AuthProvider } from "./context/AuthContext";\nimport { useContext } from "react";' : ""}
${needsReports ? 'import Reports from "./pages/Reports";' : ""}
import Home from "./pages/Home";
import API from "./api/axios";

function Navbar() {
  const navigate = useNavigate();
${needsAuth ? '  const { user } = useContext(AuthContext);' : ""}

  const logout = async () => {
    try {
      await API.post("/auth/logout");
      navigate("/login");
      window.location.reload();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex gap-6 items-center">
      <span className="font-bold text-lg"><Link to="/" className="hover:opacity-80">${projectName}</Link></span>
${navLinks}
${needsReports ? '      <Link to="/reports" className="hover:underline">Reports</Link>' : ""}
${needsAuth ? '      {user && <button onClick={logout} className="ml-auto hover:underline">Logout ({user.username})</button>}' : ""}
    </nav>
  );
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
${needsAuth ? '        <Route path="/login" element={<Login />} />' : ""}
        <Route path="/" element={<Home />} />
${routes}
${needsReports ? (needsAuth ? '        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />' : '        <Route path="/reports" element={<Reports />} />') : ""}
      </Routes>
    </>
  );
}

export default function App() {
  return (
${needsAuth ? '    <AuthProvider>\n      <BrowserRouter>\n        <AppRoutes />\n      </BrowserRouter>\n    </AuthProvider>' : '    <BrowserRouter>\n      <AppRoutes />\n    </BrowserRouter>'}
  );
}
`;

  fs.outputFileSync(path.join(root, "src", "App.jsx"), app);
  console.log("  [✓] App.jsx");
}

module.exports = { generateFrontend };