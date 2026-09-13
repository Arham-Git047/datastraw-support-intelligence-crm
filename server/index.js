import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Prevent duplicate simultaneous AI analyses for the same ticket.
const activeAnalyses = new Set();

dotenv.config({ path: path.join(__dirname, '.env') });
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 8080);

const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = process.env.SUPABASE_URL && supabaseKey
  ? createClient(process.env.SUPABASE_URL, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const allowedOrigins = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));

const STATUS_VALUES = ['Open', 'In Progress', 'Closed'];
const PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'];
const SENTIMENT_VALUES = ['Positive', 'Neutral', 'Frustrated', 'Angry'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validStatus(value) {
  return STATUS_VALUES.includes(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireDb(res) {
  if (!supabase) {
    res.status(503).json({ error: 'Database is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to server/.env.' });
    return false;
  }
  return true;
}

function safeSearch(value) {
  return cleanText(value).replace(/[,%()"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function toAIInsights(row) {
  if (!row) return undefined;
  return {
    category: row.category,
    priority: row.priority,
    sentiment: row.sentiment,
    urgency_score: row.urgency_score,
    confidence: row.confidence,
    summary: row.summary,
    suggested_action: row.suggested_action,
    suggested_reply: row.suggested_reply,
    resolution_plan: Array.isArray(row.resolution_plan) ? row.resolution_plan : [],
    customer_impact: row.customer_impact,
    risk_factors: Array.isArray(row.risk_factors) ? row.risk_factors : [],
    data_signals: Array.isArray(row.data_signals) ? row.data_signals : [],
    similar_ticket_ids: Array.isArray(row.similar_ticket_ids) ? row.similar_ticket_ids : [],
    explanation: row.explanation,
    generated_at: row.generated_at || row.created_at,
  };
}

async function getLatestAI(ticketIds) {
  if (!ticketIds.length) return new Map();

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.ticket_id)) map.set(row.ticket_id, toAIInsights(row));
  }
  return map;
}

async function hydrateTickets(rows) {
  const ticketIds = rows.map((row) => row.ticket_id);
  const aiMap = await getLatestAI(ticketIds);
  return rows.map((row) => ({
    ...row,
    notes: row.notes || [],
    timeline: row.timeline || [],
    ai_insights: aiMap.get(row.ticket_id) || undefined,
  }));
}

async function getFullTicket(ticketId) {
  const [{ data: ticket, error: ticketError }, { data: notes, error: notesError }, { data: events, error: eventsError }, { data: aiRows, error: aiError }] = await Promise.all([
    supabase.from('tickets').select('*').eq('ticket_id', ticketId).maybeSingle(),
    supabase.from('notes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    supabase.from('ticket_events').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    supabase.from('ai_insights').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(1),
  ]);

  if (ticketError || notesError || eventsError || aiError) throw ticketError || notesError || eventsError || aiError;
  if (!ticket) return null;

  return {
    ...ticket,
    notes: notes || [],
    timeline: events || [],
    ai_insights: aiRows?.[0] ? toAIInsights(aiRows[0]) : undefined,
  };
}
app.get('/', (_req, res) => {
  res.json({
    service: 'datastraw-support-crm-api',
    status: 'running',
    endpoints: {
      health: '/health',
      tickets: '/api/tickets',
    },
  });
});
app.get('/health', async (_req, res) => {
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      service: 'datastraw-support-crm-api',
      database: 'not-configured',
    });
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('ticket_id')
    .limit(1);

  if (error) {
    console.error('Supabase health check failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(503).json({
      ok: false,
      service: 'datastraw-support-crm-api',
      database: 'unreachable',
      error: error.message,
      code: error.code ?? null,
    });
  }

  return res.json({
    ok: true,
    service: 'datastraw-support-crm-api',
    database: 'connected',
    sample_rows: data?.length ?? 0,
  });
});

