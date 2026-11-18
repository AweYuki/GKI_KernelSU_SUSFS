<div align="center">

# GKI KernelSU SUSFS
### 🏮 2026 🐎 Happy New Year! 🏮

**自动化构建 GKI 内核 | 集成 AweYukiSU + SUSFS**

[![Release](https://img.shields.io/github/v/release/AweYuki/GKI_KernelSU_SUSFS?label=Release&style=flat-square&logo=github&logoColor=white&color=2ea44f)](https://github.com/AweYuki/GKI_KernelSU_SUSFS/releases)
[![Coolapk](https://img.shields.io/badge/Follow-Coolapk-3DDC84?style=flat-square&logo=android&logoColor=white)](http://www.coolapk.com/u/11253396)
[![AweYukiSU](https://img.shields.io/badge/AweYukiSU-Supported-5AA300?style=flat-square)](https://github.com/AweYuki/AweYukiSU)
[![SUSFS](https://img.shields.io/badge/SUSFS-Integrated-E67E22?style=flat-square)](https://gitlab.com/simonpunk/susfs4ksu)

[**English**](README.md) | [**Tiếng Việt**](README-VI.md) | 简体中文

---

</div>

## 🚀 快速导航

- 📖 [文档](https://github.com/AweYuki/GKI_KernelSU_SUSFS/wiki)
- 📥 [下载](https://github.com/AweYuki/GKI_KernelSU_SUSFS/releases)
- 🔰 [教程](https://aweyuki.github.io/GKI_KernelSU_SUSFS/guide.html)

---

## 最近更新

1. 并行工作流磁盘清理，增加整体速度
2. 修复拉取源码、仓库、工具概率失败的问题
3. 同步上游SUSFS更新，兼容不被支持的GKI版本
4. 翻新网页UI风格
5. RELEASE 新上传 SUSFS补丁，对应 **上游的 `50_add_susfs_in_gki-内核版本.patch`和其他文件**（除了 `10_enable_susfs_for_ksu.patch`，它已被 AweYukiSU 内置），可替代使用，不会产生SUSFS侧的报错，不会构建内核则不需要；通常在源码目录拉取 AweYukiSU 然后执行本补丁，就可运行构建脚本或 bash 命令进行了，省略很多步骤
6. 新增 **NoMount 挂载元模块**（构建时可选开关）：在内核 `fs/` 层集成 [maxsteeel/NoMount](https://github.com/maxsteeel/nomount)，提供无需传统挂载点的模块挂载方案，可与 AweYukiSU 及 SUSFS 共存。开启后需自行刷入配套的 NoMount 模块使用
7. 新增 **网络增强**（构建时可选开关，默认关闭）：BBRv3 等网络功能增强
8. 同步集成上游 **WildKernels 补丁套件与兼容性修复**（构建时可选开关 + 子版本自动适配）：**USB Arsenal**（[ravindu644/USB-Arsenal](https://github.com/ravindu644/USB-Arsenal)）、**GKI Ptrace（`< 5.16`）**、**性能与功耗优化补丁集**（`WildKernels/kernel_patches/common`）、**跳过内核模块版本校验**、独立 **NTSync**（含 5.10 lockdep 前置补丁）、三星 6.6 `min_kdp` STG 回退注入以及 Bazel 受保护模块限制解除

## AweYukiSU 集成说明

全部构建工作流现仅支持并集成 [**AweYukiSU**](https://github.com/AweYuki/AweYukiSU)（基于 BakaSU Fork），搭配 SUSFS Inline Hooks 与 Magic Mount，版本号按 `30700 + main 提交数` 计算。

## ⚠️ 兼容性提醒

> **注意：** 目前不支持一加 ColorOS 14、15，刷入后可能需要清除数据开机。



---

## 📚 文档与指南

详细说明请查阅 [**GitHub Wiki（中英双语）**](https://github.com/AweYuki/GKI_KernelSU_SUSFS/wiki)

Wiki 涵盖内容：
- [**🔰 教程**](https://aweyuki.github.io/GKI_KernelSU_SUSFS/guide.html)
- 📥 下载/刷入内核
- 💡 使用技巧 Tips
- 🆘 救砖指南
- 📊 内核版本兼容性说明
- 🧩 [**进阶功能文档**](docs/advanced-features-zh.md)：GhostLock 安全修复、Droidspaces 容器支持、自定义提交配置、伪装 `/proc/config.gz`

---

## 🛠️ 安装后推荐

### 📦 模块推荐

<table>
<tr>
<th>模块名称</th>
<th>仓库</th>
<th>频道</th>
</tr>
<tr>
<td><b>LSPosed-Irena</b></td>
<td><a href="https://github.com/re-zero001/LSPosed-Irena">GitHub</a></td>
<td><a href="https://t.me/lsposed_irena">Telegram</a></td>
</tr>
<tr>
<td><b>Zygisk Next</b></td>
<td><a href="https://github.com/Dr-TSNG/ZygiskNext">GitHub</a></td>
<td rowspan="2"><a href="https://t.me/real5ec1cff">Telegram</a></td>
</tr>
<tr>
<td><b>TrickyStore</b></td>
<td><a href="https://github.com/5ec1cff/TrickyStore">GitHub</a></td>
</tr>
</table>

### 🔧 Xposed 模块

| 模块 | 说明 |
|:---:|:---|
| **FuseFixer** | [Unicode零宽修复模块](https://t.me/real5ec1cff/268) |

### App

| 名称 | 说明 |
|:---:|:---|
| **Scene** | [官网](https://omarea.com/#/) |
---

<div align="center">

**更多内容持续更新中...**

⭐ 如果这个项目对你有帮助，请点个 Star 支持一下！

</div>
