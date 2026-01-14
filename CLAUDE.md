Act as a Full-Stack Developer. Create a Building Management Web Application (SaaS) with the following technical and functional requirements:

### 1. Technical Stack
- **Framework:** Next.js (App Router).
- **Database:** PostgreSQL (via Supabase).
- **ORM:** Prisma (essential for future portability).
- **Authentication:** Supabase Auth (Email/Password).
- **Language:** UI and system messages must be in **Spanish**.
- **Styling:** Tailwind CSS + Shadcn UI (for a professional dashboard).

### 2. Core Features
- **Apartment Management:** CRUD for units (Floor, Unit #, Square meters, "alícuota").
- **User Roles:** Distinct profiles for **Owners (Propietarios)** and **Tenants (Inquilinos)**. One unit can have both.
- **Common Expenses (Gastos Comunes):** - Monthly expense entry system.
    - Automatic distribution of costs based on apartment "alícuota".
- **Banking & Accounts:** Registry for building bank accounts and tracking individual unit balances (Estado de Cuenta).
- **PDF Reports:**
    - Use `jspdf` or `react-pdf` to generate monthly clearance reports.
    - Summary for the administrator and individual reports for units.
- **Communication:** Buttons to share report summaries/links via **WhatsApp** and **Email**.

### 3. Dashboard Requirements
- Main view showing: Total monthly collection, delinquency rate (mora), and pending maintenance tasks.
- Responsive design for mobile access.

### 4. Implementation Steps
1. Create the `schema.prisma` file reflecting the relationship between Units, People (Owners/Tenants), Expenses, and Payments.
2. Setup Supabase client configuration.
3. Build the Spanish UI components using Tailwind.
4. Implement the logic for generating and sharing PDFs.

Please provide the folder structure, the Prisma schema, and the main page component to start.