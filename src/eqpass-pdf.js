const PDFJS_VERSION = "6.2.108";
const PDFJS_BASE = new URL("../vendor/", import.meta.url).href.replace(/\/$/, "");
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 24;

const SCORE_LIMITS = Object.freeze({
  depression: 104,
  anxiety: 116,
  anger: 112,
  gpi: 420,
  phobicAvoidance: 40,
  obsessiveCompulsive: 40,
  psychoticism: 40,
  suicideRisk: 8,
  violenceRisk: 8
});

const SUBSCALE_LEVELS = Object.freeze({
  dysphoria: [2, 7, 10],
  "negative-cognition": [3, 11, 18],
  anhedonia: [3, 6, 9],
  apprehension: [5, 10, 15],
  "physiological-arousal": [1, 6, 11],
  "anger-out-verbal": [0, 3, 5]
});

const LEVELS = Object.freeze(["minimal", "mild", "moderate", "severe"]);
let pdfJsPromise;

function cleanText(value) {
  return String(value || "")
    .replaceAll("\u00a0", " ")
    .replaceAll(/[\t ]+/g, " ")
    .replaceAll(/\r/g, "")
    .replaceAll(/ *\n */g, "\n")
    .trim();
}

function scoreRows(text) {
  const rows = [];
  const expression = /(?:^|\n)\s*SCORES?\s+((?:\d{1,3}\s+){2,8}\d{1,3})(?=\s*(?:\n|$))/gim;
  for (const match of cleanText(text).matchAll(expression)) {
    rows.push(match[1].trim().split(/\s+/).map(Number));
  }
  return rows;
}

function pageFor(pages, heading) {
  return pages.find(page => heading.test(page)) || "";
}

function requiredRow(rows, index, length, label) {
  const row = rows[index];
  if (!row || row.length < length || row.slice(0, length).some(value => !Number.isInteger(value))) {
    throw new TypeError(`The ${label} score row could not be verified in this e-QPASS PDF.`);
  }
  return row.slice(0, length);
}

function checkedScore(value, field) {
  const maximum = SCORE_LIMITS[field];
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`The extracted ${field} score is outside the supported range.`);
  }
  return String(value);
}

function levelFor(score, limits) {
  const index = score <= limits[0] ? 0 : score <= limits[1] ? 1 : score <= limits[2] ? 2 : 3;
  return LEVELS[index];
}

function durationFromPages(pages) {
  const match = pages.join("\n").match(/(?:Test\s+)?Duration:\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})/i);
  if (!match) return "10:00";
  const hours = Number(match[1] || 0);
  const minutes = hours * 60 + Number(match[2]);
  return `${String(Math.min(minutes, 99)).padStart(2, "0")}:${match[3]}`;
}

function fallbackPrimaryScores(pages) {
  const all = cleanText(pages.join("\n"));
  const emotional = all.match(/(\d{1,3})\s+DEPRESSION SCORE\s+(\d{1,3})\s+ANXIETY SCORE\s+(\d{1,3})\s+ANGER SCORE/i);
  const gpi = all.match(/Global Psychopathology Index\s*\("?GPI"?\)?:\s*(\d{1,3})/i);
  return emotional && gpi ? [Number(emotional[1]), Number(emotional[2]), Number(emotional[3]), 0, Number(gpi[1])] : null;
}

