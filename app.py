import os
import json
import pdfplumber
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

openai_key = os.getenv("OPENAI_KEY")
client = OpenAI(api_key=openai_key) if openai_key else None

# ── helpers ───────────────────────────────────────────────────────────────────

def extract_pdf_text(file_storage) -> str:
    with pdfplumber.open(file_storage) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def extract_txt_text(file_storage) -> str:
    return file_storage.read().decode("utf-8", errors="ignore").strip()


def analyze_with_openai(cv_text: str, requirements: str) -> dict:
    if not client:
        raise ValueError("OpenAI client not initialized")

    system_prompt = """You are an expert HR analyst. Analyze the candidate's CV against the job requirements and return ONLY a valid JSON object (no markdown, no explanation) with this exact structure. VERY IMPORTANT: ALL text values (summary, strengths, weaknesses, reasoning) MUST BE TRANSLATED TO SPANISH.
{
  "name": "candidate name or 'Unknown'",
  "decision": "CALIFICA" or "NO CALIFICA",
  "score": number 0-100,
  "summary": "resumen de una oración en español",
  "strengths": ["fortaleza 1 en español", "fortaleza 2 en español", "fortaleza 3 en español"],
  "weaknesses": ["debilidad 1 en español", "debilidad 2 en español"],
  "reasoning": "párrafo detallado en español explicando la decisión"
}"""

    user_prompt = f"JOB REQUIREMENTS:\n{requirements}\n\nCANDIDATE CV:\n{cv_text}"

    message = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-nano"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"}
    )

    raw = message.choices[0].message.content
    return json.loads(raw)


# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/load-requirements", methods=["POST"])
def load_requirements():
    file = request.files.get("file")
    if not file or not file.filename.endswith(".txt"):
        return jsonify({"error": "Please upload a valid .txt file."}), 400
    try:
        text = extract_txt_text(file)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze", methods=["POST"])
def analyze():
    resume_file = request.files.get("resume")
    requirements = request.form.get("requirements", "").strip()

    if not resume_file:
        return jsonify({"error": "No resume file provided."}), 400
    if not requirements:
        return jsonify({"error": "No job requirements provided. Upload a .txt first."}), 400
    if not resume_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Resume must be a PDF file."}), 400

    try:
        cv_text = extract_pdf_text(resume_file)
        if not cv_text:
            return jsonify({"error": "Could not extract text from PDF. Make sure it is not a scanned image."}), 400

        result = analyze_with_openai(cv_text, requirements)
        result["filename"] = resume_file.filename
        return jsonify(result)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
