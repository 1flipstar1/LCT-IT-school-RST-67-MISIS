import { createZip } from './zip.js';

const escapeXml = (value) =>
  String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);

const columnLetter = (index) => {
  let letter = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Ширина колонки по самому длинному значению, в пределах разумного. */
const columnWidths = ({ header, body }) =>
  header.map((title, index) => Math.min(60, Math.max(12, ...[title, ...body.map((row) => row[index])].map((value) => String(value ?? '').length + 2))));

/**
 * XLSX (Office Open XML). Заголовок жирный и закреплён, строки — inline-строки без sharedStrings.
 * table: { header: string[], body: (string|number)[][] }
 */
export function createXlsx(table, sheetName = 'Отчёт') {
  const rowXml = (cells, rowIndex, styleId) =>
    `<row r="${rowIndex}">${cells
      .map((value, columnIndex) => {
        const ref = `${columnLetter(columnIndex)}${rowIndex}`;
        const style = styleId ? ` s="${styleId}"` : '';
        return isNumber(value)
          ? `<c r="${ref}"${style}><v>${value}</v></c>`
          : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      })
      .join('')}</row>`;

  const cols = columnWidths(table)
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${rowXml(table.header, 1, 1)}${table.body.map((row, index) => rowXml(row, index + 2)).join('')}</sheetData>
</worksheet>`;

  return createZip(
    [
      {
        name: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      },
      {
        name: '_rels/.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      },
      {
        name: 'xl/workbook.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
      },
      {
        name: 'xl/styles.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs>
</styleSheet>`,
      },
      { name: 'xl/worksheets/sheet1.xml', content: sheet },
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

/**
 * XLS для Excel 97–2003 в формате XML Spreadsheet 2003: без зависимостей открывается в Excel и LibreOffice.
 * Бинарный BIFF8, если он обязателен, формируется на бэкенде (Apache POI / openpyxl + xlwt).
 */
export function createXls(table, sheetName = 'Отчёт') {
  const cell = (value, header = false) =>
    `<Cell${header ? ' ss:StyleID="header"' : ''}><Data ss:Type="${isNumber(value) ? 'Number' : 'String'}">${escapeXml(value)}</Data></Cell>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>
<Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}"><Table>
${columnWidths(table).map((width) => `<Column ss:Width="${width * 6}"/>`).join('')}
<Row>${table.header.map((value) => cell(value, true)).join('')}</Row>
${table.body.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('\n')}
</Table></Worksheet>
</Workbook>`;

  return new Blob([xml], { type: 'application/vnd.ms-excel' });
}
