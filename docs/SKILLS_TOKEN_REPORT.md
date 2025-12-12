# Skills Token Usage Report

Total skills analyzed: 31

> **Note**: Token counts are estimates based on character count (1 token ≈ 3.5 characters).
> For precise counts, use the tiktoken library.

## Summary Statistics

- **Total tokens (estimated)**: 24,703
- **Average tokens per skill**: 796.9
- **Maximum tokens**: 2,146
- **Minimum tokens**: 378

## Token Usage by Category

| Category | Skills | Total Tokens | Avg Tokens |
| :--- | ---: | ---: | ---: |
| ci | 2 | 1,567 | 784 |
| core | 10 | 8,433 | 843 |
| maintenance | 1 | 1,535 | 1535 |
| skills | 7 | 5,545 | 792 |
| worker | 11 | 7,623 | 693 |

## All Skills (Sorted by Token Count)

| Rank | Skill Name | Category | Tokens | Characters |
| ---: | :--- | :--- | ---: | ---: |
| 1 | ccp-update-2agent-files | core | 2,146 | 7,512 |
| 2 | ccp-setup-2agent-files | core | 1,688 | 5,910 |
| 3 | ccp-auto-cleanup | maintenance | 1,535 | 5,373 |
| 4 | ccp-merge-plans | core | 1,148 | 4,020 |
| 5 | ccp-work-write-tests | worker | 1,088 | 3,811 |
| 6 | parallel-workflows | skills | 1,066 | 3,732 |
| 7 | workflow-guide | skills | 941 | 3,295 |
| 8 | ccp-ci-fix-failing-tests | ci | 842 | 2,949 |
| 9 | ccp-review-changes | worker | 774 | 2,710 |
| 10 | troubleshoot | skills | 770 | 2,698 |
| 11 | plans-management | skills | 763 | 2,671 |
| 12 | session-memory | skills | 757 | 2,652 |
| 13 | ccp-review-accessibility | worker | 750 | 2,625 |
| 14 | ccp-ci-analyze-failures | ci | 725 | 2,540 |
| 15 | ccp-error-recovery | worker | 720 | 2,521 |
| 16 | ccp-review-apply-fixes | worker | 714 | 2,499 |
| 17 | ccp-work-impl-feature | worker | 694 | 2,429 |
| 18 | session-init | skills | 642 | 2,249 |
| 19 | ccp-review-aggregate | worker | 628 | 2,198 |
| 20 | ccp-review-quality | worker | 616 | 2,156 |
| 21 | ccp-review-performance | worker | 611 | 2,139 |
| 22 | vibecoder-guide | skills | 606 | 2,124 |
| 23 | ccp-core-read-repo-context | core | 584 | 2,046 |
| 24 | ccp-vibecoder-guide | core | 580 | 2,032 |
| 25 | ccp-core-diff-aware-editing | core | 552 | 1,934 |
| 26 | ccp-review-security | worker | 530 | 1,855 |
| 27 | ccp-generate-workflow-files | core | 513 | 1,798 |
| 28 | ccp-verify-build | worker | 498 | 1,744 |
| 29 | ccp-core-general-principles | core | 423 | 1,482 |
| 30 | ccp-project-scaffolder | core | 421 | 1,476 |
| 31 | ccp-adaptive-setup | core | 378 | 1,326 |

## Recommendations

### Large Skills (>1000 tokens)

Consider splitting or optimizing these skills:

- **ccp-update-2agent-files** (core): 2,146 tokens
- **ccp-setup-2agent-files** (core): 1,688 tokens
- **ccp-auto-cleanup** (maintenance): 1,535 tokens
- **ccp-merge-plans** (core): 1,148 tokens
- **ccp-work-write-tests** (worker): 1,088 tokens

### Optimization Guidelines

- **Optimal size**: 200-500 tokens per skill
- **Maximum recommended**: 1000 tokens
- **Action**: Skills >1000 tokens should be split into sub-skills
