// 訪問看護アウル v3.1 — 共通スクリプト（ナビ開閉 / ヘッダー影 / スクロール表示 / 医療処置フィルタ）
(function () {
  "use strict";
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // モバイルナビ開閉（見た目は CSS の body.is-nav-open で制御）
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    var setNav = function (open) {
      document.body.classList.toggle("is-nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    };
    setNav(false);
    toggle.addEventListener("click", function () {
      setNav(!document.body.classList.contains("is-nav-open"));
    });
    // メニュー内リンクを押したら閉じる（ページ内アンカー対策）
    nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setNav(false);
    });
    // Escape で閉じてトグルへフォーカスを戻す
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("is-nav-open")) {
        setNav(false);
        toggle.focus();
      }
    });
    // PC幅に戻ったら開閉状態をリセット
    var mq = window.matchMedia("(min-width: 901px)");
    if (mq.addEventListener) {
      mq.addEventListener("change", function (e) {
        if (e.matches) setNav(false);
      });
    }
  }

  // スクロールでヘッダーに影 + ページ進捗を細いラインで表示
  var header = document.querySelector(".header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      var scrollable = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      var progress = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
      header.style.setProperty("--scroll-progress", progress.toFixed(2) + "%");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // スクロールで .reveal をフェードイン（reduced motion では即時表示）
  var reveals = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  // 医療処置の絞り込み（service ページ。要素が無ければ何もしない）
  var chips = document.querySelectorAll("[data-filter]");
  var procs = document.querySelectorAll("[data-proc]");
  var counter = document.querySelector("[data-filter-count]");
  if (chips.length && procs.length) {
    chips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-filter");
        var shown = 0;
        chips.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        procs.forEach(function (item) {
          var show = cat === "all" || item.getAttribute("data-proc") === cat;
          item.hidden = !show;
          if (show) shown++;
        });
        if (counter) counter.textContent = shown + "件を表示中";
      });
    });
  }

  // 料金シミュレーション（price ページ。要素が無ければ何もしない）
  var sim = document.querySelector("[data-sim]");
  if (sim) {
    // 数値は令和6年度介護報酬改定（令和6年6月施行）の現行値。次期通常改定は令和9年度（2027年度）。
    // 単価は奈良市＝6級地・訪問看護（人件費割合70%）の 10.42円/単位（令和6〜8年度の地域区分）。
    // 単純化: 月4週換算・加算/減算と正式な端数処理は未反映（ページ上の注記と対応）。
    var SIM = {
      yenPerUnit: 10.42,
      weeksPerMonth: 4,
      units: {
        // 訪問看護費（訪問看護ステーションから）: 30分未満/30分〜1時間/1時間〜1時間半/PT等20分
        kaigo: { u30: 471, u60: 823, u90: 1128, pt20: 294 },
        // 介護予防訪問看護費（要支援1・2）
        yobo: { u30: 451, u60: 794, u90: 1090, pt20: 284 },
      },
      // 加算（月あたり・単位）: 緊急時訪問看護加算(I) 600（体制により(II) 574）/
      // 特別管理加算(I) 500=気管カニューレ・留置カテーテル等・(II) 250=在宅酸素・人工呼吸・人工肛門・褥瘡等 /
      // 初回加算(I) 350=退院当日訪問・(II) 300=翌日以降。
      // 緊急時・特別管理・ターミナルケア加算は区分支給限度基準額の管理対象外。
      // 初回加算は管理対象だが初月のみのため、継続月ベースの限度額目安チェックには含めない。
      addons: {
        kinkyu1: 600,
        tokubetsu: { t1: 500, t2: 250 },
        shokai: { s1: 350, s2: 300 },
      },
      // 区分支給限度基準額（1か月・単位）
      limits: { ys1: 5032, ys2: 10531, yk1: 16765, yk2: 19705, yk3: 27048, yk4: 30938, yk5: 36217 },
      limitLabels: {
        ys1: "要支援1", ys2: "要支援2", yk1: "要介護1", yk2: "要介護2",
        yk3: "要介護3", yk4: "要介護4", yk5: "要介護5",
      },
    };

    // 医療保険（訪問看護療養費・令和8年度改定＝令和8年6月施行の額。厚労省資料と2026-07-24照合）
    // 前提: 機能強化型以外 / 単一建物居住利用者20人未満（個人宅想定） / 24時間対応体制加算は届出区分イ
    // ベースアップ評価料・物価対応料等の少額項目は含まない（ページ上の注記と対応）
    // ※この SIM / IRYO は 05_tools/ryokin-simulator.html と二重管理。変更時は必ず両方を更新すること
    var IRYO = {
      basicUpTo3: 5550,   // 基本療養費(I) 週3日目まで（円/日）
      basicFrom4: 6550,   // 基本療養費(I) 週4日目以降（円/日）
      kanriFirst: 7710,   // 管理療養費 月の初日（機能強化型以外）
      kanriAfter: 3010,   // 管理療養費 2日目以降（円/日・単一建物居住利用者20人未満）
      addon24h: 6800,     // 24時間対応体制加算 イ（円/月・届出区分ロの場合は6,520円）
    };

    var numEl = sim.querySelector("[data-sim-num]");
    var announceEl = sim.querySelector("[data-sim-announce]");
    var limitEl = sim.querySelector("[data-sim-limit]");
    var bd = {
      perVisit: sim.querySelector("[data-sim-per-visit]"),
      visits: sim.querySelector("[data-sim-visits]"),
      addons: sim.querySelector("[data-sim-addons]"),
      monthly: sim.querySelector("[data-sim-monthly]"),
      burden: sim.querySelector("[data-sim-burden]"),
    };
    var firstEl = sim.querySelector("[data-sim-first]");
    var yen = function (n) { return n.toLocaleString("ja-JP"); };
    // 概算であることを表示上も明確にするため、利用者向けの合計金額は百円単位に丸める
    var roundToHundred = function (n) { return Math.round(n / 100) * 100; };
    var announceTimer = null;
    var countTimer = null;
    var shownValue = 0;

    var renderNumber = function (target) {
      if (countTimer) cancelAnimationFrame(countTimer);
      if (reduceMotion || shownValue === 0) {
        shownValue = target;
        numEl.textContent = yen(target);
        return;
      }
      // 350ms のカウントアップ
      var from = shownValue;
      var start = null;
      var tick = function (ts) {
        if (start === null) start = ts;
        var t = Math.min((ts - start) / 350, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var v = Math.round(from + (target - from) * eased);
        numEl.textContent = yen(v);
        if (t < 1) countTimer = requestAnimationFrame(tick);
        else shownValue = target;
      };
      countTimer = requestAnimationFrame(tick);
    };

    // 保険モードに応じてフォーム項目・注記の表示を切り替える
    var sectionEl = sim.closest("section");
    var syncMode = function (mode) {
      sim.querySelectorAll("[data-sim-only]").forEach(function (el) {
        el.hidden = el.getAttribute("data-sim-only") !== mode;
      });
      sectionEl.querySelectorAll("[data-sim-note]").forEach(function (el) {
        el.hidden = el.getAttribute("data-sim-note") !== mode;
      });
      // 表示中の設問に 1 から連番を振り直す（モードによって番号が飛ばないように）
      var n = 0;
      sim.querySelectorAll("fieldset").forEach(function (fs) {
        var step = fs.querySelector(".sim__step");
        if (!fs.hidden && step) step.textContent = String(++n);
      });
    };

    // 医療保険の概算（基本療養費 + 管理療養費 + 24時間対応体制加算）
    var calcIryo = function (weekly, burden) {
      var days = weekly * SIM.weeksPerMonth;
      var basicWeekly = IRYO.basicUpTo3 * Math.min(weekly, 3) + IRYO.basicFrom4 * Math.max(0, weekly - 3);
      var monthlyBasic = basicWeekly * SIM.weeksPerMonth;
      var kanri = IRYO.kanriFirst + IRYO.kanriAfter * Math.max(0, days - 1);
      var on24h = sim.querySelector("input[name='sim-iryo-24h']").checked;
      var addon = on24h ? IRYO.addon24h : 0;
      var gross = monthlyBasic + kanri + addon;
      var self = Math.round((gross * burden) / 10);

      renderNumber(roundToHundred(self));
      bd.perVisit.textContent =
        "基本療養費 " + yen(IRYO.basicUpTo3) + "円/日" + (weekly > 3 ? "（週4日目以降は" + yen(IRYO.basicFrom4) + "円/日）" : "");
      bd.visits.textContent = "週" + weekly + "回 × 4週 = 月" + days + "日";
      bd.addons.textContent =
        "管理療養費 約" + yen(kanri) + "円" + (on24h ? " ＋ 24時間対応体制加算 " + yen(IRYO.addon24h) + "円" : "");
      bd.monthly.textContent = "約" + yen(Math.round(gross)) + "円";
      bd.burden.textContent = burden + "割";

      firstEl.hidden = true;
      limitEl.hidden = true;

      if (announceTimer) clearTimeout(announceTimer);
      announceTimer = setTimeout(function () {
        announceEl.textContent = "1か月あたりの自己負担額の目安は約" + yen(roundToHundred(self)) + "円です。";
      }, 600);
    };

    var calc = function () {
      var mode = sim.querySelector("input[name='sim-insurance']:checked").value;
      syncMode(mode);
      var weekly = parseInt(sim.querySelector("input[name='sim-weekly']:checked").value, 10);
      var burden = parseInt(sim.querySelector("input[name='sim-burden']:checked").value, 10);
      if (mode === "iryo") {
        calcIryo(weekly, burden);
        return;
      }
      var care = sim.querySelector("[data-sim-care]").value;
      var time = sim.querySelector("input[name='sim-time']:checked").value;

      var isYobo = care === "ys1" || care === "ys2";
      var table = isYobo ? SIM.units.yobo : SIM.units.kaigo;
      // リハビリ職（PT等）は20分単位の報酬 × 40分想定で2回分
      var kinkyuOn = sim.querySelector("input[name='sim-kinkyu']").checked;
      var tokubetsu = sim.querySelector("[data-sim-tokubetsu]").value;
      var shokai = sim.querySelector("[data-sim-shokai]").value;

      var perVisitUnits = time === "pt40" ? table.pt20 * 2 : table[time];
      var monthlyVisits = weekly * SIM.weeksPerMonth;
      var monthlyUnits = perVisitUnits * monthlyVisits;
      // 月ごとの加算（緊急時・特別管理）。初回加算は初月のみなので別枠で扱う
      var addonUnits = (kinkyuOn ? SIM.addons.kinkyu1 : 0) + (SIM.addons.tokubetsu[tokubetsu] || 0);
      var shokaiUnits = SIM.addons.shokai[shokai] || 0;
      var totalUnits = monthlyUnits + addonUnits;
      var grossExact = totalUnits * SIM.yenPerUnit;
      var self = Math.round((grossExact * burden) / 10);
      var firstSelf = Math.round(((totalUnits + shokaiUnits) * SIM.yenPerUnit * burden) / 10);

      renderNumber(roundToHundred(self));
      bd.perVisit.textContent = perVisitUnits + "単位（約" + yen(Math.round(perVisitUnits * SIM.yenPerUnit)) + "円）";
      bd.visits.textContent = "週" + weekly + "回 × 4週 = 月" + monthlyVisits + "回";
      bd.addons.textContent = addonUnits > 0
        ? "＋" + addonUnits.toLocaleString("ja-JP") + "単位（約" + yen(Math.round(addonUnits * SIM.yenPerUnit)) + "円）"
        : "なし";
      bd.monthly.textContent = totalUnits.toLocaleString("ja-JP") + "単位（約" + yen(Math.round(grossExact)) + "円）";
      bd.burden.textContent = burden + "割";

      // 初回加算は利用開始の初月のみ算定されるため、月々の金額とは分けて表示する
      if (shokaiUnits > 0) {
        firstEl.textContent =
          "利用開始の初月のみ、初回加算（" + shokaiUnits + "単位）を含めて 約" + yen(roundToHundred(firstSelf)) + "円になります。";
        firstEl.hidden = false;
      } else {
        firstEl.hidden = true;
      }

      // 区分支給限度基準額の目安チェック（実際の上限判定はケアプラン全体で行われる）
      var limit = SIM.limits[care];
      if (limit && monthlyUnits > limit) {
        limitEl.innerHTML =
          "<b>ご注意:</b> この条件では訪問看護だけで" + SIM.limitLabels[care] +
          "の区分支給限度基準額（月" + limit.toLocaleString("ja-JP") + "単位）を上回る計算です。" +
          "限度額を超えた分は全額自己負担となる場合があります。実際の上限はケアプラン全体で判断されますので、まずはご相談ください。";
        limitEl.hidden = false;
      } else {
        limitEl.hidden = true;
      }

      // スクリーンリーダー向けの読み上げ（連続操作をまとめる）
      if (announceTimer) clearTimeout(announceTimer);
      announceTimer = setTimeout(function () {
        announceEl.textContent = "1か月あたりの自己負担額の目安は約" + yen(roundToHundred(self)) + "円です。";
      }, 600);
    };

    sim.addEventListener("change", calc);
    calc();
  }

  // ---------- フォーム（プロトタイプのデモ動作） ----------
  // 必須項目・同意チェックのネイティブ検証を通過したときだけ submit が発火する
  document.querySelectorAll("form.form").forEach(function (form) {
    form.addEventListener("submit", function () {
      var note = form.querySelector("[data-form-demo]");
      if (!note) {
        note = document.createElement("p");
        note.setAttribute("data-form-demo", "");
        note.className = "form__demo-note";
        form.appendChild(note);
      }
      note.textContent =
        "入力内容を確認しました。※プロトタイプのため送信は行われません。本公開時はこの後、確認画面に進み、送信後に自動返信メールが届く流れになります。";
      note.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  });
})();
