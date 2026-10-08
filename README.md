# Personal AI Assistant

This project creates a simple personal assistant with a browser chat interface and voice input/output support. It runs locally and sends requests to an AI API provider when configured.

## Features

- Chat interface in the browser
- Microphone input using speech recognition
- Text-to-speech output for assistant replies
- Personalized voice profile with assistant name, voice, rate, and pitch settings
- Local backend using FastAPI
- Optional OpenAI-powered responses with environment configuration
- Demo mode available when no API key is configured
- Access from phones, tablets, and other devices on the same Wi-Fi network

## Quick start

1. Open a terminal in this project folder.
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate it:
   - Windows PowerShell:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - Windows CMD:
     ```cmd
     .\.venv\Scripts\activate.bat
     ```
4. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
5. Copy the example environment file and set your key:
   ```bash
   copy .env.example .env
   ```
   Then edit `.env` and set:
   ```env
   OPENAI_API_KEY=your_key_here
   OPENAI_MODEL=gpt-4o-mini
   LLM_PROVIDER=openai
   ```
6. Start the app:
   ```bash
   python app.py
   ```
7. Open in your browser:
   ```text
   http://127.0.0.1:8000/
   ```
8. To reach it from other devices on the same network, use your computer's local IP, for example:
   ```text
   http://192.168.1.25:8000/
   ```
   The app is configured to bind to `0.0.0.0`, which allows access from other devices on the same Wi-Fi or LAN.

## Notes

- If no OpenAI key is configured, the app runs in demo mode.
- The browser will still load the assistant UI, but responses are generated from a built-in template instead of a real model.
- For real AI responses, add your OpenAI API key to `.env`.
- The personalized voice is configured in the browser using the system speech voices on your device. This lets you choose a voice matching your style without needing a cloned custom AI voice model.
- If the app is not visible from another device, check the firewall and make sure both devices are on the same network.

## Project structure

- `app.py` - FastAPI backend
- `static/index.html` - web chat interface
- `.env.example` - example environment variables
- `requirements.txt` - Python dependencies

## Customization ideas

- Add memory or saved notes
- Connect Gmail, calendar, or to-do tools
- Add command execution tools with approval prompts
- Add login and user profiles
- Add more voice and automation features
