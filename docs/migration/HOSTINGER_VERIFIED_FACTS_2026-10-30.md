# Hostinger compatibility evidence — 30 October 2026

Status: candidate identified, purchase not recommended yet. No account, deployment, DNS or payment changes were made. A public, unsubmitted cart was used only to read a 12-month quote; no contact/payment details were entered and Continue was not clicked.

## Candidate and actual annual quote

The India Node.js landing page currently offers **Unlimited**, the renamed Business web tier. Its public cart, with 12 months selected, displayed ₹299/month: ₹3,588 hosting + ₹645.84 tax = **₹4,233.84 first-year total**. Renewal shown: ₹649/month for 12 months, or ₹7,788 before tax. At the same 18% tax, renewal would calculate to ₹9,189.84; this tax-inclusive renewal is a calculation, not a guaranteed future quote. No paid add-ons were selected. Existing domain renewals and any paid email service remain separate.

The previously observed ₹199/₹249 headline rates require 48 months; they must not be multiplied by 12 and presented as annual purchase prices. Quotes changed between the website's rendered/search versions during this review, so the saved cart screenshot is the evidence for the specific annual amount, not a permanent price promise. Evidence outside Git: `outputs/HOSTINGER_12_MONTH_QUOTE.jpg`. [Official Node.js plan page](https://www.hostinger.com/in/nodejs-hosting).

## What official documentation establishes

- Unlimited includes five Node.js websites, two CPU cores, 3 GB RAM, 50 GB disk, 150 databases, a 3 GB limit per database, 75 connections per database user and 600,000 inodes. These are shared account resources, not allocations to each app. The two applications would consume two app slots when each TanStack Start frontend/server is packaged as one Node application. [Plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).
- Web/Cloud databases are MariaDB, despite being labeled MySQL in parts of the interface. The documented default port is 3306. Exact server version and SQL feature/privilege availability on the purchased account are still unverified. [Database engine](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/).
- Managed Node.js supports Node 24 and an Other framework option with an explicit entry file/output directory. TanStack Start is not explicitly named. Our proposed values are `npm run build:node`, `.output` and `.output/server/index.mjs`; their behavior on Hostinger still requires an account-specific staging rehearsal. Both repositories belong to the same GitHub account, compatible with the documented one-GitHub-account-per-plan restriction. [Node deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).
- Managed Node requests stop at 120 seconds; inbound WebSockets and continuously running background workers are unsupported. The app/process/thread/memory budgets are shared. Domain and www can each consume a separate Node process. [Node limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/).
- Database credentials can be supplied as server environment variables, with 127.0.0.1 documented as the managed database host. Separate restricted users are still required. [Node database connection](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).

## Remaining compatibility evidence before recommending purchase

1. Measure combined built-app memory, CPU, thread count and upload/import workloads after all runtime replacements are complete. Successful local builds alone are insufficient.
2. Confirm TanStack/Nitro ESM startup, SSR/server-function serialization, reverse-proxy origin handling, secure cookies, webhook raw bodies and environment behavior using the exact managed Node entry settings.
3. Confirm managed MariaDB version, FK/CHECK/JSON/UUID/DDL/transaction behavior, migration-user privileges and backup restoration against the committed schema. Do not assume local 11.8 behavior from the product label.
4. Verify a private, persistent media directory survives restart, deployment, rollback and backup restore. Current local storage deliberately sits outside repositories; an ephemeral build directory is unsuitable. Confirm media size/range limits.
5. Review long scientific/AI/voice streams and any extraction/price/background workloads against the 120-second and worker restrictions. Preserve features; do not silently remove them to fit shared hosting.
6. Verify SMTP/reset/verification delivery, OAuth redirects, separate domains, SSL, backups, job scheduling and recovery. Actual Razorpay provider testing remains deferred and therefore unverified.

## Hostinger VPS fallback, not a purchase recommendation

Hostinger KVM 2 is a plausible fallback if managed runtime/storage/database restrictions block required behavior: the official India page currently lists two vCPUs, 8 GB RAM, 100 GB NVMe and 8 TB bandwidth, with root access to configure Node/MariaDB. Its displayed offer is ₹18,696 for **24 months**, renewing at ₹1,199/month for the same term; this is not an annual quote. System patching, firewalls, process supervision, TLS, mail and off-server backups would need explicit operational ownership. [Official VPS plans](https://www.hostinger.com/in/vps-hosting).

No provider switch is proposed. Complete local business workflows first, resolve the evidence above, then present a final eligible-plan comparison and approval request before any purchase.
