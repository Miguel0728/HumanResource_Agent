# HumanResource Agent

Agente de Recursos Humanos impulsado por IA para análisis y comparación de candidatos.

## Descripción
Aplicación web que analiza CVs en PDF contra requisitos de puesto definidos por el reclutador. Utiliza OpenAI para evaluar fortalezas, debilidades y generar una puntuación de idoneidad del candidato.

## Stack
- **Backend**: Flask (Python)
- **Frontend**: React (CDN) + CSS puro
- **IA**: OpenAI API (`gpt-4.1-nano`)
- **PDF**: pdfplumber

## Estructura
```
RH_Bot/
├── app.py              # Servidor Flask + lógica de análisis
├── requirements.txt    # Dependencias
├── static/
│   ├── css/main.css    # Estilos
│   └── js/main.js      # UI React
└── templates/
    └── index.html      # Entry point
```

## Configuración
Crea un archivo `.env` en la raíz con:
```
OPENAI_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-4.1-nano
PORT=8000
```

## Instalación y ejecución
```bash
pip install -r requirements.txt
python app.py
```
Luego abre `http://localhost:8000`.

## Uso
1. Carga un archivo `.txt` con los requisitos del puesto.
2. Adjunta el CV en PDF del candidato.
3. Haz clic en **Analizar Candidato**.
4. Repite para comparar múltiples candidatos.
