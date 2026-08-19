# Vouch — setup checklist (written for someone who has never done this)

This is everything you need to install, every account you need to create, and
every key you need to paste — in order. Nothing is assumed.

**Time needed:** about 30–40 minutes the first time.
**Cost:** $0. Every account below has a free tier that's plenty for building.

When you're done, `http://localhost:3000/setup` will show all green.

---

## Part 0 — Install two things on your computer

You only ever do this once.

### 0.1 Node.js

Node.js is the program that runs the website on your laptop.

1. Go to <https://nodejs.org> and download the **LTS** version.
2. Run the installer, click through with all the defaults.
3. Open your terminal:
   - **Mac:** press `Cmd + Space`, type `Terminal`, press Enter.
   - **Windows:** press the Start key, type `PowerShell`, press Enter.
4. Type this and press Enter:

   ```bash
   node --version
   ```

   You should see something like `v22.x.x`. If you see "command not found",
   close the terminal, open a new one, and try again.

### 0.2 Git (only if you don't already have it)

Git is how code gets saved to GitHub.

1. Type `git --version`. If you see a version number, you're done — skip ahead.
2. Otherwise download it from <https://git-scm.com/downloads> and install with
   the defaults.

---

## Part 1 — Get the project onto your computer

In your terminal, one line at a time:

```bash
git clone https://github.com/jaymktgagency-coder/job-clearance-.git vouch
cd vouch
git checkout claude/hiring-marketplace-setup-5k3rk2
npm install
```

What just happened, in order: downloaded the code, moved into its folder,
switched to the branch this work lives on, and installed the building blocks the
project depends on. The last one takes a minute or two and prints a lot of text —
that's normal.

---

## Part 2 — Accounts you need to create

Here is the complete list for the *whole* project. **Only #1 is needed today.**
The others are listed now so there are no surprises later; skip them until the
step that needs them.

| # | Account | What it does for Vouch | Needed at | Cost |
|---|---------|------------------------|-----------|------|
| 1 | **Supabase** | Database, user logins, resume file storage | **Step 1 (now)** | Free tier |
| 2 | **Resend** | Sends the voucher's 6-digit verification email | Step 4 — *optional while developing* | Free tier (100 emails/day) |
| 3 | **Anthropic** | Reads resumes, writes fit scores | Step 8 | Pay-as-you-go, a few cents |
| 4 | **Vercel** | Puts the site on the real internet | When you're ready to launch | Free tier |
| 5 | **GitHub** | Stores the code (you already have this) | Already done | Free |
| 6 | ~~Stripe~~ | Payments — **deliberately skipped in v1** | Not yet | — |

---

## Part 3 — Create your Supabase project (do this now)

Supabase is three things at once: your database, your login system, and the
place resume files get stored.

1. Go to <https://supabase.com> and click **Start your project**.
2. Sign in with GitHub (fastest) or an email address.
3. Click **New project**.
4. Fill in the form:
   - **Name:** `vouch`
   - **Database Password:** click **Generate a password**, then **copy it and
     paste it somewhere safe** (a password manager, or a note). You will not be
     shown it again. You don't need it for this step, but you'll want it later.
   - **Region:** pick the one closest to you.
5. Click **Create new project** and wait ~2 minutes while it builds.

### Where to find your three Supabase keys

Once the project is ready:

1. Click the **gear icon** (Project Settings) in the bottom-left sidebar.
2. Click **Data API**. Copy the **Project URL** — it looks like
   `https://abcdefghijkl.supabase.co`.
3. Click **API Keys** in the same settings menu. You'll see two keys:
   - **Publishable** key (older projects label this **anon public**) — safe for
     the public to see.
   - **Secret** key (older projects label this **service_role**) — click the
     eye/reveal button to see it. **Never share this one, never paste it into a
     chat window, never put it in a screenshot.** It can read and change
     everything in your database.

---

## Part 4 — Paste your keys into the project

1. In your terminal, from inside the `vouch` folder, run:

   **Mac / Linux:**

   ```bash
   cp .env.example .env.local
   ```

   **Windows PowerShell:**

   ```powershell
   copy .env.example .env.local
   ```

   This makes your private copy of the key file. The name `.env.local` matters —
   git is configured to never upload that file, so your keys stay yours.

2. Open `.env.local` in a text editor (TextEdit, Notepad, or VS Code).

3. Paste your values after the `=` signs. **No quotes, no spaces around the `=`.**

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxx
   SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxx
   ```

   Right ✅ `NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co`
   Wrong ❌ `NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co"`
   Wrong ❌ `NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co/` (no trailing slash)

4. Save the file.

Leave the Resend / Anthropic lines empty for now. The app expects that.

---

## Part 5 — Run it

```bash
npm run dev
```

You'll see `Ready in ...` and a link. Open <http://localhost:3000> in your
browser.

Then open <http://localhost:3000/setup>. This page is your dashboard for this
whole checklist:

