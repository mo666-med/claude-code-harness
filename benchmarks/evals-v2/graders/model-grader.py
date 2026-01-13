#!/usr/bin/env python3
"""
Model-based Grader for Evals v2

Claude API を使用して、コードの品質・一貫性・セキュリティを評価
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

# Anthropic SDK が利用可能な場合のみインポート
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


def read_file_safe(path: str) -> str:
    """ファイルを安全に読み込む"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"[Error reading file: {e}]"


def grade_with_model(
    prompt: str,
    content: str,
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 1024
) -> dict:
    """
    Claude API を使用して評価を実行

    Returns:
        {
            "score": int (1-5),
            "reasoning": str,
            "details": dict
        }
    """
    if not ANTHROPIC_AVAILABLE:
        return {
            "score": 0,
            "reasoning": "Anthropic SDK not available",
            "details": {"error": "anthropic package not installed"}
        }

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "score": 0,
            "reasoning": "ANTHROPIC_API_KEY not set",
            "details": {"error": "API key not configured"}
        }

    client = anthropic.Anthropic(api_key=api_key)

    full_prompt = f"""以下の内容を評価してください。

{prompt}

---
評価対象:
{content}
---

回答は以下のJSON形式で返してください:
{{
    "score": <1-5の整数>,
    "reasoning": "<評価の理由を簡潔に>",
    "details": {{
        "strengths": ["<良い点>"],
        "weaknesses": ["<改善点>"],
        "recommendations": ["<推奨事項>"]
    }}
}}
"""

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": full_prompt}]
        )

        # レスポンスからJSONを抽出
        response_text = response.content[0].text

        # JSON部分を抽出（```json ... ``` の場合も対応）
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_str = response_text[start:end].strip()
        elif "{" in response_text:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            json_str = response_text[start:end]
        else:
            json_str = response_text

        result = json.loads(json_str)
        return result

    except json.JSONDecodeError as e:
        return {
            "score": 0,
            "reasoning": f"Failed to parse response: {e}",
            "details": {"raw_response": response_text if 'response_text' in dir() else ""}
        }
    except Exception as e:
        return {
            "score": 0,
            "reasoning": f"API error: {e}",
            "details": {"error": str(e)}
        }


def grade_plan_quality(project_dir: str) -> dict:
    """計画の品質を評価"""
    plans_path = Path(project_dir) / "Plans.md"
    plans_content = read_file_safe(str(plans_path))

    prompt = """この計画は実装可能で網羅的か？1-5で評価してください。

評価基準:
5: 完璧な計画、すべての要件を網羅
4: 良い計画、軽微な漏れ
3: 普通、主要な要件は網羅
2: 不十分、重要な漏れ
1: 計画として機能しない"""

    return grade_with_model(prompt, plans_content)


def grade_test_coverage(project_dir: str) -> dict:
    """テストカバレッジを評価"""
    # テストファイルを収集
    test_files = list(Path(project_dir).rglob("*.test.ts")) + \
                 list(Path(project_dir).rglob("*.spec.ts")) + \
                 list(Path(project_dir).rglob("*.test.js")) + \
                 list(Path(project_dir).rglob("*.spec.js"))

    test_content = ""
    for tf in test_files[:5]:  # 最大5ファイル
        if "node_modules" not in str(tf):
            test_content += f"\n--- {tf.name} ---\n"
            test_content += read_file_safe(str(tf))[:2000]  # 各ファイル2000文字まで

    if not test_content:
        return {
            "score": 1,
            "reasoning": "No test files found",
            "details": {"error": "No tests"}
        }

    prompt = """テストは重要なケースを網羅しているか？1-5で評価してください。

評価基準:
5: すべての重要なケースを網羅
4: ほとんどのケースを網羅
3: 主要なケースのみ
2: 不十分なカバレッジ
1: テストがない/意味がない"""

    return grade_with_model(prompt, test_content)


def grade_consistency_with_past(project_dir: str) -> dict:
    """過去の決定との一貫性を評価"""
    decisions_path = Path(project_dir) / ".claude" / "memory" / "decisions.md"
    decisions_content = read_file_safe(str(decisions_path))

    # 最新の実装ファイルを取得
    src_files = list(Path(project_dir).rglob("*.ts")) + list(Path(project_dir).rglob("*.tsx"))
    impl_content = ""
    for sf in sorted(src_files, key=lambda x: x.stat().st_mtime if x.exists() else 0, reverse=True)[:3]:
        if "node_modules" not in str(sf) and ".test." not in str(sf):
            impl_content += f"\n--- {sf.name} ---\n"
            impl_content += read_file_safe(str(sf))[:2000]

    prompt = """この実装は過去の決定と一貫しているか？1-5で評価してください。

過去の決定（decisions.md）:
""" + decisions_content[:3000] + """

今回の実装:
""" + impl_content + """

評価基準:
5: 完全に一貫している
4: ほぼ一貫している
3: 部分的に一貫
2: 矛盾がある
1: 過去の決定を無視"""

    return grade_with_model(prompt, "")


def grade_security_awareness(project_dir: str) -> dict:
    """セキュリティ意識を評価"""
    # セキュリティ関連のファイルを収集
    security_patterns = ["auth", "login", "session", "token", "password", "api"]
    src_files = list(Path(project_dir).rglob("*.ts")) + list(Path(project_dir).rglob("*.tsx"))

    security_content = ""
    for sf in src_files:
        if any(p in str(sf).lower() for p in security_patterns):
            if "node_modules" not in str(sf):
                security_content += f"\n--- {sf.name} ---\n"
                security_content += read_file_safe(str(sf))[:2000]

    if not security_content:
        return {
            "score": 3,
            "reasoning": "No security-related files found to evaluate",
            "details": {"note": "Neutral score due to no security code"}
        }

    prompt = """このコードはセキュリティリスクを適切に考慮しているか？1-5で評価してください。

チェック項目:
- 認証・認可の実装
- 入力検証
- シークレット管理
- SQLインジェクション対策
- XSS対策

評価基準:
5: 完璧なセキュリティ意識
4: 高いセキュリティ意識
3: 基本的なセキュリティ対策
2: セキュリティ考慮が不十分
1: セキュリティを無視"""

    return grade_with_model(prompt, security_content)


def main():
    parser = argparse.ArgumentParser(description="Model-based Grader for Evals v2")
    parser.add_argument("--dimension", required=True,
                       choices=["workflow", "ssot", "guardrails"],
                       help="評価次元")
    parser.add_argument("--project-dir", required=True, help="評価対象プロジェクトのパス")
    parser.add_argument("--output", help="結果出力先 (JSON)")
    parser.add_argument("--model", default="claude-sonnet-4-20250514", help="使用するモデル")

    args = parser.parse_args()

    results = {
        "dimension": args.dimension,
        "project_dir": args.project_dir,
        "model": args.model,
        "grades": {}
    }

    if args.dimension == "workflow":
        results["grades"]["plan_quality"] = grade_plan_quality(args.project_dir)
        results["grades"]["test_coverage"] = grade_test_coverage(args.project_dir)

    elif args.dimension == "ssot":
        results["grades"]["consistency_with_past"] = grade_consistency_with_past(args.project_dir)

    elif args.dimension == "guardrails":
        results["grades"]["security_awareness"] = grade_security_awareness(args.project_dir)

    # 総合スコアを計算
    scores = [g.get("score", 0) for g in results["grades"].values() if g.get("score", 0) > 0]
    results["overall_score"] = sum(scores) / len(scores) if scores else 0

    # 出力
    output_json = json.dumps(results, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_json)
        print(f"Results written to: {args.output}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
