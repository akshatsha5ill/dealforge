from fastapi import FastAPI, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from dealforge.core.lead_capture import LeadCaptureService
from dealforge.storage.leads import SQLiteLeadStore
from dealforge.config import DealForgeConfig
import os

app = FastAPI(title="DealForge")

def get_lead_capture_service():
    db_path = os.environ.get("DEALFORGE__STORAGE__PATH")
    if db_path:
        store = SQLiteLeadStore(db_path)
    else:
        config = DealForgeConfig.load()
        store = SQLiteLeadStore(config.storage.path)
    return LeadCaptureService(store)

@app.get("/capture/{token}", response_class=HTMLResponse)
async def get_capture_form(token: str, service: LeadCaptureService = Depends(get_lead_capture_service)):
    lead = await service.get_lead_by_token(token)
    if not lead:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    html_content = f"""
    <html>
        <head>
            <title>DealForge - Access Document</title>
            <style>
                body {{ font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }}
                .form-group {{ margin-bottom: 15px; }}
                label {{ display: block; margin-bottom: 5px; }}
                input[type="text"], input[type="email"] {{ width: 100%; padding: 8px; }}
                button {{ padding: 10px 15px; background-color: #007bff; color: white; border: none; cursor: pointer; }}
            </style>
        </head>
        <body>
            <h2>Unlock Document</h2>
            <p>Please provide your details to access the full document.</p>
            <form action="/capture/{token}" method="post">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="consent" value="true">
                        I agree to receive communications.
                    </label>
                </div>
                <button type="submit">Access Document</button>
            </form>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.post("/capture/{token}")
async def submit_capture_form(
    token: str,
    name: str = Form(...),
    email: str = Form(...),
    consent: bool = Form(False),
    service: LeadCaptureService = Depends(get_lead_capture_service)
):
    doc_url = await service.capture_lead(token, name, email, consent)
    if not doc_url:
        raise HTTPException(status_code=404, detail="Invalid token")

    html_content = f"""
    <html>
        <head>
            <title>DealForge - Success</title>
            <style>
                body {{ font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; text-align: center; }}
                .success {{ color: green; font-size: 24px; margin-bottom: 20px; }}
                a.button {{ padding: 10px 15px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="success">✓ Lead Captured!</div>
            <p>Thank you, {name}. You can now access your document.</p>
            <p><a href="{doc_url}" class="button">Download Document</a></p>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)
