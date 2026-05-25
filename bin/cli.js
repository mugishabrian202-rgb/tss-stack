#!/usr/bin/env node
"use strict";

const ora = require("ora");
const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const { spawn, execSync } = require("child_process");

const { generateBackend } = require("../src/generators/backend");
const { generateFrontend } = require("../src/generators/frontend");
const { generateDatabase } = require("../src/generators/database");
const { toPascal } = require("../src/generators/utils");

/* ==========================================================================
   CONSTANTS & CONFIG
========================================================================== */

const CONSTANTS = {
    MIN_PORT: 1,
    MAX_PORT: 65535,
    MAX_TABLES: 50,
    MIN_TABLES: 1,
    DELAY_PER_LINE: 20,
    INTRO_DELAY: 300,
    BACKEND_PORT_DEFAULT: "5000",
    FRONTEND_PORT_DEFAULT: 5173,
};

const COLORS = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m",
    underline: "\x1b[4m",
    reset: "\x1b[0m",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ==========================================================================
   LOGGER
========================================================================== */

const logger = {
    info(message = "") { console.log(message); },
    success(message) { console.log(`${COLORS.green}[✓]${COLORS.reset} ${message}`); },
    warn(message) { console.log(`${COLORS.yellow}[!]${COLORS.reset} ${message}`); },
    error(message) { console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${message}`); },
    fatal(message, err = null) {
        console.error(`${COLORS.red}[FATAL]${COLORS.reset} ${message}`);
        if (err) console.error(err);
        process.exit(1);
    },
};

/* ==========================================================================
   VALIDATORS
========================================================================== */

function validateFolderName(value) {
    if (!value || value.trim() === "") return "Folder name cannot be empty.";
    if (value.includes("..") || value.includes("/") || value.includes("\\")) {
        return "Folder name cannot contain path separators or '..'.";
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(value)) {
        return "Folder name can only contain letters, numbers, dashes, and underscores.";
    }
    return true;
}

function validateDatabaseName(value) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
        return "Database name must start with a letter and contain only letters, numbers, and underscores.";
    }
    if (value.length > 64) return "Database name cannot exceed 64 characters.";
    return true;
}

function validateTableName(value) {
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
        return "Table name must start with a lowercase letter and use snake_case (e.g., spare_parts).";
    }
    const reservedWords = [
        "select", "insert", "update", "delete", "create", "drop",
        "table", "index", "key", "primary", "foreign", "user", "order",
        "group", "having", "where", "from", "into", "values", "set",
    ];
    if (reservedWords.includes(value.toLowerCase())) {
        return `"${value}" is a reserved SQL keyword. Please use a different name.`;
    }
    return true;
}

function validatePort(value) {
    const port = Number(value);
    if (!Number.isInteger(port)) return "Port must be an integer.";
    if (port < CONSTANTS.MIN_PORT || port > CONSTANTS.MAX_PORT) {
        return `Port must be between ${CONSTANTS.MIN_PORT} and ${CONSTANTS.MAX_PORT}.`;
    }
    return true;
}

function validateFields(value) {
    const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
    if (raw.trim() === "") return "At least one field is required.";

    const parsed = raw.split(",").map((f) => f.trim()).filter(Boolean);
    if (parsed.length === 0) return "At least one field is required.";
    if (parsed.length > 50) return "Maximum 50 fields per table allowed.";

    const invalid = parsed.find((field) => {
        if (!/^[a-z][a-z0-9_]*$/.test(field)) return true;
        const reserved = ["id", "created_at", "updated_at"];
        return reserved.includes(field.toLowerCase());
    });

    if (invalid) {
        return `Invalid field name "${invalid}". Use lowercase snake_case starting with a letter. Note: id, created_at and updated_at are added automatically.`;
    }
    return true;
}

function validateTableCount(value) {
    const count = Number(value);
    if (!Number.isInteger(count)) return "Enter a whole number.";
    if (count < CONSTANTS.MIN_TABLES) return `Minimum ${CONSTANTS.MIN_TABLES} table required.`;
    if (count > CONSTANTS.MAX_TABLES) return `Maximum ${CONSTANTS.MAX_TABLES} tables allowed.`;
    return true;
}

/* ==========================================================================
   HELPERS
========================================================================== */

async function printTree(lines) {
    for (const line of lines) {
        console.log(line);
        await sleep(CONSTANTS.DELAY_PER_LINE);
    }
}

function formatTree(lines) {
    if (lines.length === 0) return [];
    return lines.map((line, index) =>
        index === lines.length - 1 ? line.replace("├──", "└──") : line
    );
}

function sanitizePackageName(name) {
    return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/^-+|-+$/g, "");
}

function isMySQLInstalled() {
    try {
        execSync("mysql --version", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function checkNodeVersion() {
    const [major] = process.versions.node.split(".").map(Number);
    const MIN_NODE = 16;
    if (major < MIN_NODE) {
        logger.warn(`Node.js ${MIN_NODE}+ recommended. Current: ${process.versions.node}`);
        return false;
    }
    return true;
}

function runCommand(command, args, cwd, spinner, failMessage) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args.filter(Boolean), {
            cwd,
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });

        child.on("close", (code) => {
            if (code === 0) { spinner.succeed(); resolve(); }
            else { spinner.fail(failMessage); reject(new Error(`${command} exited with code ${code}`)); }
        });

        child.on("error", (err) => { spinner.fail(failMessage); reject(err); });
    });
}

async function cleanupProject(targetDir) {
    try {
        if (await fs.pathExists(targetDir)) {
            await fs.remove(targetDir);
            logger.warn(`Cleaned up partially generated project: ${targetDir}`);
        }
    } catch (err) {
        logger.error(`Failed to clean up: ${err.message}`);
    }
}

async function generateGitIgnore(targetDir) {
    const content = `node_modules/\n.env\n*.log\n.DS_Store\n.idea/\n.vscode/\n`;
    const dest = path.join(targetDir, ".gitignore");
    if (!(await fs.pathExists(dest))) await fs.outputFile(dest, content);
}

/* ==========================================================================
   PROMPTS
========================================================================== */

async function promptBasics(targetDir) {
    return inquirer.prompt([
        {
            name: "projectName",
            message: "[1] Project display name:",
            default: targetDir,
            validate: (v) => (!v || v.trim() === "" ? "Project name cannot be empty." : true),
        },
        {
            name: "dbName",
            message: "[2] MySQL database name:",
            default: targetDir.toLowerCase().replace(/-/g, "_") + "_db",
            validate: validateDatabaseName,
        },
        {
            name: "port",
            message: "[3] Backend port number:",
            default: CONSTANTS.BACKEND_PORT_DEFAULT,
            validate: validatePort,
        },
    ]);
}

async function promptTableCount() {
    return inquirer.prompt([
        {
            name: "tableCount",
            message: `[4] How many tables does your database need? (1-${CONSTANTS.MAX_TABLES}):`,
            validate: validateTableCount,
        },
    ]);
}

async function promptTable(index) {
    return inquirer.prompt([
        {
            name: "name",
            message: `Table ${index + 1} name (snake_case, e.g. spare_parts):`,
            validate: validateTableName,
        },
        {
            name: "fields",
            message: "Fields for this table (comma separated, lowercase snake_case):",
            validate: validateFields,
            filter: (value) => value.split(",").map((f) => f.trim()).filter(Boolean),
        },
        {
            name: "operations",
            type: "checkbox",
            message: "Which operations does this table need?",
            choices: [
                { name: "INSERT (create)", value: "insert", checked: true },
                { name: "SELECT (read/list)", value: "select", checked: true },
                { name: "UPDATE (edit)", value: "update" },
                { name: "DELETE (remove)", value: "delete" },
            ],
            validate: (value) => (value.length > 0 ? true : "Select at least one operation."),
        },
        // STEP 1 — per-table report opt-in
        {
            name: "reports",
            type: "confirm",
            message: "Generate a report for this table?",
            default: true,
        },
    ]);
}

async function promptFeatures() {
    return inquirer.prompt([
        {
            name: "needsAuth",
            type: "confirm",
            message: "[5] Add session-based login/register system?",
            default: true,
        },
        {
            name: "needsReports",
            type: "confirm",
            message: "[6] Add a Reports page?",
            default: true,
        },
    ]);
}

/* ==========================================================================
   TREE PREVIEW
========================================================================== */

async function showProjectTree(config) {
    const reportTables = config.tables.filter((t) => t.reports && config.needsReports);

    const backendRouteFiles = [
        config.needsAuth ? "│   │   ├── auth.js" : null,
        ...config.tables.map((t, i) => {
            const isLast = i === config.tables.length - 1 && !config.needsReports;
            return `│   │   ${isLast ? "└──" : "├──"} ${t.name}.js`;
        }),
        config.needsReports && reportTables.length > 0 ? "│   │   └── reports.js" : null,
    ].filter(Boolean);

    const frontendContextFiles = config.needsAuth ? ["│   │   ├── AuthContext.jsx"] : [];
    const frontendComponentFiles = config.needsAuth ? ["│   │   └── PrivateRoute.jsx"] : [];

    const frontendPageFiles = [
        "│   │   ├── Home.jsx",
        config.needsAuth ? "│   │   ├── Login.jsx" : null,
        ...config.tables.map((t) => `│   │   ├── ${toPascal(t.name)}.jsx`),
        config.needsReports ? "│   │   └── Reports.jsx" : null,
    ].filter(Boolean);

    const reportConfigFiles = reportTables.map((t, i) => {
        const isLast = i === reportTables.length - 1;
        return `    │   │   ${isLast ? "└──" : "├──"} ${t.name}.report.js`;
    });

    const tree = [
        `${COLORS.yellow}${path.basename(config.targetDir)}/${COLORS.reset}`,
        "",
        `├── ${COLORS.blue}backend-project/${COLORS.reset}`,
        "│   ├── config/",
        "│   │   ├── db.js",
        "│   │   └── database.sql",
        "│   ├── middleware/",
        config.needsAuth ? "│   │   └── auth.js" : "│   │   (none)",
        "│   ├── routes/",
        ...backendRouteFiles,
        "│   ├── server.js",
        "│   ├── .env.example",
        "│   └── package.json",
        "",
        `└── ${COLORS.blue}frontend-project/${COLORS.reset}`,
        "    ├── src/",
        "    │   ├── api/",
        "    │   │   └── axios.js",
        config.needsAuth ? "    │   ├── context/" : null,
        ...frontendContextFiles,
        config.needsAuth ? "    │   ├── components/" : null,
        ...frontendComponentFiles,
        config.needsReports && reportTables.length > 0 ? "    │   ├── reports/" : null,
        config.needsReports && reportTables.length > 0 ? "    │   │   ├── index.js" : null,
        ...reportConfigFiles,
        config.needsReports && reportTables.length > 0 ? "    │   ├── shared/" : null,
        config.needsReports && reportTables.length > 0 ? "    │   │   ├── MetricCards.jsx" : null,
        config.needsReports && reportTables.length > 0 ? "    │   │   └── ReportTable.jsx" : null,
        "    │   ├── pages/",
        ...frontendPageFiles,
        "    │   ├── App.jsx",
        "    │   ├── main.jsx",
        "    │   └── index.css",
        "    ├── vite.config.js",
        "    ├── tailwind.config.js",
        "    ├── index.html",
        "    └── package.json",
    ].filter(Boolean);

    await printTree(tree);
}

/* ==========================================================================
   MAIN
========================================================================== */

async function run() {
    checkNodeVersion();

    const targetDir = process.argv[2];
    if (!targetDir) logger.fatal("Usage: npx tss-stack <folder-name>");

    const folderValidation = validateFolderName(targetDir);
    if (folderValidation !== true) logger.fatal(folderValidation);

    const absoluteTargetDir = path.resolve(process.cwd(), targetDir);
    if (await fs.pathExists(absoluteTargetDir)) {
        logger.fatal(`Folder "${targetDir}" already exists.`);
    }

    logger.info(`\n${COLORS.bold}[✓] Full Project Folder Structure Generator${COLORS.reset}\n`);

    const basics = await promptBasics(targetDir);
    const { tableCount } = await promptTableCount();

    const tables = [];
    for (let i = 0; i < Number(tableCount); i++) {
        tables.push(await promptTable(i));
    }

    const features = await promptFeatures();

    const config = {
        projectName: basics.projectName,
        dbName: basics.dbName,
        port: basics.port,
        tables,
        needsAuth: features.needsAuth,
        needsReports: features.needsReports,
        targetDir: absoluteTargetDir,
        packageName: sanitizePackageName(basics.projectName),
    };

    // Clear the interview from terminal
    process.stdout.write("\x1Bc");

    logger.info(`\n[⁂] TSS Stack — generating ${COLORS.cyan}${config.projectName}${COLORS.reset}\n`);
    await sleep(CONSTANTS.INTRO_DELAY);

    try {
        await generateDatabase(config);
        await generateBackend(config);
        await generateFrontend(config);
    } catch (err) {
        await cleanupProject(absoluteTargetDir);
        logger.fatal("Project generation failed.", err.message || err);
    }

    const backendPath = path.join(absoluteTargetDir, "backend-project");
    const frontendPath = path.join(absoluteTargetDir, "frontend-project");

    if (!(await fs.pathExists(backendPath))) {
        await cleanupProject(absoluteTargetDir);
        logger.fatal(`Missing backend directory: ${backendPath}`);
    }
    if (!(await fs.pathExists(frontendPath))) {
        await cleanupProject(absoluteTargetDir);
        logger.fatal(`Missing frontend directory: ${frontendPath}`);
    }

    await generateGitIgnore(absoluteTargetDir);
    await showProjectTree(config);
    logger.info("");

    const backendSpinner = ora({ text: "Installing backend dependencies...", color: "cyan" }).start();
    try {
        await runCommand(
            process.platform === "win32" ? "npm.cmd" : "npm",
            ["install"], backendPath, backendSpinner,
            "Backend dependency installation failed"
        );
    } catch (err) {
        await cleanupProject(absoluteTargetDir);
        logger.fatal(err.message);
    }

    const frontendSpinner = ora({ text: "Installing frontend dependencies...", color: "magenta" }).start();
    try {
        await runCommand(
            process.platform === "win32" ? "npm.cmd" : "npm",
            ["install"], frontendPath, frontendSpinner,
            "Frontend dependency installation failed"
        );
    } catch (err) {
        await cleanupProject(absoluteTargetDir);
        logger.fatal(err.message);
    }

    if (!isMySQLInstalled()) {
        logger.warn("MySQL not detected. Install MySQL to import the database.");
    }

    const relativePath = path.relative(process.cwd(), absoluteTargetDir);
    logger.info(`
${COLORS.green}[✓] Done! ${config.projectName} is ready.${COLORS.reset}

${COLORS.bold}Next steps:${COLORS.reset}

1. Import your database:
   ${COLORS.cyan}mysql -u root -p < ${relativePath}/backend-project/config/database.sql${COLORS.reset}

2. Start backend:
   ${COLORS.cyan}cd ${relativePath}/backend-project${COLORS.reset}
   ${COLORS.cyan}cp .env.example .env${COLORS.reset}
   Fill in your MySQL credentials in .env
   ${COLORS.cyan}npm run dev${COLORS.reset}

3. Start frontend:
   ${COLORS.cyan}cd ${relativePath}/frontend-project${COLORS.reset}
   ${COLORS.cyan}npm run dev${COLORS.reset}

4. Open in browser:
   ${COLORS.underline}http://localhost:${CONSTANTS.FRONTEND_PORT_DEFAULT}${COLORS.reset}

${COLORS.yellow}Tip:${COLORS.reset} Check ${COLORS.cyan}.gitignore${COLORS.reset} to exclude node_modules and .env from version control.
`);
}

/* ==========================================================================
   PROCESS HANDLERS
========================================================================== */

process.on("SIGINT", async () => {
    const targetDir = process.argv[2];
    if (targetDir) await cleanupProject(path.resolve(process.cwd(), targetDir));
    console.log(`\n${COLORS.red}[ABORTED]${COLORS.reset} Process cancelled by user.`);
    process.exit(130);
});

process.on("SIGTERM", async () => {
    const targetDir = process.argv[2];
    if (targetDir) await cleanupProject(path.resolve(process.cwd(), targetDir));
    process.exit(143);
});

process.on("unhandledRejection", (reason) => { logger.fatal("Unhandled Promise Rejection", reason); });
process.on("uncaughtException", (err) => { logger.fatal("Uncaught Exception", err); });

run().catch((err) => { logger.fatal("Unexpected fatal error.", err.message || err); });
