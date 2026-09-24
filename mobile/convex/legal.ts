import { httpAction } from './_generated/server';

/**
 * The two public pages Google Play asks for in the store listing: a privacy
 * policy, and a page explaining how to delete an account that works for
 * someone who no longer has the app installed.
 *
 * Served from the deployment so they exist the moment the backend does, at
 *
 *     https://<deployment>.convex.site/privacy
 *     https://<deployment>.convex.site/delete-account
 *
 * The contact address comes from `SUPPORT_EMAIL` on the deployment rather than
 * from this file, so a placeholder can never go live by accident: until it is
 * set, both pages carry a banner saying they are a draft.
 *
 * Every statement here is meant to be checkable against the code. When a
 * feature starts collecting something new or sending it somewhere new, this
 * text changes in the same commit - and so does the Data safety form in the
 * Play Console, which has to agree with it.
 */

const APP_NAME = 'MyCoach / MyCaddie';
const COMPANY = 'Dominus Golf';
const EFFECTIVE_DATE = '23 September 2026';

function contact(): { email: string | null; html: string } {
  const email = process.env.SUPPORT_EMAIL?.trim() || null;
  return {
    email,
    html: email
      ? `<a href="mailto:${escape(email)}">${escape(email)}</a>`
      : '<strong>[contact email not yet set]</strong>',
  };
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(title: string, body: string, draft: boolean): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} - ${escape(APP_NAME)}</title>
<style>
  :root { color-scheme: light dark; --bg: #faf8f4; --fg: #1d1b18; --muted: #6b655c; --accent: #9a7a3c; --rule: #e4ded3; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #141311; --fg: #ece7de; --muted: #a39c90; --accent: #c5a059; --rule: #2d2a25; }
  }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 600; font-size: 2rem; line-height: 1.2; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; }
  p, li { color: var(--fg); }
  .meta { color: var(--muted); margin: 0 0 2rem; }
  .draft { border: 2px solid #c0392b; color: #c0392b; padding: .75rem 1rem; border-radius: .5rem; margin-bottom: 2rem; font-weight: 600; }
  a { color: var(--accent); }
  ul, ol { padding-left: 1.25rem; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0 1rem; }
  footer { color: var(--muted); font-size: .9rem; }
</style>
</head>
<body><main>
${draft ? '<div class="draft">Draft - the contact address has not been set yet. Not for publication.</div>' : ''}
${body}
<hr>
<footer>${escape(APP_NAME)} is made by ${escape(COMPANY)}.</footer>
</main></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export const privacyPolicy = httpAction(async () => {
  const { email, html: reach } = contact();

  return page(
    'Privacy Policy',
    `
<h1>Privacy Policy</h1>
<p class="meta">${escape(APP_NAME)} &middot; Effective ${EFFECTIVE_DATE}</p>

<p>${escape(APP_NAME)} ("the app") is a golf coaching and on-course caddie app made by
${escape(COMPANY)} ("we", "us"). This policy explains what the app collects, why, who
processes it for us, and how you can delete it.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Account details.</strong> Your email address. If you sign up with a password,
  we store a one-way hash of it, never the password itself. If you sign in with Google, we
  receive the name, email address and profile picture your Google account shares.</li>
  <li><strong>Your golfer profile.</strong> The display name, skill level, handicap, goals,
  coach and club distances you enter.</li>
  <li><strong>Your golf activity.</strong> Rounds and scores, practice sessions, skills tests,
  logged shots, launch monitor sessions and any custom courses you add.</li>
  <li><strong>Swing videos.</strong> Clips you record or choose from your phone, and still
  frames taken from them for analysis.</li>
  <li><strong>Coach conversations.</strong> The messages you send your coach and the replies
  it writes.</li>
  <li><strong>Voice.</strong> When you tap the microphone, your speech is sent to be turned
  into text. We do not keep the recording: it is deleted as soon as it has been transcribed,
  or streamed without being stored at all.</li>
  <li><strong>Spoken replies.</strong> When you tap "Hear it", the reply is turned into audio,
  which we store so the same words are not generated twice.</li>
  <li><strong>Reports.</strong> If you report something the AI wrote, we keep a copy of it and
  the reason you gave.</li>
</ul>

<p>The app does not collect your location, contacts or advertising identifier. It shows no
ads, and we do not sell your data or share it for advertising.</p>

<h2>How we use it</h2>
<p>Only to run the app for you: to keep your history, work out your handicap and statistics,
personalise coaching and caddie advice, analyse your swing, and review reports of AI content.</p>

<h2>Who processes it for us</h2>
<ul>
  <li><strong>Convex</strong> hosts the app's database and file storage. Everything listed
  above is stored there.</li>
  <li><strong>OpenAI</strong> generates the coach's replies, the swing analysis and the
  caddie's answers, transcribes your voice, and produces spoken audio. To do that it receives
  your messages, a summary of your golf data, swing frames and voice recordings. Under
  OpenAI's API terms, this data is not used to train its models.</li>
  <li><strong>Google</strong> handles sign-in if you choose "Continue with Google".</li>
  <li><strong>Expo</strong> delivers app updates. When checking for one, the app sends the
  version it is running and a random identifier for the installation - nothing that
  identifies you.</li>
</ul>
<p>Data is sent over encrypted connections. These providers may process it in the United
States.</p>

<h2>AI-generated content</h2>
<p>Coaching replies, swing analysis and caddie answers are written by an AI model. They can be
wrong. Use your own judgement, and use "Report" on anything harmful or misleading.</p>

<h2>How long we keep it</h2>
<p>Until you delete it, or delete your account. Deleting a swing video or clearing a
conversation removes it straight away.</p>

<h2>Deleting your account</h2>
<p>In the app, open <strong>Profile</strong> and tap <strong>Delete Account</strong>. You are
signed out immediately and everything listed above is permanently deleted within minutes.
If you no longer have the app, see <a href="/delete-account">how to request deletion</a>.</p>

<h2>Children</h2>
<p>The app is not directed at children under 13, and we do not knowingly collect data from
them. If you believe a child has created an account, contact us and we will delete it.</p>

<h2>Changes</h2>
<p>If this policy changes, we will update the date above, and tell you in the app if the
change is significant.</p>

<h2>Contact</h2>
<p>Questions or requests: ${reach}.</p>
`,
    email === null,
  );
});

export const deleteAccountPage = httpAction(async () => {
  const { email, html: reach } = contact();
  const subject = encodeURIComponent(`Delete my ${APP_NAME} account`);

  return page(
    'Delete your account',
    `
<h1>Delete your account</h1>
<p class="meta">${escape(APP_NAME)} by ${escape(COMPANY)}</p>

<h2>In the app</h2>
<ol>
  <li>Open ${escape(APP_NAME)} and sign in.</li>
  <li>Go to the <strong>Profile</strong> tab.</li>
  <li>Tap <strong>Delete Account</strong>, then <strong>Delete</strong> to confirm.</li>
</ol>
<p>You are signed out on every device straight away.</p>

<h2>Without the app</h2>
<p>Email ${reach}${email ? ` with the subject "<a href="mailto:${escape(email)}?subject=${subject}">Delete my account</a>"` : ''}
from the address you signed up with. We will confirm by reply and delete the account within
30 days.</p>

<h2>What is deleted</h2>
<p>Everything: your sign-in details, profile, rounds and scores, practice sessions, skills tests,
shots, launch monitor sessions, custom courses, swing videos and their frames, coach
conversations, spoken replies generated for you, and any reports you made. Nothing is kept
afterwards. Signing up again with the same address starts a new, empty account.</p>

<p>See the <a href="/privacy">privacy policy</a> for what the app collects.</p>
`,
    email === null,
  );
});
