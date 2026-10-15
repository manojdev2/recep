// Static catalog recovered from the original app: voices, languages, jobs, models,
// tools, channels, connectors, templates, number providers and countries.

export type Voice = { id: string; name: string; gender: string; tone: string; provider: "aether" | "openai" };
export type ConnectorField = {
  key: string;
  label?: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  options?: string[];
};
export type Connector = {
  key: string;
  name: string;
  kind: string;
  category?: string;
  description: string;
  help?: string;
  docs?: string;
  deprecated?: boolean;
  fields: ConnectorField[];
};

export const VOICES: Voice[] = [
    {
      id: "eve",
      name: "Eve",
      gender: "Female",
      tone: "Clear, composed, default",
      provider: "aether",
    },
    {
      id: "carina",
      name: "Carina",
      gender: "Female",
      tone: "Soft, empathetic, wellness",
      provider: "aether",
    },
    {
      id: "luna",
      name: "Luna",
      gender: "Female",
      tone: "Warm, unhurried, front desk",
      provider: "aether",
    },
    {
      id: "ara",
      name: "Ara",
      gender: "Female",
      tone: "Bright, precise, retail",
      provider: "aether",
    },
    {
      id: "aurora",
      name: "Aurora",
      gender: "Female",
      tone: "Calm, measured, care",
      provider: "aether",
    },
    {
      id: "celeste",
      name: "Celeste",
      gender: "Female",
      tone: "Refined, formal, concierge",
      provider: "aether",
    },
    {
      id: "iris",
      name: "Iris",
      gender: "Female",
      tone: "Curious, light, onboarding",
      provider: "aether",
    },
    {
      id: "liora",
      name: "Liora",
      gender: "Female",
      tone: "Steady, trustworthy, finance",
      provider: "aether",
    },
    {
      id: "ursa",
      name: "Ursa",
      gender: "Female",
      tone: "Low, grounded, late-night",
      provider: "aether",
    },
    {
      id: "helix",
      name: "Helix",
      gender: "Male",
      tone: "Bold, dynamic, commentary",
      provider: "aether",
    },
    {
      id: "leo",
      name: "Leo",
      gender: "Male",
      tone: "Direct, confident, sales",
      provider: "aether",
    },
    {
      id: "rex",
      name: "Rex",
      gender: "Male",
      tone: "Firm, even, collections",
      provider: "aether",
    },
    {
      id: "orion",
      name: "Orion",
      gender: "Male",
      tone: "Thoughtful, technical",
      provider: "aether",
    },
    {
      id: "atlas",
      name: "Atlas",
      gender: "Male",
      tone: "Authoritative, enterprise",
      provider: "aether",
    },
    {
      id: "sal",
      name: "Sal",
      gender: "Male",
      tone: "Casual, neighborly",
      provider: "aether",
    },
    {
      id: "marin",
      name: "Marin",
      gender: "Female",
      tone: "Natural, even, everyday",
      provider: "openai",
    },
    {
      id: "coral",
      name: "Coral",
      gender: "Female",
      tone: "Warm, friendly, front desk",
      provider: "openai",
    },
    {
      id: "sage",
      name: "Sage",
      gender: "Female",
      tone: "Calm, patient, care",
      provider: "openai",
    },
    {
      id: "shimmer",
      name: "Shimmer",
      gender: "Female",
      tone: "Bright, upbeat, retail",
      provider: "openai",
    },
    {
      id: "alloy",
      name: "Alloy",
      gender: "Female",
      tone: "Neutral, steady, general",
      provider: "openai",
    },
    {
      id: "cedar",
      name: "Cedar",
      gender: "Male",
      tone: "Natural, considered, technical",
      provider: "openai",
    },
    {
      id: "ash",
      name: "Ash",
      gender: "Male",
      tone: "Crisp, direct, sales",
      provider: "openai",
    },
    {
      id: "echo",
      name: "Echo",
      gender: "Male",
      tone: "Even, level, collections",
      provider: "openai",
    },
    {
      id: "ballad",
      name: "Ballad",
      gender: "Male",
      tone: "Relaxed, expressive, hospitality",
      provider: "openai",
    },
    {
      id: "verse",
      name: "Verse",
      gender: "Male",
      tone: "Animated, characterful, media",
      provider: "openai",
    },
  ],
  VOICE_FALLBACK: Record<string, string> = {
    eve: "marin",
    carina: "sage",
    luna: "coral",
    ara: "shimmer",
    aurora: "sage",
    celeste: "marin",
    iris: "shimmer",
    liora: "alloy",
    ursa: "coral",
    helix: "verse",
    leo: "ash",
    rex: "echo",
    orion: "cedar",
    atlas: "echo",
    sal: "ballad",
  };
