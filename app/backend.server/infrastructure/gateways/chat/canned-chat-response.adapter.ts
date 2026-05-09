import type {
  ChatResponseGateway,
  CitationDraft,
  GenerateReplyInput,
  GenerateReplyResult,
} from "@backend-application/chat/chat-response.gateway";
import type { ArtifactDto } from "@backend-application/library/library.dto";
import type { MessageBody } from "@backend-domain/chat/chat-message";

type ResponseKind = "summary" | "compare" | "definition" | "default" | "empty-library";

interface CannedTemplate {
  bodyTemplate: string;
  citationCount: number;
}

const TEMPLATES: Record<ResponseKind, CannedTemplate> = {
  summary: {
    bodyTemplate:
      "Here's a summary based on **{firstTitle}**:\n\n" +
      "- It opens with the central thesis and frames the problem space.\n" +
      "- The middle sections build the supporting argument with concrete examples.\n" +
      "- It closes by connecting the conclusion back to the broader research question.\n\n" +
      "Let me know which section you'd like to dive deeper on.",
    citationCount: 2,
  },
  compare: {
    bodyTemplate:
      "Comparing the documents in your library:\n\n" +
      "- **{firstTitle}** emphasises the conceptual framing and the why.\n" +
      "- **{secondTitle}** focuses on the concrete how — methods and examples.\n\n" +
      "They overlap most clearly on the underlying motivations and diverge on implementation detail.",
    citationCount: 2,
  },
  definition: {
    bodyTemplate:
      "Based on **{firstTitle}**, the term is defined as a structured way of describing the underlying concept and its boundaries. The document also lists three closely related ideas you may want to read alongside the definition.",
    citationCount: 1,
  },
  default: {
    bodyTemplate:
      "Good question. Looking at **{firstTitle}**, the relevant passage suggests a measured answer: it depends on which assumptions you carry into the question. I can pull out specific evidence from any document on the right — just let me know which.",
    citationCount: 1,
  },
  "empty-library": {
    bodyTemplate:
      "Your library is empty, so there are no source documents for me to ground a reply in. Head over to the **Library** page to upload a PDF, then come back here to chat with it.",
    citationCount: 0,
  },
};

/**
 * Picks a response kind from a (lower-cased) prompt. Order matters: more
 * specific patterns should come first.
 */
function classifyPrompt(prompt: string): ResponseKind {
  const p = prompt.toLowerCase();
  if (/summar/.test(p)) return "summary";
  if (/compar|differ|versus|vs\b/.test(p)) return "compare";
  if (/define|definition|what is|what does/.test(p)) return "definition";
  return "default";
}

/**
 * Deterministically picks N artifacts from `candidates`, rotating with
 * `seed` so re-renders are stable but successive turns vary.
 */
function pickArtifacts(candidates: ArtifactDto[], n: number, seed: number): ArtifactDto[] {
  if (candidates.length === 0 || n <= 0) return [];
  const limit = Math.min(n, candidates.length);
  const out: ArtifactDto[] = [];
  for (let i = 0; i < limit; i += 1) {
    out.push(candidates[(seed + i) % candidates.length]!);
  }
  return out;
}

export class CannedChatResponseAdapter implements ChatResponseGateway {
  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    const kind = input.candidateArtifacts.length === 0 ? "empty-library" : classifyPrompt(input.userPrompt);
    const template = TEMPLATES[kind];

    const seed = input.transcript.length;
    const picked = pickArtifacts(input.candidateArtifacts, template.citationCount, seed);

    const firstTitle = picked[0]?.title ?? "your document";
    const secondTitle = picked[1]?.title ?? firstTitle;

    const text = template.bodyTemplate
      .replace("{firstTitle}", firstTitle)
      .replace("{secondTitle}", secondTitle);

    const body: MessageBody = { format: "markdown", text };

    const citations: CitationDraft[] = picked.map((artifact) => ({
      artifactId: artifact.id,
      pageNumber: 1,
      excerpt: `Excerpt from page 1 of ${artifact.title}`,
    }));

    return { body, citations };
  }
}
