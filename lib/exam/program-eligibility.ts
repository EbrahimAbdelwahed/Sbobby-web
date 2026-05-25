export const PROGRAM_ELIGIBILITY_POLICY_VERSION = "program-eligibility-v1";

export interface ProgramEligibilityTopicLike {
  id?: string | null;
  title?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  sourcePath?: string | null;
  path?: string[] | null;
  sourceTitle?: string | null;
}

export interface ProgramEligibilityQuestionInput {
  questionType?: string | null;
  questionText?: string | null;
  rawText?: string | null;
  options?: Array<unknown> | null;
  topics?: ProgramEligibilityTopicLike[] | null;
  sourceRefs?: Array<{ path?: string | null; section?: string | null }> | null;
  sourceChunks?: ProgramEligibilityTopicLike[] | null;
}

export interface ProgramEligibilityDecision {
  eligible: boolean;
  reasonCode: string;
  reasonLabel: string;
  matchedRule: string;
  policyVersion: string;
}

function decision(
  eligible: boolean,
  reasonCode: string,
  reasonLabel: string,
  matchedRule: string,
): ProgramEligibilityDecision {
  return {
    eligible,
    reasonCode,
    reasonLabel,
    matchedRule,
    policyVersion: PROGRAM_ELIGIBILITY_POLICY_VERSION,
  };
}

export function normalizeProgramEligibilityText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(parts: unknown[]) {
  return normalizeProgramEligibilityText(parts.flat().filter(Boolean).join(" "));
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function stemWithoutEmbeddedOptions(value: unknown): string {
  const text = String(value ?? "").replace(/\r\n/g, "\n");
  const matches = [...text.matchAll(/(?:^|\n|\s)([A-Fa-f])[\).:-]\s+/g)];
  if (matches.length < 2) return text;
  const labels = matches.map((match) => match[1].toUpperCase()).join("");
  if (!"ABCDEF".startsWith(labels)) return text;
  const firstIndex = matches[0]?.index ?? -1;
  return firstIndex > 0 ? text.slice(0, firstIndex) : text;
}

const ANATOMIA_2_PATTERNS = [
  /\banatomia 2\b/,
  /\banato 2\b/,
  /\banatomia_2_cusella\b/,
  /\banato 2 cusella\b/,
];

const REPRODUCTIVE_PATTERNS = [
  /\bapparato genitale\b/,
  /\bapparato riproduttivo\b/,
  /\bsistema riproduttivo\b/,
  /\bgenitale\b/,
  /\bgenitali\b/,
  /\breproductive\b/,
  /\butero\b/,
  /\buterin[aoei]\b/,
  /\buterus\b/,
  /\bovaio\b/,
  /\bovaie\b/,
  /\bovary\b/,
  /\bovarian\b/,
  /\btube uterine\b/,
  /\bcervice\b/,
  /\btesticolo\b/,
  /\btesticoli\b/,
  /\btestis\b/,
  /\bprostata\b/,
  /\bprostate\b/,
  /\bpene\b/,
  /\bvagina\b/,
];

const ABDOMINO_PELVIC_PATTERNS = [
  /\bcavita addomino pelvica\b/,
  /\bcavita addominopelvica\b/,
  /\baddomino pelvica\b/,
  /\baddominopelvica\b/,
  /\baddome\b/,
  /\bpelvi\b/,
  /\bperitoneo\b/,
  /\bmesentere\b/,
  /\bomento\b/,
  /\bretroperitoneo\b/,
  /\bstomaco\b/,
  /\bintestino\b/,
  /\bcolon\b/,
  /\bduodeno\b/,
  /\bdigiuno\b/,
  /\bileo\b/,
  /\bretto\b/,
  /\bfegato\b/,
  /\bvie biliari\b/,
  /\bcoledoco\b/,
  /\bcolecisti\b/,
  /\brene\b/,
  /\buretere\b/,
  /\bvescica\b/,
  /\binguinale\b/,
];

const ABDOMINAL_EXCEPTION_PATTERNS = [
  /\bsurrene\b/,
  /\bsurreni\b/,
  /\badrenal\b/,
  /\bpancreas\b/,
  /\bmilza\b/,
  /\bspleen\b/,
];

