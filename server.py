#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CapCut AI Voice Studio - Full-stack Web Server
Backend HTTP server providing REST API for CapCut TTS and serving modern Frontend.
Pure Python - Uses standard library http.server + requests.
"""

import os
import sys
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
import json
import time
import uuid
import mimetypes
from pathlib import Path
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs
import requests

from capcut_tts_api import CapCutClient
from capcut_tts_api.exceptions import CapCutError

# Paths
BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
STATIC_DIR = WEB_DIR / "static"
OUTPUT_DIR = BASE_DIR / "outputs"
PREVIEW_DIR = OUTPUT_DIR / "previews"
VOICE_JSON_PATH = BASE_DIR / "Voice.json"
HISTORY_FILE = OUTPUT_DIR / "history.json"

# Ensure output directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

# Shared CapCut client
client = CapCutClient()

# Edge-TTS Integration for Neural voices (Nam Minh, Hoài My, Jenny, etc.)
try:
    import asyncio
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

def synthesize_edge_tts(text, voice_type, rate_str, output_path):
    try:
        rate_float = float(rate_str)
        rate_pct = int(round((rate_float - 1.0) * 100))
        edge_rate = f"{rate_pct:+d}%"
    except Exception:
        edge_rate = "+0%"

    async def _run():
        communicate = edge_tts.Communicate(text, voice_type, rate=edge_rate)
        await communicate.save(str(output_path))

    asyncio.run(_run())

# History persistence
def load_history():
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history_list):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history_list[:50], f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Warning] Failed to save history: {e}")

# Load and enrich voices from Voice.json
def get_categorized_voices():
    if not VOICE_JSON_PATH.exists():
        return {"vn": [], "us": [], "all": []}
    
    with open(VOICE_JSON_PATH, "r", encoding="utf-8") as f:
        raw_voices = json.load(f)

    vn_voices = []
    us_voices = []
    other_voices = []

    for v in raw_voices:
        lang = v.get("lang", "")
        v_type = v.get("voice_type", "")
        display = v.get("display_name", "")
        res_id = v.get("resource_id", "")

        # Infer tag / gender
        lower_type = v_type.lower()
        lower_name = display.lower()
        
        tag = "Tự nhiên"
        gender = "neutral"

        # 1. Hiệu ứng / Nhân vật đặc biệt
        if "robot" in lower_name or "demon" in lower_type or "méo" in lower_name or "ghostface" in lower_type or "santa" in lower_type or "trickster" in lower_type:
            gender = "special"
            tag = "Hiệu ứng"
        # 2. Giọng Nữ: Luôn kiểm tra 'female' TRƯỚC để tránh bị nhầm với 'male' (vì chữ 'female' chứa chữ 'male')
        elif "female" in lower_type or "hoaimy" in lower_type or "jenny" in lower_type or "nữ" in lower_name or "gái" in lower_name or "cô" in lower_name or "mai" in lower_name or "huong" in lower_type or "richgirl" in lower_type or "xinwenjieshuo" in lower_type:
            gender = "female"
            if "review" in lower_name or "richgirl" in lower_type or "daqi" in lower_type or "stokie" in lower_type or "xyf" in lower_type:
                tag = "Review phim"
            elif "bản tin" in lower_name or "news" in lower_type or "quanwei" in lower_type or "sisi" in lower_type or "xinwenjieshuo" in lower_type:
                tag = "Bản tin"
            elif "hoaimy" in lower_type:
                tag = "Hoài My (Neural)"
            elif "jenny" in lower_type:
                tag = "Jenny (Neural)"
            elif "dsp" in lower_type:
                tag = "Giọng Bé"
            else:
                tag = "Giọng Nữ"
        # 3. Giọng Nam: An toàn kiểm tra sau khi đã loại trừ toàn bộ giọng nữ
        elif "namminh" in lower_type or "nam minh" in lower_name or "felipe" in lower_type or "nam trầm" in lower_name or "thanh niên" in lower_name or "alex" in lower_name or "deadpool" in lower_type or "male" in lower_type or "nam" in lower_name:
            gender = "male"
            if "namminh" in lower_type:
                tag = "Nam Minh (Neural)"
            elif "felipe" in lower_type:
                tag = "Giọng Nam Trầm"
            elif "thanh niên" in lower_name:
                tag = "Thanh Niên Tự Tin"
            elif "alex" in lower_name:
                tag = "Alex Đại Đế"
            else:
                tag = "Giọng Nam"
        else:
            gender = "neutral"
            tag = "Tự nhiên"

        item = {
            "voice_type": v_type,
            "display_name": display,
            "resource_id": res_id,
            "lang": lang,
            "gender": gender,
            "tag": tag
        }

        if lang == "vi-VN":
            vn_voices.append(item)
        elif lang == "en-US":
            us_voices.append(item)
        else:
            other_voices.append(item)

    return {
        "vn": vn_voices,
        "us": us_voices,
        "other": other_voices,
        "all": vn_voices + us_voices + other_voices
    }

CACHED_VOICES = get_categorized_voices()

def find_speech_url_and_duration(res):
    """Find speech_url and duration from task result payload."""
    for task in res.get("data", {}).get("tasks", []):
        payload = task.get("payload")
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        subtitles = (payload or {}).get("audio_subtitles", [])
        for item in subtitles:
            if item.get("speech_url"):
                return item["speech_url"], item.get("duration", 0)
    return None, 0

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class StudioHTTPHandler(SimpleHTTPRequestHandler):
    """Custom request handler with REST API and byte-range audio streaming."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format, *args):
        # Clean console log
        sys.stdout.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")
        sys.stdout.flush()

    def send_json(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: Get voices
        if path == "/api/voices":
            self.send_json({"success": True, "data": CACHED_VOICES})
            return

        # API: Get history
        if path == "/api/history":
            history = load_history()
            self.send_json({"success": True, "data": history})
            return

        # Stream generated MP3 files from outputs/
        if path.startswith("/outputs/"):
            rel_path = path[len("/outputs/"):].lstrip("/\\")
            file_path = OUTPUT_DIR / rel_path
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "File not found")
                return
            self.serve_media_file(file_path, "audio/mpeg")
            return

        # Route root to index.html
        if path in ("", "/"):
            index_path = WEB_DIR / "index.html"
            if index_path.exists():
                self.serve_static_file(index_path, "text/html; charset=utf-8")
                return

        # Serve static assets
        if path.startswith("/static/"):
            rel_path = path[len("/static/"):]
            file_path = STATIC_DIR / rel_path
            if file_path.exists() and file_path.is_file():
                mime, _ = mimetypes.guess_type(str(file_path))
                if not mime:
                    mime = "application/octet-stream"
                if mime.startswith("text/") or mime == "application/javascript":
                    mime += "; charset=utf-8"
                self.serve_static_file(file_path, mime)
                return

        # Fallback to standard handler
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/preview":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_json({"success": False, "error": "Thiếu dữ liệu"}, 400)
                return

            try:
                body_bytes = self.rfile.read(content_length)
                req_data = json.loads(body_bytes.decode("utf-8"))
            except Exception as e:
                self.send_json({"success": False, "error": f"JSON không hợp lệ: {str(e)}"}, 400)
                return

            voice = req_data.get("voice", "").strip()
            if not voice:
                self.send_json({"success": False, "error": "Vui lòng chọn giọng đọc"}, 400)
                return

            voice_info = None
            for v in CACHED_VOICES["all"]:
                if v["voice_type"] == voice:
                    voice_info = v
                    break

            lang = voice_info.get("lang", "vi-VN") if voice_info else "vi-VN"
            display_name = voice_info.get("display_name", voice) if voice_info else voice

            clean_voice = "".join(c for c in voice if c.isalnum() or c in ("_", "-"))
            preview_filename = f"preview_{clean_voice}.mp3"
            preview_file_path = PREVIEW_DIR / preview_filename
            preview_url = f"/outputs/previews/{preview_filename}"

            if preview_file_path.exists() and preview_file_path.stat().st_size > 1000:
                self.send_json({
                    "success": True,
                    "audio_url": preview_url,
                    "cached": True,
                    "voice": voice,
                    "voice_name": display_name
                })
                return

            if lang == "vi-VN":
                sample_text = "Xin chào, đây là giọng đọc thử nghiệm trên CapCut."
            elif lang == "en-US":
                sample_text = "Hello, this is a sample preview of my voice."
            else:
                sample_text = "Xin chào, đây là giọng đọc thử nghiệm."

            try:
                if "neural" in voice.lower() and HAS_EDGE_TTS:
                    synthesize_edge_tts(sample_text, voice, "1.0", preview_file_path)
                else:
                    res = client.generate_speech(texts=sample_text, voice=voice, rate="1.0", wait=True)
                    speech_url, _ = find_speech_url_and_duration(res)
                    if not speech_url:
                        self.send_json({"success": False, "error": "Không lấy được link âm thanh xem trước"}, 500)
                        return
                    audio_resp = requests.get(speech_url, timeout=30)
                    audio_resp.raise_for_status()
                    with open(preview_file_path, "wb") as f:
                        f.write(audio_resp.content)

                self.send_json({
                    "success": True,
                    "audio_url": preview_url,
                    "cached": False,
                    "voice": voice,
                    "voice_name": display_name
                })
            except Exception as e:
                self.send_json({"success": False, "error": f"Lỗi tạo bản nghe thử: {str(e)}"}, 500)
            return

        if path == "/api/tts":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_json({"success": False, "error": "Dữ liệu yêu cầu rỗng"}, 400)
                return

            try:
                body_bytes = self.rfile.read(content_length)
                req_data = json.loads(body_bytes.decode("utf-8"))
            except Exception as e:
                self.send_json({"success": False, "error": f"JSON không hợp lệ: {str(e)}"}, 400)
                return

            text = req_data.get("text", "").strip()
            voice = req_data.get("voice", "BV421_vivn_streaming")
            rate = str(req_data.get("rate", "1.0"))

            if not text:
                self.send_json({"success": False, "error": "Vui lòng nhập văn bản cần đọc"}, 400)
                return

            # Lookup voice display name
            display_name = voice
            for v in CACHED_VOICES["all"]:
                if v["voice_type"] == voice:
                    display_name = v["display_name"]
                    break

            timestamp = int(time.time())
            uid = uuid.uuid4().hex[:8]
            filename = f"tts_{timestamp}_{uid}.mp3"
            file_path = OUTPUT_DIR / filename
            duration_ms = 0

            try:
                # 1. Edge-TTS Neural Voice (Nam Minh, Hoài My, Jenny, etc.)
                if "neural" in voice.lower() and HAS_EDGE_TTS:
                    synthesize_edge_tts(text, voice, rate, file_path)
                # 2. CapCut Cloud TTS Engine
                else:
                    res = client.generate_speech(texts=text, voice=voice, rate=rate, wait=True)
                    speech_url, duration_ms = find_speech_url_and_duration(res)

                    if not speech_url:
                        self.send_json({
                            "success": False,
                            "error": "CapCut không trả về đường dẫn âm thanh.",
                            "debug": res
                        }, 500)
                        return

                    audio_resp = requests.get(speech_url, timeout=60)
                    audio_resp.raise_for_status()
                    with open(file_path, "wb") as f:
                        f.write(audio_resp.content)

                file_size = os.path.getsize(file_path) if file_path.exists() else 0
                audio_url = f"/outputs/{filename}"

                # Save to history
                item = {
                    "id": uid,
                    "filename": filename,
                    "audio_url": audio_url,
                    "text": text,
                    "voice": voice,
                    "voice_name": display_name,
                    "rate": rate,
                    "duration_ms": duration_ms,
                    "file_size": file_size,
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                history = load_history()
                history.insert(0, item)
                save_history(history)

                self.send_json({
                    "success": True,
                    "audio_url": audio_url,
                    "filename": filename,
                    "text": text,
                    "voice": voice,
                    "voice_name": display_name,
                    "rate": rate,
                    "duration_ms": duration_ms,
                    "file_size": file_size
                })

            except CapCutError as ce:
                err_str = str(ce)
                if "TTSInvalidSpeaker" in err_str:
                    friendly_err = f"Giọng '{display_name}' hiện không được CapCut hỗ trợ. Vui lòng chọn giọng khác (ví dụ: Giọng Nam Trầm, Thanh Niên Tự Tin, Nhỏ Ngọt Ngào...)"
                else:
                    friendly_err = f"Lỗi CapCut API: {err_str}"
                self.send_json({"success": False, "error": friendly_err}, 500)
            except Exception as ex:
                self.send_json({"success": False, "error": f"Lỗi tạo giọng {display_name}: {str(ex)}"}, 500)
            return

        if path == "/api/history/delete":
            content_length = int(self.headers.get("Content-Length", 0))
            item_id = ""
            if content_length > 0:
                try:
                    req_data = json.loads(self.rfile.read(content_length).decode("utf-8"))
                    item_id = req_data.get("id", "")
                except Exception:
                    pass
            if not item_id:
                self.send_json({"success": False, "error": "Thiếu ID bản ghi"}, 400)
                return

            history = load_history()
            new_history = []
            for item in history:
                if item.get("id") == item_id:
                    filename = item.get("filename")
                    if filename:
                        fpath = OUTPUT_DIR / filename
                        if fpath.exists():
                            try:
                                fpath.unlink()
                            except Exception:
                                pass
                else:
                    new_history.append(item)
            save_history(new_history)
            self.send_json({"success": True})
            return

        if path == "/api/history/clear":
            history = load_history()
            for item in history:
                filename = item.get("filename")
                if filename:
                    fpath = OUTPUT_DIR / filename
                    if fpath.exists():
                        try:
                            fpath.unlink()
                        except Exception:
                            pass
            save_history([])
            self.send_json({"success": True})
            return

        self.send_error(404, "Endpoint not found")

    def serve_static_file(self, file_path, content_type):
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def serve_media_file(self, file_path, content_type):
        """Serve audio file with Range support for HTML5 seekable playback."""
        try:
            file_size = os.path.getsize(file_path)
            range_header = self.headers.get("Range")

            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            is_download = "download" in query or query.get("dl", ["0"])[0] == "1"
            disposition = "attachment" if is_download else "inline"

            if range_header and not is_download:
                # Format: bytes=start-end
                range_match = range_header.strip().replace("bytes=", "").split("-")
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
                end = min(end, file_size - 1)
                length = end - start + 1

                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                with open(file_path, "rb") as f:
                    f.seek(start)
                    self.wfile.write(f.read(length))
            else:
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/octet-stream" if is_download else content_type)
                self.send_header("Content-Length", str(file_size))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Expose-Headers", "Content-Disposition")
                self.send_header("Content-Disposition", f'{disposition}; filename="{file_path.name}"')
                self.end_headers()

                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            self.send_error(500, f"Error streaming audio: {e}")

def run_server(host="127.0.0.1", port=7860):
    server_address = (host, port)
    httpd = ThreadedHTTPServer(server_address, StudioHTTPHandler)
    url = f"http://{host}:{port}"
    print("=" * 65)
    print("  🎙️  CapCut AI Voice Studio - Web Application")
    print(f"  👉  Truy cập ngay tại: {url}")
    print(f"  🇻🇳  Giọng Việt Nam: {len(CACHED_VOICES['vn'])} giọng")
    print(f"  🇺🇸  Giọng Hoa Kỳ (US): {len(CACHED_VOICES['us'])} giọng")
    print("  🛑  Nhấn Ctrl + C để dừng máy chủ")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Đang dừng máy chủ...")
        httpd.server_close()

if __name__ == "__main__":
    port = 7860
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port=port)
