# Resource Library — visual QA report (release-gate pass, 2026-07-19)

Scope: every generated download artifact (25 PDF, 19 DOCX, 6 XLSX) plus the
library/detail pages on desktop and mobile viewports.

## Method and tooling

No copy of Word, Excel, or LibreOffice exists on the build machine, so each
format was rendered and inspected with the strongest available independent
tooling (none of it is the code that generated the files):

| Format | Rendered with | Structurally parsed with |
|---|---|---|
| PDF (25) | PyMuPDF 1.28 → PNG page images, every page inspected | PyMuPDF + header/xref/EOF checks |
| DOCX (19) | mammoth (docx→HTML) → Chromium screenshots, every file inspected | python-docx + mammoth (zero conversion warnings) |
| XLSX (6) | openpyxl cell/width/style dump → HTML → Chromium screenshots, both sheets of every file | openpyxl (opens all 6; widths, wrap, bold verified) |

Contact sheets of every render are committed alongside this report:
`contact-pdf-<category>.png` (all 25 PDF pages), `contact-docx-1..4.png`
(all 19 DOCX), `contact-xlsx.png` (all 6 XLSX, both sheets). Page-level
screenshots are in `screenshots/`.

Checked per artifact: clipping, wrapping, table alignment and column widths,
blank/orphan pages, broken or missing symbols, page breaks, readability, and
print usability of fill-in areas.

## Issues found and fixed (files regenerated after each fix)

1. **PDF tables had no ruled lines**, so the blank fill-in rows on printable
   worksheets were invisible — a printed Rejection Log or Call-Block Plan had
   nowhere visible to write. Fixed: light gray rules under every table row, a
   darker rule under headers, and taller (22 pt) ruled blank rows.
2. **Worksheets' PDF grids had no blank rows at all** (only the worked-example
   row). Fixed: the first table of each worksheet PDF now appends up to 8 ruled
   blank rows, mirroring the XLSX fill-in rows.
3. **Orphan page**: after fix 2, `worksheets-prospect-qualification-sheet.pdf`
   grew a second page containing only the footer line. Fixed by capping PDF
   blank rows at 8; a near-blank-page check (< 100 chars of text on a page) was
   added to the render pipeline and reports zero findings on the final files.
4. **XLSX files had no column widths, no wrap, no header styling** — they
   opened cramped, with long text spilling as single unreadable lines. Fixed:
   a minimal `styles.xml` (bold headers, wrapped top-aligned cells), explicit
   per-column widths sized from content, and a wide (42-char) width for
   fill-in columns that contain no sample content.
5. **PDF meta line lost its separators** (the `·` glyph was stripped by ASCII
   transliteration, running fields together). Fixed by transliterating `·` to
   `-` (fix landed just after the original Phase-1 commit; re-verified here).

Final state: **zero remaining findings** across all 50 artifacts — no clipped
or overlapping text, no orphan or blank pages, no broken glyphs (non-ASCII is
transliterated for the PDF's WinAnsi fonts), tables aligned with usable widths,
and worksheets printable as real fill-in forms.

## Honest limitations

- DOCX/XLSX rendering used mammoth/openpyxl + Chromium, which verifies content,
  structure, tables, and styling — but is **not pixel-identical to Word/Excel
  pagination**. Word-exact page breaks could not be verified without Office or
  LibreOffice on this machine. All 19 DOCX parse with zero warnings in two
  independent parsers, and all 6 XLSX open cleanly in openpyxl.
- PDF page images were rendered at 80 dpi for inspection; text was additionally
  extracted per page to confirm nothing rendered off-page or blank.
