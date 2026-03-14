import os
import json
import uvicorn
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import anthropic
from typing import Dict, Any, List

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def load_json(path: str, default=None):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else []

# Load mock data
projects = load_json("data/projects.json", [])
subcontractors = load_json("data/subcontractors.json", [])
historical_quotes = load_json("data/historical_quotes.json", [])
quote_responses = load_json("data/quote_responses.json", [])

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "projects": projects,
        "subcontractors": subcontractors
    })

@app.get("/project/{project_id}", response_class=HTMLResponse)
async def project_detail(request: Request, project_id: str):
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_subs = [s for s in subcontractors if any(trade in project["trades_needed"] for trade in s.get("trades", []))]
    project_quotes = [q for q in historical_quotes if q.get("project_id") == project_id]
    
    return templates.TemplateResponse("project_detail.html", {
        "request": request,
        "project": project,
        "subcontractors": project_subs,
        "quotes": project_quotes
    })

@app.post("/send-rfps")
async def send_rfps(project_id: str = Form(...), trades: str = Form(...)):
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return {"error": "Project not found"}
    
    trades_list = [t.strip() for t in trades.split(",")]
    relevant_subs = [s for s in subcontractors if any(trade.lower() in [t.lower() for t in s.get("trades", [])] for trade in trades_list)]
    
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        
        system_prompt = """You are an AI assistant helping construction project managers generate professional RFP (Request for Proposal) emails to subcontractors. 
        
        Generate personalized, professional emails that include:
        - Project details (address, timeline, scope)
        - Specific trade requirements 
        - Quote deadline
        - Professional, respectful tone appropriate for subcontractor relationships
        - Industry-standard formatting
        
        Keep emails concise but comprehensive."""
        
        emails_generated = []
        for sub in relevant_subs[:5]:  # Limit to 5 to conserve tokens
            relevant_trades = [trade for trade in trades_list if trade.lower() in [t.lower() for t in sub.get("trades", [])]]
            
            prompt = f"""Generate an RFP email for:
Project: {project['name']} at {project.get('address', 'TBD Address')}
Timeline: {project.get('timeline', 'Standard timeline')}
Budget Range: {project.get('budget', 'Market rate')}
Subcontractor: {sub['company']} ({sub['contact_name']})
Trades Needed: {', '.join(relevant_trades)}
Project Type: New residential construction

Make it personalized to this specific subcontractor and trade."""

            message = client.messages.create(
                model=os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
                max_tokens=800,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            
            emails_generated.append({
                "company": sub["company"],
                "contact": sub["contact_name"],
                "email": sub.get("email", f"{sub['contact_name'].lower().replace(' ', '.')}@{sub['company'].lower().replace(' ', '')}.com"),
                "trades": relevant_trades,
                "content": message.content[0].text
            })
        
        return {
            "success": True,
            "emails_sent": len(emails_generated),
            "emails": emails_generated,
            "total_subcontractors": len(relevant_subs),
            "message": f"Generated and 'sent' {len(emails_generated)} personalized RFP emails"
        }
        
    except Exception as e:
        return {"error": f"Failed to generate emails: {str(e)}"}

@app.post("/follow-up")
async def follow_up(project_id: str = Form(...), overdue_days: int = Form(7)):
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return {"error": "Project not found"}
    
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        
        system_prompt = """Generate professional follow-up emails for construction subcontractors who haven't responded to RFPs. 
        Be polite but assertive about timeline needs. Include:
        - Friendly reminder of original request
        - Importance of timeline for project coordination
        - Offer to clarify any questions
        - Professional urgency without being pushy"""
        
        prompt = f"""Generate a follow-up email for subcontractors who are {overdue_days} days overdue on their quotes for:
        
Project: {project['name']}
Original deadline was {overdue_days} days ago
Timeline is critical for: {project.get('timeline', 'project coordination')}

Create a professional but urgent follow-up message."""

        message = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
            max_tokens=600,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {
            "success": True,
            "follow_up_content": message.content[0].text,
            "overdue_count": 8,  # Mock number
            "message": f"Generated follow-up for {overdue_days}-day overdue quotes"
        }
        
    except Exception as e:
        return {"error": f"Failed to generate follow-up: {str(e)}"}

@app.get("/pricing-analysis/{project_id}")
async def pricing_analysis(request: Request, project_id: str):
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return {"error": "Project not found"}
    
    # Get relevant historical quotes
    relevant_quotes = [q for q in historical_quotes if any(trade.lower() in q.get("trade", "").lower() for trade in project.get("trades_needed", []))][:10]
    
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        
        system_prompt = """You are a construction pricing analyst. Analyze quote data and identify:
        - Pricing anomalies (quotes significantly above/below market)
        - Market rate recommendations
        - Risk factors to consider
        - Contractor performance insights
        
        Provide specific, actionable insights for construction project managers."""
        
        quotes_summary = "\n".join([f"{q['trade']}: {q['contractor']} - ${q['amount']:,} ({q['date']})" for q in relevant_quotes])
        
        prompt = f"""Analyze these construction quotes for pricing anomalies and market insights:

Historical Quotes:
{quotes_summary}

Project: {project['name']}
Trades Needed: {', '.join(project.get('trades_needed', []))}
Budget: {project.get('budget', 'Standard residential')}

Identify any pricing outliers and provide market rate guidance."""

        message = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {
            "success": True,
            "analysis": message.content[0].text,
            "quotes_analyzed": len(relevant_quotes),
            "anomalies_found": 3,  # Mock number
            "market_rates": {
                "electrical": "$12,000-$28,000",
                "concrete": "$15,000-$25,000", 
                "excavation": "$8,000-$18,000"
            }
        }
        
    except Exception as e:
        return {"error": f"Failed to analyze pricing: {str(e)}"}

@app.post("/mock-quote-response")
async def mock_quote_response(project_id: str = Form(...)):
    # Simulate receiving a quote
    available_quotes = [q for q in quote_responses if q.get("project_id") == project_id]
    if available_quotes:
        quote = available_quotes[0]
        return {
            "success": True,
            "quote_received": quote,
            "message": f"Received quote from {quote.get('contractor', 'Unknown')} for ${quote.get('amount', 0):,}"
        }
    
    return {"message": "No pending quote responses available"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)