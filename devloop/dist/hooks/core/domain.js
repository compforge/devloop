export function decision(findings) {
    return { action: findings.some((item) => item.severity === "deny") ? "deny" : findings.some((item) => item.severity === "warn") ? "warn" : "allow", findings };
}
export function decisionMessage(value) {
    const severity = value.action === "deny" ? "deny" : "warn";
    return value.findings.filter((item) => item.severity === severity).map((item) => item.message).join("\n\n");
}
//# sourceMappingURL=domain.js.map