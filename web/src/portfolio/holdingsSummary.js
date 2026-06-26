export function formatPortfolioMoney(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (!Number.isFinite(amount)) return "-";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(abs >= 1000000000 ? 0 : 1)}억`;
  if (abs >= 10000) return `${sign}${Math.round(abs / 10000).toLocaleString("ko-KR")}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

export function formatPortfolioPercent(value, digits = 1) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(digits)}%`;
}

function parsePortfolioNumber(value) {
  const source = String(value ?? "").trim();
  if (!source) return 0;
  const suffix = source.match(/([kmb])$/i)?.[1]?.toLowerCase();
  const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "b" ? 1000000000 : 1;
  const normalized = source
    .replace(/[,$₩%\s]/g, "")
    .replace(/[kmb]$/i, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number * multiplier : 0;
}

function parsePortfolioWeight(value) {
  const source = String(value ?? "").trim();
  const number = parsePortfolioNumber(source);
  if (!number) return 0;
  if (!source.includes("%") && Math.abs(number) <= 1) return number * 100;
  return number;
}

function normalizePortfolioHeader(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  if (["ticker", "symbol", "code", "종목", "티커", "종목코드"].includes(key)) return "ticker";
  if (["name", "company", "security", "종목명", "이름"].includes(key)) return "name";
  if (["assetclass", "asset", "class", "category", "type", "자산군", "유형", "분류"].includes(key)) return "assetClass";
  if (["region", "market", "country", "국가", "지역", "시장"].includes(key)) return "region";
  if (["value", "marketvalue", "amount", "평가금", "평가액", "금액", "현재가치"].includes(key)) return "value";
  if (
    [
      "weight",
      "weights",
      "ratio",
      "percent",
      "percentage",
      "allocation",
      "targetweight",
      "targetratio",
      "비중",
      "비율",
      "배분",
      "목표비중",
      "목표비율",
    ].includes(key)
  ) {
    return "weight";
  }
  if (["cost", "bookcost", "basis", "principal", "매입금", "매입가", "원금", "취득가"].includes(key)) return "cost";
  return "";
}

function splitPortfolioLine(line, delimiter) {
  return String(line || "")
    .split(delimiter)
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => cell || index < cells.length - 1);
}

function portfolioDelimiter(line) {
  if (String(line).includes("\t")) return "\t";
  if (String(line).includes("|")) return "|";
  if (String(line).includes(";")) return ";";
  return ",";
}

export function parsePortfolioInput(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) return [];

  const delimiter = portfolioDelimiter(lines[0]);
  const firstCells = splitPortfolioLine(lines[0], delimiter);
  const normalizedHeaders = firstCells.map(normalizePortfolioHeader);
  const hasHeader = normalizedHeaders.some(Boolean);
  const headers = hasHeader ? normalizedHeaders : ["ticker", "value", "assetClass", "region", "cost", "name"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const indexByHeader = headers.reduce((acc, key, index) => {
    if (key && acc[key] === undefined) acc[key] = index;
    return acc;
  }, {});

  const parsedRows = dataLines
    .map((line, index) => {
      const cells = splitPortfolioLine(line, delimiter);
      const ticker = (cells[indexByHeader.ticker] || cells[0] || `ASSET-${index + 1}`).trim();
      const valueCell =
        indexByHeader.value !== undefined
          ? cells[indexByHeader.value]
          : !hasHeader
            ? cells[1] || cells[cells.length - 1]
            : "";
      const weightCell =
        indexByHeader.weight !== undefined
          ? cells[indexByHeader.weight]
          : !hasHeader && String(valueCell || "").includes("%")
            ? valueCell
            : "";
      const valueCandidate = parsePortfolioNumber(valueCell);
      const weightCandidate = parsePortfolioWeight(weightCell);
      return {
        ticker: ticker.toUpperCase(),
        name: cells[indexByHeader.name] || ticker.toUpperCase(),
        assetClass: cells[indexByHeader.assetClass] || "미분류",
        region: cells[indexByHeader.region] || "미분류",
        valueCandidate,
        weightCandidate,
        valueCell,
        costCandidate: parsePortfolioNumber(cells[indexByHeader.cost]),
        sourceLine: line,
      };
    })
    .filter((row) => row.ticker && (row.valueCandidate > 0 || row.weightCandidate > 0));

  const candidateTotal = parsedRows.reduce((sum, row) => sum + row.valueCandidate, 0);
  const hasExplicitWeight = parsedRows.some((row) => row.weightCandidate > 0);
  const inferWeightOnly =
    !hasHeader &&
    !hasExplicitWeight &&
    parsedRows.length > 1 &&
    parsedRows.every((row) => row.valueCandidate > 0 && row.valueCandidate <= 100) &&
    ((candidateTotal >= 99 && candidateTotal <= 101) || candidateTotal <= 1.01);

  const rows = parsedRows.map((row) => {
    const inputMode = row.weightCandidate > 0 || inferWeightOnly ? "weight" : "amount";
    const inputWeight =
      inputMode === "weight" ? (row.weightCandidate > 0 ? row.weightCandidate : parsePortfolioWeight(row.valueCell)) : 0;
    const value = inputMode === "weight" ? inputWeight : row.valueCandidate;
    const cost = inputMode === "weight" ? 0 : row.costCandidate || value;
    return {
      ticker: row.ticker,
      name: row.name,
      assetClass: row.assetClass,
      region: row.region,
      value,
      cost,
      inputMode,
      inputWeight,
      sourceLine: row.sourceLine,
    };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .map((row) => ({
      ...row,
      weight: totalValue ? (row.value / totalValue) * 100 : 0,
      profitLoss: row.inputMode === "weight" ? null : row.value - row.cost,
      profitLossRate: row.inputMode === "weight" || !row.cost ? null : ((row.value - row.cost) / row.cost) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

function groupPortfolioRows(rows, field) {
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[field] || "미분류";
    grouped.set(key, (grouped.get(key) || 0) + row.value);
  });
  return [...grouped.entries()]
    .map(([name, value]) => ({
      name,
      value,
      weight: totalValue ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function summarizePortfolioRows(rows) {
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const weightRows = rows.filter((row) => row.inputMode === "weight");
  const valueMode = rows.length && weightRows.length === rows.length ? "weight" : weightRows.length ? "mixed" : "amount";
  const totalWeight = weightRows.reduce((sum, row) => sum + (row.inputWeight || row.value), 0);
  const top3Weight = rows.slice(0, 3).reduce((sum, row) => sum + row.weight, 0);
  const hhi = rows.reduce((sum, row) => sum + Math.pow(row.weight / 100, 2), 0) * 10000;
  const classRows = groupPortfolioRows(rows, "assetClass");
  const regionRows = groupPortfolioRows(rows, "region");
  const topHolding = rows[0] || null;
  const concentrationLevel = top3Weight >= 65 ? "높음" : top3Weight >= 45 ? "보통" : "낮음";
  return {
    totalValue,
    totalCost,
    totalWeight,
    valueMode,
    profitLoss: valueMode === "weight" ? null : totalValue - totalCost,
    profitLossRate: valueMode === "weight" || !totalCost ? null : ((totalValue - totalCost) / totalCost) * 100,
    top3Weight,
    hhi,
    classRows,
    regionRows,
    topHolding,
    concentrationLevel,
  };
}

export function portfolioSummaryValueLabel(summary) {
  if (summary.valueMode === "weight") {
    return `비율 합계 ${formatPortfolioPercent(summary.totalWeight, summary.totalWeight % 1 ? 1 : 0)}`;
  }
  if (summary.valueMode === "mixed") return `혼합 입력 · 환산 ${formatPortfolioMoney(summary.totalValue)}`;
  return formatPortfolioMoney(summary.totalValue);
}

export function portfolioPrimaryMetricLabel(summary) {
  if (summary.valueMode === "weight") return "모델 비중";
  if (summary.valueMode === "mixed") return "환산 규모";
  return "총 평가액";
}

export function portfolioProfitLossLabel(summary) {
  if (summary.valueMode === "weight") return "금액 없음";
  return `${formatPortfolioPercent(summary.profitLossRate)} 손익률`;
}

export function portfolioRowValueLabel(row) {
  if (row.inputMode === "weight") return formatPortfolioPercent(row.inputWeight || row.weight);
  return formatPortfolioMoney(row.value);
}

export function portfolioRowProfitLossLabel(row) {
  if (row.inputMode === "weight") return "실험 비중";
  return formatPortfolioMoney(row.profitLoss);
}
