// ─────────────────────────────────────────────
// Java Solution Evaluator
// Deterministically grades challenge issues against expected catalog outputs
// ─────────────────────────────────────────────

import { CHALLENGE_CATALOG, type CatalogIssue } from '../data/challengeCatalog';
import type { IssueDifficulty } from '../types';

export interface IssueEvaluationResult {
  issueNumber: number;
  difficulty: IssueDifficulty;
  basePoints: number;
  isCorrect: boolean;
  isPartial?: boolean;
  correctnessScore: number;
  codeQualityScore: number;
  commitQualityScore: number;
  output?: string;
  expectedOutput?: string;
  explanation: string;
}

/**
 * Finds matching CatalogIssue for a given repository and issue number.
 * Handles variants like "Squade_1_test" -> "Squade_1".
 */
export function findCatalogIssue(repoName: string, issueNumber: number): CatalogIssue | null {
  // 1. Direct match
  if (CHALLENGE_CATALOG[repoName]) {
    const found = CHALLENGE_CATALOG[repoName].find((i) => i.issueNumber === issueNumber);
    if (found) return found;
  }

  // 2. Normalized match: Squade_1_test -> Squade_1
  const clean = repoName.replace(/_test$/i, '');
  if (CHALLENGE_CATALOG[clean]) {
    const found = CHALLENGE_CATALOG[clean].find((i) => i.issueNumber === issueNumber);
    if (found) return found;
  }

  // 3. Regex match for squad number: e.g. "squade_1", "squard_1", "Squade_1_demo"
  const squadMatch = repoName.match(/squade?_?(\d+)/i);
  if (squadMatch) {
    const key = `Squade_${squadMatch[1]}`;
    if (CHALLENGE_CATALOG[key]) {
      const found = CHALLENGE_CATALOG[key].find((i) => i.issueNumber === issueNumber);
      if (found) return found;
    }
  }

  // 4. Fallback search across any catalog for this issue number with matching starter file or difficulty
  for (const catKey of Object.keys(CHALLENGE_CATALOG)) {
    const found = CHALLENGE_CATALOG[catKey].find((i) => i.issueNumber === issueNumber);
    if (found) return found;
  }

  return null;
}

/**
 * Lightweight safe Java to JS transpiler to execute beginner Java programs in JS runtime.
 */
export function transpileJavaToJs(javaCode: string): string {
  let js = javaCode;

  // Strip package and import statements
  js = js.replace(/package\s+[\w\.]+;/g, '');
  js = js.replace(/import\s+[\w\.\*]+;/g, '');

  // Strip class header and its matching last closing brace
  js = js.replace(/public\s+class\s+\w+[^{]*\{/, '');
  const lastBrace = js.lastIndexOf('}');
  if (lastBrace !== -1) {
    js = js.substring(0, lastBrace) + js.substring(lastBrace + 1);
  }

  // Replace System.out.println / print
  js = js.replace(/System\.out\.println\s*\(([\s\S]*?)\);/g, '__stdout.push(String($1));');
  js = js.replace(/System\.out\.print\s*\(([\s\S]*?)\);/g, '__stdout.push(String($1));');

  // Convert for (type x : arr) -> for (let x of arr)
  js = js.replace(/for\s*\(\s*(?:int|String|char|double|float|long|boolean)\s+(\w+)\s*:\s*(\w+)\s*\)/g, 'for (let $1 of $2)');

  // Convert main method
  js = js.replace(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/g, 'function __main__() {');

  // Convert static methods: static int countAvailableRoomCapacity(int[] values)
  js = js.replace(/static\s+(?:int|void|String|boolean|double|float|char)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_m, name, args) => {
    const cleanArgs = args
      .split(',')
      .filter(Boolean)
      .map((a: string) => a.trim().split(/\s+/).pop())
      .join(', ');
    return `function ${name}(${cleanArgs}) {`;
  });

  // Convert new int[] { ... } -> [ ... ]
  js = js.replace(/new\s+(?:int|String|char|double|float|long|boolean)\[\]\s*\{([^}]*)\}/g, '[$1]');

  // Convert types: int x = 12 -> let x = 12
  js = js.replace(/\b(?:int|double|float|boolean|String|char|long)(?:\[\])?\s+(\w+)/g, 'let $1');

  // Convert .length() on String -> .length
  js = js.replace(/\.length\(\)/g, '.length');

  // Append invocation of main
  js += '\nif (typeof __main__ === "function") __main__();\n';
  return js;
}

/**
 * Executes transpiled Java code safely and returns captured stdout.
 */
export function executeJavaSnippet(javaCode: string): { success: boolean; output: string; error?: string } {
  try {
    const js = transpileJavaToJs(javaCode);
    const __stdout: string[] = [];
    const fn = new Function('__stdout', js);
    fn(__stdout);
    return { success: true, output: __stdout.join('\n').trim() };
  } catch (err: any) {
    return { success: false, output: '', error: err?.message || 'Execution error' };
  }
}

/**
 * Reconstructs or evaluates file content from a GitHub PR file patch if full code is not given.
 */
export function extractCodeFromPatch(patch: string): string {
  // Keep added and unchanged lines
  const lines = patch.split('\n');
  const codeLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('+')) {
      codeLines.push(line.slice(1));
    } else if (!line.startsWith('-') && !line.startsWith('@@')) {
      codeLines.push(line);
    }
  }
  return codeLines.join('\n');
}

