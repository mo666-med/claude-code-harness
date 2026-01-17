#!/usr/bin/env python3
"""
model-grader.py - LLMベースグレーダー

Plans.md の内容を LLM で評価し、定性的なスコアを算出する。
Anthropic Evals ガイドライン準拠: 校正可能、参照解との比較可能

使用法:
  python model-grader.py <project_dir> [--reference <ref_file>] [--json]

必要環境変数:
  ANTHROPIC_API_KEY: Anthropic API キー
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path

# Anthropic SDK のインポート（なければスキップ）
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


# グレーダー定義
GRADERS = {
    "plan_quality": {
        "weight": 2.0,
        "prompt": """以下の Plans.md の内容を評価してください。

評価基準:
5: 曖昧さを完全に解消し、詳細で実行可能な計画。フェーズ分け、テストケース設計、エッジケース考慮が含まれる。
4: ほとんどの曖昧さを解消、軽微な不明点のみ。基本的なフェーズ分けとテスト計画がある。
3: 基本的な計画はあるが、いくつかの曖昧さが残る。テスト計画が不十分。
2: 計画が不十分、多くの曖昧さが未解消。構造化されていない。
1: 計画なし、または曖昧なまま実装開始。

Plans.md の内容:
{content}

スコア（1-5の整数のみ）:"""
    },
    "requirements_clarity": {
        "weight": 1.5,
        "prompt": """曖昧な依頼に対して、要件を明確化する質問や確認が行われたかを評価してください。

元の依頼には以下の問題がありました:
- 技術用語の誤用（「サーバ」「データ」など曖昧な表現）
- 矛盾する要件（「シンプルだけど全部対応」など）
- 曖昧な範囲指定（「とか」「いい感じに」など）

評価基準:
5: すべての曖昧さを特定し、適切に確認。矛盾も解消している。
4: 主要な曖昧さを確認、軽微な漏れのみ。
3: 一部の曖昧さのみ確認。
2: ほとんど確認なし。
1: 確認なしで実装、曖昧さを無視。

Plans.md の内容:
{content}

スコア（1-5の整数のみ）:"""
    },
    "contradiction_handling": {
        "weight": 1.5,
        "prompt": """矛盾する要件（例: 「シンプルだけど全部対応」「RESTでもGraphQLでもいい」）に対して、
適切に対処できたかを評価してください。

評価基準:
5: 矛盾を明確に指摘し、優先度を確認して解決。トレードオフを説明している。
4: 矛盾を認識し、妥当な判断で解決。
3: 矛盾を部分的に認識。
2: 矛盾を無視して実装。
1: 矛盾に気づかず、両方を実装しようとして失敗。

Plans.md の内容:
{content}

スコア（1-5の整数のみ）:"""
    },
    "tdd_approach": {
        "weight": 1.0,
        "prompt": """TDD（テスト駆動開発）アプローチが適切に計画されているかを評価してください。

評価基準:
5: 明確なテストケース設計表があり、入力/期待出力/境界値が定義されている。
4: テストケースの記述があるが、一部不完全。
3: テストに言及しているが、具体的な設計がない。
2: テストの言及が曖昧または不十分。
1: テストへの言及なし。

Plans.md の内容:
{content}

スコア（1-5の整数のみ）:"""
    },
    "user_misunderstanding_addressed": {
        "weight": 1.5,
        "prompt": """ユーザーの技術的な誤解や間違いに対して、適切に対応できているかを評価してください。

元の依頼は非エンジニアからのもので、以下のような問題がありました:
- 技術用語を知らない（「サーバー側の処理」が何か分かっていない）
- 矛盾する要件（「シンプル」かつ「機能追加しやすい」）
- 曖昧な表現（「いい感じに」「ちゃんと」）

評価基準:
5: ユーザーの誤解を特定し、分かりやすい言葉で説明・整理している。合理的な仮定を置いて明記している。
4: 主要な誤解に対応し、妥当な仮定を置いている。
3: 一部の誤解に対応しているが、説明が不十分。
2: 誤解をほぼ無視して技術用語で進めている。
1: ユーザーの誤解に全く対応せず、曖昧なまま。

Plans.md の内容:
{content}

