import { config } from '#config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech';

export class OpenRouterError extends Error {
        constructor(message, status = null) {
                super(message);
                this.name = 'OpenRouterError';
                this.status = status;
        }
}

const normalizeContent = (content) => {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
                return content
                        .map((part) => {
                                if (typeof part === 'string') return part;
                                if (typeof part?.text === 'string') return part.text;
                                return '';
                        })
                        .filter(Boolean)
                        .join('\n');
        }
        return '';
};

const citationLinks = (annotations = []) => {
        const seen = new Set();
        const links = [];

        for (const annotation of annotations) {
                const citation = annotation?.url_citation;
                if (!citation?.url || seen.has(citation.url)) continue;
                seen.add(citation.url);

                let label = citation.title || citation.url;
                try {
                        label = new URL(citation.url).hostname.replace(/^www\./, '');
                } catch {}

                links.push(`[${label}](${citation.url})`);
                if (links.length >= 5) break;
        }

        return links;
};

const trimDiscord = (text, max = 3500) => {
        if (text.length <= max) return text;
        return `${text.slice(0, max - 20).trim()}...`;
};

const desiredSuggestReplyCount = (content = '') => {
        const text = String(content || '').trim();
        const words = text.split(/\s+/).filter(Boolean).length;

        if (words <= 6 || text.length <= 40) return 4;
        if (words <= 35 || text.length <= 220) return 2;
        return 1;
};

const desiredRefinementCount = (content = '') => {
        const text = String(content || '').trim();
        const words = text.split(/\s+/).filter(Boolean).length;

        if (words <= 6 || text.length <= 40) return 4;
        if (words <= 25 || text.length <= 160) return 2;
        return 1;
};

const parseReplySuggestions = (text, max) => {
        const cleaned = String(text || '')
                .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, '').trim())
                .trim();
        const numbered = cleaned
                .split(/\n(?=\s*(?:\d+[\).]|[-*])\s+)/g)
                .map((entry) => entry.replace(/^\s*(?:\d+[\).]|[-*])\s+/, '').trim())
                .filter(Boolean);
        const candidates = numbered.length > 1 ? numbered : [cleaned];

        return candidates
                .map((entry) =>
                        entry
                                .replace(/^["']|["']$/g, '')
                                .replace(/\n{3,}/g, '\n\n')
                                .trim(),
                )
                .filter(Boolean)
                .slice(0, max);
};

const webResultLimit = () => Math.max(1, Math.min(config.openrouter.webMaxResults || 3, 25));

const shouldUseWebPlugin = (model) => /(^|:)free($|:)/.test(model);

const isToolSupportError = (error) => (
        error instanceof OpenRouterError &&
        error.status === 404 &&
        /no endpoints found.*support tool use/i.test(error.message)
);

const addWebPlugin = (body) => {
        const webPlugin = {
                id: 'web',
                max_results: webResultLimit(),
        };

        if (config.openrouter.webEngine) webPlugin.engine = config.openrouter.webEngine;
        if (config.openrouter.webMode) webPlugin.mode = config.openrouter.webMode;

        body.plugins = [webPlugin];
};

const addWebTool = (body) => {
        const webSearch = {
                type: 'openrouter:web_search',
                parameters: {
                        max_results: webResultLimit(),
                        max_uses: 2,
                        max_total_results: webResultLimit(),
                },
        };

        if (config.openrouter.webEngine) webSearch.parameters.engine = config.openrouter.webEngine;
        if (config.openrouter.webMode) webSearch.parameters.mode = config.openrouter.webMode;

        body.tools = [webSearch];
        body.max_tool_calls = 2;
};

const createRequestBody = ({
        model,
        question,
        messages,
        useWeb = false,
        webMode = 'tool',
        systemPrompt = null,
        temperature = 0.6,
}) => {
        const body = {
                model,
                max_tokens: config.openrouter.maxTokens,
                temperature,
                messages: [
                        {
                                role: 'system',
                                content: systemPrompt ||
                                        'You are Saanvi, a cute but useful Discord utility bot. Answer clearly and briefly. ' +
                                        'If current internet knowledge is required and web search is not enabled, say that web search should be enabled instead of guessing.',
                        },
                        ...(Array.isArray(messages) && messages.length
                                ? messages
                                : [
                                          {
                                                  role: 'user',
                                                  content: question,
                                          },
                                  ]),
                ],
        };

        if (!useWeb) return body;

        body.messages[0].content += ' When web search is enabled, use it for current facts and cite the sources.';

        if (webMode === 'plugin') {
                addWebPlugin(body);
        } else {
                addWebTool(body);
        }

        return body;
};

const openRouterHeaders = () => {
        const apiKey = config.openrouter.apiKey;

        if (!apiKey) {
                throw new Error('OPENROUTER_API_KEY is not configured.');
        }

        const headers = {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
        };

        if (config.openrouter.referer) headers['HTTP-Referer'] = config.openrouter.referer;
        if (config.openrouter.title) headers['X-OpenRouter-Title'] = config.openrouter.title;

        return headers;
};

const requestOpenRouter = async ({ headers, body }) => {
        const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
        });

        const raw = await response.text();
        let data = null;

        try {
                data = raw ? JSON.parse(raw) : null;
        } catch {}

        if (!response.ok) {
                const message = data?.error?.message || raw || response.statusText;
                throw new OpenRouterError(message, response.status);
        }

        return data;
};

