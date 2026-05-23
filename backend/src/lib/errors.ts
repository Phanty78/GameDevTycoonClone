/**
 * Remontée d'erreurs partagée (I/O — hors couche domaine pure).
 *
 * Poste les erreurs serveur sur un webhook Discord. Best-effort : ne jette
 * JAMAIS (une panne du reporter ne doit pas masquer l'erreur d'origine ni
 * casser la requête). Webhook absent -> remontée silencieusement désactivée.
 */

/** Limite stricte du champ `content` d'un message Discord. */
const DISCORD_CONTENT_LIMIT = 2000;

/** Dépendances injectables : par défaut l'env + le fetch global, surchargés en test. */
export interface ReportDeps {
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Met une erreur inconnue en texte lisible (message + stack si dispo). */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** Compose le contenu Discord, préfixé du contexte, tronqué à la limite. */
function formatMessage(error: unknown, context?: string): string {
  const header = context ? `**${context}**\n` : "";
  const body = describeError(error);
  const content = `${header}\`\`\`\n${body}\n\`\`\``;
  return content.length > DISCORD_CONTENT_LIMIT
    ? `${content.slice(0, DISCORD_CONTENT_LIMIT - 4)}…\`\`\``
    : content;
}

/**
 * Remonte une erreur vers Discord. Async mais ne rejette jamais : tout échec
 * (pas de webhook, réseau KO, statut non-2xx) retombe sur console.error.
 */
export async function reportError(
  error: unknown,
  context?: string,
  deps: ReportDeps = {},
): Promise<void> {
  const webhookUrl = deps.webhookUrl ?? process.env.DISCORD_ERROR_WEBHOOK;
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (!webhookUrl) {
    console.error(
      "[reportError] webhook absent, erreur non remontée:",
      describeError(error),
    );
    return;
  }

  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: formatMessage(error, context) }),
    });
    if (!res.ok) {
      console.error(`[reportError] Discord a répondu ${res.status}`);
    }
  } catch (sendError) {
    console.error("[reportError] échec d'envoi au webhook:", sendError);
  }
}
