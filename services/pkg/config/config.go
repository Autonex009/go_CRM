package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// OAuthCredentials holds the client credentials for a single OIDC provider.
type OAuthCredentials struct {
	ClientID     string
	ClientSecret string
}

// Config holds runtime configuration loaded from the environment.
type Config struct {
	DatabaseURL string
	JWTSecret   string
	JWTIssuer   string
	// JWTAccessTTL is how long an issued access token stays valid. Short on
	// purpose — the refresh token below is what keeps a session alive.
	JWTAccessTTL time.Duration
	// JWTRefreshTTL is how long a refresh token (and so a session) lasts.
	JWTRefreshTTL time.Duration
	NATSURL       string
	GatewayAddr   string
	// Timezone is the session time zone for every database connection; it decides
	// what CURRENT_DATE means, and so what "overdue" and "due today" mean.
	Timezone string
	// WebAppURL is the SPA origin the SSO callback redirects back to.
	WebAppURL string
	// OIDCRedirectBase is the public base URL of the SSO routes, e.g.
	// http://localhost:8080/api/v1/auth/sso — the provider callback URL is
	// "<base>/<provider>/callback".
	OIDCRedirectBase string
	// IntegrationsRedirectBase is the public base URL of the third-party connect
	// routes; the callback is "<base>/<provider>/callback". It is separate from
	// OIDCRedirectBase because signing in and connecting a calendar are different
	// consents, and Google matches the redirect URI exactly.
	IntegrationsRedirectBase string
	// OAuthCreds holds credentials keyed by provider name ("google", "github").
	// Only providers with a non-empty client id are considered enabled.
	OAuthCreds map[string]OAuthCredentials

	// SSOAllowedDomains restricts which email domains may sign in through SSO.
	// Empty means no restriction, which is the historical behaviour.
	//
	// This is a second lock, not the first: an Internal consent screen already
	// stops anyone outside the Workspace. It exists so that publishing the app
	// externally, or pointing it at a different OAuth client, cannot quietly turn
	// the CRM into an open sign-up.
	SSOAllowedDomains []string

	// SSODefaultOrgID is the organization a new SSO user joins. Empty keeps the
	// old behaviour of giving each signup its own workspace.
	//
	// An id rather than a name: a workspace can be renamed from the settings
	// screen, and a rename must not silently start scattering new colleagues into
	// separate organizations again.
	SSODefaultOrgID string

	// SSOAutoProvision decides what happens when an SSO identity clears the
	// domain check but belongs to nobody in the workspace.
	//
	// Off (the default) means SSO signs people in but never signs them up: an
	// unknown address needs an invitation from Team & Settings first. That makes
	// the member list the access list, which is the only place it can be kept
	// honest — a domain allow-list admits every mailbox the Google Workspace will
	// ever have, including ones created next year.
	//
	// On restores the old behaviour, where any address on an allowed domain was
	// provisioned into SSODefaultOrgID on first sign-in.
	SSOAutoProvision bool

	// AllowSelfRegistration decides whether anyone may create their own
	// password account at POST /auth/register.
	//
	// Off by default, and off is the only setting consistent with a per-person
	// access list. A domain-checked open registration endpoint is a way straight
	// past that list: a colleague with a company address could sign themselves
	// up and land in the shared workspace without anyone granting it. Existing
	// password accounts are untouched either way — this gates sign-up, not
	// sign-in, and new people arrive by invitation instead.
	AllowSelfRegistration bool

	// SMTP settings for notification email. SMTPHost and SMTPFrom are what make
	// mail live: with either missing, notifications are skipped rather than
	// failing, so a deployment without a relay still works normally.
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
	SMTPFromName string

	// ExpoAccessToken authenticates pushes to Expo's service. Expo accepts
	// unauthenticated sends, so this stays empty unless the project has enhanced
	// security enabled — then it comes from expo.dev > Account > Access tokens.
	ExpoAccessToken string

	// Supabase Storage, for Implementation ask attachments. With either the URL
	// or the key missing, attachments are refused and everything else works.
	//
	// SupabaseSecretKey is an sb_secret_... key, or a legacy service_role JWT.
	// Never a publishable key: the bucket is private with no policies, so only
	// a key that bypasses RLS can read or write it.
	SupabaseURL           string
	SupabaseSecretKey     string
	SupabaseStorageBucket string
}

// knownProviders is the set of OIDC providers whose endpoints the auth module
// knows about. Credentials are read from <UPPER>_CLIENT_ID / _CLIENT_SECRET.
var knownProviders = []string{"google", "github"}

