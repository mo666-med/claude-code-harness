#!/usr/bin/env python3
"""
statistical-analysis.py - 統計分析スクリプト

試行結果を統計的に分析し、有意性を報告する。
Anthropic Evals ガイドライン準拠: pass@k, Cohen's d, 95% CI

修正点（Codex レビュー反映）:
- 対応 t 検定（paired t-test）に変更
- scipy.stats を使用した正確な統計計算
- 標本分散（N-1）を使用
- 正確な t 分布臨界値

使用法:
  python statistical-analysis.py <results_dir>
  python statistical-analysis.py <results_dir> --report
  python statistical-analysis.py <results_dir> --json

出力:
  - コンソール: 統計サマリー
  - --report: Markdown レポート
  - --json: JSON 形式
"""

import os
import sys
import json
import math
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass

# scipy のインポート（なければフォールバック）
try:
    from scipy import stats as scipy_stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("Warning: scipy not installed. Using fallback statistics.", file=sys.stderr)


@dataclass
class TrialResult:
    """単一試行の結果"""
    iteration: int
    mode: str  # "with-plugin" or "no-plugin"
    plans_exists: bool
    code_score: float
    model_score: float
    normalized_score: float


@dataclass
class PairedTrial:
    """ペアの試行結果（同一イテレーション）"""
    iteration: int
    wp_score: float
    np_score: float
    wp_plans_exists: bool
    np_plans_exists: bool
    diff: float  # wp_score - np_score


@dataclass
class StatisticalResults:
    """統計分析結果"""
    task_id: str
    n_pairs: int  # ペア数

    # with-plugin 結果
    wp_mean: float
    wp_std: float
    wp_success_rate: float
    wp_scores: List[float]

    # no-plugin 結果
    np_mean: float
    np_std: float
    np_success_rate: float
    np_scores: List[float]

    # ペア差分
    diff_mean: float
    diff_std: float
    diffs: List[float]

    # 比較統計
    cohens_d: float
    t_statistic: float
    p_value: float
    ci_lower: float
    ci_upper: float
    pass_at_3_wp: float
    pass_at_3_np: float

    # 欠損情報
    missing_pairs: int


def load_trial_results(results_dir: Path) -> Dict[str, List[TrialResult]]:
    """試行結果を読み込む"""
    results = {}

    for task_dir in results_dir.iterdir():
        if not task_dir.is_dir() or task_dir.name.startswith('.'):
            continue

        task_id = task_dir.name
        results[task_id] = []

        for mode in ["with-plugin", "no-plugin"]:
            mode_dir = task_dir / mode
            if not mode_dir.exists():
                continue

            for iter_dir in sorted(mode_dir.iterdir()):
                if not iter_dir.is_dir() or not iter_dir.name.startswith('iter-'):
                    continue

                iteration = int(iter_dir.name.split('-')[1])
                grading_file = iter_dir / "grading-result.json"

                if not grading_file.exists():
                    continue

                with open(grading_file, 'r') as f:
                    data = json.load(f)

                code_grading = data.get("code_grading", {})
                model_grading = data.get("model_grading", {})

                plans_exists = code_grading.get("graders", {}).get("plans_exists", {}).get("value", 0) == 1
                code_score = code_grading.get("normalized_score", 0)
                model_score = model_grading.get("normalized_score", 0)

                # 総合スコア（コード 60% + モデル 40%）
                normalized_score = code_score * 0.6 + model_score * 0.4

                results[task_id].append(TrialResult(
                    iteration=iteration,
                    mode=mode,
                    plans_exists=plans_exists,
                    code_score=code_score,
                    model_score=model_score,
                    normalized_score=normalized_score
                ))

    return results


def create_paired_trials(trials: List[TrialResult]) -> Tuple[List[PairedTrial], int]:
    """イテレーションごとにペアを作成"""
    wp_by_iter = {t.iteration: t for t in trials if t.mode == "with-plugin"}
    np_by_iter = {t.iteration: t for t in trials if t.mode == "no-plugin"}

    all_iterations = set(wp_by_iter.keys()) | set(np_by_iter.keys())
    paired = []
    missing = 0

    for iteration in sorted(all_iterations):
        wp = wp_by_iter.get(iteration)
        np = np_by_iter.get(iteration)

        if wp is None or np is None:
            missing += 1
            continue

        paired.append(PairedTrial(
            iteration=iteration,
            wp_score=wp.normalized_score,
            np_score=np.normalized_score,
            wp_plans_exists=wp.plans_exists,
            np_plans_exists=np.plans_exists,
            diff=wp.normalized_score - np.normalized_score
        ))

    return paired, missing