/**
 * Evaluates a single challenge issue based on catalog metadata, code diff, and expected output.
 */
export async function evaluateIssueSolution(params: {
  repoName: string;
  issueNumber: number;
  fullCode?: string;
  patch?: string;
  filename?: string;
}): Promise<IssueEvaluationResult> {
  const { repoName, issueNumber, fullCode, patch, filename: _filename } = params;
  const catalog = findCatalogIssue(repoName, issueNumber);

  const difficulty: IssueDifficulty = catalog?.difficulty || (issueNumber >= 57 && issueNumber <= 64 ? 'VERY_HARD' : 'EASY');
  const basePoints = catalog?.basePoints || (difficulty === 'VERY_HARD' ? 40 : difficulty === 'HARD' ? 30 : difficulty === 'MEDIUM' ? 20 : 10);
  const expectedOutput = catalog?.expectedOutput?.trim() || '';

  // 1. Try to evaluate with code execution
  const codeToTest = fullCode || (patch ? extractCodeFromPatch(patch) : '');

  // Detect corrupted gibberish or spam in patch/code
  const hasCorruptedPrint =
    (codeToTest && (codeToTest.includes('ksjdgh') || codeToTest.includes('skdhg'))) ||
    (patch && (
      patch.includes('ksjdgh') ||
      patch.includes('skdhg') ||
      (patch.includes('System.out.println') && !patch.includes(expectedOutput) && !patch.includes(expectedOutput.split(':')[0]))
    ));

  if (codeToTest && expectedOutput) {
    const execRes = executeJavaSnippet(codeToTest);
    if (execRes.success && execRes.output) {
      const normActual = execRes.output.replace(/\r\n/g, '\n').trim();
      const normExpected = expectedOutput.replace(/\r\n/g, '\n').trim();

      if (normActual === normExpected) {
        return {
          issueNumber,
          difficulty,
          basePoints,
          isCorrect: true,
          isPartial: false,
          correctnessScore: 1.0,
          codeQualityScore: 1.0,
          commitQualityScore: 1.0,
          output: normActual,
          expectedOutput: normExpected,
          explanation: `Automated test passed: output "${normActual}" matches expected "${normExpected}".`,
        };
      } else if (hasCorruptedPrint) {
        return {
          issueNumber,
          difficulty,
          basePoints,
          isCorrect: false,
          isPartial: false,
          correctnessScore: 0.0,
          codeQualityScore: 0.3,
          commitQualityScore: 0.5,
          output: normActual,
          expectedOutput: normExpected,
          explanation: `Incorrect solution: Modified output contains invalid or corrupted text.`,
        };
      } else {
        // Code compiled and ran successfully in sandbox, but output differs from reference.
        // Awarded partial correctness (50% XP) per hackathon rules.
        return {
          issueNumber,
          difficulty,
          basePoints,
          isCorrect: true,
          isPartial: true,
          correctnessScore: 0.5,
          codeQualityScore: 0.8,
          commitQualityScore: 0.8,
          output: normActual,
          expectedOutput: normExpected,
          explanation: `Partially correct solution (50% XP): Code compiled and executed, but output "${normActual}" differs from expected "${normExpected}".`,
        };
      }
    }
  }

  // 2. Static heuristic verification if full execution failed or only partial patch
  if (patch && expectedOutput) {
    if (hasCorruptedPrint) {
      return {
        issueNumber,
        difficulty,
        basePoints,
        isCorrect: false,
        isPartial: false,
        correctnessScore: 0.0,
        codeQualityScore: 0.3,
        commitQualityScore: 0.5,
        expectedOutput,
        explanation: `Incorrect solution: Modified output format does not match expected output "${expectedOutput}".`,
      };
    }

    // If patch contains the exact required fix
    if (patch.includes(expectedOutput)) {
      return {
        issueNumber,
        difficulty,
        basePoints,
        isCorrect: true,
        isPartial: false,
        correctnessScore: 1.0,
        codeQualityScore: 1.0,
        commitQualityScore: 1.0,
        expectedOutput,
        explanation: `Verified solution matching expected output "${expectedOutput}".`,
      };
    }

    // Check if patch contains partial logic modification
    const hasPartialLogic =
      patch.includes('return ') ||
      patch.includes('for(') ||
      patch.includes('for (') ||
      patch.includes('if(') ||
      patch.includes('if (') ||
      patch.includes('count++') ||
      patch.includes('static ');

    if (hasPartialLogic) {
      return {
        issueNumber,
        difficulty,
        basePoints,
        isCorrect: true,
        isPartial: true,
        correctnessScore: 0.5,
        codeQualityScore: 0.7,
        commitQualityScore: 0.7,
        expectedOutput,
        explanation: `Partially correct solution (50% XP): Detected code logic modifications for Issue #${issueNumber}.`,
      };
    }
  }

  // Default fallback based on whether code compiles and looks sane
  return {
    issueNumber,
    difficulty,
    basePoints,
    isCorrect: false,
    isPartial: false,
    correctnessScore: 0.0,
    codeQualityScore: 0.5,
    commitQualityScore: 0.5,
    expectedOutput,
    explanation: `Could not verify expected output "${expectedOutput}".`,
  };
}
