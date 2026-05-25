/**
 * String and SQL helpers for generator templates.
 */

const normalizeInput = (value = "") => String(value).trim();

const splitSnakeCase = (value = "") =>
    normalizeInput(value)
        .split("_")
        .map((part) => part.trim())
        .filter(Boolean);

const capitalize = (value = "") =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

const toPascal = (str = "") => splitSnakeCase(str).map(capitalize).join("");

const toCamel = (str = "") => {
    const pascal = toPascal(str);
    return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
};

const toRoute = (str = "") =>
    normalizeInput(str)
        .replace(/_+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

const escapeSqlIdentifier = (identifier = "") => {
    const safe = String(identifier).replace(/`/g, "``");
    return `\`${safe}\``;
};

function inferSqlType(field = "") {
    const lower = String(field).toLowerCase().trim();

    if (!lower) return "VARCHAR(255)";
    if (lower === "id" || lower.endsWith("_id")) return "INT";
    if (lower.includes("quantity") || lower.includes("count") || lower.includes("number")) return "INT";
    if (lower.includes("price") || lower.includes("amount") || lower.includes("total") || lower.includes("cost")) {
        return "DECIMAL(10,2)";
    }
    if (lower.includes("date") || lower.includes("birthday")) return "DATE";
    if (lower.includes("time")) return "DATETIME";
    if (lower.includes("email")) return "VARCHAR(255)";
    if (lower.includes("phone")) return "VARCHAR(30)";
    if (lower.includes("description") || lower.includes("notes") || lower.includes("message")) return "TEXT";

    return "VARCHAR(255)";
}

/**
 * Analyses a table's fields and categorises them for report generation.
 *
 * metrics   — numeric fields worth summing (price, total, quantity, amount, cost)
 * dimensions — categorical fields worth grouping by (status, type, category)
 * dateFields — date/time fields useful for trend queries
 *
 * @param {{ name: string, fields: string[] }} table
 * @returns {{ metrics: string[], dimensions: string[], dateFields: string[] }}
 */
function inferReportConfig(table) {
    const metrics = [];
    const dimensions = [];
    const dateFields = [];

    for (const field of table.fields) {
        const lower = field.toLowerCase();

        if (
            lower.includes("amount") ||
            lower.includes("price") ||
            lower.includes("total") ||
            lower.includes("quantity") ||
            lower.includes("cost") ||
            lower.includes("count")
        ) {
            metrics.push(field);
        } else if (
            lower.includes("date") ||
            lower.includes("created") ||
            lower.includes("updated") ||
            lower.includes("time")
        ) {
            dateFields.push(field);
        } else if (
            lower.includes("status") ||
            lower.includes("type") ||
            lower.includes("category") ||
            lower.includes("kind")
        ) {
            dimensions.push(field);
        }
    }

    // Always include created_at as a date dimension — it is added to every table
    if (!dateFields.includes("created_at")) {
        dateFields.push("created_at");
    }

    return { metrics, dimensions, dateFields };
}

module.exports = {
    toPascal,
    toCamel,
    toRoute,
    escapeSqlIdentifier,
    inferSqlType,
    inferReportConfig,
};
