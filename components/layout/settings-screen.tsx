"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { SignInPrompt } from "@/components/ui/states";
import { Toggle } from "@/components/ui/toggle";
import { ChatView } from "@/components/layout/chat-view";
import { NotificationsView } from "@/components/layout/notifications-view";
import {
  IconArrowLeft,
  IconCheckbox,
  IconCheckboxChecked,
  IconCheckCircle,
  IconSettingsCard,
  IconSettingsBell,
  IconUnlock,
  IconSettingsMessage,
  IconSettingsChevron,
  IconExternalLink,
} from "@/components/ui/icons";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type Section = "subscription" | "notifications" | "privacy" | "help";

const SECTIONS: Array<{
  key: Section;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Figma icon size — message-question is 20px, the rest are 24px. */
  iconSize: string;
}> = [
  {
    key: "subscription",
    title: "Subscription",
    description: "Manage plan details and billing.",
    icon: IconSettingsCard,
    iconSize: "size-6",
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Customize push, email, and live room activity alerts.",
    icon: IconSettingsBell,
    iconSize: "size-6",
  },
  {
    key: "privacy",
    title: "Privacy & Security",
    description: "Control account visibility, data, and permissions.",
    icon: IconUnlock,
    iconSize: "size-6",
  },
  {
    key: "help",
    title: "Help Centre",
    description: "Access FAQs, guidelines, and direct support.",
    icon: IconSettingsMessage,
    iconSize: "size-5",
  },
];

type PrivacyView = "main" | "location" | "chat";
type HelpView = "main" | "terms" | "privacy-policy" | "community-guidelines";

type LocationChoice = "country" | "region-and-country" | "continent";

type ChatMessagesFrom = "no-one" | "everyone" | "verified";

const LOCATION_CHOICES: Array<{ key: LocationChoice; label: string }> = [
  { key: "country", label: "Country" },
  { key: "region-and-country", label: "Region and Country" },
  { key: "continent", label: "Continent" },
];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** A menu row in the left column — 81px tall, icon circle + text + chevron. */
function MenuRow({
  section,
  isActive,
  onClick,
}: {
  section: (typeof SECTIONS)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex h-[81px] w-full items-center justify-between border-b border-white/15 p-6 text-left transition-colors hover:bg-white/[0.03] lg:px-8",
        isActive && "bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Icon className={cn(section.iconSize, "text-create")} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-bold leading-4 text-white">
            {section.title}
          </p>
          <p className="text-[13px] font-normal leading-5 text-white/50 lg:text-sm lg:leading-[16.5px]">
            {section.description}
          </p>
        </div>
      </div>
      <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
    </button>
  );
}

/** A detail row in the right column — text block + trailing control. */
function DetailRow({
  title,
  description,
  trailing,
  onClick,
}: {
  title: string;
  description: string;
  trailing: React.ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 border-b border-white/15 px-8 py-6 text-left",
        onClick && "transition-colors hover:bg-white/[0.03]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
        <p className="text-base font-bold leading-6 text-white">{title}</p>
        <p className="text-[13px] font-normal leading-5 text-white/50 lg:text-sm lg:leading-[16.5px]">
          {description}
        </p>
      </div>
      <div className="shrink-0">{trailing}</div>
    </Tag>
  );
}

/** Back header for sub-views — desktop only. On mobile the SettingsScreen
    renders its own single back button that handles all navigation. */
function BackHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="hidden items-center gap-2 px-8 pt-10 pb-6 lg:flex">
      <button
        onClick={onClick}
        aria-label={`Back to ${label}`}
        className="flex items-center gap-2 text-white transition-colors hover:text-white/70"
      >
        <IconArrowLeft className="size-5" />
        <span className="text-base font-normal">Back</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy & Security — main view
// ---------------------------------------------------------------------------

