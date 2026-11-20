function parseCsvLine(line, delimiter) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseNumber(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[€$£\s]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  return /^\s*-?\d+(\.\d+)?\s*$/.test(s) ? Number(s) : NaN;
}

function parseDate(raw) {
  const s = String(raw || "").trim();
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (match) {
    let day = match[1];
    let month = match[2];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (Number(day) <= 12 && Number(month) > 12) {
      [day, month] = [month, day];
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function isAmountColumn(values) {
  const valid = values.filter((val) => val != null && !Number.isNaN(parseNumber(val)));
  return valid.length >= values.length * 0.8 && valid.length > 0;
}

function isDateColumn(values) {
  return values.filter((val) => parseDate(val) !== null).length >= values.length * 0.8;
}

function slugMerchant(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);
}

export function parseCsvTransactions(text, bankName) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return { transactions: [], skipped: 0 };
  }

  const delimiter = detectDelimiter(text);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  const columns = headers.map((_, colIdx) => rows.map((row) => row[colIdx] ?? ""));

  const dateCol = columns.findIndex((col) => isDateColumn(col));
  const amountCol = columns.findIndex((col) => isAmountColumn(col));

  let descCol = -1;
  let maxAvgLen = 0;
  headers.forEach((_, colIdx) => {
    if (colIdx === dateCol || colIdx === amountCol) return;
    const avgLen = columns[colIdx].reduce((sum, cell) => sum + cell.length, 0) / columns[colIdx].length;
    if (avgLen > maxAvgLen && avgLen > 3) {
      maxAvgLen = avgLen;
      descCol = colIdx;
    }
  });

  if (dateCol < 0 || amountCol < 0) {
    return { error: "Não reconheci colunas de data e valor neste CSV." };
  }

  const transactions = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const date = parseDate(row[dateCol]);
    const amount = parseNumber(row[amountCol]);

    if (date == null || Number.isNaN(amount) || amount === 0) {
      skipped++;
      return;
    }
    if (amount > 0) {
      skipped++;
      return;
    }

    const name = descCol >= 0 ? (row[descCol] || "").trim() : `${bankName} ${index}`;
    if (!name) {
      skipped++;
      return;
    }

    transactions.push({
      id: `csv:${bankName}:${date}:${amount.toFixed(2)}:${slugMerchant(name)}:${index}`,
      name,
      value: Math.abs(amount),
      date,
      category: null,
      paid: true,
      source: "import",
      account: bankName,
    });
  });

  return { transactions, skipped };
}
