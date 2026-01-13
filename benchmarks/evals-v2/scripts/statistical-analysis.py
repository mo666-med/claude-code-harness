#!/usr/bin/env python3
"""
Statistical Analysis for Evals v2

評価結果の統計分析を行い、信頼区間、効果量、p値を算出
Anthropic Evals ガイドライン準拠
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

# NumPy/SciPy が利用可能な場合
try:
    import numpy as np
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


@dataclass
class TrialResult:
    """試行結果"""
    trial_id: int
    dimension: str
    task_id: str
    success: bool
    score: float
    duration_seconds: float
    code_grade: dict
    model_grade: dict


def load_results(results_dir: str) -> List[TrialResult]:
    """結果ファイルを読み込む"""
    results = []
    results_path = Path(results_dir)

    for json_file in results_path.glob("*.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            result = TrialResult(
                trial_id=data.get("trial_id", 0),
                dimension=data.get("dimension", "unknown"),
                task_id=data.get("task_id", "unknown"),
                success=data.get("success", False),
                score=data.get("score", 0.0),
                duration_seconds=data.get("duration_seconds", 0.0),
                code_grade=data.get("code_grade", {}),
                model_grade=data.get("model_grade", {})
            )
            results.append(result)
        except Exception as e:
            print(f"Warning: Failed to load {json_file}: {e}", file=sys.stderr)

    return results


def calculate_pass_at_k(results: List[TrialResult], k: int = 1) -> float:
    """
    pass@k メトリクスを計算

    k回試行して少なくとも1回成功する確率
    """
    if not results:
        return 0.0

    n = len(results)
    c = sum(1 for r in results if r.success)

    if n < k:
        return c / n if n > 0 else 0.0

    # pass@k = 1 - C(n-c, k) / C(n, k)
    # 組み合わせの計算を安全に行う
    if c == n:
        return 1.0
    if c == 0:
        return 0.0

    # 対数を使って計算（オーバーフロー防止）
    def log_comb(n, k):
        if k > n or k < 0:
            return float('-inf')
        return sum(math.log(n - i) - math.log(i + 1) for i in range(k))

    log_ratio = log_comb(n - c, k) - log_comb(n, k)
    return 1.0 - math.exp(log_ratio)


def calculate_pass_to_k(results: List[TrialResult], k: int = 1) -> float:
    """
    pass^k メトリクスを計算

    k回連続して成功する確率
    """
    if not results:
        return 0.0

    n = len(results)
    c = sum(1 for r in results if r.success)

    if n < k:
        return 0.0

    # 単純な確率計算: (c/n)^k
    p = c / n
    return p ** k


def calculate_confidence_interval(values: List[float], confidence: float = 0.95) -> Tuple[float, float, float]:
    """
    平均値の信頼区間を計算

    Returns:
        (mean, lower_bound, upper_bound)
    """
    if not values:
        return (0.0, 0.0, 0.0)

    if SCIPY_AVAILABLE:
        arr = np.array(values)
        mean = np.mean(arr)
        sem = stats.sem(arr) if len(arr) > 1 else 0

        if sem > 0:
            ci = stats.t.interval(confidence, len(arr) - 1, loc=mean, scale=sem)
            return (mean, ci[0], ci[1])
        else:
            return (mean, mean, mean)
    else:
        # SciPyなしの簡易計算
        mean = sum(values) / len(values)
        if len(values) < 2:
            return (mean, mean, mean)

        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        std_err = math.sqrt(variance / len(values))

        # 95% CI の近似（正規分布仮定）
        z = 1.96
        return (mean, mean - z * std_err, mean + z * std_err)


def calculate_cohens_d(group1: List[float], group2: List[float]) -> float:
    """
    Cohen's d 効果量を計算
    """
    if not group1 or not group2:
        return 0.0

    if SCIPY_AVAILABLE:
        arr1 = np.array(group1)
        arr2 = np.array(group2)

        n1, n2 = len(arr1), len(arr2)
        var1, var2 = np.var(arr1, ddof=1), np.var(arr2, ddof=1)

        # プールド標準偏差
        pooled_std = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))

        if pooled_std == 0:
            return 0.0

        return (np.mean(arr1) - np.mean(arr2)) / pooled_std
    else:
        # 簡易計算
        mean1 = sum(group1) / len(group1)
        mean2 = sum(group2) / len(group2)

        var1 = sum((x - mean1) ** 2 for x in group1) / (len(group1) - 1) if len(group1) > 1 else 0
        var2 = sum((x - mean2) ** 2 for x in group2) / (len(group2) - 1) if len(group2) > 1 else 0

        pooled_std = math.sqrt((var1 + var2) / 2)

        if pooled_std == 0:
            return 0.0

        return (mean1 - mean2) / pooled_std


def interpret_cohens_d(d: float) -> str:
    """Cohen's d の解釈"""
    abs_d = abs(d)
    if abs_d < 0.2:
        return "negligible"
    elif abs_d < 0.5:
        return "small"
    elif abs_d < 0.8:
        return "medium"
    else:
        return "large"