const requestOpenRouterSpeech = async ({ headers, body }) => {
        const response = await fetch(OPENROUTER_SPEECH_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
        });

        if (!response.ok) {
                const raw = await response.text().catch(() => '');
                let data = null;

                try {
                        data = raw ? JSON.parse(raw) : null;
                } catch {}

                const message = data?.error?.message || raw || response.statusText;
                throw new OpenRouterError(message, response.status);
        }

        return Buffer.from(await response.arrayBuffer());
};

export const askOpenRouter = async ({ question, messages, useWeb = false }) => {
        const model = useWeb
                ? config.openrouter.askWebModel || config.openrouter.askModel
                : config.openrouter.askModel;

        const headers = openRouterHeaders();

        const webMode = useWeb && shouldUseWebPlugin(model) ? 'plugin' : 'tool';
        const body = createRequestBody({
                model,
                question,
                messages,
                useWeb,
                webMode,
        });

        let data;

        try {
                data = await requestOpenRouter({ headers, body });
        } catch (error) {
                if (!useWeb || webMode === 'plugin' || !isToolSupportError(error)) {
                        throw error;
                }

                data = await requestOpenRouter({
                        headers,
                        body: createRequestBody({
                                model,
                                question,
                                messages,
                                useWeb,
                                webMode: 'plugin',
                        }),
                });
        }

        const choice = data?.choices?.[0];
        const message = choice?.message;
        let answer = normalizeContent(message?.content).trim();

        if (!answer) throw new Error('OpenRouter returned an empty response.');

        const citations = citationLinks(message?.annotations);
        if (citations.length) {
                answer += `\n\n**Sources**\n${citations.join('\n')}`;
        }

        return {
                answer: trimDiscord(answer),
                model: data?.model || model,
                usedWeb: useWeb,
        };
};


export const suggestReplyOpenRouter = async ({
        sourceMessage,
        tone,
        customTone = '',
        changeRequest = '',
        previousReply = '',
}) => {
        const model = config.openrouter.suggestReplyModel;
        const headers = openRouterHeaders();
        const toneText = tone === 'custom' ? customTone : tone;
        const replyCount = desiredSuggestReplyCount(sourceMessage.content);
        const replyInstruction =
                replyCount > 1
                        ? `Write ${replyCount} distinct natural replies the user could send. Put each reply on its own numbered line.`
                        : 'Write one natural reply the user could send.';

        const body = createRequestBody({
                model,
                temperature: 0.75,
                systemPrompt:
                        'You write Discord message replies for the user. Return only the reply suggestion text. ' +
                        'Do not explain, quote the original message, add labels, use markdown code fences, or mention that you are an AI.',
                messages: [
                        {
                                role: 'user',
                                content:
                                        `Original message author: ${sourceMessage.author || 'Unknown'}\n` +
                                        `Original message:\n${sourceMessage.content}\n\n` +
                                        `Requested tone: ${toneText || 'normal'}\n` +
                                        (previousReply
                                                ? `Previous suggestion:\n${previousReply}\n\n`
                                                : '') +
                                        (changeRequest
                                                ? `Changes requested:\n${changeRequest}\n\n`
                                                : '') +
                                        `${replyInstruction} Keep replies concise and Discord-friendly. Maximum ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}.`,
                        },
                ],
        });

        const data = await requestOpenRouter({ headers, body });
        const message = data?.choices?.[0]?.message;
        const answer = normalizeContent(message?.content).trim();

        if (!answer) throw new Error('OpenRouter returned an empty response.');
        const suggestions = parseReplySuggestions(answer, replyCount);

        return {
                answer: trimDiscord(suggestions.join('\n---\n') || answer, 1800),
                suggestions,
                model: data?.model || model,
        };
};