def calculate_pass_at_k(n: int, c: int, k: int) -> float:
    """
    pass@k の計算（Anthropic/OpenAI 標準式）

    n: 総試行数
    c: 成功数
    k: サンプル数

    pass@k = 1 - C(n-c, k) / C(n, k)
    """
    if n < k:
        return 0.0 if c == 0 else 1.0
    if c == 0:
        return 0.0
    if c >= n:
        return 1.0

    # 組み合わせ計算（オーバーフロー防止）
    def comb_ratio(a, b, k):
        """C(a, k) / C(b, k) を計算"""
        if k == 0:
            return 1.0
        result = 1.0
        for i in range(k):
            result *= (a - i) / (b - i)
        return result

    return 1.0 - comb_ratio(n - c, n, k)


def paired_t_test(diffs: List[float]) -> Tuple[float, float, float, float, float]:
    """
    対応 t 検定を実行

    Returns:
        (t_statistic, p_value, ci_lower, ci_upper, cohens_d)
    """
    n = len(diffs)
    if n < 2:
        return (0.0, 1.0, 0.0, 0.0, 0.0)

    # 差分の平均と標準偏差（標本分散: N-1 で割る）
    mean_diff = sum(diffs) / n
    var_diff = sum((d - mean_diff) ** 2 for d in diffs) / (n - 1)
    std_diff = math.sqrt(var_diff) if var_diff > 0 else 0.001  # ゼロ除算防止

    # 標準誤差
    se = std_diff / math.sqrt(n)

    # t 統計量
    t_stat = mean_diff / se if se > 0 else 0.0

    # 自由度
    df = n - 1

    # p 値と信頼区間
    if HAS_SCIPY:
        p_value = 2 * (1 - scipy_stats.t.cdf(abs(t_stat), df))
        t_critical = scipy_stats.t.ppf(0.975, df)  # 95% CI
    else:
        # フォールバック: 近似計算
        p_value = fallback_t_test_p_value(t_stat, df)
        t_critical = fallback_t_critical(df)

    ci_lower = mean_diff - t_critical * se
    ci_upper = mean_diff + t_critical * se

    # Cohen's d（対応 t 検定用）
    cohens_d = mean_diff / std_diff if std_diff > 0 else 0.0

    return (t_stat, p_value, ci_lower, ci_upper, cohens_d)


def fallback_t_test_p_value(t: float, df: int) -> float:
    """scipy がない場合の p 値近似"""
    # 正規分布近似（df が大きい場合に妥当）
    if df > 30:
        # 標準正規分布で近似
        z = abs(t)
        p = 2 * (1 - 0.5 * (1 + math.erf(z / math.sqrt(2))))
        return p

    # 小さい df の場合はより保守的に
    return min(1.0, 2 * math.exp(-0.5 * t * t))


def fallback_t_critical(df: int) -> float:
    """scipy がない場合の t 臨界値近似（95% CI 用）"""
    if df >= 120:
        return 1.96
    elif df >= 60:
        return 2.00
    elif df >= 30:
        return 2.04
    elif df >= 20:
        return 2.09
    elif df >= 15:
        return 2.13
    elif df >= 10:
        return 2.23
    elif df >= 5:
        return 2.57
    else:
        return 2.78


def calculate_statistics(trials: List[TrialResult]) -> StatisticalResults:
    """統計量を計算（対応 t 検定）"""
    # ペアを作成
    paired_trials, missing = create_paired_trials(trials)

    if len(paired_trials) < 2:
        raise ValueError(f"Not enough paired trials: {len(paired_trials)}")

    # スコアリスト
    wp_scores = [p.wp_score for p in paired_trials]
    np_scores = [p.np_score for p in paired_trials]
    diffs = [p.diff for p in paired_trials]

    n = len(paired_trials)

    # 基本統計量（標本分散: N-1）
    wp_mean = sum(wp_scores) / n
    np_mean = sum(np_scores) / n
    diff_mean = sum(diffs) / n

    wp_var = sum((x - wp_mean) ** 2 for x in wp_scores) / (n - 1)
    np_var = sum((x - np_mean) ** 2 for x in np_scores) / (n - 1)
    diff_var = sum((d - diff_mean) ** 2 for d in diffs) / (n - 1)

    wp_std = math.sqrt(wp_var)
    np_std = math.sqrt(np_var)
    diff_std = math.sqrt(diff_var)

    # 成功率（Plans.md が生成されたか）
    wp_success_count = sum(1 for p in paired_trials if p.wp_plans_exists)
    np_success_count = sum(1 for p in paired_trials if p.np_plans_exists)
    wp_success_rate = wp_success_count / n
    np_success_rate = np_success_count / n

    # 対応 t 検定
    t_stat, p_value, ci_lower, ci_upper, cohens_d = paired_t_test(diffs)

    # pass@3（正確な計算）
    pass_at_3_wp = calculate_pass_at_k(n, wp_success_count, 3)
    pass_at_3_np = calculate_pass_at_k(n, np_success_count, 3)

    return StatisticalResults(
        task_id="",  # 後で設定
        n_pairs=n,
        wp_mean=wp_mean,
        wp_std=wp_std,
        wp_success_rate=wp_success_rate,
        wp_scores=wp_scores,
        np_mean=np_mean,
        np_std=np_std,
        np_success_rate=np_success_rate,
        np_scores=np_scores,
        diff_mean=diff_mean,
        diff_std=diff_std,
        diffs=diffs,
        cohens_d=cohens_d,
        t_statistic=t_stat,
        p_value=p_value,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        pass_at_3_wp=pass_at_3_wp,
        pass_at_3_np=pass_at_3_np,
        missing_pairs=missing
    )


