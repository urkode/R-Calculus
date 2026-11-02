(() => {
  const encoder = new TextEncoder();
  const number = value => Number(Number(value || 0).toFixed(2)).toString();
  const format = value => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value || 0);
  const pdfText = value => String(value || '').split('').map(character => {
    const code = character.charCodeAt(0);
    if (character === '(' || character === ')' || character === '\\') return `\\${character}`;
    return code >= 32 && code <= 255 ? character : '?';
  }).join('');
  const wrap = (value, max = 70) => {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = []; let current = '';
    words.forEach(word => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > max && current) { lines.push(current); current = word; } else current = next;
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const text = (parts, font, size, x, y, value) => parts.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);

  function create(data) {
    const pageWidth = 595, pageHeight = 842, margin = 42;
    const pages = []; let stream = []; let y = 790;
    const finishPage = () => { pages.push(stream.join('\n')); stream = []; y = 790; };
    const title = () => {
      text(stream, 'F2', 22, margin, y, 'R Kalkyle – Materialkostnad'); y -= 25;
      text(stream, 'F1', 9, margin, y, `Opprettet ${new Date(data.createdAt || Date.now()).toLocaleString('nb-NO')}`); y -= 24;
      stream.push(`0.3 w ${margin} ${y} m ${pageWidth - margin} ${y} l S`); y -= 16;
      text(stream, 'F2', 8, margin, y, 'Produkt og mål');
      text(stream, 'F2', 8, 375, y, 'Innkjøp');
      text(stream, 'F2', 8, 470, y, 'Kunde eks. mva'); y -= 14;
    };
    const nextPage = () => { finishPage(); title(); };
    title();
    (data.lines || []).forEach(line => {
      const rows = [line.name, ...wrap(line.details, 60), ...(line.options?.length ? [line.options.join(', ')] : [])];
      const height = rows.length * 12 + 12;
      if (y - height < 104) nextPage();
      text(stream, 'F2', 10, margin, y, rows[0]);
      text(stream, 'F1', 9, 375, y, line.purchasePrice);
      text(stream, 'F2', 10, 470, y, line.totalExVat); y -= 12;
      rows.slice(1).forEach(row => { text(stream, 'F1', 8, margin + 8, y, row); y -= 11; });
      y -= 5;
      stream.push(`0.2 w ${margin} ${y} m ${pageWidth - margin} ${y} l S`); y -= 11;
    });
    if (y < 150) nextPage();
    text(stream, 'F2', 12, 340, y, 'Oppsummering'); y -= 18;
    text(stream, 'F1', 10, 340, y, 'Totalpris kunde eks. mva'); text(stream, 'F2', 11, 470, y, data.totalExVat); y -= 16;
    text(stream, 'F1', 10, 340, y, 'Inkl. 25 % mva'); text(stream, 'F2', 11, 470, y, data.totalIncVat); y -= 26;
    text(stream, 'F1', 8, margin, 38, 'Laget i R Kalkyle');
    finishPage();

    const chunks = []; const offsets = []; let length = 0;
    const add = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
    const object = (id, value) => { offsets[id] = length; add(`${id} 0 obj\n`); (Array.isArray(value) ? value : [value]).forEach(add); add('\nendobj\n'); };
    add('%PDF-1.4\n%PDF\n');
    const pageIds = pages.map((_, index) => 4 + index * 2);
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    object(4 + pages.length * 2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const boldId = 4 + pages.length * 2;
    pages.forEach((contents, index) => {
      const pageId = pageIds[index], contentId = pageId + 1, bytes = encoder.encode(contents);
      object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      object(contentId, [`<< /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
    });
    const xref = length; const size = boldId + 1;
    add(`xref\n0 ${size}\n0000000000 65535 f \n`);
    for (let id = 1; id < size; id += 1) add(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    add(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new File([new Blob(chunks, { type: 'application/pdf' })], 'Materialkostnad.pdf', { type: 'application/pdf' });
  }
  window.RKalkylePdf = { create, format };
})();
