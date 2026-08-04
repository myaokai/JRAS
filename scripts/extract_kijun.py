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
FUSOKU_RE = re.compile(r"^附[ \t]*則(（.*）)?$")

# 段落の頭とみなす列記・見出しマーカー群。本文中の言及と誤認しないよう、
# いずれも行頭かつ直後に十分な空白またはマーカー自身で完結する形のみに限定する。
PARA_MARKER_PATTERNS = [
    re.compile(r"^（[０-９0-9]+）"),  # （１）（２）
    re.compile(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+[ \t]"),  # Ⅰ Ⅱ …
    re.compile(r"^[０-９0-9]+．"),  # １．２．
    re.compile(r"^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]"),  # ①②…
    re.compile(r"^（[ア-ンァ-ヶ]）"),  # （ア）（イ）
    re.compile(r"^[ア-ンァ-ヶ]{1,2}[ \t]{2,}"),  # ア    イ    （箇条書きの片仮名）
    re.compile(r"^[Ａ-Ｚａ-ｚA-Za-z]{1,3}[ \t]*[：:]"),  # Ｐ：ａ：Ｒ： （数式の記号説明）
]


def is_para_marker(line: str) -> bool:
    return any(p.match(line) for p in PARA_MARKER_PATTERNS)


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

        if is_para_marker(stripped):
            flush_para()
            current_para_lines.append(stripped)
            continue

        current_para_lines.append(stripped)

    flush_bucket()
    return chapters


# 分数・数式はPDF上で図形的に組まれており、テキストとして正しく抽出できないため、
# 分数の数式や表はPDF上で図形的に組まれていたり、縦書きの見出しセルが行ごとに
# 分断されたりして、レイアウト保持のテキスト抽出では正しく再現できない。
# また、ページの版面の都合で文の途中に空行が挟まり、段落が分断される箇所もある。
# これらは該当箇所のみ手動で正しい内容に置き換える。
# 各エントリ: (開始段落の先頭一致文字列, 終了段落の先頭一致文字列, 置き換え後の段落リスト)
TEXT_FIXES: dict[tuple[str, str], list[tuple[str, str, list[str]]]] = {
    ("7", "1"): [
        # 直接還元法の数式（分数がテキストとして抽出できず「P=」のみ残っていた）
        ("P=", "P=", ["P = a ÷ R"]),
        # ＤＣＦ法の数式（分子・分母の位置関係が崩れて文字列が混在していた）
        (
            "a         PP=            +(1 + Y)   (1 + Y)",
            "a         PP=            +(1 + Y)   (1 + Y)",
            ["P = Σ（ａk ÷ (1+Y)^k）＋ PR ÷ (1+Y)^n　　※Σはk=1〜nの合計"],
        ),
        # 復帰価格の数式
        ("P =", "P =", ["PR = a(n+1) ÷ Rn"]),
    ],
    ("9", "2"): [
        # ページ境界で「しなければ」「ならない。」に分断されていた文を結合
        (
            "４．試算価格又は試算賃料の調整に関する事項",
            "ならない。",
            [
                "４．試算価格又は試算賃料の調整に関する事項試算価格又は試算賃料の再吟味"
                "及び説得力に係る判断の結果を記載しなければならない。",
            ],
        ),
    ],
    ("10", "1"): [
        # ページ境界で「でき」「る。」に分断されていた文を結合
        (
            "２．建付地建付地は、建物等と結合して有機的にその効用を発揮しているため",
            "る。",
            [
                "２．建付地建付地は、建物等と結合して有機的にその効用を発揮しているため、"
                "建物等と密接な関連を持つものであり、したがって、建付地の鑑定評価は、建"
                "物等と一体として継続使用することが合理的である場合において、その敷地"
                "（建物等に係る敷地利用権原のほか、地役権等の使用収益を制約する権利が付"
                "着している場合にはその状態を所与とする。）について部分鑑定評価をするも"
                "のである。建付地の鑑定評価額は、更地の価格をもとに当該建付地の更地とし"
                "ての最有効使用との格差、更地化の難易の程度等敷地と建物等との関連性を考"
                "慮して求めた価格を標準とし、配分法に基づく比準価格及び土地残余法による"
                "収益価格を比較考量して決定するものとする。ただし、建物及びその敷地とし"
                "ての価格（以下「複合不動産価格」という。）をもとに敷地に帰属する額を配"
                "分して求めた価格を標準として決定することもできる。",
            ],
        ),
    ],
    ("12", "5"): [
        # ＤＣＦ法の収益費用項目の表（縦書きの見出しセル「運営収益」「運営費用」が
        # 行ごとに文字分断され、各行の項目名・定義も改行位置でずれていた）
        (
            "項    目",
            "純収益",
            [
                "【運営収益】",
                "貸室賃料収入：対象不動産の全部又は貸室部分について賃貸又は運営委託をす"
                "ることにより経常的に得られる収入（満室想定）",
                "共益費収入：対象不動産の維持管理・運営において経常的に要する費用（電気"
                "・水道・ガス・地域冷暖房熱源等に要する費用を含む）のうち、共用部分に係"
                "るものとして賃借人との契約により徴収する収入（満室想定）",
                "水道光熱費収入：対象不動産の運営において電気・水道・ガス・地域冷暖房熱"
                "源等に要する費用のうち、貸室部分に係るものとして賃借人との契約により徴"
                "収する収入（満室想定）",
                "駐車場収入：対象不動産に附属する駐車場をテナント等に賃貸することによっ"
                "て得られる収入及び駐車場を時間貸しすることによって得られる収入",
                "その他収入：その他看板、アンテナ、自動販売機等の施設設置料、礼金・更新"
                "料等の返還を要しない一時金等の収入",
                "空室等損失：各収入について空室や入替期間等の発生予測に基づく減少分",
                "貸倒れ損失：各収入について貸倒れの発生予測に基づく減少分",
                "【運営費用】",
                "維持管理費：建物・設備管理、保安警備、清掃等対象不動産の維持・管理のた"
                "めに経常的に要する費用",
                "水道光熱費：対象不動産の運営において電気・水道・ガス・地域冷暖房熱源等"
                "に要する費用",
                "修繕費：対象不動産に係る建物、設備等の修理、改良等のために支出した金額"
                "のうち当該建物、設備等の通常の維持管理のため、又は一部がき損した建物、"
                "設備等につきその原状を回復するために経常的に要する費用",
                "プロパティマネジメントフィー：対象不動産の管理業務に係る経費",
                "テナント募集費用等：新規テナントの募集に際して行われる仲介業務や広告宣"
                "伝等に要する費用及びテナントの賃貸借契約の更新や再契約業務に要する費用等",
                "公租公課：固定資産税(土地・建物・償却資産)、都市計画税(土地・建物)",
                "損害保険料：対象不動産及び附属設備に係る火災保険、対象不動産の欠陥や管"
                "理上の事故による第三者等の損害を担保する賠償責任保険等の料金",
                "その他費用：その他支払地代、道路占用使用料等の費用",
                "運営純収益：運営収益から運営費用を控除して得た額",
                "一時金の運用益：預り金的性格を有する保証金等の運用益",
                "資本的支出：対象不動産に係る建物、設備等の修理、改良等のために支出した"
                "金額のうち当該建物、設備等の価値を高め、又はその耐久性を増すこととなる"
                "と認められる部分に対応する支出",
                "純収益：運営純収益に一時金の運用益を加算し資本的支出を控除した額",
            ],
        ),
    ],
}


def apply_text_fixes(chapters: dict) -> None:
    for (chapter_id, section_id), fixes in TEXT_FIXES.items():
        entry = chapters[chapter_id]["sections"][section_id]
        paragraphs = entry["text"].split("\n\n")
        for start_prefix, end_prefix, replacement in fixes:
            # 単一段落の置き換え（start==end）は、置き換え後の文字列が別の
            # ルールのprefixと偶然一致してしまうのを避けるため、完全一致で探す。
            exact = start_prefix == end_prefix
            match = (lambda p, s: p == s) if exact else (lambda p, s: p.startswith(s))

            start_idx = next(
                (i for i, p in enumerate(paragraphs) if match(p, start_prefix)), None
            )
            if start_idx is None:
                raise SystemExit(
                    f"置き換え対象の開始位置が見つかりません（{chapter_id}章{section_id}節): "
                    f"{start_prefix!r}\nPDFの抽出結果が変わった可能性があります。TEXT_FIXESを見直してください。"
                )
            end_idx = next(
                (
                    i
                    for i in range(start_idx, len(paragraphs))
                    if match(paragraphs[i], end_prefix)
                ),
                None,
            )
            if end_idx is None:
                raise SystemExit(
                    f"置き換え対象の終了位置が見つかりません（{chapter_id}章{section_id}節): "
                    f"{end_prefix!r}\nPDFの抽出結果が変わった可能性があります。TEXT_FIXESを見直してください。"
                )
            paragraphs[start_idx : end_idx + 1] = replacement
        entry["text"] = "\n\n".join(paragraphs)


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

    apply_text_fixes(chapters)

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