- ✅ = filled in and working
- ❌ = required now, still missing
- ⚪️ = not needed until a later step, ignore it

**Step 1 is complete when the "Step 1 status" card says `Ready` and the
Supabase connection line is green.**

To stop the server, click the terminal and press `Ctrl + C`.

> ⚠️ Any time you change `.env.local`, you must stop the server (`Ctrl + C`) and
> run `npm run dev` again. Keys are only read at startup. This trips up
> everyone at least once.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| `command not found: npm` | Node.js isn't installed, or the terminal was open before you installed it | Close the terminal, open a new one. Reinstall Node if needed. |
| /setup says "Could not reach that address at all" | Typo in the URL, or the Supabase project is paused | Re-copy the Project URL. Check the Supabase dashboard for a "restore project" button — free projects pause after a week of no use. |
| /setup says "the key was rejected" | Wrong key, or only part of it got copied | Re-copy the **publishable** key. It's long — make sure you got all of it. |
| /setup still shows ❌ after pasting keys | The server is still running with the old values | `Ctrl + C`, then `npm run dev` again. |
| `Error: listen EADDRINUSE :::3000` | The site is already running in another terminal window | Close the other window, or run `npm run dev -- -p 3001`. |

---

## Security ground rules

Three habits worth forming now:

1. **Never paste `SUPABASE_SECRET_KEY` anywhere but `.env.local`.** Not into a
   chat, a screenshot, or a support ticket. If it ever leaks, go to Supabase →
   Project Settings → API Keys and rotate it immediately.
2. **Never commit `.env.local` to GitHub.** The project's `.gitignore` already
   blocks it; don't override that.
3. `.env.example` is the safe one — it lists key *names* with no values, so
   other people (and future you) know what to fill in.

---

## Part 6 — Create the database tables (Step 2a)

Your Supabase project is connected but empty. This creates the tables.

### 6.1 Paste the two files

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/migrations/0001_core_schema.sql` from this project in a text
   editor. Select all of it (`Cmd+A` / `Ctrl+A`), copy, and paste it into the
   SQL Editor box.
4. Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`). It should say
   **Success. No rows returned** — that's what success looks like for this kind
   of query.
5. Click **New query** again, and repeat with
   `supabase/migrations/0002_row_level_security.sql`.

Order matters: 0001 builds the tables, 0002 locks them down. Running 0002
first will fail.

> **If you see "type already exists" or "relation already exists":** you've run
> the file twice. That's harmless — the tables are already there. If you'd
> rather start clean, run `drop schema public cascade; create schema public;`
> first, then paste 0001 again. That erases everything in the database, so only
> do it while the data is still fake.

### 6.2 Fill it with demo data

Back in your terminal, in the project folder:

```bash
npm run seed
```

This creates four companies, seven locations, fifteen people, eight jobs, and a
handful of intro requests and vouches. It prints a summary and a list of demo
logins when it finishes.

You can run it as many times as you like — each run wipes the previous demo
data first and starts over. It only ever deletes accounts on `.test` addresses
and the four demo companies, so it can't touch real sign-ups.

### 6.3 Check it worked

```bash
npm run dev
```

Open <http://localhost:3000/setup>. The **Database tables and demo data** line
should now be green and read something like *"Ready: 4 companies, 8 jobs,
4 vouches."*

That's Step 2a done. There are no screens to click through yet — those arrive
in Step 3 (sign-up) onward. To look at the data in the meantime, use the
Supabase dashboard's **Table Editor**.

### Demo logins

Every demo account uses the password **`vouch-demo-1234`**. A few worth knowing:

| Login | What they show you |
|---|---|
| `erin@northgatecoffee.test` | Employer at a fully verified company (green checkmark) |
| `rosa.brightpath@gmail.test` | Employer running on a free email address — no checkmark, uses the invite path |
| `tomas@northgatecoffee.test` | Verified voucher, Ballard store |
| `marisol.private@gmail.test` | Voucher verified by employer invitation, not by work email |
| `lena@verdanthealth.test` | Voucher who never finished verifying — cannot vouch for anyone |
| `jordan@seeker.test` | Seeker sitting at the cap of 5 open requests |
| `nina@seeker.test` | Seeker vouched for by a stranger who read her profile |

---

## Verifying vouchers without an email account

Until you add a Resend key, Vouch doesn't try to send email. The 6-digit
verification code is printed to your terminal **and shown on screen**, so you
can test the whole flow today. The moment `RESEND_API_KEY` and `EMAIL_FROM`
appear in `.env.local`, it switches to real email on its own — no code change.

Codes expire after 10 minutes, burn after 5 wrong guesses, and only a one-way
fingerprint is ever stored.

---

## What's next

Step 2b: the money and reputation tables — hires, payouts, employer charges,
the voucher's public track record, and the abuse flags. Those are meaningless
until there are hires to attach them to, which is why they come second.
