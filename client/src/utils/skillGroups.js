// Skill categories for display. Keep in sync with SKILL_GROUPS in server/lib/resumeBuilder.js
// (the Resume Builder import uses the same groups).
export const SKILL_GROUPS = {
  Languages: ["python", "java", "c++", "c#", "javascript", "typescript", "kotlin", "swift", "go", "rust", "ruby",
    "php", "scala", "r", "matlab", "perl", "bash", "shell", "c", "dart", "elixir", "haskell", "lua", "sql", "solidity"],
  Frontend: ["react", "vue", "angular", "nextjs", "nuxtjs", "svelte", "html", "css", "tailwind", "bootstrap", "sass",
    "less", "redux", "zustand", "mobx", "webpack", "vite", "babel", "react query", "framer motion", "three.js", "d3.js"],
  Backend: ["node", "express", "fastapi", "django", "flask", "spring boot", "asp.net", "laravel", "rails", "graphql",
    "rest api", "grpc", "fastify", "hapi", "nestjs", "gin", "fiber", "echo", "microservices"],
  Databases: ["mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase", "cassandra", "dynamodb", "elasticsearch",
    "neo4j", "supabase", "planetscale", "cockroachdb", "influxdb", "snowflake", "bigquery"],
  "Cloud & DevOps": ["docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible", "jenkins", "github actions",
    "gitlab ci", "circleci", "linux", "git", "nginx", "apache", "prometheus", "grafana", "datadog", "splunk", "helm",
    "istio", "vault", "ci/cd"],
  "Data & AI": ["machine learning", "deep learning", "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn", "keras",
    "xgboost", "lightgbm", "matplotlib", "seaborn", "plotly", "data science", "nlp", "computer vision",
    "reinforcement learning", "hugging face", "langchain", "openai", "llm", "rag", "vector database", "apache spark",
    "hadoop", "airflow", "dbt", "kafka"],
  Mobile: ["react native", "flutter", "android", "ios", "xamarin", "ionic", "expo"],
  Design: ["figma", "adobe xd", "sketch", "wireframing", "prototyping", "user research", "ui design", "ux design",
    "canva", "illustrator"],
  Security: ["networking", "ethical hacking", "firewalls", "siem", "cryptography", "penetration testing", "owasp",
    "soc", "vulnerability assessment", "cybersecurity", "cloud security"],
  Testing: ["jest", "cypress", "storybook", "tdd", "bdd"],
  Practices: ["agile", "scrum", "kanban", "jira", "confluence", "git flow", "system design",
    "object oriented programming", "functional programming", "design patterns"],
};

// [{ group, items }] in category order, "Other" last; duplicates removed.
export function groupSkills(skills) {
  const groups = new Map();
  for (const raw of skills || []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const skill = raw.trim().toLowerCase();
    const name = Object.keys(SKILL_GROUPS).find((group) => SKILL_GROUPS[group].includes(skill)) || "Other";
    if (!groups.has(name)) groups.set(name, []);
    if (!groups.get(name).includes(skill)) groups.get(name).push(skill);
  }
  return [...Object.keys(SKILL_GROUPS), "Other"].filter((name) => groups.has(name)).map((group) => ({ group, items: groups.get(group) }));
}
