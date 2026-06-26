const portfolioWidgetChartColors = ["#2f806e", "#7a6f9f", "#b07d45", "#c36c62", "#4d8f7a", "#6b7c93"];
const portfolioWidgetIgnoredTickerTokens = new Set(["A", "B", "C", "CSV", "ETF", "GUI", "JSON", "MDD", "SK", "W"]);
const portfolioWidgetSyntheticTickerOnlyLabels = new Set(["A", "B", "C", "W"]);

function cleanPortfolioDatasetText(value, maxLength = 900) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function portfolioWidgetValueFromRow(row = {}) {
  return (
    row?.weight ??
    row?.inputWeight ??
    row?.percent ??
    row?.ratio ??
    row?.allocation ??
    row?.비중 ??
    row?.value ??
    row?.marketValue ??
    row?.market_value ??
    row?.marketvalue ??
    row?.amount ??
    row?.평가금액 ??
    row?.평가액 ??
    row?.금액 ??
    row?.현재가치 ??
    row?.nav
  );
}

function portfolioWidgetHasRawValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function portfolioWidgetValueBasisFromRow(row = {}, hasExplicitValue = false, fallback = "placeholder") {
  const basis = String(row?.valueBasis || row?.basis || row?.inputMode || "").trim().toLowerCase();
  if (/placeholder|implicit|unknown/.test(basis)) return "placeholder";
  if (/equal[-_\s]?weight|동일|균등/.test(basis)) return "equal_weight";
  if (/explicit|weight|value|amount|market|평가|비중|allocation|ratio|percent/.test(basis)) return "explicit";
  return hasExplicitValue ? "explicit" : fallback;
}

export function portfolioWidgetRowHasExplicitAllocationValue(row = {}) {
  if (!row || typeof row !== "object") return false;
  const basis = String(row.valueBasis || row.basis || row.inputMode || "").trim().toLowerCase();
  if (/placeholder|implicit|unknown/.test(basis)) return false;
  if (/equal[-_\s]?weight|동일|균등|explicit|weight|value|amount|market|평가|비중|allocation|ratio|percent/.test(basis)) return true;
  if (row.hasExplicitAllocationValue === true) return true;
  if (row.hasExplicitValue === true) return true;
  return portfolioWidgetHasRawValue(portfolioWidgetValueFromRow(row));
}

export function isPortfolioWidgetReferenceToken(value = "") {
  const token = String(value || "").trim();
  return /^W-\d{3,}$/i.test(token) || /^portfolio_widget_/i.test(token);
}

export function isPortfolioWidgetTickerCandidateValid(value = "") {
  const token = String(value || "").trim().toUpperCase();
  if (!token || isPortfolioWidgetReferenceToken(token)) return false;
  if (portfolioWidgetIgnoredTickerTokens.has(token)) return false;
  return /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/.test(token);
}

function isPortfolioWidgetSyntheticTickerOnlyRow(row = {}) {
  const label = String(row?.label || "").trim().toUpperCase();
  const ticker = String(row?.ticker || "").trim().toUpperCase();
  const detail = String(row?.detail || "").trim().toUpperCase();
  if (!portfolioWidgetSyntheticTickerOnlyLabels.has(label)) return false;
  return (!ticker || !isPortfolioWidgetTickerCandidateValid(ticker)) && (!detail || detail === label || !isPortfolioWidgetTickerCandidateValid(detail));
}

function portfolioWidgetNumberUnitMultiplier(source = "") {
  const tail = String(source || "").replace(/\s+/g, "");
  if (!tail) return 1;
  if (/^(조|tn|t\b)/i.test(tail)) return 1_000_000_000_000;
  if (/^억/i.test(tail)) return 100_000_000;
  if (/^(bn|b\b)/i.test(tail)) return 1_000_000_000;
  if (/^천만/i.test(tail)) return 10_000_000;
  if (/^(백만|mn|m\b|million)/i.test(tail)) return 1_000_000;
  if (/^십만/i.test(tail)) return 100_000;
  if (/^만/i.test(tail)) return 10_000;
  if (/^(천|k\b)/i.test(tail)) return 1_000;
  return 1;
}

export function parsePortfolioWidgetNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const compact = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[₩$€£¥]/g, "")
    .trim();
  if (!compact) return 0;
  const match = compact.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return 0;
  const tail = compact.slice((match.index || 0) + match[0].length);
  return parsed * portfolioWidgetNumberUnitMultiplier(tail);
}

