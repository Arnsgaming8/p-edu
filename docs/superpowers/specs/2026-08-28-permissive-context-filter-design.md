# Permissive Context Aware Message Filtering

## Goal
Reduce false positives from the local bad-word filter while continuing to block clearly harmful content.

## Behavior
1. Run the existing local filter on each incoming AI user message.
2. If the local filter does not flag the message, continue normally without an extra model call.
3. If it flags a message, send only that message and the matched term to a separate OpenRouter moderation request.
4. Ask the moderation model for strict JSON with `allow` and `reason` fields.
5. Allow messages when context clearly shows an innocent meaning, such as food, programming, music, or ordinary conversation.
6. Block only when the context strongly indicates sexual, hateful, abusive, violent, self harm, or illegal intent.
7. If moderation fails, returns malformed JSON, or times out, block the flagged message with a generic retry message.
8. Never include the user’s normal AI conversation history in the moderation request.
9. Keep the normal AI model fixed at `openrouter/free`; moderation uses a configurable model with a conservative default.
10. Do not expose moderation prompts, provider errors, or secret keys to the browser.

## Error handling and privacy
Moderation failures fail closed. Moderation requests use the existing server side OpenRouter credentials and inherit the existing request timeout and retry limits. The server should avoid logging message contents or moderation responses.

## Verification
- Python compilation passes.
- Clean messages do not invoke moderation.
- A flagged innocent-context example is allowed when the moderation response says allow.
- A flagged harmful-context example is blocked.
- Malformed or unavailable moderation responses are blocked.
- The normal AI endpoint remains restricted to `openrouter/free`.
