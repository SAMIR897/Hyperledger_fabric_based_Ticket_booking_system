// Frontend Application Logic for TicketVault

let currentEvents = [];
let userTickets = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initForms();
    loadEvents();
    calculateTotalCapacity();
});

// Navigation tab switching
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

            btn.classList.add('active');
            const tabId = `${btn.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });

    document.getElementById('category-filter').addEventListener('change', renderEvents);
}

// Calculate total capacity live as organizer defines tier quotas
function calculateTotalCapacity() {
    const tierQuotas = document.querySelectorAll('.tier-quota');
    let total = 0;
    tierQuotas.forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val > 0) {
            total += val;
        }
    });
    const badge = document.getElementById('calculated-capacity-badge');
    if (badge) {
        badge.textContent = `Total Fixed Capacity: ${total} tickets`;
    }
}

// Initialize Event creation, booking, and scanning forms
function initForms() {
    // Create Event Form
    document.getElementById('create-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('event-title').value;
        const category = document.getElementById('event-category').value;
        const location = document.getElementById('event-location').value;
        const date = document.getElementById('event-date').value;

        const tierNames = document.querySelectorAll('.tier-name');
        const tierPrices = document.querySelectorAll('.tier-price');
        const tierQuotas = document.querySelectorAll('.tier-quota');

        const tiers = {};
        tierNames.forEach((input, index) => {
            const name = input.value.trim();
            if (name) {
                tiers[name] = {
                    price: parseFloat(tierPrices[index].value),
                    totalQuota: parseInt(tierQuotas[index].value, 10),
                    issued: 0
                };
            }
        });

        const eventId = `EVT-${Date.now().toString().slice(-6)}`;

        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, title, category, location, date, tiers })
            });
            const data = await res.json();
            if (data.success) {
                alert('Event and fixed ticket quotas successfully published and locked on Fabric ledger');
                document.getElementById('create-event-form').reset();
                calculateTotalCapacity();
                loadEvents();
                // Switch to catalog tab
                document.querySelector('[data-tab="catalog"]').click();
            } else {
                alert(`Error creating event: ${data.error}`);
            }
        } catch (err) {
            alert(`Failed to create event: ${err.message}`);
        }
    });

    // Book Ticket Form
    document.getElementById('book-ticket-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const eventId = document.getElementById('book-event-id').value;
        const tierName = document.getElementById('book-tier-select').value;
        const userContact = document.getElementById('book-user-contact').value.trim();

        try {
            const res = await fetch('/api/tickets/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, tierName, userContact })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Ticket successfully issued to ${userContact}`);
                closeModal('booking-modal');
                document.getElementById('book-ticket-form').reset();
                loadEvents();
                // Switch to gallery and load tickets
                document.querySelector('[data-tab="gallery"]').click();
                document.getElementById('user-contact-input').value = userContact;
                loadUserTickets();
            } else {
                alert(`Error issuing ticket: ${data.error}`);
            }
        } catch (err) {
            alert(`Failed to issue ticket: ${err.message}`);
        }
    });

    // Entry Scan Form
    document.getElementById('entry-scan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ticketId = document.getElementById('entry-ticket-id').value.trim();
        const entryHash = document.getElementById('entry-hash-input').value.trim();
        const resultBox = document.getElementById('entry-scan-result');

        try {
            const res = await fetch('/api/tickets/validate-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, entryHash })
            });
            const data = await res.json();
            if (data.success) {
                resultBox.className = 'scan-result-box success';
                resultBox.innerHTML = `<strong>Entry Approved</strong><br>Ticket: ${ticketId}<br>Scanned at: ${new Date(data.data.ticket.entryTime).toLocaleString()}`;
            } else {
                resultBox.className = 'scan-result-box error';
                resultBox.innerHTML = `<strong>Entry Denied</strong><br>Reason: ${data.error}`;
            }
        } catch (err) {
            resultBox.className = 'scan-result-box error';
            resultBox.innerHTML = `<strong>Scan Error</strong><br>${err.message}`;
        }
    });

    // Exit Scan Form
    document.getElementById('exit-scan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ticketId = document.getElementById('exit-ticket-id').value.trim();
        const exitHash = document.getElementById('exit-hash-input').value.trim();
        const resultBox = document.getElementById('exit-scan-result');

        try {
            const res = await fetch('/api/tickets/validate-exit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, exitHash })
            });
            const data = await res.json();
            if (data.success) {
                resultBox.className = 'scan-result-box success';
                resultBox.innerHTML = `<strong>Exit Approved</strong><br>Ticket: ${ticketId}<br>Scanned at: ${new Date(data.data.ticket.exitTime).toLocaleString()}`;
            } else {
                resultBox.className = 'scan-result-box error';
                resultBox.innerHTML = `<strong>Exit Denied</strong><br>Reason: ${data.error}`;
            }
        } catch (err) {
            resultBox.className = 'scan-result-box error';
            resultBox.innerHTML = `<strong>Scan Error</strong><br>${err.message}`;
        }
    });
}

