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

export interface SignalRuleConditions {
  audience?: string[];
  domain?: string[];
  deviceType?: string[];
  geoState?: string[];
  stepName?: string[];
  stepNumber?: number[];
  minTimeOnStep?: number;
  maxTimeOnStep?: number;
  minBudget?: number;
  maxBudget?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  pageType?: string[];
}

export interface EventContext {
  eventType: string;
  page: string;
  pageType: string;
  domain: string;
  stepNumber: number;
  stepName: string;
  selectedValue?: string | null;
  timeOnStep?: number | null;
  deviceType?: string | null;
  geoState?: string | null;
  email?: string | null;
  phone?: string | null;
  quizAnswers?: Record<string, any> | null;
}

export function evaluateRuleConditions(conditions: SignalRuleConditions, event: EventContext): boolean {
  if (conditions.audience && conditions.audience.length > 0) {
    if (!conditions.audience.includes(event.page)) return false;
  }
  if (conditions.domain && conditions.domain.length > 0) {
    if (!conditions.domain.includes(event.domain)) return false;
  }
  if (conditions.deviceType && conditions.deviceType.length > 0) {
    if (!event.deviceType || !conditions.deviceType.includes(event.deviceType)) return false;
  }
  if (conditions.geoState && conditions.geoState.length > 0) {
    if (!event.geoState || !conditions.geoState.includes(event.geoState)) return false;
  }
  if (conditions.stepName && conditions.stepName.length > 0) {
    if (!conditions.stepName.includes(event.stepName)) return false;
  }
  if (conditions.stepNumber && conditions.stepNumber.length > 0) {
    if (!conditions.stepNumber.includes(event.stepNumber)) return false;
  }
  if (conditions.pageType && conditions.pageType.length > 0) {
    if (!conditions.pageType.includes(event.pageType)) return false;
  }
  if (conditions.minTimeOnStep !== undefined && conditions.minTimeOnStep !== null) {
    if (!event.timeOnStep || event.timeOnStep < conditions.minTimeOnStep) return false;
  }
  if (conditions.maxTimeOnStep !== undefined && conditions.maxTimeOnStep !== null) {
    if (!event.timeOnStep || event.timeOnStep > conditions.maxTimeOnStep) return false;
  }
  if (conditions.hasEmail === true) {
    if (!event.email) return false;
  }
  if (conditions.hasPhone === true) {
    if (!event.phone) return false;
  }
  if (conditions.minBudget !== undefined || conditions.maxBudget !== undefined) {
    const budget = event.quizAnswers?.budget || event.quizAnswers?.["Budget Affordability"] || "";
    const range = parseBudgetRange(String(budget));
    if (!range) return false;
    const midpoint = range.max !== null ? (range.min + range.max) / 2 : range.min;
    if (conditions.minBudget !== undefined && midpoint < conditions.minBudget) return false;
    if (conditions.maxBudget !== undefined && midpoint > conditions.maxBudget) return false;
  }
  return true;
}

export function computeRuleValue(customValue: number | null | undefined, event: EventContext): number {
  if (customValue !== null && customValue !== undefined) return customValue;
  const budget = event.quizAnswers?.budget || event.quizAnswers?.["Budget Affordability"] || "";
  return calculateAnnualPremiumEstimate(String(budget));
}
