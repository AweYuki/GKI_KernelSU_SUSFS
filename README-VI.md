<div align="center">

# GKI KernelSU SUSFS
### 🏮 2026 🐎 Happy New Year! 🏮

**Tự động hóa Build Kernel GKI | Tích hợp AweYukiSU + SUSFS**

[![Release](https://img.shields.io/github/v/release/AweYuki/GKI_KernelSU_SUSFS?label=Release&style=flat-square&logo=github&logoColor=white&color=2ea44f)](https://github.com/AweYuki/GKI_KernelSU_SUSFS/releases)
[![Coolapk](https://img.shields.io/badge/Follow-Coolapk-3DDC84?style=flat-square&logo=android&logoColor=white)](http://www.coolapk.com/u/11253396)
[![AweYukiSU](https://img.shields.io/badge/AweYukiSU-Supported-5AA300?style=flat-square)](https://github.com/AweYuki/AweYukiSU)
[![SUSFS](https://img.shields.io/badge/SUSFS-Integrated-E67E22?style=flat-square)](https://gitlab.com/simonpunk/susfs4ksu)

[**English**](README.md) | Tiếng Việt | [**简体中文**](README-ZH.md)

---

</div>

## 🚀 Điều hướng nhanh

- 📖 [Tài liệu](https://github.com/AweYuki/GKI_KernelSU_SUSFS/wiki)
- 📥 [Tải xuống](https://github.com/AweYuki/GKI_KernelSU_SUSFS/releases)
- 🔰 [Hướng dẫn](https://aweyuki.github.io/GKI_KernelSU_SUSFS/guide.html)

---

## Cập nhật gần đây

1. Dọn dẹp dung lượng ổ đĩa chạy song song giữa các workflow, giúp tăng tốc độ build tổng thể
2. Khắc phục lỗi xác suất thất bại khi tải mã nguồn kernel, kho lưu trữ (repo) và công cụ
3. Đồng bộ bản cập nhật SUSFS từ upstream, bổ sung tương thích cho các phiên bản GKI chưa được hỗ trợ
4. Làm mới phong cách giao diện Web UI
5. Các bản Release nay tải lên kèm bản vá SUSFS, tương ứng với **`50_add_susfs_in_gki-<phiên bản kernel>.patch` và các tệp khác từ upstream** (ngoại trừ `10_enable_susfs_for_ksu.patch` do đã được tích hợp sẵn trong AweYukiSU). Có thể dùng thay thế trực tiếp mà không gây lỗi từ phía SUSFS. Nếu không tự build kernel thì không cần đến tệp này; thông thường bạn chỉ cần thiết lập AweYukiSU trong thư mục mã nguồn rồi áp dụng bản vá này là có thể thực thi script build hoặc lệnh bash ngay, rút gọn được nhiều bước
6. Bổ sung **metamodule gắn kết NoMount** (tùy chọn bật/tắt khi build): tích hợp [maxsteeel/NoMount](https://github.com/maxsteeel/nomount) vào tầng `fs/` của kernel, cung cấp giải pháp gắn kết module không cần điểm mount truyền thống, có thể cùng tồn tại với AweYukiSU và SUSFS. Sau khi bật, bạn cần tự flash thêm module NoMount đi kèm để sử dụng
7. Bổ sung **Tăng cường mạng** (tùy chọn bật/tắt khi build, mặc định tắt): BBRv3 và các cải tiến tính năng mạng khác
8. Tích hợp đầy đủ **bộ bản vá & sửa lỗi tương thích từ WildKernels** (tùy chọn bật/tắt khi build + tự động xử lý theo sublevel): **USB Arsenal** ([ravindu644/USB-Arsenal](https://github.com/ravindu644/USB-Arsenal)), **GKI Ptrace (`< 5.16`)**, **Tối ưu hiệu năng & điện năng** (`WildKernels/kernel_patches/common`), **Bỏ qua kiểm tra lệch phiên bản module**, **NTSync độc lập** (kèm bản vá lockdep cho 5.10), dự phòng STG `min_kdp` Samsung 6.6 và gỡ giới hạn protected modules trên Bazel

## Tích hợp AweYukiSU

Toàn bộ các workflow build hiện chỉ tích hợp duy nhất [**AweYukiSU**](https://github.com/AweYuki/AweYukiSU) (fork từ BakaSU), kết hợp cùng SUSFS Inline Hooks và Magic Mount. Mã phiên bản được tính theo công thức `30700 + số commit nhánh main`.

## ⚠️ Lưu ý tương thích

> **Lưu ý:** Hiện tại chưa hỗ trợ OnePlus ColorOS 14/15; sau khi flash có thể cần xóa dữ liệu (format data) để khởi động vào máy.

---

## 📚 Tài liệu & Hướng dẫn

Để xem hướng dẫn chi tiết, vui lòng tham khảo [**GitHub Wiki (song ngữ Trung/Anh)**](https://github.com/AweYuki/GKI_KernelSU_SUSFS/wiki)

Nội dung Wiki bao gồm:
- [**🔰 Hướng dẫn**](https://aweyuki.github.io/GKI_KernelSU_SUSFS/guide.html)
- 📥 Tải xuống / Flash kernel
- 💡 Mẹo sử dụng (Tips)
- 🆘 Hướng dẫn cứu máy (Unbrick / xử lý Bootloop)
- 📊 Bảng tương thích phiên bản Kernel
- 🧩 [**Tài liệu tính năng nâng cao**](docs/advanced-features-vi.md): Bản vá bảo mật GhostLock, hỗ trợ container Droidspaces, ghim commit tùy chỉnh, giả mạo `/proc/config.gz`

---

## 🛠️ Đề xuất sau khi cài đặt

### 📦 Module đề xuất

<table>
<tr>
<th>Tên Module</th>
<th>Kho lưu trữ</th>
<th>Kênh</th>
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

### 🔧 Module Xposed

| Module | Mô tả |
|:---:|:---|
| **FuseFixer** | [Module sửa lỗi ký tự Unicode độ rộng bằng không (zero-width)](https://t.me/real5ec1cff/268) |

### Ứng dụng

| Tên | Mô tả |
|:---:|:---|
| **Scene** | [Trang chủ](https://omarea.com/#/) |
---

<div align="center">

**Nhiều nội dung khác đang tiếp tục được cập nhật...**

⭐ Nếu dự án này hữu ích với bạn, hãy tặng một Star để ủng hộ nhé!

</div>