// POST /api/tickets — required by the assessment.
app.post('/api/tickets', async (req, res) => {
  try {
    if (!requireDb(res)) return;

    const customer_name = cleanText(req.body.customer_name);
    const customer_email = cleanText(req.body.customer_email);
    const subject = cleanText(req.body.subject);
    const description = cleanText(req.body.description);

    if (!customer_name || !customer_email || !subject || !description) {
      return res.status(400).json({ error: 'Customer name, email, subject and description are required.' });
    }

    if (!validEmail(customer_email)) {
      return res.status(400).json({ error: 'Please enter a valid customer email address.' });
    }

    const { data, error } = await supabase
      .from('tickets')
      .insert({ customer_name, customer_email, subject, description, status: 'Open' })
      .select('ticket_id,created_at')
      .single();

    if (error) throw error;

    await supabase.from('ticket_events').insert({
      ticket_id: data.ticket_id,
      event_type: 'created',
      message: 'Ticket created',
      created_at: data.created_at,
    });

    return res.status(201).json(data);
  } catch (error) {
    console.error('POST /api/tickets', error);
    return res.status(500).json({ error: 'Failed to create ticket.' });
  }
});

// GET /api/tickets?status=Open&search=customer_name — required by the assessment.
app.get('/api/tickets', async (req, res) => {
  try {
    if (!requireDb(res)) return;

    const status = cleanText(req.query.status);
    const search = safeSearch(req.query.search);

    let query = supabase
      .from('tickets')
      .select('id,ticket_id,customer_name,customer_email,subject,description,status,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (status) {
      if (!validStatus(status)) return res.status(400).json({ error: 'Invalid status filter.' });
      query = query.eq('status', status);
    }

    if (search) {
      const pattern = `%${search}%`;
      query = query.or([
        `ticket_id.ilike.${pattern}`,
        `customer_name.ilike.${pattern}`,
        `customer_email.ilike.${pattern}`,
        `subject.ilike.${pattern}`,
        `description.ilike.${pattern}`,
      ].join(','));
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(await hydrateTickets(data || []));
  } catch (error) {
    console.error('GET /api/tickets', error);
    return res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

// GET /api/tickets/:ticket_id — required by the assessment.
app.get('/api/tickets/:ticket_id', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const ticketId = cleanText(req.params.ticket_id);
    if (!ticketId) return res.status(400).json({ error: 'Ticket ID is required.' });

    const ticket = await getFullTicket(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    return res.json(ticket);
  } catch (error) {
    console.error('GET /api/tickets/:ticket_id', error);
    return res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// PUT /api/tickets/:ticket_id — required by the assessment.
app.put('/api/tickets/:ticket_id', async (req, res) => {
  try {
    if (!requireDb(res)) return;

    const ticketId = cleanText(req.params.ticket_id);
    const status = cleanText(req.body.status);
    const noteText = cleanText(req.body.notes);

    if (!validStatus(status)) return res.status(400).json({ error: 'Invalid status.' });

    const { data: existing, error: existingError } = await supabase
      .from('tickets')
      .select('status')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return res.status(404).json({ error: 'Ticket not found.' });

    const { data: updated, error: updateError } = await supabase
      .from('tickets')
      .update({ status })
      .eq('ticket_id', ticketId)
      .select('updated_at')
      .single();

    if (updateError) throw updateError;

    const now = updated.updated_at;

    if (existing.status !== status) {
      const { error } = await supabase.from('ticket_events').insert({
        ticket_id: ticketId,
        event_type: 'status_changed',
        message: `Status changed → ${status}`,
        created_at: now,
      });
      if (error) throw error;
    }

    if (noteText) {
      const [{ error: noteError }, { error: eventError }] = await Promise.all([
        supabase.from('notes').insert({ ticket_id: ticketId, note_text: noteText, created_at: now }),
        supabase.from('ticket_events').insert({ ticket_id: ticketId, event_type: 'note_added', message: 'Agent added a note', created_at: now }),
      ]);
      if (noteError || eventError) throw noteError || eventError;
    }

    return res.json({ success: true, updated_at: now });
  } catch (error) {
    console.error('PUT /api/tickets/:ticket_id', error);
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});


async function getTicketById(ticketId) {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function listTicketRecords() {
  const { data, error } = await supabase
    .from('tickets')
    .select(
      'id,ticket_id,customer_name,customer_email,subject,description,status,created_at,updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function saveAIInsights(ticketId, insights) {
  const { error } = await supabase
    .from('ai_insights')
    .insert({
      ticket_id: ticketId,
      category: insights.category,
      priority: insights.priority,
      sentiment: insights.sentiment,
      urgency_score: insights.urgency_score,
      confidence: insights.confidence,
      summary: insights.summary,
      suggested_action: insights.suggested_action,
      suggested_reply: insights.suggested_reply,
      resolution_plan: insights.resolution_plan || [],
      customer_impact: insights.customer_impact,
      risk_factors: insights.risk_factors || [],
      data_signals: insights.data_signals || [],
      similar_ticket_ids: insights.similar_ticket_ids || [],
      explanation: insights.explanation,
      generated_at: insights.generated_at || new Date().toISOString(),
    });

  if (error) throw error;
}

async function addTicketEvent(ticketId, eventType, message) {
  const { error } = await supabase
    .from('ticket_events')
    .insert({
      ticket_id: ticketId,
      event_type: eventType,
      message,
      created_at: new Date().toISOString(),
    });

  if (error) throw error;
}

app.post(
  '/api/tickets/:ticket_id/analyze',
  async (req, res) => {
    const ticketId =
      cleanText(req.params.ticket_id);

    if (!ticketId) {
      return res.status(400).json({
        error: 'Ticket ID is required.',
      });
    }

    /*
     * Prevent duplicate simultaneous analysis
     * for the same ticket.
     */
    if (activeAnalyses.has(ticketId)) {
      return res.status(409).json({
        error:
          'This ticket is already being analyzed. Please wait for the current analysis to finish.',
        ticket_id: ticketId,
        processing: true,
      });
    }

    activeAnalyses.add(ticketId);

    console.log(
      `[AI] Analysis lock acquired | ticket=${ticketId}`
    );

    try {
      /*
       * Load the ticket from the database.
       */
      const ticket =
        await getTicketById(ticketId);

      if (!ticket) {
        return res.status(404).json({
          error: 'Ticket not found.',
          ticket_id: ticketId,
        });
      }

      /*
       * Load comparison tickets so the AI can
       * identify recurring problems.
       */
      const comparableTickets =
        await listTicketRecords();

      /*
       * Run the real AI pipeline.
       *
       * aiAnalyze() already handles:
       * OpenRouter → validation → fallback.
       */
      const insights =
        await aiAnalyze(
          ticket,
          comparableTickets.filter(
            (item) =>
              item.ticket_id !==
              ticketId
          )
        );

      /*
       * Persist AI decision brief.
       */
      await saveAIInsights(
        ticketId,
        insights
      );

      /*
       * Record the AI operation in the
       * immutable ticket timeline.
       */
      await addTicketEvent(
        ticketId,
        'ai_analyzed',
        `AI decision brief updated · ${insights.category} · ${insights.priority}`
      );

      console.log(
        `[AI] Analysis completed | ticket=${ticketId}`
      );

      return res.json(
        insights
      );
    } catch (error) {
      console.error(
        `[AI] Analysis request failed | ticket=${ticketId}`,
        error
      );

      /*
       * Never expose internal stack traces,
       * API keys, provider responses or database
       * implementation details to the browser.
       */
      return res.status(500).json({
        error:
          'The ticket could not be analyzed right now. Please try again.',
        ticket_id: ticketId,
      });
    } finally {
      /*
       * GUARANTEED CLEANUP.
       *
       * Whether analysis succeeds, falls back,
       * or throws an error, the ticket must be
       * unlocked.
       */
      activeAnalyses.delete(ticketId);

      console.log(
        `[AI] Analysis lock released | ticket=${ticketId}`
      );
    }
  }
);
async function aiAnalyze(
  ticket,
  comparableTickets = []
) {
  const text =
    `${ticket.subject} ${ticket.description}`.toLowerCase();

  /*
   * Find similar tickets first.
   * These IDs are passed to the AI so it can identify
   * recurring patterns without inventing ticket IDs.
   */
  const similarTicketIds =
    findSimilarTicketIds(
      ticket,
      comparableTickets
    );

  /*
   * OpenRouter is the primary AI provider.
   *
   * The API key remains server-side.
   */
  const apiKey =
    cleanText(
      process.env.OPENROUTER_API_KEY
    );

  const model =
    cleanText(
      process.env.OPENROUTER_MODEL
    ) ||
    'openrouter/free';

  console.log(
    `[AI] Starting analysis | ticket=${ticket.ticket_id} | provider=OpenRouter | configured=${Boolean(apiKey)} | model=${model}`
  );

  /*
   * ======================================================
   * PRIMARY AI PATH
   * ======================================================
   */
  if (apiKey) {
    try {
      const result =
        await analyzeWithOpenRouter(
          ticket,
          similarTicketIds
        );

      console.log(
        `[AI] PROVIDER=OPENROUTER | SUCCESS | ticket=${ticket.ticket_id} | model=${model}`
      );

      return result;
    } catch (error) {
      /*
       * IMPORTANT:
       * AI failure must never prevent the ticket from
       * receiving a usable analysis.
       */
      console.warn(
        `[AI] PROVIDER=OPENROUTER | FAILED | ticket=${ticket.ticket_id} | reason=${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  } else {
    console.warn(
      '[AI] PROVIDER=OPENROUTER | NOT_CONFIGURED | OPENROUTER_API_KEY is missing'
    );
  }

  /*
   * ======================================================
   * SAFE DETERMINISTIC FALLBACK
   * ======================================================
   *
   * If OpenRouter is unavailable, rate-limited,
   * malformed, or otherwise fails, use the local
   * deterministic intelligence engine.
   *
   * This keeps ticket creation and analysis operational.
   */
  console.log(
    `[AI] PROVIDER=DETERMINISTIC_FALLBACK | ticket=${ticket.ticket_id}`
  );

  return deterministicAnalysis(
    ticket,
    text,
    similarTicketIds
  );
}
async function analyzeWithOpenRouter(
  ticket,
  similarTicketIds = []
) {
  const apiKey =
    cleanText(
      process.env.OPENROUTER_API_KEY
    );

  const model =
    cleanText(
      process.env.OPENROUTER_MODEL
    ) ||
    'openrouter/free';

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured.'
    );
  }

  const systemPrompt = `
You are the decision-support intelligence layer of a customer support CRM.

Analyze the supplied support ticket using only the evidence provided.

Do not invent:
- transactions
- order states
- refunds
- policies
- account states
- delivery events
- completed actions
- verification results
- timelines

The support employee retains final decision authority.

Produce a concise operational decision brief for a non-technical support employee.

Determine:
- what is happening
- why it matters
- priority
- customer sentiment
- attention score
- confidence
- recommended next action
- customer impact
- risks
- evidence
- resolution path
- safe customer-facing reply
- explanation connecting evidence to recommendation

Use plain language.

Allowed categories:
Payment
Refund
Delivery
Account
Product
Billing
General

Allowed priorities:
Low
Medium
High
Critical

Allowed sentiments:
Positive
Neutral
Frustrated
Angry

urgency_score: integer 0-100
confidence: integer 0-100

Only use similar_ticket_ids supplied by the backend.

Return ONLY JSON.
Do not use Markdown.
Do not use code fences.
`.trim();

  const userPrompt = `
TICKET

${JSON.stringify({
  ticket_id:
    ticket.ticket_id,

  customer_name:
    ticket.customer_name,

  subject:
    ticket.subject,

  description:
    ticket.description
})}

SIMILAR TICKET IDS

${JSON.stringify(
  similarTicketIds
)}

Return exactly this structure:

{
  "category": "Payment",
  "priority": "High",
  "sentiment": "Frustrated",
  "urgency_score": 85,
  "confidence": 90,
  "summary": "plain-language summary",
  "suggested_action": "recommended next action",
  "suggested_reply": "safe customer-facing reply",
  "resolution_plan": [
    "step 1",
    "step 2",
    "step 3"
  ],
  "customer_impact": "why this matters",
  "risk_factors": [
    "risk"
  ],
  "data_signals": [
    "evidence"
  ],
  "similar_ticket_ids": [],
  "explanation": "evidence-based explanation"
}
`.trim();

  /*
   * Free router:
   * OpenRouter chooses an available free model
   * capable of handling the requested task.
   */
  console.log(
    `[AI] Calling OpenRouter | ticket=${ticket.ticket_id} | model=${model}`
  );

  const response =
    await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',

          'HTTP-Referer':
            'http://localhost:5173',

          'X-Title':
            'DataStraw Support Intelligence CRM'
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: 'system',
              content:
                systemPrompt
            },

            {
              role: 'user',
              content:
                userPrompt
            }
          ],

          temperature: 0.15,

          max_tokens: 1400,

          response_format: {
            type: 'json_object'
          }
        })
      }
    );

  console.log(
    `[AI] OpenRouter HTTP response | ticket=${ticket.ticket_id} | status=${response.status}`
  );

  const body =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    const providerMessage =
      body?.error?.message ||
      body?.error?.metadata?.raw ||
      body?.error?.code ||
      `HTTP ${response.status}`;

    throw new Error(
      `OpenRouter API error (${response.status}): ${providerMessage}`
    );
  }

  let raw =
    body?.choices?.[0]?.message?.content;

  if (Array.isArray(raw)) {
    raw = raw
      .map(
        (item) =>
          typeof item === 'string'
            ? item
            : item?.text || ''
      )
      .join('');
  }

  raw =
    typeof raw === 'string'
      ? raw.trim()
      : '';

  if (!raw) {
    throw new Error(
      'OpenRouter returned an empty response.'
    );
  }

  console.log(
    `[AI] OpenRouter content received | ticket=${ticket.ticket_id} | chars=${raw.length}`
  );

  /*
   * Normalize common model formatting.
   */
  let jsonText = raw.trim();

  /*
   * Remove Markdown fences when a free model wraps
   * the JSON response in ```json ... ```.
   */
  jsonText = jsonText
    .replace(
      /^```(?:json)?\s*/i,
      ''
    )
    .replace(
      /\s*```$/i,
      ''
    )
    .trim();

  /*
   * Always extract the outermost JSON object.
   * This handles leading/trailing commentary.
   */
  const firstBrace =
    jsonText.indexOf('{');

  const lastBrace =
    jsonText.lastIndexOf('}');

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    console.warn(
      '[AI] OpenRouter response contained no complete JSON object.'
    );

    throw new Error(
      'OpenRouter did not return a complete JSON object.'
    );
  }

  jsonText =
    jsonText.slice(
      firstBrace,
      lastBrace + 1
    ).trim();

  let parsed;

  try {
    parsed =
      JSON.parse(jsonText);
  } catch (firstError) {
    /*
     * Second attempt: repair trailing commas and
     * remove invalid control characters.
     */
    const repairedJson =
      jsonText
        .replace(
          /,\s*([}\]])/g,
          '$1'
        )
        .replace(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
          ''
        );

    try {
      parsed =
        JSON.parse(repairedJson);

      console.warn(
        `[AI] OpenRouter JSON required minor repair | ticket=${ticket.ticket_id}`
      );
    } catch {
      console.warn(
        '[AI] OpenRouter raw response:',
        raw
      );

      throw new Error(
        'OpenRouter returned invalid JSON.'
      );
    }
  }

  const categoryValues = [
    'Payment',
    'Refund',
    'Delivery',
    'Account',
    'Product',
    'Billing',
    'General'
  ];

  if (
    !categoryValues.includes(
      parsed.category
    )
  ) {
    throw new Error(
      `Invalid category: ${parsed.category}`
    );
  }

  if (
    !PRIORITY_VALUES.includes(
      parsed.priority
    )
  ) {
    throw new Error(
      `Invalid priority: ${parsed.priority}`
    );
  }

  if (
    !SENTIMENT_VALUES.includes(
      parsed.sentiment
    )
  ) {
    throw new Error(
      `Invalid sentiment: ${parsed.sentiment}`
    );
  }

  const urgencyScore =
    Number(
      parsed.urgency_score
    );

  const confidence =
    Number(
      parsed.confidence
    );

  if (
    !Number.isInteger(
      urgencyScore
    ) ||
    urgencyScore < 0 ||
    urgencyScore > 100
  ) {
    throw new Error(
      'Invalid urgency score.'
    );
  }

  if (
    !Number.isInteger(
      confidence
    ) ||
    confidence < 0 ||
    confidence > 100
  ) {
    throw new Error(
      'Invalid confidence score.'
    );
  }

  function normalizeStringArray(
    value,
    maxItems
  ) {
    return Array.isArray(value)
      ? value
          .filter(
            (item) =>
              typeof item ===
              'string'
          )
          .map(
            (item) =>
              item.trim()
          )
          .filter(Boolean)
          .slice(
            0,
            maxItems
          )
      : [];
  }

  const normalizedSimilarIds =
    normalizeStringArray(
      parsed.similar_ticket_ids,
      3
    ).filter(
      (id) =>
        similarTicketIds.includes(id)
    );

  const summary =
    cleanText(
      parsed.summary
    );

  const suggestedAction =
    cleanText(
      parsed.suggested_action
    );

  const suggestedReply =
    cleanText(
      parsed.suggested_reply
    );

  const customerImpact =
    cleanText(
      parsed.customer_impact
    );

  const explanation =
    cleanText(
      parsed.explanation
    );

  if (
    !summary ||
    !suggestedAction ||
    !customerImpact ||
    !explanation
  ) {
    throw new Error(
      'OpenRouter returned an incomplete decision brief.'
    );
  }

  console.log(
    `[AI] OpenRouter analysis succeeded | ticket=${ticket.ticket_id} | model=${model} | category=${parsed.category} | priority=${parsed.priority} | confidence=${confidence}`
  );

  return {
    category:
      parsed.category,

    priority:
      parsed.priority,

    sentiment:
      parsed.sentiment,

    urgency_score:
      urgencyScore,

    confidence:
      confidence,

    summary,

    suggested_action:
      suggestedAction,

    suggested_reply:
      suggestedReply,

    resolution_plan:
      normalizeStringArray(
        parsed.resolution_plan,
        6
      ),

    customer_impact:
      customerImpact,

    risk_factors:
      normalizeStringArray(
        parsed.risk_factors,
        6
      ),

    data_signals:
      normalizeStringArray(
        parsed.data_signals,
        8
      ),

    similar_ticket_ids:
      normalizedSimilarIds,

    explanation,

    generated_at:
      new Date().toISOString()
  };
}
function deterministicAnalysis(ticket, text, similarTicketIds = []) {
  const category = classifyCategory(text);

  const financial = hasAny(text, ['payment', 'paid', 'charge', 'charged', 'deducted', 'refund', 'money', 'transaction']);
  const missingOutcome = hasAny(text, [
    'not created',
    'no order',
    'missing',
    'does not appear',
    "didn't receive",
    'did not receive',
    'not received',
    'failed',
    'not showing',
    'not visible',
  ]);
  const delay = hasAny(text, ['still waiting', 'delayed', 'again', 'days', 'week', 'pending']);
  const explicitUrgency = hasAny(text, ['urgent', 'asap', 'immediately', 'right now', 'emergency']);
  const security = hasAny(text, ['fraud', 'unauthorized transaction', 'account hacked', 'security breach', 'hacked']);
  const negative = hasAny(text, ['angry', 'frustrated', 'upset', 'terrible', 'unacceptable', 'not acceptable']);
  const blocking = hasAny(text, ['cannot', 'can\'t', 'unable', 'blocked', 'no access', 'cannot use']);

  let urgency_score = 30;
  if (financial) urgency_score += 22;
  if (missingOutcome) urgency_score += 20;
  if (delay) urgency_score += 10;
  if (explicitUrgency) urgency_score += 18;
  if (security) urgency_score += 35;
  if (negative) urgency_score += 10;
  if (blocking) urgency_score += 8;
  if (similarTicketIds.length) urgency_score += Math.min(10, similarTicketIds.length * 5);
  urgency_score = Math.min(99, Math.max(25, urgency_score));

  const critical = security;
  const priority = critical ? 'Critical' : urgency_score >= 65 ? 'High' : urgency_score >= 45 ? 'Medium' : 'Low';

  const sentiment = negative || missingOutcome || delay
    ? 'Frustrated'
    : /thank you|thanks/.test(text)
      ? 'Positive'
      : 'Neutral';

  const risk_factors = [];
  const data_signals = [];

  if (financial) {
    risk_factors.push('Potential financial impact');
    data_signals.push('Payment, charge, refund or transaction language detected');
  }
  if (missingOutcome) {
    risk_factors.push('Expected customer outcome is not visible or not completed');
    data_signals.push('Language indicates a missing, failed or not-yet-received outcome');
  }
  if (delay) {
    risk_factors.push('Possible delay or unresolved wait');
    data_signals.push('Waiting, pending or delay language detected');
  }
  if (security) {
    risk_factors.push('Potential security or unauthorized-access risk');
    data_signals.push('Fraud, unauthorized or account-security language detected');
  }
  if (blocking) {
    risk_factors.push('Customer may be blocked from completing an expected action');
    data_signals.push('Blocking/access language detected');
  }
  if (similarTicketIds.length) {
    risk_factors.push(`${similarTicketIds.length} similar case${similarTicketIds.length > 1 ? 's' : ''} found`);
    data_signals.push(`Similar issue wording found in ${similarTicketIds.join(', ')}`);
  }
  if (!risk_factors.length) risk_factors.push('No immediate high-impact risk detected from the available message');
  if (!data_signals.length) data_signals.push('Decision based on issue type and customer wording');

  const suggested_action = actionFor(category, priority);

  const summary = category === 'Payment' && missingOutcome
    ? `The customer reports that money moved but the expected order outcome is missing. This is primarily a reconciliation problem: confirm the transaction result and compare it with the order state before deciding whether to complete, reconcile or refund.`
    : category === 'Refund'
      ? `The customer is waiting for a refund outcome. Confirm approval and settlement status before giving a specific expected credit timeline.`
      : category === 'Delivery'
        ? `The customer is reporting a delivery or tracking problem. Compare the promised date with the latest carrier event before deciding whether escalation is needed.`
        : `The customer needs help with a ${category.toLowerCase()} issue. The safest next step is to verify the operational dependency before taking action.`;

  const customer_impact = security || (financial && missingOutcome)
    ? 'High impact: the message indicates money, security or a missing customer outcome. Verify the facts before routine processing.'
    : priority === 'High'
      ? 'Meaningful impact: the issue appears unresolved and may block the expected customer outcome.'
      : priority === 'Medium'
        ? 'Moderate impact: the customer needs a concrete update and a clear path to resolution.'
        : 'Lower immediate impact based on the evidence currently available.';

  const resolution_plan = [
    `Confirm what happened: ${ticket.subject}.`,
    suggested_action,
    priority === 'Critical' || priority === 'High'
      ? 'Record the verification result and customer-facing outcome before closing the case.'
      : 'Record the outcome and close the case once the customer-impacting issue is resolved.',
  ];

  const explanationParts = [
    `Issue type is ${category}.`,
    `${financial ? 'Financial impact signals are present. ' : ''}${missingOutcome ? 'The expected outcome appears incomplete or missing. ' : ''}${delay ? 'There is also a delay signal. ' : ''}`.trim(),
    `The case scores ${urgency_score}/100 because the message combines issue impact and resolution-risk signals.`,
    `Customer tone is assessed as ${sentiment.toLowerCase()}.`,
  ].filter(Boolean);

  if (similarTicketIds.length) {
    explanationParts.push(`The system found similar cases (${similarTicketIds.join(', ')}), which may indicate a recurring issue rather than an isolated case.`);
  }

  if (security) {
    explanationParts.push('Security-related wording requires immediate verification and human review.');
  }

  return {
    category,
    priority,
    sentiment,
    urgency_score,
    confidence: Math.min(97, 78 + (category !== 'General' ? 8 : 0) + Math.min(11, risk_factors.length * 2)),
    summary,
    suggested_action,
    suggested_reply: `Hi ${ticket.customer_name}, we have received your request regarding ${ticket.subject.toLowerCase()}. We are checking the relevant details and will update you with the next step shortly.`,
    resolution_plan,
    customer_impact,
    risk_factors,
    data_signals,
    similar_ticket_ids: similarTicketIds,
    explanation: explanationParts.join(' '),
    generated_at: new Date().toISOString(),
  };
}

function findSimilarTicketIds(ticket, candidates = []) {
  const current = new Set(
    `${ticket.subject} ${ticket.description}`
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 5),
  );
  if (!current.size) return [];

  return candidates
    .map((candidate) => {
      const other = new Set(
        `${candidate.subject} ${candidate.description}`
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, ' ')
          .split(/\s+/)
          .filter((token) => token.length >= 5),
      );
      const shared = [...current].filter((token) => other.has(token)).length;
      return { id: candidate.ticket_id, shared };
    })
    .filter((item) => item.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map((item) => item.id);
}

function classifyCategory(text) {
  if (/payment|paid|charge|transaction|charged|deducted/.test(text)) return 'Payment';
  if (/refund|return|money back|reimbursement/.test(text)) return 'Refund';
  if (/delivery|deliver|shipment|tracking|courier|package/.test(text)) return 'Delivery';
  if (/login|password|account|blocked|sign in|otp/.test(text)) return 'Account';
  if (/product|damaged|broken|defective|wrong item/.test(text)) return 'Product';
  if (/invoice|gst|billing/.test(text)) return 'Billing';
  return 'General';
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function actionFor(category, priority) {
  const prefix = priority === 'Critical'
    ? 'Check this case immediately. '
    : priority === 'High'
      ? 'Address this before routine tickets. '
      : priority === 'Medium'
        ? 'Handle with a concrete customer update. '
        : '';

  const actions = {
    Payment: 'Verify the transaction, confirm whether an order exists, then reconcile or refund based on the verified outcome.',
    Refund: 'Confirm approval and settlement status, then provide the customer with a specific expected credit timeline.',
    Delivery: 'Check the latest carrier scan and promised delivery date, then escalate if the shipment is stalled.',
    Account: 'Verify account state and recent access activity, then use the safest recovery path.',
    Product: 'Confirm the product and order context, then determine whether replacement, return or troubleshooting is appropriate.',
    Billing: 'Validate the billing record and invoice details, then correct any mismatch before replying.',
    General: 'Identify the operational dependency, verify the facts, and document the next concrete action before responding.',
  };

  return prefix + actions[category];
}

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Datastraw CRM API listening on :${port}`);
});
