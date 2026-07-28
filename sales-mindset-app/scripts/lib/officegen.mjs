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

const DRAFT_NOTICE = 'Draft resource pending human editorial review - not yet professionally verified.';
const REVIEWED_NOTICE = 'Reviewed professional resource - AmplifyHub Practical Resource Library';

// Flatten a resource into an ordered list of blocks the generators can render.
// block: { kind:'title'|'meta'|'h'|'p'|'li'|'oli'|'th'|'tr'|'note'|'footer', text?, cells?, level? }
export function resourceBlocks(resource) {
  const blocks = [];
  blocks.push({ kind: 'title', text: resource.title });
  blocks.push({ kind: 'meta', text: `${CATEGORY_LABELS[resource.category] || resource.category} | Skill: ${resource.skill} | Difficulty: ${resource.difficulty} | Est. ${resource.duration} min` });
  blocks.push({ kind: 'note', text: resource.status === 'reviewed' ? REVIEWED_NOTICE : DRAFT_NOTICE });
  blocks.push({ kind: 'h', text: 'Overview' });
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
  blocks.push({ kind: 'footer', text: `Last reviewed: ${resource.reviewDate || ''} | AmplifyHub Practical Resource Library` });
  return blocks;
}

/* ---------------------------------------------------------------------- DOCX */

function docxParagraph(text, opts) {
  const o = opts || {};
  const pProps = [];
  const runProps = [
    `<w:rFonts w:ascii="${escapeXml(o.font || 'Calibri')}" w:hAnsi="${escapeXml(o.font || 'Calibri')}"/>`
  ];
  if (o.style) pProps.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) pProps.push('<w:keepNext/>');
  if (o.numId) {
    pProps.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`);
  }
  if (o.spacingBefore || o.spacingAfter || o.line) {
    pProps.push(`<w:spacing${o.spacingBefore ? ` w:before="${o.spacingBefore}"` : ''}${o.spacingAfter ? ` w:after="${o.spacingAfter}"` : ''}${o.line ? ` w:line="${o.line}" w:lineRule="auto"` : ''}/>`);
  }
  if (o.shading) pProps.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shading}"/>`);
  if (o.indentLeft) pProps.push(`<w:ind w:left="${o.indentLeft}"/>`);
  if (o.bold) runProps.push('<w:b/>');
  if (o.italic) runProps.push('<w:i/>');
  if (o.size) runProps.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
  if (o.color) runProps.push(`<w:color w:val="${o.color}"/>`);
  return `<w:p>${pProps.length ? `<w:pPr>${pProps.join('')}</w:pPr>` : ''}` +
    `<w:r><w:rPr>${runProps.join('')}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function docxColumnWidths(rows) {
  const columns = rows[0].cells.length;
  const weights = Array.from({ length: columns }, (_, column) => {
    const max = Math.max(...rows.map((row) => String(row.cells[column] || '').length));
    return Math.min(Math.max(max, 12), 44);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  const widths = weights.map((weight) => Math.max(1200, Math.floor((weight / total) * 9360)));
  const difference = 9360 - widths.reduce((sum, value) => sum + value, 0);
  widths[widths.length - 1] += difference;
  return widths;
}

function docxTable(rows) {
  const widths = docxColumnWidths(rows);
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((edge) => `<w:${edge} w:val="single" w:sz="4" w:color="D9DEE7"/>`)
    .join('');
  const trs = rows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const tcs = row.cells.map((cell, column) => {
      const cellProps = `<w:tcPr><w:tcW w:w="${widths[column]}" w:type="dxa"/>` +
        `<w:vAlign w:val="center"/>${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF3C4"/>' : ''}</w:tcPr>`;
      return `<w:tc>${cellProps}${docxParagraph(cell || ' ', {
        bold: isHeader,
        size: 19,
        color: isHeader ? '6B4F00' : '283548',
        spacingAfter: 40,
        line: 280
      })}</w:tc>`;
    }).join('');
    return `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${tcs}</w:tr>`;
  }).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>` +
    `<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblBorders>${borders}</w:tblBorders></w:tblPr>` +
    `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${trs}</w:tbl>`;
}

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>` +
  `<w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr>` +
  `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="283548"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>` +
  `<w:pPr><w:keepNext/><w:spacing w:after="120"/></w:pPr>` +
  `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="56"/><w:color w:val="172033"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/>` +
  `<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr>` +
  `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="30"/><w:color w:val="8A6200"/></w:rPr></w:style>` +
  `</w:styles>`;

