#!/usr/bin/env python3
"""不動産鑑定士試験過去問ダウンロードスクリプト（国土交通省公式サイト）"""

import os
import time
import urllib.request
from pathlib import Path

BASE_URL = "https://www.mlit.go.jp"
OUTPUT_DIR = Path.home() / "sandbox" / "pwa" / "不動産鑑定士試験_過去問"

# 科目名の短縮マッピング
SUBJECT_MAP = {
    "不動産に関する行政法規": "行政法規",
    "不動産の鑑定評価に関する理論": "鑑定評価理論",
    "不動産の鑑定評価に関する理論（演習）": "鑑定評価理論（演習）",
    "民法": "民法",
    "経済学": "経済学",
    "会計学": "会計学",
    "出題の趣旨": "出題の趣旨",
}

# 国土交通省公式サイトの全PDF一覧
# 形式: (年度, 試験種別, 科目, 資料種別, 相対パス)
PDF_LIST = [
    # 令和8年（短答式のみ）
    ("令和8年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/002001126.pdf"),
    ("令和8年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/002001133.pdf"),
    ("令和8年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/002001128.pdf"),
    ("令和8年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/002001127.pdf"),
    ("令和8年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/002001131.pdf"),
    ("令和8年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/002001129.pdf"),
    # 令和7年
    ("令和7年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/001889650.pdf"),
    ("令和7年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/001889652.pdf"),
    ("令和7年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/001889653.pdf"),
    ("令和7年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001889654.pdf"),
    ("令和7年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/001889655.pdf"),
    ("令和7年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001889656.pdf"),
    ("令和7年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001903958.pdf"),
    ("令和7年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001903946.pdf"),
    ("令和7年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001903959.pdf"),
    ("令和7年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001903947.pdf"),
    ("令和7年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001903960.pdf"),
    ("令和7年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001903948.pdf"),
    ("令和7年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001903961.pdf"),
    ("令和7年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001903949.pdf"),
    ("令和7年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001903962.pdf"),
    ("令和7年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001903950.pdf"),
    ("令和7年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001965381.pdf"),
    # 令和6年
    ("令和6年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/001743657.pdf"),
    ("令和6年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/001743661.pdf"),
    ("令和6年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/001743658.pdf"),
    ("令和6年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001743659.pdf"),
    ("令和6年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/001743666.pdf"),
    ("令和6年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001743660.pdf"),
    ("令和6年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001758447.pdf"),
    ("令和6年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001758453.pdf"),
    ("令和6年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001758448.pdf"),
    ("令和6年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001758454.pdf"),
    ("令和6年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001758449.pdf"),
    ("令和6年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001758456.pdf"),
    ("令和6年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001758450.pdf"),
    ("令和6年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001758457.pdf"),
    ("令和6年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001758451.pdf"),
    ("令和6年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001758458.pdf"),
    ("令和6年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001768593.pdf"),
    # 令和5年
    ("令和5年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/001610766.pdf"),
    ("令和5年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/001610767.pdf"),
    ("令和5年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/001610768.pdf"),
    ("令和5年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001610769.pdf"),
    ("令和5年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/001610771.pdf"),
    ("令和5年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001610772.pdf"),
    ("令和5年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001622926.pdf"),
    ("令和5年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001622949.pdf"),
    ("令和5年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001622927.pdf"),
    ("令和5年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001622951.pdf"),
    ("令和5年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001622928.pdf"),
    ("令和5年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001622952.pdf"),
    ("令和5年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001622945.pdf"),
    ("令和5年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001622954.pdf"),
    ("令和5年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001622947.pdf"),
    ("令和5年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001622956.pdf"),
    ("令和5年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001634677.pdf"),
    # 令和4年
    ("令和4年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/001481795.pdf"),
    ("令和4年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/001481797.pdf"),
    ("令和4年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/001481799.pdf"),
    ("令和4年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001481796.pdf"),
    ("令和4年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/001481798.pdf"),
    ("令和4年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001481800.pdf"),
    ("令和4年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001495323.pdf"),
    ("令和4年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001495342.pdf"),
    ("令和4年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001495327.pdf"),
    ("令和4年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001495345.pdf"),
    ("令和4年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001495330.pdf"),
    ("令和4年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001495348.pdf"),
    ("令和4年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001495333.pdf"),
    ("令和4年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001495390.pdf"),
    ("令和4年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001495339.pdf"),
    ("令和4年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001495355.pdf"),
    ("令和4年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001517584.pdf"),
    # 令和3年
    ("令和3年", "短答式", "行政法規", "問題", "/totikensangyo/kanteishi/content/001403778.pdf"),
    ("令和3年", "短答式", "行政法規", "正解", "/totikensangyo/kanteishi/content/001403779.pdf"),
    ("令和3年", "短答式", "行政法規", "答案用紙", "/totikensangyo/kanteishi/content/001403780.pdf"),
    ("令和3年", "短答式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001403781.pdf"),
    ("令和3年", "短答式", "鑑定評価理論", "正解", "/totikensangyo/kanteishi/content/001403782.pdf"),
    ("令和3年", "短答式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001403783.pdf"),
    ("令和3年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001419177.pdf"),
    ("令和3年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001419182.pdf"),
    ("令和3年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001419178.pdf"),
    ("令和3年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001419183.pdf"),
    ("令和3年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001419179.pdf"),
    ("令和3年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001419184.pdf"),
    ("令和3年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001419198.pdf"),
    ("令和3年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001419199.pdf"),
    ("令和3年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001419181.pdf"),
    ("令和3年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001419185.pdf"),
    ("令和3年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001429270.pdf"),
    # 令和2年（論文式のみ公開）
    ("令和2年", "論文式", "民法", "問題", "/totikensangyo/kanteishi/content/001368714.pdf"),
    ("令和2年", "論文式", "民法", "答案用紙", "/totikensangyo/kanteishi/content/001368728.pdf"),
    ("令和2年", "論文式", "経済学", "問題", "/totikensangyo/kanteishi/content/001368715.pdf"),
    ("令和2年", "論文式", "経済学", "答案用紙", "/totikensangyo/kanteishi/content/001368731.pdf"),
    ("令和2年", "論文式", "会計学", "問題", "/totikensangyo/kanteishi/content/001368717.pdf"),
    ("令和2年", "論文式", "会計学", "答案用紙", "/totikensangyo/kanteishi/content/001368733.pdf"),
    ("令和2年", "論文式", "鑑定評価理論", "問題", "/totikensangyo/kanteishi/content/001368721.pdf"),
    ("令和2年", "論文式", "鑑定評価理論", "答案用紙", "/totikensangyo/kanteishi/content/001368736.pdf"),
    ("令和2年", "論文式", "鑑定評価理論（演習）", "問題", "/totikensangyo/kanteishi/content/001368724.pdf"),
    ("令和2年", "論文式", "鑑定評価理論（演習）", "答案用紙", "/totikensangyo/kanteishi/content/001368739.pdf"),
    ("令和2年", "論文式", "出題の趣旨", "出題の趣旨", "/totikensangyo/kanteishi/content/001383567.pdf"),
]


def build_filename(subject: str, doc_type: str) -> str:
    if doc_type == "出題の趣旨":
        return "出題の趣旨.pdf"
    return f"{subject}_{doc_type}.pdf"


def download_file(url: str, dest: Path) -> bool:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; exam-downloader/1.0)"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            dest.write_bytes(response.read())
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    success = 0
    failed = 0
    skipped = 0

    for year, exam_type, subject, doc_type, path in PDF_LIST:
        folder = OUTPUT_DIR / year / exam_type
        folder.mkdir(parents=True, exist_ok=True)

        filename = build_filename(subject, doc_type)
        dest = folder / filename

        if dest.exists():
            print(f"  SKIP (already exists): {year}/{exam_type}/{filename}")
            skipped += 1
            continue

        url = BASE_URL + path
        print(f"  Downloading: {year}/{exam_type}/{filename}")
        if download_file(url, dest):
            success += 1
        else:
            failed += 1

        time.sleep(0.5)  # サーバー負荷軽減

    print(f"\n完了: 成功={success}, スキップ={skipped}, 失敗={failed}")
    print(f"保存先: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
