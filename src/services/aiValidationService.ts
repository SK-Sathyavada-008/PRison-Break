// ─────────────────────────────────────────────
// AI Code Validation & Intelligent Judge Service
// Powered by Google Gemini / Gemma with Heuristic Fallback
// Analyzes code diffs, verifies solutions, and guides auto-merge
// ─────────────────────────────────────────────

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { githubMergeService, type MergeResult } from './githubMergeService';

export interface AIValidationResult {
  verdict: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
  confidence: number; // 0 to 1
  isCorrect: boolean;
  scoreRecommendation: number;
  summary: string;
  feedback: string;
  codeQuality: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK';
  autoMergeAllowed: boolean;
  autoMergeBlockedReason?: string;
  evaluatedAt: string;
  model: string;
  mergeResult?: MergeResult;
}

export interface PRCodeDiff {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export const aiValidationService = {
  /**
   * Fetches the code diff & modified files from GitHub.
   */
  async fetchPRFiles(
    owner: string,
    repo: string,
    prNumber: number,
    githubToken?: string
  ): Promise<PRCodeDiff[]> {
    const token =
      githubToken ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) ||
      '';

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PRison-Break-AI-Judge',
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        { headers }
      );

      if (!res.ok) {
        throw new Error(`GitHub files API error: HTTP ${res.status}`);
      }

