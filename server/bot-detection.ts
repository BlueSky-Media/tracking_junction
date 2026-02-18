const BOT_UA_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /meta-externalads/i, type: "Facebook Crawler" },
  { pattern: /facebookexternalhit/i, type: "Facebook Crawler" },
  { pattern: /facebot/i, type: "Facebook Crawler" },
  { pattern: /googlebot/i, type: "Google Bot" },
  { pattern: /bingbot/i, type: "Bing Bot" },
  { pattern: /yandex/i, type: "Yandex Bot" },
  { pattern: /baiduspider/i, type: "Baidu Bot" },
  { pattern: /duckduckbot/i, type: "DuckDuckGo Bot" },
  { pattern: /applebot/i, type: "Apple Bot" },
  { pattern: /slurp/i, type: "Yahoo Bot" },
  { pattern: /semrush/i, type: "SEMRush Bot" },
  { pattern: /ahrefs/i, type: "Ahrefs Bot" },
  { pattern: /mj12bot/i, type: "Majestic Bot" },
  { pattern: /dotbot/i, type: "DotBot" },
  { pattern: /petalbot/i, type: "Petal Bot" },
  { pattern: /bytespider/i, type: "ByteDance Bot" },
  { pattern: /gptbot/i, type: "GPT Bot" },
  { pattern: /claudebot/i, type: "Claude Bot" },
  { pattern: /ccbot/i, type: "Common Crawl Bot" },
  { pattern: /ia_archiver/i, type: "Alexa Bot" },
  { pattern: /bot\b/i, type: "Bot (Generic)" },
  { pattern: /crawler/i, type: "Crawler (Generic)" },
  { pattern: /spider/i, type: "Spider (Generic)" },
  { pattern: /crawling/i, type: "Crawler (Generic)" },
  { pattern: /mediapartners/i, type: "Google Ads Bot" },
  { pattern: /pingdom/i, type: "Monitoring Bot" },
  { pattern: /uptimerobot/i, type: "Monitoring Bot" },
  { pattern: /site24x7/i, type: "Monitoring Bot" },
  { pattern: /headlesschrome/i, type: "Headless Browser" },
  { pattern: /phantomjs/i, type: "Headless Browser" },
  { pattern: /selenium/i, type: "Automation Tool" },
  { pattern: /puppeteer/i, type: "Automation Tool" },
  { pattern: /playwright/i, type: "Automation Tool" },
  { pattern: /wget/i, type: "HTTP Client" },
  { pattern: /curl\//i, type: "HTTP Client" },
  { pattern: /python-requests/i, type: "HTTP Client" },
  { pattern: /python-urllib/i, type: "HTTP Client" },
  { pattern: /go-http-client/i, type: "HTTP Client" },
  { pattern: /java\//i, type: "HTTP Client" },
  { pattern: /apache-httpclient/i, type: "HTTP Client" },
  { pattern: /okhttp/i, type: "HTTP Client" },
  { pattern: /node-fetch/i, type: "HTTP Client" },
  { pattern: /axios/i, type: "HTTP Client" },
  { pattern: /scrapy/i, type: "Scraper" },
  { pattern: /nutch/i, type: "Scraper" },
  { pattern: /linkchecker/i, type: "Link Checker" },
  { pattern: /w3c_validator/i, type: "Validator" },
  { pattern: /httrack/i, type: "Scraper" },
  { pattern: /archive\.org/i, type: "Archive Bot" },
  { pattern: /screaming frog/i, type: "SEO Crawler" },
  { pattern: /dataprovider/i, type: "Data Provider Bot" },
  { pattern: /neevabot/i, type: "Search Bot" },
  { pattern: /testbot/i, type: "Test Bot" },
  { pattern: /test-agent/i, type: "Test Bot" },
  { pattern: /manualtest/i, type: "Test Bot" },
];

const FACEBOOK_IPV6_PREFIXES = [
  "2a03:2880:",
];

const FACEBOOK_IPV4_PREFIXES = [
  "69.63.176.",
  "69.63.177.",
  "69.63.178.",
  "69.63.179.",
  "69.63.180.",
  "69.63.181.",
  "69.63.184.",
  "69.63.185.",
  "69.63.186.",
  "69.63.187.",
  "69.171.224.",
  "69.171.225.",
  "69.171.226.",
  "69.171.227.",
  "69.171.228.",
  "69.171.229.",
  "69.171.230.",
  "69.171.231.",
  "69.171.232.",
  "69.171.233.",
  "69.171.234.",
  "69.171.235.",
  "69.171.236.",
  "69.171.237.",
  "69.171.238.",
  "69.171.239.",
  "69.171.240.",
  "69.171.241.",
  "69.171.242.",
  "69.171.243.",
  "69.171.244.",
  "69.171.245.",
  "69.171.246.",
  "69.171.247.",
  "69.171.248.",
  "69.171.249.",
  "69.171.250.",
  "69.171.251.",
  "69.171.252.",
  "69.171.253.",
  "69.171.254.",
  "69.171.255.",
  "66.220.144.",
  "66.220.145.",
  "66.220.146.",
  "66.220.147.",
  "66.220.148.",
  "66.220.149.",
  "66.220.150.",
  "66.220.151.",
  "66.220.152.",
  "66.220.153.",
  "66.220.154.",
  "66.220.155.",
  "66.220.156.",
  "66.220.157.",
  "66.220.158.",
  "66.220.159.",
  "31.13.24.",
  "31.13.25.",
  "31.13.26.",
  "31.13.27.",
  "31.13.64.",
  "31.13.65.",
  "31.13.66.",
  "31.13.67.",
  "31.13.68.",
  "31.13.69.",
  "31.13.70.",
  "31.13.71.",
  "31.13.72.",
  "31.13.73.",
  "31.13.74.",
  "31.13.75.",
  "31.13.76.",
  "31.13.77.",
  "31.13.78.",
  "31.13.79.",
  "31.13.80.",
  "31.13.81.",
  "31.13.82.",
  "31.13.83.",
  "31.13.84.",
  "31.13.85.",
  "31.13.86.",
  "31.13.87.",
  "31.13.88.",
  "31.13.89.",
  "31.13.90.",
  "31.13.91.",
  "31.13.92.",
  "31.13.93.",
  "31.13.94.",
  "31.13.95.",
  "157.240.",
  "173.252.",
  "179.60.192.",
  "179.60.193.",
  "179.60.194.",
  "179.60.195.",
  "185.60.216.",
  "185.60.217.",
  "185.60.218.",
  "185.60.219.",
  "204.15.20.",
];

export interface CustomBotRule {
  id: number;
  ruleType: "ip_prefix" | "ua_pattern";
  value: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

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
  botType: string | null;
  reasons: string[];
}

function isFromFacebookIP(ip: string): boolean {
  for (const prefix of FACEBOOK_IPV6_PREFIXES) {
    if (ip.startsWith(prefix)) return true;
  }
  for (const prefix of FACEBOOK_IPV4_PREFIXES) {
    if (ip.startsWith(prefix)) return true;
  }
  return false;
}

export function detectBot(input: BotDetectionInput, customRules?: CustomBotRule[]): BotDetectionResult {
  const reasons: string[] = [];
  let botType: string | null = null;

  if (!input.userAgent || input.userAgent.trim().length === 0) {
    reasons.push("missing_ua");
    botType = "Missing User Agent";
  } else {
    for (const { pattern, type } of BOT_UA_PATTERNS) {
      if (pattern.test(input.userAgent)) {
        reasons.push("bot_ua");
        botType = type;
        break;
      }
    }

    if (input.userAgent.length < 30 && !botType) {
      reasons.push("short_ua");
      botType = "Short User Agent";
    }

    if (customRules) {
      for (const rule of customRules) {
        if (!rule.enabled) continue;
        if (rule.ruleType === "ua_pattern") {
          try {
            const re = new RegExp(rule.value, "i");
            if (re.test(input.userAgent)) {
              reasons.push("custom_ua_rule");
              botType = rule.label || "Custom UA Rule";
              break;
            }
          } catch {}
        }
      }
    }
  }

  if (input.ipAddress && isFromFacebookIP(input.ipAddress)) {
    if (!botType) {
      botType = "Facebook Prefetcher";
    }
    reasons.push("facebook_ip");
  }

  if (input.ipAddress && customRules) {
    for (const rule of customRules) {
      if (!rule.enabled) continue;
      if (rule.ruleType === "ip_prefix") {
        if (input.ipAddress.startsWith(rule.value)) {
          reasons.push("custom_ip_rule");
          if (!botType) botType = rule.label || "Custom IP Rule";
          break;
        }
      }
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
    if (!botType) botType = "No Browser Fingerprint";
  }

  return {
    isBot: reasons.length > 0,
    botType,
    reasons,
  };
}

export function detectBotFromUA(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  for (const { pattern } of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) return true;
  }
  return false;
}
