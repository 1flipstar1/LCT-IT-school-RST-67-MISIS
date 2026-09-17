var e=Array.from({length:256},(e,t)=>{let n=t;for(let e=0;e<8;e+=1)n=n&1?3988292384^n>>>1:n>>>1;return n>>>0});function t(t){let n=4294967295;for(let r of t)n=e[(n^r)&255]^n>>>8;return(n^4294967295)>>>0}function n(e,n=`application/zip`){let r=new TextEncoder,i=[],a=[],o=0;e.forEach(({name:e,content:n})=>{let s=r.encode(e),c=r.encode(n),l=t(c),u=new DataView(new ArrayBuffer(30));u.setUint32(0,67324752,!0),u.setUint16(4,20,!0),u.setUint16(6,2048,!0),u.setUint32(14,l,!0),u.setUint32(18,c.length,!0),u.setUint32(22,c.length,!0),u.setUint16(26,s.length,!0),i.push(u,s,c);let d=new DataView(new ArrayBuffer(46));d.setUint32(0,33639248,!0),d.setUint16(4,20,!0),d.setUint16(6,20,!0),d.setUint16(8,2048,!0),d.setUint32(16,l,!0),d.setUint32(20,c.length,!0),d.setUint32(24,c.length,!0),d.setUint16(28,s.length,!0),d.setUint32(42,o,!0),a.push(d,s),o+=30+s.length+c.length});let s=a.reduce((e,t)=>e+t.byteLength,0),c=new DataView(new ArrayBuffer(22));return c.setUint32(0,101010256,!0),c.setUint16(8,e.length,!0),c.setUint16(10,e.length,!0),c.setUint32(12,s,!0),c.setUint32(16,o,!0),new Blob([...i,...a,c],{type:n})}var r=e=>String(e??``).replace(/[<>&"']/g,e=>({"<":`&lt;`,">":`&gt;`,"&":`&amp;`,'"':`&quot;`,"'":`&apos;`})[e]),i=e=>{let t=``;for(let n=e+1;n>0;n=Math.floor((n-1)/26))t=String.fromCharCode(65+(n-1)%26)+t;return t},a=e=>typeof e==`number`&&Number.isFinite(e),o=({header:e,body:t})=>e.map((e,n)=>Math.min(60,Math.max(12,...[e,...t.map(e=>e[n])].map(e=>String(e??``).length+2))));function s(e,t=`Отчёт`){let s=(e,t,n)=>`<row r="${t}">${e.map((e,o)=>{let s=`${i(o)}${t}`,c=n?` s="${n}"`:``;return a(e)?`<c r="${s}"${c}><v>${e}</v></c>`:`<c r="${s}" t="inlineStr"${c}><is><t xml:space="preserve">${r(e)}</t></is></c>`}).join(``)}</row>`,c=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${o(e).map((e,t)=>`<col min="${t+1}" max="${t+1}" width="${e}" customWidth="1"/>`).join(``)}</cols>
<sheetData>${s(e.header,1,1)}${e.body.map((e,t)=>s(e,t+2)).join(``)}</sheetData>
</worksheet>`;return n([{name:`[Content_Types].xml`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`},{name:`_rels/.rels`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`},{name:`xl/workbook.xml`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${r(t.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`},{name:`xl/_rels/workbook.xml.rels`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`},{name:`xl/styles.xml`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs>
</styleSheet>`},{name:`xl/worksheets/sheet1.xml`,content:c}],`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)}function c(e,t=`Отчёт`){let n=(e,t=!1)=>`<Cell${t?` ss:StyleID="header"`:``}><Data ss:Type="${a(e)?`Number`:`String`}">${r(e)}</Data></Cell>`,i=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>
<Worksheet ss:Name="${r(t.slice(0,31))}"><Table>
${o(e).map(e=>`<Column ss:Width="${e*6}"/>`).join(``)}
<Row>${e.header.map(e=>n(e,!0)).join(``)}</Row>
${e.body.map(e=>`<Row>${e.map(e=>n(e)).join(``)}</Row>`).join(`
`)}
</Table></Worksheet>
</Workbook>`;return new Blob([i],{type:`application/vnd.ms-excel`})}export{s as n,c as t};