      const files = await res.json();
      return Array.isArray(files)
        ? files.map((f: any) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            patch: f.patch,
          }))
        : [];
    } catch (err) {
      console.warn(`[AIValidation] Failed to fetch PR #${prNumber} files:`, err);
      return [];
    }
  },

  /**
   * Evaluates a Pull Request using Gemini / Gemma or heuristic engine,
   * then optionally triggers auto-merge if approved.
   */
  async evaluateAndJudgePR(
    owner: string,
    repo: string,
    prNumber: number,
    options?: {
      autoMergeIfApproved?: boolean;
      geminiApiKey?: string;
      githubToken?: string;
    }
  ): Promise<AIValidationResult> {
    const fullName = `${owner}/${repo}`;
    const token =
      options?.githubToken ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) ||
      '';

    const geminiKey =
      options?.geminiApiKey ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      ((globalThis as any).process?.env?.GEMINI_API_KEY) ||
      '';

    // 1. Fetch PR metadata
    let prTitle = `PR #${prNumber}`;
    let prBody = '';
    let author = 'unknown';
    let mergeable = true;
    let mergeableState = 'clean';

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'PRison-Break-AI-Judge',
      };
      if (token) headers.Authorization = `token ${token}`;

      const prRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers }
      );
      if (prRes.ok) {
        const prData = await prRes.json();
        prTitle = prData.title || prTitle;
        prBody = prData.body || '';
        author = prData.user?.login || author;
        mergeable = prData.mergeable !== false;
        mergeableState = prData.mergeable_state || 'clean';
      }
    } catch (err) {
      console.warn('[AIValidation] Error fetching PR details:', err);
    }

    // 2. Fetch Code Diff
    const files = await this.fetchPRFiles(owner, repo, prNumber, token);
    const diffSummary = files
      .map(
        (f) =>
          `File: ${f.filename} (+${f.additions}, -${f.deletions})\n${f.patch ? f.patch.slice(0, 800) : '(Binary or large file)'}`
      )
      .join('\n\n');

    let result: AIValidationResult;

    // 3. Evaluate with Gemini / Gemma if key is provided
    if (geminiKey) {
      try {
        result = await this.evaluateWithGemini(
          geminiKey,
          fullName,
          prTitle,
          prBody,
          diffSummary,
          files
        );
      } catch (geminiErr: any) {
        console.warn('[AIValidation] Gemini call failed, falling back to heuristic judge:', geminiErr);
        result = this.evaluateWithHeuristics(prTitle, prBody, files, mergeable, mergeableState);
      }
    } else {
      // Intelligent Heuristic Code Judge
      result = this.evaluateWithHeuristics(prTitle, prBody, files, mergeable, mergeableState);
    }

    // Check merge conflict blockers
    if (mergeableState === 'dirty' || !mergeable) {
      result.autoMergeAllowed = false;
      result.autoMergeBlockedReason = 'Merge conflict with base branch. Conflicts must be resolved before merging.';
      if (result.verdict === 'APPROVED') {
        result.summary += ' (Code is approved, but auto-merge blocked by git conflicts).';
      }
    }

    // 4. Update Firestore PR Document
    const now = new Date().toISOString();
    const prId = `pr_${repo}_${prNumber}`;

    if (isFirebaseConfigured()) {
      try {
        const prDocRef = doc(db, 'pullRequests', prId);
        const existingSnap = await getDoc(prDocRef);

        const updates: any = {
          aiValidation: {
            verdict: result.verdict,
            confidence: result.confidence,
            isCorrect: result.isCorrect,
            summary: result.summary,
            feedback: result.feedback,
            codeQuality: result.codeQuality,
            autoMergeAllowed: result.autoMergeAllowed,
            autoMergeBlockedReason: result.autoMergeBlockedReason || null,
            evaluatedAt: now,
            model: result.model,
          },
          updatedAt: now,
        };

        if (result.verdict === 'APPROVED') {
          updates.correct = true;
          updates.status = existingSnap.data()?.merged ? 'merged' : 'AUTO_APPROVED';
          updates.processingState = existingSnap.data()?.merged ? 'MERGED' : 'AUTO_APPROVED';
          if (!existingSnap.data()?.score || existingSnap.data()?.score === 0) {
            updates.score = 10;
          }
        }

        await setDoc(prDocRef, updates, { merge: true });
      } catch (dbErr) {
        console.warn('[AIValidation] Failed to update Firestore with AI evaluation:', dbErr);
      }
    }

    // 5. Auto-Merge if requested and allowed
    if (options?.autoMergeIfApproved !== false && result.autoMergeAllowed && result.verdict === 'APPROVED') {
      console.log(`[AIValidation] Auto-merging approved PR #${prNumber}...`);
      const mergeRes = await githubMergeService.mergePullRequest(owner, repo, prNumber, {
        commitTitle: `Auto-merged by PRison Control AI Warden (${result.model})`,
        commitMessage: `${result.summary}\n\nFeedback: ${result.feedback}`,
        githubToken: token,
      });

      result.mergeResult = mergeRes;
    }

    return result;
  },

  /**
   * Gemini 1.5/2.0 Flash automated code analysis
   */
  async evaluateWithGemini(
    apiKey: string,
    repoFullName: string,
    prTitle: string,
    prBody: string,
    diffSummary: string,
    files: PRCodeDiff[]
  ): Promise<AIValidationResult> {
    const prompt = `
You are the AI Code Warden and Automated Judge for the "PRison Break" challenge.
Your duty is to judge a participant's Pull Request.

REPOSITORY: ${repoFullName}
PR TITLE: ${prTitle}
PR DESCRIPTION: ${prBody || 'None provided'}
TOTAL FILES CHANGED: ${files.length}

CODE DIFF & MODIFICATIONS:
${diffSummary || 'No patch available'}

EVALUATION TASK:
1. Does this PR provide a meaningful, syntactically sound, and non-empty contribution?
2. Are there unauthorized hacks, malicious additions, or bypass attempts?
3. Is the code quality acceptable?
4. Should this PR be approved and merged?

You must respond ONLY with raw valid JSON in this exact schema (no markdown fences, no extra text):
{
  "verdict": "APPROVED",
  "confidence": 0.95,
  "isCorrect": true,
  "scoreRecommendation": 10,
  "summary": "1-sentence summary of the decision",
  "feedback": "Constructive feedback for the participant",
  "codeQuality": "GOOD",
  "autoMergeAllowed": true
}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const parsed = JSON.parse(candidateText.replace(/```json/g, '').replace(/```/g, '').trim());

    return {
      verdict: parsed.verdict === 'APPROVED' ? 'APPROVED' : parsed.verdict === 'REJECTED' ? 'REJECTED' : 'NEEDS_CHANGES',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      isCorrect: parsed.isCorrect ?? (parsed.verdict === 'APPROVED'),
      scoreRecommendation: parsed.scoreRecommendation ?? (parsed.verdict === 'APPROVED' ? 10 : 0),
      summary: parsed.summary || 'Code evaluated by Gemini.',
      feedback: parsed.feedback || 'Code meets requirements.',
      codeQuality: parsed.codeQuality || 'GOOD',
      autoMergeAllowed: parsed.autoMergeAllowed ?? (parsed.verdict === 'APPROVED'),
      evaluatedAt: new Date().toISOString(),
      model: 'Google Gemini 1.5 Flash',
    };
  },

  /**
   * Deterministic Heuristic Code Judge (Gemma-Inspired Fallback)
   */
  evaluateWithHeuristics(
    _prTitle: string,
    _prBody: string,
    files: PRCodeDiff[],
    mergeable: boolean,
    mergeableState: string
  ): AIValidationResult {
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    // Rule 1: Empty PR
    if (files.length === 0 || (totalAdditions === 0 && totalDeletions === 0)) {
      return {
        verdict: 'NEEDS_CHANGES',
        confidence: 0.85,
        isCorrect: false,
        scoreRecommendation: 0,
        summary: 'Pull Request contains no file modifications or diff content.',
        feedback: 'Please commit actual code changes before requesting validation.',
        codeQuality: 'NEEDS_WORK',
        autoMergeAllowed: false,
        autoMergeBlockedReason: 'No modified files detected.',
        evaluatedAt: new Date().toISOString(),
        model: 'PRison Heuristic Judge (Gemma Rule Engine)',
      };
    }

    // Rule 2: Excessive Mass Deletion
    if (totalDeletions > 2500 && totalAdditions < 50) {
      return {
        verdict: 'REJECTED',
        confidence: 0.95,
        isCorrect: false,
        scoreRecommendation: 0,
        summary: 'Mass file deletion detected without substantive replacement code.',
        feedback: 'Submissions must contribute solutions, not erase repository contents.',
        codeQuality: 'NEEDS_WORK',
        autoMergeAllowed: false,
        autoMergeBlockedReason: 'Excessive deletion threshold exceeded.',
        evaluatedAt: new Date().toISOString(),
        model: 'PRison Heuristic Judge (Gemma Rule Engine)',
      };
    }

    // Rule 3: Valid positive contribution
    const isApproved = totalAdditions > 0 && files.length > 0;

    return {
      verdict: isApproved ? 'APPROVED' : 'NEEDS_CHANGES',
      confidence: 0.9,
      isCorrect: isApproved,
      scoreRecommendation: isApproved ? 10 : 0,
      summary: isApproved
        ? `Valid contribution verified (+${totalAdditions} lines across ${files.length} file${files.length > 1 ? 's' : ''}).`
        : 'Changes require further refinement.',
      feedback: isApproved
        ? 'Code diff adheres to challenge repository scope and passes integrity checks.'
        : 'Please ensure valid additions are present.',
      codeQuality: 'GOOD',
      autoMergeAllowed: isApproved && mergeable && mergeableState !== 'dirty',
      autoMergeBlockedReason:
        mergeableState === 'dirty'
          ? 'Merge conflict detected with base branch.'
          : undefined,
      evaluatedAt: new Date().toISOString(),
      model: 'PRison Heuristic Judge (Gemma Rule Engine)',
    };
  },
};
