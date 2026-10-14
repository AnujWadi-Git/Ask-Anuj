// Central, reversible configuration. Change values here, not in handlers.
export const config = {
  allowedOrigins: ['https://anujwadi.com', 'https://www.anujwadi.com'],
  roles: ['recruiter', 'engineer', 'other'],
  sessionTtlSeconds: 2 * 60 * 60,
  maxNameLength: 60,

  limits: {
    ipPerMinute: 25,          // any API call
    ipPerDay: 250,
    sessionsPerIpPerDay: 12,
    turnsPerSession: 40,
    maxTextChars: 500,
    maxAudioBase64Chars: 900_000,   // ~20 s of 16 kHz mono 16-bit WAV
    maxSpeakChars: 700,
    maxHistoryMessages: 8,
    maxHistoryChars: 700,
    maxAnswerChars: 900,
    maxSpokenWords: 50,           // default brevity, enforced server-side
    maxDetailWords: 110,          // when the visitor asks for more detail
    maxOutputTokens: 160,
    globalDailyNeurons: 8500,       // Workers AI Free = 10,000/day; leave headroom
    adminFailuresPerHour: 10,
  },

  models: {
    llm: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    stt: '@cf/openai/whisper-large-v3-turbo',
    tts: '@cf/myshell-ai/melotts',
  },

  // Neurons derived from Cloudflare's published per-unit prices (2026-10-13).
  neurons: {
    '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { inPerToken: 0.0042, outPerToken: 0.0349 },
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { inPerToken: 0.0267, outPerToken: 0.2048 },
    sttPerSecond: 0.78,
    ttsPerChar: 0.021,
    fallback: { inPerToken: 0.0267, outPerToken: 0.2048 },   // assume expensive if model unknown
  },
};