export function portfolioWidgetDatasetRows(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/[\s,;|/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!value || typeof value !== "object") return [];
  const candidates = [
    value.dataset,
    value.data,
    value.holdings,
    value.tickers,
    value.symbols,
    value.assets,
    value.positions,
    value.rows,
    value.items,
    value.values,
  ];
  for (const candidate of candidates) {
    const rows = portfolioWidgetDatasetRows(candidate);
    if (rows.length) return rows;
  }
  return [];
}

export function normalizePortfolioWidgetDataset(value, maxItems = 8) {
  const rows = portfolioWidgetDatasetRows(value);
  if (!rows.length) return [];
  return rows
    .slice(0, maxItems)
    .map((row, index) => {
      const isPrimitiveRow = typeof row === "string" || typeof row === "number";
      const isArrayRow = Array.isArray(row);
      const arrayCells = isArrayRow ? row.map((cell) => String(cell ?? "").trim()).filter(Boolean) : [];
      const arrayTickerCell = arrayCells.find((cell) => isPortfolioWidgetTickerCandidateValid(cell));
      const arrayValueCell = arrayCells.find((cell) => parsePortfolioWidgetNumber(cell) > 0 && /[\d.]/.test(cell));
      const labelSource = isPrimitiveRow
        ? row
        : isArrayRow
          ? arrayCells[0]
          : row?.label || row?.ticker || row?.symbol || row?.code || row?.name || row?.asset || row?.category;
      const label = cleanPortfolioDatasetText(labelSource || `항목 ${index + 1}`, 42);
      const rawValue = isPrimitiveRow ? undefined : isArrayRow ? arrayValueCell : portfolioWidgetValueFromRow(row);
      const hasExplicitValue =
        (!isPrimitiveRow && !isArrayRow && portfolioWidgetHasRawValue(rawValue)) ||
        (isArrayRow && portfolioWidgetHasRawValue(arrayValueCell));
      const numericValue = parsePortfolioWidgetNumber(rawValue);
      const valueBasis = isPrimitiveRow
        ? "placeholder"
        : isArrayRow
          ? portfolioWidgetValueBasisFromRow({}, hasExplicitValue)
          : portfolioWidgetValueBasisFromRow(row, hasExplicitValue);
      const rawTicker = cleanPortfolioDatasetText(isPrimitiveRow || isArrayRow ? arrayTickerCell || "" : row?.ticker || row?.symbol || row?.code || "", 24).toUpperCase();
      const ticker = isPortfolioWidgetTickerCandidateValid(rawTicker) ? rawTicker : "";
      const rawDetail = cleanPortfolioDatasetText(isPrimitiveRow ? "" : isArrayRow ? arrayTickerCell || "" : row?.detail || row?.description || row?.ticker || row?.symbol || row?.code || "", 80);
      const detail = /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/i.test(rawDetail) && !isPortfolioWidgetTickerCandidateValid(rawDetail) ? "" : rawDetail;
      return {
        label,
        value: numericValue > 0 ? numericValue : hasExplicitValue ? 0 : 1,
        valueBasis,
        hasExplicitAllocationValue: valueBasis === "explicit" || valueBasis === "equal_weight",
        ticker,
        detail,
        color: cleanPortfolioDatasetText(
          isPrimitiveRow || isArrayRow ? portfolioWidgetChartColors[index % portfolioWidgetChartColors.length] : row?.color || portfolioWidgetChartColors[index % portfolioWidgetChartColors.length],
          20
        ),
      };
    })
    .filter((row) => row.label && row.value > 0 && !isPortfolioWidgetReferenceToken(row.label) && !isPortfolioWidgetSyntheticTickerOnlyRow(row));
}

