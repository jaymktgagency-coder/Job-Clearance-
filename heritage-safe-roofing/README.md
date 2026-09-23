# Heritage Safe Roofing — website

One-page site for Heritage Safe Roofing, Fort Lauderdale. Next.js 16 + Tailwind CSS v4, no other runtime dependencies.

- **Business details** (phone, address, hours, licence, rating): `src/lib/business.ts`
- **Words** (services, reasons, reviews, storm steps, neighborhoods): `src/lib/content.ts`
- **Colours and fonts**: `src/app/globals.css`
- **Logo**: `src/components/logo.tsx` and `src/app/icon.svg`
- **Google structured data** (RoofingContractor / LocalBusiness): `src/lib/schema.ts`
- **Contact form handler**: `src/app/api/contact/route.ts`

See **PLACEHOLDERS.md** for what still needs real content.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

Deploy: `vercel --prod`. Optional environment variables: `CONTACT_WEBHOOK_URL`, `NEXT_PUBLIC_SITE_URL`.
