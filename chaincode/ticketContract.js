const { Contract } = require('fabric-contract-api');

class TicketBookingContract extends Contract {

    // Initialize ledger with seed data
    async InitLedger(ctx) {
        const initialEvents = [
            {
                eventId: 'EVT-101',
                title: 'Summer Music Festival',
                category: 'concert',
                organizer: 'admin@eventhub.com',
                location: 'Grand Arena',
                date: '2026-09-15',
                totalCapacity: 250,
                totalIssued: 0,
                isQuotaLocked: true,
                tiers: {
                    'VIP Tier': { price: 150, totalQuota: 50, issued: 0 },
                    'General Tier': { price: 50, totalQuota: 200, issued: 0 }
                }
            },
            {
                eventId: 'EVT-102',
                title: 'Modern Art Exposition',
                category: 'exhibition',
                organizer: 'curator@gallery.org',
                location: 'City Gallery',
                date: '2026-10-01',
                totalCapacity: 100,
                totalIssued: 0,
                isQuotaLocked: true,
                tiers: {
                    'Special Tier': { price: 25, totalQuota: 100, issued: 0 }
                }
            }
        ];

        for (const event of initialEvents) {
            await ctx.stub.putState(event.eventId, Buffer.from(JSON.stringify(event)));
        }
    }

    // Create a new event with fixed quotas & flexible tier structure (Tier 1, Tier 2, Tier 3, Special Tier, etc.)
    async CreateEvent(ctx, eventId, title, category, location, date, tiersJson, organizer) {
        const allowedCategories = ['concert', 'show', 'cinema', 'exhibition', 'others'];
        if (!allowedCategories.includes(category.toLowerCase())) {
            throw new Error(`Invalid occasion type: ${category}`);
        }

        const existing = await ctx.stub.getState(eventId);
        if (existing && existing.length > 0) {
            throw new Error(`Event ${eventId} already exists`);
        }

        const tiers = JSON.parse(tiersJson);
        let calculatedTotalCapacity = 0;

        for (const tierName in tiers) {
            const quota = parseInt(tiers[tierName].totalQuota, 10);
            if (isNaN(quota) || quota <= 0) {
                throw new Error(`Invalid quota for tier ${tierName}`);
            }
            tiers[tierName].issued = 0;
            calculatedTotalCapacity += quota;
        }

        if (calculatedTotalCapacity <= 0) {
            throw new Error('Event must have at least one ticket available in total capacity');
        }

        const eventData = {
            eventId,
            title,
            category: category.toLowerCase(),
            location,
            date,
            organizer,
            totalCapacity: calculatedTotalCapacity,
            totalIssued: 0,
            isQuotaLocked: true, // Permanent lock once booking begins
            tiers
        };

        await ctx.stub.putState(eventId, Buffer.from(JSON.stringify(eventData)));
        return JSON.stringify(eventData);
    }

