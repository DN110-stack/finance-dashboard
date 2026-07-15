export type BankFormat = "NAB" | "Westpac";

export type Transaction = {
  id?: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  sourceBank?: BankFormat;
  isOneOff?: boolean;
};

export type ParsedTransactionsCSV = {
  bank: BankFormat;
  transactions: Transaction[];
};

const UNSUPPORTED_FORMAT_MESSAGE =
  "Couldn't detect a supported bank CSV format. Expected NAB columns " +
  "(Date, Amount, Account Number, Transaction Type, Transaction Details, " +
  "Category, Merchant Name, Processed On) or Westpac columns " +
  "(Date, Narrative, Debit Amount, Credit Amount, Balance).";

const MONTH_ABBREVIATIONS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function cleanAmount(raw: string | undefined): number {
  const rawAmount = raw?.trim() ?? "";
  if (rawAmount === "") return 0;

  const cleaned = rawAmount.replace(/[$,]/g, "");
  const isParenNegative = /^\(.*\)$/.test(cleaned);
  const amount = parseFloat(cleaned.replace(/[()]/g, "")) * (isParenNegative ? -1 : 1);
  return Number.isNaN(amount) ? 0 : amount;
}

// Auto-detects "YYYY-MM-DD" (already normalised), "DD/MM/YYYY" (Westpac's
// export format), or "DD Mon YY" (NAB's export format, e.g. "14 May 26") and
// converts to "YYYY-MM-DD" for display.
function normaliseDate(raw: string | undefined): string {
  const value = raw?.trim() ?? "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dMonY = value.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/);
  if (dMonY) {
    const [, day, monthName, yearRaw] = dMonY;
    const month = MONTH_ABBREVIATIONS[monthName.slice(0, 3).toLowerCase()];
    if (month) {
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  return value;
}

export function parseTransactionsCSV(text: string): ParsedTransactionsCSV {
  const rows = parseCSVRows(text);
  if (rows.length === 0) {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const dateIndex = header.indexOf("date");
  const categoryIndex = header.indexOf("category");

  const hasNarrative = header.includes("narrative");
  const hasTransactionDetails = header.includes("transaction details");
  const hasAccountNumber = header.includes("account number");

  let bank: BankFormat;
  if (hasNarrative) {
    bank = "Westpac";
  } else if (hasTransactionDetails || hasAccountNumber) {
    bank = "NAB";
  } else {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  }

  if (dateIndex === -1) {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  }

  function categoryFor(row: string[]): string {
    const value = categoryIndex !== -1 ? row[categoryIndex]?.trim() : "";
    return value || "Uncategorized";
  }

  if (bank === "Westpac") {
    const debitIndex = header.indexOf("debit amount");
    const creditIndex = header.indexOf("credit amount");

    if (debitIndex === -1 || creditIndex === -1) {
      throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
    }

    const transactions = dataRows.map((row) => {
      const debit = Math.abs(cleanAmount(row[debitIndex]));
      const credit = Math.abs(cleanAmount(row[creditIndex]));

      return {
        date: normaliseDate(row[dateIndex]),
        description: row[header.indexOf("narrative")]?.trim() ?? "",
        category: categoryFor(row),
        amount: credit - debit,
      };
    });

    return { bank, transactions };
  }

  const descriptionIndex = header.indexOf("transaction details");
  const amountIndex = header.indexOf("amount");

  if (descriptionIndex === -1 || amountIndex === -1) {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  }

  const transactions = dataRows.map((row) => ({
    date: normaliseDate(row[dateIndex]),
    description: row[descriptionIndex]?.trim() ?? "",
    category: categoryIndex !== -1 ? row[categoryIndex]?.trim() ?? "" : "",
    amount: cleanAmount(row[amountIndex]),
  }));

  return { bank, transactions };
}