function PrivacyMain({
  personalizePlaces,
  onPersonalizePlacesChange,
  visibilityOnSpace,
  onVisibilityOnSpaceChange,
  onOpenLocation,
  onOpenChat,
}: {
  personalizePlaces: boolean;
  onPersonalizePlacesChange: (v: boolean) => void;
  visibilityOnSpace: boolean;
  onVisibilityOnSpaceChange: (v: boolean) => void;
  onOpenLocation: () => void;
  onOpenChat: () => void;
}) {
  return (
    <div className="flex flex-col">
      <DetailRow
        title="Personalize based on places you've been"
        description="Personalize your feed based on your sign-up info and locations you visit."
        trailing={
          <Toggle
            checked={personalizePlaces}
            onChange={onPersonalizePlacesChange}
            label="Personalize based on places you've been"
          />
        }
      />
      <DetailRow
        title="Location"
        description="Manage the location associated with your account."
        onClick={onOpenLocation}
        trailing={
          <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
        }
      />
      <DetailRow
        title="Chat"
        description="Manage who can message you directly."
        onClick={onOpenChat}
        trailing={
          <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
        }
      />
      <DetailRow
        title="Visibility on Space"
        description="Allow followers to see which Spaces you're listening to."
        trailing={
          <Toggle
            checked={visibilityOnSpace}
            onChange={onVisibilityOnSpaceChange}
            label="Visibility on Space"
          />
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy — Location sub-view
// ---------------------------------------------------------------------------

function LocationView({
  locationChoice,
  onLocationChoiceChange,
  onBack,
}: {
  locationChoice: LocationChoice;
  onLocationChoiceChange: (v: LocationChoice) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <BackHeader label="Privacy & Security" onClick={onBack} />
      <div className="flex flex-col">
        {LOCATION_CHOICES.map((choice) => {
          const checked = locationChoice === choice.key;
          return (
            <button
              key={choice.key}
              onClick={() => onLocationChoiceChange(choice.key)}
              className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-4 text-left transition-colors hover:bg-white/[0.03]"
            >
              <p className="text-base font-bold leading-6 text-white">
                {choice.label}
              </p>
              {checked ? (
                <IconCheckboxChecked className="size-4 text-spotlight" />
              ) : (
                <IconCheckbox className="size-4 text-white/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

type Plan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  isCurrent?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Square Basic",
    price: "Free",
    description:
      "Kick off your journey with all the basics you need to get started.",
    features: [
      "Access to core Square platform",
      "Meet and network with new people",
      "Access to core AI tools",
      "Access to core Square platform",
      "Meet and network with new people",
      "Access to core AI tools",
    ],
    isCurrent: true,
  },
  {
    name: "King and Queen",
    price: "$100",
    period: "/month",
    description:
      "Kick off your journey with all the basics you need to get started.",
    features: [
      "All basic feature",
      "Profile verification tag",
      "Unlock king and queen badge",
      "Access to core Square platform",
      "Meet and network with new people",
      "Access to core AI tools",
    ],
  },
  {
    name: "Lord Emperor",
    price: "$500",
    period: "/month",
    description:
      "Kick off your journey with all the basics you need to get started.",
    features: [
      "All king and queen feature",
      "Meet and network with new people",
      "Access to core AI tools",
      "Access to core Square platform",
      "Meet and network with new people",
      "Access to core AI tools",
    ],
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6">
      {/* Header row: plan name + CURRENT badge */}
      <div className="flex items-center justify-between">
        <p className="text-base font-medium text-white/50">{plan.name}</p>
        {plan.isCurrent && (
          <span className="rounded-[30px] bg-gradient-to-r from-create to-create-deep px-3 py-1 text-xs font-medium text-white">
            CURRENT
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mt-4 flex items-baseline">
        <span className="text-[40px] font-bold leading-normal text-[#f6f6f6]">
          {plan.price}
        </span>
        {plan.period && (
          <span className="ml-2 text-[17px] font-normal text-white/50 opacity-80">
            {plan.period}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-2 text-sm font-light text-white/50">
        {plan.description}
      </p>

      {/* Features list */}
      <div className="mt-8 flex flex-col gap-4">
        {plan.features.map((feature, i) => (
          <div key={i} className="flex items-center gap-4">
            <IconCheckCircle className="size-4 shrink-0 text-create" />
            <span className="text-base font-normal text-white">{feature}</span>
          </div>
        ))}
      </div>

      {/* Upgrade — only for non-current plans. VISIBLE AND INERT: there is no
          subscription or billing on the service, so a live button would be a
          promise nothing can keep. A real disabled button, with the reason. */}
      {!plan.isCurrent && (
        <button
          type="button"
          disabled
          title="Subscriptions are coming soon"
          className="mt-8 flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-gradient-to-r from-create to-create-deep text-base font-semibold text-[#f6f6f6] opacity-60"
        >
          Upgrade
          <span className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide">
            Coming soon
          </span>
        </button>
      )}
    </div>
  );
}

function SubscriptionDetail() {
  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      {PLANS.map((plan) => (
        <PlanCard key={plan.name} plan={plan} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help Centre detail
// ---------------------------------------------------------------------------

const HELP_ROWS: Array<{
  label: string;
  view?: HelpView;
  external?: boolean;
}> = [
  { label: "Terms of Service", view: "terms" },
  { label: "Privacy Policy", view: "privacy-policy" },
  { label: "Community Guidelines", view: "community-guidelines" },
  { label: "Contact us", external: true },
];

function HelpCentreMain({ onNavigate }: { onNavigate: (v: HelpView) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {HELP_ROWS.map((row) => (
        <button
          key={row.label}
          onClick={() => row.view && onNavigate(row.view)}
          className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-4 text-left transition-colors hover:bg-white/[0.03]"
        >
          <p className="text-base font-bold leading-6 text-white">
            {row.label}
          </p>
          {row.external ? (
            <IconExternalLink className="size-6 shrink-0 text-white/50" />
          ) : (
            <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
          )}
        </button>
      ))}
    </div>
  );
}

function TermsOfServiceView({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <BackHeader label="Help Centre" onClick={onBack} />
      <div className="flex flex-col gap-2 px-8">
        <h3 className="text-[24px] font-semibold leading-normal text-white">
          Terms of Service
        </h3>
        <p className="text-sm leading-[16.5px] text-white/50">
          Created on 8 September, 2026
        </p>
      </div>
      <div className="px-8 pt-8 pb-12 text-[15px] font-normal leading-6 text-white">
        <p className="mb-4 font-bold">1. Acceptance of Terms</p>
        <p className="mb-4">
          By accessing or using Square, Market Square, or Gistrooms
          (collectively, the &quot;Platform&quot;), you agree to be bound by
          these Terms of Service. If you do not agree, you may not access or use
          our services.
        </p>

        <p className="mb-2 font-bold">2. Account Registration &amp; Security</p>
        <ul className="mb-4 list-disc space-y-1 pl-6">
          <li>
            You must be at least 13 years old (or the legal age in your
            jurisdiction) to create an account.
          </li>
          <li>
            You are responsible for safeguarding your login credentials and for
            all activities that occur under your account.
          </li>
          <li>
            You agree to provide accurate, current, and complete profile
            information.
          </li>
        </ul>

        <p className="mb-2 font-bold">3. User Content &amp; Conduct</p>
        <ul className="mb-4 list-disc space-y-1 pl-6">
          <li>
            Ownership: You retain ownership of the content, audio streams, and
            messages you create or host on the Platform.
          </li>
          <li>
            License: By hosting live audio, posting, or sharing content, you
            grant Square a non-exclusive, worldwide, royalty-free license to
            host, display, and distribute your content across the Platform.
          </li>
          <li>
            Prohibited Behavior: You may not host or post content that is
            illegal, harmful, harassing, defamatory, or infringes on third-party
            intellectual property rights. We reserve the right to terminate
            accounts that violate community standards.
          </li>
        </ul>

        <p className="mb-2 font-bold">4. Tips and Digital Transactions</p>
        <ul className="mb-4 list-disc space-y-1 pl-6">
          <li>
            Features such as creator tipping or paid Gistrooms are subject to
            transaction fees where applicable.
          </li>
          <li>
            All tips and virtual purchases are final and non-refundable unless
            required by law.
          </li>
        </ul>

        <p className="mb-2 font-bold">
          5. Service Availability &amp; Modifications
        </p>
        <p className="mb-4">
          We reserve the right to modify, suspend, or discontinue any feature or
          portion of the Platform at any time without prior notice.
        </p>

        <p className="mb-2 font-bold">6. Limitation of Liability</p>
        <p className="mb-4">
          To the maximum extent permitted by law, Square and its affiliates
          shall not be liable for any indirect, incidental, or consequential
          damages resulting from your use of or inability to use the Platform.
        </p>

        <p className="mb-2 font-bold">7. Termination</p>
        <p className="mb-4">
          We reserve the right to suspend or terminate your access to the
          Platform at our sole discretion, without notice, for conduct that
          violates these Terms.
        </p>

        <p className="mb-2 font-bold">8. Governing Law</p>
        <p>
          These Terms are governed by and construed in accordance with applicable
          laws, without regard to conflict of law principles.
        </p>
      </div>
    </div>
  );
}

function HelpSubView({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div>
      <BackHeader label="Help Centre" onClick={onBack} />
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm text-white/50">Coming soon</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel router
// ---------------------------------------------------------------------------

function DetailPanel({
  section,
  personalizePlaces,
  onPersonalizePlacesChange,
  visibilityOnSpace,
  onVisibilityOnSpaceChange,
  privacyView,
  onPrivacyViewChange,
  locationChoice,
  onLocationChoiceChange,
  helpView,
  onHelpViewChange,
  chatMessagesFrom,
  onChatMessagesFromChange,
  chatAllowHouseMembers,
  onChatAllowHouseMembersChange,
  chatAllowPastAudience,
  onChatAllowPastAudienceChange,
  friendsRoom,
  onFriendsRoomChange,
  directNotifications,
  onDirectNotificationsChange,
}: {
  section: Section;
  personalizePlaces: boolean;
  onPersonalizePlacesChange: (v: boolean) => void;
  visibilityOnSpace: boolean;
  onVisibilityOnSpaceChange: (v: boolean) => void;
  privacyView: PrivacyView;
  onPrivacyViewChange: (v: PrivacyView) => void;
  locationChoice: LocationChoice;
  onLocationChoiceChange: (v: LocationChoice) => void;
  helpView: HelpView;
  onHelpViewChange: (v: HelpView) => void;
  chatMessagesFrom: ChatMessagesFrom;
  onChatMessagesFromChange: (v: ChatMessagesFrom) => void;
  chatAllowHouseMembers: boolean;
  onChatAllowHouseMembersChange: (v: boolean) => void;
  chatAllowPastAudience: boolean;
  onChatAllowPastAudienceChange: (v: boolean) => void;
  friendsRoom: boolean;
  onFriendsRoomChange: (v: boolean) => void;
  directNotifications: boolean;
  onDirectNotificationsChange: (v: boolean) => void;
}) {
  if (section === "privacy") {
    if (privacyView === "location") {
      return (
        <LocationView
          locationChoice={locationChoice}
          onLocationChoiceChange={onLocationChoiceChange}
          onBack={() => onPrivacyViewChange("main")}
        />
      );
    }
    if (privacyView === "chat") {
      return (
        <ChatView
          messagesFrom={chatMessagesFrom}
          onMessagesFromChange={onChatMessagesFromChange}
          allowHouseMembers={chatAllowHouseMembers}
          onAllowHouseMembersChange={onChatAllowHouseMembersChange}
          allowPastAudience={chatAllowPastAudience}
          onAllowPastAudienceChange={onChatAllowPastAudienceChange}
          onBack={() => onPrivacyViewChange("main")}
        />
      );
    }
    return (
      <PrivacyMain
        personalizePlaces={personalizePlaces}
        onPersonalizePlacesChange={onPersonalizePlacesChange}
        visibilityOnSpace={visibilityOnSpace}
        onVisibilityOnSpaceChange={onVisibilityOnSpaceChange}
        onOpenLocation={() => onPrivacyViewChange("location")}
        onOpenChat={() => onPrivacyViewChange("chat")}
      />
    );
  }

  if (section === "subscription") {
    return <SubscriptionDetail />;
  }

  if (section === "help") {
    if (helpView === "terms") {
      return <TermsOfServiceView onBack={() => onHelpViewChange("main")} />;
    }
    if (helpView === "privacy-policy") {
      return <HelpSubView title="Privacy Policy" onBack={() => onHelpViewChange("main")} />;
    }
    if (helpView === "community-guidelines") {
      return <HelpSubView title="Community Guidelines" onBack={() => onHelpViewChange("main")} />;
    }
    return <HelpCentreMain onNavigate={onHelpViewChange} />;
  }

  return (
    <NotificationsView
      friendsRoom={friendsRoom}
      onFriendsRoomChange={onFriendsRoomChange}
      directNotifications={directNotifications}
      onDirectNotificationsChange={onDirectNotificationsChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function SettingsScreen({ username }: { username: string }) {
  const { ready, authenticated } = useAuth();
  const me = useMe();
  const router = useRouter();
  /*
    SETTINGS ARE YOUR OWN. The route carries a username, so
    `/u/<someone-else>/settings` is a URL anybody can type — it lands on the
    reader's own settings instead of drawing a page that looks like the other
    person's.
  */
  useEffect(() => {
    if (me.data && me.data.username.toLowerCase() !== username.toLowerCase()) {
      router.replace(`/u/${me.data.username}/settings`);
    }
  }, [me.data, username, router]);
  const [active, setActive] = useState<Section | null>(null);
  const [privacyView, setPrivacyView] = useState<PrivacyView>("main");
  const [helpView, setHelpView] = useState<HelpView>("main");
  const [personalizePlaces, setPersonalizePlaces] = useState(true);
  const [visibilityOnSpace, setVisibilityOnSpace] = useState(true);
  const [locationChoice, setLocationChoice] =
    useState<LocationChoice>("region-and-country");
  const [friendsRoom, setFriendsRoom] = useState(true);
  const [directNotifications, setDirectNotifications] = useState(true);
  const [chatMessagesFrom, setChatMessagesFrom] =
    useState<ChatMessagesFrom>("everyone");
  const [chatAllowHouseMembers, setChatAllowHouseMembers] = useState(false);
  const [chatAllowPastAudience, setChatAllowPastAudience] = useState(false);

  // Reset privacy sub-navigation when leaving privacy
  const selectSection = useCallback(
    (next: Section | null) => {
      if (next !== "privacy") setPrivacyView("main");
      if (next !== "help") setHelpView("main");
      setActive(next);
    },
    [],
  );

  const activeSection = SECTIONS.find((s) => s.key === active);

  /** The right-column title — accounts for privacy sub-views. */
  const rightTitle =
    (active === "privacy" && privacyView !== "main") ||
    (active === "help" && helpView !== "main")
      ? null // sub-views have their own back header
      : activeSection?.title ?? "Settings";

  if (ready && !authenticated) {
    return (
      <div className="px-6 py-10 lg:px-8">
        <SignInPrompt
          title="Sign in to see your settings"
          body="Your notifications, privacy and plan live here."
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(92dvh-var(--ws-crumb-h))] min-h-0 flex-1">
      {/* ---- Left column: settings menu (fixed, never scrolls) ---- */}
      <div
        className={cn(
          "w-full shrink-0",
          active != null
            ? "hidden lg:block lg:max-w-[600px] lg:border-r lg:border-white/10"
            : "block",
        )}
      >
        <div className="px-6 pt-6 pb-[26px] lg:px-8 lg:pt-10 lg:pb-[42px]">
          <h1 className="text-[24px] font-semibold leading-normal text-white">Settings</h1>
        </div>
        <nav className={cn("flex flex-col", active == null && "gap-4")} aria-label="Settings">
          {SECTIONS.map((section) => (
            <MenuRow
              key={section.key}
              section={section}
              isActive={active === section.key}
              onClick={() => selectSection(section.key)}
            />
          ))}
        </nav>
      </div>

      {/* ---- Right column: detail panel ---- */}
      {active != null ? (
        <div className="block w-full min-w-0 flex-1 overflow-y-auto">
          {/* Mobile back — always visible, handles all navigation */}
          <div className="lg:hidden">
            <div className="flex items-center gap-2 px-6 pt-6 pb-4">
              <button
                onClick={() => {
                  if (active === "privacy" && privacyView !== "main") {
                    setPrivacyView("main");
                  } else if (active === "help" && helpView !== "main") {
                    setHelpView("main");
                  } else {
                    selectSection(null);
                  }
                }}
                aria-label="Back"
                className="flex items-center gap-2 text-white transition-colors hover:text-white/70"
              >
                <IconArrowLeft className="size-5" />
                <span className="text-base font-normal">Back</span>
              </button>
            </div>
          </div>

          {/* Desktop header — hidden when location sub-view (it has its own back header) */}
          {rightTitle != null && (
            <div className="hidden px-8 pt-10 pb-[42px] lg:block">
              <h2 className="text-[24px] font-semibold leading-normal text-white">{rightTitle}</h2>
            </div>
          )}

          {/* Mobile section title — 20px on mobile per Figma */}
          {rightTitle != null && (
            <div className="px-6 pb-6 lg:hidden">
              <h2 className="text-xl font-semibold leading-normal text-white">{rightTitle}</h2>
            </div>
          )}

          <DetailPanel
            section={active}
            personalizePlaces={personalizePlaces}
            onPersonalizePlacesChange={setPersonalizePlaces}
            visibilityOnSpace={visibilityOnSpace}
            onVisibilityOnSpaceChange={setVisibilityOnSpace}
            privacyView={privacyView}
            onPrivacyViewChange={setPrivacyView}
            locationChoice={locationChoice}
            onLocationChoiceChange={setLocationChoice}
            helpView={helpView}
            onHelpViewChange={setHelpView}
            chatMessagesFrom={chatMessagesFrom}
            onChatMessagesFromChange={setChatMessagesFrom}
            chatAllowHouseMembers={chatAllowHouseMembers}
            onChatAllowHouseMembersChange={setChatAllowHouseMembers}
            chatAllowPastAudience={chatAllowPastAudience}
            onChatAllowPastAudienceChange={setChatAllowPastAudience}
            friendsRoom={friendsRoom}
            onFriendsRoomChange={setFriendsRoom}
            directNotifications={directNotifications}
            onDirectNotificationsChange={setDirectNotifications}
          />
        </div>
      ) : null}
    </div>
  );
}
