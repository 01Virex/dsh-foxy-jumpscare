# dsh-foxy-jumpscare

把《玩具熊的五夜后宫 2》(Five Nights at Freddy's 2)的 **Foxy(霍斯 / Withered Foxy)** 请进
DeepSeek Harness(dsh)Web 界面:每秒钟有 **1/1000** 的几率,屏幕突然被全屏 jumpscare 占据,
伴随那声标志性的尖叫,吓你一跳后自动消失。

> 素材与音效均来自 [Five Nights at Freddy's Wiki](https://freddy-fazbears-pizza.fandom.com/),
> 版权归 Scott Cawthon / Steel Wool Studios 所有。本项目是非官方同人玩具插件,详见
> [NOTICE.md](./NOTICE.md)。

## 特性

- **每秒 1/1000 几率**:每 `intervalMs`(默认 1000ms)掷一次骰子,命中概率 `probability`(默认 0.001);
- **全屏 jumpscare**:全屏黑底 + Foxy 大头,附带一个「前扑」缩放动画,`durationMs`(默认 1800ms)后自动消失;
- **尖叫音效**:随 jumpscare 同步播放,音量可调;首次点击/按键会自动「解锁」音频以绕过浏览器自动播放限制;
- **零延迟**:图片与音效启动时预加载,命中瞬间即出,不联网、不转圈;
- **开箱即用**:node half 自动注册 HTTP 路由 serve 素材与 `config.json`,无需手动部署;
- **可配置**:概率、间隔、时长、音量、开关、素材地址都能改,还能通过 localStorage 一键关闭;
- **点击关闭**:jumpscare 期间点一下屏幕即可提前关掉。

## 安装

### 方式 A:`dsh plugin` 自动安装(推荐)

本包声明了 `dsh.bundle.patch`,`dsh plugin add` 会自动把它的 patch 层并入 `dsh.profile.bundles`:

```sh
dsh plugin --profile web add github:01Virex/dsh-foxy-jumpscare
```

重启 `dsh web`,浏览器 **Ctrl+F5 硬刷新** 即可生效。

### 方式 B:手动安装

1. 把本项目放到 web profile 的 node_modules 下(默认
   `C:\Users\<你>\.dsh\profiles\web\node_modules\dsh-foxy-jumpscare\`);
2. 在 web profile 的 `cordis.patch.yml` 里插入:

   ```yaml
   - insert:
       - id: foxy-jumpscare
         name: dsh-foxy-jumpscare
   ```

3. (可选)`node gen-config.cjs` 生成本地 `config.json`;
4. 重启 `dsh web`,浏览器 Ctrl+F5 硬刷新。

## 配置

配置优先级从高到低:

1. **localStorage** 完整配置:`dsh-foxy-jumpscare.config`(粘贴 JSON,刷新生效);
2. **`config.json`**(项目根,本地个性化,被 `.gitignore` 忽略;缺省时 node half 自动回退到
   `config.example.json`);
3. **内置默认值**(见 `lib/client.js` 顶部 `DEFAULT_CONFIG`)。

配置文件格式(`config.example.json`):

```json
{
  "enabled": true,
  "probability": 0.001,
  "intervalMs": 1000,
  "durationMs": 1800,
  "volume": 1.0,
  "debug": false,
  "imageUrl": "/plugins/dsh-foxy-jumpscare/assets/foxy-jumpscare.webp",
  "soundUrl": "/plugins/dsh-foxy-jumpscare/assets/foxy-scream.ogg"
}
```

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关;`false` 彻底关掉(应急用) |
| `probability` | `0.001` | 每次 tick 触发概率(`0.001` = 1/1000) |
| `intervalMs` | `1000` | tick 间隔(毫秒) |
| `durationMs` | `1800` | jumpscare 持续时长(毫秒) |
| `volume` | `1.0` | 音量 0~1 |
| `debug` | `false` | 控制台诊断日志 |
| `imageUrl` | 见上 | jumpscare 图片地址 |
| `soundUrl` | 见上 | 尖叫音效地址 |

**应急关闭**:不想再被吓时,在浏览器控制台执行

```js
localStorage.setItem("dsh-foxy-jumpscare.config", JSON.stringify({ enabled: false }));
```

然后刷新页面即可。

## 项目结构

```
dsh-foxy-jumpscare/
├── lib/
│   ├── index.js            # node half:serve 素材与 config.json
│   └── client.js           # browser half:jumpscare 定时器 + 全屏 overlay
├── assets/
│   ├── foxy-jumpscare.webp # Withered Foxy jumpscare 画面(893×609,透明背景)
│   └── foxy-scream.ogg     # Foxy jumpscare 尖叫
├── config.example.json     # 完整配置模板(入库)
├── config.json             # 本地个性化配置(被 .gitignore 忽略)
├── gen-config.cjs          # 初始化 config.json 的脚本
├── cordis.patch.yml        # bundle patch(由 dsh.bundle.patch 自动应用)
├── package.json
├── NOTICE.md               # 素材版权归属说明
├── LICENSE                 # MIT
└── README.md
```

## 卸载

- 方式 A 安装:`dsh plugin --profile web remove dsh-foxy-jumpscare`;
- 方式 B 安装:从 `cordis.patch.yml` 删掉 `foxy-jumpscare` 那一行,并删除 node_modules 下的包目录。

之后重启 `dsh web` 即可。

## 原理

这是 dsh 的「双面(bundle + client)」插件:同一包名既是一个 bundle(通过
`dsh.bundle.patch` 在配置树里插入一行),又是一个 `dsh.client` 浏览器插件(web 运行时扫描
`dsh.client` 元数据、serve `/plugins/dsh-foxy-jumpscare/client.js` 并注入 `window.__DSH_BOOT__`)。
node 半部只负责把素材/配置送出本地 HTTP,惊吓逻辑全在浏览器半部。

## 贡献

欢迎提 Issue / PR,或直接在 `config.example.json` 里调整默认参数。改动后记得跑一次
`node scripts/package-release.cjs` 检查发布文件是否齐全。

## License

代码:[MIT](./LICENSE)。素材版权归原权利方所有,见 [NOTICE.md](./NOTICE.md)。
