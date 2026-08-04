#!/usr/bin/env python3
"""不動産鑑定評価基準PDFから章・節ごとの本文をpublic/kijun.jsonへ抽出する。

data/不動産鑑定評価基準.pdf（gitignore対象、ローカルのみ）を入力とし、
public/questions.json と同じchapter ID体系（総論=1〜9、各論=10〜12）で
本文全文を抽出する。附則はid "13" として追加する。

実行: python3 scripts/extract_kijun.py
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "data" / "不動産鑑定評価基準.pdf"
OUTPUT_PATH = ROOT / "public" / "kijun.json"

FULLWIDTH_DIGITS = "０１２３４５６７８９"
CHAPTER_OFFSET = {"総論": 0, "各論": 9, "附則": 12}

CHAPTER_RE = re.compile(r"^第([０-９0-9]+)章[ \t]+(.+)$")
SECTION_RE = re.compile(r"^第([０-９0-9]+)節[ \t]+(.+)$")
LIST_MARKER_RE = re.compile(r"^（[０-９0-9]+）")
ROMAN_MARKER_RE = re.compile(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+[ \t]")
FUSOKU_RE = re.compile(r"^附[ \t]*則(（.*）)?$")


def to_ascii_digits(s: str) -> str:
    return s.translate({ord(f): str(i) for i, f in enumerate(FULLWIDTH_DIGITS)})


def norm(s: str) -> str:
    return s.strip().replace(" ", "").replace("　", "")


def extract_lines(pdf_path: Path) -> list[str]:
    raw = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, check=True
    ).stdout.decode("utf-8")
    lines: list[str] = []
    for page in raw.split("\f"):
        for line in page.split("\n"):
            if re.fullmatch(r"[0-9０-９]+", line.strip()):
                continue  # ページ番号のみの行
            lines.append(line)
    return lines


def parse_body(body_lines: list[str]) -> dict:
    part = None
    chapters: dict = {}
    current_chapter_id: str | None = None
    current_section_id: str | None = None
    paragraphs: list[str] = []
    current_para_lines: list[str] = []
    fusoku_seen = False

    def flush_para():
        if current_para_lines:
            paragraphs.append("".join(current_para_lines))
            current_para_lines.clear()

    def flush_bucket():
        flush_para()
        text = "\n\n".join(paragraphs)
        if current_chapter_id is not None:
            ch = chapters[current_chapter_id]
            if current_section_id is None:
                ch["intro"] = text
            else:
                ch["sections"][current_section_id]["text"] = text
        paragraphs.clear()

    for raw_line in body_lines:
        stripped = raw_line.rstrip().strip()
        n = norm(stripped)

        if n == "総論":
            flush_bucket()
            part = "総論"
            current_chapter_id = current_section_id = None
            continue
        if n == "各論":
            flush_bucket()
            part = "各論"
            current_chapter_id = current_section_id = None
            continue

        fm = FUSOKU_RE.match(stripped)
        if fm:
            if not fusoku_seen:
                flush_bucket()
                part = "附則"
                current_chapter_id = str(CHAPTER_OFFSET["附則"] + 1)
                chapters[current_chapter_id] = {"title": "附則", "sections": {}, "intro": ""}
                current_section_id = None
                fusoku_seen = True
                if fm.group(1):
                    flush_para()
                    current_para_lines.append(stripped)
            else:
                flush_para()
                current_para_lines.append(stripped)
            continue

        m = CHAPTER_RE.match(stripped)
        if m and part:
            flush_bucket()
            num = int(to_ascii_digits(m.group(1)))
            current_chapter_id = str(CHAPTER_OFFSET[part] + num)
            title = f"{part} 第{m.group(1)}章 {m.group(2)}".strip()
            chapters[current_chapter_id] = {"title": title, "sections": {}, "intro": ""}
            current_section_id = None
            continue

        m = SECTION_RE.match(stripped)
        if m and current_chapter_id and part != "附則":
            flush_bucket()
            num = int(to_ascii_digits(m.group(1)))
            current_section_id = str(num)
            sec_title = f"第{m.group(1)}節 {m.group(2)}".strip()
            chapters[current_chapter_id]["sections"][current_section_id] = {
                "title": sec_title,
                "text": "",
            }
            continue

        if not stripped:
            flush_para()
            continue

        if LIST_MARKER_RE.match(stripped) or ROMAN_MARKER_RE.match(stripped):
            flush_para()
            current_para_lines.append(stripped)
            continue

        current_para_lines.append(stripped)

    flush_bucket()
    return chapters


def main() -> None:
    all_lines = extract_lines(PDF_PATH)

    body_start_candidates = [i for i, l in enumerate(all_lines) if norm(l) == "総論"]
    if not body_start_candidates:
        raise SystemExit("本文の開始位置（総論）が見つかりませんでした")
    body_lines = all_lines[body_start_candidates[-1] :]

    chapters = parse_body(body_lines)

    expected_chapter_count = 13  # 総論9 + 各論3 + 附則1
    if len(chapters) != expected_chapter_count:
        raise SystemExit(
            f"章数が想定({expected_chapter_count})と異なります: {len(chapters)}件 "
            f"{sorted(chapters.keys(), key=int)}"
        )

    OUTPUT_PATH.write_text(
        json.dumps(chapters, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    total_sections = sum(len(ch["sections"]) for ch in chapters.values())
    total_chars = sum(
        len(ch["intro"]) + sum(len(s["text"]) for s in ch["sections"].values())
        for ch in chapters.values()
    )
    print(f"{OUTPUT_PATH} を生成しました（章{len(chapters)}・節{total_sections}・{total_chars}文字）")


if __name__ == "__main__":
    main()
