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

  return {
    event_name: event.eventName,
    event_time: event.eventTime,
    event_id: event.eventId,
    event_source_url: event.eventSourceUrl,
    action_source: event.actionSource,
    user_data: userData,
  };
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
