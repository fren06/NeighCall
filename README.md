# NeighCall

**A help app for the residents of a housing estate.** Neighbours post what they need help with, the app works out which skill it needs, and the residents who have that skill are told straight away. Requests can be anonymous, everyone is verified by estate management, and management can step in when someone misuses the app.

The app runs on Android and iOS (through Expo Go) and in the browser, from one codebase.

---

## Contents

- [The idea](#the-idea)
- [Features](#features)
- [How a request works](#how-a-request-works)
- [Privacy and safety](#privacy-and-safety)
- [The AI](#the-ai)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Accounts and roles](#accounts-and-roles)
- [Scripts](#scripts)
- [Backend reference (for maintainers)](#backend-reference-for-maintainers)
- [Troubleshooting](#troubleshooting)

---

## The idea

In a big estate, the neighbour who can fix your leaking pipe, jump-start your car or watch your kids for an hour probably lives two floors away, but you have no way of knowing who they are. Group chats are noisy, public and full of people you can't verify.

NeighCall fixes that:

- **Verified neighbours only.** Every account is checked by the estate's admin before it can post or chat.
- **Requests reach the right people.** Residents list their skills when they sign up. When someone posts a request, an AI reads it, files it under a skill (Plumbing, Electrical, IT / WiFi, …) and notifies the residents with that skill.
- **Privacy until you choose to share.** You can post anonymously and chat with a helper without revealing who you are. When you're ready, one tap shares your name, unit and phone number.
- **Management keeps it safe.** Residents can report posts, messages or people. Estate management sees every report and can warn, delete or suspend.

The scope is one estate: everything a resident sees (feed, bulletins, neighbours) is limited to the estate they live in.

---

## Features

### Residents

| Feature | What it does |
| --- | --- |
| Sign up and verification | Sign up with estate, block, unit number, phone and skills, then wait on a "Thanks for joining" page until the admin approves you. The app opens by itself once you're approved. |
| Home feed | Every request in your estate, updated live, with filters: All, For you (matches your skills), Urgent and My posts. Notices from management appear as a carousel at the top. |
| New request | Describe the problem in your own words and add a photo if you like. An AI preview shows the category, urgency, tools a helper should bring, a short alert line and how many neighbours have the matching skill. |
| Anonymous posting | Your post shows as "Neighbor #1234" instead of your name and block. |
| Offer help | Opens a private one-to-one chat with the person who posted. |
| Chats | Live messaging. The person who asked can tap **Share my details** to send their name, unit and phone as one card. |
| Mark as resolved | Updates the request on everyone's feed. |
| Notifications | An in-app bell with a live unread badge: requests that match your skills, offers of help, new messages, bulletins and account changes. |
| Reporting | Report a post, a message or a person. |
| Profile | Edit your details and skills, set quiet hours for notifications, choose light, dark or system theme, reset your password with an emailed code, or delete your account. |
| Suspended accounts | A suspended resident can still read the app, but can't post, help, message or report, and sees a notice explaining why. |

### Estate management

| Tab | What it does |
| --- | --- |
| Overview | Open issues, issues under investigation and active bulletins at a glance, with a shortcut to notify residents. |
| Issues | Every report, with the full context, including who wrote an anonymous post (only management can see this). Actions: warn the person, delete the post or suspend the account. |
| Bulletins | Publish estate notices (for example, "Water cut tomorrow"). Mark them **Important** or **Pin** them. They appear on every resident's home screen and in their notifications. |

### Admin

| Tab | What it does |
| --- | --- |
| Dashboard | Numbers for the estate: awaiting approval, open reports, approved residents, management staff, rejected / suspended. Shortcut to add a resident. |
| Users | Approve, reject or request more info from a new resident (with a note). Suspend and restore access. Add resident or management accounts, edit details and change a user's email. |
| Reports | The same reports and actions as management. |

---

## How a request works

```
Resident signs up  →  waits for approval  →  admin approves  →  app opens with a welcome notification
        ↓
Resident taps +  →  types the problem  →  AI suggests category, urgency, tools and an alert line
        ↓
Posts (optionally anonymously)
        ↓
Neighbours with the matching skill get a notification; the post appears on every feed instantly
        ↓
A neighbour taps Offer help  →  private chat opens
        ↓
Asker taps Share my details (optional)  →  helper receives name, unit and phone in one card
        ↓
Problem fixed  →  asker marks it Resolved  →  updates on everyone's feed
```

---

## Privacy and safety

Privacy is enforced in the database, not just hidden in the app:

- **Residents never read the `posts` table directly.** They read a `feed_posts` view that returns the anonymous alias but never the author's id, name or block.
- **Row Level Security (RLS)** is on for every table. A resident can only see data from their own estate, and only once they're approved.
- **Sensitive actions go through database functions** (`create_post`, `offer_help`, `send_message`, `share_identity`, `moderate`, …) that check who is calling and return only what that person is allowed to see.
- **Live updates carry no content.** The feed, chats and notification bell listen on Supabase Realtime, but the database only sends an empty "changed" ping. The app then re-fetches through the secure views, so nothing about a post or its author travels over the live channel.
- **Photos are stored under the estate's folder with a random file name**, never the uploader's id, so a photo can't give away who wrote an anonymous post.
- **The AI never sees the block number of an anonymous post**, because that could narrow down who wrote it.
- **Staff accounts can't be created from the sign-up screen.** Roles and approval status are locked columns that only an admin can change.
- **The app only holds the publishable Supabase key.** Anything that needs the secret key (creating accounts, changing emails) runs in a server-side Edge Function.

---

## The AI

When a resident types a request, the app calls the **`analyze-post`** Supabase Edge Function. It sends the text to an **Ollama** model (default `gemma4:31b` on Ollama's cloud API) and asks for:

- `category`: one of the 12 skills, or `other`
- `urgency`: `low`, `medium` or `high`
- `tools_needed`: up to 5 tools a helper should bring
- `punchline`: a short, friendly alert line for the notification

Requests can be in English, Malay or a mix of both. The function only answers approved residents, and the Ollama key stays on the server.

**Posting never depends on the AI.** If the function is unreachable or skips a field, an on-device keyword matcher ([lib/mock-ai.ts](lib/mock-ai.ts)) fills in the gap.

---

## Tech stack

### App

| Area | Technology |
| --- | --- |
| Framework | [Expo](https://expo.dev) SDK 56, [React Native](https://reactnative.dev) 0.85, React 19 |
| Language | TypeScript |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routes, typed routes) |
| Styling | [NativeWind](https://www.nativewind.dev) 5 + [Tailwind CSS](https://tailwindcss.com) 4 |
| UI components | [gluestack-ui](https://gluestack.io) v5 (in [components/ui/](components/ui/)) |
| Icons | [lucide-react-native](https://lucide.dev) |
| Animation | React Native Reanimated 4, Legend Motion |
| Dates and times | date-fns, @react-native-community/datetimepicker |
| Photos | expo-image-picker |
| Local storage | AsyncStorage (keeps you signed in) |
| Web | react-native-web, rendered by Metro |

### Backend: [Supabase](https://supabase.com)

| Service | Used for |
| --- | --- |
| Postgres | All data: estates, users, posts, conversations, messages, bulletins, reports, notifications |
| Row Level Security + SQL functions | Every permission and privacy rule (see [supabase/migrations/](supabase/migrations/)) |
| Auth | Email and password sign-in; password reset with a code sent by email |
| Realtime (broadcast) | Live feed, chats and notification badge |
| Storage | Post photos (`post-media` bucket) |
| Edge Functions (Deno) | `analyze-post` (the AI) and `admin-users` (account changes that need the secret key) |

### AI

| Service | Used for |
| --- | --- |
| [Ollama](https://ollama.com) cloud API | Sorting requests (default model `gemma4:31b`) |

### Tooling

npm, Metro bundler, Babel, PostCSS, Jest (jest-expo), Git and GitHub.

---

## Project structure

```
NeighCall/
├── app/                        Screens (Expo Router: each file is a route)
│   ├── index.tsx               Sends you to the right place for your role and status
│   ├── (auth)/                 Welcome, sign in, sign up, pending approval, forgot password
│   ├── (app)/                  Resident app
│   │   ├── (tabs)/             Home, Chats, Profile
│   │   ├── new-post.tsx        New request with the AI preview
│   │   ├── post/[id].tsx       A single request
│   │   ├── chat/[id].tsx       A conversation
│   │   └── notifications.tsx
│   ├── (management)/           Estate manager: Overview, Issues, Bulletins
│   └── (admin)/                Admin: Dashboard, Users, Reports
├── components/
│   ├── feed/                   Post cards, bulletin banner and carousel
│   ├── chat/                   Message bubbles
│   ├── form/                   Text fields, estate picker, skill picker, time picker
│   ├── management/             Issues screen and filter chips
│   └── ui/                     gluestack-ui components
├── lib/
│   ├── supabase.ts             The Supabase client
│   ├── api.ts                  Every call to the backend (screens only use this)
│   ├── session.tsx             Signed-in user and live account status
│   ├── inbox.tsx               Notifications and unread badge
│   ├── mock-ai.ts              Keyword matcher used when the AI is unavailable
│   └── theme*.ts(x)            Light / dark / system theme
├── types/models.ts             Shared types, skills list and role helpers
├── supabase/
│   ├── migrations/             Database schema, security rules and functions (run in order)
│   ├── functions/              Edge Functions: analyze-post, admin-users
│   ├── seed.sql                Starting estates and how to make the first admin
│   └── config.toml
├── assets/                     Icons, splash screen, fonts
├── .env.example                Template for .env.local
└── app.json                    Expo app settings
```

---

## Getting started

These steps connect you to the team's existing Supabase backend, so you see the same estates and data as the rest of the team.

### What you need first

1. **[Node.js](https://nodejs.org) 22 LTS or newer** (we use Node 24). npm comes with it.
2. **[Git](https://git-scm.com/downloads)**
3. **To open it on a phone:** the **Expo Go** app ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)). It must support Expo SDK 56, so update it if it's old.
   **To open it in a browser:** nothing extra.

Check that Node and Git are installed:

```bash
node -v
git --version
```

### Install and run

Pick the block for your terminal, then copy and paste the whole block.

**macOS, Linux or Git Bash on Windows**

```bash
git clone https://github.com/fren06/NeighCall.git
cd NeighCall
npm install
cat > .env.local <<'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://btwglysbwyewozfccwat.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_96XusvxRop43DAhxAZiUJA_G9uXGyJE
EOF
npx expo start
```

**Windows PowerShell**

```powershell
git clone https://github.com/fren06/NeighCall.git
cd NeighCall
npm install
@"
EXPO_PUBLIC_SUPABASE_URL=https://btwglysbwyewozfccwat.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_96XusvxRop43DAhxAZiUJA_G9uXGyJE
"@ | Set-Content -Encoding ascii .env.local
npx expo start
```

> The key above is Supabase's **publishable** key. It's designed to be public, since it ships inside the app anyway, and every rule is enforced by the database. Never put a secret or `service_role` key in `.env.local` or in git.

### Open the app

When `npx expo start` is running, the terminal shows a QR code.

- **Phone:** Android: scan the QR code with Expo Go. iOS: scan it with the Camera app. Your phone and computer must be on the **same Wi-Fi**. If they can't be, stop the server with `Ctrl+C` and run `npx expo start --tunnel` instead.
- **Browser:** press **`w`** in the terminal, or open http://localhost:8081.

To run it again later, you only need:

```bash
cd NeighCall
npx expo start
```

After pulling new changes from GitHub, install any new packages first:

```bash
git pull
npm install
npx expo start -c
```

(`-c` clears Metro's cache, which fixes most "it worked before" problems.)

---

## Accounts and roles

There are three roles:

| Role | Lands on | How the account is made |
| --- | --- | --- |
| Resident | Home feed | Signs up in the app, then an admin approves them |
| Management | Overview / Issues / Bulletins | Added by an admin in the app |
| Admin | Dashboard / Users / Reports | Promoted in the database (see below) |

**To get in as a new resident:** open the app → **Sign up** → choose your estate and fill in your details and skills → you'll wait on the "Thanks for joining" page. Ask an admin on the team to approve you in the **Users** tab. The app opens by itself as soon as you're approved.

Account statuses: `pending` → `approved`, or `needs_info` / `rejected`. An approved account can later be `suspended` (read-only) and restored.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npx expo start` (or `npm start`) | Starts the dev server (phone + browser) |
| `npx expo start --tunnel` | Same, but works when your phone is on a different network |
| `npx expo start -c` | Starts with a cleared cache |
| `npm run web` | Starts and opens the browser |
| `npm run android` / `npm run ios` | Starts and opens an emulator or simulator, if you have one |
| `npm run build` | Exports the web version to `dist/` |
| `npm test` | Runs Jest |

---

## Backend reference (for maintainers)

You don't need any of this to run the app on the team's backend. It's here for whoever manages the Supabase project, or for anyone setting up a fresh copy.

### Database

Run the files in [supabase/migrations/](supabase/migrations/) **in order** in the Supabase SQL Editor (or with `npx supabase db push` after `npx supabase link`):

| File | What it adds |
| --- | --- |
| `0001_init.sql` | Tables, enums and the first Row Level Security policies |
| `0002_hardening.sql` | Privacy fixes; the secure functions the app calls; reports and moderation; the `post-media` storage bucket |
| `0003_live_feed.sql` | Live feed pings |
| `0004_notifications.sql` | The notifications table and the triggers that fill it |
| `0005_suspended_residents.sql` | Read-only access for suspended residents |

Then run [supabase/seed.sql](supabase/seed.sql) to add the starting estates.

**Making the first admin:** sign up in the app as a normal resident, then run this in the SQL Editor with your email:

```sql
update users set role = 'admin', status = 'approved'
where email = 'you@example.com';
```

### Edge Functions

```bash
npx supabase login
npx supabase link --project-ref btwglysbwyewozfccwat
npx supabase functions deploy analyze-post --no-verify-jwt
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase secrets set OLLAMA_API_KEY=your-ollama-key
```

- JWT verification is off because each function checks the caller itself.
- `OLLAMA_API_KEY` is required for the AI. `OLLAMA_MODEL` is optional (default `gemma4:31b`).
- `admin-users` uses the project's secret key, which Supabase provides to Edge Functions automatically. Nothing to set.

### Auth emails

Password reset uses a **code**, not a link, so it works in Expo Go and on another device. In **Authentication → Email Templates → Reset Password**, the email must include `{{ .Token }}`.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Red screen: **"Missing Supabase settings"** | `.env.local` is missing or in the wrong folder. It must sit next to `package.json`. Recreate it (see [Install and run](#install-and-run)), then restart with `npx expo start -c`. |
| `npm install` fails with peer dependency errors | Make sure you're inside the `NeighCall` folder, where the repo's `.npmrc` turns on `legacy-peer-deps`. |
| Phone can't connect / stuck loading | Put the phone and computer on the same Wi-Fi, or use `npx expo start --tunnel`. |
| Expo Go says the project is incompatible | Update Expo Go from the app store. The project uses SDK 56. |
| **EMFILE: too many open files** on Windows | Already limited in [metro.config.js](metro.config.js). If it still happens, run `npx expo start -c --max-workers 2`. |
| Broke after a `git pull` | Run `npm install`, then `npx expo start -c`. |
| Stuck on "Thanks for joining" | Your account is waiting for approval. Ask an admin to approve you. |
| AI preview is missing or basic | The AI function is unavailable, so the keyword matcher is filling in. Posting still works. |
