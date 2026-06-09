FROM python:3.12-slim

# Install Node.js to compile the React frontend inside the container
RUN apt-get update && apt-get install -y curl \
    && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY . .

# Compile the React frontend
RUN cd react-frontend && npm install && npm run build

# Expose port 7860 (Hugging Face standard)
EXPOSE 7860

CMD ["uvicorn", "web_app:app", "--host", "0.0.0.0", "--port", "7860"]