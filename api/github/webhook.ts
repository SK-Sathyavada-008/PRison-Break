// ─────────────────────────────────────────────
// Vercel Serverless Function — GitHub App Webhook Endpoint
// Route: POST /api/github/webhook
// ─────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

const WEBHOOK_SECRET =
  process.env.GITHUB_WEBHOOK_SECRET ||
  process.env.WEBHOOK_SECRET ||
  '';

// Singleton Firestore instance for serverless container reuse
function getFirestoreInstance(): Firestore | null {
  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'prison-control';
  const apiKey =
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY;

  if (!apiKey || !projectId) {
    return null;
  }

  let app: FirebaseApp;
  if (!getApps().length) {
    app = initializeApp({
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    });
  } else {
    app = getApps()[0];
  }

  return getFirestore(app);
}

/**
 * Verifies GitHub's HMAC-SHA256 signature against the raw payload
 */
function verifySignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!secret) {
    console.warn('[Webhook] No GITHUB_WEBHOOK_SECRET configured on server.');
    return true;
  }
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Normalizes event data according to the event type
 */
function normalizeEventData(eventType: string, payload: any, deliveryId: string) {
  const action = payload?.action || 'unknown';
  const repo = payload?.repository;

  switch (eventType) {
    case 'pull_request': {
      const pr = payload?.pull_request;
      return {
        deliveryId,
        action,
        repositoryOwner: repo?.owner?.login || repo?.owner?.name || 'unknown',
        repositoryName: repo?.name || 'unknown',
        repositoryFullName: repo?.full_name || 'unknown',
        prNumber: pr?.number,
        prTitle: pr?.title || '',
        prUrl: pr?.html_url || '',
        authorUsername: pr?.user?.login || 'unknown',
        authorId: pr?.user?.id || null,
        sourceBranch: pr?.head?.ref || '',
        targetBranch: pr?.base?.ref || '',
        createdTimestamp: pr?.created_at || new Date().toISOString(),
        updatedTimestamp: pr?.updated_at || new Date().toISOString(),
      };
    }

    case 'pull_request_review': {
      return {
        deliveryId,
        action,
        prNumber: payload?.pull_request?.number,
        reviewer: payload?.review?.user?.login || 'unknown',
        reviewState: payload?.review?.state || 'unknown',
        repository: repo?.full_name || repo?.name || 'unknown',
      };
    }

    case 'issues': {
      const issue = payload?.issue;
      return {
        deliveryId,
        action,
        issueNumber: issue?.number,
        issueTitle: issue?.title || '',
        issueAuthor: issue?.user?.login || 'unknown',
        labels: (issue?.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)),
        repository: repo?.full_name || repo?.name || 'unknown',
      };
    }

    case 'check_run': {
      const checkRun = payload?.check_run;
      const associatedPr = checkRun?.pull_requests?.[0]?.number || null;
      return {
        deliveryId,
        action,
        checkName: checkRun?.name || 'unknown',
        conclusion: checkRun?.conclusion || 'pending',
        status: checkRun?.status || 'unknown',
        associatedPr,
        repository: repo?.full_name || repo?.name || 'unknown',
      };
    }

    case 'check_suite': {
      const suite = payload?.check_suite;
      const associatedPr = suite?.pull_requests?.[0]?.number || null;
      return {
        deliveryId,
        action,
        checkName: 'check_suite',
        conclusion: suite?.conclusion || 'pending',
        status: suite?.status || 'unknown',
        associatedPr,
        repository: repo?.full_name || repo?.name || 'unknown',
      };
    }

    default: {
      return {
        deliveryId,
        action,
        repository: repo?.full_name || repo?.name || 'unknown',
        summary: `Generic ${eventType} event`,
      };
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Health check & diagnostic query
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'PRison Control GitHub App Webhook',
      endpoint: '/api/github/webhook',
      supportedEvents: [
        'pull_request',
        'pull_request_review',
        'issues',
        'check_run',
        'check_suite',
      ],
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const receivedAt = new Date().toISOString();

  // 2. Read Delivery ID
  const deliveryId = (req.headers['x-github-delivery'] as string) || `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const eventType = (req.headers['x-github-event'] as string) || 'unknown';

  // 3. Signature verification
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.warn(`[Webhook] Signature verification failed for delivery: ${deliveryId}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid GitHub signature' });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const action = payload?.action || 'received';
  const repo = payload?.repository;
  const repoFullName = repo?.full_name || '';
  const repoName = repo?.name || '';

  // 4. Handle Ping event from GitHub
  if (eventType === 'ping') {
    return res.status(200).json({
      ok: true,
      message: 'Ping event received successfully by PRison Control.',
      hookId: payload?.hook_id,
      deliveryId,
    });
  }

  const db = getFirestoreInstance();

  // 5. Idempotency Check: Never process the same delivery twice
  if (db) {
    try {
      const existingDoc = await getDoc(doc(db, 'webhookEvents', deliveryId));
      if (existingDoc.exists()) {
        console.log(`[Webhook] Delivery ID ${deliveryId} already recorded. Ignoring duplicate.`);
        return res.status(200).json({
          ok: true,
          status: 'IGNORED',
          reason: 'Duplicate delivery ID',
          deliveryId,
        });
      }
    } catch (err) {
      console.warn('[Webhook] Error checking idempotency:', err);
    }
  }

  // 6. Check whether repository exists in PRison Control and is active
  let repoExists = false;
  let isRepoActive = false;
  let matchedRepoId = repoName;

  if (db && (repoFullName || repoName)) {
    try {
      const reposRef = collection(db, 'repositories');
      const allReposSnap = await getDocs(reposRef);

      const matchedDoc = allReposSnap.docs.find((d) => {
        const data = d.data();
        const storedFullName = (data.fullName || `${data.owner}/${data.name}`).toLowerCase();
        const storedName = (data.name || '').toLowerCase();
        return (
          storedFullName === repoFullName.toLowerCase() ||
          storedName === repoName.toLowerCase()
        );
      });

      if (matchedDoc) {
        repoExists = true;
        matchedRepoId = matchedDoc.id;
        const repoData = matchedDoc.data();
        isRepoActive = repoData.active !== false;
      }
    } catch (err) {
      console.error('[Webhook] Error querying repositories collection:', err);
    }
  }

  // 7. Normalize event data
  const normalizedData = normalizeEventData(eventType, payload, deliveryId);

  // 8. Determine Processing Status
  let processingStatus: 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED' = 'PROCESSED';
  let errorMsg: string | null = null;

  if (!repoExists) {
    processingStatus = 'IGNORED';
    errorMsg = `Repository "${repoFullName || repoName}" is not registered in PRison Control`;
    console.log(`[Webhook] Ignored delivery ${deliveryId}: ${errorMsg}`);
  } else if (!isRepoActive) {
    processingStatus = 'IGNORED';
    errorMsg = `Repository "${repoFullName || repoName}" is inactive in PRison Control`;
    console.log(`[Webhook] Ignored delivery ${deliveryId}: ${errorMsg}`);
  }

  // 9. Store normalized webhook event in Firestore: webhookEvents/{deliveryId}
  if (db) {
    try {
      const eventDocData = {
        deliveryId,
        eventType,
        action,
        repositoryId: matchedRepoId,
        repositoryFullName: repoFullName || repoName,
        receivedAt,
        processingStatus,
        processedAt: new Date().toISOString(),
        error: errorMsg,
        normalizedData,
        rawPayload: payload,
      };

      await setDoc(doc(db, 'webhookEvents', deliveryId), eventDocData);
      console.log(`[Webhook] Stored delivery ${deliveryId} in webhookEvents. Status: ${processingStatus}`);
    } catch (dbErr: any) {
      console.error('[Webhook] Failed to save webhook event to Firestore:', dbErr);
      processingStatus = 'FAILED';
      errorMsg = dbErr?.message || 'Firestore write error';
    }
  }

  // 10. Phase 7: Deterministic PR Processing & Scoring Engine Integration
  if (db && processingStatus === 'PROCESSED' && eventType === 'pull_request') {
    try {
      const pr = payload?.pull_request;
      if (pr) {
        const prNumber = pr.number;
        const author = pr.user?.login || 'unknown';
        let isMerged = pr.merged === true;
        const prId = `pr_${matchedRepoId}_${prNumber}`;
        const now = new Date().toISOString();

        // 1. Identify all linked challenge issues (Student PR may contain solutions to multiple assigned issues)
        const fullPRText = `${pr.title || ''} ${pr.body || ''}`;
        const foundIssues = new Set<number>();
        const keywordBlockRegex = /(?:fixes|closed|closes|fixed|resolves|resolved|challenge|issue|task)\s*([#\d\s,;&and]+)/gi;
        let blockMatch: RegExpExecArray | null;
        while ((blockMatch = keywordBlockRegex.exec(fullPRText)) !== null) {
          const numbersInBlock = blockMatch[1].match(/\d+/g);
          if (numbersInBlock) {
            numbersInBlock.forEach((numStr) => {
              const n = parseInt(numStr, 10);
              if (n > 0) foundIssues.add(n);
            });
          }
        }
        const urlRegex = /\/issues\/(\d+)/gi;
        let urlMatch: RegExpExecArray | null;
        while ((urlMatch = urlRegex.exec(fullPRText)) !== null) {
          const n = parseInt(urlMatch[1], 10);
          if (n > 0) foundIssues.add(n);
        }
        const hashRegex = /#(\d+)/g;
        let hashMatch: RegExpExecArray | null;
        while ((hashMatch = hashRegex.exec(fullPRText)) !== null) {
          const n = parseInt(hashMatch[1], 10);
          if (n > 0) foundIssues.add(n);
        }

        const issueNumbers = Array.from(foundIssues).sort((a, b) => a - b);
        const issueNumber = issueNumbers.length > 0 ? issueNumbers[0] : 0;

        // 2. Collect PR labels & issue labels
        const prLabels: string[] = (pr.labels || []).map((l: any) => l.name);

        // 3. Verify participant in PRison Control
        const pSnap = await getDocs(query(collection(db, 'participants'), where('githubUsername', '==', author)));
        const participantRegistered = !pSnap.empty;
        const participantData = !pSnap.empty ? pSnap.docs[0].data() : null;
        const participantActive = participantRegistered && participantData?.active !== false;

        // Check for 1 final PR per student constraint
        const priorPRQuery = query(
          collection(db, 'pullRequests'),
          where('repositoryId', '==', matchedRepoId),
          where('githubUsername', '==', author)
        );
        const priorPRSnap = await getDocs(priorPRQuery);
        const existingPRsFromAuthor = priorPRSnap.docs.filter((d) => d.id !== prId);
        const isMultiplePRViolation = existingPRsFromAuthor.length > 0;

        // 4. Validate changed files & security boundaries
        const additions = pr.additions || 0;
        const deletions = pr.deletions || 0;
        let filesValid = true;
        let fileValidationReason = 'Changed files adhere to challenge repository scope.';

        if (additions > 5000) {
          filesValid = false;
          fileValidationReason = `Excessive additions (+${additions} lines). Requires manual review.`;
        } else if (deletions > 3000) {
          filesValid = false;
          fileValidationReason = `Mass deletion detected (-${deletions} lines). Requires manual review.`;
        }

        // 5. Test suite / GitHub check run evaluation
        const testsPassed = pr.mergeable_state !== 'dirty' && pr.draft === false && pr.mergeable !== false;

        // 6. Blocking labels check
        const hasBlockingLabel = prLabels.some((l) => {
          const lower = l.toLowerCase();
          return lower.includes('wip') || lower.includes('do-not-merge') || lower.includes('invalid');
        });

        // 7. Synthesize deterministic validation checks
        const validationChecks = {
          participantRegistered: participantRegistered && participantActive,
          repositoryRegistered: repoExists && isRepoActive,
          issueValid: issueNumbers.length > 0,
          testsPassed,
          filesValid: filesValid && !hasBlockingLabel,
        };

        // 8. Generate explainable validation reasons
        const validationReasons: string[] = [];
        if (validationChecks.participantRegistered) {
          validationReasons.push(`Participant @${author} is verified and active in PRison Control.`);
        } else {
          validationReasons.push(`Participant @${author} is not registered or active.`);
        }

        if (validationChecks.repositoryRegistered) {
          validationReasons.push(`Repository "${repoFullName}" is verified and active.`);
        } else {
          validationReasons.push(`Repository "${repoFullName}" is inactive or unregistered.`);
        }

        if (issueNumbers.length > 0) {
          validationReasons.push(`Solved challenge issue(s) confirmed: [${issueNumbers.map((n) => `#${n}`).join(', ')}].`);
        } else {
          validationReasons.push('No valid challenge issue referenced in title or body.');
        }

        if (isMultiplePRViolation) {
          validationReasons.push(`Note: Student @${author} previously submitted another PR in this repository.`);
        }

        if (validationChecks.testsPassed) {
          validationReasons.push('Automated tests and branch mergeability clean.');
        } else {
          validationReasons.push(`Automated checks pending or mergeable state dirty (${pr.mergeable_state || 'unknown'}).`);
        }

        validationReasons.push(fileValidationReason);

        const allChecksPass =
          validationChecks.participantRegistered &&
          validationChecks.repositoryRegistered &&
          validationChecks.issueValid &&
          validationChecks.testsPassed &&
          validationChecks.filesValid;

        // 9. Determine PR Processing State (Enforce One PR Per Student Rule)
        let prStatus: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED' = 'PENDING_REVIEW';
        if (isMerged) {
          prStatus = 'MERGED';
        } else if (isMultiplePRViolation || pr.draft === true) {
          // One-PR rule violation or draft PR -> Flagged for review; 0 points awarded
          prStatus = 'PENDING_REVIEW';
        } else if (allChecksPass) {
          prStatus = 'AUTO_APPROVED';
        } else if (!validationChecks.participantRegistered || !validationChecks.repositoryRegistered) {
          prStatus = 'REJECTED';
        } else {
          prStatus = 'PENDING_REVIEW';
        }

        // 11. Resolve Team for repository (e.g. squard_1 -> Squad 1)
        const teamSlug = matchedRepoId.toLowerCase().replace(/^repo_/, '');
        const teamId = `team_${teamSlug}`;
        const teamDocRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamDocRef);
        let teamData: any = teamSnap.exists() ? teamSnap.data() : null;

        if (!teamData) {
          // Check if any team has repositoryId == matchedRepoId
          const allTeamsSnap = await getDocs(collection(db, 'teams'));
          const foundTeamDoc = allTeamsSnap.docs.find((d) => {
            const td = d.data();
            return td.repositoryId === matchedRepoId || td.repositoryName?.toLowerCase() === teamSlug;
          });
          if (foundTeamDoc) {
            teamData = foundTeamDoc.data();
          }
        }

        // Auto-create Squad if not present
        if (!teamData) {
          const squadMatch = teamSlug.match(/(\d+)/);
          const squadNumber = squadMatch ? squadMatch[1] : '1';
          teamData = {
            id: teamId,
            name: `Squad ${squadNumber}`,
            repositoryId: matchedRepoId,
            repositoryName: teamSlug,
            repositoryFullName: repoFullName,
            members: [
              {
                studentId: `s_${author.toLowerCase()}`,
                name: author,
                githubUsername: author,
                assignedIssues: issueNumbers,
                prSubmitted: true,
                prNumber,
              },
            ],
            totalScore: 0,
            solvedIssues: [],
            validatedIssueCount: 0,
            prsSubmitted: 1,
            active: true,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(teamDocRef, teamData);
        }

        // Upsert PR document
        const prDocRef = doc(db, 'pullRequests', prId);
        await setDoc(
          prDocRef,
          {
            id: prId,
            repositoryId: matchedRepoId,
            repositoryFullName: repoFullName,
            teamId,
            prNumber,
            githubUsername: author,
            issueNumber,
            issueNumbers,
            hasMultiplePRViolation: isMultiplePRViolation,
            duplicateSubmissionWarning: isMultiplePRViolation,
            attributionWarnings: isMultiplePRViolation ? ['DUPLICATE_PR_VIOLATION: Student already submitted another competition PR.'] : [],
            title: pr.title || `PR #${prNumber}`,
            status: prStatus,
            processingState: prStatus,
            baseBranch: pr.base?.ref || 'main',
            headBranch: pr.head?.ref || '',
            baseCommitSha: pr.base?.sha || '',
            headCommitSha: pr.head?.sha || '',
            isDraft: pr.draft === true,
            testsPassed: validationChecks.testsPassed,
            correct: prStatus === 'AUTO_APPROVED' || prStatus === 'MERGED',
            merged: isMerged,
            labels: prLabels,
            url: pr.html_url,
            validationChecks,
            validationReasons,
            validationSignals: {
              participantRegistered: validationChecks.participantRegistered,
              repositoryActive: validationChecks.repositoryRegistered,
              validIssueLinked: validationChecks.issueValid,
              testsPassed: validationChecks.testsPassed,
              filesAllowed: validationChecks.filesValid,
              noSuspiciousDiff: validationChecks.filesValid,
            },
            updatedAt: now,
            createdAt: pr.created_at || now,
          },
          { merge: true }
        );

        // 12. If AUTO_APPROVED or MERGED, score non-duplicated issues (Never score draft or duplicate PRs)
        if ((prStatus === 'AUTO_APPROVED' || prStatus === 'MERGED') && !isMultiplePRViolation && pr.draft !== true) {
          let participantId = `p_${author.toLowerCase()}`;
          let participantDocData: any = participantData;

          if (!participantDocData) {
            participantDocData = {
              id: participantId,
              name: author,
              githubUsername: author,
              teamId,
              teamName: teamData.name,
              totalScore: 0,
              prCount: 1,
              mergedPrCount: isMerged ? 1 : 0,
              escapedCells: isMerged ? 1 : 0,
              firstSuccessfulPr: isMerged ? now : null,
              active: true,
              createdAt: now,
              updatedAt: now,
            };
            await setDoc(doc(db, 'participants', participantId), participantDocData);
          }

          // Non-duplicated issue scoring across the squad
          const existingTeamSolvedIssueNumbers = new Set<number>(
            (teamData.solvedIssues || []).map((s: any) => s.issueNumber)
          );

          let totalNewPoints = 0;
          const newlySolvedIssues: any[] = [];

          for (const num of issueNumbers) {
            if (num <= 0) continue;
            // Prevent duplicate issue scoring across the squad
            if (existingTeamSolvedIssueNumbers.has(num)) {
              continue;
            }

            // Determine difficulty & points from trusted labels: Easy(10), Medium(20), Hard(30), Very Hard(40)
            const trustedLabels = prLabels.map((l: string) => l.toLowerCase());
            let difficulty = 'EASY';
            let points = 10;

            if (trustedLabels.includes('difficulty:very-hard') || trustedLabels.includes('difficulty:very_hard') || trustedLabels.includes('points:40')) {
              difficulty = 'VERY_HARD';
              points = 40;
            } else if (trustedLabels.includes('difficulty:hard') || trustedLabels.includes('points:30')) {
              difficulty = 'HARD';
              points = 30;
            } else if (trustedLabels.includes('difficulty:medium') || trustedLabels.includes('points:20')) {
              difficulty = 'MEDIUM';
              points = 20;
            }

            const idempotencyKey = `se_${teamId}_issue_${num}`;
            const eventDocRef = doc(db, 'scoreEvents', idempotencyKey);
            const evSnap = await getDoc(eventDocRef);

            if (!evSnap.exists()) {
              await setDoc(eventDocRef, {
                id: idempotencyKey,
                teamId,
                teamName: teamData.name,
                participantId,
                participantName: participantDocData.name || author,
                githubUsername: author,
                type: `ISSUE_${difficulty}`,
                points,
                prNumber,
                prId,
                repositoryId: matchedRepoId,
                repositoryFullName: repoFullName,
                issueNumber: num,
                reason: `Issue #${num} [${difficulty}]`,
                idempotencyKey,
                timestamp: now,
              });

              totalNewPoints += points;
              existingTeamSolvedIssueNumbers.add(num);
              newlySolvedIssues.push({
                issueNumber: num,
                difficulty,
                points,
                solvedByUsername: author,
                prNumber,
                solvedAt: now,
              });
            }
          }

          // Update Team aggregate stats
          if (totalNewPoints > 0 || isMerged || newlySolvedIssues.length > 0) {
            const updatedSolvedIssues = [...(teamData.solvedIssues || []), ...newlySolvedIssues];
            const updatedTeamScore = (teamData.totalScore || 0) + totalNewPoints;

            // Update member entry in team
            const members = teamData.members ? [...teamData.members] : [];
            const mIdx = members.findIndex((m: any) => m.githubUsername.toLowerCase() === author.toLowerCase());
            if (mIdx >= 0) {
              members[mIdx] = {
                ...members[mIdx],
                prSubmitted: true,
                prNumber,
                score: (members[mIdx].score || 0) + totalNewPoints,
              };
            } else {
              members.push({
                studentId: `s_${author.toLowerCase()}`,
                name: author,
                githubUsername: author,
                assignedIssues: issueNumbers,
                prSubmitted: true,
                prNumber,
                score: totalNewPoints,
              });
            }

            const teamUpdates: any = {
              totalScore: updatedTeamScore,
              solvedIssues: updatedSolvedIssues,
              validatedIssueCount: updatedSolvedIssues.length,
              members,
              updatedAt: now,
            };

            if (isMerged) {
              teamUpdates.lastMergedAt = now;
            }

            await updateDoc(doc(db, 'teams', teamData.id || teamId), teamUpdates);
          }

          // Update Participant cached totalScore & stats
          if (totalNewPoints > 0 || isMerged) {
            const curScore = participantDocData?.totalScore || 0;
            const curMerged = participantDocData?.mergedPrCount || 0;
            const curEscapes = participantDocData?.escapedCells || 0;

            const pUpdates: any = {
              teamId,
              teamName: teamData.name,
              totalScore: curScore + totalNewPoints,
              mergedPrCount: isMerged ? curMerged + 1 : curMerged,
              escapedCells: isMerged ? curEscapes + 1 : curEscapes,
              updatedAt: now,
            };

            if (!participantDocData?.firstSuccessfulPr && isMerged) {
              pUpdates.firstSuccessfulPr = now;
            }

            await updateDoc(doc(db, 'participants', participantId), pUpdates);

            // Update PR score
            const curPRSnap = await getDoc(prDocRef);
            const curPRScore = curPRSnap.data()?.score || 0;
            await updateDoc(prDocRef, {
              score: curPRScore + totalNewPoints,
              solvedIssues: newlySolvedIssues,
              updatedAt: now,
            });
          }
        }
      }
    } catch (scoringErr) {
      console.error('[Webhook] Scoring engine error:', scoringErr);
    }
  }

  // 11. Return fast response
  return res.status(200).json({
    ok: true,
    deliveryId,
    eventType,
    action,
    processingStatus,
    error: errorMsg,
    message:
      processingStatus === 'PROCESSED'
        ? `Event ${eventType} recorded successfully.`
        : `Event ignored: ${errorMsg}`,
  });
}
