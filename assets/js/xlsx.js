/*
 * A minimal .xlsx writer — real Excel files, no library.
 *
 * The app has to keep working offline and from a single HTML file, so pulling
 * a spreadsheet library off a CDN is not an option. An xlsx is a ZIP of XML
 * parts, and Excel accepts stored (uncompressed) entries, so the whole thing
 * comes to a CRC32, a ZIP container and a little SheetML.
 */

/* ---- ZIP (stored entries only) ---- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s) => new TextEncoder().encode(s);

/** @param {Array<{name: string, data: Uint8Array}>} files */
function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];

  for (const f of files) {
    const name = utf8(f.name);
    const crc = crc32(f.data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),                       // time, date
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0),
    ];
    chunks.push(new Uint8Array(local), name, f.data);

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ]);
    central.push(name);
    offset += local.length + name.length + f.data.length;
  }

  const dirParts = [];
  let dirSize = 0;
  for (const c of central) {
    const bytes = c instanceof Uint8Array ? c : new Uint8Array(c);
    dirParts.push(bytes);
    dirSize += bytes.length;
  }
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(dirSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...chunks, ...dirParts, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ---- SheetML ---- */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');   // Excel rejects these

/** A1, B1 … AA1 */
function ref(col, row) {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s + row;
}

/*
 * Styles: 0 plain, 1 header, 2 two decimals, 3 integer, 4 bold, 5 bold 2dp.
 * numFmtId 4 is "#,##0.00" and 3 is "#,##0" — both built in, so no custom
 * formats are needed.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE9E9E7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF9A9A96"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export const STYLE = { plain: 0, header: 1, money: 2, int: 3, bold: 4, boldMoney: 5 };

/**
 * A cell is a bare value, or { v, s } to pick a style.
 * Strings are written inline, so no shared-string table is needed.
 */
function sheetXml(rows, cols) {
  const out = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  ];
  if (cols?.length) {
    out.push('<cols>');
    cols.forEach((w, i) => out.push(`<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`));
    out.push('</cols>');
  }
  out.push('<sheetData>');
  rows.forEach((row, r) => {
    out.push(`<row r="${r + 1}">`);
    (row || []).forEach((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return;
      const o = (typeof cell === 'object' && !(cell instanceof Date)) ? cell : { v: cell };
      const style = o.s ? ` s="${o.s}"` : '';
      const at = ref(c, r + 1);
      if (typeof o.v === 'number' && Number.isFinite(o.v)) {
        out.push(`<c r="${at}"${style}><v>${o.v}</v></c>`);
      } else {
        out.push(`<c r="${at}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`);
      }
    });
    out.push('</row>');
  });
  out.push('</sheetData></worksheet>');
  return out.join('');
}

const sheetName = (s, i) =>
  (String(s || `Sheet${i + 1}`).replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || `Sheet${i + 1}`);

/**
 * @param {Array<{name?: string, rows: Array<Array<any>>, cols?: number[]}>} sheets
 * @returns {Blob} an .xlsx workbook
 */
export function workbook(sheets) {
  const list = sheets.filter(Boolean);
  const names = list.map((s, i) => sheetName(s.name, i));

  const files = [
    { name: '[Content_Types].xml', data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>') },
    { name: '_rels/.rels', data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>') },
    { name: 'xl/workbook.xml', data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>') },
    { name: 'xl/styles.xml', data: utf8(STYLES) },
    ...list.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(s.rows || [], s.cols)),
    })),
  ];

  return zip(files);
}
