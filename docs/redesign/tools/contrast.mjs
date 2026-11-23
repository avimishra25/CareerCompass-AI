// WCAG 2.x contrast ratios for current and proposed colour pairs.
const lum = (hex) => {
  const [r, g, b] = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = {
  current: [
    ["--text #0f1628 on --bg #f0f2f7", "#0f1628", "#f0f2f7"],
    ["--text-2 #4a5278 on --bg", "#4a5278", "#f0f2f7"],
    ["--text-3 #8892b4 on --bg", "#8892b4", "#f0f2f7"],
    ["--text-3 #8892b4 on white", "#8892b4", "#ffffff"],
    ["link blue #3b6ef8 on --bg", "#3b6ef8", "#f0f2f7"],
    ["white on btn-primary start #3b6ef8", "#ffffff", "#3b6ef8"],
    ["white on btn-primary end #6c63ff", "#ffffff", "#6c63ff"],
    ["success #10b981 on white", "#10b981", "#ffffff"],
    ["warning #f59e0b on white", "#f59e0b", "#ffffff"],
    ["rose #e11d6a on white", "#e11d6a", "#ffffff"],
  ],
  proposed: [
    ["text #101828 on page #F7F8FA", "#101828", "#F7F8FA"],
    ["secondary #344054 on page", "#344054", "#F7F8FA"],
    ["muted #667085 on page", "#667085", "#F7F8FA"],
    ["muted #667085 on white", "#667085", "#FFFFFF"],
    ["brand #0F766E on white (links)", "#0F766E", "#FFFFFF"],
    ["white on brand #0F766E (primary button)", "#FFFFFF", "#0F766E"],
    ["white on brand hover #115E59", "#FFFFFF", "#115E59"],
    ["brand #0F766E on tint #F0FDFA (brand badge)", "#0F766E", "#F0FDFA"],
    ["success #067647 on tint #ECFDF3", "#067647", "#ECFDF3"],
    ["warning #B54708 on tint #FFFAEB", "#B54708", "#FFFAEB"],
    ["danger #B42318 on tint #FEF3F2", "#B42318", "#FEF3F2"],
    ["white on danger #B42318 (danger button)", "#FFFFFF", "#B42318"],
    ["secondary #344054 on hover grey #F2F4F7", "#344054", "#F2F4F7"],
    ["muted #667085 on hover grey #F2F4F7", "#667085", "#F2F4F7"],
  ],
};
for (const [group, list] of Object.entries(pairs)) {
  console.log(`## ${group}`);
  for (const [label, fg, bg] of list) {
    const r = ratio(fg, bg);
    console.log(`${r >= 4.5 ? "PASS " : r >= 3 ? "LARGE" : "FAIL "} ${r.toFixed(2)}:1  ${label}`);
  }
}
