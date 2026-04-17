FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for pdfminer and spacy
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy rest of the app
COPY . .

# HuggingFace Spaces requires port 7860
EXPOSE 7860

CMD ["python", "app.py"]
