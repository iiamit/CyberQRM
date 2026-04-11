/**
 * Client-side report generator using HTML/print-to-PDF approach.
 * Generates both Executive Summary and Technical Deep-Dive reports.
 */
import { RiskScenario, Portfolio, SensitivityResult } from '@shared/types/fair';
import { formatCurrency, formatPct } from './formatting';

function fmt(n: number | undefined | null) {
  return formatCurrency(n ?? 0);
}

const CSS = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111827; margin: 0; padding: 0; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; font-weight: 700; color: #0369a1; margin-bottom: 4px; }
  h2 { font-size: 18px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-top: 32px; color: #374151; }
  h3 { font-size: 14px; font-weight: 600; color: #374151; margin-top: 16px; }
  .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 32px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
  .kpi { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; }
  .kpi .val { font-size: 24px; font-weight: 700; color: #0369a1; }
  .kpi .lbl { font-size: 11px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f9fafb; text-align: left; padding: 8px 10px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  .risk-bar { height: 6px; background: #fee2e2; border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .risk-fill { height: 100%; background: #ef4444; border-radius: 3px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-critical { background: #fee2e2; color: #dc2626; }
  .badge-high     { background: #ffedd5; color: #ea580c; }
  .badge-medium   { background: #fef9c3; color: #ca8a04; }
  .badge-low      { background: #dcfce7; color: #16a34a; }
  .ci-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
  .section-note { font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
`;

export function generateExecutiveReport(
  scenarios: RiskScenario[],
  portfolio?: Portfolio,
  sensitivity?: SensitivityResult[][]
): string {
  const totalALE = scenarios.reduce((s, sc) => s + (sc.latestSimulation?.statistics?.mean ?? 0), 0);
  const title = portfolio ? `Portfolio Executive Summary: ${portfolio.name}` : `Executive Risk Summary`;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const maxALE = Math.max(...scenarios.map(s => s.latestSimulation?.statistics?.mean ?? 0), 1);

  const topScenarios = [...scenarios]
    .filter(s => s.latestSimulation)
    .sort((a, b) => (b.latestSimulation!.statistics.mean) - (a.latestSimulation!.statistics.mean))
    .slice(0, 5);

  const ci90 = scenarios.reduce(
    (acc, s) => {
      const ci = s.latestSimulation?.statistics?.confidenceIntervals?.['90'];
      if (ci) { acc.lower += ci.lower; acc.upper += ci.upper; }
      return acc;
    },
    { lower: 0, upper: 0 }
  );

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head>
<body><div class="page">
  <h1>${title}</h1>
  <p class="subtitle">Generated ${date} · FAIR v3.1 Methodology · Monte Carlo Simulation (10,000 iterations)</p>

  <h2>Portfolio Risk Summary</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${fmt(totalALE)}</div><div class="lbl">Total Portfolio ALE (Mean)</div></div>
    <div class="kpi"><div class="val">${scenarios.length}</div><div class="lbl">Risk Scenarios Analyzed</div></div>
    <div class="kpi"><div class="val">${topScenarios[0] ? fmt(topScenarios[0].latestSimulation!.statistics.mean) : '—'}</div><div class="lbl">Highest Single Risk ALE</div></div>
  </div>

  ${ci90.upper > 0 ? `<div class="ci-box">
    <strong>90% Confidence Interval:</strong> There is a 90% probability that annual losses will fall between
    <strong>${fmt(ci90.lower)}</strong> and <strong>${fmt(ci90.upper)}</strong>.
  </div>` : ''}

  <h2>Top Risk Scenarios</h2>
  <table>
    <thead><tr><th>#</th><th>Scenario</th><th>Asset</th><th>Mean ALE</th><th>90th Pct.</th><th>% of Portfolio</th></tr></thead>
    <tbody>
      ${topScenarios.map((s, i) => {
        const ale = s.latestSimulation!.statistics.mean;
        const p90 = s.latestSimulation!.statistics.percentiles?.['90'] ?? 0;
        const pct = totalALE > 0 ? ((ale / totalALE) * 100).toFixed(1) : '0';
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${s.name}</strong></td>
          <td style="font-size:11px;color:#6b7280">${s.assetDescription ?? ''}</td>
          <td><strong>${fmt(ale)}</strong></td>
          <td>${fmt(p90)}</td>
          <td>${pct}%</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  ${portfolio?.portfolioAnalysis?.commonThreats?.length ? `
  <h2>Common Threat Patterns</h2>
  <table>
    <thead><tr><th>Threat</th><th>Affected Scenarios</th><th>Combined ALE</th><th>Priority</th></tr></thead>
    <tbody>
      ${portfolio.portfolioAnalysis.commonThreats.slice(0, 5).map(t => `<tr>
        <td>${t.threatDescription}</td>
        <td>${t.affectedScenarios.length}</td>
        <td>${fmt(t.combinedALE)}</td>
        <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <h2>Recommended Actions</h2>
  <p>Based on the risk quantification analysis, the following priorities are recommended:</p>
  <ol style="font-size:13px;line-height:1.8">
    <li>Address <strong>${topScenarios[0]?.name ?? 'top risk scenario'}</strong> — highest contribution to portfolio ALE (${fmt(topScenarios[0]?.latestSimulation?.statistics?.mean)})</li>
    <li>Identify and implement controls targeting the highest-variance FAIR components (see sensitivity analysis in technical report)</li>
    <li>Review vulnerability levels across scenarios — opportunity for shared controls to reduce multiple risks simultaneously</li>
    <li>Prioritize controls with highest 3-year ROI to maximize loss reduction per dollar invested</li>
  </ol>

  <p class="section-note">This report was generated by CyberQRM using the FAIR (Factor Analysis of Information Risk) v3.1 methodology.
  All ALE estimates are based on Monte Carlo simulation with 10,000 iterations. These are probabilistic estimates, not guarantees.</p>
</div></body></html>`;
}

export function generateTechnicalReport(
  scenarios: RiskScenario[],
  portfolio?: Portfolio,
  sensitivity?: SensitivityResult[][]
): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = portfolio ? `Technical Risk Report: ${portfolio.name}` : 'Technical Risk Report';

  const scenarioSections = scenarios.map((s, idx) => {
    const sim = s.latestSimulation;
    const st = sim?.statistics;
    return `
    <h2>Scenario ${idx + 1}: ${s.name}</h2>
    <p style="font-size:13px;color:#6b7280">${s.assetDescription ?? ''} | ${s.businessContext ?? ''}</p>

    <h3>FAIR Components</h3>
    <table>
      <thead><tr><th>Component</th><th>Type</th><th>Parameters</th><th>Unit</th></tr></thead>
      <tbody>
        ${s.threatEventFrequency ? `<tr><td><strong>Threat Event Frequency (TEF)</strong></td><td>${s.threatEventFrequency.distributionType}</td><td><code>${JSON.stringify(s.threatEventFrequency.parameters)}</code></td><td>events/year</td></tr>` : '<tr><td colspan="4" style="color:#ef4444">TEF not defined</td></tr>'}
        ${s.vulnerability ? `<tr><td><strong>Vulnerability (V)</strong></td><td>${s.vulnerability.distributionType}</td><td><code>${JSON.stringify(s.vulnerability.parameters)}</code></td><td>probability 0–1</td></tr>` : '<tr><td colspan="4" style="color:#ef4444">Vulnerability not defined</td></tr>'}
        ${s.assetValue ? `<tr><td><strong>Asset Value (AV)</strong></td><td>${s.assetValue.distributionType}</td><td><code>${JSON.stringify(s.assetValue.parameters)}</code></td><td>USD</td></tr>` : '<tr><td colspan="4" style="color:#ef4444">Asset Value not defined</td></tr>'}
        ${s.lossEventImpact ? `<tr><td><strong>Loss Event Impact (LI)</strong></td><td>${s.lossEventImpact.distributionType}</td><td><code>${JSON.stringify(s.lossEventImpact.parameters)}</code></td><td>proportion 0–1</td></tr>` : '<tr><td colspan="4" style="color:#ef4444">Loss Event Impact not defined</td></tr>'}
      </tbody>
    </table>

    ${st ? `
    <h3>Simulation Results</h3>
    <table>
      <thead><tr><th>Statistic</th><th>Value</th><th>Statistic</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Mean ALE</td><td><strong>${fmt(st.mean)}</strong></td><td>P50 (Median)</td><td>${fmt(st.median)}</td></tr>
        <tr><td>Std Deviation</td><td>${fmt(st.stdDev)}</td><td>Min</td><td>${fmt(st.min)}</td></tr>
        <tr><td>P75</td><td>${fmt(st.percentiles?.['75'])}</td><td>Max</td><td>${fmt(st.max)}</td></tr>
        <tr><td>P90</td><td>${fmt(st.percentiles?.['90'])}</td><td>P95</td><td>${fmt(st.percentiles?.['95'])}</td></tr>
        <tr><td>90% CI Lower</td><td>${fmt(st.confidenceIntervals?.['90']?.lower)}</td><td>90% CI Upper</td><td>${fmt(st.confidenceIntervals?.['90']?.upper)}</td></tr>
      </tbody>
    </table>
    <p style="font-size:12px;color:#9ca3af">
      Simulation config: ${sim?.simulationConfig?.iterations?.toLocaleString() ?? 10000} iterations.
      Convergence: ${sim?.convergenceMetrics?.meanStabilized ? 'Mean stabilized ✓' : 'Consider more iterations'}.
    </p>` : '<p style="color:#ef4444;font-size:13px">Simulation not yet run for this scenario.</p>'}
    `;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head>
<body><div class="page">
  <h1>${title}</h1>
  <p class="subtitle">Generated ${date} · FAIR v3.1 Methodology · Technical Deep-Dive</p>

  <h2>Methodology Overview</h2>
  <p style="font-size:13px;line-height:1.7">
    This report implements the <strong>FAIR (Factor Analysis of Information Risk) v3.1</strong> methodology.
    Risk is decomposed into Loss Event Frequency (LEF = TEF × Vulnerability) and Loss Magnitude (LM = Asset Value × Loss Event Impact).
    Annualized Loss Expectancy (ALE) is calculated as LEF × LM per iteration.
    A Monte Carlo simulation samples each parameter from its specified distribution across 10,000 iterations to produce a probability distribution of ALE.
  </p>
  <table style="font-size:12px">
    <thead><tr><th>Component</th><th>Symbol</th><th>Definition</th><th>Formula</th></tr></thead>
    <tbody>
      <tr><td>Threat Event Frequency</td><td>TEF</td><td>Attempts per year by threat actor</td><td>Input distribution</td></tr>
      <tr><td>Vulnerability</td><td>V</td><td>P(success | attempt), 0–1</td><td>Input distribution</td></tr>
      <tr><td>Loss Event Frequency</td><td>LEF</td><td>Successful events per year</td><td>TEF × V</td></tr>
      <tr><td>Asset Value</td><td>AV</td><td>Monetary value at risk (USD)</td><td>Input distribution</td></tr>
      <tr><td>Loss Event Impact</td><td>LI</td><td>Proportion of AV lost per event, 0–1</td><td>Input distribution</td></tr>
      <tr><td>Loss Magnitude</td><td>LM</td><td>Dollar loss per event</td><td>AV × LI</td></tr>
      <tr><td>Annualized Loss Expectancy</td><td>ALE</td><td>Expected annual dollar loss</td><td>LEF × LM</td></tr>
    </tbody>
  </table>

  ${scenarioSections}

  ${portfolio?.portfolioAnalysis ? `
  <h2>Portfolio Aggregation</h2>
  <p style="font-size:13px">Total Portfolio ALE: <strong>${fmt(portfolio.portfolioAnalysis.totalALE)}</strong></p>
  ${portfolio.portfolioAnalysis.commonThreats.length ? `
  <h3>Common Threat Patterns</h3>
  <table>
    <thead><tr><th>Threat Description</th><th>Scenarios</th><th>Combined ALE</th></tr></thead>
    <tbody>${portfolio.portfolioAnalysis.commonThreats.map(t =>
      `<tr><td>${t.threatDescription}</td><td>${t.affectedScenarios.length}</td><td>${fmt(t.combinedALE)}</td></tr>`
    ).join('')}</tbody>
  </table>` : ''}` : ''}

  <h2>Glossary</h2>
  <dl style="font-size:12px;line-height:1.8">
    <dt><strong>ALE (Annualized Loss Expectancy)</strong></dt><dd>Expected monetary loss per year from a given risk scenario.</dd>
    <dt><strong>Confidence Interval (CI)</strong></dt><dd>Range within which the true ALE is expected to fall with a given probability.</dd>
    <dt><strong>Monte Carlo Simulation</strong></dt><dd>Statistical method using repeated random sampling to estimate outcome distributions.</dd>
    <dt><strong>TEF (Threat Event Frequency)</strong></dt><dd>Expected number of threat events per year.</dd>
    <dt><strong>Vulnerability</strong></dt><dd>Probability a threat event succeeds given an attempt (0–1).</dd>
  </dl>

  <p class="section-note">Generated by CyberQRM · FAIR v3.1 · For authorized internal use only.</p>
</div></body></html>`;
}

export function printReport(html: string, filename: string) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate reports.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}