export function parseEqpassScoreReport(pagesInput, { now = new Date() } = {}) {
  const pages = (Array.isArray(pagesInput) ? pagesInput : [pagesInput]).map(cleanText).filter(Boolean);
  if (!pages.length) throw new TypeError("This PDF does not contain selectable report text. Use the scored-form fields for a scanned report.");

  const scalePage = pageFor(pages, /Client Profile Report\s*-\s*Scale Analysis/i);
  const subscalePage = pageFor(pages, /Client Profile Report\s*-\s*Subscale Analysis/i);
  if (!scalePage || !subscalePage) {
    throw new TypeError("This does not match the e-QPASS scored report format. Choose the four-page Score Report Package or enter scores manually.");
  }

  const scaleRows = scoreRows(scalePage);
  const primary = scaleRows[0]?.length >= 5 ? requiredRow(scaleRows, 0, 5, "negative affect") : fallbackPrimaryScores(pages);
  if (!primary) throw new TypeError("The primary e-QPASS scores could not be verified in this PDF.");
  const clinical = requiredRow(scaleRows, 1, 5, "clinical and crisis");

  const subscaleRows = scoreRows(subscalePage);
  const depression = requiredRow(subscaleRows, 0, 5, "depression subscale");
  const anxiety = requiredRow(subscaleRows, 1, 3, "anxiety subscale");
  const anger = requiredRow(subscaleRows, 2, 6, "anger subscale");

  const subscaleScores = {
    dysphoria: depression[0],
    "negative-cognition": depression[2],
    anhedonia: depression[4],
    apprehension: anxiety[0],
    "physiological-arousal": anxiety[2],
    "anger-out-verbal": anger[4]
  };
  const values = {
    recordId: `PDF-${now.getTime().toString(36).toUpperCase()}`,
    completedAt: "Today · e-QPASS PDF test",
    duration: durationFromPages(pages),
    depression: checkedScore(primary[0], "depression"),
    anxiety: checkedScore(primary[1], "anxiety"),
    anger: checkedScore(primary[2], "anger"),
    gpi: checkedScore(primary[4], "gpi"),
    phobicAvoidance: checkedScore(clinical[0], "phobicAvoidance"),
    obsessiveCompulsive: checkedScore(clinical[1], "obsessiveCompulsive"),
    psychoticism: checkedScore(clinical[2], "psychoticism"),
    suicideRisk: checkedScore(clinical[3], "suicideRisk"),
    violenceRisk: checkedScore(clinical[4], "violenceRisk"),
    entrySource: "pdf"
  };
  for (const [id, score] of Object.entries(subscaleScores)) {
    values[`subscale-${id}-score`] = String(score);
    values[`subscale-${id}-level`] = levelFor(score, SUBSCALE_LEVELS[id]);
  }

  return {
    values,
    extractedFieldCount: 15,
    pageCount: pages.length,
    safetyHoldDetected: Number(values.suicideRisk) > 0 || Number(values.violenceRisk) > 0,
    format: "QPASS Client Profile Report",
    confidence: "verified-score-rows",
    ignoredIdentifiers: true
  };
}

function textItemsToLines(items) {
  const rows = [];
  for (const item of items || []) {
    const value = String(item?.str || "").trim();
    if (!value) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2.25);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, value });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => row.parts.sort((a, b) => a.x - b.x).map(part => part.value).join(" "))
    .join("\n");
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(`${PDFJS_BASE}/pdf.min.mjs`).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

export async function readEqpassPdfPages(file, { pdfjs, assetBase = PDFJS_BASE } = {}) {
  if (!(file instanceof Blob)) throw new TypeError("Choose an e-QPASS PDF file.");
  if (!/\.pdf$/i.test(String(file.name || "")) && file.type !== "application/pdf") throw new TypeError("Choose a PDF file.");
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new TypeError("The PDF must be between 1 byte and 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 5));
  if (header !== "%PDF-") throw new TypeError("The selected file is not a valid PDF.");

  const library = pdfjs || await loadPdfJs();
  const task = library.getDocument({
    data: bytes,
    cMapUrl: `${assetBase}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}/standard_fonts/`
  });
  const document = await task.promise;
  if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) {
    await document.destroy?.();
    await task.destroy?.();
    throw new TypeError("The e-QPASS score report must contain 1 to 24 pages.");
  }
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(textItemsToLines(content.items));
      page.cleanup();
    }
  } finally {
    await document.destroy?.();
    await task.destroy?.();
  }
  return pages;
}

export const EQPASS_PDF_CONTRACT = Object.freeze({
  pdfJsVersion: PDFJS_VERSION,
  maxBytes: MAX_PDF_BYTES,
  maxPages: MAX_PDF_PAGES,
  processing: "browser-only",
  retainsPdf: false,
  extractsIdentifiers: false,
  requiresScoreVerification: true
});
