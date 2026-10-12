#!/usr/bin/env python3
"""基準本文（public/kijun.json）から暗唱チェック（FR-21）の単位を public/anshou.json へ抽出する。

見出しの段落（Ⅰ／１．／（１）／①／ア で始まる短い段落）と、次の見出しまでの本文を1単位にする。
本文は基準そのものを使い、手で書き換えない。お題は見出しから作り、「意義」のような見出しには
親の見出しを付ける（例「差額配分法の意義」）。

実行: python3 scripts/extract_anshou.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIJUN_PATH = ROOT / "public" / "kijun.json"
OUTPUT_PATH = ROOT / "public" / "anshou.json"

# 見出しの階層。数字が小さいほど上位
LEVELS = [
    (0, re.compile(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[\s　]+")),
    (1, re.compile(r"^[０-９]+．[\s　]*")),
    (2, re.compile(r"^（[０-９]+）[\s　]*")),
    (3, re.compile(r"^[①-⑳][\s　]+")),
    (4, re.compile(r"^[ア-コ][\s　]+")),
]
MAX_HEADING = 40
MIN_BODY = 50
MAX_BODY = 800
# 附則は対象外
SKIP_CHAPTERS = {"13"}
# 見出しだけでは何の話かわからないもの。親の見出しを前に付ける
GENERIC_TITLES = {"意義", "意義及び適用方法", "適用方法", "留意事項", "その他"}
# 本文が「次のとおりである。」のような前置きで終わるときは、続く列記（下位の見出し）までを本文に含める
LIST_INTRO = re.compile(r"次[のに][^。]*。$")
# 本文が列記の続き（（３）…、１．…）や前の段落の補足（なお、…）、式で始まるものは、見出しの本文ではない
NOT_BODY_START = re.compile(r"^(（[０-９0-9]+）|[０-９]+．|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[\s　]|なお、|また、|P\s*=)")
# 見出しに見えるが、実際は列記の一項目（文の途中）であるもの
EXCLUDE_TITLES = {
    "次の不動産に係るものであること",
    "実地調査の一部を実施することができなかった場合にあっては、その理由",
    "土地を長期間占有し、独占的に使用収益し得る借地権者の安定的利益",
    "賃貸人等又は賃借人等の近隣地域の発展に対する寄与度",
}
# 見出しだけでは紛らわしいもののお題（(章, 節, 見出し) → お題）
TITLE_OVERRIDES = {
    ("2", "2", "宅地"): "宅地の類型",
    ("2", "2", "建物及びその敷地"): "建物及びその敷地の類型",
}


def marker_level(para: str):
    for level, pattern in LEVELS:
        if pattern.match(para):
            return level
    return None


def heading_level(para: str):
    if len(para) > MAX_HEADING or "。" in para:
        return None
    for level, pattern in LEVELS:
        m = pattern.match(para)
        if m:
            return level, re.sub(r"\s+", " ", para[m.end():]).strip()
    return None


# 列記の項目か（本文や下位の見出しを持たず、次の段落が同じか上位の項目になっている）
def is_leaf(paras: list[str], j: int) -> bool:
    level = heading_level(paras[j])[0]
    if j + 1 >= len(paras):
        return True
    nxt = marker_level(paras[j + 1])
    return nxt is not None and nxt <= level


def units_of(chapter: str, section: str, text: str):
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    stack: list[tuple[int, str]] = []
    found = []
    for i, para in enumerate(paras):
        h = heading_level(para)
        if not h:
            continue
        level, title = h
        while stack and stack[-1][0] >= level:
            stack.pop()
        parents = [t for _, t in stack]
        stack.append((level, title))

        body = []
        in_list = False
        for j in range(i + 1, len(paras)):
            h2 = heading_level(paras[j])
            if h2:
                # 前置き（「次のとおりである。」）に続く列記の項目は本文に含める。
                # 項目とみなすのは、下位の見出しで、それ自身の本文や下位の見出しを持たないもの
                in_list = in_list or bool(body and LIST_INTRO.search(body[-1]))
                if not (in_list and h2[0] > level and is_leaf(paras, j)):
                    break
            body.append(paras[j])
        found.append((parents, title, "\n\n".join(body)))
    return found


def make_unit(chapter: str, section: str, seq: int, parents: list[str], title: str, body: str, context: str):
    if (chapter, section, title) in TITLE_OVERRIDES:
        title = TITLE_OVERRIDES[(chapter, section, title)]
    elif title in GENERIC_TITLES and parents:
        title = f"{parents[-1]}の{title}"
    elif "同一需給圏" in parents:
        title = f"同一需給圏（{title}）"
    elif chapter == "3" and section in ("2", "3") and "要因" not in title:
        title = f"{title}の{'地域要因' if section == '2' else '個別的要因'}"
    elif chapter == "10" and title.endswith("場合") and parents:
        title = f"{parents[-1]}（{title}）"
    elif chapter == "10" and not re.search(r"(鑑定評価|価格|態様|地域|有効利用度)$", title):
        title = f"{title}の鑑定評価"
    # 定義（本文が「○○とは、」で始まる）と諸原則は「○○とは」と問い、それ以外は規定の内容を問う
    is_definition = body.startswith(f"{title}とは") or title.endswith("原則")
    prompt = f"{title}とは" if is_definition else f"「{title}」について基準の規定を述べよ"
    return {
        "id": f"anshou:{chapter}-{section}-{seq}",
        "chapter": int(chapter),
        "section": int(section),
        "context": " ＞ ".join([context, *parents]),
        "title": title,
        "prompt": prompt,
        "text": body,
    }


# 同じお題が複数あるときは、親の見出しを括弧で添える。それでも区別できなければ章・節を添える
def disambiguate(units: list[dict]):
    groups: dict[str, list[dict]] = {}
    for u in units:
        groups.setdefault(u["title"], []).append(u)
    for title, group in groups.items():
        if len(group) < 2:
            continue

        def parent_of(u):
            parts = u["context"].split(" ＞ ")
            parents = [p for p in parts[1:] if p not in GENERIC_TITLES]
            return parents[-1] if parents else parts[0]

        labels = [parent_of(u) for u in group]
        if len(set(labels)) < len(labels):
            labels = [u["context"].split(" ＞ ")[0] for u in group]
        for u, label in zip(group, labels):
            u["title"] = f"{title}（{label}）"
            u["prompt"] = f"「{u['title']}」について基準の規定を述べよ"


def main():
    kijun = json.loads(KIJUN_PATH.read_text(encoding="utf-8"))
    units = []
    for chapter, ch in kijun.items():
        if chapter in SKIP_CHAPTERS:
            continue
        chapter_label = " ".join(ch["title"].split(" ")[:2])
        texts = [("0", chapter_label, ch.get("intro", ""))]
        texts += [(sk, f"{chapter_label} {s['title'].split(' ')[0]}", s["text"]) for sk, s in ch["sections"].items()]
        for section, context, text in texts:
            seq = 0
            for parents, title, body in units_of(chapter, section, text):
                if title in EXCLUDE_TITLES or not (MIN_BODY <= len(body) <= MAX_BODY) or NOT_BODY_START.match(body):
                    continue
                seq += 1
                units.append(make_unit(chapter, section, seq, parents, title, body, context))

    disambiguate(units)
    OUTPUT_PATH.write_text(json.dumps({"units": units}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(units)}件を {OUTPUT_PATH.relative_to(ROOT)} に書き出しました")


if __name__ == "__main__":
    main()
