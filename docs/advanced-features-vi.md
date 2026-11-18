<div align="center">

# 🧩 Tài liệu tính năng nâng cao

**Bản vá bảo mật GhostLock · Hỗ trợ Container Droidspaces · Ghim Commit tùy chỉnh · Giả mạo `/proc/config.gz`**

[**English**](advanced-features.md) | Tiếng Việt | [**简体中文**](advanced-features-zh.md)

[⬅ Quay lại README](../README-VI.md)

---

</div>

## Mục lục

- [🛡️ Bản vá bảo mật GhostLock](#️-bản-vá-bảo-mật-ghostlock)
- [🧪 Hỗ trợ Container Droidspaces (Thử nghiệm)](#-hỗ-trợ-container-droidspaces-thử-nghiệm)
- [🔧 Ghim Commit tùy chỉnh](#-ghim-commit-tùy-chỉnh)
- [🧪 Giả mạo `/proc/config.gz` (Stock Config)](#-giả-mạo-procconfiggz-stock-config)

---

## 🛡️ Bản vá bảo mật GhostLock

GhostLock là một cặp lỗ hổng bảo mật mức độ nghiêm trọng cao trong nhân Linux (Linux kernel), được định danh là `CVE-2026-43499` và `CVE-2026-53163`. Kẻ tấn công không cần quyền Root cũng như không cần nạp thêm module kernel. Bất kỳ ứng dụng thông thường hay tiến trình cục bộ nào có thể thực thi mã trên thiết bị đều có khả năng khai thác lỗ hổng này.

### Tác động tiềm ẩn

- **Sập hệ thống hoặc buộc khởi động lại:** Một ứng dụng thông thường có thể làm sập kernel (kernel panic), khiến thiết bị ngừng hoạt động và có nguy cơ làm mất dữ liệu chưa kịp lưu.
- **Leo thang đặc quyền cục bộ:** Một chuỗi khai thác tinh vi hơn có thể vượt qua ranh giới bảo mật của Android, trao cho ứng dụng thông thường quyền kiểm soát cấp độ kernel trên toàn bộ thiết bị.
- **Mã khai thác đã được công bố rộng rãi:** Cả mã chứng minh khai thác (PoC) gây từ chối dịch vụ lẫn chuỗi khai thác leo thang đặc quyền hoàn chỉnh nhắm vào nền tảng Android ARM64 đều đã được công khai. Rủi ro này không còn dừng lại ở mức lý thuyết.
- **Không có biện pháp khắc phục tạm thời đáng tin cậy:** Các giới hạn quyền truy cập, cơ chế cô lập ứng dụng hay tùy chọn gia cố bảo mật chỉ làm tăng độ khó khi khai thác chứ không thể ngăn chặn triệt để tình trạng sập hệ thống hoặc các biến thể khai thác khác.

Lỗ hổng này không thể bị kích hoạt trực tiếp từ xa qua mạng. Tuy nhiên, một ứng dụng độc hại, chương trình không đáng tin cậy trong môi trường dùng chung, hoặc kẻ tấn công đã chiếm được quyền thực thi mã thông qua lỗ hổng khác đều có thể dùng GhostLock làm bước tấn công tiếp theo. Vì vậy, bạn cần đặc biệt thận trọng khi cài đặt các ứng dụng, module hoặc script không rõ nguồn gốc.

Dự án này hỗ trợ kiểm tra và áp dụng bản vá đầy đủ khi build các kernel 5.10, 5.15, 6.1, 6.6 và 6.12. Tùy chọn này mặc định tắt. Để bổ sung lớp bảo vệ GhostLock, vui lòng bật thủ công tùy chọn `Apply CVE-2026-43499 rtmutex fix chain` khi khởi chạy bản build. Bản vá của cả hai lỗ hổng bắt buộc phải hiện diện đồng thời và workflow sẽ tự động xử lý việc này; những kernel đã tích hợp sẵn bản vá đầy đủ sẽ không bị vá lặp lại.

Bản vá đã vượt qua [kiểm chứng build toàn diện từ upstream trên 84 phiên bản kernel](https://github.com/zzh20188/GKI_KernelSU_SUSFS/actions/runs/29509099128). Để tìm hiểu sâu hơn về cơ chế lỗ hổng, phạm vi ảnh hưởng, các mã khai thác công khai và hướng dẫn giảm thiểu rủi ro, bạn có thể đọc bài phân tích chi tiết từ CIQ: [GhostLock Mitigation](https://kb.ciq.com/article/rocky-linux/rl-ghostlock-mitigation).

---

## 🧪 Hỗ trợ Container Droidspaces (Thử nghiệm)

> **Tính năng thử nghiệm:** Không đảm bảo mọi phiên bản GKI đều build thành công hoặc khởi động bình thường. Hãy luôn sao lưu (backup) phân vùng Boot trước khi flash.
>
> **MẸO:** Workflow sử dụng [các bản vá chính thức của Droidspaces](https://github.com/ravindu644/Droidspaces-OSS/tree/main/Documentation/resources/kernel-patches/GKI) từ kho lưu trữ [Droidspaces](https://github.com/ravindu644/Droidspaces-OSS). Nếu bạn có bản vá tốt hơn, đừng ngần ngại mở một issue. Ngoài ra, vì có ba biến thể bản vá khác nhau, bạn có thể cần thử nghiệm nhiều lần để tìm ra bản phù hợp với dòng máy của mình — hãy lựa chọn dựa trên phản hồi từ cộng đồng hoặc trải nghiệm thực tế.

[Droidspaces](https://github.com/ravindu644/Droidspaces-OSS) là công cụ container hóa Linux gọn nhẹ, cho phép chạy môi trường Linux đầy đủ (hỗ trợ systemd, OpenRC, v.v.) ngay trên Android — rất hữu ích để dựng môi trường lập trình, chạy máy chủ (server) và nhiều tác vụ khác.

**Phiên bản hỗ trợ:** 5.10 / 5.15 / 6.1 / 6.6 / 6.12

**Cách sử dụng:** Khi kích hoạt build thủ công, hãy chọn tùy chọn `Droidspaces`:

| Tùy chọn | Mô tả |
|:---:|:---|
| `off` | Tắt (mặc định) |
| `678` | Sử dụng bản vá khe 6_7_8 (khuyên dùng) |
| `123` | Sử dụng bản vá khe 1_2_3 (dự phòng) |
| `345` | Sử dụng bản vá khe 3_4_5 (dự phòng) |

> **Lưu ý:** Kernel 6.12 chỉ có duy nhất một bản vá — chọn bất kỳ tùy chọn nào khác `off` đều sẽ áp dụng bản vá đó.

**Nếu build thất bại hoặc bị treo logo (bootloop) sau khi flash:** Hãy thử chuyển sang bản vá ở khe khác (ví dụ từ `678` sang `123` hoặc `345`), vì các nhánh phụ (sub-level) kernel khác nhau có thể tương thích với bản vá khác nhau.

---

## 🔧 Ghim Commit tùy chỉnh

Bạn có thể sử dụng tệp [`config/config`](../config/config) để chỉ định SUSFS và AweYukiSU cố định ở những commit cụ thể.

**Commit là gì?**

Commit là một chuỗi mã băm (hash) đại diện cho trạng thái của kho mã nguồn tại một thời điểm nhất định. Ví dụ, đặt `aweyukisu` thành `7b65bde0710b5e7c6f755545cb15a4abd417f3a8` sẽ cố định bản build kernel ở đúng phiên bản AweYukiSU đó.

**Tại sao cần ghim commit?**

- Khi bản cập nhật mới từ upstream phát sinh lỗi (bug) hoặc vấn đề tương thích, bạn có thể quay về phiên bản ổn định trước đó
- Khi phiên bản SUSFS và AweYukiSU lệch nhịp với nhau gây lỗi biên dịch, bạn có thể tự chỉ định cặp phiên bản tương thích

**Làm thế nào để lấy mã commit hash?**

- SUSFS: [susfs4ksu](https://gitlab.com/simonpunk/susfs4ksu)
- AweYukiSU: [AweYuki/AweYukiSU commits/main](https://github.com/AweYuki/AweYukiSU/commits/main/)

Lấy SUSFS làm ví dụ: trước tiên chọn nhánh (branch), sau đó sao chép mã hash của commit tương ứng:

![Chọn nhánh](../assets/susfs_branch.png)
![Sao chép commit](../assets/susfs_commit.png)

```ini
# Bật chế độ commit tùy chỉnh
custom=true

# Mã commit hash của SUSFS cho từng nhánh
gki-android12-5.10=
gki-android13-5.15=
gki-android14-6.1=
gki-android15-6.6=
gki-android16-6.12=

# Mã commit hash của AweYukiSU
aweyukisu=
```

> Để trống = sử dụng commit mới nhất của nhánh đó.

---

## 🧪 Giả mạo `/proc/config.gz` (Stock Config)

Đây là một thủ thuật nâng cao và không cần bật công tắc nào trong workflow.  
Tiến trình build sẽ tự động kiểm tra xem tệp `config/stock_defconfig` có tồn tại hay không: nếu có sẽ tự động áp dụng, nếu không có sẽ bỏ qua.

Cách thực hiện:
1. Đảm bảo thiết bị của bạn đang chạy ROM gốc (stock ROM) + kernel gốc (stock kernel).
2. Trích xuất tệp `/proc/config.gz` từ thiết bị (có thể thao tác ngay trên điện thoại hoặc qua máy tính).
3. Giải nén tệp, đổi tên thành `stock_defconfig`, tải lên thư mục [`config/`](../config/) trong kho lưu trữ của bạn rồi commit (có thể thực hiện trực tiếp trên điện thoại).

Trong quá trình build, workflow sẽ tự động:
- Sao chép tệp vào mã nguồn kernel: `$KERNEL_ROOT/common/arch/arm64/configs/stock_defconfig`
- Trong `$KERNEL_ROOT/common/kernel/Makefile`, chuyển quy tắc `$(obj)/config_data` từ `$(KCONFIG_CONFIG)` sang `arch/arm64/configs/stock_defconfig`
- Giúp tệp `/proc/config.gz` trong bản kernel đầu ra giống sát với cấu hình kernel gốc trên máy của bạn hơn

---

<div align="center">

[⬅ Quay lại README](../README-VI.md) · [English](advanced-features.md) · [简体中文](advanced-features-zh.md)

</div>