def calculate_p_value(group1: List[float], group2: List[float]) -> float:
    """
    独立サンプルt検定のp値を計算
    """
    if not SCIPY_AVAILABLE:
        return 1.0  # SciPyなしではp値を計算できない

    if len(group1) < 2 or len(group2) < 2:
        return 1.0

    _, p_value = stats.ttest_ind(group1, group2)
    return p_value


def generate_report(results: List[TrialResult], comparison_results: Optional[List[TrialResult]] = None) -> dict:
    """
    統計レポートを生成
    """
    report = {
        "summary": {},
        "by_dimension": {},
        "by_task": {},
        "pass_metrics": {},
        "comparison": None
    }

    # 全体サマリー
    scores = [r.score for r in results]
    durations = [r.duration_seconds for r in results]

    mean_score, score_ci_low, score_ci_high = calculate_confidence_interval(scores)
    mean_duration, dur_ci_low, dur_ci_high = calculate_confidence_interval(durations)

    report["summary"] = {
        "total_trials": len(results),
        "success_rate": sum(1 for r in results if r.success) / len(results) if results else 0,
        "mean_score": mean_score,
        "score_95_ci": [score_ci_low, score_ci_high],
        "mean_duration_seconds": mean_duration,
        "duration_95_ci": [dur_ci_low, dur_ci_high]
    }

    # pass@k, pass^k メトリクス
    for k in [1, 3, 5]:
        if len(results) >= k:
            report["pass_metrics"][f"pass@{k}"] = calculate_pass_at_k(results, k)
            report["pass_metrics"][f"pass^{k}"] = calculate_pass_to_k(results, k)

    # 次元別分析
    dimensions = set(r.dimension for r in results)
    for dim in dimensions:
        dim_results = [r for r in results if r.dimension == dim]
        dim_scores = [r.score for r in dim_results]

        mean, ci_low, ci_high = calculate_confidence_interval(dim_scores)

        report["by_dimension"][dim] = {
            "trials": len(dim_results),
            "success_rate": sum(1 for r in dim_results if r.success) / len(dim_results) if dim_results else 0,
            "mean_score": mean,
            "score_95_ci": [ci_low, ci_high]
        }

    # タスク別分析
    tasks = set(r.task_id for r in results)
    for task in tasks:
        task_results = [r for r in results if r.task_id == task]
        task_scores = [r.score for r in task_results]

        mean, ci_low, ci_high = calculate_confidence_interval(task_scores)

        report["by_task"][task] = {
            "trials": len(task_results),
            "success_rate": sum(1 for r in task_results if r.success) / len(task_results) if task_results else 0,
            "mean_score": mean,
            "score_95_ci": [ci_low, ci_high]
        }

    # 比較分析（オプション）
    if comparison_results:
        scores1 = [r.score for r in results]
        scores2 = [r.score for r in comparison_results]

        cohens_d = calculate_cohens_d(scores1, scores2)
        p_value = calculate_p_value(scores1, scores2)

        report["comparison"] = {
            "group1_n": len(scores1),
            "group2_n": len(scores2),
            "group1_mean": sum(scores1) / len(scores1) if scores1 else 0,
            "group2_mean": sum(scores2) / len(scores2) if scores2 else 0,
            "cohens_d": cohens_d,
            "effect_size": interpret_cohens_d(cohens_d),
            "p_value": p_value,
            "significant": p_value < 0.05
        }

    return report


