import React, { useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download, FileText, Upload } from "lucide-react";
import { TARGET_ROLES } from "../constants/targetRoles";
import { useOptionalAppData } from "../context/AppDataContext";
import { Button, Card, Icon, InlineAlert, PageHeader, Select, SLOW_MESSAGE, cx, useSlowNotice } from "../components/ui";
import { NextStepCard, ResultTabs, SummaryRow, nextStep, roleMissing, roleScore } from "../components/analysis/AnalysisResults";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadResume({ onNavigate, presetFile = null }) {
  // A PDF exported from the Resume Builder can be handed over for analysis.
  const [file, setFile] = useState(presetFile);
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState(null);
  const [analysedAt, setAnalysedAt] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const reportRef = useRef(null);
  const appData = useOptionalAppData();
  const slow = useSlowNotice(loading);

  const handleFile = (candidate) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf") { setError("Choose a PDF file."); return; }
    if (candidate.size > MAX_BYTES) { setError("The PDF is larger than 5 MB. Export a smaller file and try again."); return; }
    setFile(candidate);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("resume", file);
    if (targetRole) form.append("targetRole", targetRole);
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/upload`, form, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setResult({ ...data, targetRole, fileName: file.name });
      setAnalysedAt(new Date());
      // The Career Coach talks about these fresh results; the shared history picks up the new analysis.
      appData?.setCoachAnalysis({ ...data, targetRole });
      appData?.reload();
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("token"); window.location.reload(); return; }
      setError(err.response?.data?.error === "PDF exceeds 5 MB limit"
        ? "The PDF is larger than 5 MB. Export a smaller file and try again."
        : "Analysis failed. Check the file and try again in a minute.");
    } finally {
      setLoading(false);
    }
  };

  // The report is an image of the summary and every tab (inactive tabs are revealed in the clone).
  const downloadReport = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#F7F8FA", logging: false,
        onclone: (doc) => doc.querySelectorAll("[data-report-panel], [data-report-heading]").forEach((node) => { node.hidden = false; }),
      });
      const image = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(image, "PNG", 0, 0, pageWidth, imageHeight);
      for (let left = imageHeight - pageHeight; left > 0; left -= pageHeight) {
        pdf.addPage();
        pdf.addImage(image, "PNG", 0, left - imageHeight, pageWidth, imageHeight);
      }
      pdf.save(`CareerCompass-report-${(result.fileName || "resume").replace(/\.pdf$/i, "")}.pdf`);
    } catch {
      setError("Could not create the PDF report. Try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Cross-links pre-select this analysis and the target (or best-matched) role.
  const role = result?.targetRole || result?.bestRole?.role || "";
  const missing = result ? roleMissing(result.match, role) : [];
  const step = result ? nextStep({ atsScore: result.atsScore, mlInsights: result.mlInsights, atsBreakdown: result.atsBreakdown, role, missing }) : null;
  const go = (kind) => {
    if (kind === "roadmap") onNavigate?.("roadmap", { analysisId: result.analysisId, targetRole: role });
    if (kind === "interview") onNavigate?.("interview", { analysisId: result.analysisId, role });
    if (kind === "resume") onNavigate?.("resume-builder");
  };
  const secondary = [
    { kind: "roadmap", label: "Build roadmap" },
    { kind: "interview", label: "Practise interview" },
  ].filter((item) => item.kind !== step?.kind);

  const uploadCard = (
    <Card as="section" title={result ? "Analyze another resume" : "Upload your resume"}
      description="One PDF, up to 5 MB. Choose a target role to benchmark against it, or let us find your best match.">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-end">
        <Select label="Target role (optional)" value={targetRole} onChange={(event) => setTargetRole(event.target.value)}
          options={TARGET_ROLES} disabled={loading} />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-secondary">Resume PDF</span>
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }}
            className={cx("flex min-h-9 flex-wrap items-center gap-3 rounded-control border border-dashed px-3 py-2 transition-ui",
              dragging ? "border-brand bg-brand-tint" : "border-line-strong bg-surface")}
          >
            <Icon icon={file ? FileText : Upload} className="shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
              {file ? <><span className="font-medium text-ink">{file.name}</span> · <span className="tabular">{Math.max(1, Math.round(file.size / 1024))} KB</span></> : "Drop a PDF here"}
            </span>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={loading}>{file ? "Change file" : "Choose file"}</Button>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" aria-label="Resume PDF"
              onChange={(event) => handleFile(event.target.files[0])} />
          </div>
        </div>
      </div>
      {presetFile && file === presetFile && !result && (
        <p className="mt-3 text-sm text-brand">Your Resume Builder PDF is attached. Pick a target role if you like, then analyze it.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant={result ? "secondary" : "primary"} icon={Upload} onClick={analyze} disabled={!file} loading={loading}>
          {loading ? "Analyzing…" : "Analyze resume"}
        </Button>
        {loading && <span role="status" className="text-sm text-ink-muted">{slow ? SLOW_MESSAGE : "Reading your resume and scoring it. This takes a few seconds."}</span>}
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Resume analysis"
        description="Your ATS score, the skills in your resume, and how you match 12 roles."
        actions={result && <Button icon={Download} onClick={downloadReport} loading={pdfLoading}>Download report</Button>}
      />
      {error && <InlineAlert className="mb-4" onDismiss={() => setError("")}>{error}</InlineAlert>}
      {result ? (
        <div className="space-y-6">
          <NextStepCard step={step} onAction={go} secondary={secondary} />
          <div ref={reportRef} className="space-y-6">
            <SummaryRow atsScore={result.atsScore} role={role} roleScore={roleScore(result.match, role) ?? result.bestRole?.score}
              skillCount={result.skills?.length || 0} fileName={result.fileName} analysedAt={analysedAt} />
            <ResultTabs skills={result.skills || []} atsBreakdown={result.atsBreakdown} mlInsights={result.mlInsights}
              matchData={result.match} targetRole={role} />
          </div>
          {uploadCard}
        </div>
      ) : uploadCard}
    </>
  );
}