    // Prevent modifying ticket quotas after event booking initialization
    async ModifyEventQuota(ctx, eventId) {
        const eventBytes = await ctx.stub.getState(eventId);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Event ${eventId} not found`);
        }

        const event = JSON.parse(eventBytes.toString());
        if (event.isQuotaLocked) {
            throw new Error('Forbidden: Ticket quotas are permanently locked before booking begins and cannot be modified');
        }
    }

    // Issue a ticket to a user (requires gmail or phone number)
    async IssueTicket(ctx, ticketId, eventId, tierName, userContact) {
        if (!userContact || (!userContact.includes('@') && !/^\+?[0-9]{7,15}$/.test(userContact))) {
            throw new Error('Valid email address or phone number is required');
        }

        const eventBytes = await ctx.stub.getState(eventId);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Event ${eventId} not found`);
        }

        const event = JSON.parse(eventBytes.toString());
        if (!event.tiers[tierName]) {
            throw new Error(`Tier ${tierName} does not exist for this event`);
        }

        if (event.totalIssued >= event.totalCapacity) {
            throw new Error(`Total event capacity of ${event.totalCapacity} tickets has been reached`);
        }

        const tier = event.tiers[tierName];
        if (tier.issued >= tier.totalQuota) {
            throw new Error(`Ticket quota for tier ${tierName} has been exhausted`);
        }

        // Increment issued count for tier and total event
        tier.issued += 1;
        event.totalIssued += 1;

        await ctx.stub.putState(eventId, Buffer.from(JSON.stringify(event)));

        // Generate unique entry and exit hashes
        const timestamp = new Date().toISOString();
        const entryHash = `ENTRY-${ticketId}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const exitHash = `EXIT-${ticketId}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        const ticket = {
            ticketId,
            eventId,
            eventTitle: event.title,
            category: event.category,
            tierName,
            price: tier.price,
            ownerContact: userContact.trim(),
            issuedAt: timestamp,
            entryHash,
            exitHash,
            entryScanned: false,
            exitScanned: false,
            entryTime: null,
            exitTime: null
        };

        await ctx.stub.putState(ticketId, Buffer.from(JSON.stringify(ticket)));
        return JSON.stringify(ticket);
    }

    // Transfer ticket to recipient gmail or phone number
    async TransferTicket(ctx, ticketId, currentOwner, recipientContact) {
        if (!recipientContact || (!recipientContact.includes('@') && !/^\+?[0-9]{7,15}$/.test(recipientContact))) {
            throw new Error('Valid recipient email address or phone number is required');
        }

        const ticketBytes = await ctx.stub.getState(ticketId);
        if (!ticketBytes || ticketBytes.length === 0) {
            throw new Error(`Ticket ${ticketId} not found`);
        }

        const ticket = JSON.parse(ticketBytes.toString());
        if (ticket.ownerContact.toLowerCase() !== currentOwner.toLowerCase()) {
            throw new Error('Unauthorized: Only ticket owner can transfer');
        }

        if (ticket.entryScanned) {
            throw new Error('Cannot transfer a ticket that has already been used for entry');
        }

        ticket.ownerContact = recipientContact.trim();
        ticket.transferredAt = new Date().toISOString();

        await ctx.stub.putState(ticketId, Buffer.from(JSON.stringify(ticket)));
        return JSON.stringify(ticket);
    }

    // Scan entry QR code (single use only)
    async ValidateEntry(ctx, ticketId, scannedEntryHash) {
        const ticketBytes = await ctx.stub.getState(ticketId);
        if (!ticketBytes || ticketBytes.length === 0) {
            throw new Error(`Ticket ${ticketId} not found`);
        }

        const ticket = JSON.parse(ticketBytes.toString());
        if (ticket.entryHash !== scannedEntryHash) {
            throw new Error('Invalid entry QR code hash');
        }

        if (ticket.entryScanned) {
            throw new Error(`Entry QR code has already been scanned at ${ticket.entryTime}`);
        }

        ticket.entryScanned = true;
        ticket.entryTime = new Date().toISOString();

        await ctx.stub.putState(ticketId, Buffer.from(JSON.stringify(ticket)));
        return JSON.stringify({ status: 'SUCCESS', message: 'Entry granted', ticket });
    }

    // Scan exit QR code (single use only)
    async ValidateExit(ctx, ticketId, scannedExitHash) {
        const ticketBytes = await ctx.stub.getState(ticketId);
        if (!ticketBytes || ticketBytes.length === 0) {
            throw new Error(`Ticket ${ticketId} not found`);
        }

        const ticket = JSON.parse(ticketBytes.toString());
        if (!ticket.entryScanned) {
            throw new Error('Cannot validate exit before entry has occurred');
        }

        if (ticket.exitHash !== scannedExitHash) {
            throw new Error('Invalid exit QR code hash');
        }

        if (ticket.exitScanned) {
            throw new Error(`Exit QR code has already been scanned at ${ticket.exitTime}`);
        }

        ticket.exitScanned = true;
        ticket.exitTime = new Date().toISOString();

        await ctx.stub.putState(ticketId, Buffer.from(JSON.stringify(ticket)));
        return JSON.stringify({ status: 'SUCCESS', message: 'Exit granted', ticket });
    }

    // Fetch tickets for a specific user contact
    async GetUserTickets(ctx, userContact) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');

        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            try {
                const record = JSON.parse(strValue);
                if (record.ticketId && record.ownerContact && record.ownerContact.toLowerCase() === userContact.toLowerCase()) {
                    allResults.push(record);
                }
            } catch (err) {
                // skip non-json
            }
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}

module.exports = TicketBookingContract;