export function realtimeVoiceId(e: string) {
  return isRealtimeVoice(e) ? e : (VOICE_FALLBACK[e] ?? "alloy");
}
export function isRealtimeVoice(t: string) {
  return VOICES.some((e) => e.id === t && e.provider === "openai");
}
export const LANGUAGES = [
    {
      id: "en",
      label: "English",
    },
    {
      id: "es",
      label: "Spanish",
    },
    {
      id: "fr",
      label: "French",
    },
    {
      id: "hi",
      label: "Hindi",
    },
    {
      id: "de",
      label: "German",
    },
    {
      id: "pt",
      label: "Portuguese",
    },
    {
      id: "ja",
      label: "Japanese",
    },
    {
      id: "ko",
      label: "Korean",
    },
    {
      id: "zh",
      label: "Chinese",
    },
    {
      id: "ar",
      label: "Arabic",
    },
  ],
  JOBS = [
    {
      id: "book",
      label: "Book",
      description: "Appointments, clinics, front desks.",
    },
    {
      id: "sell",
      label: "Sell",
      description: "Qualify inbound and capture the lead.",
    },
    {
      id: "present",
      label: "Present",
      description: "Walk a buyer through a pitch.",
    },
    {
      id: "support",
      label: "Support",
      description: "Orders, tickets, first-line help.",
    },
    {
      id: "collect",
      label: "Collect",
      description: "Invoices and a calm next step.",
    },
  ],
  MODELS = [
    {
      id: "grok-4.5",
      name: "Grok 4.5",
      short: "Latest",
      description:
        "Default for voice agents. Fast, agentic, low hallucination.",
      latency: "Fast",
    },
    {
      id: "grok-4.6",
      name: "Grok 4.6",
      short: "Flagship",
      description: "Newest. Stronger long-running tool use and visual work.",
      latency: "Standard",
    },
    {
      id: "grok-4",
      name: "Grok 4",
      short: "Previous",
      description:
        "Stable previous generation. Use when you need a pinned model.",
      latency: "Standard",
    },
    {
      id: "grok-3-mini",
      name: "Grok 3 Mini",
      short: "Fast",
      description: "Lower latency and cost. Best for short greetings and FAQs.",
      latency: "Fastest",
    },
  ],
  TOOL_CATALOG = [
    {
      key: "transfer_call",
      name: "Transfer call",
      description: "Hand the caller off to a phone number or SIP address.",
      group: "platform",
    },
    {
      key: "api_request",
      name: "API request",
      description: "Call an HTTP endpoint and use the response.",
      group: "platform",
    },
    {
      key: "web_search",
      name: "Web search",
      description: "Let the agent search the web for current information.",
      group: "platform",
    },
    {
      key: "x_search",
      name: "X search",
      description:
        "Let the agent search X for posts and real-time information.",
      group: "platform",
    },
    {
      key: "send_sms",
      name: "Send SMS",
      description: "Let the agent text the caller from an outbound number.",
      group: "platform",
    },
    {
      key: "list_slots",
      name: "List slots",
      description: "Show open appointment times for the next two weeks.",
      group: "workflow",
    },
    {
      key: "book_appointment",
      name: "Book appointment",
      description:
        "Reserve an open slot and confirm name, time, and reason to the caller.",
      group: "workflow",
    },
    {
      key: "capture_lead",
      name: "Capture lead",
      description:
        "Save a qualified lead with name, contact, company, and interest.",
      group: "workflow",
    },
    {
      key: "lookup_order",
      name: "Lookup order",
      description:
        "Find an order by number or email and return status, ETA, and items.",
      group: "workflow",
    },
    {
      key: "create_ticket",
      name: "Create ticket",
      description: "Open a support ticket and return a tracking identifier.",
      group: "workflow",
    },
    {
      key: "transfer_human",
      name: "Transfer to human",
      description: "Hand the conversation to a teammate with a written brief.",
      group: "workflow",
    },
    {
      key: "search_catalog",
      name: "Search catalog",
      description:
        "Look up products, plans, or inventory and quote availability.",
      group: "workflow",
    },
  ],
  CHANNELS = [
    {
      id: "web",
      label: "Web widget",
    },
    {
      id: "phone",
      label: "Phone",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
    },
    {
      id: "sms",
      label: "SMS",
    },
  ],
  BUILTIN_CONNECTORS: Connector[] = [
    {
      key: "gmail",
      name: "Gmail",
      kind: "tool",
      category: "google",
      description: "Read and send mail from a Google account.",
      help: "Paste a Google OAuth access token with gmail.readonly and gmail.send.",
      fields: [
        {
          key: "token",
          label: "Access token",
          placeholder: "ya29…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "gcal",
      name: "Google Calendar",
      kind: "tool",
      category: "google",
      description: "List and create events on the connected calendar.",
      help: "Paste a Google OAuth access token with calendar.events.",
      fields: [
        {
          key: "token",
          label: "Access token",
          placeholder: "ya29…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "outlook",
      name: "Outlook",
      kind: "tool",
      category: "microsoft",
      description: "Mail and calendar through Microsoft Graph.",
      help: "Sign in with Microsoft to connect Outlook mail and calendar; tokens then refresh on their own. This paste box appears only when no Microsoft app is registered (MICROSOFT_CLIENT_ID) — a pasted Graph token expires within the hour, so it suits a quick test, not a live line.",
      fields: [
        {
          key: "token",
          label: "Access token",
          placeholder: "eyJ…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "mcp",
      name: "MCP server",
      kind: "tool",
      category: "platform",
      description: "Any Model Context Protocol server the agent can call.",
      help: "HTTPS endpoint that speaks MCP JSON-RPC. Optional bearer token.",
      fields: [
        {
          key: "url",
          label: "Server URL",
          placeholder: "https://mcp.example.com/sse",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Bearer token",
          placeholder: "Optional",
          secret: true,
          required: false,
        },
      ],
    },
    {
      key: "slack",
      name: "Slack",
      kind: "tool",
      category: "support",
      description: "Post to channels and look up users.",
      help: "A Slack bot token (xoxb-) with chat:write and users:read.",
      fields: [
        {
          key: "token",
          label: "Bot token",
          placeholder: "xoxb-…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "hubspot",
      name: "HubSpot",
      kind: "tool",
      category: "crm",
      description: "Contacts, companies, and deals.",
      help: "A private app token with crm.objects.contacts.read/write.",
      fields: [
        {
          key: "token",
          label: "Private app token",
          placeholder: "pat-…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "salesforce",
      name: "Salesforce",
      kind: "tool",
      category: "crm",
      description: "Leads and contacts on your Salesforce org.",
      help: "Sign in with Salesforce to connect your org; tokens then refresh on their own. This paste box appears only when no Salesforce connected app is registered (SALESFORCE_CLIENT_ID) — a pasted access token expires with the session, so it suits a quick test, not a live line.",
      fields: [
        {
          key: "instance",
          label: "Instance URL",
          placeholder: "https://yourorg.my.salesforce.com",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Access token",
          placeholder: "00D…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "shopify",
      name: "Shopify",
      kind: "tool",
      category: "commerce",
      description: "Orders, customers, and inventory.",
      help: "Shop subdomain and an Admin API access token.",
      fields: [
        {
          key: "shop",
          label: "Shop",
          placeholder: "your-store.myshopify.com",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Admin API token",
          placeholder: "shpat_…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "stripe",
      name: "Stripe",
      kind: "tool",
      category: "commerce",
      description: "Customers, invoices, and payment status.",
      help: "A secret API key. We verify it against Stripe before saving.",
      fields: [
        {
          key: "token",
          label: "Secret key",
          placeholder: "sk_live_…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "zendesk",
      name: "Zendesk",
      kind: "tool",
      category: "support",
      description: "Tickets and end users.",
      help: "Subdomain, agent email, and an API token.",
      fields: [
        {
          key: "subdomain",
          label: "Subdomain",
          placeholder: "yourcompany",
          required: true,
          secret: false,
        },
        {
          key: "email",
          label: "Agent email",
          placeholder: "you@company.com",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "API token",
          placeholder: "token",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "notion",
      name: "Notion",
      kind: "tool",
      category: "platform",
      description: "Search pages and databases the integration can see.",
      help: "An internal integration token.",
      fields: [
        {
          key: "token",
          label: "Integration token",
          placeholder: "ntn_…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "calendly",
      name: "Calendly",
      kind: "tool",
      category: "google",
      description: "List event types and scheduled events.",
      help: "A personal access token from Calendly.",
      fields: [
        {
          key: "token",
          label: "Access token",
          placeholder: "eyJ…",
          secret: true,
          required: true,
        },
      ],
    },
  ],
  apiKeyField = (e: string, t = "API key"): ConnectorField => ({
    key: "token",
    label: t,
    placeholder: e,
    secret: true,
    required: true,
  }),
  PROVIDER_CONNECTORS: Connector[] = [
    {
      key: "elevenlabs",
      name: "ElevenLabs",
      kind: "voice",
      category: "voice",
      description:
        "AI voice cloning and generation with natural speech synthesis.",
      help: "An ElevenLabs API key from the profile page.",
      fields: [apiKeyField("xi-…", "API key")],
    },
    {
      key: "cartesia",
      name: "Cartesia",
      kind: "voice",
      category: "voice",
      description: "Lightning-fast text-to-speech with ultra-low latency.",
      help: "A Cartesia API key. We list voices to verify it.",
      fields: [apiKeyField("sk_car_…")],
    },
    {
      key: "deepgram",
      name: "Deepgram",
      kind: "voice",
      category: "voice",
      description:
        "Real-time speech recognition with low latency for production use.",
      help: "A Deepgram API key. Used for voice and transcription.",
      fields: [apiKeyField("dg-…")],
    },
    {
      key: "azure-speech",
      name: "Azure Speech",
      kind: "voice",
      category: "voice",
      description: "Enterprise text-to-speech and speech-to-text by Microsoft.",
      help: "Speech resource key and region (for example eastus).",
      fields: [
        {
          key: "region",
          label: "Region",
          placeholder: "eastus",
          required: true,
          secret: false,
        },
        apiKeyField("subscription key", "Speech key"),
      ],
    },
    {
      key: "inworld",
      name: "Inworld",
      kind: "voice",
      category: "voice",
      description: "AI voices designed for interactive character experiences.",
      help: "An Inworld runtime API key.",
      fields: [apiKeyField("inw-…")],
    },
    {
      key: "rime",
      name: "RimeAI",
      kind: "voice",
      category: "voice",
      description: "Realistic text-to-speech with emotional voice control.",
      help: "A Rime API key.",
      fields: [apiKeyField("rime-…")],
    },
    {
      key: "smallest",
      name: "Smallest AI",
      kind: "voice",
      category: "voice",
      description:
        "Ultra-fast, low-latency voice synthesis for real-time agents.",
      help: "A Smallest Waves API key.",
      fields: [apiKeyField("smallest-…")],
    },
    {
      key: "neuphonic",
      name: "Neuphonic",
      kind: "voice",
      category: "voice",
      description: "Natural-sounding text-to-speech with emotional AI.",
      help: "A Neuphonic API key.",
      fields: [apiKeyField("neu-…")],
    },
    {
      key: "hume",
      name: "Hume",
      kind: "voice",
      category: "voice",
      description: "Emotionally intelligent AI voices with expressive speech.",
      help: "A Hume AI API key.",
      fields: [apiKeyField("hume-…")],
    },
    {
      key: "lmnt",
      name: "LMNT",
      kind: "voice",
      category: "voice",
      description:
        "Real-time AI voice synthesis optimized for conversational AI.",
      help: "An LMNT API key.",
      fields: [apiKeyField("lmnt-…")],
    },
    {
      key: "minimax",
      name: "MiniMax",
      kind: "voice",
      category: "voice",
      description: "Advanced LLM and TTS models with multilingual support.",
      help: "A MiniMax API key.",
      fields: [
        {
          key: "groupId",
          label: "Group ID",
          placeholder: "1…",
          required: true,
          secret: false,
        },
        apiKeyField("eyJ…"),
      ],
    },
    {
      key: "playht",
      name: "PlayHT",
      kind: "voice",
      category: "voice",
      description:
        "High-quality AI voice generation with custom voice cloning.",
      help: "User ID and API key from PlayHT. This provider is deprecated.",
      deprecated: true,
      fields: [
        {
          key: "userId",
          label: "User ID",
          placeholder: "PlayHT user id",
          required: true,
          secret: false,
        },
        apiKeyField("sk_…", "Secret key"),
      ],
    },
    {
      key: "openai",
      name: "OpenAI",
      kind: "model",
      category: "model",
      description: "State-of-the-art GPT and o-series models.",
      help: "An OpenAI API key. We list models to verify it.",
      fields: [apiKeyField("sk-…")],
    },
    {
      key: "anthropic",
      name: "Anthropic",
      kind: "model",
      category: "model",
      description: "Claude series models focused on safe, helpful AI.",
      help: "An Anthropic API key.",
      fields: [apiKeyField("sk-ant-…")],
    },
    {
      key: "bedrock",
      name: "Anthropic Bedrock",
      kind: "model",
      category: "model",
      description: "Claude models via your own AWS Bedrock account (BYOK).",
      help: "IAM access key, secret, and region with Bedrock access.",
      fields: [
        {
          key: "accessKey",
          label: "Access key ID",
          placeholder: "AKIA…",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret access key",
          placeholder: "wJal…",
          secret: true,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          required: true,
          secret: false,
        },
      ],
    },
    {
      key: "google-ai",
      name: "Google",
      kind: "model",
      category: "model",
      description: "Gemini series models for rich AI understanding.",
      help: "A Google AI Studio API key.",
      fields: [apiKeyField("AIza…")],
    },
    {
      key: "azure-openai",
      name: "Azure OpenAI",
      kind: "model",
      category: "model",
      description: "Azure-hosted OpenAI models with enterprise governance.",
      help: "Resource endpoint and API key.",
      fields: [
        {
          key: "endpoint",
          label: "Endpoint",
          placeholder: "https://your-resource.openai.azure.com",
          required: true,
          secret: false,
        },
        apiKeyField("azure key", "API key"),
      ],
    },
    {
      key: "inflection",
      name: "Inflection AI",
      kind: "model",
      category: "model",
      description:
        "Inflection conversational models tuned for empathetic dialogue.",
      help: "An Inflection API key.",
      fields: [apiKeyField("inf-…")],
    },
    {
      key: "cerebras",
      name: "Cerebras",
      kind: "model",
      category: "model",
      description: "High performance inference platform.",
      help: "A Cerebras Cloud API key.",
      fields: [apiKeyField("csk-…")],
    },
    {
      key: "xai",
      name: "xAI",
      kind: "model",
      category: "model",
      description: "Grok series models with real-time knowledge access.",
      help: "An xAI API key. We list models to verify it.",
      fields: [apiKeyField("xai-…")],
    },
    {
      key: "mistral",
      name: "Mistral",
      kind: "model",
      category: "model",
      description: "Mistral family of efficient open-source models.",
      help: "A Mistral API key.",
      fields: [apiKeyField("…")],
    },
    {
      key: "together",
      name: "Together AI",
      kind: "model",
      category: "model",
      description: "Hosted open-source LLMs served through Together AI.",
      help: "A Together API key.",
      fields: [apiKeyField("tgp_…")],
    },
    {
      key: "anyscale",
      name: "Anyscale",
      kind: "model",
      category: "model",
      description: "Anyscale platform for scalable open-source LLM hosting.",
      help: "An Anyscale / Endpoints API key.",
      fields: [apiKeyField("ese-…")],
    },
    {
      key: "openrouter",
      name: "OpenRouter",
      kind: "model",
      category: "model",
      description: "Unified API to many community LLMs via OpenRouter.",
      help: "An OpenRouter API key.",
      fields: [apiKeyField("sk-or-…")],
    },
    {
      key: "perplexity",
      name: "Perplexity AI",
      kind: "model",
      category: "model",
      description: "Perplexity AI models tuned for informed responses.",
      help: "A Perplexity API key.",
      fields: [apiKeyField("pplx-…")],
    },
    {
      key: "deepinfra",
      name: "DeepInfra",
      kind: "model",
      category: "model",
      description: "DeepInfra managed inference for popular open models.",
      help: "A DeepInfra API token.",
      fields: [apiKeyField("…")],
    },
    {
      key: "custom-llm",
      name: "Custom LLM",
      kind: "model",
      category: "model",
      description: "Connect your own custom language model endpoint.",
      help: "An OpenAI-compatible base URL and optional key.",
      fields: [
        {
          key: "url",
          label: "Base URL",
          placeholder: "https://api.your-llm.com/v1",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "API key",
          placeholder: "Optional",
          secret: true,
          required: false,
        },
      ],
    },
    {
      key: "assemblyai",
      name: "AssemblyAI",
      kind: "transcriber",
      category: "transcriber",
      description: "Advanced speech recognition with speaker diarization.",
      help: "An AssemblyAI API key.",
      fields: [apiKeyField("…")],
    },
    {
      key: "gladia",
      name: "Gladia",
      kind: "transcriber",
      category: "transcriber",
      description: "Accurate speech-to-text API with multilingual support.",
      help: "A Gladia API key.",
      fields: [apiKeyField("…")],
    },
    {
      key: "speechmatics",
      name: "Speechmatics",
      kind: "transcriber",
      category: "transcriber",
      description:
        "Enterprise-grade speech recognition with custom vocabularies.",
      help: "A Speechmatics API key.",
      fields: [apiKeyField("…")],
    },
    {
      key: "soniox",
      name: "Soniox",
      kind: "transcriber",
      category: "transcriber",
      description: "Real-time speech recognition with 60+ language support.",
      help: "A Soniox API key.",
      fields: [apiKeyField("…")],
    },
    {
      key: "make",
      name: "Make",
      kind: "tool",
      category: "tool",
      description: "Automate workflows with Make.com integration webhooks.",
      help: "A Make scenario webhook URL. We send a ping to verify it.",
      fields: [
        {
          key: "url",
          label: "Webhook URL",
          placeholder: "https://hook.eu1.make.com/…",
          required: true,
          secret: false,
        },
      ],
    },
    {
      key: "gohighlevel",
      name: "GoHighLevel",
      kind: "tool",
      category: "crm",
      description: "CRM and marketing automation platform integration.",
      help: "A LeadConnector private integration token.",
      fields: [
        {
          key: "locationId",
          label: "Location ID",
          placeholder: "loc_…",
          required: true,
          secret: false,
        },
        apiKeyField("pit-…", "Private token"),
      ],
    },
    {
      key: "gsheets",
      name: "Google Sheets",
      kind: "tool",
      category: "google",
      description: "Read and write data to Google Sheets spreadsheets.",
      help: "A Google OAuth token with spreadsheets scope.",
      fields: [apiKeyField("ya29…", "Access token")],
    },
    {
      key: "ghl-mcp",
      name: "GoHighLevel MCP",
      kind: "tool",
      category: "platform",
      description: "Advanced GoHighLevel integration with MCP protocol.",
      help: "MCP server URL for HighLevel.",
      fields: [
        {
          key: "url",
          label: "MCP URL",
          placeholder: "https://…",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Bearer token",
          placeholder: "Optional",
          secret: true,
          required: false,
        },
      ],
    },
    {
      key: "twilio",
      name: "Twilio",
      kind: "phone",
      category: "phone",
      description: "Import numbers you already own on Twilio.",
      help: "Account SID and Auth Token. We authenticate against Twilio’s API.",
      fields: [
        {
          key: "sid",
          label: "Account SID",
          placeholder: "AC…",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Auth Token",
          placeholder: "token",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "vonage",
      name: "Vonage",
      kind: "phone",
      category: "phone",
      description: "International phone numbers and communications API.",
      help: "Vonage API key and secret.",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          placeholder: "key",
          required: true,
          secret: false,
        },
        {
          key: "apiSecret",
          label: "API secret",
          placeholder: "secret",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "telnyx",
      name: "Telnyx",
      kind: "phone",
      category: "phone",
      description: "Global phone numbers with reliable voice infrastructure.",
      help: "A Telnyx API v2 key.",
      fields: [apiKeyField("KEY…", "API key")],
    },
    {
      key: "sip",
      name: "SIP trunk",
      kind: "phone",
      category: "phone",
      description:
        "Bring your own SIP trunk or carrier for phone connectivity.",
      help: "SIP URI, username, and password for your carrier.",
      fields: [
        {
          key: "sipUri",
          label: "SIP URI",
          placeholder: "sip:user@sip.carrier.com",
          required: true,
          secret: false,
        },
        {
          key: "username",
          label: "Username",
          placeholder: "SIP username",
          required: true,
          secret: false,
        },
        {
          key: "password",
          label: "Password",
          placeholder: "SIP password",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "s3",
      name: "AWS S3",
      kind: "cloud",
      category: "cloud",
      description: "Scalable cloud storage for recordings and artifacts.",
      help: "IAM access key with s3:ListBucket. We call GetCallerIdentity.",
      fields: [
        {
          key: "accessKey",
          label: "Access key ID",
          placeholder: "AKIA…",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret access key",
          placeholder: "wJal…",
          secret: true,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          required: true,
          secret: false,
        },
      ],
    },
    {
      key: "s3-sts",
      name: "AWS S3 (STS)",
      kind: "cloud",
      category: "cloud",
      description:
        "Secure S3 storage using IAM role assumption — no static credentials in the agent.",
      help: "Role ARN plus access key that can assume it.",
      fields: [
        {
          key: "roleArn",
          label: "Role ARN",
          placeholder: "arn:aws:iam::…:role/…",
          required: true,
          secret: false,
        },
        {
          key: "accessKey",
          label: "Access key ID",
          placeholder: "AKIA…",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret access key",
          placeholder: "wJal…",
          secret: true,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          required: true,
          secret: false,
        },
      ],
    },
    {
      key: "azure-blob",
      name: "Azure Blob Storage",
      kind: "cloud",
      category: "cloud",
      description: "Enterprise cloud storage by Microsoft Azure.",
      help: "Storage account name and access key, or a SAS URL.",
      fields: [
        {
          key: "account",
          label: "Account name",
          placeholder: "mystorage",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Access key",
          placeholder: "key or SAS",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "gcs",
      name: "Google Cloud Storage",
      kind: "cloud",
      category: "cloud",
      description: "Reliable object storage with global edge network.",
      help: "An OAuth token or HMAC access ID with storage.buckets.list.",
      fields: [apiKeyField("ya29…", "Access token")],
    },
    {
      key: "r2",
      name: "Cloudflare R2",
      kind: "cloud",
      category: "cloud",
      description: "Zero-egress cloud storage with global distribution.",
      help: "Account ID plus R2 access key and secret.",
      fields: [
        {
          key: "account",
          label: "Account ID",
          placeholder: "cloudflare account",
          required: true,
          secret: false,
        },
        {
          key: "accessKey",
          label: "Access key ID",
          placeholder: "key",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret access key",
          placeholder: "secret",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "supabase",
      name: "Supabase",
      kind: "cloud",
      category: "cloud",
      description: "Open-source cloud storage with built-in authentication.",
      help: "Project URL and service role key.",
      fields: [
        {
          key: "url",
          label: "Project URL",
          placeholder: "https://xxxx.supabase.co",
          required: true,
          secret: false,
        },
        apiKeyField("eyJ…", "Service role key"),
      ],
    },
    {
      key: "s3-compatible",
      name: "S3-compatible storage",
      kind: "cloud",
      category: "cloud",
      description:
        "Deliver recordings and call data to any S3-compatible bucket.",
      help: "Endpoint, access key, and secret. We list buckets.",
      fields: [
        {
          key: "url",
          label: "Endpoint",
          placeholder: "https://s3.example.com",
          required: true,
          secret: false,
        },
        {
          key: "accessKey",
          label: "Access key ID",
          placeholder: "key",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret access key",
          placeholder: "secret",
          secret: true,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          required: false,
          secret: false,
        },
      ],
    },
    {
      key: "langfuse",
      name: "Langfuse",
      kind: "observability",
      category: "observability",
      description: "LLM observability, tracing, and analytics platform.",
      help: "Public and secret keys from Langfuse.",
      fields: [
        {
          key: "url",
          label: "Host",
          placeholder: "https://cloud.langfuse.com",
          required: false,
          secret: false,
        },
        {
          key: "publicKey",
          label: "Public key",
          placeholder: "pk-lf-…",
          required: true,
          secret: false,
        },
        {
          key: "secret",
          label: "Secret key",
          placeholder: "sk-lf-…",
          secret: true,
          required: true,
        },
      ],
    },
    {
      key: "custom-server",
      name: "Server configuration",
      kind: "server",
      category: "server",
      description: "Configure custom server credentials and authentication.",
      help: "HTTPS endpoint plus a bearer token. We GET the URL to verify it.",
      fields: [
        {
          key: "url",
          label: "Server URL",
          placeholder: "https://api.your-company.com",
          required: true,
          secret: false,
        },
        {
          key: "token",
          label: "Bearer token",
          placeholder: "Optional",
          secret: true,
          required: false,
        },
      ],
    },
  ],
  CONNECTORS: Connector[] = [...BUILTIN_CONNECTORS, ...PROVIDER_CONNECTORS],
  SUPPORTED_CONNECTORS = new Set([
    "gmail",
    "gcal",
    "outlook",
    "mcp",
    "slack",
    "hubspot",
    "salesforce",
    "shopify",
    "stripe",
    "zendesk",
    "notion",
    "calendly",
    "gsheets",
    "openai",
    "anthropic",
    "together",
    "openrouter",
    "elevenlabs",
    "cartesia",
    "deepgram",
  ]);
export function isConnectorSupported(e: string) {
  return SUPPORTED_CONNECTORS.has(e);
}
export const CONNECTOR_KINDS = [
  {
    id: "voice",
    label: "Voice providers",
  },
  {
    id: "model",
    label: "Model providers",
  },
  {
    id: "transcriber",
    label: "Transcriber providers",
  },
  {
    id: "tool",
    label: "Tool providers",
  },
  {
    id: "phone",
    label: "Phone number providers",
  },
  {
    id: "cloud",
    label: "Cloud providers",
  },
  {
    id: "observability",
    label: "Observability",
  },
  {
    id: "server",
    label: "Server configuration",
  },
];
export function findConnector(e: string) {
  return CONNECTORS.find((t) => t.key === e);
}
export const TEMPLATES = [
    {
      key: "clinic",
      name: "Clinic appointments",
      category: "Healthcare",
      tagline: "Book, change, or check a visit. Never diagnose.",
      description:
        "Front desk for a clinic or hospital. Offers real slots, takes a name, and confirms out loud.",
      voiceId: "aurora",
      language: "en",
      job: "book",
      greeting: "Clinic desk. Are you booking, changing, or checking a time?",
      systemPrompt:
        "You are the front desk for a medical clinic.\nHours: Monday to Saturday, 8am to 6pm. Closed Sunday.\nYou book 30-minute visits. Always call list_slots before offering times. Offer two or three open times. Collect full name and a callback number, then book_appointment.\nNever give medical advice, never guess a diagnosis, never discuss lab results. If someone is in distress, tell them to call emergency services.\nConfirm the day, time, and confirmation from the tool. If no slot matches, say so and offer the next open times.",
      guardrails:
        "Never diagnose, interpret symptoms, advise on medication, or say whether something is serious. Book an appointment or offer to put them through to a clinician.\nIf the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: ["list_slots", "book_appointment", "transfer_human"],
      knowledge: [
        {
          title: "Hours and intake (draft)",
          content:
            "Open Monday–Saturday 8am–6pm. Closed Sunday. First visit: arrive 15 minutes early with ID and insurance card. Parking in the south garage. Pediatrics is floor 2. Imaging is floor 3 — those visits are 60 minutes and must be booked by a human.",
        },
        {
          title: "What this line does not do",
          content:
            "No diagnoses, no prescription refills, no lab interpretation. Those go to a nurse on transfer_human. Cancellations inside 2 hours still count as kept.",
        },
      ],
    },
    {
      key: "restaurant",
      name: "Restaurant reservations",
      category: "Hospitality",
      tagline: "Tables, party size, and a time that actually holds.",
      description:
        "Takes reservations, changes, and waitlist calls. Confirms name, covers, and time.",
      voiceId: "luna",
      language: "en",
      job: "book",
      greeting:
        "Reservations. Are you booking a table, changing one, or checking tonight?",
      systemPrompt:
        "You take reservations for a neighborhood restaurant.\nHours: Tuesday–Sunday, lunch 11:30–2:30, dinner 5:30–10. Closed Monday.\nAlways list_slots before offering times. Collect name, party size, phone, and any allergy note, then book_appointment.\nDo not promise a specific table. Parties of 8 or more go to transfer_human.\nConfirm date, time, and covers out loud. If full, offer the waitlist or the next open time.",
      guardrails:
        "Never ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.",
      tools: ["list_slots", "book_appointment", "transfer_human"],
      knowledge: [
        {
          title: "Hours and house rules (draft)",
          content:
            "Lunch Tue–Sun 11:30am–2:30pm. Dinner 5:30–10pm. Closed Monday. 90-minute hold on tables under 6. Patio is first-come. Corkage $25. Kids menu on request.",
        },
      ],
    },
    {
      key: "salon",
      name: "Salon & spa",
      category: "Beauty",
      tagline: "Cut, color, or treatment — booked in one call.",
      description:
        "Books beauty and spa services, asks for the stylist if it matters, and confirms duration.",
      voiceId: "ara",
      language: "en",
      job: "book",
      greeting:
        "Salon desk. What would you like to book — cut, color, or a treatment?",
      systemPrompt:
        "You book a salon and spa.\nHours: Tuesday–Saturday 9am–7pm. Closed Sunday and Monday.\nServices: cut 45 min, color 90 min, blowout 30 min, facial 60 min.\nAlways list_slots first. Collect name, service, preferred stylist if they have one, and a callback number, then book_appointment.\nNever give medical or dermatology advice. If they want a specific stylist who is out, say so and offer the next person or a later slot.\nConfirm service, day, and time out loud.",
      guardrails:
        "Never estimate the cost of a job you have not been given full details for. Give published prices only, and book a survey or callback for anything else.",
      tools: [
        "list_slots",
        "book_appointment",
        "search_catalog",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Services (draft)",
          content:
            "Cut $85 / 45 min. Color from $160 / 90 min. Blowout $55 / 30 min. Facial $140 / 60 min. First visit: arrive 10 minutes early. Cancellations inside 4 hours may be charged 50%.",
        },
      ],
    },
    {
      key: "support",
      name: "Customer support",
      category: "Support",
      tagline: "Orders, returns, and a ticket when it needs a human.",
      description:
        "First-line help. Looks up an order, opens a ticket, and hands off with a brief.",
      voiceId: "carina",
      language: "en",
      job: "support",
      greeting: "Support — how can I help you this evening?",
      systemPrompt:
        "You are first-line support for a retail brand.\nSpeak in short, calm sentences. Never invent policy. If you do not know, say so and offer to open a ticket.\nAlways confirm the order number before acting. Prefer resolution over apology, but be warm.\nIf the caller is upset, acknowledge once, then move to the next concrete step.\nUse lookup_order, create_ticket, or transfer_human. Do not guess shipping dates.",
      guardrails:
        "Never ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.\nNever promise a result, a timescale you have not been given, or that someone will call back by a specific time. Say what you can confirm and what you cannot.",
      tools: ["lookup_order", "create_ticket", "transfer_human"],
      knowledge: [
        {
          title: "Return policy (draft)",
          content:
            "Unused items can be returned within 30 days with the original packing slip. Final-sale pieces cannot be returned. Refunds post to the original method in 5–7 business days. Exchanges ship free.",
        },
        {
          title: "Shipping (draft)",
          content:
            "Standard ground is 4–6 business days. Express is 2 business days. Overnight is available before 1pm local. Tracking emails send at label creation.",
        },
      ],
    },
    {
      key: "sales_call",
      name: "Inbound sales",
      category: "Sales",
      tagline: "Qualify the call. Capture the lead. Book a session.",
      description:
        "Asks fit, takes a name, and books a working session with sales — no discounting.",
      voiceId: "leo",
      language: "en",
      job: "sell",
      greeting:
        "Sales — thanks for calling. What are you trying to get done this quarter?",
      systemPrompt:
        "You are an inbound sales qualifier.\nAsk one question at a time: what they sell, company size, timeline, and whether they need voice, chat, or phone.\nWhen you have a name plus interest, call capture_lead. If they want a working session, list_slots then book_appointment.\nDo not discount. Do not invent pricing that is not in knowledge. Do not stay on a bad-fit call — thank them and close.\nKeep answers under 40 words unless they ask for the pitch.",
      guardrails:
        "Never offer, agree to, or hint at a discount, a free upgrade, or a price match. If pressed, say pricing is fixed and offer to pass the request to the team.",
      tools: [
        "capture_lead",
        "list_slots",
        "book_appointment",
        "search_catalog",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Plans (draft)",
          content:
            "Studio is free to start (15 minutes). Scale is $89/seat with 2,000 minutes. Enterprise is custom: SSO and a dedicated number. Phone and WhatsApp require Scale or above.",
        },
      ],
    },
    {
      key: "present",
      name: "Product walkthrough",
      category: "Sales",
      tagline: "A three-beat pitch, then a clear next step.",
      description:
        "Walks a buyer through the offer, answers plan questions, and captures the lead.",
      voiceId: "helix",
      language: "en",
      job: "present",
      greeting:
        "I'll keep this short. Want the one-minute version, or shall I start with what you already use?",
      systemPrompt:
        "You are presenting a voice-agent product to a buyer.\nThree beats only, unless they steer: (1) the problem — a human can't pick up every call, (2) the product — an agent that books, qualifies, or supports in their voice, (3) the ask — a 20-minute working session this week.\nUse search_catalog if they ask about plans. Capture the lead when you have a name. Book if they agree to a time.\nDo not ramble. Do not use slides language. Speak as if you are in the room.",
      guardrails:
        "Never offer, agree to, or hint at a discount, a free upgrade, or a price match. If pressed, say pricing is fixed and offer to pass the request to the team.",
      tools: [
        "search_catalog",
        "capture_lead",
        "list_slots",
        "book_appointment",
      ],
      knowledge: [
        {
          title: "Talk track (draft)",
          content:
            "Beat 1: After hours and overflow are where revenue leaks. Beat 2: The agent speaks in a chosen voice, uses your knowledge, and writes the outcome — appointment, lead, ticket. Beat 3: Studio is free; Scale is $89/seat. A working session is 20 minutes, no deck required.",
        },
      ],
    },
    {
      key: "collect",
      name: "Invoice collections",
      category: "Finance",
      tagline: "Calm, clear, never threatening.",
      description:
        "Explains an invoice, takes a promise-to-pay, and opens a hardship ticket when needed.",
      voiceId: "rex",
      language: "en",
      job: "collect",
      greeting:
        "Billing. I can walk you through an invoice or set a payment date.",
      systemPrompt:
        "You are a billing specialist.\nBe direct, never harsh. Never threaten credit or legal action.\nOffer: pay now, schedule a date within 14 days, or split into two installments.\nIf the account is in hardship, open a ticket for a human reviewer.\nConfirm amounts in full dollars. Repeat the agreed date once. Capture a note with capture_lead if they promise a date.",
      guardrails:
        "Never advise on a legal position, a tax question, or what someone should do about a case. Book a consultation with a qualified person instead.\nNever ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.",
      tools: [
        "lookup_order",
        "create_ticket",
        "capture_lead",
        "transfer_human",
        "send_sms",
      ],
      knowledge: [
        {
          title: "Payment terms (draft)",
          content:
            "Net-15 on new accounts, net-30 after three on-time invoices. Late notices go out at day 7 and day 21. A promise-to-pay inside 14 days pauses further notices. Hardship review takes two business days.",
        },
      ],
    },
    {
      key: "real_estate",
      name: "Real estate showings",
      category: "Property",
      tagline: "Qualify the buyer, then book the viewing.",
      description:
        "Takes listing questions, captures the lead, and schedules a showing.",
      voiceId: "liora",
      language: "en",
      job: "sell",
      greeting: "Showings desk. Which listing are you calling about?",
      systemPrompt:
        "You schedule property showings for a residential brokerage.\nAsk for the listing address or MLS number, then whether they are buying or renting, budget range, and timeline.\nUse search_catalog for published listing facts only. Never invent square footage, price, or school ratings.\nWhen you have a name and a property, capture_lead. To book a viewing, list_slots then book_appointment.\nIf they want an offer strategy or legal advice, transfer_human.",
      guardrails:
        "Never promise a result, a timescale you have not been given, or that someone will call back by a specific time. Say what you can confirm and what you cannot.",
      tools: [
        "search_catalog",
        "capture_lead",
        "list_slots",
        "book_appointment",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Showing rules (draft)",
          content:
            "Viewings are 20 minutes. Buyer must be accompanied. Tenant-occupied homes need 24 hours' notice. Weekend slots go first. Proof of funds is collected at the office, not on this line.",
        },
      ],
    },
    {
      key: "home_services",
      name: "Home services",
      category: "Field",
      tagline: "Dispatch a plumber, HVAC tech, or electrician.",
      description:
        "Takes the issue, a window, and an address. Books a visit or opens a ticket.",
      voiceId: "sal",
      language: "en",
      job: "book",
      greeting:
        "Service desk. Is this a leak, no heat, no power — or something else?",
      systemPrompt:
        "You dispatch home services: plumbing, HVAC, and electrical.\nTriage: what failed, how urgent, and the service address. Emergencies (active leak, no heat in freezing weather, sparking) go to transfer_human immediately.\nFor routine work, list_slots, collect name, address, phone, and a short description, then book_appointment.\nNever quote a firm price. You may quote a diagnostic fee from knowledge. Do not give DIY electrical advice.",
      guardrails:
        "Never estimate the cost of a job you have not been given full details for. Give published prices only, and book a survey or callback for anything else.\nIf the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: [
        "list_slots",
        "book_appointment",
        "create_ticket",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Dispatch (draft)",
          content:
            "Hours 7am–7pm, seven days. After-hours emergencies are a live tech. Diagnostic fee $89, waived if they book the repair. Same-day windows: morning 8–12, afternoon 12–5. Need a clear path to the unit and a parking spot.",
        },
      ],
    },
    {
      key: "hotel",
      name: "Hotel concierge",
      category: "Hospitality",
      tagline: "Stay, amenities, and a booking when a room is open.",
      description:
        "Answers hotel questions, books a room or spa slot, and transfers the front desk when needed.",
      voiceId: "celeste",
      language: "en",
      job: "book",
      greeting:
        "Concierge. Are you checking a reservation, booking a stay, or asking about the hotel?",
      systemPrompt:
        "You are the hotel concierge line.\nHelp with: existing reservation lookup (name + dates), new stay booking via list_slots and book_appointment, spa, and house facts from knowledge.\nNever invent room availability or rates. If the night is likely full, say you will place a request and create_ticket.\nNo medical advice. No local legal advice. Transfers for VIP, complaints, and billing disputes.",
      guardrails:
        "Never ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.",
      tools: [
        "list_slots",
        "book_appointment",
        "lookup_order",
        "create_ticket",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "House facts (draft)",
          content:
            "Check-in 3pm, check-out 11am. Breakfast 7–10:30 in the courtyard. Pool 6am–10pm. Spa last booking 7pm. Pets under 25 lb, $75. Airport sedan 45 minutes with 2 hours' notice. Quiet hours 10pm.",
        },
      ],
    },
    {
      key: "recruiting",
      name: "Candidate screening",
      category: "Talent",
      tagline: "A first screen. Capture fit, book the recruiter.",
      description:
        "Asks role, years, location, and compensation band, then books a human interview.",
      voiceId: "orion",
      language: "en",
      job: "sell",
      greeting: "Talent desk. Which role are you calling about?",
      systemPrompt:
        "You screen inbound candidates.\nAsk one question at a time: role, years of relevant experience, city / remote, work authorization, and compensation expectation.\nWhen you have a name and a role, capture_lead. If they pass a basic fit from knowledge, list_slots and book_appointment with a recruiter.\nNever promise a job, a salary, or a visa. Do not ask about age, family, health, or religion. If they push on those, skip and continue.",
      guardrails:
        "Never confirm that someone has the job, discuss a final salary, or comment on another candidate. Collect what is asked for and book the interview.",
      tools: [
        "capture_lead",
        "list_slots",
        "book_appointment",
        "search_catalog",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Open roles (draft)",
          content:
            "Account executive — 3+ years B2B, remote US, $90–120k OTE. Support lead — 5+ years, on-site, $85–100k. Must be authorized to work. Recruiter screens are 20 minutes, weekday afternoons.",
        },
      ],
    },
    {
      key: "after_hours",
      name: "After-hours answering",
      category: "Support",
      tagline: "Take a message. Page a human only when it is urgent.",
      description:
        "Night and weekend line. Logs the call, texts a recap, and escalates true emergencies.",
      voiceId: "ursa",
      language: "en",
      job: "support",
      greeting:
        "After hours. I can take a message, or page someone if this cannot wait.",
      systemPrompt:
        "You cover the phone after hours.\nTake: caller name, number, company if any, and a one-sentence reason. create_ticket for every call. send_sms a recap to the on-call number in knowledge when they ask for a callback.\nEscalate with transfer_human only for: safety, active outage, or a customer who was promised a same-night call.\nBe brief. Do not guess when someone will call back. Do not discuss pricing.",
      guardrails:
        "If the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: ["create_ticket", "send_sms", "capture_lead", "transfer_human"],
      knowledge: [
        {
          title: "On-call (draft)",
          content:
            "Office hours 9am–6pm weekdays. After hours this line takes messages. On-call is paged for safety issues and named-account outages. Routine billing waits until morning. Callback window is next business morning.",
        },
      ],
    },
    {
      key: "vet",
      name: "Veterinary practice",
      category: "Healthcare",
      tagline:
        "Appointments, repeat prescriptions, and a fast route for a sick animal.",
      description:
        "Books consults and vaccinations, handles prescription requests, and gets an emergency seen now.",
      voiceId: "aurora",
      language: "en",
      job: "book",
      greeting:
        "Veterinary practice. Is your pet unwell, or is this a routine visit?",
      systemPrompt:
        "You are the reception of a veterinary practice.\nAsk first whether the animal is unwell. A poorly animal comes before the diary.\nTake the pet's name and species, and the owner's full name and number.\nRoutine: book consults, vaccinations and boosters from the open list.\nRepeat prescriptions: take the pet name and medication, open a ticket, and say it needs a vet to sign off.\nNever advise on symptoms, dosage, or whether something can wait. Never say an animal will be fine.\nCollapse, breathing trouble, poisoning, a road accident, or a fit means come now — say so and transfer.\nWarm, calm, short.",
      guardrails:
        "Never diagnose, interpret symptoms, advise on medication, or say whether something is serious. Book an appointment or offer to put them through to a clinician.\nIf the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: [
        "list_slots",
        "book_appointment",
        "create_ticket",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Consults and fees (draft)",
          content:
            "Standard consult £48, 15 minutes. Vaccination £42 including the consult. Neutering from £180 by weight. Out-of-hours consult £145. Repeat prescriptions need 48 hours and a vet's sign-off. We see dogs, cats and rabbits; exotics are referred.",
        },
        {
          title: "What this line does not do",
          content:
            "This line does not advise on symptoms, medication or dosage, and never says whether a problem can wait. It books visits and passes urgent calls to a vet.",
        },
      ],
    },
    {
      key: "dental",
      name: "Dental practice",
      category: "Healthcare",
      tagline: "Check-ups, hygienist, and a real emergency triage.",
      description:
        "Books check-ups and hygienist visits, handles recalls, and gets pain seen the same day.",
      voiceId: "carina",
      language: "en",
      job: "book",
      greeting: "Dental practice. Are you booking, or is this about pain?",
      systemPrompt:
        "You are the front desk of a dental practice.\nAsk first whether this is routine or painful. Pain comes before the diary.\nRoutine: offer check-up or hygienist times from the open list, take a full name and number, and book.\nRecalls: if they say they were due a check-up, offer the next two openings.\nNever diagnose, never say whether something looks serious, never advise on painkillers.\nSwelling, bleeding that will not stop, or a knocked-out tooth is urgent — say so and transfer.\nKeep it to one or two sentences.",
      guardrails:
        "Never diagnose, interpret symptoms, advise on medication, or say whether something is serious. Book an appointment or offer to put them through to a clinician.\nIf the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: ["list_slots", "book_appointment", "transfer_human"],
      knowledge: [
        {
          title: "Treatments and fees (draft)",
          content:
            "Check-up £45, includes x-rays where needed. Hygienist £60 for 30 minutes. Emergency appointment £80, usually same day. Whitening from £320. We take card and bank transfer, not cash over £200. New patients welcome; first visit is a check-up.",
        },
        {
          title: "What this line does not do",
          content:
            "This line does not diagnose, advise on pain relief, or say whether a symptom is serious. It books visits and passes urgent calls to a clinician.",
        },
      ],
    },
    {
      key: "gym",
      name: "Gym & studio",
      category: "Fitness",
      tagline: "Class times, a trial, and a membership that starts today.",
      description:
        "Books classes and trials, answers membership questions, and takes cancellations without an argument.",
      voiceId: "ara",
      language: "en",
      job: "book",
      greeting: "Hi — are you booking a class, or asking about membership?",
      systemPrompt:
        'You run the desk at a gym and class studio.\nBook classes and trial sessions from the open list. Take a full name and mobile number.\nAnswer membership questions from what you know: price, what is included, notice period.\nCancellations: take them politely and confirm. Do not argue, do not offer to "save" the membership, do not upsell someone who is leaving.\nNever take card details on the call — send a link or pass to the team.\nTwo sentences at most.',
      guardrails:
        "Never ask for or accept a card number, CVV, bank details, or a one-time passcode, even if the caller offers them. Send a secure payment link or transfer to a person.\nNever offer, agree to, or hint at a discount, a free upgrade, or a price match. If pressed, say pricing is fixed and offer to pass the request to the team.",
      tools: [
        "list_slots",
        "book_appointment",
        "capture_lead",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Membership and classes (draft)",
          content:
            "Off-peak £29/month, full £44/month, no joining fee. One month notice to cancel. First class free for new members. Classes: spin, strength, yoga, HIIT — 45 minutes, 12 places. Book 30 minutes ahead. Missed classes are not refunded but can be swapped.",
        },
      ],
    },
    {
      key: "tuition",
      name: "Tuition centre",
      category: "Education",
      tagline: "Demo class, batch timings, and the fee question answered.",
      description:
        "Books demo classes, explains batches and fees, and captures a parent's details for follow-up.",
      voiceId: "iris",
      language: "en",
      job: "book",
      greeting: "Hello — which class or subject are you asking about?",
      systemPrompt:
        "You answer the phone for a tuition centre.\nMost callers are parents. Ask the student's class or year and the subject first.\nOffer a free demo class from the open list, take the parent's name and number, and book it.\nAnswer batch timings and fees from what you know. Give the published fee; never negotiate it.\nNever promise a grade, a rank, or an admission outcome.\nBe warm and short.",
      guardrails:
        "Never offer, agree to, or hint at a discount, a free upgrade, or a price match. If pressed, say pricing is fixed and offer to pass the request to the team.\nNever promise a result, a timescale you have not been given, or that someone will call back by a specific time. Say what you can confirm and what you cannot.",
      tools: [
        "list_slots",
        "book_appointment",
        "capture_lead",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Batches and fees (draft)",
          content:
            "Classes 6 to 12, all subjects. Batch sizes of 15. Weekday batches 4pm, 5:30pm and 7pm; weekend batches 9am and 11am. Fees are per term of three months and vary by class — quote the published sheet, never a discount. First demo class is free. Board and competitive streams run separately.",
        },
      ],
    },
    {
      key: "auto",
      name: "Auto service",
      category: "Automotive",
      tagline: "Book the service, agree a drop-off, quote nothing unseen.",
      description:
        "Takes service and repair bookings, asks the right questions about the car, and never guesses a price.",
      voiceId: "rex",
      language: "en",
      job: "book",
      greeting: "Workshop. What is the car, and what is it doing?",
      systemPrompt:
        "You take bookings for a vehicle workshop.\nAsk for make, model, year, registration, and what the problem is. Mileage if they know it.\nBook a drop-off from the open list and confirm whether they are waiting or leaving it.\nGive published service prices only. Never estimate a repair you have not seen — say it needs looking at and book the diagnostic.\nA brake, steering, or smoke problem means do not drive it: say so and offer recovery.\nShort, plain, no jargon.",
      guardrails:
        "Never estimate the cost of a job you have not been given full details for. Give published prices only, and book a survey or callback for anything else.\nIf the caller describes an emergency, injury, fire, flood, gas, or anyone at risk, stop the script, tell them to call emergency services, and transfer or take a callback number at once.",
      tools: [
        "list_slots",
        "book_appointment",
        "create_ticket",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Servicing and checks (draft)",
          content:
            "Interim service £119, full service £199, both include a 30-point check. MOT £54.85. Diagnostic hour £75, waived if the repair is booked with us. Courtesy car by arrangement, book a week ahead. We do not quote repairs over the phone without seeing the vehicle.",
        },
      ],
    },
    {
      key: "legal",
      name: "Legal & accounting",
      category: "Professional",
      tagline: "Book the consultation. Advise on nothing.",
      description:
        "Takes enquiries for a firm, books a paid or free consultation, and never answers the question itself.",
      voiceId: "liora",
      language: "en",
      job: "book",
      greeting:
        "Good afternoon. Are you calling about a new matter, or an existing one?",
      systemPrompt:
        "You answer the phone for a professional firm — solicitors or accountants.\nFind out the area — property, family, employment, tax, company — and whether the matter is new.\nBook a consultation from the open list. Take a full name, number, and one line on the matter.\nNever advise. Never say whether someone has a case, what they should do, what a deadline means for them, or what something will cost to resolve.\nIf they push, say the fee earner will answer it in the consultation.\nExisting clients asking for their own adviser: transfer.\nFormal, brief, never chatty.",
      guardrails:
        "Never advise on a legal position, a tax question, or what someone should do about a case. Book a consultation with a qualified person instead.\nNever promise a result, a timescale you have not been given, or that someone will call back by a specific time. Say what you can confirm and what you cannot.\nNever read out an address, date of birth, medical note, or account balance to confirm identity. Ask the caller to state it instead.",
      tools: [
        "list_slots",
        "book_appointment",
        "capture_lead",
        "transfer_human",
      ],
      knowledge: [
        {
          title: "Consultations (draft)",
          content:
            "First consultation is 30 minutes, £95, credited against the matter if instructed. Areas: residential property, wills and probate, employment, company and commercial, personal and corporate tax. We do not give advice before a consultation. Existing clients are put through to their own fee earner.",
        },
        {
          title: "What this line does not do",
          content:
            "This line books consultations. It does not advise on a legal or tax position, comment on the merits of a case, or estimate what a matter will cost to resolve.",
        },
      ],
    },
  ],
  NUMBER_PROVIDERS = [
    {
      id: "aether",
      name: "Test number (simulator only)",
      group: "Test",
      description:
        "A fictional number for trying the studio. It cannot receive real calls — import a carrier number to go live.",
      action: "Get test number",
    },
    {
      id: "aether-sip",
      name: "Test SIP address (simulator only)",
      group: "Test",
      description:
        "A placeholder SIP address for trying the flow. Not registered with any carrier — use a real trunk to take calls.",
      action: "Get test address",
    },
    {
      id: "twilio",
      name: "Import Twilio",
      group: "Import",
      description:
        "Bring a number you already own on Twilio. We verify it live.",
      action: "Import from Twilio",
    },
    {
      id: "vonage",
      name: "Import Vonage",
      group: "Import",
      description: "Bring a number from your Vonage (Nexmo) account.",
      action: "Import from Vonage",
    },
    {
      id: "telnyx",
      name: "Import Telnyx",
      group: "Import",
      description: "Bring a number from your Telnyx account.",
      action: "Import from Telnyx",
    },
    {
      id: "plivo",
      name: "Import Plivo",
      group: "Carrier",
      description:
        "Indian numbers at a fraction of Twilio's India rate, provisioned in a day or two. Needs an accepted compliance application — Indian numbers are issued to registered businesses, not individuals.",
      action: "Connect Plivo",
    },
    {
      id: "sip",
      name: "BYO SIP trunk",
      group: "SIP",
      description: "Register a number on your own SIP trunk or carrier.",
      action: "Add SIP trunk",
    },
  ],
  COUNTRIES = [
    {
      iso: "US",
      dial: "+1",
      flag: "🇺🇸",
      name: "United States",
    },
    {
      iso: "GB",
      dial: "+44",
      flag: "🇬🇧",
      name: "United Kingdom",
    },
    {
      iso: "IN",
      dial: "+91",
      flag: "🇮🇳",
      name: "India",
    },
    {
      iso: "CA",
      dial: "+1",
      flag: "🇨🇦",
      name: "Canada",
    },
    {
      iso: "AU",
      dial: "+61",
      flag: "🇦🇺",
      name: "Australia",
    },
    {
      iso: "DE",
      dial: "+49",
      flag: "🇩🇪",
      name: "Germany",
    },
    {
      iso: "FR",
      dial: "+33",
      flag: "🇫🇷",
      name: "France",
    },
    {
      iso: "BR",
      dial: "+55",
      flag: "🇧🇷",
      name: "Brazil",
    },
    {
      iso: "MX",
      dial: "+52",
      flag: "🇲🇽",
      name: "Mexico",
    },
    {
      iso: "JP",
      dial: "+81",
      flag: "🇯🇵",
      name: "Japan",
    },
  ];
