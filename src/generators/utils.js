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

module.exports = {
    toPascal,
    toCamel,
    toRoute,
    escapeSqlIdentifier,
    inferSqlType,
};