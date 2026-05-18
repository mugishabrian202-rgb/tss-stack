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
        path.join(root, "src", "api", "axios.js"),
        `import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000",
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

  const fetchAll = async () => {
    const res = await API.get("/${route}");
    setItems(res.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

`;

        if (ops.includes("insert")) {
            page += `  const handleSubmit = async (e) => {
    e.preventDefault();
${ops.includes("update") ? `    if (editId) {
      await API.put(\`/${route}/\${editId}\`, form);
      setEditId(null);
    } else {
      await API.post("/${route}", form);
    }` : `    await API.post("/${route}", form);`}
    setForm({ ${formReset} });
    fetchAll();
  };

`;
        }

        if (ops.includes("delete")) {
            page += `  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    await API.delete(\`/${route}/\${id}\`);
    fetchAll();
  };

`;
        }

        if (ops.includes("update")) {
            page += `  const handleEdit = (item) => {
    setEditId(item.id);
    setForm({ ${editSet} });
  };

`;
        }

        page += `  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">${name}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6 max-w-md">
${inputs}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          ${ops.includes("update") ? 'editId ? "Update" : "Add"' : '"Add"'}
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
${tableHeaders}
${ops.includes("update") || ops.includes("delete") ? '          <th className="border px-4 py-2">Actions</th>' : ""}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
${tableRow}
${ops.includes("update") || ops.includes("delete") ? `          <td className="border px-4 py-2 space-x-2">
${ops.includes("update") ? '            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">Edit</button>' : ""}
${ops.includes("delete") ? '            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">Delete</button>' : ""}
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
            `import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await API.post("/auth/login", form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input
          className="border p-2 rounded"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          className="border p-2 rounded"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error ? <p className="text-red-600">{error}</p> : null}
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Login</button>
      </form>
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
      <p>Build your reports dashboard here.</p>
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
        .map((t) => `          <Route path="/${toRoute(t.name)}" element={<${toPascal(t.name)} />} />`)
        .join("\n");

    const navLinks = tables
        .map((t) => `          <Link to="/${toRoute(t.name)}" className="hover:underline">${toPascal(t.name)}</Link>`)
        .join("\n");

    const app = `import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
${imports}
${needsAuth ? 'import Login from "./pages/Login";' : ""}
${needsReports ? 'import Reports from "./pages/Reports";' : ""}
import API from "./api/axios";

function Navbar() {
  const navigate = useNavigate();

  const logout = async () => {
    await API.post("/auth/logout");
    navigate("/login");
  };

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex gap-6 items-center">
      <span className="font-bold text-lg">${projectName}</span>
${navLinks}
${needsReports ? '      <Link to="/reports" className="hover:underline">Reports</Link>' : ""}
${needsAuth ? '      <button onClick={logout} className="ml-auto hover:underline">Logout</button>' : ""}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
${needsAuth ? '        <Route path="/login" element={<Login />} />' : ""}
${routes}
${needsReports ? '        <Route path="/reports" element={<Reports />} />' : ""}
      </Routes>
    </BrowserRouter>
  );
}
`;

    fs.outputFileSync(path.join(root, "src", "App.jsx"), app);
    console.log("  [✓] App.jsx");
}

module.exports = { generateFrontend };