let selectedProject = null;
let currentProjectData = null;

// Project selection
function selectProject(projectId) {
    selectedProject = projectId;
    
    // Update UI
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-project-id="${projectId}"]`).classList.add('selected');
    
    // Fetch project data
    fetchProjectData(projectId);
}

async function fetchProjectData(projectId) {
    try {
        const response = await fetch(`/project/${projectId}`);
        if (response.ok) {
            showProjectDetails(projectId);
        }
    } catch (error) {
        console.error('Error fetching project data:', error);
    }
}

function showProjectDetails(projectId) {
    // Hide welcome message
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('project-details').style.display = 'block';
    
    // Update project name
    const projectItem = document.querySelector(`[data-project-id="${projectId}"]`);
    if (projectItem) {
        const projectName = projectItem.querySelector('.project-name').textContent;
        document.getElementById('selected-project-name').textContent = projectName;
    }
    
    // Show some mock subcontractors
    showSubcontractors();
}

function showSubcontractors() {
    const subList = document.getElementById('subcontractor-list');
    if (subList) {
        subList.innerHTML = `
            <div class="subcontractor-summary">
                <div class="summary-item">
                    <span>Electrical:</span> <span>3 contractors</span>
                </div>
                <div class="summary-item">
                    <span>Concrete:</span> <span>4 contractors</span>
                </div>
                <div class="summary-item">
                    <span>HVAC:</span> <span>2 contractors</span>
                </div>
                <div class="summary-item">
                    <span>Plumbing:</span> <span>3 contractors</span>
                </div>
                <div class="summary-item">
                    <span>Roofing:</span> <span>2 contractors</span>
                </div>
            </div>
        `;
    }
}

// Send RFPs functionality
document.addEventListener('DOMContentLoaded', function() {
    // Dashboard send RFPs
    const sendRfpsBtn = document.getElementById('send-rfps-btn');
    if (sendRfpsBtn) {
        sendRfpsBtn.addEventListener('click', handleSendRFPs);
    }
    
    // Project detail send RFPs
    const sendRfpsDetailBtn = document.getElementById('send-rfps-detail');
    if (sendRfpsDetailBtn) {
        sendRfpsDetailBtn.addEventListener('click', function() {
            const projectId = this.dataset.projectId;
            const trades = this.dataset.trades;
            sendRFPs(projectId, trades);
        });
    }
    
    // Follow-up button
    const followUpBtn = document.getElementById('follow-up-btn');
    if (followUpBtn) {
        followUpBtn.addEventListener('click', handleFollowUp);
    }
    
    // Pricing analysis buttons
    const analyzePricingBtn = document.getElementById('analyze-pricing-btn');
    if (analyzePricingBtn) {
        analyzePricingBtn.addEventListener('click', handlePricingAnalysis);
    }
    
    const pricingAnalysisBtn = document.getElementById('pricing-analysis');
    if (pricingAnalysisBtn) {
        pricingAnalysisBtn.addEventListener('click', function() {
            const projectId = this.dataset.projectId;
            analyzePricing(projectId);
        });
    }
    
    // Mock response button
    const mockResponseBtn = document.getElementById('mock-response');
    if (mockResponseBtn) {
        mockResponseBtn.addEventListener('click', function() {
            const projectId = this.dataset.projectId;
            mockQuoteResponse(projectId);
        });
    }
});

async function handleSendRFPs() {
    if (!selectedProject) {
        alert('Please select a project first');
        return;
    }
    
    // Mock trades for selected project
    const trades = "electrical, concrete, HVAC, plumbing, framing, roofing";
    await sendRFPs(selectedProject, trades);
}

async function sendRFPs(projectId, trades) {
    showLoading('Generating personalized RFP emails with AI...');
    
    try {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('trades', trades);
        
        const response = await fetch('/send-rfps', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        hideLoading();
        
        if (result.success) {
            displayRFPResults(result);
            updateRFPStatus(result.emails_sent, 0, result.total_subcontractors - result.emails_sent);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        hideLoading();
        alert('Failed to send RFPs: ' + error.message);
    }
}

function displayRFPResults(result) {
    const resultsArea = document.getElementById('results-area') || document.getElementById('results');
    if (!resultsArea) return;
    
    resultsArea.style.display = 'block';
    
    const emailsHtml = result.emails.map(email => `
        <div class="email-preview">
            <div class="email-header">
                <strong>To: ${email.company} (${email.contact})</strong>
                <span>Trades: ${email.trades.join(', ')}</span>
            </div>
            <div class="email-content">${email.content}</div>
        </div>
    `).join('');
    
    const generatedEmailsDiv = document.getElementById('generated-emails') || createResultsDiv();
    generatedEmailsDiv.innerHTML = `
        <div style="background: #e8f5e8; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <strong>✓ Success!</strong> Generated and sent ${result.emails_sent} personalized RFP emails to ${result.total_subcontractors} subcontractors
        </div>
        ${emailsHtml}
    `;
}

async function handleFollowUp() {
    if (!selectedProject) {
        alert('Please select a project first');
        return;
    }
    
    showLoading('Generating follow-up messages...');
    
    try {
        const formData = new FormData();
        formData.append('project_id', selectedProject);
        formData.append('overdue_days', '7');
        
        const response = await fetch('/follow-up', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        hideLoading();
        
        if (result.success) {
            displayFollowUpResults(result);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        hideLoading();
        alert('Failed to generate follow-up: ' + error.message);
    }
}

function displayFollowUpResults(result) {
    const resultsArea = document.getElementById('results-area') || document.getElementById('results');
    if (!resultsArea) return;
    
    resultsArea.style.display = 'block';
    resultsArea.innerHTML = `
        <div class="card">
            <h3>Follow-up Messages Generated</h3>
            <div style="background: #fff3cd; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <strong>Generated follow-up for ${result.overdue_count} overdue quotes</strong>
            </div>
            <div class="email-preview">
                <div class="email-header">
                    <strong>Follow-up Email Template</strong>
                </div>
                <div class="email-content">${result.follow_up_content}</div>
            </div>
        </div>
    `;
}

async function handlePricingAnalysis() {
    if (!selectedProject) {
        alert('Please select a project first');
        return;
    }
    
    await analyzePricing(selectedProject);
}

async function analyzePricing(projectId) {
    showLoading('Analyzing pricing data with AI...');
    
    try {
        const response = await fetch(`/pricing-analysis/${projectId}`);
        const result = await response.json();
        
        hideLoading();
        
        if (result.success) {
            displayPricingAnalysis(result);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        hideLoading();
        alert('Failed to analyze pricing: ' + error.message);
    }
}

function displayPricingAnalysis(result) {
    const resultsArea = document.getElementById('results-area') || document.getElementById('results');
    if (!resultsArea) return;
    
    resultsArea.style.display = 'block';
    
    const pricingDiv = document.getElementById('pricing-analysis') || createPricingDiv();
    pricingDiv.innerHTML = `
        <div style="background: #d4edda; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <strong>✓ Analysis Complete!</strong> Found ${result.anomalies_found} pricing anomalies in ${result.quotes_analyzed} historical quotes
        </div>
        <div class="analysis-content">
            <h4>AI Analysis:</h4>
            <div style="white-space: pre-wrap; line-height: 1.6; margin: 16px 0;">${result.analysis}</div>
            <h4>Market Rates:</h4>
            <ul>
                ${Object.entries(result.market_rates).map(([trade, rate]) => `<li><strong>${trade}:</strong> ${rate}</li>`).join('')}
            </ul>
        </div>
    `;
}

async function mockQuoteResponse(projectId) {
    try {
        const formData = new FormData();
        formData.append('project_id', projectId);
        
        const response = await fetch('/mock-quote-response', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`📧 ${result.message}`, 'success');
            updateRFPStatus(null, 1, null);
        } else {
            showNotification(result.message, 'info');
        }
    } catch (error) {
        showNotification('Failed to simulate quote response', 'error');
    }
}

function createResultsDiv() {
    const resultsArea = document.getElementById('results-area') || document.getElementById('results');
    if (resultsArea) {
        resultsArea.innerHTML = '<div class="card"><h3>Generated RFP Emails</h3><div id="generated-emails"></div></div>';
        return document.getElementById('generated-emails');
    }
    return document.createElement('div');
}

function createPricingDiv() {
    const resultsArea = document.getElementById('results-area') || document.getElementById('results');
    if (resultsArea && !document.getElementById('pricing-analysis')) {
        resultsArea.innerHTML += '<div class="card"><h3>Pricing Analysis</h3><div id="pricing-analysis"></div></div>';
    }
    return document.getElementById('pricing-analysis');
}

function updateRFPStatus(sent, received, overdue) {
    if (sent !== null) {
        const sentSpan = document.getElementById('emails-sent');
        if (sentSpan) sentSpan.textContent = sent;
    }
    
    if (received !== null) {
        const receivedSpan = document.getElementById('quotes-received');
        if (receivedSpan) {
            const current = parseInt(receivedSpan.textContent) || 0;
            receivedSpan.textContent = current + received;
        }
    }
    
    if (overdue !== null) {
        const overdueSpan = document.getElementById('quotes-overdue');
        if (overdueSpan) overdueSpan.textContent = overdue;
    }
}

function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay) {
        if (text) text.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showNotification(message, type) {
    // Simple notification - could be enhanced
    const color = type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#fff3cd';
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        padding: 16px;
        border-radius: 6px;
        border: 1px solid #ccc;
        z-index: 1001;
        max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}