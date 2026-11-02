(() => {
  const encoder = new TextEncoder();
  const format = value => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value || 0);
  const pdfText = value => String(value || '').split('').map(character => {
    const nordic = { 'æ': '\\346', 'ø': '\\370', 'å': '\\345', 'Æ': '\\306', 'Ø': '\\330', 'Å': '\\305' };
    if (nordic[character]) return nordic[character];
    if (character === '–' || character === '—') return '-';
    if (character === '(' || character === ')' || character === '\\') return '\\' + character;
    return character.charCodeAt(0) >= 32 && character.charCodeAt(0) <= 126 ? character : '?';
  }).join('');
  const text = (parts, font, size, x, y, value) => parts.push('BT /' + font + ' ' + size + ' Tf ' + x + ' ' + y + ' Td (' + pdfText(value) + ') Tj ET');
  const wrap = (value, max) => {
    const lines = []; let line = '';
    String(value || '').split(/\s+/).filter(Boolean).forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (next.length > (max || 70) && line) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const logo = parts => { parts.push('0.227 0.067 0.094 rg 441 755 112 30 re f'); parts.push('1 1 1 rg'); text(parts, 'F2', 14, 457, 764, 'RUMAG'); parts.push('0 0 0 rg'); };
  function create(data) {
    const width = 595, margin = 42, pages = []; let stream = [], y = 790;
    const finish = () => { pages.push(stream.join('\n')); stream = []; y = 790; };
    const title = () => {
      logo(stream); text(stream, 'F2', 22, margin, y, 'R Kalkyle - Materialkostnad'); y -= 25;
      text(stream, 'F1', 9, margin, y, 'Opprettet ' + new Date(data.createdAt || Date.now()).toLocaleString('nb-NO')); y -= 24;
      stream.push('0.3 w ' + margin + ' ' + y + ' m ' + (width - margin) + ' ' + y + ' l S'); y -= 16;
      text(stream, 'F2', 8, margin, y, 'Produkt og mål'); text(stream, 'F2', 8, 375, y, 'Innkjøp'); text(stream, 'F2', 8, 470, y, 'Kunde eks. mva'); y -= 14;
    };
    const next = () => { finish(); title(); };
    title();
    (data.lines || []).forEach(line => {
      const rows = [line.name].concat(wrap(line.details, 60), line.options && line.options.length ? [line.options.join(', ')] : []);
      if (y - (rows.length * 12 + 12) < 104) next();
      text(stream, 'F2', 10, margin, y, rows[0]); text(stream, 'F1', 9, 375, y, line.purchasePrice); text(stream, 'F2', 10, 470, y, line.totalExVat); y -= 12;
      rows.slice(1).forEach(row => { text(stream, 'F1', 8, margin + 8, y, row); y -= 11; });
      y -= 5; stream.push('0.2 w ' + margin + ' ' + y + ' m ' + (width - margin) + ' ' + y + ' l S'); y -= 11;
    });
    if (y < 150) next();
    text(stream, 'F2', 12, 340, y, 'Oppsummering'); y -= 18;
    text(stream, 'F1', 10, 340, y, 'Totalpris kunde eks. mva'); text(stream, 'F2', 11, 470, y, data.totalExVat); y -= 16;
    text(stream, 'F1', 10, 340, y, 'Inkl. 25 % mva'); text(stream, 'F2', 11, 470, y, data.totalIncVat);
    text(stream, 'F1', 8, margin, 38, 'Laget i R Kalkyle'); finish();
    const chunks = [], offsets = []; let length = 0;
    const add = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
    const object = (id, value) => { offsets[id] = length; add(id + ' 0 obj\n'); (Array.isArray(value) ? value : [value]).forEach(add); add('\nendobj\n'); };
    add('%PDF-1.4\n%PDF\n');
    const pageIds = pages.map((_, index) => 4 + index * 2), boldId = 4 + pages.length * 2;
    object(1, '<< /Type /Catalog /Pages 2 0 R >>'); object(2, '<< /Type /Pages /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
    object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); object(boldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    pages.forEach((contents, index) => { const page = pageIds[index], content = page + 1, bytes = encoder.encode(contents); object(page, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 ' + boldId + ' 0 R >> >> /Contents ' + content + ' 0 R >>'); object(content, ['<< /Length ' + bytes.length + ' >>\nstream\n', bytes, '\nendstream']); });
    const xref = length, size = boldId + 1; add('xref\n0 ' + size + '\n0000000000 65535 f \n'); for (let id = 1; id < size; id += 1) add(String(offsets[id]).padStart(10, '0') + ' 00000 n \n'); add('trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new File([new Blob(chunks, { type: 'application/pdf' })], 'Materialkostnad.pdf', { type: 'application/pdf' });
  }
  window.RKalkylePdf = { create, format };
})();
