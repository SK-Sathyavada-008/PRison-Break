import { describe, it, expect } from 'vitest';
import { extractAllLinkedIssues, determineIssueDifficulty } from '../prValidationPipeline';
import { evaluateIssueSolution, findCatalogIssue } from '../javaSolutionEvaluator';
import { evaluateTeamIssueScoring } from '../scoringEngine';

describe('User Testing Repository: veeresh4520/Squade_1_test', () => {
  const prTitle = 'Demo krishnabranch';
  const commitMessages = ['Issue-1', 'Issue-21', 'Issue-57', 'Issue-85'];
  const changedFiles = [
    {
      filename: 'beginner_java_bug_hunt/src/main/java/hackathon/Issue01_even_or_odd_check.java',
      status: 'modified' as const,
      patch: `@@ -3,9 +3,9 @@ public class Issue01_even_or_odd_check {
      public static void main(String[] args) {
          int n = 12;
-        String result = (n % 2 == 0) ? "Odd" : "Even";
+        String result = (n % 2 == 0) ? "Even" : "Odd";
          if (n == 0) {
-            result = "Odd";
+            result = "Even";
          
          }System.out.println("Result: " + result);
      }`,
    },
    {
      filename: 'beginner_java_bug_hunt/src/main/java/hackathon/Issue21_simple_interest_estimate.java',
      status: 'modified' as const,
      patch: `@@ -1 +1,6 @@
-public class Issue21_simple_interest_estimate { public static void main(String[] args) { int p=130, r=3, t=2; int interest=p*r/100+t; interest++; System.out.println("Interest: "+interest); } }
+public class Issue21_simple_interest_estimate { 
+    public static void main(String[] args) { 
+        int p=130, r=3, t=2; int interest=p*r/100+t; 
+        interest++; 
+        System.out.println("Interest ksjdghaksdhiahi kdjhf : "+interest); 
+        } }`,
    },
    {
      filename: 'beginner_java_bug_hunt/src/main/java/hackathon/Issue57_VH01_MultiBlockHostelAllocationAndTransferSystem.java',
      status: 'modified' as const,
      patch: `@@ -5,4 +5,11 @@ public static void main(String[] args) {
      // Required method signature: static int countAvailableRoomCapacity(int[] values)
      // Implement the method described in the issue. Do not change the supplied test values.
+    static int countAvailableRoomCapacity(int[] values){
+        int count = 0;
+        for(int val : values){
+            if(val > 0) count++;
+        }
+        return count;
+    }
  }`,
    },
    {
      filename: 'beginner_java_bug_hunt/src/main/java/hackathon/Issue85_character_frequency_search.java',
      status: 'modified' as const,
      patch: `@@ -1 +1,9 @@
-public class Issue85_character_frequency_search { public static void main(String[] args) { String s="radhar", target="r"; int count=0; for(int i=0;i<s.length();i++) if(s.charAt(i)==target.charAt(0) && i>0) count++; System.out.println("Frequency: "+count); } }
+public class Issue85_character_frequency_search { 
+    public static void main(String[] args) { 
+        String s="radhar", target="r"; 
+        int count=0; 
+        for(int i=0;i<s.length();i++) 
+        if(s.charAt(i)==target.charAt(0) && i>0) count++; 
+        System.out.println("Frequency skdhg: "+count); 
+        } 
+        }`,
    },
  ];

  it('correctly extracts all 4 linked issues from commits and filenames even with arbitrary PR title', () => {
    const textToScan = `${prTitle} ${commitMessages.join(' ')}`;
    const filePaths = changedFiles.map((f) => f.filename);
    const extracted = extractAllLinkedIssues(prTitle, textToScan, filePaths);

    expect(extracted).toEqual([1, 21, 57, 85]);
  });

  it('correctly identifies difficulties for all 4 issues from the challenge catalog', () => {
    expect(findCatalogIssue('Squade_1_test', 1)?.difficulty).toBe('EASY');
    expect(findCatalogIssue('Squade_1_test', 21)?.difficulty).toBe('EASY');
    expect(findCatalogIssue('Squade_1_test', 57)?.difficulty).toBe('VERY_HARD');
    expect(findCatalogIssue('Squade_1_test', 85)?.difficulty).toBe('MEDIUM');

    expect(determineIssueDifficulty(1)).toBe('EASY');
    expect(determineIssueDifficulty(57)).toBe('VERY_HARD');
  });

  it('accurately evaluates the 2 correct issues and 2 incorrect issues', async () => {
    // 1. Issue 1 (Easy) — correctly fixed
    const eval1 = await evaluateIssueSolution({
      repoName: 'Squade_1_test',
      issueNumber: 1,
      patch: changedFiles[0].patch,
      filename: changedFiles[0].filename,
      fullCode: `
public class Issue01_even_or_odd_check {
    public static void main(String[] args) {
        int n = 12;
        String result = (n % 2 == 0) ? "Even" : "Odd";
        if (n == 0) {
            result = "Even";
        }
        System.out.println("Result: " + result);
    }
}
      `,
    });
    expect(eval1.isCorrect).toBe(true);
    expect(eval1.difficulty).toBe('EASY');
    expect(eval1.basePoints).toBe(10);

    // 2. Issue 21 (Easy) — broken output format
    const eval21 = await evaluateIssueSolution({
      repoName: 'Squade_1_test',
      issueNumber: 21,
      patch: changedFiles[1].patch,
      filename: changedFiles[1].filename,
    });
    expect(eval21.isCorrect).toBe(false);

    // 3. Issue 57 (Very Hard) — correctly implemented countAvailableRoomCapacity
    const eval57 = await evaluateIssueSolution({
      repoName: 'Squade_1_test',
      issueNumber: 57,
      patch: changedFiles[2].patch,
      filename: changedFiles[2].filename,
      fullCode: `
public class Issue57_VH01_MultiBlockHostelAllocationAndTransferSystem {
    public static void main(String[] args) {
        System.out.println("Available Room capacity: " + countAvailableRoomCapacity(new int[] {1, 0, 3, 0, 2}));
    }

    static int countAvailableRoomCapacity(int[] values){
        int count = 0;
        for(int val : values){
            if(val > 0) count++;
        }
        return count;
    }
}
      `,
    });
    expect(eval57.isCorrect).toBe(true);
    expect(eval57.difficulty).toBe('VERY_HARD');
    expect(eval57.basePoints).toBe(40);

    // 4. Issue 85 (Medium) — broken output format
    const eval85 = await evaluateIssueSolution({
      repoName: 'Squade_1_test',
      issueNumber: 85,
      patch: changedFiles[3].patch,
      filename: changedFiles[3].filename,
    });
    expect(eval85.isCorrect).toBe(false);
  });

  it('awards exactly 50 XP (10 EASY + 40 VERY_HARD) and counts 1 Very Hard solved issue', () => {
    // Only the 2 correctly solved issues are credited
    const scoringContext = {
      teamId: 'team_squade_1_test',
      repositoryId: 'repo_veeresh4520_squade_1_test',
      repositoryName: 'Squade_1_test',
      repositoryFullName: 'veeresh4520/Squade_1_test',
      githubUsername: 'radheradhe-008',
      prNumber: 1,
      solvedIssues: [
        {
          issueNumber: 1,
          difficulty: 'EASY' as const,
          basePoints: 10,
          correctnessScore: 1.0,
        },
        {
          issueNumber: 57,
          difficulty: 'VERY_HARD' as const,
          basePoints: 40,
          correctnessScore: 1.0,
        },
      ],
    };

    const result = evaluateTeamIssueScoring(scoringContext);
    expect(result.newIssuesToAward).toHaveLength(2);
    expect(result.totalPoints).toBe(50);

    const vhAwarded = result.newIssuesToAward.filter((i) => i.difficulty === 'VERY_HARD');
    expect(vhAwarded).toHaveLength(1);
    expect(vhAwarded[0].points).toBe(40);

    const easyAwarded = result.newIssuesToAward.filter((i) => i.difficulty === 'EASY');
    expect(easyAwarded).toHaveLength(1);
    expect(easyAwarded[0].points).toBe(10);
  });

  it('awards exactly 50% XP for partially correct issues', () => {
    const scoringContext = {
      teamId: 'team_squade_1_test',
      repositoryId: 'repo_veeresh4520_squade_1_test',
      repositoryName: 'Squade_1_test',
      repositoryFullName: 'veeresh4520/Squade_1_test',
      githubUsername: 'sk-sathyavada-008',
      prNumber: 2,
      solvedIssues: [
        {
          issueNumber: 1, // Easy: 10 base pts -> 5 XP
          difficulty: 'EASY' as const,
          basePoints: 10,
          correctnessScore: 0.5,
        },
        {
          issueNumber: 57, // Very Hard: 40 base pts -> 20 XP
          difficulty: 'VERY_HARD' as const,
          basePoints: 40,
          correctnessScore: 0.5,
        },
      ],
    };

    const result = evaluateTeamIssueScoring(scoringContext);
    expect(result.newIssuesToAward).toHaveLength(2);
    expect(result.totalPoints).toBe(25); // 5 + 20

    const easyIssue = result.newIssuesToAward.find((i) => i.issueNumber === 1)!;
    expect(easyIssue.points).toBe(5);
    expect(easyIssue.label).toContain('(5/10 pts) (Partial)');

    const vhIssue = result.newIssuesToAward.find((i) => i.issueNumber === 57)!;
    expect(vhIssue.points).toBe(20);
    expect(vhIssue.label).toContain('(20/40 pts) (Partial)');
  });

  it('ignores failing/incorrect issues (correctnessScore <= 0)', () => {
    const scoringContext = {
      teamId: 'team_squade_1_test',
      repositoryId: 'repo_veeresh4520_squade_1_test',
      repositoryName: 'Squade_1_test',
      repositoryFullName: 'veeresh4520/Squade_1_test',
      githubUsername: 'sk-sathyavada-008',
      prNumber: 3,
      solvedIssues: [
        {
          issueNumber: 21,
          difficulty: 'EASY' as const,
          basePoints: 10,
          correctnessScore: 0.0,
        },
      ],
    };

    const result = evaluateTeamIssueScoring(scoringContext);
    expect(result.newIssuesToAward).toHaveLength(0);
    expect(result.totalPoints).toBe(0);
  });
});
