/**
 * Генерация PDF-файла в браузере без библиотек.
 *
 * Страница рисуется на canvas (фирменный шрифт и кириллица работают «из коробки», встраивать шрифты
 * в PDF не нужно), сжимается в JPEG и кладётся в PDF как изображение на всю страницу.
 * Результат — настоящий файл .pdf, который скачивается сразу, без диалога печати.
 */

const PAGE_SIZE = { landscape: [842, 595], portrait: [595, 842] }; // A4 в пунктах
const PIXELS_PER_POINT = 2; // чёткость текста при печати
const MARGIN = 36;
const FONT = "'RostelecomBasis', Arial, sans-serif";

const COLORS = {
  text: '#1d1d22',
  secondary: '#56565f',
  border: '#e4e4e7',
  headerFill: '#f0e0ff',
  brand: '#8300ff',
};

export class PdfDocument {
  constructor({ orientation = 'landscape' } = {}) {
    [this.width, this.height] = PAGE_SIZE[orientation];
    this.contentWidth = this.width - MARGIN * 2;
    this.pages = [];
    this.addPage();
  }

  addPage() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width * PIXELS_PER_POINT;
    canvas.height = this.height * PIXELS_PER_POINT;
    const context = canvas.getContext('2d');
    context.scale(PIXELS_PER_POINT, PIXELS_PER_POINT);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, this.width, this.height);
    context.textBaseline = 'top';
    this.pages.push(canvas);
    this.context = context;
    this.cursorY = MARGIN;
  }

  /** Переносит курсор на новую страницу, если блок высотой height не помещается. */
  ensureSpace(height) {
    if (this.cursorY + height > this.height - MARGIN) this.addPage();
  }

  wrap(text, maxWidth) {
    const words = String(text ?? '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (this.context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
    return lines;
  }

  text(value, { size = 10, weight = 400, color = COLORS.text, gapAfter = 6 } = {}) {
    this.context.font = `${weight} ${size}px ${FONT}`;
    const lineHeight = size * 1.35;
    this.wrap(value, this.contentWidth).forEach((line) => {
      this.ensureSpace(lineHeight);
      this.context.fillStyle = color;
      this.context.font = `${weight} ${size}px ${FONT}`;
      this.context.fillText(line, MARGIN, this.cursorY);
      this.cursorY += lineHeight;
    });
    this.cursorY += gapAfter;
  }

  /** Высота изображения на странице: вписывается по ширине с сохранением пропорций. */
  imageHeight({ width, height }) {
    return height * Math.min(1, this.contentWidth / width);
  }

  /** Изображение (например, график) по ширине страницы с сохранением пропорций. */
  image(image, { width, height, gapAfter = 16 }) {
    const drawHeight = this.imageHeight({ width, height });
    this.ensureSpace(drawHeight);
    this.context.drawImage(image, MARGIN, this.cursorY, width * (drawHeight / height), drawHeight);
    this.cursorY += drawHeight + gapAfter;
  }

  /** Скруглённая карточка: фон и тонкая рамка. */
  card(x, y, width, height, { fill = '#ffffff', stroke = COLORS.border, radius = 8 } = {}) {
    const { context } = this;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 0.75;
    context.stroke();
  }

  /** Строка текста в заданной точке, обрезанная по ширине многоточием. */
  label(value, x, y, maxWidth, { size = 10, weight = 400, color = COLORS.text } = {}) {
    const { context } = this;
    context.font = `${weight} ${size}px ${FONT}`;
    context.fillStyle = color;
    let text = String(value ?? '');
    while (text.length > 1 && context.measureText(text).width > maxWidth) text = `${text.slice(0, -2)}…`;
    context.fillText(text, x, y);
  }

  /**
   * Плитки ключевых показателей сеткой: название, крупное число, подпись.
   * items: [{ label, value, caption }].
   */
  tiles(items, { columns = 4, height = 70, gap = 10, gapAfter = 18 } = {}) {
    const width = (this.contentWidth - gap * (columns - 1)) / columns;
    for (let start = 0; start < items.length; start += columns) {
      this.ensureSpace(height);
      items.slice(start, start + columns).forEach((item, index) => {
        const x = MARGIN + index * (width + gap);
        const y = this.cursorY;
        this.card(x, y, width, height, { fill: '#f8f1ff', stroke: COLORS.headerFill });
        this.label(item.label, x + 10, y + 9, width - 20, { size: 8.5, weight: 700, color: COLORS.secondary });
        this.label(item.value, x + 10, y + 24, width - 20, { size: 20, weight: 700, color: COLORS.brand });
        this.label(item.caption, x + 10, y + 52, width - 20, { size: 7.5, color: COLORS.secondary });
      });
      this.cursorY += height + gap;
    }
    this.cursorY += gapAfter - gap;
  }

  /**
   * Графики сеткой в карточках с заголовком. Широкие (wide) занимают всю строку.
   * Изображение вписывается в ячейку с сохранением пропорций; строка не разрывается между страницами.
   * items: [{ title, image, width, height, wide }].
   */
  figures(items, { columns = 2, gap = 14, maxImageHeight = 190, gapAfter = 18 } = {}) {
    const padding = 10;
    const titleHeight = 18;
    const rows = [];
    let row = [];
    items.forEach((item) => {
      if (item.wide) {
        if (row.length) rows.push(row);
        rows.push([item]);
        row = [];
        return;
      }
      row.push(item);
      if (row.length === columns) {
        rows.push(row);
        row = [];
      }
    });
    if (row.length) rows.push(row);

    rows.forEach((cells) => {
      const cellColumns = cells[0].wide ? 1 : columns;
      const cellWidth = (this.contentWidth - gap * (cellColumns - 1)) / cellColumns;
      const layouts = cells.map((item) => {
        // Высокие графики (списки этапов, тепловые карты) получают почти всю страницу, чтобы текст не мельчал.
        const tall = item.height > item.width * 0.75;
        const heightLimit = tall ? this.height - MARGIN * 2 - titleHeight - padding * 2 - 40 : maxImageHeight;
        const scale = Math.min((cellWidth - padding * 2) / item.width, heightLimit / item.height);
        return { item, drawWidth: item.width * scale, drawHeight: item.height * scale };
      });
      const rowHeight = padding * 2 + titleHeight + Math.max(...layouts.map((layout) => layout.drawHeight));
      this.ensureSpace(rowHeight);
      layouts.forEach(({ item, drawWidth, drawHeight }, index) => {
        const x = MARGIN + index * (cellWidth + gap);
        const y = this.cursorY;
        this.card(x, y, cellWidth, rowHeight);
        this.label(item.title, x + padding, y + padding, cellWidth - padding * 2, { size: 10.5, weight: 700 });
        this.context.drawImage(item.image, x + (cellWidth - drawWidth) / 2, y + padding + titleHeight, drawWidth, drawHeight);
      });
      this.cursorY += rowHeight + gap;
    });
    this.cursorY += gapAfter - gap;
  }

  /** Таблица с переносом текста в ячейках; шапка повторяется на каждой новой странице. */
  table({ header, body }, { size = 8.5, gapAfter = 16 } = {}) {
    const padding = 5;
    const lineHeight = size * 1.35;
    const columnWidth = this.contentWidth / header.length;

    const measureRow = (cells, weight) => {
      this.context.font = `${weight} ${size}px ${FONT}`;
      const lines = cells.map((cell) => this.wrap(cell, columnWidth - padding * 2));
      return { lines, height: Math.max(...lines.map((cellLines) => cellLines.length)) * lineHeight + padding * 2 };
    };

    const drawRow = ({ lines, height }, { weight, fill }) => {
      if (fill) {
        this.context.fillStyle = fill;
        this.context.fillRect(MARGIN, this.cursorY, this.contentWidth, height);
      }
      this.context.font = `${weight} ${size}px ${FONT}`;
      this.context.fillStyle = COLORS.text;
      lines.forEach((cellLines, columnIndex) =>
        cellLines.forEach((line, lineIndex) =>
          this.context.fillText(line, MARGIN + columnIndex * columnWidth + padding, this.cursorY + padding + lineIndex * lineHeight),
        ),
      );
      this.context.strokeStyle = COLORS.border;
      this.context.lineWidth = 0.5;
      this.context.beginPath();
      this.context.moveTo(MARGIN, this.cursorY + height);
      this.context.lineTo(MARGIN + this.contentWidth, this.cursorY + height);
      this.context.stroke();
      this.cursorY += height;
    };

    const headerRow = measureRow(header, 700);
    this.ensureSpace(headerRow.height * 2);
    drawRow(headerRow, { weight: 700, fill: COLORS.headerFill });

    body.forEach((cells) => {
      const row = measureRow(cells, 400);
      if (this.cursorY + row.height > this.height - MARGIN) {
        this.addPage();
        drawRow(headerRow, { weight: 700, fill: COLORS.headerFill });
      }
      drawRow(row, { weight: 400 });
    });
    this.cursorY += gapAfter;
  }

  /** Нумерация страниц и сборка файла. */
  async toBlob() {
    this.pages.forEach((canvas, index) => {
      const context = canvas.getContext('2d');
      context.font = `400 8px ${FONT}`;
      context.fillStyle = COLORS.secondary;
      context.textAlign = 'right';
      context.fillText(`${index + 1} / ${this.pages.length}`, this.width - MARGIN, this.height - MARGIN / 2);
      context.textAlign = 'left';
    });

    const images = await Promise.all(
      this.pages.map(async (canvas) => {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
      }),
    );
    return buildPdf(images, this.width, this.height);
  }
}

/** Дожидается загрузки фирменного шрифта, иначе первая страница нарисуется запасным шрифтом. */
export async function ensurePdfFonts() {
  await Promise.all([document.fonts.load(`400 10px ${FONT}`), document.fonts.load(`700 10px ${FONT}`)]);
}

export const PDF_COLORS = COLORS;

/**
 * Минимальный PDF 1.4: для каждой страницы — объект страницы, поток содержимого и JPEG-изображение.
 * Смещения объектов считаются в байтах для таблицы xref.
 */
function buildPdf(images, pageWidth, pageHeight) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;

  const push = (chunk) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id, body) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  const pageIds = images.map((_, index) => 3 + index * 3);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`));

  images.forEach((image, index) => {
    const [pageId, contentId, imageId] = [pageIds[index], pageIds[index] + 1, pageIds[index] + 2];
    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;

    object(pageId, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
    object(contentId, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    object(imageId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      push(image.bytes);
      push('\nendstream');
    });
  });

  const objectCount = 3 + images.length * 3;
  const xrefOffset = length;
  push(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let id = 1; id < objectCount; id += 1) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: 'application/pdf' });
}