const DOCX_NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>` +
  `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>` +
  `<w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/>` +
  `<w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>` +
  `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>` +
  `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>` +
  `<w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/>` +
  `<w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum>` +
  `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>` +
  `</w:numbering>`;

export function buildDocx(resource) {
  const blocks = resourceBlocks(resource);
  const body = [];
  let tableRows = [];
  const flushPending = () => {
    if (tableRows.length) {
      body.push(docxTable(tableRows));
      body.push(docxParagraph('', { spacingAfter: 80 }));
      tableRows = [];
    }
  };

  for (const block of blocks) {
    if (block.kind === 'th' || block.kind === 'tr') {
      tableRows.push(block);
      continue;
    }
    flushPending();
    switch (block.kind) {
      case 'title':
        body.push(docxParagraph(block.text, { style: 'Title' }));
        break;
      case 'meta':
        body.push(docxParagraph(block.text.toUpperCase(), { bold: true, size: 18, color: '6B7280', spacingAfter: 100 }));
        break;
      case 'note':
        body.push(docxParagraph(block.text, {
          bold: true,
          size: 18,
          color: resource.status === 'reviewed' ? '166534' : '9A5B00',
          shading: resource.status === 'reviewed' ? 'EAF7EF' : 'FFF4E5',
          indentLeft: 160,
          spacingBefore: 40,
          spacingAfter: 160
        }));
        break;
      case 'h':
        body.push(docxParagraph(block.text, { style: 'Heading1', keepNext: true }));
        break;
      case 'p':
        body.push(docxParagraph(block.text, { size: 22, color: '283548', spacingAfter: 120, line: 300 }));
        break;
      case 'li':
        body.push(docxParagraph(block.text, { numId: 1, size: 22, color: '283548', spacingAfter: 80, line: 300 }));
        break;
      case 'oli':
        body.push(docxParagraph(block.text, { numId: 2, size: 22, color: '283548', spacingAfter: 80, line: 300 }));
        break;
      case 'footer':
        body.push(docxParagraph(block.text, { size: 17, color: '7B8494', spacingBefore: 240, spacingAfter: 40 }));
        break;
      default:
        break;
    }
  }
  flushPending();

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${body.join('')}` +
    `<w:sectPr><w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/>` +
    `<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `${docxParagraph('AMPLIFYHUB  |  PRACTICAL RESOURCE LIBRARY', { bold: true, size: 16, color: '8A6200', spacingAfter: 40 })}</w:hdr>`;
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="7B8494"/><w:sz w:val="16"/></w:rPr>` +
    `<w:t>AmplifyHub  |  Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="7B8494"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
    `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
    `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
    `</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>` +
    `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
    `</Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: documentRels },
    { name: 'word/styles.xml', data: DOCX_STYLES },
    { name: 'word/numbering.xml', data: DOCX_NUMBERING },
    { name: 'word/header1.xml', data: headerXml },
    { name: 'word/footer1.xml', data: footerXml }
  ]);
}

/* ---------------------------------------------------------------------- XLSX */

function xlsxCol(index) {
  let n = index;
  let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// Style indexes into styles.xml cellXfs:
// 0 default, 1 wrapped body, 2 bold, 3 bold wrapped, 4 title, 5 metadata,
// 6 reviewed/draft status, 7 section label, 8 table header, 9 editable cell.
function xlsxSheet(rows, opts) {
  const {
    widths = [], wrapCols = [], boldRows = [], rowStyles = {}, rowHeights = {},
    freezeRows = 0, showGridLines = false, autoFilter = '', merges = []
  } = opts || {};
  const boldSet = new Set(boldRows);
  const wrapSet = new Set(wrapCols);
  const colXml = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rowXml = rows.map((cells, r) => {
    const rowNum = r + 1;
    const rowStyle = rowStyles[rowNum];
    const height = rowHeights[rowNum];
    const cellXml = cells.map((value, c) => {
      const ref = `${xlsxCol(c)}${rowNum}`;
      const bold = boldSet.has(rowNum);
      const wrapText = wrapSet.has(c);
      const style = rowStyle == null ? (bold && wrapText ? 3 : bold ? 2 : wrapText ? 1 : 0) : rowStyle;
      const sAttr = style ? ` s="${style}"` : '';
      if (value === '' || value == null) return `<c r="${ref}"${sAttr}/>`;
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNum}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cellXml}</row>`;
  }).join('');
  const pane = freezeRows
    ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : '';
  const sheetViews = `<sheetViews><sheetView showGridLines="${showGridLines ? '1' : '0'}" workbookViewId="0">${pane}</sheetView></sheetViews>`;
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${sheetViews}${colXml}<sheetData>${rowXml}</sheetData>${mergeXml}${autoFilter ? `<autoFilter ref="${autoFilter}"/>` : ''}</worksheet>`;
}

const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="6">` +
  `<font><sz val="11"/><color rgb="FF283548"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF283548"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF6B4F00"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="10"/><color rgb="FF166534"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF172033"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF4C84A"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D8"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEAF7EF"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FFD9DEE7"/></left><right style="thin"><color rgb="FFD9DEE7"/></right>` +
  `<top style="thin"><color rgb="FFD9DEE7"/></top><bottom style="thin"><color rgb="FFD9DEE7"/></bottom><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="10">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="5" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` +
  `</cellXfs></styleSheet>`;

