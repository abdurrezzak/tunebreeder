# TuneBreeder Backend

A FastAPI backend for the TuneBreeder application, which enables collaborative musical evolution.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
Make a copy of `.env.example` as `.env` and adjust settings as needed.

5. Run the server:
```bash
uvicorn app.main:app --reload
```

## API Endpoints

### Authentication
- POST `/api/register` - Register a new user
- POST `/api/token` - Get authentication token
- GET `/api/users/me` - Get current user info

### Genomes
- GET `/api/genome/current` - Get a genome for mutation
- POST `/api/genome/{genome_id}/mutate` - Submit a genome mutation

### Melodies
- POST `/api/melody/save` - Save a melody to collection
- GET `/api/melody/saved` - Get user's saved melodies

### Admin
- POST `/api/admin/generation/next` - Create next generation
- GET `/api/admin/generations` - Get statistics about all generations

## Features

- User authentication with JWT
- Collaborative musical genome evolution
- Genome mutation and scoring
- Cross-generation breeding of top genomes
- Personal melody collection