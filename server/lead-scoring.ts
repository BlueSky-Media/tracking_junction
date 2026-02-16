export interface BudgetRange {
  min: number;
  max: number | null;
}

export function parseBudgetRange(budget: string): BudgetRange | null {
  if (!budget) return null;

  const cleaned = budget.replace(/[^0-9+\-$.,]/g, " ").trim();

  const plusMatch = cleaned.match(/\$?([\d,]+)\+/);
  if (plusMatch) {
    return { min: parseFloat(plusMatch[1].replace(/,/g, "")), max: null };
  }

  const rangeMatch = cleaned.match(/\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/);
  if (rangeMatch) {
    return {
      min: parseFloat(rangeMatch[1].replace(/,/g, "")),
      max: parseFloat(rangeMatch[2].replace(/,/g, "")),
    };
  }

  const singleMatch = cleaned.match(/\$?([\d,]+)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(/,/g, ""));
    return { min: val, max: val };
  }

  return null;
}

export function calculateAnnualPremiumEstimate(budget: string): number {
  const range = parseBudgetRange(budget);
  if (!range) return 0;

  const midpoint = range.max !== null
    ? (range.min + range.max) / 2
    : range.min;

  return Math.round(midpoint * 12);
}

export type LeadTier = "qualified" | "disqualified" | "high_value_customer" | "low_value_customer";

export function classifyCustomerTier(annualPremium: number): "high_value_customer" | "low_value_customer" {
  return annualPremium >= 1200 ? "high_value_customer" : "low_value_customer";
}

export function getCapiEventName(tier: LeadTier): string {
  switch (tier) {
    case "qualified": return "QualifiedLead";
    case "disqualified": return "DisqualifiedLead";
    case "high_value_customer": return "HighValueCustomer";
    case "low_value_customer": return "LowValueCustomer";
  }
}
