Act as a Full-Stack Developer. Create a Building Management Desktop Application with the following technical and functional requirements:

### 1. Technical Stack
- **Framework:** Next.js (App Router) + Tauri (Desktop App).
- **Database:** SQLite (local, via @tauri-apps/plugin-sql).
- **Language:** UI and system messages must be in **Spanish**.
- **Styling:** Tailwind CSS + Shadcn UI (for a professional dashboard).

### 2. Core Features
- **Apartment Management:** CRUD for units (Floor, Unit #, Square meters, "alícuota").
- **User Roles:** Distinct profiles for **Owners (Propietarios)** and **Tenants (Inquilinos)**. One unit can have both.
- **Common Expenses (Gastos Comunes):** - Monthly expense entry system.
    - Automatic distribution of costs based on apartment "alícuota".
- **Banking & Accounts:** Registry for building bank accounts and tracking individual unit balances (Estado de Cuenta).
- **PDF Reports:**
    - Use `jspdf` to generate monthly clearance reports.
    - Summary for the administrator and individual reports for units.
- **Communication:** Buttons to share report summaries/links via **WhatsApp** and **Email**.

### 3. Dashboard Requirements
- Main view showing: Total monthly collection, delinquency rate (mora), and pending maintenance tasks.
- Responsive design for mobile access.

### 4. Implementation Notes
- Data is stored locally in SQLite database (database.db)
- All database operations are in src/lib/database.ts
- No cloud services or external authentication required
