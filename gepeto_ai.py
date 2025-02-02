import json
import sys
import os
import requests

def analyze_repo(repo_path, api_key, ai_provider):
    try:
        # Baca semua file di repositori (hanya file teks)
        repo_content = ""
        for root, dirs, files in os.walk(repo_path):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        repo_content += f"File: {file_path}\n"
                        repo_content += f.read() + "\n\n"
                except UnicodeDecodeError:
                    # Abaikan file biner
                    continue

        # Panggil API Gemini
        if ai_provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {
                "Content-Type": "application/json"
            }
            data = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": f"Analisis repositori berikut dan buat skrip Pinokio berdasarkan dokumentasi Pinokio:\n\n{repo_content}"
                            }
                        ]
                    }
                ]
            }
            response = requests.post(url, headers=headers, json=data)
            if response.status_code == 200:
                ai_response = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            elif response.status_code == 429:
                print("❌ Kuota API Gemini habis. Menggunakan OpenAI sebagai fallback.", file=sys.stderr)
                ai_provider = "openai"  # Ganti ke OpenAI
            else:
                raise Exception(f"Gagal memanggil API Gemini: {response.status_code} - {response.text}")

        # Jika Gemini gagal, gunakan OpenAI
        if ai_provider == "openai":
            import openai
            openai.api_key = api_key
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "user", "content": f"Analisis repositori berikut dan buat skrip Pinokio berdasarkan dokumentasi Pinokio:\n\n{repo_content}"}
                ],
                temperature=0.7,
                max_tokens=1000,
                top_p=1
            )
            ai_response = response.choices[0].message['content']

        # Proses hasil AI
        output = {
            "install_script": "pip install -r requirements.txt",  # Contoh default
            "start_script": "python app.py",  # Contoh default
            "pinokio_script": ai_response  # Skrip Pinokio yang dihasilkan oleh AI
        }
        return json.dumps(output)

    except Exception as e:
        print(f"❌ Gagal menganalisis repositori: {e}", file=sys.stderr)
        return json.dumps({})

if __name__ == "__main__":
    repo_path = sys.argv[1]  # Path ke repositori
    api_key = sys.argv[2]   # API key
    ai_provider = sys.argv[3]  # Provider AI
    result = analyze_repo(repo_path, api_key, ai_provider)
    print(result)  # Output JSON