export function buildXlsx(resource) {
  // Sheet 1: Instructions (flattened text). Sheet 2: Worksheet grid.
  const instructions = [];
  const instructionStyles = {};
  const instructionHeights = {};
  const addInstruction = (cells, style, height) => {
    instructions.push(cells);
    const row = instructions.length;
    if (style != null) instructionStyles[row] = style;
    if (height) instructionHeights[row] = height;
  };
  addInstruction([resource.title, '', ''], 4, 32);
  addInstruction([
    `${CATEGORY_LABELS[resource.category] || resource.category} | Skill: ${resource.skill} | Difficulty: ${resource.difficulty} | Est. ${resource.duration} min`,
    '',
    ''
  ], 5, 24);
  addInstruction([resource.status === 'reviewed' ? REVIEWED_NOTICE : DRAFT_NOTICE, '', ''], 6, 26);
  addInstruction(['', '', '']);
  addInstruction(['Summary', '', ''], 7, 24);
  addInstruction(['', resource.summary, ''], 1);
  addInstruction(['', '', '']);
  addInstruction(['Learning objectives', '', ''], 7, 24);
  (resource.objectives || []).forEach((objective) => addInstruction(['', objective, ''], 1));
  addInstruction(['', '', '']);
  (resource.sections || []).forEach((section) => {
    if (section.heading) addInstruction([section.heading, '', ''], 7, 24);
    if (section.type === 'table') {
      addInstruction(section.columns || [], 8, 28);
      (section.rows || []).forEach((row) => addInstruction(row, 9));
      addInstruction(['', '', '']);
      return;
    }
    if (section.type === 'paragraph' && section.text) addInstruction(['', section.text, ''], 1);
    if ((section.type === 'list' || section.type === 'steps') && section.items) {
      section.items.forEach((item) => addInstruction(['', item, ''], 1));
    }
    if (section.type === 'fields' && section.items) {
      section.items.forEach((item) => addInstruction(['', `${item}:`, ''], 1));
    }
    addInstruction(['', '', '']);
  });
  if (resource.example) {
    addInstruction([(resource.example.title) || 'Worked example', '', ''], 7, 24);
    addInstruction(['', (resource.example.text) || String(resource.example), ''], 1);
    addInstruction(['', '', '']);
  }
  if (resource.safePractice) {
    addInstruction(['Safe-practice note', '', ''], 7, 24);
    addInstruction(['', resource.safePractice, ''], 1);
    addInstruction(['', '', '']);
  }
  addInstruction([`Last reviewed: ${resource.reviewDate || ''} | AmplifyHub Practical Resource Library`, '', ''], 5);

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
    {
      name: 'xl/worksheets/sheet1.xml',
      data: xlsxSheet(instructions, {
        widths: [24, 62, 42],
        wrapCols: [0, 1, 2],
        rowStyles: instructionStyles,
        rowHeights: instructionHeights,
        freezeRows: 3,
        merges: ['A1:C1', 'A2:C2', 'A3:C3']
      })
    },
    {
      name: 'xl/worksheets/sheet2.xml',
      data: xlsxSheet(gridRows, {
        widths: gridWidths,
        wrapCols: gridRows[0].map((_, c) => c),
        rowStyles: Object.fromEntries(gridRows.map((_, index) => [index + 1, index === 0 ? 8 : 9])),
        rowHeights: { 1: 30 },
        freezeRows: 1,
        autoFilter: `A1:${xlsxCol(gridRows[0].length - 1)}${gridRows.length}`
      })
    }
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

  // Page geometry: US Letter with a compact reference-guide header/footer.
  const pageW = 612, pageH = 792, marginX = 58, top = 724, bottom = 58;
  const pages = [];
  let current = { lines: [], rules: [] };
  let y = top;

  const breakPage = () => { pages.push(current); current = { lines: [], rules: [] }; y = top; };
  const pushLine = (segments, gapAfter) => {
    if (y < bottom) breakPage();
    current.lines.push({ y, segments });
    y -= gapAfter;
  };

  const textBlock = (text, {
    font = 'F1', size = 10.5, gap = 14, indent = 0, maxChars = 88, color = '283548'
  } = {}) => {
    const lines = wrap(text, maxChars);
    lines.forEach((ln) => pushLine([{ font, size, x: marginX + indent, text: ln, color }], gap));
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
          x: marginX + ci * colW, text: w[lineIdx] || '',
          color: ri === 0 ? '6B4F00' : '283548'
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
      case 'title': textBlock(b.text, { font: 'F2', size: 22, gap: 27, maxChars: 46, color: '172033' }); break;
      case 'meta': textBlock(b.text.toUpperCase(), { font: 'F2', size: 8.8, gap: 14, maxChars: 100, color: '6B7280' }); break;
      case 'note': textBlock(b.text, {
        font: 'F2', size: 9.2, gap: 19, maxChars: 96,
        color: resource.status === 'reviewed' ? '166534' : '9A5B00'
      }); break;
      case 'h': y -= 7; textBlock(b.text, { font: 'F2', size: 13.5, gap: 18, maxChars: 70, color: '8A6200' }); break;
      case 'p': textBlock(b.text, { font: 'F1', size: 10.5, gap: 14, color: '283548' }); y -= 4; break;
      case 'li': textBlock(`-  ${b.text}`, { font: 'F1', size: 10.5, gap: 14, indent: 10, maxChars: 84, color: '283548' }); break;
      case 'oli': textBlock(`${b.index}.  ${b.text}`, { font: 'F1', size: 10.5, gap: 14, indent: 10, maxChars: 84, color: '283548' }); break;
      case 'footer': y -= 10; textBlock(b.text, { font: 'F1', size: 8.5, gap: 12, maxChars: 110, color: '7B8494' }); break;
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
  const pdfRgb = (hex) => {
    const value = String(hex || '000000').replace('#', '');
    return [0, 2, 4].map((offset) => (parseInt(value.slice(offset, offset + 2), 16) / 255).toFixed(3)).join(' ');
  };

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    let stream = `0.090 0.125 0.200 rg 0 ${pageH - 42} ${pageW} 42 re f\n`;
    stream += `0.957 0.784 0.290 rg 0 ${pageH - 45} ${pageW} 3 re f\n`;
    stream += `0.850 0.870 0.910 RG 0.5 w ${marginX} 42 m ${(pageW - marginX).toFixed(1)} 42 l S\n`;
    stream += 'BT\n/F2 9 Tf\n0.957 0.784 0.290 rg\n';
    stream += `1 0 0 1 ${marginX} ${pageH - 27} Tm (AMPLIFYHUB  |  PRACTICAL RESOURCE LIBRARY) Tj\n`;
    stream += 'ET\nBT\n';
    let curFont = '';
    let curSize = 0;
    let curColor = '';
    for (const line of page.lines) {
      for (const seg of line.segments) {
        if (!seg.text) continue;
        if (seg.font !== curFont || seg.size !== curSize) {
          stream += `/${seg.font} ${seg.size} Tf\n`;
          curFont = seg.font; curSize = seg.size;
        }
        if (seg.color !== curColor) {
          stream += `${pdfRgb(seg.color)} rg\n`;
          curColor = seg.color;
        }
        stream += `1 0 0 1 ${seg.x.toFixed(1)} ${line.y.toFixed(1)} Tm (${pdfEscape(seg.text)}) Tj\n`;
      }
    }
    stream += `ET\nBT\n/F1 8 Tf\n0.450 0.490 0.560 rg\n`;
    stream += `1 0 0 1 ${marginX} 25 Tm (AmplifyHub Professional Edition) Tj\n`;
    stream += `1 0 0 1 ${(pageW - marginX - 42).toFixed(1)} 25 Tm (Page ${pageIndex + 1} of ${pages.length}) Tj\nET`;
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
