export const POLICY_VERSION = '2026-09-29';
export const SUPPORT_EMAIL = 'kal.projects.dev@gmail.com';

export type PolicySlug =
  | 'privacy'
  | 'terms'
  | 'community-guidelines'
  | 'safety'
  | 'reporting-and-appeals'
  | 'contact';

export type Policy = {
  slug: PolicySlug;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

export const POLICIES: Policy[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'How New Catch collects, uses and protects the information of verified JKUAT students.',
    sections: [
      {
        heading: 'JKUAT student verification',
        body: [
          'New Catch is only for JKUAT students. You can join only with an email ending in @student.jkuat.ac.ke, and you must confirm it with a one-time code sent to that address.',
          'To log in you need your password and a fresh one-time code sent to your email every time.',
        ],
      },
      {
        heading: 'Information we collect',
        body: [
          'Account information: your JKUAT student email and your password. Passwords are stored only as a secure hash, never in plain text.',
          'Profile information you choose to add: your name, preferred name, gender, photos, campus, year of study, course, hobbies, interests, music preferences, bio and what you are looking for.',
          'Activity and content: Catches, Swerves, matches, messages, reports and appeals you submit.',
          'Security and legal records: login times, the version of the policies you accepted and when you accepted them.',
        ],
      },
      {
        heading: 'Student email confidentiality',
        body: [
          'Your student email is never shown to other users. While people browse, they see only your preferred name. When someone opens your profile, they see the name you selected to show.',
        ],
      },
      {
        heading: 'How we use information',
        body: [
          'We use your information to verify you, run the app, suggest people through a fixed matching formula (no artificial intelligence), keep the community safe, review reports and appeals, and contact you about your account.',
          'We do not sell your personal information.',
        ],
      },
      {
        heading: 'Profile visibility',
        body: [
          'You control who can see your profile: everyone, people matching your preferences, or hidden. Users you block cannot see or contact you.',
        ],
      },
      {
        heading: 'Data handling and security',
        body: [
          'We protect data with hashed passwords, short-lived single-use codes, secure sessions, rate limiting and restricted administrator access. Only authorised administrators can see account information, and only for moderation and support.',
          'We keep your data while your account exists. When an account is deleted we remove or anonymise personal data, except records we need for safety and audit, such as moderation and appeal records.',
          'If an email is permanently blacklisted, we keep only an irreversible hash of it so it cannot be used to register again.',
          'We handle personal data in line with the data protection laws that apply in Kenya.',
        ],
      },
      {
        heading: 'Your choices and contact',
        body: [
          `You can edit or hide your profile at any time. To access, correct or delete your data, or to ask any privacy question, email ${SUPPORT_EMAIL} from your JKUAT email.`,
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    summary: 'The rules for using New Catch, the JKUAT student social discovery app.',
    sections: [
      {
        heading: 'Who can use New Catch',
        body: [
          'You must be a JKUAT student with a valid @student.jkuat.ac.ke email, and you must be at least 18 years old. One person may have one account.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Give accurate information, keep your password private, and never share the codes we email you. You are responsible for activity on your account.',
        ],
      },
      {
        heading: 'Your content and photos',
        body: [
          'You keep ownership of what you post. By posting, you allow New Catch to display it inside the app as part of the service. Only upload photos of yourself that you have the right to share. Photos may be reviewed and removed.',
        ],
      },
      {
        heading: 'Messaging',
        body: [
          'You can message someone only after you both Catch each other. You can unmatch or block a person at any time.',
        ],
      },
      {
        heading: 'Acceptable behaviour',
        body: [
          'You must follow the Community Guidelines. Harassment, abuse, impersonation, spam and inappropriate content are not allowed.',
        ],
      },
      {
        heading: 'Moderation and enforcement',
        body: [
          'We may remove content, deactivate an account or permanently blacklist an email when these terms or the Community Guidelines are broken. A deactivation can be reversed if an appeal is accepted. A permanent blacklist stops that email from registering again.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'New Catch is still being built and features may change. When policies change, we ask you to accept the new version. Questions: ' +
            SUPPORT_EMAIL +
            '.',
        ],
      },
    ],
  },
  {
    slug: 'community-guidelines',
    title: 'Community Guidelines',
    summary: 'How we expect JKUAT students to treat each other on New Catch.',
    sections: [
      {
        heading: 'Be respectful',
        body: [
          'Treat everyone kindly. Not every Catch is romantic, so respect what people are looking for. If someone says no or stops replying, accept it.',
        ],
      },
      {
        heading: 'No harassment or abuse',
        body: [
          'Do not threaten, bully, stalk, shame or repeatedly contact people who do not want to hear from you. Hate or discrimination based on who someone is has no place here.',
        ],
      },
      {
        heading: 'Be yourself',
        body: [
          'Do not impersonate another person or create fake accounts. Use real information and photos of yourself.',
        ],
      },
      {
        heading: 'No spam or scams',
        body: [
          'Do not advertise, send bulk messages, ask for money, or share links meant to trick people.',
        ],
      },
      {
        heading: 'Keep content appropriate',
        body: [
          'No nudity, sexual content, graphic violence or illegal content in photos, bios or messages.',
        ],
      },
      {
        heading: 'Consequences',
        body: [
          `Breaking these guidelines can lead to removal of content, account deactivation or a permanent blacklist. Questions: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: 'safety',
    title: 'Safety Policy',
    summary: 'Tips and tools to help JKUAT students stay safe on New Catch and when meeting in person.',
    sections: [
      {
        heading: 'Protect your information',
        body: [
          'Do not share your password, one-time codes, home address or financial details. New Catch will never ask for your codes.',
        ],
      },
      {
        heading: 'Meeting in person',
        body: [
          'Meet in a public place, tell a friend where you are going, and arrange your own transport. Leave if you feel uncomfortable.',
        ],
      },
      {
        heading: 'Tools you control',
        body: [
          'You can block a user, unmatch, hide your profile and report anyone who breaks the rules. Blocked users cannot see or contact you.',
        ],
      },
      {
        heading: 'How we keep New Catch safe',
        body: [
          'Only verified JKUAT students can join. Photos and reports are reviewed by moderators. Accounts can be deactivated or permanently blacklisted for serious or repeated violations.',
        ],
      },
      {
        heading: 'Emergencies',
        body: [
          `If you are in immediate danger, contact local emergency services (999 or 112 in Kenya). For other safety concerns, email ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: 'reporting-and-appeals',
    title: 'Reporting and Appeals',
    summary: 'How to report a user and how to appeal a deactivation or blacklist decision.',
    sections: [
      {
        heading: 'Reporting a user',
        body: [
          'Use the Report User form. Choose a reason (harassment, inappropriate content, fake account, spam, impersonation or other), describe what happened and attach a screenshot. Screenshots help moderators act faster.',
        ],
      },
      {
        heading: 'What happens next',
        body: [
          'A moderator reviews the report and the relevant account information. We may take no action, remove content, deactivate an account or permanently blacklist an email. We do not share moderation details publicly.',
        ],
      },
      {
        heading: 'If your account is deactivated',
        body: [
          'When you sign in, you will see a clear notice that an administrator deactivated your account, with the reason, and an Appeal button. Explain why the decision should be reviewed. You will see the result in the app and by email.',
          'Only one appeal can be open at a time. If an appeal is rejected, you can submit another after a waiting period.',
        ],
      },
      {
        heading: 'Permanent blacklisting',
        body: [
          `A blacklisted email cannot register again. If you believe this is a mistake, use the Appeal page to verify your JKUAT email with a code and explain why the decision should be reviewed. You will see the result there and by email. You can also contact ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact and Support',
    summary: 'How to reach New Catch for support, privacy questions, complaints and appeals.',
    sections: [
      {
        heading: 'Contact us',
        body: [
          `Email ${SUPPORT_EMAIL} for general questions, support requests, privacy questions, complaints, appeals and reports.`,
        ],
      },
      {
        heading: 'What to include',
        body: [
          'Tell us the JKUAT email of the account you are writing about and what you need. Add screenshots when they help.',
        ],
      },
    ],
  },
];

export function findPolicy(slug: PolicySlug): Policy {
  return POLICIES.find((policy) => policy.slug === slug) ?? POLICIES[0];
}