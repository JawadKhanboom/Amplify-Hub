// Dependency-free generators for DOCX, XLSX, and PDF download artifacts.
// DOCX/XLSX are ZIP containers of XML; we build a valid "stored" (uncompressed)
// ZIP using Node's built-in zlib.crc32. PDF is written as plain text objects.
// No third-party libraries are required.

import zlib from 'node:zlib';

/* --------------------------------------------------------------- ZIP (store) */

function dosDateTime(date) {
  const d = date || new Date(2026, 6, 19, 12, 0, 0);
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const day = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, day };
}

// entries: [{ name, data: Buffer }]
export function zipStore(entries) {
  const { time, day } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = zlib.crc32(data) >>> 0;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    nameBuf.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* --------------------------------------------------------------- XML helpers */

export function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CATEGORY_LABELS = {
  script: 'Script', template: 'Template', cheatsheet: 'Cheat Sheet',
  worksheet: 'Worksheet', interview: 'Interview Prep'
};

const DRAFT_NOTICE = 'Draft resource pending human editorial review — not yet professionally verified.';

// Flatten a resource into an ordered list of blocks the generators can render.
// block: { kind:'title'|'meta'|'h'|'p'|'li'|'oli'|'th'|'tr'|'note'|'footer', text?, cells?, level? }
export function resourceBlocks(resource) {
  const blocks = [];
  blocks.push({ kind: 'title', text: resource.title });
  blocks.push({ kind: 'meta', text: `${CATEGORY_LABELS[resource.category] || resource.category} · Skill: ${resource.skill} · Difficulty: ${resource.difficulty} · Est. ${resource.duration} min` });
  blocks.push({ kind: 'note', text: DRAFT_NOTICE });
  blocks.push({ kind: 'p', text: resource.summary });

  blocks.push({ kind: 'h', text: 'Learning objectives' });
  (resource.objectives || []).forEach((o) => blocks.push({ kind: 'li', text: o }));

  (resource.sections || []).forEach((section) => {
    if (section.heading) blocks.push({ kind: 'h', text: section.heading });
    if (section.type === 'paragraph' && section.text) {
      blocks.push({ kind: 'p', text: section.text });
    } else if (section.type === 'list' && section.items) {
      section.items.forEach((item) => blocks.push({ kind: 'li', text: item }));
    } else if (section.type === 'steps' && section.items) {
      section.items.forEach((item, i) => blocks.push({ kind: 'oli', text: item, index: i + 1 }));
    } else if (section.type === 'fields' && section.items) {
      section.items.forEach((item) => blocks.push({ kind: 'li', text: `${item}: ______________________________` }));
    } else if (section.type === 'table' && section.columns) {
      blocks.push({ kind: 'th', cells: section.columns });
      (section.rows || []).forEach((row) => blocks.push({ kind: 'tr', cells: row }));
    }
  });

  if (resource.example) {
    const ex = resource.example;
    blocks.push({ kind: 'h', text: (ex && ex.title) || 'Worked example' });
    blocks.push({ kind: 'p', text: (ex && ex.text) || String(ex) });
  }
  if (resource.safePractice) {
    blocks.push({ kind: 'h', text: 'Safe-practice note' });
    blocks.push({ kind: 'p', text: resource.safePractice });
  }
  blocks.push({ kind: 'footer', text: `Last reviewed: ${resource.reviewDate || ''} · AmplifyHub Practical Resource Library` });
  return blocks;
}

/* ---------------------------------------------------------------------- DOCX */

function docxParagraph(text, opts) {
  const o = opts || {};
  const runProps = [];
  if (o.bold) runProps.push('<w:b/>');
  if (o.size) runProps.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
  if (o.color) runProps.push(`<w:color w:val="${o.color}"/>`);
  const rPr = runProps.length ? `<w:rPr>${runProps.join('')}</w:rPr>` : '';
  const pPr = o.spacingBefore || o.spacingAfter
    ? `<w:pPr><w:spacing${o.spacingBefore ? ` w:before="${o.spacingBefore}"` : ''}${o.spacingAfter ? ` w:after="${o.spacingAfter}"` : ''}/></w:pPr>`
    : '';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

export function buildDocx(resource) {
  const blocks = resourceBlocks(resource);
  const body = [];
  let pendingHeader = null;

  const flushTable = (rows) => {
    const grid = rows[0].cells.length;
    const colW = Math.floor(9000 / grid);
    const trs = rows.map((r, ri) => {
      const tcs = r.cells.map((c) => {
        const bold = ri === 0;
        return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/><w:tcBorders>` +
          `<w:top w:val="single" w:sz="4" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>` +
          `<w:left w:val="single" w:sz="4" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:color="CCCCCC"/>` +
          `</w:tcBorders></w:tcPr>${docxParagraph(c || ' ', { bold, size: 18 })}</w:tc>`;
      }).join('');
      return `<w:tr>${tcs}</w:tr>`;
    }).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>${trs}</w:tbl>`;
  };

  let tableRows = [];
  const flushPending = () => {
    if (tableRows.length) { body.push(flushTable(tableRows)); tableRows = []; }
  };

  for (const b of blocks) {
    if (b.kind === 'th' || b.kind === 'tr') { tableRows.push(b); continue; }
    flushPending();
    switch (b.kind) {
      case 'title': body.push(docxParagraph(b.text, { bold: true, size: 40, spacingAfter: 80 })); break;
      case 'meta': body.push(docxParagraph(b.text, { size: 18, color: '666666', spacingAfter: 60 })); break;
      case 'note': body.push(docxParagraph(b.text, { bold: true, size: 18, color: 'B26A00', spacingAfter: 120 })); break;
      case 'h': body.push(docxParagraph(b.text, { bold: true, size: 26, spacingBefore: 200, spacingAfter: 60 })); break;
      case 'p': body.push(docxParagraph(b.text, { size: 22, spacingAfter: 80 })); break;
      case 'li': body.push(docxParagraph(`•  ${b.text}`, { size: 22, spacingAfter: 40 })); break;
      case 'oli': body.push(docxParagraph(`${b.index}.  ${b.text}`, { size: 22, spacingAfter: 40 })); break;
      case 'footer': body.push(docxParagraph(b.text, { size: 16, color: '999999', spacingBefore: 200 })); break;
      default: break;
    }
  }
  flushPending();

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${body.join('')}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml }
  ]);
}

/* ---------------------------------------------------------------------- XLSX */

function xlsxCol(index) {
  let n = index;
  let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// Style indexes into styles.xml cellXfs: 0 default, 1 wrap+top, 2 bold, 3 bold+wrap.
function xlsxSheet(rows, opts) {
  const { widths = [], wrapCols = [], boldRows = [] } = opts || {};
  const boldSet = new Set(boldRows);
  const wrapSet = new Set(wrapCols);
  const colXml = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rowXml = rows.map((cells, r) => {
    const rowNum = r + 1;
    const cellXml = cells.map((value, c) => {
      const ref = `${xlsxCol(c)}${rowNum}`;
      const bold = boldSet.has(rowNum);
      const wrapText = wrapSet.has(c);
      const style = bold && wrapText ? 3 : bold ? 2 : wrapText ? 1 : 0;
      const sAttr = style ? ` s="${style}"` : '';
      if (value === '' || value == null) return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve"> </t></is></c>`;
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNum}">${cellXml}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${colXml}<sheetData>${rowXml}</sheetData></worksheet>`;
}

const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` +
  `</cellXfs></styleSheet>`;

export function buildXlsx(resource) {
  // Sheet 1: Instructions (flattened text). Sheet 2: Worksheet grid.
  const instructions = [];
  instructions.push([resource.title]);
  instructions.push([`${CATEGORY_LABELS[resource.category] || resource.category} · Skill: ${resource.skill} · Difficulty: ${resource.difficulty} · Est. ${resource.duration} min`]);
  instructions.push([DRAFT_NOTICE]);
  instructions.push(['']);
  instructions.push(['Summary', resource.summary]);
  instructions.push(['']);
  instructions.push(['Objectives']);
  (resource.objectives || []).forEach((o) => instructions.push(['', o]));
  instructions.push(['']);
  (resource.sections || []).forEach((section) => {
    if (section.type === 'table') return; // grid goes on the Worksheet sheet
    if (section.heading) instructions.push([section.heading]);
    if (section.type === 'paragraph' && section.text) instructions.push(['', section.text]);
    if ((section.type === 'list' || section.type === 'steps') && section.items) section.items.forEach((it) => instructions.push(['', it]));
    if (section.type === 'fields' && section.items) section.items.forEach((it) => instructions.push(['', `${it}:`, '']));
    instructions.push(['']);
  });
  if (resource.example) {
    instructions.push([(resource.example.title) || 'Worked example']);
    instructions.push(['', (resource.example.text) || String(resource.example)]);
    instructions.push(['']);
  }
  if (resource.safePractice) {
    instructions.push(['Safe-practice note']);
    instructions.push(['', resource.safePractice]);
    instructions.push(['']);
  }
  instructions.push([`Last reviewed: ${resource.reviewDate || ''} · AmplifyHub Practical Resource Library`]);

  // Worksheet grid: prefer an explicit sheet, else the first table section, else objectives.
  let gridRows = [];
  if (resource.sheet && resource.sheet.columns) {
    gridRows.push(resource.sheet.columns);
    (resource.sheet.rows || []).forEach((r) => gridRows.push(r));
    const blanks = resource.sheet.blankRows || 8;
    for (let i = 0; i < blanks; i++) gridRows.push(resource.sheet.columns.map(() => ''));
  } else {
    const table = (resource.sections || []).find((s) => s.type === 'table');
    if (table) {
      gridRows.push(table.columns);
      (table.rows || []).forEach((r) => gridRows.push(r));
      for (let i = 0; i < 8; i++) gridRows.push(table.columns.map(() => ''));
    } else {
      gridRows.push(['Item', 'Your notes']);
      (resource.objectives || []).forEach((o) => gridRows.push([o, '']));
    }
  }

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Worksheet" sheetId="2" r:id="rId2"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  // Column widths so nothing opens cramped: grid widths follow content; the
  // Instructions sheet keeps a narrow label column and a wide wrapped text column.
  // Columns that only carry a header are fill-in columns — keep them wide to type in.
  const gridWidths = gridRows[0].map((_, c) => {
    const maxLen = Math.max(...gridRows.map((row) => String(row[c] || '').length));
    const hasData = gridRows.slice(1).some((row) => String(row[c] || '').trim().length > 0);
    if (!hasData) return 42;
    return Math.min(Math.max(maxLen + 4, 14), 46);
  });

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: XLSX_STYLES },
    { name: 'xl/worksheets/sheet1.xml', data: xlsxSheet(instructions, { widths: [26, 80, 18], wrapCols: [1], boldRows: [1] }) },
    { name: 'xl/worksheets/sheet2.xml', data: xlsxSheet(gridRows, { widths: gridWidths, wrapCols: gridRows[0].map((_, c) => c), boldRows: [1] }) }
  ]);
}

/* ----------------------------------------------------------------------- PDF */

function pdfAscii(text) {
  return String(text == null ? '' : text)
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[→⇒]/g, '->')
    .replace(/•/g, '-')
    .replace(/·/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E]/g, '');
}

function pdfEscape(text) {
  return pdfAscii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text, max) {
  const words = pdfAscii(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line.length) { line = word; continue; }
    if ((line + ' ' + word).length <= max) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [''];
}

export function buildPdf(resource) {
  const blocks = resourceBlocks(resource);
  // Printable worksheets: extend the first table with ruled blank rows so the
  // printed PDF can actually be filled in by hand (mirrors the XLSX blank rows).
  if (resource.sheet && resource.sheet.columns) {
    const thIndex = blocks.findIndex((b) => b.kind === 'th');
    if (thIndex !== -1) {
      let end = thIndex + 1;
      while (end < blocks.length && blocks[end].kind === 'tr') end++;
      const blanks = Math.min(resource.sheet.blankRows || 8, 8);
      const emptyRows = [];
      for (let i = 0; i < blanks; i++) {
        emptyRows.push({ kind: 'tr', cells: blocks[thIndex].cells.map(() => '') });
      }
      blocks.splice(end, 0, ...emptyRows);
    }
  }

  // Page geometry (A4-ish in points).
  const pageW = 595, pageH = 842, marginX = 56, top = 786, bottom = 64;
  const pages = [];
  let current = { lines: [], rules: [] };
  let y = top;

  const breakPage = () => { pages.push(current); current = { lines: [], rules: [] }; y = top; };
  const pushLine = (segments, gapAfter) => {
    if (y < bottom) breakPage();
    current.lines.push({ y, segments });
    y -= gapAfter;
  };

  const textBlock = (text, { font = 'F1', size = 10.5, gap = 14, indent = 0, maxChars = 88 } = {}) => {
    const lines = wrap(text, maxChars);
    lines.forEach((ln) => pushLine([{ font, size, x: marginX + indent, text: ln }], gap));
  };

  let tableRows = [];
  const flushTable = () => {
    if (!tableRows.length) return;
    const cols = tableRows[0].cells.length;
    const usable = pageW - marginX * 2;
    const colW = usable / cols;
    const maxCharsPerCol = Math.max(8, Math.floor((colW / (10.5 * 0.5)) - 1));
    tableRows.forEach((r, ri) => {
      const isBlankRow = ri > 0 && r.cells.every((c) => !c || !String(c).trim());
      if (isBlankRow) {
        // Ruled empty row for handwriting on the printed sheet.
        if (y - 22 < bottom) breakPage();
        y -= 22;
        current.rules.push({ y: y + 6, dark: false });
        return;
      }
      // Wrap each cell, align rows by the tallest cell.
      const wrapped = r.cells.map((c) => wrap(c || ' ', maxCharsPerCol));
      const height = Math.max(...wrapped.map((w) => w.length));
      for (let lineIdx = 0; lineIdx < height; lineIdx++) {
        if (y < bottom) breakPage();
        const segments = wrapped.map((w, ci) => ({
          font: ri === 0 ? 'F2' : 'F1', size: 9.5,
          x: marginX + ci * colW, text: w[lineIdx] || ''
        }));
        current.lines.push({ y, segments });
        y -= 12;
      }
      y -= 3;
      current.rules.push({ y: y + 6, dark: ri === 0 });
    });
    y -= 8;
    tableRows = [];
  };

  for (const b of blocks) {
    if (b.kind === 'th' || b.kind === 'tr') { tableRows.push(b); continue; }
    flushTable();
    switch (b.kind) {
      case 'title': textBlock(b.text, { font: 'F2', size: 19, gap: 24, maxChars: 46 }); break;
      case 'meta': textBlock(b.text, { font: 'F1', size: 9.5, gap: 14, maxChars: 100 }); break;
      case 'note': textBlock(b.text, { font: 'F2', size: 9.5, gap: 18, maxChars: 96 }); break;
      case 'h': y -= 6; textBlock(b.text, { font: 'F2', size: 13, gap: 17, maxChars: 70 }); break;
      case 'p': textBlock(b.text, { font: 'F1', size: 10.5, gap: 14 }); y -= 4; break;
      case 'li': textBlock(`-  ${b.text}`, { font: 'F1', size: 10.5, gap: 14, indent: 10, maxChars: 84 }); break;
      case 'oli': textBlock(`${b.index}.  ${b.text}`, { font: 'F1', size: 10.5, gap: 14, indent: 10, maxChars: 84 }); break;
      case 'footer': y -= 10; textBlock(b.text, { font: 'F1', size: 8.5, gap: 12, maxChars: 110 }); break;
      default: break;
    }
  }
  flushTable();
  if (current.lines.length || current.rules.length) pages.push(current);
  if (!pages.length) pages.push({ lines: [{ y: top, segments: [{ font: 'F1', size: 10.5, x: marginX, text: '' }] }], rules: [] });

  // Serialize PDF objects.
  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const catalogNum = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesNum = addObject(''); // placeholder, filled after we know kids
  const fontNum = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldNum = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageNums = [];
  for (const page of pages) {
    let stream = 'BT\n';
    let curFont = '';
    let curSize = 0;
    for (const line of page.lines) {
      for (const seg of line.segments) {
        if (!seg.text) continue;
        if (seg.font !== curFont || seg.size !== curSize) {
          stream += `/${seg.font} ${seg.size} Tf\n`;
          curFont = seg.font; curSize = seg.size;
        }
        stream += `1 0 0 1 ${seg.x.toFixed(1)} ${line.y.toFixed(1)} Tm (${pdfEscape(seg.text)}) Tj\n`;
      }
    }
    stream += 'ET';
    // Table rules (light gray under rows, darker under headers) after the text block.
    if (page.rules.length) {
      stream += '\n0.7 w\n';
      for (const rule of page.rules) {
        stream += `${rule.dark ? '0.45' : '0.8'} G ${marginX} ${rule.y.toFixed(1)} m ${(pageW - marginX).toFixed(1)} ${rule.y.toFixed(1)} l S\n`;
      }
    }
    const contentNum = addObject(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageNum = addObject(
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /Font << /F1 ${fontNum} 0 R /F2 ${fontBoldNum} 0 R >> >> /Contents ${contentNum} 0 R >>`
    );
    pageNums.push(pageNum);
  }

  objects[pagesNum - 1] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`;

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}