export const portfolioWidgetKnownAssetPatterns = [
  { label: "삼성전자", detail: "005930.KS", pattern: /삼성전자|005930(?:\.ks)?/gi },
  { label: "SK 하이닉스", detail: "000660.KS", pattern: /sk\s*하이닉스|sk하이닉스|하이닉스|000660(?:\.ks)?/gi },
  { label: "마이크론", detail: "MU", pattern: /마이크론|micron|\bmu\b/gi },
  { label: "애플", detail: "AAPL", pattern: /애플|apple|\baapl\b/gi },
  { label: "엔비디아", detail: "NVDA", pattern: /엔비디아|nvidia|\bnvda\b/gi },
  { label: "테슬라", detail: "TSLA", pattern: /테슬라|tesla|\btsla\b/gi },
  { label: "AMD", detail: "AMD", pattern: /\bamd\b/gi },
  { label: "브로드컴", detail: "AVGO", pattern: /브로드컴|broadcom|\bavgo\b/gi },
  { label: "알파벳", detail: "GOOG", pattern: /알파벳|alphabet|\bgoogl?\b/gi },
  { label: "메타", detail: "META", pattern: /메타|meta platforms|\bmeta\b/gi },
  { label: "아마존", detail: "AMZN", pattern: /아마존|amazon|\bamzn\b/gi },
  { label: "마이크로소프트", detail: "MSFT", pattern: /마이크로소프트|microsoft|\bmsft\b/gi },
];

function splitPortfolioMarkdownTableRow(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed.includes("|")) return [];
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function portfolioWidgetDatasetFromMarkdownTable(text = "", maxItems = 24) {
  const rawLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));
  if (rawLines.length < 2) return [];

  for (let index = 0; index < rawLines.length - 1; index += 1) {
    const headerCells = splitPortfolioMarkdownTableRow(rawLines[index]);
    const separatorCells = splitPortfolioMarkdownTableRow(rawLines[index + 1]);
    const isSeparator = separatorCells.length && separatorCells.every((cell) => /^:?-{2,}:?$/.test(cell));
    if (!headerCells.length || !isSeparator) continue;

    const headerKeys = headerCells.map((cell) => cell.toLowerCase().replace(/\s+/g, ""));
    const findHeader = (patterns) => headerKeys.findIndex((key) => patterns.some((pattern) => pattern.test(key)));
    const labelIndex = findHeader([/종목/, /name/, /asset/, /회사/, /구성/]);
    const tickerIndex = findHeader([/티커/, /ticker/, /symbol/, /code/]);
    const valueIndex = findHeader([/비중/, /weight/, /ratio/, /percent/, /allocation/, /평가금액/, /평가액/, /marketvalue/, /amount/, /금액/, /현재가치/, /value/, /nav/]);
    const dataRows = [];

    for (let rowIndex = index + 2; rowIndex < rawLines.length; rowIndex += 1) {
      const cells = splitPortfolioMarkdownTableRow(rawLines[rowIndex]);
      if (cells.length < 2 || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) break;
      const labelCell = cells[labelIndex >= 0 ? labelIndex : 0] || "";
      const tickerCell = tickerIndex >= 0 ? cells[tickerIndex] || "" : cells.find((cell) => isPortfolioWidgetTickerCandidateValid(cell)) || "";
      const valueCell = valueIndex >= 0 ? cells[valueIndex] || "" : cells.find((cell) => parsePortfolioWidgetNumber(cell) > 0 && /[\d.]/.test(cell)) || "";
      const splitTickers = tickerCell.split(/[,/·\s]+/).map((item) => item.trim()).filter(isPortfolioWidgetTickerCandidateValid);
      if (splitTickers.length > 1 && (!labelCell || /포트폴리오|전략|균등|basket/i.test(labelCell))) {
        const explicitSplitValue = parsePortfolioWidgetNumber(valueCell);
        const equalValue = explicitSplitValue || 100 / splitTickers.length;
        splitTickers.forEach((ticker) =>
          dataRows.push({
            label: ticker.toUpperCase(),
            ticker: ticker.toUpperCase(),
            value: equalValue,
            valueBasis: explicitSplitValue ? "explicit" : "equal_weight",
            hasExplicitAllocationValue: true,
          })
        );
        continue;
      }
      const label = labelCell || tickerCell;
      if (!label) continue;
      const parsedValue = parsePortfolioWidgetNumber(valueCell);
      dataRows.push({
        label,
        ticker: tickerCell,
        ...(parsedValue > 0 ? { value: parsedValue, valueBasis: "explicit", hasExplicitAllocationValue: true } : { valueBasis: "placeholder" }),
        detail: tickerCell,
      });
    }

    const normalized = normalizePortfolioWidgetDataset(dataRows, maxItems);
    if (normalized.length) return normalized;
  }
  return [];
}
