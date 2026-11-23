import { formatSkill } from "./format";

test("skills keep acronyms and brand spellings", () => {
  expect(["sql", "ci/cd", "javascript", "node", "mongodb", "kubernetes", "react native", "rest api", "", null].map(formatSkill))
    .toEqual(["SQL", "CI/CD", "JavaScript", "Node.js", "MongoDB", "Kubernetes", "React Native", "REST API", "", ""]);
});
