import crypto from "crypto";

const GRAPH_API_VERSION = "v24.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export interface ConversionEventData {
  eventName: string;
  eventTime: number;
  eventId: string;
  eventSourceUrl?: string;
  actionSource: "website";
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    state?: string;
    country?: string;
    externalId?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbp?: string;
    fbc?: string;
    fbclid?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    content_name?: string;
  };
}

interface MetaServerEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source: "website";
  user_data: Record<string, any>;
}

function formatEventForMeta(event: ConversionEventData): MetaServerEvent {
  const userData: Record<string, any> = {};

  if (event.userData.email) {
    userData.em = [sha256Hash(event.userData.email)];
  }
  if (event.userData.phone) {
    userData.ph = [sha256Hash(normalizePhone(event.userData.phone))];
  }
  if (event.userData.firstName) {
    userData.fn = [sha256Hash(event.userData.firstName)];
  }
  if (event.userData.lastName) {
    userData.ln = [sha256Hash(event.userData.lastName)];
  }
  if (event.userData.state) {
    userData.st = [sha256Hash(event.userData.state)];
  }
  if (event.userData.country) {
    userData.country = [sha256Hash(event.userData.country)];
  }
  if (event.userData.externalId) {
    userData.external_id = [sha256Hash(event.userData.externalId)];
  }
  if (event.userData.clientIpAddress) {
    userData.client_ip_address = event.userData.clientIpAddress;
  }
  if (event.userData.clientUserAgent) {
    userData.client_user_agent = event.userData.clientUserAgent;
  }
  if (event.userData.fbp) {
    userData.fbp = event.userData.fbp;
  }
  if (event.userData.fbc) {
    userData.fbc = event.userData.fbc;
  }

  const result: MetaServerEvent & { custom_data?: Record<string, any> } = {
    event_name: event.eventName,
    event_time: event.eventTime,
    event_id: event.eventId,
    event_source_url: event.eventSourceUrl,
    action_source: event.actionSource,
    user_data: userData,
  };

  if (event.customData) {
    result.custom_data = {};
    if (event.customData.value !== undefined) result.custom_data.value = event.customData.value;
    if (event.customData.currency) result.custom_data.currency = event.customData.currency;
    if (event.customData.content_name) result.custom_data.content_name = event.customData.content_name;
  }

  return result;
}

export interface CAPIResponse {
  events_received: number;
  messages: string[];
  fbtrace_id: string;
}

export interface CAPIError {
  message: string;
  type: string;
  code: number;
  fbtrace_id: string;
}

export async function sendConversionEvents(
  pixelId: string,
  accessToken: string,
  events: ConversionEventData[],
  testEventCode?: string,
): Promise<CAPIResponse> {
  const formattedEvents = events.map(formatEventForMeta);

  const payload: Record<string, any> = {
    data: formattedEvents,
  };
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const url = `${GRAPH_API_BASE}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const error = responseData?.error || {};
    throw new MetaConversionError(
      error.message || "Unknown CAPI error",
      error.code || response.status,
      error.fbtrace_id || "",
    );
  }

  return responseData as CAPIResponse;
}

export class MetaConversionError extends Error {
  code: number;
  fbtraceId: string;
  constructor(message: string, code: number, fbtraceId: string) {
    super(message);
    this.name = "MetaConversionError";
    this.code = code;
    this.fbtraceId = fbtraceId;
  }
}

export function buildConversionEvent(formCompleteEvent: {
  eventId?: string | null;
  sessionId: string;
  eventTimestamp: Date;
  pageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  geoState?: string | null;
  country?: string | null;
  externalId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
}): ConversionEventData {
  return {
    eventName: "Lead",
    eventTime: Math.floor(formCompleteEvent.eventTimestamp.getTime() / 1000),
    eventId: formCompleteEvent.eventId || `fc_${formCompleteEvent.sessionId}`,
    eventSourceUrl: formCompleteEvent.pageUrl || undefined,
    actionSource: "website",
    userData: {
      email: formCompleteEvent.email || undefined,
      phone: formCompleteEvent.phone || undefined,
      firstName: formCompleteEvent.firstName || undefined,
      lastName: formCompleteEvent.lastName || undefined,
      state: formCompleteEvent.geoState || undefined,
      country: formCompleteEvent.country || undefined,
      externalId: formCompleteEvent.externalId || undefined,
      clientIpAddress: formCompleteEvent.ipAddress || undefined,
      clientUserAgent: formCompleteEvent.userAgent || undefined,
      fbp: formCompleteEvent.fbp || undefined,
      fbc: formCompleteEvent.fbc || undefined,
      fbclid: formCompleteEvent.fbclid || undefined,
    },
  };
}

export interface AudienceSignalData {
  eventId?: string | null;
  sessionId: string;
  eventTimestamp: Date;
  pageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  geoState?: string | null;
  country?: string | null;
  externalId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
}

export function buildAudienceEvent(
  capiEventName: string,
  data: AudienceSignalData,
  value: number,
  contentName?: string,
): ConversionEventData {
  return {
    eventName: capiEventName,
    eventTime: Math.floor(data.eventTimestamp.getTime() / 1000),
    eventId: `${capiEventName.toLowerCase()}_${data.eventId || data.sessionId}`,
    eventSourceUrl: data.pageUrl || undefined,
    actionSource: "website",
    userData: {
      email: data.email || undefined,
      phone: data.phone || undefined,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      state: data.geoState || undefined,
      country: data.country || undefined,
      externalId: data.externalId || undefined,
      clientIpAddress: data.ipAddress || undefined,
      clientUserAgent: data.userAgent || undefined,
      fbp: data.fbp || undefined,
      fbc: data.fbc || undefined,
      fbclid: data.fbclid || undefined,
    },
    customData: {
      value,
      currency: "USD",
      content_name: contentName,
    },
  };
}

export async function fireAudienceSignal(
  capiEventName: string,
  data: AudienceSignalData,
  value: number,
  contentName?: string,
): Promise<{ success: boolean; error?: string }> {
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.log(`[CAPI Audience] Skipping ${capiEventName} — CAPI not configured`);
    return { success: false, error: "CAPI not configured" };
  }

  try {
    const event = buildAudienceEvent(capiEventName, data, value, contentName);
    const response = await sendConversionEvents(pixelId, accessToken, [event]);
    console.log(`[CAPI Audience] Fired ${capiEventName} for session ${data.sessionId}, events_received: ${response.events_received}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof MetaConversionError ? error.message : String(error);
    console.error(`[CAPI Audience] Failed to fire ${capiEventName} for session ${data.sessionId}:`, msg);
    return { success: false, error: msg };
  }
}
