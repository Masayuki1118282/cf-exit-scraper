import { log } from './logger';

const cache = new Map<string, { rules: RobotsRule[]; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RobotsRule {
  userAgent: string;
  disallowed: string[];
}

async function fetchRobotsTxt(baseUrl: string): Promise<string> {
  const url = `${baseUrl}/robots.txt`;
  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.SCRAPER_USER_AGENT ?? 'CFExit-Bot/1.0' },
  });
  if (!res.ok) {
    log('warn', 'robots_fetch_failed', { url, status: res.status });
    return '';
  }
  return res.text();
}

function parseRobotsTxt(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let currentAgents: string[] = [];
  let currentDisallowed: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();

    if (field.toLowerCase() === 'user-agent') {
      if (currentAgents.length > 0 && currentDisallowed.length > 0) {
        for (const agent of currentAgents) {
          rules.push({ userAgent: agent.toLowerCase(), disallowed: [...currentDisallowed] });
        }
      }
      if (value === '*' || currentAgents[currentAgents.length - 1] !== value) {
        if (!currentDisallowed.length) {
          currentAgents.push(value.toLowerCase());
        } else {
          currentAgents = [value.toLowerCase()];
          currentDisallowed = [];
        }
      }
    } else if (field.toLowerCase() === 'disallow' && value) {
      currentDisallowed.push(value);
    }
  }

  if (currentAgents.length > 0 && currentDisallowed.length > 0) {
    for (const agent of currentAgents) {
      rules.push({ userAgent: agent.toLowerCase(), disallowed: [...currentDisallowed] });
    }
  }

  return rules;
}

async function getRules(baseUrl: string): Promise<RobotsRule[]> {
  const cached = cache.get(baseUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules;
  }
  const text = await fetchRobotsTxt(baseUrl);
  const rules = parseRobotsTxt(text);
  cache.set(baseUrl, { rules, fetchedAt: Date.now() });
  return rules;
}

export async function isAllowed(baseUrl: string, path: string): Promise<boolean> {
  const rules = await getRules(baseUrl);
  const botAgent = (process.env.SCRAPER_USER_AGENT ?? 'cfexit-bot').toLowerCase().split('/')[0];

  const applicableRules = rules.filter(
    (r) => r.userAgent === '*' || botAgent.includes(r.userAgent)
  );

  for (const rule of applicableRules) {
    for (const disallowedPath of rule.disallowed) {
      if (path.startsWith(disallowedPath)) {
        log('warn', 'robots_disallowed', { baseUrl, path, disallowedPath });
        return false;
      }
    }
  }
  return true;
}
