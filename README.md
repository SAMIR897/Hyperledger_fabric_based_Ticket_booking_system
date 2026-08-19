# Hyperledger Fabric Based Ticket Booking System

A permissioned enterprise ticket booking, issuance, transfer, and single-use QR verification dApp built using Hyperledger Fabric chaincode and Node.js.

---

## Overview

Traditional ticketing systems suffer from secondary market scalping, counterfeit tickets, and double-entry fraud at event gates. This system uses Hyperledger Fabric smart contract chaincode to enforce:

1. **Immutable Ticket Ownership**: Every ticket issuance and transfer is registered on the ledger and bound to the user's Gmail address or phone number.
2. **Tier-Based Limited Quotas**: Organizers define custom ticket tiers (VIP, General, Early Bird) with strict maximum quotas enforced directly on-chain.
3. **Single-Use Entry & Exit QR Codes**: Each issued ticket contains two unique cryptographic hashes (Entry Hash and Exit Hash). Once scanned at the venue gate, the state is permanently updated on-chain, preventing double entry or reuse.
4. **Peer-to-Peer Transfer**: Users can transfer un-scanned tickets to a specific Gmail address or phone number. Once a ticket is scanned for entry, transfer rights are locked automatically.

---

## System Architecture

- **Chaincode Layer**: Written in JavaScript (`fabric-contract-api`). Handles event registration, ticket issuance, ownership transfers, and single-use entry/exit gate validation.
- **Backend Application API**: Express.js server mapping HTTP requests to Fabric contract invocations.
- **Frontend User Interface**: Responsive web app providing Event Catalog, Organizer Studio, User Ticket Gallery, QR pass view, and Gate Validator.

---

## Key Features

- **Occasion Categories**: Supports Concert, Show, Cinema, Exhibition, and Custom Events.
- **Flexible Tiers**: Organizers can configure any number of ticket tiers with individual pricing and limited supply limits.
- **User Identity Binding**: Requires Gmail address or phone number during booking.
- **Ticket Gallery Collection**: Users input their registered contact to load their ticket passes.
- **Dual QR Validation**:
  - **Entry Pass QR**: Validates event entry (single-use).
  - **Exit Pass QR**: Validates event exit (single-use).

---

## Installation and Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation Steps

1. **Clone Repository**:
   ```bash
   git clone https://github.com/SAMIR897/Hyperledger_fabric_based_Ticket_booking_system.git
   cd Hyperledger_fabric_based_Ticket_booking_system
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Application**:
   ```bash
   npm start
   ```

4. **Access Web Portal**:
   Open browser at `http://localhost:3000`

---

## Project Structure

```text
├── chaincode/
│   └── ticketContract.js    # Hyperledger Fabric Smart Contract
├── public/
│   ├── index.html           # Single Page Interface
│   ├── styles.css           # UI Styling
│   └── app.js               # Client controller & QR generator
├── server.js                # Express Server API
├── package.json             # Project dependencies
└── README.md                # Documentation
```

---

## License

MIT License
