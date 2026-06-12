# MyMC — Church Membership and Growth Management Platform

A full stack web application built for a church organisation to track membership, monitor attendance, record outreach activity, and make data driven decisions about retention and community growth.

---

## The Problem

Church leadership had no reliable way to know whether new members from outreaches were being retained, which cell groups were growing, or where attendance was declining over time. Decisions were being made on gut feeling rather than data. MyMC was built to change that.

---

## What It Does

### Membership Management
- Register and manage member profiles with contact details, joining date, and cell group assignment
- Track member status over time to identify inactive or at risk members

### Attendance Tracking
- Record attendance per service and event
- Dashboard showing attendance trends over weeks and months
- Identify patterns in retention and drop off across different services

### Outreach Recording
- Log souls won on outreaches with follow up status
- Track conversion from first contact to active membership
- Give leadership visibility into which outreach efforts are producing retained members

### Cell Group Management
- Assign members to cell groups
- Track cell group attendance and growth independently
- Give cell leaders visibility into their own group metrics

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | Next.js API Routes (BFF pattern) |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Deployment | Vercel |

---

## Architecture

MyMC uses the Next.js App Router with React Server Components for all dashboard and reporting views. This means membership data and attendance metrics are fetched and rendered server side, keeping sensitive member information out of the client bundle entirely.

Supabase handles authentication, the PostgreSQL database, and Row Level Security policies that enforce data access rules at the database level. Each user role, pastor, cell leader, and administrator, sees only the data they are authorised to access regardless of what the application layer requests.

```
Browser
  ↓
Next.js App Router (React Server Components)
  ↓
Next.js API Routes (BFF layer)
  ↓
Supabase Client
  ↓
PostgreSQL (with RLS policies)
```

---

## Key Technical Decisions

**Row Level Security over application level permission checks**
Data access rules are enforced directly in Supabase using RLS policies rather than relying solely on middleware. Even if application logic has a bug, the database will not return data a user is not authorised to see. This was a deliberate choice for a system handling personal member information.

**Server Components for all sensitive data views**
Membership rosters, attendance records, and outreach data are rendered entirely on the server. No sensitive data is sent to the client as JSON or exposed in network requests that a member could inspect.

**BFF pattern with Next.js API routes**
Rather than calling Supabase directly from the client, all data requests go through API routes that validate the session, enforce business logic, and return only the data the frontend needs. This keeps the data layer clean and makes future migrations easier.

---

## Status

Currently in internal testing with the church organisation. All three core modules, membership management, attendance tracking, and outreach recording, are fully built and functional.

---

## Setup

```bash
git clone https://github.com/bheny/mymc
cd mymc
npm install
cp .env.example .env.local
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Project Structure

```
mymc/
├── app/
│   ├── (auth)/          # Login and registration flows
│   ├── dashboard/       # Leadership overview and metrics
│   ├── members/         # Member management
│   ├── attendance/      # Service and event attendance
│   ├── outreach/        # Soul winning and follow up tracking
│   └── cells/           # Cell group management
├── components/          # Reusable UI components
├── lib/
│   ├── supabase/        # Database client and queries
│   └── utils/           # Helper functions
└── types/               # TypeScript type definitions
```

---

## Author

Bernard Kojo Tay
[bernardtay.online](https://www.bernardtay.online) · [LinkedIn](https://www.linkedin.com/in/bernard-kojo-tay/) · [GitHub](https://github.com/bheny)
