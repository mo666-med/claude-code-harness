#!/usr/bin/env python3
"""
test-model-grader.py - Model Grader Unit Tests

Usage: python test-model-grader.py

Exit codes:
    0: All tests passed
    1: One or more tests failed
"""

from __future__ import annotations

import sys
import unittest
import tempfile
from pathlib import Path

# グレーダーのパスを追加
sys.path.insert(0, str(Path(__file__).parent.parent))

# model_grader をインポート（ハイフンをアンダースコアに変換）
import importlib.util
grader_path: Path = Path(__file__).parent.parent / "model-grader.py"
spec = importlib.util.spec_from_file_location("model_grader", grader_path)
if spec is None or spec.loader is None:
    raise ImportError(f"Cannot load module from {grader_path}")
model_grader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model_grader)

# === 定数定義 ===
# 全グレーダーがスコア1の場合の正規化スコア（1/5 = 20%）
MIN_NORMALIZED_SCORE: float = 20.0
# 正規化スコアの最大値
MAX_NORMALIZED_SCORE: float = 100.0
# スコア抽出失敗時のデフォルト値
DEFAULT_SCORE: int = 3
# スコアの有効範囲
SCORE_MIN: int = 1
SCORE_MAX: int = 5


class TestExtractScoreFromResponse(unittest.TestCase):
    """extract_score_from_response のユニットテスト"""

    def test_single_digit(self) -> None:
        """単独の数字"""
        self.assertEqual(model_grader.extract_score_from_response("4"), 4)
        self.assertEqual(model_grader.extract_score_from_response("1"), SCORE_MIN)
        self.assertEqual(model_grader.extract_score_from_response("5"), SCORE_MAX)

    def test_score_prefix(self) -> None:
        """Score: 形式"""
        self.assertEqual(model_grader.extract_score_from_response("Score: 4"), 4)
        self.assertEqual(model_grader.extract_score_from_response("score: 3"), DEFAULT_SCORE)
        self.assertEqual(model_grader.extract_score_from_response("Rating: 5"), SCORE_MAX)

    def test_japanese_format(self) -> None:
        """日本語形式"""
        self.assertEqual(model_grader.extract_score_from_response("スコア: 4"), 4)
        self.assertEqual(model_grader.extract_score_from_response("評価: 3"), DEFAULT_SCORE)

    def test_fraction_format(self) -> None:
        """分数形式"""
        self.assertEqual(model_grader.extract_score_from_response("4/5"), 4)
        self.assertEqual(model_grader.extract_score_from_response("3 / 5"), DEFAULT_SCORE)

    def test_markdown_bold(self) -> None:
        """Markdown 強調形式"""
        self.assertEqual(model_grader.extract_score_from_response("**4**"), 4)
        self.assertEqual(model_grader.extract_score_from_response("The score is **3**"), DEFAULT_SCORE)

    def test_text_with_number(self) -> None:
        """テキスト内の数字"""
        self.assertEqual(model_grader.extract_score_from_response("I would rate this a 4"), 4)
        self.assertEqual(model_grader.extract_score_from_response("Based on the criteria, 3 is appropriate"), DEFAULT_SCORE)

    def test_default_on_failure(self) -> None:
        """抽出失敗時のデフォルト"""
        self.assertEqual(model_grader.extract_score_from_response("No score here"), DEFAULT_SCORE)
        self.assertEqual(model_grader.extract_score_from_response(""), DEFAULT_SCORE)


class TestReadPlansMd(unittest.TestCase):
    """read_plans_md のユニットテスト"""

    def test_existing_file(self) -> None:
        """存在するファイル"""
        with tempfile.TemporaryDirectory() as tmpdir:
            plans_path: Path = Path(tmpdir) / "Plans.md"
            plans_path.write_text("# Test Plans", encoding="utf-8")

            content: str = model_grader.read_plans_md(Path(tmpdir))
            self.assertEqual(content, "# Test Plans")

    def test_missing_file(self) -> None:
        """存在しないファイル"""
        with tempfile.TemporaryDirectory() as tmpdir:
            content: str = model_grader.read_plans_md(Path(tmpdir))
            self.assertEqual(content, "")


