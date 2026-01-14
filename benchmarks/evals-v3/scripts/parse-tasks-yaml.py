#!/usr/bin/env python3
"""
parse-tasks-yaml.py - YAML タスク定義のパーサー

使用法:
  python3 parse-tasks-yaml.py <yaml_file> [--ids | --prompts | --commands | --full]

出力形式:
  --ids:      タスクIDのみ（改行区切り）
  --prompts:  "ID|prompt" 形式
  --commands: "ID|command" 形式
  --full:     "ID|prompt|command" 形式（デフォルト）
"""

import sys
import yaml
import argparse


def main():
    parser = argparse.ArgumentParser(description="Parse YAML task definitions")
    parser.add_argument("yaml_file", help="Path to YAML file")
    parser.add_argument("--ids", action="store_true", help="Output task IDs only")
    parser.add_argument("--prompts", action="store_true", help="Output ID|prompt")
    parser.add_argument("--commands", action="store_true", help="Output ID|command")
    parser.add_argument("--full", action="store_true", help="Output ID|prompt|command (default)")
    parser.add_argument("--task", help="Get specific task by ID")
    parser.add_argument("--field", help="Get specific field for --task")

    args = parser.parse_args()

    try:
        with open(args.yaml_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading YAML: {e}", file=sys.stderr)
        sys.exit(1)

    tasks = data.get('tasks', [])

    # 特定タスクの特定フィールドを取得
    if args.task and args.field:
        for task in tasks:
            if task.get('id') == args.task:
                value = task.get(args.field, '')
                print(value)
                return
        sys.exit(1)  # タスクが見つからない

    # ID のみ
    if args.ids:
        for task in tasks:
            print(task.get('id', ''))
        return

    # ID|prompt
    if args.prompts:
        for task in tasks:
            tid = task.get('id', '')
            prompt = task.get('prompt', '')
            print(f"{tid}|{prompt}")
        return

    # ID|command (deprecated - now using same prompt for both conditions)
    if args.commands:
        for task in tasks:
            tid = task.get('id', '')
            # 両方のコンディションで同じプロンプトを使用
            prompt = task.get('prompt', '')
            print(f"{tid}|{prompt}")
        return

    # デフォルト: full (ID|prompt|command)
    # Note: command は prompt と同じ（--plugin-dir の有無で差別化）
    for task in tasks:
        tid = task.get('id', '')
        prompt = task.get('prompt', '')
        print(f"{tid}|{prompt}|{prompt}")


if __name__ == "__main__":
    main()
