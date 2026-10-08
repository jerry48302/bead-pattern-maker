# 色卡来源与精度

内置的 Perler、Hama Midi、Artkal S、Artkal M 和 NABBI 30 色预设取自 [BeadColors](https://github.com/maxcleme/beadcolors) 的 `raw/*.csv`，固定在提交 `f97ff4283d03cef5cd7e1071a86f5892e0c0c61b`（2026-08-17）。原始 CSV 保存在 `src/data/beadcolors/`；其 MIT 许可见 `docs/third-party-licenses/beadcolors-LICENSE`。

这些是社区维护的色号与 RGB 参考值，**不是品牌官方实测色卡**。屏幕 RGB、实体豆、熨烫成品与打印颜色可能不同。内置 NABBI 是旧版 30 色，不代表当前 42/45 色体系。Artkal S 与 M 是不同尺寸的系列，不混用。特殊材质按名称识别，默认不参加匹配；用户可在“管理色号”中主动启用。该名称分类也需要逐项校对。

另有“小豆基础 36 色”和“灰阶 12 色”演示色卡，用于快速试用，**对应不到实际品牌货号**。若要按库存实际购买与制作，建议导入已核准的 CSV（表头 `code,name,hex`）或 JSON（`{"name":"色卡名","colors":[{"code":"A1","name":"红","hex":"#FF0000"}]}`）。导入色卡只留在当前浏览器；生成后的图纸会保存所用色卡副本及版本。

后续正式发布前需要：逐项对照品牌现行官方色卡与可购状态，明确色值来源和测量条件，并对不同批次/材质做实物抽样。已有的屏幕参考值不能作为实体精确色差承诺。
