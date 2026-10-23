const fs = require('fs');
const path = require('path');

const issuesDir = path.resolve('repoissies/issues_repos');
const solDir = path.resolve('repoissies/solutions_repos');

const repos = fs.readdirSync(issuesDir).sort((a,b) => {
  const numA = parseInt(a.replace(/[^0-9]/g, ''));
  const numB = parseInt(b.replace(/[^0-9]/g, ''));
  return numA - numB;
});

const catalog = {};

for (const repo of repos) {
  const repoIssuesPath = path.join(issuesDir, repo, 'beginner_java_bug_hunt', 'issues');
  const solRepoPath = path.join(solDir, repo);
  const solFiles = fs.existsSync(solRepoPath) ? fs.readdirSync(solRepoPath) : [];

  const issues = [];
  for (const diff of ['easy', 'medium', 'hard', 'very-hard']) {
    const diffDir = path.join(repoIssuesPath, diff);
    if (!fs.existsSync(diffDir)) continue;
    const files = fs.readdirSync(diffDir).filter(f => f.endsWith('.md'));

    for (const f of files) {
      const content = fs.readFileSync(path.join(diffDir, f), 'utf8');
      
      const numMatch = f.match(/issue-(\d+)/i);
      const issueNum = numMatch ? parseInt(numMatch[1], 10) : 0;
      
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : f;
      
      let difficulty = 'EASY';
      if (diff === 'medium') difficulty = 'MEDIUM';
      else if (diff === 'hard') difficulty = 'HARD';
      else if (diff === 'very-hard') difficulty = 'VERY_HARD';
      
      const topicMatch = content.match(/\*\*Topic:\*\*\s*(.+)$/m);
      const topic = topicMatch ? topicMatch[1].trim() : '';
      
      const starterMatch = content.match(/\*\*Starter file:\*\*\s*`([^`]+)`/m);
      const starterFile = starterMatch ? starterMatch[1].trim() : '';
      
      const outputMatch = content.match(/```text\s*([\s\S]*?)\s*```/);
      const expectedOutput = outputMatch ? outputMatch[1].trim() : '';

      const starterBase = path.basename(starterFile);
      const hasSolution = solFiles.includes(starterBase);

      issues.push({
        issueNumber: issueNum,
        difficulty,
        basePoints: difficulty === 'EASY' ? 10 : difficulty === 'MEDIUM' ? 20 : difficulty === 'HARD' ? 30 : 40,
        title,
        topic,
        starterFile,
        solutionFile: hasSolution ? starterBase : undefined,
        hasSolution,
        expectedOutput,
        hasExistingTests: false,
        missingTestsReport: true,
      });
    }
  }

  issues.sort((a,b) => a.issueNumber - b.issueNumber);
  catalog[repo] = issues;
}

const outPath = path.resolve('src/data/challengeCatalog.ts');
const fileContent = '// Auto-generated Challenge Catalog from repoissies discovery\n' +
  'import type { IssueDifficulty } from "../types";\n\n' +
  'export interface CatalogIssue {\n' +
  '  issueNumber: number;\n' +
  '  difficulty: IssueDifficulty;\n' +
  '  basePoints: number;\n' +
  '  title: string;\n' +
  '  topic: string;\n' +
  '  starterFile: string;\n' +
  '  solutionFile?: string;\n' +
  '  hasSolution: boolean;\n' +
  '  expectedOutput: string;\n' +
  '  hasExistingTests: boolean;\n' +
  '  missingTestsReport: boolean;\n' +
  '}\n\n' +
  'export const CHALLENGE_CATALOG: Record<string, CatalogIssue[]> = ' +
  JSON.stringify(catalog, null, 2) + ';\n';

fs.writeFileSync(outPath, fileContent, 'utf8');
console.log('Successfully generated challengeCatalog.ts with', Object.keys(catalog).length, 'repos');
let total = 0;
for (const k of Object.keys(catalog)) total += catalog[k].length;
console.log('Total catalog issues:', total);
