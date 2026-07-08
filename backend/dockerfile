# Use the official lightweight Python image
FROM python:3.13-slim

# Set the working directory inside the container
WORKDIR /app

# Copy only requirements first to leverage Docker caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Expose the port your Flask/FastAPI app runs on (usually 5000 or 8000)
EXPOSE 5000

# Command to run the application
CMD ["python", "app.py"]