def interpret_cohens_d(d: float) -> str:
    """Cohen's d の解釈"""
    d = abs(d)
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"


def generate_report(results: Dict[str, StatisticalResults], run_id: str, metadata: dict = None) -> str:
    """Markdown レポートを生成"""
    report = []
    report.append("# Evals v3 統計レポート")
    report.append("")
    report.append("## 実験設定")
    report.append("")
    report.append(f"- **Run ID**: {run_id}")
    report.append(f"- **タスク数**: {len(results)}")
    report.append("- **統計手法**: 対応 t 検定（paired t-test）")
    report.append(f"- **scipy 使用**: {'Yes' if HAS_SCIPY else 'No (fallback)'}")

    if metadata:
        if "git_commit" in metadata:
            report.append(f"- **Git Commit**: {metadata['git_commit']}")
        if "cli_version" in metadata:
            report.append(f"- **CLI Version**: {metadata['cli_version']}")

    for task_id, stats in sorted(results.items()):
        report.append(f"- **{task_id}**: N={stats.n_pairs} pairs (missing: {stats.missing_pairs})")

    report.append("")

    report.append("## 結果サマリー")
    report.append("")
    report.append("| タスク | with-plugin | no-plugin | 差分 (95% CI) | Cohen's d | p-value |")
    report.append("|--------|-------------|-----------|---------------|-----------|---------|")

    for task_id, stats in sorted(results.items()):
        sig = "**" if stats.p_value < 0.05 else ""
        ci_str = f"[{stats.ci_lower:.1f}, {stats.ci_upper:.1f}]"
        report.append(
            f"| {task_id} | {stats.wp_mean:.1f} ± {stats.wp_std:.1f} | "
            f"{stats.np_mean:.1f} ± {stats.np_std:.1f} | "
            f"{sig}+{stats.diff_mean:.1f}{sig} {ci_str} | "
            f"{stats.cohens_d:.2f} ({interpret_cohens_d(stats.cohens_d)}) | "
            f"{stats.p_value:.4f} |"
        )

    report.append("")
    report.append("## Plans.md 生成率")
    report.append("")
    report.append("| タスク | with-plugin | no-plugin | pass@3 (wp) | pass@3 (np) |")
    report.append("|--------|-------------|-----------|-------------|-------------|")

    for task_id, stats in sorted(results.items()):
        report.append(
            f"| {task_id} | {stats.wp_success_rate*100:.0f}% | "
            f"{stats.np_success_rate*100:.0f}% | "
            f"{stats.pass_at_3_wp*100:.1f}% | "
            f"{stats.pass_at_3_np*100:.1f}% |"
        )

    report.append("")
    report.append("## 統計的検定")
    report.append("")

    for task_id, stats in sorted(results.items()):
        sig_text = "✅ 統計的に有意な差あり" if stats.p_value < 0.05 else "⚠️ 統計的に有意な差なし"
        report.append(f"### {task_id}")
        report.append("")
        report.append(f"- **N (pairs)**: {stats.n_pairs}")
        report.append(f"- **t 統計量**: {stats.t_statistic:.3f}")
        report.append(f"- **Cohen's d**: {stats.cohens_d:.2f} (効果量: {interpret_cohens_d(stats.cohens_d)})")
        report.append(f"- **p-value**: {stats.p_value:.4f} (有意水準 α=0.05)")
        report.append(f"- **95% CI**: [{stats.ci_lower:.2f}, {stats.ci_upper:.2f}]")
        report.append(f"- **結論**: {sig_text}")
        report.append("")

    report.append("## 方法論")
    report.append("")
    report.append("- **実験デザイン**: 対応のある 2 条件比較（within-subjects）")
    report.append("- **統計手法**: 対応 t 検定（paired t-test）")
    report.append("- **効果量**: Cohen's d（差分の標準偏差で正規化）")
    report.append("- **pass@k**: Anthropic/OpenAI 標準式による計算")
    report.append("")
    report.append("---")
    report.append("")
    report.append("*Generated by Evals v3 Statistical Analysis (scipy-based)*")

    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Statistical analysis for evals v3")
    parser.add_argument("results_dir", type=Path,
                       help="Directory containing trial results")
    parser.add_argument("--report", action="store_true",
                       help="Generate Markdown report")
    parser.add_argument("--json", action="store_true",
                       help="Output in JSON format")
    parser.add_argument("--output", type=Path, default=None,
                       help="Output file path")

    args = parser.parse_args()

    if not args.results_dir.exists():
        print(f"Error: Results directory not found: {args.results_dir}", file=sys.stderr)
        sys.exit(1)

    # 結果を読み込み
    print(f"Loading results from: {args.results_dir}", file=sys.stderr)
    all_trials = load_trial_results(args.results_dir)

    if not all_trials:
        print("Error: No trial results found", file=sys.stderr)
        sys.exit(1)

    # 統計分析
    stats_results = {}
    for task_id, trials in all_trials.items():
        try:
            stats = calculate_statistics(trials)
            stats.task_id = task_id
            stats_results[task_id] = stats
        except ValueError as e:
            print(f"Warning: Skipping {task_id}: {e}", file=sys.stderr)

    # 出力
    run_id = args.results_dir.name

    if args.json:
        output = {
            "run_id": run_id,
            "statistical_method": "paired_t_test",
            "scipy_available": HAS_SCIPY,
            "tasks": {
                task_id: {
                    "n_pairs": s.n_pairs,
                    "missing_pairs": s.missing_pairs,
                    "with_plugin": {
                        "mean": round(s.wp_mean, 2),
                        "std": round(s.wp_std, 2),
                        "success_rate": round(s.wp_success_rate, 3),
                        "pass_at_3": round(s.pass_at_3_wp, 3)
                    },
                    "no_plugin": {
                        "mean": round(s.np_mean, 2),
                        "std": round(s.np_std, 2),
                        "success_rate": round(s.np_success_rate, 3),
                        "pass_at_3": round(s.pass_at_3_np, 3)
                    },
                    "comparison": {
                        "diff_mean": round(s.diff_mean, 2),
                        "diff_std": round(s.diff_std, 2),
                        "t_statistic": round(s.t_statistic, 3),
                        "cohens_d": round(s.cohens_d, 3),
                        "cohens_d_interpretation": interpret_cohens_d(s.cohens_d),
                        "p_value": round(s.p_value, 4),
                        "significant": s.p_value < 0.05,
                        "ci_95": [round(s.ci_lower, 2), round(s.ci_upper, 2)]
                    }
                }
                for task_id, s in stats_results.items()
            }
        }
        result = json.dumps(output, indent=2, ensure_ascii=False)
    elif args.report:
        result = generate_report(stats_results, run_id)
    else:
        # コンソール出力
        lines = []
        lines.append("=== Statistical Analysis Results ===")
        lines.append(f"Run ID: {run_id}")
        lines.append(f"Method: Paired t-test (scipy: {HAS_SCIPY})")
        lines.append("")

        for task_id, s in sorted(stats_results.items()):
            lines.append(f"--- {task_id} ---")
            lines.append(f"N pairs: {s.n_pairs} (missing: {s.missing_pairs})")
            lines.append("")
            lines.append("with-plugin:")
            lines.append(f"  Mean: {s.wp_mean:.1f} ± {s.wp_std:.1f}")
            lines.append(f"  Success rate: {s.wp_success_rate*100:.0f}%")
            lines.append(f"  pass@3: {s.pass_at_3_wp*100:.1f}%")
            lines.append("")
            lines.append("no-plugin:")
            lines.append(f"  Mean: {s.np_mean:.1f} ± {s.np_std:.1f}")
            lines.append(f"  Success rate: {s.np_success_rate*100:.0f}%")
            lines.append(f"  pass@3: {s.pass_at_3_np*100:.1f}%")
            lines.append("")
            lines.append("Paired comparison:")
            lines.append(f"  Mean diff: +{s.diff_mean:.1f} ± {s.diff_std:.1f}")
            lines.append(f"  t-statistic: {s.t_statistic:.3f}")
            lines.append(f"  Cohen's d: {s.cohens_d:.2f} ({interpret_cohens_d(s.cohens_d)})")
            lines.append(f"  p-value: {s.p_value:.4f}")
            lines.append(f"  95% CI: [{s.ci_lower:.2f}, {s.ci_upper:.2f}]")
            sig = "YES" if s.p_value < 0.05 else "NO"
            lines.append(f"  Significant (α=0.05): {sig}")
            lines.append("")

        result = "\n".join(lines)

    # 出力先
    if args.output:
        args.output.write_text(result, encoding="utf-8")
        print(f"Output written to: {args.output}", file=sys.stderr)
    else:
        print(result)


if __name__ == "__main__":
    main()