// Load reads configuration from environment variables with sane defaults.
// It first loads a .env file (searched from the working directory upward) if
// present; real environment variables always take precedence over .env values.
func Load() Config {
	loadDotenv()
	return Config{
		DatabaseURL:      getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/gocrm?sslmode=disable"),
		JWTSecret:        getenv("JWT_SECRET", "change-me-in-production"),
		JWTIssuer:        getenv("JWT_ISSUER", "go-crm"),
		JWTAccessTTL:     getdur("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL:    getdur("JWT_REFRESH_TTL", 30*24*time.Hour),
		NATSURL:          getenv("NATS_URL", "nats://localhost:4222"),
		GatewayAddr:      gatewayAddr(),
		WebAppURL:        getenv("WEB_APP_URL", "http://localhost:4321"),
		OIDCRedirectBase: getenv("OIDC_REDIRECT_BASE", "http://localhost:8080/api/v1/auth/sso"),
		IntegrationsRedirectBase: getenv("INTEGRATIONS_REDIRECT_BASE",
			"http://localhost:8080/api/v1/integrations"),
		Timezone:          getenv("APP_TIMEZONE", "UTC"),
		OAuthCreds:        loadOAuthCreds(),
		SSOAllowedDomains: loadAllowedDomains(),
		SSODefaultOrgID:   getenv("SSO_DEFAULT_ORG_ID", ""),
		SSOAutoProvision:  getenv("SSO_AUTO_PROVISION", "") == "true",

		AllowSelfRegistration: getenv("ALLOW_SELF_REGISTRATION", "") == "true",

		SMTPHost:     getenv("SMTP_HOST", ""),
		SMTPPort:     getint("SMTP_PORT", 587),
		SMTPUser:     getenv("SMTP_USER", ""),
		SMTPPassword: getenv("SMTP_PASSWORD", ""),
		SMTPFrom:     getenv("SMTP_FROM", ""),
		SMTPFromName: getenv("SMTP_FROM_NAME", "go-CRM"),

		ExpoAccessToken: getenv("EXPO_ACCESS_TOKEN", ""),

		SupabaseURL: getenv("SUPABASE_URL", ""),
		// SUPABASE_SECRET_KEY is the current name; SUPABASE_SERVICE_KEY is read
		// as a fallback so an existing deployment keeps working across the
		// rename.
		SupabaseSecretKey:     getenv("SUPABASE_SECRET_KEY", getenv("SUPABASE_SERVICE_KEY", "")),
		SupabaseStorageBucket: getenv("SUPABASE_STORAGE_BUCKET", "implementation-attachments"),
	}
}

// loadDotenv walks up from the working directory looking for a .env file and
// loads it. godotenv.Load does not override variables already set in the
// environment, so real env vars win. Missing .env is not an error (production
// typically injects env vars directly).
func loadDotenv() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for range 6 {
		p := filepath.Join(dir, ".env")
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
		dir = parent
	}
}

// gatewayAddr resolves the address the HTTP server listens on.
//
// PORT wins because that is how every PaaS (Railway included) hands a container
// its assigned port, and it is the only port routed to from the edge — a
// GATEWAY_ADDR carried over from a local .env would bind the wrong one and every
// health check would fail. GATEWAY_ADDR stays as the local knob.
func gatewayAddr() string {
	if p := os.Getenv("PORT"); p != "" {
		return ":" + p
	}
	return getenv("GATEWAY_ADDR", ":8080")
}

func loadOAuthCreds() map[string]OAuthCredentials {
	creds := make(map[string]OAuthCredentials)
	for _, name := range knownProviders {
		prefix := strings.ToUpper(name)
		id := os.Getenv(prefix + "_CLIENT_ID")
		if id == "" {
			continue // provider not configured
		}
		creds[name] = OAuthCredentials{
			ClientID:     id,
			ClientSecret: os.Getenv(prefix + "_CLIENT_SECRET"),
		}
	}
	return creds
}

// loadAllowedDomains parses SSO_ALLOWED_DOMAINS, a comma-separated list such as
// "autonexai360.com". Values are lower-cased and stripped of a leading "@" so
// either spelling works.
func loadAllowedDomains() []string {
	raw := os.Getenv("SSO_ALLOWED_DOMAINS")
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		d := strings.ToLower(strings.TrimSpace(part))
		d = strings.TrimPrefix(d, "@")
		if d != "" {
			out = append(out, d)
		}
	}
	return out
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getint(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getdur(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
