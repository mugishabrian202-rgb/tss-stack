const fs = require("fs-extra");
const path = require("path");
const { toPascal, toRoute, inferReportConfig } = require("./utils");

async function generateFrontend(config) {
    const { projectName, tables, needsAuth, needsReports, targetDir } = config;
    const root = path.join(targetDir, "frontend-project");

    // Tables that opted into reports
    const reportTables = needsReports ? tables.filter((t) => t.reports) : [];

    // ── package.json ───────────────────────────────────────────────────────
    await fs.outputFile(
        path.join(root, "package.json"),
        JSON.stringify(
            {
                name: "frontend-project",
                version: "1.0.0",
                type: "module",
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

    // ── Config files ───────────────────────────────────────────────────────
    await fs.outputFile(
        path.join(root, "vite.config.js"),
        `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
});
`
    );

    await fs.outputFile(
        path.join(root, "tailwind.config.js"),
        `export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
`
    );

    await fs.outputFile(
        path.join(root, "postcss.config.js"),
        `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`
    );

    await fs.outputFile(
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

    await fs.outputFile(path.join(root, ".env.local.example"), `VITE_API_URL=http://localhost:5000\n`);

    await fs.outputFile(
        path.join(root, ".gitignore"),
        `node_modules/\ndist/\n.env\n.env.local\n*.log\n.DS_Store\n`
    );

    // ── src/api/axios.js ───────────────────────────────────────────────────
    await fs.outputFile(
        path.join(root, "src", "api", "axios.js"),
        `import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});

export default API;
`
    );

    // ── src/main.jsx ───────────────────────────────────────────────────────
    await fs.outputFile(
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

    // ── src/index.css ──────────────────────────────────────────────────────
    await fs.outputFile(
        path.join(root, "src", "index.css"),
        `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n}\n`
    );

    // ── Auth context + PrivateRoute ────────────────────────────────────────
    if (needsAuth) {
        await fs.outputFile(
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

        await fs.outputFile(
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

    // ── Home page ──────────────────────────────────────────────────────────
    await fs.outputFile(
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

    // ── One CRUD page per table ────────────────────────────────────────────
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

  useEffect(() => { fetchAll(); }, []);

`;

        if (ops.includes("insert")) {
            page += `  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
${
    ops.includes("update")
        ? `      if (editId) {
        await API.put(\`/${route}/\${editId}\`, form);
        setSuccess("Updated successfully");
        setEditId(null);
      } else {
        await API.post("/${route}", form);
        setSuccess("Created successfully");
      }`
        : `      await API.post("/${route}", form);
      setSuccess("Created successfully");`
}
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

${
    ops.includes("insert")
        ? `      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6 max-w-md">
${inputs}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Processing..." : (${ops.includes("update") ? 'editId ? "Update" : "Add"' : '"Add"'})}
          </button>
${ops.includes("update") ? '          {editId && <button type="button" onClick={handleCancel} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>}' : ""}
        </div>
      </form>`
        : ""
}

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
${
    ops.includes("update") || ops.includes("delete")
        ? `              <td className="border px-4 py-2 space-x-2">
${ops.includes("update") ? '                <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">Edit</button>' : ""}
${ops.includes("delete") ? '                <button onClick={() => handleDelete(item.id)} disabled={loading} className="text-red-600 hover:underline disabled:opacity-50">Delete</button>' : ""}
              </td>`
        : ""
}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;

        await fs.outputFile(path.join(root, "src", "pages", `${name}.jsx`), page);
        console.log(`  [✓] pages/${name}.jsx`);
    }

    // ── Login page ─────────────────────────────────────────────────────────
    if (needsAuth) {
        await fs.outputFile(
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
          <input className="border p-2 rounded" placeholder="Username" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <input className="border p-2 rounded" type="password" placeholder="Password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Processing..." : isRegistering ? "Register" : "Login"}
          </button>
        </form>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)}
          className="text-blue-600 hover:underline mt-3 w-full text-sm">
          {isRegistering ? "Have an account? Login" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}
`
        );
    }

    // ── REPORTS SYSTEM ─────────────────────────────────────────────────────
    // Only generated when needsReports is true AND at least one table opted in.
    // Architecture:
    //   src/reports/index.js           — exports all report configs as an array
    //   src/reports/<table>.report.js  — one config per table (STEP 3)
    //   src/shared/MetricCards.jsx     — reusable KPI card grid (STEP 7)
    //   src/shared/ReportTable.jsx     — reusable data table
    //   src/pages/Reports.jsx          — single page, loops over configs (STEP 4)

    if (needsReports && reportTables.length > 0) {

        // STEP 3 — One report config file per opted-in table
        for (const table of reportTables) {
            const rc = inferReportConfig(table);
            await fs.outputFile(
                path.join(root, "src", "reports", `${table.name}.report.js`),
                `// Report configuration for ${toPascal(table.name)}.
// Edit metrics/dimensions/dateFields to change what the Reports page displays.
// The backend endpoint GET /reports/${table.name} returns data shaped to match this config.

const ${toPascal(table.name)}Report = {
  title: "${toPascal(table.name)} Report",
  table: "${table.name}",
  endpoint: "/reports/${table.name}",

  // Numeric fields — displayed as SUM and AVG cards
  metrics: ${JSON.stringify(rc.metrics)},

  // Categorical fields — used for grouping rows in the table
  dimensions: ${JSON.stringify(rc.dimensions)},

  // Date fields — available for future trend/filter features
  dateFields: ${JSON.stringify(rc.dateFields)},
};

module.exports = ${toPascal(table.name)}Report;
`
            );
        }

        // STEP 5 — reports/index.js
        const reportRequires = reportTables
            .map((t) => `const ${toPascal(t.name)}Report = require("./${t.name}.report");`)
            .join("\n");

        const reportArray = reportTables.map((t) => `  ${toPascal(t.name)}Report`).join(",\n");

        await fs.outputFile(
            path.join(root, "src", "reports", "index.js"),
            `// Central registry of all report configurations.
// Import this wherever you need the full list of reports.
${reportRequires}

module.exports = [
${reportArray},
];
`
        );

        // STEP 7 — shared/MetricCards.jsx
        // Renders one card per metric key found in the API response.
        // Handles both aggregated rows (with _sum/_avg suffixes from the backend)
        // and plain numeric fields gracefully.
        await fs.outputFile(
            path.join(root, "src", "shared", "MetricCards.jsx"),
            `// MetricCards — receives a metrics array (field names) and a data object
// (the first row returned by the report API) and renders a KPI card grid.
//
// Props:
//   metrics  string[]   — field names from the report config
//   data     object     — first row of the API response, e.g. { unit_price_sum: 500, ... }
//   loading  boolean    — shows skeleton placeholders while fetching

export default function MetricCards({ metrics, data, loading }) {
  if (!metrics || metrics.length === 0) return null;

  // The backend returns _sum and _avg variants for each metric field.
  // Build display cards for both variants when they exist.
  const cards = [];

  for (const metric of metrics) {
    const sumKey = \`\${metric}_sum\`;
    const avgKey = \`\${metric}_avg\`;
    const label = metric.replace(/_/g, " ");

    if (data && sumKey in data) {
      cards.push({ label: \`Total \${label}\`, value: Number(data[sumKey]).toLocaleString() });
    }
    if (data && avgKey in data) {
      cards.push({ label: \`Avg \${label}\`, value: Number(data[avgKey]).toFixed(2) });
    }
    // Fallback: plain field (no aggregation suffix)
    if (data && metric in data && !(sumKey in data)) {
      cards.push({ label, value: data[metric] });
    }
  }

  // Always show total records if the backend includes it
  if (data && "total_records" in data) {
    cards.unshift({ label: "Total Records", value: data.total_records });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      {loading
        ? Array.from({ length: metrics.length + 1 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 animate-pulse bg-gray-100 h-20" />
          ))
        : cards.map((card) => (
            <div key={card.label} className="border rounded-lg p-4 bg-white shadow-sm">
              <p className="text-gray-500 text-sm capitalize">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value ?? "--"}</p>
            </div>
          ))}
    </div>
  );
}
`
        );

        // shared/ReportTable.jsx
        await fs.outputFile(
            path.join(root, "src", "shared", "ReportTable.jsx"),
            `// ReportTable — renders a plain HTML table from an array of row objects.
// Automatically reads column names from the first row's keys.
//
// Props:
//   rows     object[]  — array of row objects from the API
//   loading  boolean   — shows a loading row while fetching

export default function ReportTable({ rows, loading }) {
  if (loading) {
    return <div className="h-24 bg-gray-100 rounded animate-pulse" />;
  }

  if (!rows || rows.length === 0) {
    return <p className="text-gray-500 text-sm">No data available.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th key={col} className="border px-4 py-2 text-left capitalize">
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="border px-4 py-2">
                  {row[col] ?? "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`
        );

        // STEP 4 — Reports.jsx
        // Fetches GET /reports (all tables in one request) on mount,
        // then renders one section per report config using the shared components.
        const reportImports = reportTables
            .map((t) => `import ${toPascal(t.name)}Report from "../reports/${t.name}.report";`)
            .join("\n");

        const reportConfigArray = reportTables.map((t) => `  ${toPascal(t.name)}Report`).join(",\n");

        await fs.outputFile(
            path.join(root, "src", "pages", "Reports.jsx"),
            `import { useState, useEffect } from "react";
import API from "../api/axios";
import MetricCards from "../shared/MetricCards";
import ReportTable from "../shared/ReportTable";
${reportImports}

// All report configs in one array — add or remove configs here to control
// which reports appear on this page.
const REPORT_CONFIGS = [
${reportConfigArray},
];

export default function Reports() {
  // reportData shape: { [tableName]: rowsArray }
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        // Single request returns data for all tables at once
        const res = await API.get("/reports");
        setReportData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-3xl font-bold">Reports Dashboard</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {REPORT_CONFIGS.map((report) => {
        const rows = reportData[report.table] || [];
        // The aggregate query returns one row per dimension group.
        // Pass the first row to MetricCards for overall KPIs.
        const firstRow = rows[0] || null;

        return (
          <div key={report.table} className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{report.title}</h2>

            {/* KPI metric cards — totals and averages */}
            <MetricCards
              metrics={report.metrics}
              data={firstRow}
              loading={loading}
            />

            {/* Dimension tags — fields used for grouping */}
            {report.dimensions.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Grouped by</p>
                <div className="flex gap-2 flex-wrap">
                  {report.dimensions.map((dim) => (
                    <span key={dim} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {dim.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Data table — all rows from this report's endpoint */}
            <ReportTable rows={rows} loading={loading} />
          </div>
        );
      })}
    </div>
  );
}
`
        );

        console.log("  [✓] report configs, shared components, Reports.jsx");

    } else if (needsReports) {
        // needsReports true but no tables opted in — generate a placeholder
        await fs.outputFile(
            path.join(root, "src", "pages", "Reports.jsx"),
            `export default function Reports() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <p className="text-gray-500">
        No tables were configured for reporting. Re-run the generator and answer
        "Yes" to "Generate a report for this table?" for at least one table.
      </p>
    </div>
  );
}
`
        );
    }

    // ── App.jsx ────────────────────────────────────────────────────────────
    const imports = tables
        .map((t) => `import ${toPascal(t.name)} from "./pages/${toPascal(t.name)}";`)
        .join("\n");

    const routes = tables
        .map((t) =>
            needsAuth
                ? `          <Route path="/${toRoute(t.name)}" element={<PrivateRoute><${toPascal(t.name)} /></PrivateRoute>} />`
                : `          <Route path="/${toRoute(t.name)}" element={<${toPascal(t.name)} />} />`
        )
        .join("\n");

    const navLinks = tables
        .map((t) => `          <Link to="/${toRoute(t.name)}" className="hover:underline">${toPascal(t.name)}</Link>`)
        .join("\n");

    const app = `import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
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

    await fs.outputFile(path.join(root, "src", "App.jsx"), app);
    console.log("  [✓] App.jsx");
}

module.exports = { generateFrontend };