export function isTopicEligibleForProgram(topic: ProgramEligibilityTopicLike): ProgramEligibilityDecision {
  const text = haystack([
    topic.id,
    topic.title,
    topic.moduleId,
    topic.moduleTitle,
    topic.sourcePath,
    topic.sourceTitle,
    topic.path ?? [],
  ]);

  if (matchesAny(text, ANATOMIA_2_PATTERNS)) {
    return decision(false, "excluded_anatomia_2", "Anatomia 2 is outside the current program", "anatomia_2");
  }

  const reproductive = matchesAny(text, REPRODUCTIVE_PATTERNS);
  const abdominal = matchesAny(text, ABDOMINO_PELVIC_PATTERNS);
  const exception = matchesAny(text, ABDOMINAL_EXCEPTION_PATTERNS);

  if ((reproductive || abdominal) && exception) {
    return decision(true, "eligible_exception_topic", "Current-program exception topic", "abdominal_exception");
  }
  if (reproductive) {
    return decision(false, "excluded_reproductive", "Reproductive-system topic is outside the current program", "reproductive");
  }
  if (abdominal) {
    return decision(false, "excluded_abdomino_pelvic", "Abdomino-pelvic topic is outside the current program", "abdomino_pelvic");
  }

  return decision(true, "eligible_topic", "Topic is in the current program", "default_topic");
}

export function isQuestionEligibleForProgram(input: ProgramEligibilityQuestionInput): ProgramEligibilityDecision {
  if (input.questionType === "open" || (input.options?.length ?? 0) === 0) {
    return decision(false, "excluded_open_answer", "Open-answer cards are not public in Tutti", "open_answer");
  }

  const sourceText = haystack([
    input.sourceRefs?.flatMap((ref) => [ref.path, ref.section]) ?? [],
    input.sourceChunks?.flatMap((chunk) => [chunk.id, chunk.title, chunk.moduleTitle, chunk.sourcePath, chunk.sourceTitle]) ?? [],
  ]);
  if (matchesAny(sourceText, ANATOMIA_2_PATTERNS)) {
    return decision(false, "excluded_anatomia_2", "Anatomia 2 is outside the current program", "anatomia_2_source");
  }

  const questionText = haystack([
    stemWithoutEmbeddedOptions(input.questionText),
    stemWithoutEmbeddedOptions(input.rawText),
  ]);
  const reproductiveText = matchesAny(questionText, REPRODUCTIVE_PATTERNS);
  const abdominalText = matchesAny(questionText, ABDOMINO_PELVIC_PATTERNS);
  const exceptionText = matchesAny(questionText, ABDOMINAL_EXCEPTION_PATTERNS);
  if (reproductiveText) {
    return decision(false, "excluded_reproductive", "Reproductive-system card is outside the current program", "reproductive_question_text");
  }
  if (abdominalText && !exceptionText) {
    return decision(false, "excluded_abdomino_pelvic", "Abdomino-pelvic card is outside the current program", "abdomino_pelvic_question_text");
  }

  const topics = input.topics ?? [];
  if (topics.length === 0) {
    return decision(false, "unclassified_no_topic", "Question has no topic classification", "missing_topic");
  }

  const decisions = topics.map(isTopicEligibleForProgram);
  const hardExclusion = decisions.find((item) => item.reasonCode === "excluded_anatomia_2");
  if (hardExclusion) return hardExclusion;

  const eligibleCount = decisions.filter((item) => item.eligible).length;
  if (eligibleCount > 0 && eligibleCount < decisions.length) {
    return decision(true, "mixed_topics_has_eligible_topic", "Question has at least one current-program topic", "mixed_topics");
  }
  if (eligibleCount > 0) {
    return decision(true, "eligible_topic", "Question is in the current program", "eligible_topics");
  }

  return decisions[0] ?? decision(false, "unclassified_no_topic", "Question has no topic classification", "missing_topic");
}

export function programEligibilitySql(alias = "q") {
  return [`${alias}.program_eligible = true`];
}