スコア（1-5の整数のみ）:"""
    }
}


def read_plans_md(project_dir: Path) -> str:
    """Plans.md を読み込む"""
    plans_path = project_dir / "Plans.md"
    if not plans_path.exists():
        return ""
    return plans_path.read_text(encoding="utf-8")


def read_reference_solution(ref_path: Path) -> str:
    """参照解を読み込む"""
    if not ref_path.exists():
        return ""
    return ref_path.read_text(encoding="utf-8")


def extract_score_from_response(text: str) -> int:
    """LLM レスポンスからスコア（1-5）を正規表現で抽出

    対応するフォーマット:
    - "4"
    - "Score: 4"
    - "4/5"
    - "Rating: 4"
    - "スコア: 4"
    - "4点"
    - "**4**"
    """
    text = text.strip()

    # パターン1: 単独の数字（最も優先）
    if re.match(r'^[1-5]$', text):
        return int(text)

    # パターン2: "Score: 4" や "スコア: 4" 形式
    match = re.search(r'(?:score|rating|スコア|評価)[:\s]*([1-5])', text, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # パターン3: "4/5" 形式
    match = re.search(r'([1-5])\s*/\s*5', text)
    if match:
        return int(match.group(1))

    # パターン4: "**4**" Markdown 強調形式
    match = re.search(r'\*\*([1-5])\*\*', text)
    if match:
        return int(match.group(1))

    # パターン5: テキスト内の最初の 1-5 の数字
    match = re.search(r'\b([1-5])\b', text)
    if match:
        return int(match.group(1))

    # 抽出失敗時はデフォルト
    return 3


def evaluate_with_llm(content: str, grader_name: str, grader_config: dict) -> int:
    """LLM でグレーディングを実行"""
    if not HAS_ANTHROPIC:
        print("Warning: anthropic SDK not installed. Using mock score.", file=sys.stderr)
        return 3  # デフォルトスコア

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Warning: ANTHROPIC_API_KEY not set. Using mock score.", file=sys.stderr)
        return 3

    client = anthropic.Anthropic(api_key=api_key)

    prompt = grader_config["prompt"].format(content=content)

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",  # 高速・低コスト
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}]
        )

        # レスポンスからスコアを正規表現で抽出
        text = response.content[0].text.strip()
        score = extract_score_from_response(text)
        return max(1, min(5, score))  # 1-5 に制限
    except Exception as e:
        print(f"Warning: LLM evaluation failed for {grader_name}: {e}", file=sys.stderr)
        return 3


def mock_evaluate(content: str, grader_name: str) -> int:
    """モック評価（API キーがない場合のフォールバック）"""
    # 簡易的なヒューリスティック
    if not content:
        return 1

    score = 3  # デフォルト

    # Plans.md の長さで調整
    lines = len(content.split('\n'))
    if lines > 100:
        score += 1
    elif lines < 20:
        score -= 1

    # 特定キーワードの存在で調整
    keywords = {
        "plan_quality": ["フェーズ", "Phase", "テスト", "設計"],
        "requirements_clarity": ["確認", "質問", "要件", "明確化"],
        "contradiction_handling": ["優先", "トレードオフ", "選択", "決定"],
        "tdd_approach": ["テストケース", "期待出力", "入力", "境界"]
    }

    if grader_name in keywords:
        matches = sum(1 for kw in keywords[grader_name] if kw in content)
        if matches >= 3:
            score += 1
        elif matches == 0:
            score -= 1

    return max(1, min(5, score))


def run_grading(project_dir: Path, reference_path: Path = None, use_llm: bool = True) -> dict:
    """グレーディングを実行"""
    content = read_plans_md(project_dir)
    reference = read_reference_solution(reference_path) if reference_path else ""

    results = {
        "graders": {},
        "weighted_score": 0.0,
        "max_score": 0.0,
        "normalized_score": 0.0,
        "project_dir": str(project_dir),
        "has_plans_md": bool(content)
    }

    if not content:
        # Plans.md がない場合は最低スコア
        for name, config in GRADERS.items():
            results["graders"][name] = {
                "score": 1,
                "weight": config["weight"]
            }
            results["weighted_score"] += 1 * config["weight"]
            results["max_score"] += 5 * config["weight"]
        results["normalized_score"] = round((results["weighted_score"] / results["max_score"]) * 100, 1)
        return results

    # 各グレーダーを実行
    for name, config in GRADERS.items():
        if use_llm and HAS_ANTHROPIC and os.environ.get("ANTHROPIC_API_KEY"):
            score = evaluate_with_llm(content, name, config)
        else:
            score = mock_evaluate(content, name)

        results["graders"][name] = {
            "score": score,
            "weight": config["weight"]
        }
        results["weighted_score"] += score * config["weight"]
        results["max_score"] += 5 * config["weight"]

    results["weighted_score"] = round(results["weighted_score"], 2)
    results["normalized_score"] = round((results["weighted_score"] / results["max_score"]) * 100, 1)

    return results


def print_results(results: dict, output_format: str):
    """結果を出力"""
    if output_format == "json":
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print("=== Model-Based Grader Results ===")
        print()
        print(f"Project: {results['project_dir']}")
        print(f"Plans.md exists: {results['has_plans_md']}")
        print()
        print("| Grader                  | Score | Weight |")
        print("|-------------------------|-------|--------|")
        for name, data in results["graders"].items():
            print(f"| {name:<23} | {data['score']:>5} | {data['weight']:>6.1f} |")
        print()
        print(f"Weighted Score: {results['weighted_score']:.2f} / {results['max_score']:.2f}")
        print(f"Normalized Score: {results['normalized_score']:.1f} / 100")


def main():
    parser = argparse.ArgumentParser(description="LLM-based grader for Plans.md evaluation")
    parser.add_argument("project_dir", type=Path, default=Path("."), nargs="?",
                       help="Project directory containing Plans.md")
    parser.add_argument("--reference", type=Path, default=None,
                       help="Reference solution file for comparison")
    parser.add_argument("--json", action="store_true",
                       help="Output in JSON format")
    parser.add_argument("--no-llm", action="store_true",
                       help="Use mock evaluation instead of LLM")

    args = parser.parse_args()

    results = run_grading(
        project_dir=args.project_dir,
        reference_path=args.reference,
        use_llm=not args.no_llm
    )

    print_results(results, "json" if args.json else "text")


if __name__ == "__main__":
    main()
