const fs = require("fs-extra");
const path = require("path");

const { toPascal, escapeSqlIdentifier, inferSqlType } = require("./utils");

async function generateDatabase(config) {
    const { dbName, tables, needsAuth, targetDir } = config;

    let sql = `-- ======================================================
-- Database: ${dbName}
-- Generated automatically
-- ======================================================

CREATE DATABASE IF NOT EXISTS ${escapeSqlIdentifier(dbName)};
USE ${escapeSqlIdentifier(dbName)};

`;

    if (needsAuth) {
        sql += `CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;
    }

    for (const table of tables) {
        sql += `-- ${toPascal(table.name)} table
CREATE TABLE IF NOT EXISTS ${escapeSqlIdentifier(table.name)} (
  id INT AUTO_INCREMENT PRIMARY KEY,
`;

        for (const field of table.fields) {
            sql += `  ${escapeSqlIdentifier(field)} ${inferSqlType(field)} NOT NULL,
`;
        }

        sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;
    }

    const outputPath = path.join(targetDir, "backend-project", "config", "database.sql");
    await fs.outputFile(outputPath, sql);
    console.log("  [✓] database.sql");
}

module.exports = {
    generateDatabase,
};