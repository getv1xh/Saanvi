import { config } from '#config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

export const askOpenRouter = async ({ question, useWeb = false }) => {
        const apiKey = config.openrouter.apiKey;
        const model = useWeb
                ? config.openrouter.askWebModel || config.openrouter.askModel
                : config.openrouter.askModel;

        if (!apiKey) {
                throw new Error('OPENROUTER_API_KEY is not configured.');
        }

        const headers = {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
        };

        if (config.openrouter.referer) headers['HTTP-Referer'] = config.openrouter.referer;
        if (config.openrouter.title) headers['X-OpenRouter-Title'] = config.openrouter.title;

        const body = {
                model,
                max_tokens: config.openrouter.maxTokens,
                temperature: 0.6,
                messages: [
                        {
                                role: 'system',
                                content:
                                        'You are Saanvi, a cute but useful Discord utility bot. Answer clearly and briefly. ' +
                                        'If current internet knowledge is required and web search is not enabled, say that web search should be enabled instead of guessing.',
                        },
                        {
                                role: 'user',
                                content: question,
                        },
                ],
        };

        if (useWeb) {
                const webSearch = {
                        type: 'openrouter:web_search',
                        parameters: {
                                max_results: Math.max(1, Math.min(config.openrouter.webMaxResults || 3, 25)),
                                max_uses: 2,
                                max_total_results: Math.max(1, Math.min(config.openrouter.webMaxResults || 3, 25)),
                        },
                };

                if (config.openrouter.webEngine) webSearch.parameters.engine = config.openrouter.webEngine;
                if (config.openrouter.webMode) webSearch.parameters.mode = config.openrouter.webMode;

                body.tools = [webSearch];
                body.max_tool_calls = 2;
                body.messages[0].content += ' When web search is enabled, use it for current facts and cite the sources.';
        }

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