// Add tier row in event creator
function addTierRow() {
    const container = document.getElementById('tier-rows');
    const div = document.createElement('div');
    div.className = 'tier-row';
    div.innerHTML = `
        <input type="text" class="tier-name" placeholder="Tier Name (e.g. Tier 1, Tier 2, Special Tier)" required oninput="calculateTotalCapacity()">
        <input type="number" class="tier-price" placeholder="Price ($)" min="0" required>
        <input type="number" class="tier-quota" placeholder="Fixed Quota" min="1" required oninput="calculateTotalCapacity()">
        <button type="button" class="btn-remove-tier" onclick="removeTierRow(this)">Remove</button>
    `;
    container.appendChild(div);
    calculateTotalCapacity();
}

function removeTierRow(btn) {
    const rows = document.querySelectorAll('.tier-row');
    if (rows.length > 1) {
        btn.parentElement.remove();
        calculateTotalCapacity();
    } else {
        alert('At least one ticket tier is required.');
    }
}

// Load Events from Server
async function loadEvents() {
    try {
        const res = await fetch('/api/events');
        const data = await res.json();
        if (data.success) {
            currentEvents = data.data;
            renderEvents();
        }
    } catch (err) {
        console.error('Failed to load events:', err);
    }
}

// Render Event Cards
function renderEvents() {
    const grid = document.getElementById('event-grid');
    const category = document.getElementById('category-filter').value;
    
    grid.innerHTML = '';

    const filtered = currentEvents.filter(evt => {
        if (category === 'all') return true;
        return evt.category === category;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="placeholder-text">No events found for this category.</p>';
        return;
    }

    filtered.forEach(evt => {
        const card = document.createElement('div');
        card.className = 'event-card';

        let tiersHtml = '';
        for (const [tierName, tier] of Object.entries(evt.tiers)) {
            const isSoldOut = tier.issued >= tier.totalQuota;
            tiersHtml += `
                <div class="tier-pill ${isSoldOut ? 'sold-out' : ''}">
                    <strong>${tierName}</strong>: $${tier.price} (${tier.issued}/${tier.totalQuota})
                </div>
            `;
        }

        const totalIssued = evt.totalIssued || 0;
        const totalCapacity = evt.totalCapacity || 0;

        card.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="event-category-tag">${evt.category}</span>
                    <span class="badge-tag">Capacity: ${totalIssued}/${totalCapacity} (Locked)</span>
                </div>
                <h3 class="event-title">${evt.title}</h3>
                <div class="event-meta">
                    <p>Location: ${evt.location}</p>
                    <p>Date: ${evt.date}</p>
                </div>
                <div class="tier-badge-list">
                    ${tiersHtml}
                </div>
            </div>
            <button class="btn-primary" onclick="openBookingModal('${evt.eventId}')" ${totalIssued >= totalCapacity ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                ${totalIssued >= totalCapacity ? 'Event Sold Out' : 'Book Ticket'}
            </button>
        `;
        grid.appendChild(card);
    });
}

// Open Booking Modal
function openBookingModal(eventId) {
    const evt = currentEvents.find(e => e.eventId === eventId);
    if (!evt) return;

    document.getElementById('modal-event-title').textContent = `Book Ticket for ${evt.title}`;
    document.getElementById('book-event-id').value = eventId;

    const select = document.getElementById('book-tier-select');
    select.innerHTML = '';

    for (const [tierName, tier] of Object.entries(evt.tiers)) {
        const option = document.createElement('option');
        option.value = tierName;
        const available = tier.totalQuota - tier.issued;
        option.textContent = `${tierName} - $${tier.price} (${available} available)`;
        if (available <= 0) option.disabled = true;
        select.appendChild(option);
    }

    document.getElementById('booking-modal').classList.add('active');
}

// Load User Ticket Collection
async function loadUserTickets() {
    const contact = document.getElementById('user-contact-input').value.trim();
    if (!contact) {
        alert('Please enter your Gmail address or phone number');
        return;
    }

    try {
        const res = await fetch(`/api/tickets/user?contact=${encodeURIComponent(contact)}`);
        const data = await res.json();
        if (data.success) {
            userTickets = data.data;
            renderUserTickets();
        }
    } catch (err) {
        alert(`Failed to load tickets: ${err.message}`);
    }
}

function renderUserTickets() {
    const grid = document.getElementById('ticket-gallery-grid');
    grid.innerHTML = '';

    if (userTickets.length === 0) {
        grid.innerHTML = '<p class="placeholder-text">No tickets found for this contact.</p>';
        return;
    }

    userTickets.forEach(ticket => {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        card.onclick = () => openTicketDetail(ticket.ticketId);

        card.innerHTML = `
            <div class="ticket-card-header">
                <span class="event-category-tag">${ticket.category}</span>
                <span class="ticket-id-tag">${ticket.ticketId}</span>
            </div>
            <h3 style="margin-bottom:0.5rem;">${ticket.eventTitle}</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.75rem;">Tier: <strong>${ticket.tierName}</strong> ($${ticket.price})</p>
            <div style="display:flex; gap:0.5rem;">
                <span class="status-badge ${ticket.entryScanned ? 'used' : 'unused'}">
                    Entry: ${ticket.entryScanned ? 'Used' : 'Valid'}
                </span>
                <span class="status-badge ${ticket.exitScanned ? 'used' : 'unused'}">
                    Exit: ${ticket.exitScanned ? 'Used' : 'Valid'}
                </span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Open Ticket Detail Modal (Renders QR Code & Transfer Form)
function openTicketDetail(ticketId) {
    const ticket = userTickets.find(t => t.ticketId === ticketId);
    if (!ticket) return;

    const container = document.getElementById('ticket-detail-container');
    container.innerHTML = `
        <div style="margin-bottom:1rem;">
            <span class="event-category-tag">${ticket.category}</span>
            <h2>${ticket.eventTitle}</h2>
            <p style="color:var(--text-muted);">Ticket ID: <code>${ticket.ticketId}</code></p>
            <p style="color:var(--text-muted);">Owner: ${ticket.ownerContact}</p>
            <p style="color:var(--text-muted);">Tier: ${ticket.tierName} ($${ticket.price})</p>
        </div>

        <div class="qr-section">
            <div class="qr-box">
                <canvas id="entry-qr-canvas"></canvas>
                <div class="qr-label">Entry Pass QR</div>
                <span class="status-badge ${ticket.entryScanned ? 'used' : 'unused'}">
                    ${ticket.entryScanned ? 'Scanned & Closed' : 'Single-Use Valid'}
                </span>
            </div>
            <div class="qr-box">
                <canvas id="exit-qr-canvas"></canvas>
                <div class="qr-label">Exit Pass QR</div>
                <span class="status-badge ${ticket.exitScanned ? 'used' : 'unused'}">
                    ${ticket.exitScanned ? 'Scanned & Closed' : 'Single-Use Valid'}
                </span>
            </div>
        </div>

        <div class="card-form" style="padding:1rem; margin-top:1rem;">
            <h3>Transfer Ticket to Another User</h3>
            <form onsubmit="handleTransferTicket(event, '${ticket.ticketId}', '${ticket.ownerContact}')">
                <div class="form-group" style="margin-bottom:0.75rem;">
                    <label>Recipient Gmail or Phone Number</label>
                    <input type="text" id="transfer-recipient-input" required placeholder="recipient@gmail.com or +19876543210">
                </div>
                <button type="submit" class="btn-primary" ${ticket.entryScanned ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                    ${ticket.entryScanned ? 'Transfer Locked (Entry Used)' : 'Transfer Ownership'}
                </button>
            </form>
        </div>
    `;

    document.getElementById('ticket-modal').classList.add('active');

    // Generate QR Codes
    setTimeout(() => {
        QRCode.toCanvas(document.getElementById('entry-qr-canvas'), ticket.entryHash, { width: 160 });
        QRCode.toCanvas(document.getElementById('exit-qr-canvas'), ticket.exitHash, { width: 160 });
    }, 50);
}

// Handle Transfer
async function handleTransferTicket(event, ticketId, currentOwner) {
    event.preventDefault();
    const recipientContact = document.getElementById('transfer-recipient-input').value.trim();

    try {
        const res = await fetch('/api/tickets/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, currentOwner, recipientContact })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Ticket ${ticketId} successfully transferred to ${recipientContact}`);
            closeModal('ticket-modal');
            loadUserTickets();
        } else {
            alert(`Transfer failed: ${data.error}`);
        }
    } catch (err) {
        alert(`Transfer failed: ${err.message}`);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}
