/**
 * dsh-foxy-jumpscare — browser half.
 *
 * Every `intervalMs` (default 1000ms) a random roll is made; if it lands under
 * `probability` (default 0.001 = 1/1000), Foxy jumpscares the page: a
 * full-screen overlay shows the jumpscare frame (with a quick lunge zoom) and
 * the scream plays, then everything hides after `durationMs`.
 *
 * Config resolution, highest priority first:
 *   1. localStorage "dsh-foxy-jumpscare.config" (full JSON; re-read every tick, live)
 *   2. auto-served /plugins/dsh-foxy-jumpscare/config.json
 *   3. built-in DEFAULT_CONFIG below
 *
 * Assets are preloaded (Image + Audio) so the scare is instant; the audio is
 * "unlocked" on the first user gesture to satisfy browser autoplay policies.
 */
window.__ModuleLoader__.load({
  id: "dsh-foxy-jumpscare",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ══ 默认配置(可被 config.json / localStorage 覆盖)══
    const DEFAULT_CONFIG = {
      /** 总开关 */
      enabled: true,
      /** 每次 tick 触发的概率(0.001 = 1/1000) */
      probability: 0.001,
      /** tick 间隔(毫秒);每 intervalMs 掷一次骰子 */
      intervalMs: 1000,
      /** jumpscare 持续显示多久(毫秒) */
      durationMs: 1800,
      /** 音量 0~1 */
      volume: 1.0,
      /** 控制台诊断日志 */
      debug: false,
      /** jumpscare 图片地址(node half 自动提供) */
      imageUrl: "/plugins/dsh-foxy-jumpscare/assets/foxy-jumpscare.webp",
      /** 尖叫音效地址(node half 自动提供) */
      soundUrl: "/plugins/dsh-foxy-jumpscare/assets/foxy-scream.ogg",
    };

    const CONFIG_KEY = "dsh-foxy-jumpscare.config";
    const OVERLAY_ID = "dsh-foxy-jumpscare-overlay";

    const name = "foxy-jumpscare";
    /** 纯 DOM/定时器插件,不依赖任何 ctx 服务 */
    const inject = [];

    /** 校验配置片段:只保留类型合法的键,整体非法返回 null */
    function normalizeConfig(raw) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
      const src = raw.config !== undefined && raw.config !== null && typeof raw.config === "object"
        ? raw.config
        : raw;
      if (src === null || typeof src !== "object") return null;
      const out = {};
      if (typeof src.enabled === "boolean") out.enabled = src.enabled;
      if (typeof src.probability === "number" && isFinite(src.probability)) out.probability = Math.min(1, Math.max(0, src.probability));
      if (typeof src.intervalMs === "number" && src.intervalMs > 0) out.intervalMs = src.intervalMs;
      if (typeof src.durationMs === "number" && src.durationMs >= 0) out.durationMs = src.durationMs;
      if (typeof src.volume === "number" && isFinite(src.volume)) out.volume = Math.min(1, Math.max(0, src.volume));
      if (typeof src.debug === "boolean") out.debug = src.debug;
      if (typeof src.imageUrl === "string" && src.imageUrl.length > 0) out.imageUrl = src.imageUrl;
      if (typeof src.soundUrl === "string" && src.soundUrl.length > 0) out.soundUrl = src.soundUrl;
      return Object.keys(out).length > 0 ? out : null;
    }

    /** 浅合并到默认配置 */
    function mergeConfig(base, over) {
      if (!over) return { ...base };
      return { ...base, ...over };
    }

    function apply(ctx) {
      let config = { ...DEFAULT_CONFIG };
      const log = (...args) => {
        if (config.debug) console.log("[foxy-jumpscare]", ...args);
      };

      // 状态
      let overlay = null;
      let styleEl = null;
      let img = null;
      let audio = null;
      let timer = null;
      let hideTimer = null;
      let active = false;
      let remoteConfig = null;  // 来自 config.json(异步)
      let localOverride = null; // 来自 localStorage(最高优先级)
      let lastLocalRaw = null;  // 上次读到的 localStorage 原文,用于检测变化

      /** 注入 overlay 样式(含 lunge 缩放动画) */
      const ensureStyle = () => {
        if (styleEl !== null) return;
        styleEl = document.createElement("style");
        styleEl.id = "dsh-foxy-jumpscare-style";
        styleEl.textContent =
          "#" + OVERLAY_ID + "{" +
          "position:fixed;inset:0;z-index:2147483647;background:#000;" +
          "display:flex;align-items:center;justify-content:center;" +
          "opacity:0;visibility:hidden;pointer-events:none;" +
          "transition:opacity 60ms ease-in;" +
          "}" +
          "#" + OVERLAY_ID + ".active{opacity:1;visibility:visible;pointer-events:auto;}" +
          "#" + OVERLAY_ID + " img{" +
          "width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none;" +
          "animation:dsh-foxy-jumpscare-lunge .28s ease-out;" +
          "}" +
          "@keyframes dsh-foxy-jumpscare-lunge{" +
          "0%{transform:scale(.85)}60%{transform:scale(1.22)}100%{transform:scale(1.15)}" +
          "}";
        document.head.appendChild(styleEl);
      };

      /** 创建(懒)overlay 结构 */
      const ensureOverlay = () => {
        if (overlay !== null) return;
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.addEventListener("click", hide); // 点击可提前关掉
        img = document.createElement("img");
        img.alt = "Foxy jumpscare";
        img.src = config.imageUrl;
        overlay.appendChild(img);
        document.body.appendChild(overlay);
      };

      /** 预加载图片与音效(触发时零延迟):overlay 的 img 从启动即开始加载 */
      const preload = () => {
        ensureOverlay(); // 创建 overlay + img,img.src 立即开始加载(此时不可见)
        audio = new Audio();
        audio.preload = "auto";
        audio.src = config.soundUrl;
        audio.volume = config.volume;
      };

      /** 首次用户手势时解锁音频(满足浏览器自动播放策略) */
      const unlockAudio = () => {
        const unlock = () => {
          const was = audio ? audio.volume : config.volume;
          if (audio) audio.volume = 0;
          try {
            const p = audio ? audio.play() : null;
            if (p && p.then) p.then(() => {
              audio.pause();
              audio.currentTime = 0;
            }).catch(() => {});
          } catch (e) { /* ignore */ }
          if (audio) audio.volume = was;
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        };
        window.addEventListener("pointerdown", unlock);
        window.addEventListener("keydown", unlock);
      };

      /** 触发 jumpscare */
      const trigger = () => {
        if (!config.enabled || active) return;
        active = true;
        ensureOverlay();
        ensureStyle();
        overlay.classList.add("active");
        try {
          if (audio) {
            audio.volume = config.volume;
            audio.currentTime = 0;
            const p = audio.play();
            if (p && p.catch) p.catch(() => {});
          }
        } catch (e) { /* ignore */ }
        hideTimer = setTimeout(hide, config.durationMs);
        log("BOO! jumpscare fired");
      };

      /** 收起 jumpscare(同时停掉音效) */
      function hide() {
        if (overlay) overlay.classList.remove("active");
        try {
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
        } catch (e) { /* ignore */ }
        active = false;
        if (hideTimer !== null) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      }

      // 暴露手动触发入口,便于快速测试/排障。控制台执行:
      //   window.dshFoxyJumpscare.trigger()  -> 立刻跳杀
      //   window.dshFoxyJumpscare.hide()     -> 立刻收起
      //   window.dshFoxyJumpscare.config     -> 只读的当前配置
      window.dshFoxyJumpscare = {
        trigger,
        hide,
        get config() { return { ...config }; },
      };

      /** 每次 tick 掷一次骰子 */
      const roll = () => {
        syncLocalOverride(); // localStorage 变化(增/删/改)在下一 tick 实时生效
        if (!config.enabled || active) return;
        if (Math.random() < config.probability) trigger();
      };

      /** 计算最终生效配置:defaults <- config.json <- localStorage(最高) */
      const effectiveConfig = () => {
        let c = { ...DEFAULT_CONFIG };
        if (remoteConfig) c = mergeConfig(c, remoteConfig);
        if (localOverride) c = mergeConfig(c, localOverride);
        return c;
      };

      /** 应用新配置:重建定时器、刷新音量/图片 */
      const applyConfig = (next) => {
        config = next;
        if (audio) audio.volume = config.volume;
        if (img) img.src = config.imageUrl;
        if (timer !== null) {
          clearInterval(timer);
          timer = setInterval(roll, config.intervalMs);
        }
      };

      /** 重新读取 localStorage,变化时(增/删/改)实时应用,无需刷新 */
      const syncLocalOverride = () => {
        let raw = null;
        try { raw = localStorage.getItem(CONFIG_KEY); } catch (e) { /* ignore */ }
        if (raw === lastLocalRaw) return;
        lastLocalRaw = raw;
        let norm = null;
        if (raw !== null) {
          try { norm = normalizeConfig(JSON.parse(raw)); } catch (e) { /* ignore */ }
        }
        localOverride = norm;
        applyConfig(effectiveConfig());
        log("localStorage config synced:", raw === null ? "(removed)" : raw);
      };

      /** 异步拉取 node half 自动 serve 的 config.json */
      const loadRemoteConfig = () => {
        fetch("/plugins/dsh-foxy-jumpscare/config.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            remoteConfig = normalizeConfig(data);
            applyConfig(effectiveConfig());
            log("remote config applied");
          })
          .catch((e) => log("remote config unavailable:", e));
      };

      const start = () => {
        syncLocalOverride(); // 初始读取 localStorage(含概率/开关等)
        preload();
        ensureStyle();
        unlockAudio();
        loadRemoteConfig();
        timer = setInterval(roll, config.intervalMs);
        log("armed — probability", config.probability, "every", config.intervalMs + "ms");
      };

      if (document.body !== null) start();
      else document.addEventListener("DOMContentLoaded", start, { once: true });

      // dsh 的 ctx.effect 会「立即执行」回调,并把回调的返回值当作卸载时的清理函数。
      ctx.effect(() => {
        return () => {
          if (timer !== null) clearInterval(timer);
          if (hideTimer !== null) clearTimeout(hideTimer);
          if (overlay !== null && overlay.isConnected) overlay.remove();
          if (styleEl !== null && styleEl.isConnected) styleEl.remove();
          if (window.dshFoxyJumpscare) delete window.dshFoxyJumpscare;
          overlay = null;
          styleEl = null;
          img = null;
          audio = null;
        };
      }, "foxy-jumpscare: jumpscare timer");
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  },
});
