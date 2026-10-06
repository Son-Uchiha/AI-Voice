# 🎙️ CapCut AI Voice Studio & Python SDK

> **Hệ thống chuyển đổi văn bản thành giọng nói (Text-to-Speech) chuyên nghiệp chuẩn CapCut, đi kèm Giao diện Web Studio hiện đại (Dark Glassmorphism) và bộ SDK / CLI thuần Python.**

![Python Version](https://img.shields.io/badge/python-3.9+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Architecture](https://img.shields.io/badge/pure-python-purple.svg)

---

## 🌟 Giới Thiệu

Dự án cung cấp giải pháp toàn diện để tạo giọng đọc AI từ văn bản:
1. **Web Studio (`server.py` + `web/`)**: Giao diện đồ họa trực quan trên trình duyệt, hỗ trợ nghe thử giọng, tinh chỉnh tốc độ, tạo và tải file MP3 về máy chỉ với 1 click.
2. **Kho giọng đọc phong phú**: Hỗ trợ đầy đủ giọng Việt Nam (VN), Hoa Kỳ (en-US) và quốc tế (129 giọng trong `Voice.json`).
3. **Động cơ Hybrid thông minh**: Kết hợp CapCut Cloud TTS và Microsoft Edge-TTS (dành cho các giọng Neural nổi tiếng như *Nam Minh*, *Hoài My*).
4. **Core SDK & CLI (`capcut_tts_api`)**: Thư viện Python và công cụ dòng lệnh độc lập, không phụ thuộc C++ hay binary ngoài, mã hóa RSA PKCS#1 v1.5 và AWS SigV4 thuần Python.

---

## 🚀 Hướng Dẫn Chạy Nhanh Dự Án (Web Studio)

### 1. Yêu cầu hệ thống
- **Python**: Phiên bản 3.9 trở lên (đã cài đặt và thêm vào PATH).
- **Hệ điều hành**: Windows, macOS, hoặc Linux.

### 2. Cài đặt thư viện phụ thuộc
Mở terminal tại thư mục dự án và chạy:

```bash
# Cài đặt thư viện bắt buộc
pip install requests

# (Khuyên dùng) Cài đặt edge-tts để hỗ trợ thêm các giọng Neural như Nam Minh, Hoài My
pip install edge-tts
```

*(Hoặc cài đặt chế độ phát triển package: `pip install -e .`)*

### 3. Khởi chạy máy chủ Web
Chạy lệnh sau:

```bash
python server.py 7860
```

- Mặc định server chạy tại cổng `7860`. Bạn có thể đổi cổng bằng cách truyền số cổng khác, ví dụ: `python server.py 8080`.
- Mở trình duyệt web và truy cập vào địa chỉ:
  👉 **`http://127.0.0.1:7860`**

---

## 🖥️ Các Tính Năng Trên Web Studio

| Tính năng | Mô tả chi tiết |
| :--- | :--- |
| 🇻🇳 **Bộ lọc Giọng Việt Nam & Hoa Kỳ** | Phân loại rõ ràng giọng đọc theo quốc gia (Việt Nam, Hoa Kỳ - US, Quốc tế) và phong cách (Giọng Nữ, Giọng Nam, Review phim, Bản tin, Hiệu ứng). |
| 🔊 **Nghe thử giọng mẫu (Voice Preview)** | Cho phép nghe thử 1 câu mẫu ngắn của từng giọng đọc trước khi quyết định tạo file văn bản dài. |
| ⚡ **Tốc độ đọc linh hoạt (Rate)** | Tùy chỉnh tốc độ từ `0.5x` đến `2.0x` bằng thanh trượt hoặc các nút chọn nhanh (`0.8x`, `1.0x`, `1.2x`, `1.5x`). |
| ✍️ **Mẫu văn bản nhanh & Tiện ích** | Tích hợp sẵn mẫu Lời chào, Review phim, Bản tin, Tiếng Anh US, cùng các nút Dán (Paste) và Xóa nhanh. |
| 🎧 **Trình phát Audio tích hợp** | Trình phát HTML5 kèm hiệu ứng sóng âm (soundwave), thanh tua thời gian (scrubber), điều chỉnh âm lượng. |
| ⬇️ **Tải trực tiếp MP3** | Nút tải file MP3 chất lượng cao về máy tính ngay lập tức. |
| 🕒 **Lịch sử thu âm (History)** | Tự động lưu lại các bản thu, hỗ trợ nghe lại, tải lại, xóa từng bản thu hoặc xóa sạch toàn bộ lịch sử. |

---

## 📦 Sử Dụng Bằng Python SDK (Dành cho Developer)

Bạn có thể import trực tiếp thư viện `capcut_tts_api` vào bất kỳ dự án Python nào:

### 1. Tạo giọng nói (TTS)
```python
from capcut_tts_api import CapCutClient

client = CapCutClient()

# Chỉ cần truyền voice_type, SDK tự động đối soát resource_id tương ứng
result = client.generate_speech(
    texts="Xin chào bạn! Chúc bạn một ngày tràn đầy năng lượng.",
    voice="BV421_vivn_streaming",  # Giọng "Nhỏ Ngọt Ngào"
    rate="1.0",
    wait=True
)

print("Kết quả:", result)
```

### 2. Tra cứu danh mục giọng đọc
```python
from capcut_tts_api import CapCutClient

client = CapCutClient()
vn_voices = client.list_voices(lang="vi-VN")

for v in vn_voices:
    print(f"- {v.display_name} ({v.voice_type}) -> Resource ID: {v.resource_id}")
```

### 3. Nhận diện giọng nói thành văn bản (STT)
```python
from capcut_tts_api import CapCutClient

client = CapCutClient()

# Tải file âm thanh lên và trích xuất phụ đề tự động
res = client.transcribe_file(
    file_path="sample.mp3",
    language="vi-VN",
    wait=True
)

subtitles = client.extract_subtitles(res)
print("Văn bản trích xuất:", subtitles.full_text)
```

---

## ⌨️ Sử Dụng Bằng Dòng Lệnh (CLI)

Sau khi cài đặt package (`pip install -e .`), bạn có thể gọi lệnh trực tiếp từ Terminal:

```bash
# 1. Liệt kê các giọng đọc Tiếng Việt
capcut-tts-api list-voices --language vi-VN

# 2. Tạo tác vụ TTS từ dòng lệnh
capcut-tts-api tts-new --text "Chào mừng bạn đến với CapCut API" --voice "BV421_vivn_streaming"

# 3. Chuyển đổi audio sang phụ đề (STT)
capcut-tts-api stt-file --audio-file audio.mp3 --language vi-VN --out sub.json
```

---

## 📁 Cấu Trúc Thư Mục

```text
capcut-tts-api/
├── .gitignore                   # Loại bỏ file rác, cache và build tạm
├── README.md                    # Tài liệu hướng dẫn sử dụng
├── Voice.json                   # Danh mục 129 giọng đọc chính thức
├── pyproject.toml               # Cấu hình package Python
├── device.json.example          # Cấu hình mẫu Device ID (nếu cần tùy biến thiết bị)
├── server.py                    # Máy chủ Web Studio (Pure Python HTTP & REST API)
├── capcut_tts_api/              # Thư viện Core SDK
│   ├── client.py                # CapCutClient chính
│   ├── signer.py                # Ký chữ ký RSA & SigV4
│   ├── models.py                # Định nghĩa cấu trúc dữ liệu
│   ├── uploader.py              # Xử lý upload VOD đa phần
│   ├── cli.py                   # Giao diện dòng lệnh CLI
│   └── exceptions.py            # Quản lý lỗi
├── examples/                    # Các file script ví dụ mẫu
└── web/                         # Giao diện người dùng Web Studio
    ├── index.html               # Cấu trúc HTML5
    └── static/
        ├── css/style.css        # Giao diện Dark Mode & Glassmorphism
        └── js/app.js            # Logic xử lý Frontend & tương tác API
```

---

## ❓ Câu Hỏi Thường Gặp & Khắc Phục Sự Cố

**1. Giọng Nam Minh hoặc Hoài My không phát được?**
- Hai giọng này là giọng Neural của Microsoft (`vi-VN-NamMinhNeural`, `vi-VN-HoaiMyNeural`). Hãy đảm bảo bạn đã cài đặt `pip install edge-tts`. Máy chủ sẽ tự động kích hoạt engine tương ứng.

**2. Đổi cổng chạy máy chủ như thế nào?**
- Chạy lệnh `python server.py <PORT_NUMBER>`, ví dụ: `python server.py 9000`.

**3. File MP3 xuất ra được lưu ở đâu?**
- Tất cả các file âm thanh và bản nghe thử sẽ được lưu tự động trong thư mục `outputs/`. Bạn có thể tải trực tiếp trên giao diện web hoặc vào thư mục `outputs/` để lấy file.

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát hành theo giấy phép **MIT License**. Vui lòng sử dụng công cụ có trách nhiệm và tuân thủ các quy định của nhà cung cấp dịch vụ.