class TestMockEvaluate(unittest.TestCase):
    """mock_evaluate のユニットテスト"""

    def test_empty_content(self) -> None:
        """空のコンテンツ"""
        score: int = model_grader.mock_evaluate("", "plan_quality")
        self.assertEqual(score, SCORE_MIN)

    def test_short_content(self) -> None:
        """短いコンテンツ（低スコア）"""
        short_content: str = "# Plans\n- Task 1"
        score: int = model_grader.mock_evaluate(short_content, "plan_quality")
        self.assertIn(score, [SCORE_MIN, 2, DEFAULT_SCORE])

    def test_long_content_with_keywords(self) -> None:
        """長いコンテンツ + キーワード（高スコア）"""
        long_content: str = "\n".join([
            "# Plans",
            "## フェーズ 1: 設計",
            "- テスト計画",
            "## Phase 2: 実装",
            "- 詳細設計",
        ] + ["- Task " + str(i) for i in range(100)])

        score: int = model_grader.mock_evaluate(long_content, "plan_quality")
        self.assertGreaterEqual(score, DEFAULT_SCORE)


class TestRunGrading(unittest.TestCase):
    """run_grading のユニットテスト"""

    def test_no_plans_md(self) -> None:
        """Plans.md がない場合"""
        with tempfile.TemporaryDirectory() as tmpdir:
            results: dict = model_grader.run_grading(Path(tmpdir), use_llm=False)

            self.assertFalse(results["has_plans_md"])
            self.assertEqual(results["normalized_score"], MIN_NORMALIZED_SCORE)

    def test_with_plans_md(self) -> None:
        """Plans.md がある場合"""
        with tempfile.TemporaryDirectory() as tmpdir:
            plans_path: Path = Path(tmpdir) / "Plans.md"
            plans_path.write_text("""# Plans.md

## フェーズ 1: 要件確認

確認事項:
- 機能の範囲は？

## フェーズ 2: テスト設計

テストケース設計:
| 入力 | 期待出力 |
|------|---------|
| valid | success |

## Phase 3: 実装

- 実装タスク
""", encoding="utf-8")

            results: dict = model_grader.run_grading(Path(tmpdir), use_llm=False)

            self.assertTrue(results["has_plans_md"])
            self.assertGreater(results["normalized_score"], MIN_NORMALIZED_SCORE)

    def test_result_structure(self) -> None:
        """結果の構造"""
        with tempfile.TemporaryDirectory() as tmpdir:
            plans_path: Path = Path(tmpdir) / "Plans.md"
            plans_path.write_text("# Test", encoding="utf-8")

            results: dict = model_grader.run_grading(Path(tmpdir), use_llm=False)

            # 必須フィールドの存在確認
            self.assertIn("graders", results)
            self.assertIn("weighted_score", results)
            self.assertIn("max_score", results)
            self.assertIn("normalized_score", results)
            self.assertIn("project_dir", results)
            self.assertIn("has_plans_md", results)

    def test_normalized_score_range(self) -> None:
        """正規化スコアの範囲"""
        with tempfile.TemporaryDirectory() as tmpdir:
            plans_path: Path = Path(tmpdir) / "Plans.md"
            plans_path.write_text("# Test Plans\n" * 200, encoding="utf-8")

            results: dict = model_grader.run_grading(Path(tmpdir), use_llm=False)

            self.assertGreaterEqual(results["normalized_score"], 0)
            self.assertLessEqual(results["normalized_score"], MAX_NORMALIZED_SCORE)


class TestGraderWeights(unittest.TestCase):
    """グレーダーの重み設定テスト"""

    def test_all_graders_have_weights(self) -> None:
        """すべてのグレーダーに重みが設定されている"""
        for name, config in model_grader.GRADERS.items():
            self.assertIn("weight", config, f"Grader '{name}' missing weight")
            self.assertGreater(config["weight"], 0, f"Grader '{name}' weight should be > 0")

    def test_all_graders_have_prompts(self) -> None:
        """すべてのグレーダーにプロンプトが設定されている"""
        for name, config in model_grader.GRADERS.items():
            self.assertIn("prompt", config, f"Grader '{name}' missing prompt")
            self.assertIn("{content}", config["prompt"], f"Grader '{name}' prompt should contain {{content}} placeholder")


if __name__ == "__main__":
    # テスト実行
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(sys.modules[__name__])

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # 終了コード
    sys.exit(0 if result.wasSuccessful() else 1)
