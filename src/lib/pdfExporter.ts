import { jsPDF } from 'jspdf';
import type { AuditResults, PageSpeedMetric } from './seoEngine';

/**
 * Generates and downloads a clean, professional PDF report of the SEO scan results.
 */
export function exportSEOReport(results: AuditResults): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helpers
  const addPageIfNeeded = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = 20;
      // Draw header on new page
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`SEO Audit Report: ${results.url}`, margin, 12);
      doc.line(margin, 14, pageWidth - margin, 14);
      y = 20;
    }
  };

  const drawHeader = () => {
    // Top Bar Style Accent
    doc.setFillColor(10, 10, 10); // Black canvas color
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Electric Yellow Accent Block
    doc.setFillColor(250, 255, 105); // Yellow
    doc.rect(margin, 12, 4, 16, 'F');

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('SEO AUDIT REPORT', margin + 8, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text('DEVELOPER-FIRST PERFORMANCE & METRIC PANELS', margin + 8, 25);

    y = 50;
  };

  // Run Draw Header
  drawHeader();

  // Summary Metrics Section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 10, 10);
  doc.text('1. Executive Audit Summary', margin, y);
  y += 6;

  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // URL & Time Info
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('Target Website:', margin, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(results.url, margin + 30, y);
  y += 5;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Audit Timestamp:', margin, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(new Date(results.timestamp).toUTCString(), margin + 30, y);
  y += 10;

  // Grade & Score Block
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 22, 'F');
  
  // Score label
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('OVERALL SEO SCORE', margin + 6, y + 9);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(10, 10, 10);
  doc.text(`${results.score}/100`, margin + 6, y + 18);

  // Grade letter
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('RATING GRADE', margin + 65, y + 9);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(28);
  // Color code grade
  if (results.score >= 90) doc.setTextColor(34, 197, 94); // Green
  else if (results.score >= 70) doc.setTextColor(245, 158, 11); // Warning Yellow/Orange
  else doc.setTextColor(239, 68, 68); // Red
  doc.text(results.grade, margin + 65, y + 18);

  // Quick stats
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('LINKS CRAWLED', margin + 110, y + 9);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(`${results.links.length}`, margin + 110, y + 16);

  const brokenLinksCount = results.links.filter(l => l.statusState === 'broken').length;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('BROKEN LINKS', margin + 145, y + 9);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(brokenLinksCount > 0 ? 239 : 20, brokenLinksCount > 0 ? 68 : 20, brokenLinksCount > 0 ? 68 : 20);
  doc.text(`${brokenLinksCount}`, margin + 145, y + 16);

  y += 32;

  // On-Page Details
  addPageIfNeeded(60);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 10, 10);
  doc.text('2. On-Page SEO Checklist', margin, y);
  y += 6;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const onPageItems = [
    { name: 'Title Tag', status: results.onPage.title.status, detail: results.onPage.title.text, msg: results.onPage.title.message },
    { name: 'Meta Description', status: results.onPage.description.status, detail: results.onPage.description.text, msg: results.onPage.description.message },
    { name: 'Canonical Link', status: results.onPage.canonical.status, detail: results.onPage.canonical.url, msg: results.onPage.canonical.message },
    { name: 'Header H1 Tag', status: results.onPage.headings.status, detail: `Found ${results.onPage.headings.h1.length} H1 headers.`, msg: results.onPage.headings.message },
    { name: 'Image Alt Tags', status: results.onPage.imageAlts.status, detail: `Missing ${results.onPage.imageAlts.missing} out of ${results.onPage.imageAlts.total} alts.`, msg: results.onPage.imageAlts.message }
  ];

  onPageItems.forEach(item => {
    addPageIfNeeded(20);
    
    // Status box
    let statusText = '[OK]';
    let drawColor = [34, 197, 94]; // Green
    if (item.status === 'warning') {
      statusText = '[WARN]';
      drawColor = [245, 158, 11]; // Yellow
    } else if (item.status === 'error' || item.status === 'missing') {
      statusText = '[FAIL]';
      drawColor = [239, 68, 68]; // Red
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(drawColor[0], drawColor[1], drawColor[2]);
    doc.text(statusText, margin, y);

    doc.setTextColor(20, 20, 20);
    doc.text(item.name, margin + 20, y);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    
    // Wrap description message if too long
    const msgLines = doc.splitTextToSize(item.msg, contentWidth - 40);
    doc.text(msgLines, margin + 20, y + 4);

    if (item.detail) {
      doc.setFont('Courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110, 110, 110);
      const detailLines = doc.splitTextToSize(`Content: "${item.detail.slice(0, 120)}${item.detail.length > 120 ? '...' : ''}"`, contentWidth - 40);
      doc.text(detailLines, margin + 20, y + 4 + (msgLines.length * 4.2));
      y += (msgLines.length * 4.2) + (detailLines.length * 3.8);
    }

    y += 8;
  });

  // PageSpeed Performance Section (If populated)
  if (results.pageSpeedMobile || results.pageSpeedDesktop) {
    addPageIfNeeded(80);
    y += 4;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(10, 10, 10);
    doc.text('3. PageSpeed Insights Performance', margin, y);
    y += 6;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const renderDeviceStats = (title: string, metrics: PageSpeedMetric) => {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(title, margin, y);
      y += 6;

      // Score block
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, contentWidth, 14, 'F');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Performance Score:`, margin + 6, y + 9);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(metrics.score >= 90 ? 34 : (metrics.score >= 50 ? 245 : 239), metrics.score >= 90 ? 197 : (metrics.score >= 50 ? 158 : 68), metrics.score >= 90 ? 94 : (metrics.score >= 50 ? 11 : 68));
      doc.text(`${metrics.score}/100`, margin + 40, y + 9);

      // Core Web Vitals
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`LCP: ${metrics.lcp}   |   TBT: ${metrics.fid}   |   CLS: ${metrics.cls}`, margin + 70, y + 9);
      y += 18;

      // Opportunities
      if (metrics.recommendations.length > 0) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Key Improvement Opportunities:', margin, y);
        y += 5;

        metrics.recommendations.forEach((rec: { title: string; description: string; displayValue?: string }) => {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(50, 50, 50);
          doc.text(`• ${rec.title}`, margin + 4, y);
          if (rec.displayValue) {
            doc.setTextColor(150, 10, 10);
            doc.text(`(${rec.displayValue})`, margin + 110, y);
          }
          y += 4;
        });
        y += 4;
      }
    };

    if (results.pageSpeedDesktop) {
      renderDeviceStats('Desktop Audit Metrics', results.pageSpeedDesktop);
    }
    if (results.pageSpeedMobile) {
      addPageIfNeeded(60);
      renderDeviceStats('Mobile Audit Metrics', results.pageSpeedMobile);
    }
  }

  // Footer branding page number
  const totalPagesCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPagesCount; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${i} of ${totalPagesCount}`, pageWidth - margin - 15, pageHeight - 10);
    doc.text('Report powered by SelectSEO Auditor - Client-side Analytics Engine', margin, pageHeight - 10);
  }

  // Save the PDF
  const filename = `seo-audit-${results.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
  doc.save(filename);
}
