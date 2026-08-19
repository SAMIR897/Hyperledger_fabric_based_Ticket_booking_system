const express = require('express');
const path = require('path');
const TicketBookingContract = require('./chaincode/ticketContract');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock Fabric Ledger Context for local HTTP server execution
class MockStub {
    constructor() {
        this.state = new Map();
    }

    async putState(key, value) {
        this.state.set(key, value);
    }

    async getState(key) {
        return this.state.get(key) || null;
    }

    async getStateByRange(start, end) {
        const entries = Array.from(this.state.values());
        let index = 0;
        return {
            next: async () => {
                if (index < entries.length) {
                    const val = entries[index++];
                    return { value: { value: val }, done: false };
                }
                return { done: true };
            }
        };
    }
}

const mockCtx = { stub: new MockStub() };
const contract = new TicketBookingContract();

// Initialize ledger seed data
contract.InitLedger(mockCtx).catch(err => {
    console.error('Failed to initialize ledger:', err);
});

// Create event API endpoint
app.post('/api/events', async (req, res) => {
    try {
        const { eventId, title, category, location, date, tiers, organizer } = req.body;
        const result = await contract.CreateEvent(
            mockCtx,
            eventId,
            title,
            category,
            location,
            date,
            JSON.stringify(tiers),
            organizer || 'organizer@event.com'
        );
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Fetch all events endpoint
app.get('/api/events', async (req, res) => {
    try {
        const events = [];
        const iterator = await mockCtx.stub.getStateByRange('', '');
        let item = await iterator.next();
        while (!item.done) {
            const data = JSON.parse(item.value.value.toString());
            if (data.eventId && data.tiers) {
                events.push(data);
            }
            item = await iterator.next();
        }
        res.json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Issue/Book Ticket endpoint
app.post('/api/tickets/issue', async (req, res) => {
    try {
        const { eventId, tierName, userContact } = req.body;
        const ticketId = `TCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const result = await contract.IssueTicket(mockCtx, ticketId, eventId, tierName, userContact);
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Transfer Ticket endpoint
app.post('/api/tickets/transfer', async (req, res) => {
    try {
        const { ticketId, currentOwner, recipientContact } = req.body;
        const result = await contract.TransferTicket(mockCtx, ticketId, currentOwner, recipientContact);
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Validate Entry QR code endpoint
app.post('/api/tickets/validate-entry', async (req, res) => {
    try {
        const { ticketId, entryHash } = req.body;
        const result = await contract.ValidateEntry(mockCtx, ticketId, entryHash);
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Validate Exit QR code endpoint
app.post('/api/tickets/validate-exit', async (req, res) => {
    try {
        const { ticketId, exitHash } = req.body;
        const result = await contract.ValidateExit(mockCtx, ticketId, exitHash);
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Query user tickets endpoint
app.get('/api/tickets/user', async (req, res) => {
    try {
        const { contact } = req.query;
        if (!contact) {
            return res.status(400).json({ success: false, error: 'Contact parameter is required' });
        }
        const result = await contract.GetUserTickets(mockCtx, contact);
        res.json({ success: true, data: JSON.parse(result) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Ticket booking system running on port ${PORT}`);
});
