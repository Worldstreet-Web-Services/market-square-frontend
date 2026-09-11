"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { SignInPrompt } from "@/components/ui/states";
import { Toggle } from "@/components/ui/toggle";
import { ColumnHeader } from "@/components/layout/column-header";
import { ChatView } from "@/components/layout/chat-view";
import { HOUSE_SAVE_LIVE, PRIVACY_SAVE_LIVE, SAVING_SOON } from "@/components/layout/settings-copy";
import { errorCode } from "@/lib/api/envelope";
import { useSettings, useUpdateSettings } from "@/features/settings";
import { NotificationsView } from "@/components/layout/notifications-view";
import {
  HouseNotificationsView,
  type GistroomNotifFrom,
  type MessageNotifFrom,
} from "@/components/layout/house-notifications-view";
import {
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

/*
  SETTINGS SIT IN THE SAME COLUMN AS HOME.

  It was a WIDE route with its own two-column master-detail layout and its own
  24px headings, so it spread past the column and dropped the right rail —
  "it look as if it is wider, even the heading is not using the normal
  header". Now it is the 600 column with the rail beside it, opened by the
  shared `ColumnHeader`, and it drills in one level at a time: the menu, a
  section, a sub-page. The header's back arrow steps back up those levels, and
  from the menu itself leaves the page like every other column surface.
*/

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

const LOCATION_CHOICES: Array<{ key: LocationChoice; label: string }> = [
  { key: "country", label: "Country" },
  { key: "region-and-country", label: "Region and Country" },
  { key: "continent", label: "Continent" },
];

const HELP_TITLES: Record<Exclude<HelpView, "main">, string> = {
  terms: "Terms of Service",
  "privacy-policy": "Privacy Policy",
  "community-guidelines": "Community Guidelines",
};

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** A menu row — 81px tall, icon circle + text + chevron. */
function MenuRow({
  section,
  onClick,
}: {
  section: (typeof SECTIONS)[number];
  onClick: () => void;
}) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className="flex h-[81px] w-full items-center justify-between border-b border-white/15 px-4 py-6 text-left transition-colors hover:bg-white/[0.03]"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Icon className={cn(section.iconSize, "text-create")} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-base font-bold leading-4 text-white">
            {section.title}
          </p>
          <p className="text-[13px] font-normal leading-5 text-white/50">
            {section.description}
          </p>
        </div>
      </div>
      <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
    </button>
  );
}

