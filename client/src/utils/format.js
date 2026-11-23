// Display helpers shared by pages.

// Skills are stored lowercase ("sql", "ci/cd", "react"). Show acronyms in capitals, others capitalised.
const ACRONYMS = new Set(["sql", "css", "html", "aws", "gcp", "api", "rest api", "ci/cd", "jwt", "ui/ux", "ml", "nlp", "siem",
  "ios", "mlops", "php", "sass", "seo", "ui", "ux", "kpi", "etl", "gpu", "llm", "orm", "sdk", "tcp/ip", "dns", "vpn", "oop"]);
const SPECIAL = { javascript: "JavaScript", typescript: "TypeScript", nodejs: "Node.js", node: "Node.js", mongodb: "MongoDB",
  postgresql: "PostgreSQL", mysql: "MySQL", github: "GitHub", "github actions": "GitHub Actions", nextjs: "Next.js",
  graphql: "GraphQL", pytorch: "PyTorch", tensorflow: "TensorFlow", numpy: "NumPy", "scikit-learn": "scikit-learn",
  fastapi: "FastAPI", devops: "DevOps", "react native": "React Native", "adobe xd": "Adobe XD", "rest api": "REST API" };

export function formatSkill(skill) {
  if (typeof skill !== "string" || !skill) return "";
  const key = skill.trim().toLowerCase();
  if (SPECIAL[key]) return SPECIAL[key];
  if (ACRONYMS.has(key)) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const shortDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const longDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
