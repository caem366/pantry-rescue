import { randomBytes } from "node:crypto";

const AUTHORIZE_URL = "https://api.kroger.com/v1/connect/oauth2/authorize";
const TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const STATE_TTL_MS = 10 * 60 * 1000;

export type KrogerOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type PendingState = { sessionId: string; createdAt: number; returnTo: string };
type SessionToken = { accessToken: string; expiresAt: number };

function safeReturnOrigin(value: string | undefined): string {
  if (!value) return "http://127.0.0.1:5173";
  try {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "http://127.0.0.1:5173";
    return url.origin;
  } catch {
    return "http://127.0.0.1:5173";
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

export class KrogerOAuth {
  private readonly pending = new Map<string, PendingState>();
  private readonly sessions = new Map<string, SessionToken>();
  private readonly config: KrogerOAuthConfig;
  private readonly fetcher: typeof fetch;

  constructor(
    config: KrogerOAuthConfig,
    fetcher: typeof fetch = fetch,
  ) {
    this.config = config;
    this.fetcher = fetcher;
  }

  get configured() {
    return Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri);
  }

  begin(sessionId: string, returnTo?: string): string {
    if (!this.configured) throw new Error("Kroger app credentials and redirect URI are not configured on the shopping service.");
    const now = Date.now();
    for (const [state, pending] of this.pending) {
      if (now - pending.createdAt > STATE_TTL_MS) this.pending.delete(state);
    }
    const state = randomBytes(32).toString("base64url");
    this.pending.set(state, { sessionId, createdAt: now, returnTo: safeReturnOrigin(returnTo) });
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "product.compact cart.basic:write");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async complete(sessionId: string, state: string, code: string): Promise<string> {
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending || pending.sessionId !== sessionId || Date.now() - pending.createdAt > STATE_TTL_MS) {
      throw new Error("Kroger authorization state is invalid or expired. Start the connection again.");
    }
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await this.fetcher(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });
    if (!response.ok) throw new Error(`Kroger authorization could not be completed (${response.status}).`);
    const body = object(await response.json());
    const accessToken = body?.access_token;
    const expiresIn = body?.expires_in;
    if (typeof accessToken !== "string" || !accessToken || typeof expiresIn !== "number" || expiresIn <= 0) {
      throw new Error("Kroger returned an incomplete authorization response.");
    }
    this.sessions.set(sessionId, { accessToken, expiresAt: Date.now() + expiresIn * 1000 });
    return pending.returnTo;
  }

  getAccessToken(sessionId: string): string | undefined {
    const token = this.sessions.get(sessionId);
    if (!token) return undefined;
    if (token.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return token.accessToken;
  }

  disconnect(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
