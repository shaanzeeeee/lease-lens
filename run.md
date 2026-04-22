# Run Commands

## Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

> API: http://127.0.0.1:8001  
> Docs: http://127.0.0.1:8001/docs

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

> App: http://localhost:5173

## Demo Login

- **Email:** admin@abelam.com
- **Password:** admin123