/** A detail row — text block + trailing control. */
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
        "flex w-full items-center gap-4 border-b border-white/15 px-4 py-6 text-left",
        onClick && "transition-colors hover:bg-white/[0.03]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
        <p className="text-base font-bold leading-6 text-white">{title}</p>
        <p className="text-[13px] font-normal leading-5 text-white/50">
          {description}
        </p>
      </div>
      <div className="shrink-0">{trailing}</div>
    </Tag>
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
            disabled={!PRIVACY_SAVE_LIVE}
            title={PRIVACY_SAVE_LIVE ? undefined : SAVING_SOON}
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
            disabled={!PRIVACY_SAVE_LIVE}
            title={PRIVACY_SAVE_LIVE ? undefined : SAVING_SOON}
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
}: {
  locationChoice: LocationChoice;
  onLocationChoiceChange: (v: LocationChoice) => void;
}) {
  return (
    <div className="flex flex-col">
      {LOCATION_CHOICES.map((choice) => {
        const checked = locationChoice === choice.key;
        return (
          <button
            key={choice.key}
            onClick={() => onLocationChoiceChange(choice.key)}
            disabled={!PRIVACY_SAVE_LIVE}
            title={PRIVACY_SAVE_LIVE ? undefined : SAVING_SOON}
            className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
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
    <div className="flex flex-col gap-6 px-4 py-6">
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
          // Contact us has no destination yet (a support address and account
          // are still to be chosen), so it is inert rather than a dead tap.
          disabled={!row.view}
          title={row.view ? undefined : "Coming soon"}
          className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
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

function TermsOfServiceView() {
  return (
    <div>
      <p className="px-4 pt-6 text-sm leading-[16.5px] text-white/50">
        Created on 8 September, 2026
      </p>
      <div className="px-4 pt-6 pb-12 text-[15px] font-normal leading-6 text-white">
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

function HelpSubView() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <p className="text-sm text-white/50">Coming soon</p>
    </div>
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
  const [house, setHouse] = useState<{ id: string; title: string } | null>(null);
  const [personalizePlaces, setPersonalizePlaces] = useState(true);
  const [visibilityOnSpace, setVisibilityOnSpace] = useState(true);
  const [locationChoice, setLocationChoice] =
    useState<LocationChoice>("region-and-country");
  /*
    STAGE 1 IS LIVE: Notifications and Privacy → Chat read and write
    `/me/settings`. A 404 means that route is not deployed on this server, so
    those controls stay disabled with the reason; while it loads they are
    disabled too, so nothing can be flipped before the real value is known.
  */
  const settings = useSettings();
  const save = useUpdateSettings();
  const settingsLive = settings.isSuccess;
  const settingsGone = settings.isError && errorCode(settings.error) === "NOT_FOUND";
  const [houseMessagesFrom, setHouseMessagesFrom] =
    useState<MessageNotifFrom>("admins");
  const [houseGistroomsFrom, setHouseGistroomsFrom] =
    useState<GistroomNotifFrom>("admins");

  const openSection = (next: Section) => {
    setPrivacyView("main");
    setHelpView("main");
    setHouse(null);
    setActive(next);
    window.scrollTo({ top: 0 });
  };

  /** One level up: sub-page → section → the menu. */
  const stepBack = () => {
    if (house) setHouse(null);
    else if (active === "privacy" && privacyView !== "main") setPrivacyView("main");
    else if (active === "help" && helpView !== "main") setHelpView("main");
    else setActive(null);
    window.scrollTo({ top: 0 });
  };

  if (ready && !authenticated) {
    return (
      <>
        <ColumnHeader title="Settings" back />
        <div className="px-4 py-6">
          <SignInPrompt
            title="Sign in to see your settings"
            body="Your notifications, privacy and plan live here."
          />
        </div>
      </>
    );
  }

  const title =
    active === null
      ? "Settings"
      : active === "notifications" && house
        ? house.title
        : active === "privacy" && privacyView === "location"
          ? "Location"
          : active === "privacy" && privacyView === "chat"
            ? "Chat"
            : active === "help" && helpView !== "main"
              ? HELP_TITLES[helpView]
              : (SECTIONS.find((section) => section.key === active)?.title ?? "Settings");
  const subtitle = active === "notifications" && house ? "House notifications" : undefined;

  return (
    <>
      <ColumnHeader
        title={title}
        subtitle={subtitle}
        back
        // From the menu the arrow leaves the page, as on every column
        // surface; inside a section it climbs back up one level.
        onBack={active === null ? undefined : stepBack}
      />

      {active === null ? (
        <nav className="flex flex-col gap-4" aria-label="Settings">
          {SECTIONS.map((section) => (
            <MenuRow key={section.key} section={section} onClick={() => openSection(section.key)} />
          ))}
        </nav>
      ) : (
        <div className="flex flex-col pb-10">
          {/* One quiet line, only where there are controls that cannot save. */}
          {((active === "notifications" && house && !HOUSE_SAVE_LIVE) ||
            (active === "privacy" && privacyView !== "chat" && !PRIVACY_SAVE_LIVE) ||
            (((active === "notifications" && !house) || (active === "privacy" && privacyView === "chat")) &&
              settingsGone)) && (
            <p className="px-4 pt-4 pb-2 text-[13px] leading-5 text-white/50">
              Saving these settings is coming soon.
            </p>
          )}
          {((active === "notifications" && !house) || (active === "privacy" && privacyView === "chat")) &&
            settings.isError &&
            !settingsGone && (
              <p className="px-4 pt-4 pb-2 text-[13px] leading-5 text-white/50">
                Couldn&apos;t load your settings.{" "}
                <button
                  type="button"
                  onClick={() => void settings.refetch()}
                  className="font-bold text-white underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              </p>
            )}

          {active === "subscription" && <SubscriptionDetail />}

          {active === "notifications" &&
            (house ? (
              <HouseNotificationsView
                messagesFrom={houseMessagesFrom}
                onMessagesFromChange={setHouseMessagesFrom}
                gistroomsFrom={houseGistroomsFrom}
                onGistroomsFromChange={setHouseGistroomsFrom}
                disabled={!HOUSE_SAVE_LIVE}
              />
            ) : (
              <NotificationsView
                friendsRoom={settings.data?.notifications.friendsRooms ?? true}
                onFriendsRoomChange={(value) => save.mutate({ notifications: { friendsRooms: value } })}
                directNotifications={settings.data?.notifications.direct ?? true}
                onDirectNotificationsChange={(value) => save.mutate({ notifications: { direct: value } })}
                onOpenHouse={(next) => {
                  setHouse(next);
                  window.scrollTo({ top: 0 });
                }}
                disabled={!settingsLive}
              />
            ))}

          {active === "privacy" && privacyView === "location" && (
            <LocationView locationChoice={locationChoice} onLocationChoiceChange={setLocationChoice} />
          )}
          {active === "privacy" && privacyView === "chat" && (
            <ChatView
              messagesFrom={settings.data?.chat.messagesFrom ?? "everyone"}
              onMessagesFromChange={(value) => save.mutate({ chat: { messagesFrom: value } })}
              allowHouseMembers={settings.data?.chat.allowHouseMembers ?? true}
              onAllowHouseMembersChange={(value) => save.mutate({ chat: { allowHouseMembers: value } })}
              allowPastAudience={settings.data?.chat.allowPastAudience ?? false}
              onAllowPastAudienceChange={(value) => save.mutate({ chat: { allowPastAudience: value } })}
              disabled={!settingsLive}
            />
          )}
          {active === "privacy" && privacyView === "main" && (
            <PrivacyMain
              personalizePlaces={personalizePlaces}
              onPersonalizePlacesChange={setPersonalizePlaces}
              visibilityOnSpace={visibilityOnSpace}
              onVisibilityOnSpaceChange={setVisibilityOnSpace}
              onOpenLocation={() => setPrivacyView("location")}
              onOpenChat={() => setPrivacyView("chat")}
            />
          )}

          {active === "help" && helpView === "main" && <HelpCentreMain onNavigate={setHelpView} />}
          {active === "help" && helpView === "terms" && <TermsOfServiceView />}
          {active === "help" && (helpView === "privacy-policy" || helpView === "community-guidelines") && (
            <HelpSubView />
          )}
        </div>
      )}
    </>
  );
}