def check_saturation(results: List[TrialResult], threshold: float = 1.0) -> dict:
    """
    飽和検出: 100%に達したメトリクスを検出
    """
    saturation = {
        "saturated_metrics": [],
        "recommendations": []
    }

    # 全体の成功率
    if results:
        success_rate = sum(1 for r in results if r.success) / len(results)
        if success_rate >= threshold:
            saturation["saturated_metrics"].append({
                "metric": "overall_success_rate",
                "value": success_rate
            })
            saturation["recommendations"].append(
                "Success rate is 100%. Consider adding more challenging tasks or using pass^k metrics."
            )

    # タスク別
    tasks = set(r.task_id for r in results)
    for task in tasks:
        task_results = [r for r in results if r.task_id == task]
        if task_results:
            task_success = sum(1 for r in task_results if r.success) / len(task_results)
            if task_success >= threshold:
                saturation["saturated_metrics"].append({
                    "metric": f"task_{task}_success_rate",
                    "value": task_success
                })

    if saturation["saturated_metrics"]:
        saturation["recommendations"].append(
            "Convert saturated tasks to regression tests and add new challenging scenarios."
        )

    return saturation


def main():
    parser = argparse.ArgumentParser(description="Statistical Analysis for Evals v2")
    parser.add_argument("--results-dir", required=True, help="結果ディレクトリ")
    parser.add_argument("--comparison-dir", help="比較対象の結果ディレクトリ（オプション）")
    parser.add_argument("--output", help="レポート出力先 (JSON)")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="出力フォーマット")

    args = parser.parse_args()

    # 結果を読み込む
    results = load_results(args.results_dir)

    if not results:
        print("Error: No results found", file=sys.stderr)
        sys.exit(1)

    # 比較対象を読み込む（オプション）
    comparison_results = None
    if args.comparison_dir:
        comparison_results = load_results(args.comparison_dir)

    # レポート生成
    report = generate_report(results, comparison_results)

    # 飽和検出
    report["saturation"] = check_saturation(results)

    # 出力
    if args.format == "markdown":
        output = format_as_markdown(report)
    else:
        output = json.dumps(report, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"Report written to: {args.output}")
    else:
        print(output)


def format_as_markdown(report: dict) -> str:
    """レポートをMarkdown形式にフォーマット"""
    lines = ["# 評価結果レポート\n"]

    # サマリー
    s = report["summary"]
    lines.append("## サマリー\n")
    lines.append(f"- 試行回数: {s['total_trials']}")
    lines.append(f"- 成功率: {s['success_rate']:.1%}")
    lines.append(f"- 平均スコア: {s['mean_score']:.2f} (95% CI: [{s['score_95_ci'][0]:.2f}, {s['score_95_ci'][1]:.2f}])")
    lines.append(f"- 平均所要時間: {s['mean_duration_seconds']:.1f}s")
    lines.append("")

    # pass@k メトリクス
    if report["pass_metrics"]:
        lines.append("## pass@k / pass^k メトリクス\n")
        lines.append("| メトリクス | 値 |")
        lines.append("|------------|-----|")
        for k, v in report["pass_metrics"].items():
            lines.append(f"| {k} | {v:.3f} |")
        lines.append("")

    # 比較結果
    if report["comparison"]:
        c = report["comparison"]
        lines.append("## 比較分析\n")
        lines.append(f"- グループ1 平均: {c['group1_mean']:.2f} (n={c['group1_n']})")
        lines.append(f"- グループ2 平均: {c['group2_mean']:.2f} (n={c['group2_n']})")
        lines.append(f"- Cohen's d: {c['cohens_d']:.3f} ({c['effect_size']})")
        lines.append(f"- p値: {c['p_value']:.4f}")
        lines.append(f"- 有意差: {'あり' if c['significant'] else 'なし'}")
        lines.append("")

    # 飽和検出
    if report["saturation"]["saturated_metrics"]:
        lines.append("## ⚠️ 飽和検出\n")
        for m in report["saturation"]["saturated_metrics"]:
            lines.append(f"- {m['metric']}: {m['value']:.1%}")
        lines.append("")
        for r in report["saturation"]["recommendations"]:
            lines.append(f"> {r}")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
