import { cleanDraft, dateRange } from "./resumeDraft";

// A4 text PDF drawn with jsPDF's text API (not an html2canvas screenshot), so the text is
// selectable and ATS parsers can read it. The standard Times font covers Latin-1 characters only.
export async function exportResumePdf(draft) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const s = cleanDraft(draft).sections;
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (height) => { if (y + height > bottom) { doc.addPage(); y = margin; } };
  const font = (size, style = "normal") => { doc.setFont("times", style); doc.setFontSize(size); };
  const write = (text, { size = 10.5, style = "normal", indent = 0, center = false } = {}) => {
    font(size, style);
    for (const line of doc.splitTextToSize(text, width - indent)) {
      ensure(size + 3);
      y += size;
      doc.text(line, center ? margin + width / 2 : margin + indent, y, center ? { align: "center" } : undefined);
      y += 3;
    }
  };
  const row = (left, right) => {
    font(10.5, "bold");
    const rightWidth = right ? doc.getTextWidth(right) + 12 : 0;
    const leftLines = doc.splitTextToSize(left, width - rightWidth);
    ensure(13.5 * leftLines.length);
    y += 10.5;
    doc.text(leftLines, margin, y);
    if (right) { font(10.5); doc.text(right, margin + width, y, { align: "right" }); }
    y += 13.5 * (leftLines.length - 1) + 3;
  };
  const bullet = (text) => {
    font(10.5);
    const wrapped = doc.splitTextToSize(text, width - 14);
    ensure(13.5);
    doc.text("•", margin + 3, y + 10.5);
    for (const line of wrapped) { ensure(13.5); y += 10.5; doc.text(line, margin + 14, y); y += 3; }
  };
  const heading = (text) => {
    ensure(30);
    y += 8;
    write(text, { size: 11.5, style: "bold" });
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + width, y);
    y += 3;
  };

  if (s.contact.name) write(s.contact.name.toUpperCase(), { size: 18, style: "bold", center: true });
  const contact = [s.contact.email, s.contact.phone, ...s.contact.links].filter(Boolean).join("  ·  ");
  if (contact) write(contact, { size: 10, center: true });
  if (s.summary) { heading("SUMMARY"); write(s.summary); }
  if (s.skills.length) {
    heading("SKILLS");
    s.skills.forEach((group) => write((group.group ? `${group.group}: ` : "") + group.items.join(", ")));
  }
  if (s.experience.length) {
    heading("EXPERIENCE");
    s.experience.forEach((item) => {
      row([item.role, item.org].filter(Boolean).join(", "), dateRange(item.start, item.end));
      item.bullets.forEach(bullet);
    });
  }
  if (s.projects.length) {
    heading("PROJECTS");
    s.projects.forEach((item) => {
      row([item.name, item.tech.join(", ")].filter(Boolean).join(" · "), "");
      item.bullets.forEach(bullet);
    });
  }
  if (s.education.length) {
    heading("EDUCATION");
    s.education.forEach((item) => {
      row([item.degree, item.institute].filter(Boolean).join(", "), dateRange(item.start, item.end));
      if (item.score) write(item.score);
    });
  }
  if (s.certifications.length) { heading("CERTIFICATIONS"); s.certifications.forEach(bullet); }
  if (s.achievements.length) { heading("ACHIEVEMENTS"); s.achievements.forEach(bullet); }

  const name = (s.contact.name || draft.title || "resume").replace(/[^\w-]+/g, "_").slice(0, 60);
  const fileName = `${name}_Resume.pdf`;
  doc.save(fileName);
  // Returned so the builder can hand the same PDF to Analyze without a re-upload.
  return new File([doc.output("blob")], fileName, { type: "application/pdf" });
}