export const refineMessageOpenRouter = async ({
        sourceMessage,
        tone,
        customTone = '',
        changeRequest = '',
        previousRefinement = '',
}) => {
        const model = config.openrouter.suggestReplyModel;
        const headers = openRouterHeaders();
        const toneText = tone === 'custom' ? customTone : tone;
        const refinementCount = desiredRefinementCount(sourceMessage.content);
        const refinementInstruction =
                refinementCount > 1
                        ? `Write ${refinementCount} distinct refined versions. Put each version on its own numbered line.`
                        : 'Write one refined version.';

        const body = createRequestBody({
                model,
                temperature: 0.65,
                systemPrompt:
                        "You rewrite the user's own Discord message into clear, natural English. " +
                        'Always output English only. Translate Hindi, Hinglish, Urdu, and any other language into English before improving the wording. ' +
                        'Preserve the original meaning, intent, names, URLs, numbers, and directness. Do not add new facts. ' +
                        'Return only the refined message text. Do not explain, add labels, use markdown code fences, or mention that you are an AI.',
                messages: [
                        {
                                role: 'user',
                                content:
                                        `Original message:\n${sourceMessage.content}\n\n` +
                                        `Requested tone: ${toneText || 'normal'}\n` +
                                        (previousRefinement
                                                ? `Previous refinement:\n${previousRefinement}\n\n`
                                                : '') +
                                        (changeRequest
                                                ? `Changes requested:\n${changeRequest}\n\n`
                                                : '') +
                                        `${refinementInstruction} Keep it Discord-friendly. Avoid emojis unless they are necessary to preserve the original meaning. Maximum ${refinementCount} version${refinementCount === 1 ? '' : 's'}.`,
                        },
                ],
        });

        const data = await requestOpenRouter({ headers, body });
        const message = data?.choices?.[0]?.message;
        const answer = normalizeContent(message?.content).trim();

        if (!answer) throw new Error('OpenRouter returned an empty response.');
        const refinements = parseReplySuggestions(answer, refinementCount);

        return {
                answer: trimDiscord(
                        refinements.join('\n---\n') || answer,
                        1800,
                ),
                refinements,
                model: data?.model || model,
        };
};

export const explainMessageOpenRouter = async ({
        sourceMessage,
        changeRequest = '',
        previousExplanation = '',
}) => {
        const model = config.openrouter.suggestReplyModel;
        const headers = openRouterHeaders();

        const body = createRequestBody({
                model,
                temperature: 0.35,
                systemPrompt:
                        'You explain confusing Discord messages in simple, small language. ' +
                        'Keep the explanation short enough to understand quickly, especially when the original message is long. ' +
                        'Do not quote the full original message, add labels, use markdown code fences, or mention that you are an AI.',
                messages: [
                        {
                                role: 'user',
                                content:
                                        `Message author: ${sourceMessage.author || 'Unknown'}\n` +
                                        `Message:\n${sourceMessage.content}\n\n` +
                                        (previousExplanation
                                                ? `Previous explanation:\n${previousExplanation}\n\n`
                                                : '') +
                                        (changeRequest
                                                ? `Changes requested:\n${changeRequest}\n\n`
                                                : '') +
                                        'Explain the message simply in 1-4 short sentences. If there is slang, hidden meaning, or confusing context, explain that plainly. Keep it Discord-friendly.',
                        },
                ],
        });

        const data = await requestOpenRouter({ headers, body });
        const message = data?.choices?.[0]?.message;
        const answer = normalizeContent(message?.content).trim();

        if (!answer) throw new Error('OpenRouter returned an empty response.');

        return {
                answer: trimDiscord(answer, 1200),
                model: data?.model || model,
        };
};

export const calculateOpenRouter = async ({ expression }) => {
        const model = config.openrouter.askModel;
        const headers = openRouterHeaders();
        const input = trimDiscord(String(expression || '').trim(), 500);

        const body = createRequestBody({
                model,
                temperature: 0,
                systemPrompt:
                        'You are a careful calculator and unit conversion parser. ' +
                        'Understand numbers written as words, mixed number words/digits, arithmetic, percentages, and common unit conversions. ' +
                        'Return only a concise final answer. Include one tiny step only when it prevents ambiguity. ' +
                        'If the request requires live exchange rates or current prices, say current data is needed.',
                messages: [
                        {
                                role: 'user',
                                content: `Calculate or convert this:\n${input}`,
                        },
                ],
        });

        const data = await requestOpenRouter({ headers, body });
        const message = data?.choices?.[0]?.message;
        const answer = normalizeContent(message?.content).trim();

        if (!answer) throw new Error('OpenRouter returned an empty response.');

        return {
                answer: trimDiscord(answer, 900),
                model: data?.model || model,
        };
};

export const readAloudOpenRouter = async ({ input }) => {
        const text = trimDiscord(String(input || '').trim(), 1800);
        if (!text) throw new Error('No readable text.');

        const audio = await requestOpenRouterSpeech({
                headers: openRouterHeaders(),
                body: {
                        model: config.openrouter.readAloudModel,
                        input: text,
                        voice: config.openrouter.readAloudVoice,
                        response_format: 'mp3',
                },
        });

        if (!audio.length) throw new Error('Empty audio response.');

        return {
                audio,
                model: config.openrouter.readAloudModel,
                voice: config.openrouter.readAloudVoice,
        };
};
