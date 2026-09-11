/**
 * The Help Centre's policy pages, as data.
 *
 * Written for what Square actually does today — in-app, push and daily email notifications, no
 * tracked location, KASH as the only payment rail, houses and gist rooms — so
 * nothing here promises a practice the product does not have. A standard
 * first version pending legal review; change the words here, not in the view.
 */

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  points?: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  updated: "Updated 11 September, 2026",
  sections: [
    {
      heading: "What this covers",
      paragraphs: [
        "This policy explains what Square collects when you use it, why, who can see it, and the choices you have.",
      ],
    },
    {
      heading: "What you give us",
      points: [
        "Sign-in details, handled by our sign-in provider when you create an account.",
        "Profile details you choose to add: name, username, bio, photos, city, region, country and gender.",
        "What you create: posts, comments, messages, uploads, and the audio or video you broadcast in a room.",
      ],
    },
    {
      heading: "What we record as you use Square",
      points: [
        "Actions such as follows, likes, winks, reposts, bookmarks and the rooms you join.",
        "Views of posts, and views of profiles unless you browse privately.",
        "Tips, KASH purchases and tickets, so payments can be completed and shown to you.",
        "Basic technical data needed to keep the service running and secure.",
      ],
    },
    {
      heading: "Your location",
      paragraphs: [
        "Square does not track where you are. The place on your profile is only what you enter, or a one-time lookup of your city and region if you ask for it; no coordinates are kept.",
        "You decide how much of that place other people see in Settings → Privacy & Security → Location.",
      ],
    },
    {
      heading: "How we use it",
      points: [
        "To run Square's features, such as your feed, chats, houses and gist rooms.",
        "To personalize what you see from your interests, the people you follow and, if you allow it, the place on your profile.",
        "To send the notifications you have switched on: in the app, as push notifications on devices you allow, and an optional daily email summary to your sign-in email.",
        "To keep people safe, review reports and prevent abuse.",
      ],
    },
    {
      heading: "Who can see what",
      points: [
        "Your public profile and posts can be seen by anyone, including people who are not signed in.",
        "Direct messages are visible only to the people in that chat, and a private house only to its members.",
        "Settings let you limit who can message you, how much of your location shows, and whether followers see the rooms you are in.",
      ],
    },
    {
      heading: "Sharing",
      paragraphs: [
        "We do not sell your personal information. We share it only with providers that help us run Square, such as hosting media, running live rooms, sign-in and payments, or when the law requires it.",
      ],
    },
    {
      heading: "Your choices",
      points: [
        "Edit or delete your posts, and remove chats from your inbox.",
        "Block or report people, and change your notification and privacy settings at any time.",
        "Ask us to delete your account by contacting support.",
      ],
    },
    {
      heading: "Keeping it safe",
      paragraphs: [
        "We protect your information with reasonable security measures and keep it while your account is active, or longer only where safety or the law requires.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: ["Questions about this policy can be sent to support@tsionark.com."],
    },
  ],
};

export const COMMUNITY_GUIDELINES: LegalDocument = {
  title: "Community Guidelines",
  updated: "Updated 11 September, 2026",
  sections: [
    {
      heading: "Be respectful",
      paragraphs: [
        "Square is for meeting people and talking openly. Disagree with ideas, not with the people who hold them.",
      ],
    },
    {
      heading: "No harassment or hate",
      points: [
        "Do not threaten, bully, stalk or repeatedly contact someone who has not welcomed it.",
        "Do not attack people for who they are, including their ethnicity, religion, gender, sexuality or disability.",
      ],
    },
    {
      heading: "Be yourself",
      points: [
        "Do not pretend to be another person, brand or organization.",
        "Verification badges are reviewed by our team. Do not imitate one in your name, photo or bio.",
      ],
    },
    {
      heading: "No scams",
      points: [
        "Do not mislead people to get KASH, tips, tickets or personal details.",
        "Do not promote fake giveaways, schemes that promise guaranteed returns, or links that steal information.",
      ],
    },
    {
      heading: "Keep it safe",
      points: [
        "No content that sexualizes minors, ever.",
        "No sexually explicit content, graphic violence, or anything that encourages self-harm or dangerous acts.",
        "Do not share someone else's private information without their permission.",
      ],
    },
    {
      heading: "Rooms and houses",
      points: [
        "Hosts and house owners set the tone: keep rooms on topic and step in when a conversation turns abusive.",
        "Speak only when you have been given the mic, and respect a host's decision to remove someone.",
      ],
    },
    {
      heading: "No spam",
      points: [
        "Do not post the same thing repeatedly, mass-message people, or use automated accounts to inflate activity.",
      ],
    },
    {
      heading: "Respect ownership",
      paragraphs: ["Only post content you created or have the right to share."],
    },
    {
      heading: "Reporting and enforcement",
      paragraphs: [
        "Use Report on any post, comment or profile, and Block to stop someone reaching you. We review reports and may remove content, limit features, or suspend accounts that break these guidelines.",
      ],
    },
  ],
};
