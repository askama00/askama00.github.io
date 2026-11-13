# 第三方脚本说明

本目录存放从外部引入、未经本地改写的 JS 依赖。所有文件均在源码中保留了原始许可声明，
并在此处集中登记。

| 文件 | 版本 | 许可 | 版权 | 用途 |
|---|---|---|---|---|
| `solarlunar.min.js` | 3.1.0 | ISC | © 2015 yize · <https://github.com/yize/solarlunar> | 首页日历的公历 ↔ 农历转换、二十四节气、干支纪年 |

## 关于 `solarlunar`

- 来源：npm 包 `solarlunar@3.1.0` 的 `dist/solarlunar.min.js`，仅删除了末尾的 `sourceMappingURL` 注释行（避免浏览器请求一个不存在的 `.map` 文件），其余内容未改动。
- 上游为 UMD 封装，挂载到 `window.solarLunar` 的 `.default` 属性上；站内 `js/calendar.js` 里做了一层取值兼容，不直接依赖这个细节。
- ISC 许可允许自由使用、修改与再分发，要求保留版权声明 —— `LICENSE.solarlunar.txt` 即为其原文。
