# 小豆图纸

手机可用的拼豆图纸生成器。照片在浏览器本机处理，不上传服务器。选择格数、色卡与最大颜色数后，可比较三种效果，逐格修正，并导出 PDF、PNG、SVG、CSV。

## 当前功能

- JPG、PNG、WebP 上传；裁剪平移、缩放、90° 旋转；PNG 原有透明区域可留空。
- 12–200 格宽高、预设尺寸、最多 64 色。可按色号筛选库存，或导入 `code,name,hex` CSV / 含 `colors` 数组的 JSON。
- Web Worker 中进行 Lab/CIEDE2000 色差计算、受限色号选择、轮廓加权与孤立豆清理。清晰、均衡、照片三种模式。
- 画笔、擦除、吸管、填充、全局换色、撤销/重做；符号与单色高亮；图纸可放大编辑。
- 材料用量、29×29 分板、带符号和坐标的多页 PDF、PNG、SVG、CSV。
- IndexedDB 自动保存最近一张图纸；构建后的 Service Worker 缓存应用资源，可再次离线打开。

## 运行

需要 Node.js 22+ 和 pnpm 11。

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

构建产物在 `dist/`。本机预览：`pnpm preview`。

## GitHub Pages

仓库的 `.github/workflows/deploy.yml` 会在 `main` 分支推送后测试、构建并部署。仓库设置中进入 **Settings → Pages**，将 **Build and deployment / Source** 设为 **GitHub Actions**。项目仓库使用 `/<仓库名>/` 作为 Vite base；若部署在 `<用户名>.github.io` 根站点，请将 workflow 的 `GITHUB_PAGES_BASE` 改为 `/`。

## 色卡与效果说明

内置品牌预设来自带 MIT 许可的社区资料，并非品牌官方认证或实物测色。详见 [色卡来源](docs/palette-sources.md) 和 [算法说明](docs/algorithm.md)。色号、色数与材料数量有程序约束；“比其他生成器更好看”尚需报告建议的跨图片盲测和实物验证，本版本不作该质量承诺。

HEIC 依赖浏览器原生解码，不支持时请转 JPG。当前透明选项只保留输入图已有的透明区，不自动抠图。PDF 按 29×29 网格分板；大图纸的导出时间与文件大小会随板数增长。保存最近图纸不包含原始照片。

## 隐私与许可

生成、编辑与导出均在浏览器完成；应用不设账号、上传接口或分析追踪。代码使用 MIT 许可；内置 BeadColors 数据保留其独立 MIT 声明。
