-- 学習記録の同期（docs/infrastructure.md 2節）。列の削除はせず、変更は追加のマイグレーションで行う

-- 解答ログ（追記のみ。更新・削除はしない）
CREATE TABLE answers (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT, -- サーバー側の通し番号（同期の位置として使う）
  id           TEXT NOT NULL UNIQUE,              -- 端末で採番した UUID（二重送信を防ぐ）
  user         TEXT NOT NULL,                     -- Access のメールアドレス
  question_id  TEXT NOT NULL,
  mode         TEXT NOT NULL,                     -- anaume | kakomon | anshou | card | drill | snapshot
  result       INTEGER NOT NULL,                  -- 0=不正解 1=一部 2=正解
  choice       TEXT,
  session_id   TEXT,
  answered_at  INTEGER NOT NULL,                  -- 端末で答えた時刻（UNIXミリ秒）
  device       TEXT NOT NULL,                     -- 送信元の端末ID
  payload      TEXT                               -- snapshot 用の JSON
);
CREATE INDEX answers_user_seq ON answers(user, seq);

-- 設定（試験日・1日の目標など）。後から書いた方を採用する
CREATE TABLE settings (
  user        TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,                      -- JSON
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user, key)
);
