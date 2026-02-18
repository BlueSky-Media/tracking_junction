const BOT_UA_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /slurp/i,
  /mediapartners/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baiduspider/i,
  /duckduckbot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /ia_archiver/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /ccbot/i,
  /applebot/i,
  /pingdom/i,
  /uptimerobot/i,
  /site24x7/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /wget/i,
  /curl\//i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /apache-httpclient/i,
  /okhttp/i,
  /node-fetch/i,
  /axios/i,
  /scrapy/i,
  /nutch/i,
  /linkchecker/i,
  /w3c_validator/i,
  /httrack/i,
  /archive\.org/i,
  /screaming frog/i,
  /dataprovider/i,
  /neevabot/i,
  /testbot/i,
  /test-agent/i,
  /manualtest/i,
];

interface BotDetectionInput {
  userAgent: string | null;
  ipAddress: string | null;
  screenResolution: string | null;
  viewport: string | null;
  language: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
}

interface BotDetectionResult {
  isBot: boolean;
  reasons: string[];
}

export function detectBot(input: BotDetectionInput): BotDetectionResult {
  const reasons: string[] = [];

  if (!input.userAgent || input.userAgent.trim().length === 0) {
    reasons.push("missing_ua");
  } else {
    for (const pattern of BOT_UA_PATTERNS) {
      if (pattern.test(input.userAgent)) {
        reasons.push("bot_ua");
        break;
      }
    }

    if (input.userAgent.length < 30) {
      reasons.push("short_ua");
    }
  }

  const missingFingerprints: string[] = [];
  if (!input.screenResolution) missingFingerprints.push("screen");
  if (!input.viewport) missingFingerprints.push("viewport");
  if (!input.language) missingFingerprints.push("lang");
  if (!input.browser) missingFingerprints.push("browser");
  if (!input.os) missingFingerprints.push("os");

  if (missingFingerprints.length >= 4) {
    reasons.push("no_fingerprint:" + missingFingerprints.join(","));
  }

  return {
    isBot: reasons.length > 0,
    reasons,
  };
}

export function detectBotFromUA(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) return true;
  }
  return false;
}
