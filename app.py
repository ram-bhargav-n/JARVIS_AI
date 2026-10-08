import os
import json
import socket
from pathlib import Path

import ollama
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv(override=True)
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Personal AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL", "llama3.2:3b").strip() or "llama3.2:3b"


def call_ollama(messages: list[dict]) -> str:
    response = ollama.chat(
        model=get_ollama_model(),
        messages=messages,
        stream=False,
        options={
            "temperature": 0.25,
            "num_predict": int(os.getenv("OLLAMA_MAX_TOKENS", "350")),
        },
    )
    content = response.get("message", {}).get("content", "")
    return content.strip() if content else "I am ready to help you."

class ChatMessage(BaseModel):
    role: str
    content: str


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)


class DeviceAuthRequest(BaseModel):
    device_id: str
    approved: bool


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)
    system_prompt: str | None = None


DEVICE_REGISTRY = {
    "laptop": {
        "id": "laptop",
        "name": "Personal Laptop",
        "type": "Windows PC",
        "online": True,
        "last_seen": "Just now",
        "capabilities": ["Files", "Terminal", "Projects", "Notifications"],
        "approved": True,
    },
    "phone": {
        "id": "phone",
        "name": "Android Phone",
        "type": "Mobile",
        "online": True,
        "last_seen": "2 minutes ago",
        "capabilities": ["Messages", "Calls", "Media", "Location"],
        "approved": False,
    },
    "tablet": {
        "id": "tablet",
        "name": "Tablet",
        "type": "Tablet",
        "online": False,
        "last_seen": "30 minutes ago",
        "capabilities": ["Read-only access", "Notes", "Files"],
        "approved": True,
    },
}


def get_host() -> str:
    return os.getenv("HOST", "0.0.0.0")


def get_port() -> int:
    try:
        return int(os.getenv("PORT", "8000"))
    except ValueError:
        return 8000


def get_provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama").lower()


def get_model() -> str:
    return get_ollama_model()


def get_local_network_addresses() -> list[str]:
    addresses: list[str] = []
    seen: set[str] = set()

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip and ip not in seen and not ip.startswith("127."):
                addresses.append(ip)
                seen.add(ip)
    except OSError:
        pass

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        local_ip = sock.getsockname()[0]
        sock.close()
        if local_ip and local_ip not in seen and not local_ip.startswith("127."):
            addresses.append(local_ip)
            seen.add(local_ip)
    except OSError:
        pass

    if not addresses:
        return ["127.0.0.1"]
    return addresses


def get_network_urls() -> list[str]:
    port = get_port()
    return [f"http://{ip}:{port}" for ip in get_local_network_addresses()]


def build_demo_response(message: str) -> str:
    cleaned = message.strip()
    return (
        "I am in local Ollama mode right now. "
        f"Your message was: '{cleaned}'. "
        "Please make sure the Ollama model is installed locally for real AI responses."
    )


def get_assistant_name() -> str:
    return os.getenv("LOCAL_ASSISTANT_NAME", "Jarvis").strip() or "Jarvis"


def build_system_prompt(custom_prompt: str | None) -> str:
    assistant_name = get_assistant_name()
    default_prompt = (
        f"You are {assistant_name}, the user's personal AI operating assistant. "
        "Be calm, concise, helpful, and professional. Address the user naturally and respectfully. "
        "Keep answers short, direct, and useful. "
        f"Use the current conversation context and respond to commands like 'Hey {assistant_name}', 'check my email', 'summarize my day', 'what am I working on', and 'how can you help me'. "
        f"When the user says '{assistant_name}' or 'Hey {assistant_name}', treat it as a wake-up command and respond with a helpful greeting and a quick question like 'How can I help you today? What have you been working on recently?' "
        "If a task is risky or sensitive, ask for confirmation first. "
        "Do not reveal secrets, API keys, passwords, or tokens."
    )
    return custom_prompt or default_prompt


def build_chat_messages(payload: ChatRequest) -> list[dict]:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")

    messages = [{"role": "system", "content": build_system_prompt(payload.system_prompt)}]
    messages.extend(
        {"role": item.role, "content": item.content}
        for item in payload.history
        if item.role in {"user", "assistant"} and item.content
    )
    messages.append({"role": "user", "content": message})
    return messages


def stream_chat_events(messages: list[dict], provider: str, message: str):
    try:
        if provider in {"ollama", "local", "demo"}:
            chunks = ollama.chat(
                model=get_ollama_model(),
                messages=messages,
                stream=True,
                options={"temperature": 0.25, "num_predict": int(os.getenv("OLLAMA_MAX_TOKENS", "350"))},
            )
            for chunk in chunks:
                token = chunk.message.content or ""
                if token:
                    yield json.dumps({"token": token}, ensure_ascii=False) + "\n"
        else:
            yield json.dumps({"token": build_demo_response(message)}, ensure_ascii=False) + "\n"
        yield '{"done":true}\n'
    except Exception as exc:  # pragma: no cover
        yield json.dumps({"error": f"Assistant failed: {exc}"}, ensure_ascii=False) + "\n"


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "provider": get_provider(),
        "model": get_model(),
        "host": get_host(),
        "port": get_port(),
        "network_urls": get_network_urls(),
    }


@app.get("/api/network")
async def network() -> dict:
    return {
        "host": get_host(),
        "port": get_port(),
        "urls": get_network_urls(),
    }


@app.get("/api/devices")
async def devices() -> dict:
    return {"devices": list(DEVICE_REGISTRY.values())}


@app.post("/api/login")
async def login(payload: LoginRequest):
    email = payload.email.strip()
    password = payload.password.strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password is too short.")

    return {
        "status": "authorized",
        "user": email.split("@", 1)[0].title(),
        "message": "JARVIS is ready to assist you.",
    }


@app.post("/api/devices/authorize")
async def authorize_device(payload: DeviceAuthRequest):
    if payload.device_id not in DEVICE_REGISTRY:
        raise HTTPException(status_code=404, detail="Device not found.")

    DEVICE_REGISTRY[payload.device_id]["approved"] = payload.approved
    return {
        "status": "updated",
        "device": DEVICE_REGISTRY[payload.device_id],
    }


@app.get("/")
async def index() -> FileResponse:
    response = FileResponse(BASE_DIR / "static" / "assistant.html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")

    system_prompt = build_system_prompt(payload.system_prompt)
    messages = [{"role": "system", "content": system_prompt}]

    for item in payload.history:
        if item.role in {"user", "assistant"} and item.content:
            messages.append({"role": item.role, "content": item.content})

    messages.append({"role": "user", "content": message})

    provider = get_provider()
    try:
        if provider in {"ollama", "local", "demo"}:
            reply = call_ollama(messages)
        else:
            reply = build_demo_response(message)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Assistant failed: {str(exc)}") from exc

    return {"reply": reply}


@app.post("/api/chat/stream")
async def chat_stream(payload: ChatRequest):
    messages = build_chat_messages(payload)
    message = payload.message.strip()
    return StreamingResponse(
        stream_chat_events(messages, get_provider(), message),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=get_host(), port=get_port(), reload=True)
