(() => {
  const encoder = new TextEncoder();
  const format = value => String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr';
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
  const fallbackLogo = parts => { parts.push('0.227 0.067 0.094 rg 441 755 112 30 re f'); parts.push('1 1 1 rg'); text(parts, 'F2', 14, 457, 764, 'RUMAG'); parts.push('0 0 0 rg'); };
  async function logoJpeg() {
    try {
      const response = await fetch('./assets/brand/rumag-logo-sort.svg');
      const source = URL.createObjectURL(new Blob([await response.text()], { type: 'image/svg+xml' }));
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
      canvas.width = 693; canvas.height = 254;
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 14, 20, 665, 214); URL.revokeObjectURL(source);
      return { width: canvas.width, height: canvas.height, bytes: Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]), value => value.charCodeAt(0)) };
    } catch (_) { return null; }
  }
  async function create(data) {
    const width = 595, margin = 42, pages = []; let stream = [], y = 790;
    const brand = await logoJpeg();
    const finish = () => { pages.push(stream.join('\n')); stream = []; y = 790; };
    const title = () => {
      if (brand) stream.push('q 114 0 0 42 439 751 cm /RumagLogo Do Q'); else fallbackLogo(stream);
      text(stream, 'F2', 22, margin, y, 'R Kalkyle - Materialkostnad'); y -= 25;
      text(stream, 'F1', 9, margin, y, 'Opprettet ' + new Date(data.createdAt || Date.now()).toLocaleString('nb-NO') + (data.author ? ' av ' + data.author : '')); y -= 24;
      stream.push('0.3 w ' + margin + ' ' + y + ' m ' + (width - margin) + ' ' + y + ' l S'); y -= 16;
      text(stream, 'F2', 8, margin, y, 'Produkt og mål'); text(stream, 'F2', 8, 375, y, 'Innkjøp'); text(stream, 'F2', 8, 470, y, 'Kunde eks. mva'); y -= 14;
    };
    const next = () => { finish(); title(); };
    title();
    (data.lines || []).forEach(line => {
      const optionRows = (line.options || []);
      const rows = wrap(line.details, 66).concat(['Materialkostnad: ' + format(line.materialPurchase)]);
      const rowCount = rows.length + optionRows.length + (optionRows.length ? 1 : 0);
      if (y - (rowCount * 12 + 16) < 104) next();
      text(stream, 'F2', 10, margin, y, line.name);
      text(stream, 'F1', 8, 375, y, format(line.purchasePrice) + ' / ' + line.unit);
      text(stream, 'F2', 10, 470, y, format(line.totalExVat)); y -= 13;
      rows.forEach(row => { text(stream, 'F1', 8, margin + 8, y, row); y -= 11; });
      if (optionRows.length) {
        text(stream, 'F2', 8, margin + 8, y, 'Tilvalg'); y -= 11;
        optionRows.forEach(option => { text(stream, 'F1', 8, margin + 16, y, option.label); text(stream, 'F1', 8, 285, y, format(option.totalPurchase)); y -= 11; });
      }
      y -= 5; stream.push('0.2 w ' + margin + ' ' + y + ' m ' + (width - margin) + ' ' + y + ' l S'); y -= 11;
    });    if (y < 150) next();
    text(stream, 'F2', 12, 340, y, 'Oppsummering'); y -= 18;
    text(stream, 'F1', 10, 340, y, 'Totalpris kunde eks. mva'); text(stream, 'F2', 11, 470, y, format(data.totalExVat)); y -= 16;
    text(stream, 'F1', 10, 340, y, 'Inkl. 25 % mva'); text(stream, 'F2', 11, 470, y, format(data.totalIncVat));
    text(stream, 'F1', 8, margin, 38, 'Laget i R Kalkyle'); finish();
    const chunks = [], offsets = []; let length = 0;
    const add = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
    const object = (id, value) => { offsets[id] = length; add(id + ' 0 obj\n'); (Array.isArray(value) ? value : [value]).forEach(add); add('\nendobj\n'); };
    add('%PDF-1.4\n%PDF\n');
    const pageIds = pages.map((_, index) => 4 + index * 2), boldId = 4 + pages.length * 2, logoId = brand ? boldId + 1 : null;
    object(1, '<< /Type /Catalog /Pages 2 0 R >>'); object(2, '<< /Type /Pages /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
    object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); object(boldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    if (brand) object(logoId, ['<< /Type /XObject /Subtype /Image /Width ' + brand.width + ' /Height ' + brand.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + brand.bytes.length + ' >>\nstream\n', brand.bytes, '\nendstream']);
    pages.forEach((contents, index) => { const page = pageIds[index], content = page + 1, bytes = encoder.encode(contents), xObjects = brand ? ' /XObject << /RumagLogo ' + logoId + ' 0 R >>' : ''; object(page, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 ' + boldId + ' 0 R >>' + xObjects + ' >> /Contents ' + content + ' 0 R >>'); object(content, ['<< /Length ' + bytes.length + ' >>\nstream\n', bytes, '\nendstream']); });
    const xref = length, size = (logoId || boldId) + 1; add('xref\n0 ' + size + '\n0000000000 65535 f \n'); for (let id = 1; id < size; id += 1) add(String(offsets[id]).padStart(10, '0') + ' 00000 n \n'); add('trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new File([new Blob(chunks, { type: 'application/pdf' })], 'Materialkostnad.pdf', { type: 'application/pdf' });
  }
  window.RKalkylePdf = { create, format };
})();
