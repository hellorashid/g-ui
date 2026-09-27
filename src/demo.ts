import type { Thought, ThoughtType } from './types'

/**
 * A scripted conversation the canvas can actually play through.
 *
 * Each turn is a node: the assistant's reply, plus the actions it
 * offers. Choosing an action advances to the turn keyed by that
 * action's id, so the graph branches the way the conversation does.
 *
 * `self` marks an action the assistant can carry out on its own;
 * the others are things it needs from the person.
 */
export interface DemoAction {
  id: string
  label: string
  icon: string
  /** The phrasing sent back, shown in the tooltip. */
  action: string
  /** True when the assistant can do this without more input. */
  self: boolean
  /** Turn this action leads to; absent means a dead end for now. */
  next?: string
}

export interface DemoTurn {
  id: string
  /** Short label for the node. */
  label: string
  /** Headline value inside the node. */
  value: string
  kind: string
  /** The assistant's reply, shown in the node's detail area. */
  response: string
  fields?: { key: string; value: string }[]
  actions: DemoAction[]
  /** Reasoning that produced this turn. */
  thoughts: [ThoughtType, string][]
}

/** A whole scripted conversation, keyed by turn id. */
export type DemoScript = Record<string, DemoTurn>

const CHECK_EMAIL: DemoScript = {
  start: {
    id: 'start',
    label: 'check email',
    value: '12 new',
    kind: 'inbox',
    response:
      "You've got 12 unread since yesterday evening. Three look like they actually need you: a contract redline from legal, a customer escalation, and your landlord about the lease renewal. The rest is newsletters and CI noise. Want me to triage, or start with the ones that need a reply?",
    fields: [
      { key: 'unread', value: '12' },
      { key: 'needs you', value: '3' },
    ],
    thoughts: [
      ['retrieve', 'Pulled unread mail since 6pm yesterday'],
      ['observe', '12 unread: 3 from people, 9 automated'],
      ['infer', 'Legal, a customer escalation, and the lease look time-sensitive'],
      ['decide', 'Surface the three that need a human, summarise the rest'],
    ],
    actions: [
      {
        id: 'triage',
        label: 'Triage Everything',
        icon: '⊞',
        action: 'sort the whole inbox and archive what I do not need',
        self: true,
        next: 'triage',
      },
      {
        id: 'urgent',
        label: 'Show What Needs Me',
        icon: '!',
        action: 'open the three that need a reply',
        self: true,
        next: 'urgent',
      },
      {
        id: 'search',
        label: 'Search For Something',
        icon: '⌕',
        action: 'tell me what to look for',
        self: false,
        next: 'search',
      },
    ],
  },

  triage: {
    id: 'triage',
    label: 'triaged',
    value: '9 filed',
    kind: 'sorted',
    response:
      "Filed nine: four newsletters to Reading, three CI failures to Builds (all the same flaky test), and two receipts to Expenses. Left the three that need you in the inbox. Nothing was deleted — say the word if you want any of it back.",
    fields: [
      { key: 'archived', value: '9' },
      { key: 'left', value: '3' },
    ],
    thoughts: [
      ['observe', 'Nine messages match existing filing rules'],
      ['infer', 'All three CI failures trace to the same flaky test'],
      ['decide', 'File by rule, leave anything needing a human reply'],
      ['verify', 'Nothing deleted; every move is reversible'],
    ],
    actions: [
      {
        id: 'urgent',
        label: 'Show What Needs Me',
        icon: '!',
        action: 'open the three that need a reply',
        self: true,
        next: 'urgent',
      },
      {
        id: 'undo',
        label: 'Undo Filing',
        icon: '↺',
        action: 'put everything back in the inbox',
        self: true,
        next: 'undo',
      },
      {
        id: 'rule',
        label: 'Make It A Rule',
        icon: '⚙',
        action: 'always file these the same way',
        self: false,
        next: 'rule',
      },
    ],
  },

  urgent: {
    id: 'urgent',
    label: 'needs you',
    value: '3 threads',
    kind: 'queue',
    response:
      "Legal sent redlines on the Acme contract — they want the indemnity cap raised, deadline Thursday. A customer, Priya at Northwind, is on her second message about failed exports and sounds frustrated. And your landlord needs a yes or no on renewal by the 1st. Priya is the one I would answer first.",
    fields: [
      { key: 'oldest', value: 'Priya, 2 days' },
      { key: 'deadline', value: 'Thu' },
    ],
    thoughts: [
      ['retrieve', 'Opened the three threads and their history'],
      ['observe', "Priya's is a second follow-up with no reply sent"],
      ['infer', 'An unanswered escalation carries the most risk'],
      ['retrieve', 'Checked the export logs she is referring to'],
      ['decide', 'Recommend answering Priya first'],
    ],
    actions: [
      {
        id: 'draft',
        label: 'Draft A Reply',
        icon: '✎',
        action: 'draft a reply to priya about the failed exports',
        self: true,
        next: 'draft',
      },
      {
        id: 'contract',
        label: 'Read The Redlines',
        icon: '☰',
        action: 'summarise what legal changed in the contract',
        self: true,
        next: 'contract',
      },
      {
        id: 'snooze',
        label: 'Snooze The Lease',
        icon: '☾',
        action: 'remind me about the lease on the 30th',
        self: true,
        next: 'snooze',
      },
    ],
  },

  draft: {
    id: 'draft',
    label: 'draft',
    value: 'Ready',
    kind: 'reply',
    response:
      "Drafted a reply to Priya: acknowledges the two-day gap, confirms the export failures were a timeout on large accounts, and says a fix ships Thursday. I kept it short and did not promise a workaround I cannot verify. Want to read it before it goes?",
    fields: [
      { key: 'to', value: 'Priya' },
      { key: 'tone', value: 'direct' },
    ],
    thoughts: [
      ['retrieve', 'Read both of her messages and the export logs'],
      ['observe', 'Failures are timeouts on accounts over 50k rows'],
      ['retrieve', 'Fix is on the board, scheduled for Thursday'],
      ['decide', 'Acknowledge the delay plainly, no invented workaround'],
      ['verify', 'Nothing in the draft claims more than the logs support'],
    ],
    actions: [
      {
        id: 'send',
        label: 'Send It',
        icon: '⇥',
        action: 'send the reply to priya',
        self: true,
        next: 'sent',
      },
      {
        id: 'review',
        label: 'Read It First',
        icon: '◉',
        action: 'show me the full draft',
        self: false,
        next: 'review',
      },
      {
        id: 'soften',
        label: 'Change The Tone',
        icon: '⇄',
        action: 'make it warmer and more apologetic',
        self: false,
        next: 'tone',
      },
    ],
  },

  sent: {
    id: 'sent',
    label: 'sent',
    value: '✓',
    kind: 'done',
    response:
      "Sent to Priya, and I flagged the thread so her reply comes back to the top. Two left needing you: the contract redlines by Thursday and the lease by the 1st.",
    fields: [
      { key: 'sent', value: 'just now' },
      { key: 'remaining', value: '2' },
    ],
    thoughts: [
      ['decide', 'Sent the draft unchanged'],
      ['verify', 'Delivery confirmed, thread flagged for follow-up'],
      ['observe', 'Two threads still need a human'],
    ],
    actions: [
      {
        id: 'contract',
        label: 'Read The Redlines',
        icon: '☰',
        action: 'summarise what legal changed in the contract',
        self: true,
        next: 'contract',
      },
    ],
  },

  contract: {
    id: 'contract',
    label: 'redlines',
    value: '4 changes',
    kind: 'summary',
    response:
      "Four changes. The one that matters: indemnity cap goes from 1x to 3x annual fees. The others are a notice period moving 30 to 60 days, a new audit clause, and cosmetic wording. The 3x cap is well outside what you have signed before.",
    fields: [
      { key: 'material', value: '1 of 4' },
      { key: 'cap', value: '1x → 3x' },
    ],
    thoughts: [
      ['retrieve', 'Diffed the redlined contract against the last version'],
      ['observe', 'Four substantive edits, three of them routine'],
      ['retrieve', 'Compared the cap against previously signed contracts'],
      ['infer', '3x annual fees is an outlier for this account size'],
      ['decide', 'Flag the indemnity cap, treat the rest as standard'],
    ],
    actions: [
      {
        id: 'flag',
        label: 'Flag For Legal',
        icon: '!',
        action: 'ask legal whether the 3x cap is acceptable',
        self: true,
        next: 'flagged',
      },
      {
        id: 'compare',
        label: 'Compare To Past Deals',
        icon: '⊟',
        action: 'show what caps we have agreed to before',
        self: true,
        next: 'compare',
      },
    ],
  },

  flagged: {
    id: 'flagged',
    label: 'flagged',
    value: 'Asked',
    kind: 'pending',
    response:
      "Sent legal a note asking whether 3x is acceptable for an account this size, with the three closest precedents attached. Thursday's deadline is on their radar.",
    fields: [
      { key: 'waiting on', value: 'legal' },
      { key: 'due', value: 'Thu' },
    ],
    thoughts: [
      ['retrieve', 'Found three comparable signed contracts'],
      ['decide', 'Ask legal directly rather than negotiate unilaterally'],
      ['verify', 'Deadline noted in the message'],
    ],
    actions: [],
  },

  compare: {
    id: 'compare',
    label: 'precedent',
    value: '1x–1.5x',
    kind: 'history',
    response:
      "Past caps run 1x to 1.5x annual fees, across eleven signed contracts. The highest was 1.5x for an enterprise deal roughly four times Acme's size. Nothing close to 3x.",
    fields: [
      { key: 'range', value: '1x–1.5x' },
      { key: 'sampled', value: '11 deals' },
    ],
    thoughts: [
      ['retrieve', 'Pulled indemnity terms from eleven signed contracts'],
      ['observe', 'Range is 1x to 1.5x, never higher'],
      ['infer', "Acme's 3x is out of line for the account size"],
    ],
    actions: [
      {
        id: 'flag',
        label: 'Flag For Legal',
        icon: '!',
        action: 'ask legal whether the 3x cap is acceptable',
        self: true,
        next: 'flagged',
      },
    ],
  },

  snooze: {
    id: 'snooze',
    label: 'snoozed',
    value: 'the 30th',
    kind: 'reminder',
    response:
      "Lease thread snoozed until the morning of the 30th, which leaves a day before the deadline. It will come back to the top of your inbox then.",
    fields: [
      { key: 'returns', value: 'the 30th' },
      { key: 'deadline', value: 'the 1st' },
    ],
    thoughts: [
      ['observe', 'Deadline is the 1st; no reply needed before then'],
      ['decide', 'Return it on the 30th, leaving a day of slack'],
    ],
    actions: [],
  },

  review: {
    id: 'review',
    label: 'draft text',
    value: '94 words',
    kind: 'preview',
    response:
      '"Hi Priya — sorry for the slow reply. The export failures were a timeout affecting accounts over 50k rows; a fix is scheduled for Thursday. I will confirm here once it is out. Thanks for flagging it twice — that should not have been necessary."',
    fields: [
      { key: 'length', value: '94 words' },
      { key: 'claims', value: 'all verified' },
    ],
    thoughts: [
      ['observe', 'Draft is short and makes three factual claims'],
      ['verify', 'Each claim checks out against the logs and the board'],
    ],
    actions: [
      {
        id: 'send',
        label: 'Send It',
        icon: '⇥',
        action: 'send the reply to priya',
        self: true,
        next: 'sent',
      },
    ],
  },

  tone: {
    id: 'tone',
    label: 'tone',
    value: 'Warmer',
    kind: 'reply',
    response:
      "Rewrote it warmer — leads with the apology, keeps the same facts and the Thursday date. It is about twenty words longer. I would still send the shorter one, but it is your call.",
    fields: [{ key: 'length', value: '114 words' }],
    thoughts: [
      ['decide', 'Lead with the apology, preserve every factual claim'],
      ['observe', 'Twenty words longer than the original'],
      ['infer', 'Direct version likely reads better to a frustrated customer'],
    ],
    actions: [
      {
        id: 'send',
        label: 'Send It',
        icon: '⇥',
        action: 'send the reply to priya',
        self: true,
        next: 'sent',
      },
    ],
  },

  search: {
    id: 'search',
    label: 'search',
    value: 'What?',
    kind: 'question',
    response:
      'Sure — what should I look for? A sender, a subject, or something you half-remember all work.',
    fields: [{ key: 'scope', value: 'all mail' }],
    thoughts: [
      ['observe', 'No search terms given yet'],
      ['decide', 'Ask for a sender, subject, or fragment'],
    ],
    actions: [],
  },

  undo: {
    id: 'undo',
    label: 'restored',
    value: '9 back',
    kind: 'sorted',
    response:
      'Put all nine back in the inbox, unread as they were. Nothing was lost.',
    fields: [{ key: 'restored', value: '9' }],
    thoughts: [
      ['decide', 'Reverse every move from the triage step'],
      ['verify', 'All nine are back and still marked unread'],
    ],
    actions: [],
  },

  rule: {
    id: 'rule',
    label: 'rule',
    value: 'Saved',
    kind: 'setting',
    response:
      'Saved three rules: newsletters to Reading, CI notifications to Builds, receipts to Expenses. They will apply as mail arrives, and I will tell you the first time each one fires.',
    fields: [
      { key: 'rules', value: '3' },
      { key: 'applies', value: 'on arrival' },
    ],
    thoughts: [
      ['observe', 'The nine filed messages fall into three clear groups'],
      ['decide', 'One rule per group rather than per sender'],
      ['verify', 'Rules only file; nothing will be deleted'],
    ],
    actions: [],
  },
}

const ORDER_FOOD: DemoScript = {
  start: {
    id: 'start',
    label: 'order food',
    value: 'Where to?',
    kind: 'request',
    response:
      "Happy to get something ordered for you. I don't see an active order yet — want to start by picking a delivery service, or should I just check what's connected to your account first?",
    fields: [{ key: 'order', value: 'none yet' }],
    thoughts: [
      ['observe', 'Request is open-ended: no service, no cuisine, no address'],
      ['retrieve', 'Checked for an order already in progress — none found'],
      ['decide', 'Ask which service, or offer to look at connected accounts'],
    ],
    actions: [
      {
        id: 'connections',
        label: 'Check Connections',
        icon: '⊕',
        action: 'look for any connected food delivery app',
        self: true,
        next: 'connections',
      },
      {
        id: 'service',
        label: 'Pick Service',
        icon: '⊞',
        action: 'tell me doordash, ubereats, or grubhub',
        self: false,
        next: 'service',
      },
      {
        id: 'address',
        label: 'Give Address',
        icon: '⌂',
        action: 'confirm delivery address',
        self: false,
        next: 'address',
      },
    ],
  },

  connections: {
    id: 'connections',
    label: 'connections',
    value: 'DoorDash',
    kind: 'account',
    response:
      "Found it — you've got DoorDash connected under this account, last used for an order to your home address in the Mission. Want me to use that one, or would you rather order somewhere it isn't connected?",
    fields: [
      { key: 'service', value: 'DoorDash' },
      { key: 'last used', value: 'Mission' },
    ],
    thoughts: [
      ['retrieve', 'Scanned connected apps on the account'],
      ['observe', 'DoorDash is linked; UberEats and Grubhub are not'],
      ['retrieve', 'Last order went to the home address in the Mission'],
      ['verify', 'Token still valid, no re-auth needed'],
    ],
    actions: [
      {
        id: 'use-doordash',
        label: 'Use DoorDash',
        icon: '✓',
        action: 'go ahead and use the connected DoorDash account',
        self: true,
        next: 'craving',
      },
      {
        id: 'craving',
        label: "Say What You're Craving",
        icon: '☺',
        action: 'say what you are craving',
        self: false,
        next: 'craving',
      },
      {
        id: 'address',
        label: 'Confirm Address',
        icon: '⌂',
        action: 'confirm delivery address',
        self: false,
        next: 'address',
      },
    ],
  },

  craving: {
    id: 'craving',
    label: 'craving',
    value: 'Thai',
    kind: 'preference',
    response:
      "Got it, thinking Thai tonight. Based on your preferences — vegetarian-leaning but you eat fish sometimes, and a shellfish allergy to steer clear of — I'd suggest sticking to a tofu or vegetable curry rather than anything with shrimp. Want me to pull up nearby Thai spots on DoorDash?",
    fields: [
      { key: 'diet', value: 'veg + fish' },
      { key: 'avoid', value: 'shellfish' },
    ],
    thoughts: [
      ['observe', 'Craving is Thai, no specific dish named'],
      ['retrieve', 'Loaded saved dietary preferences from the profile'],
      ['infer', 'Vegetarian-leaning, eats fish, shellfish allergy on record'],
      ['decide', 'Steer toward tofu or vegetable curries, exclude shrimp'],
      ['verify', 'Allergy filter will apply to every suggestion'],
    ],
    actions: [
      {
        id: 'browse',
        label: 'Browse Thai Spots',
        icon: '⌕',
        action: 'pull up nearby thai restaurants on doordash',
        self: true,
        next: 'restaurants',
      },
      {
        id: 'change-cuisine',
        label: 'Change Cuisine',
        icon: '⇄',
        action: 'say what you are craving instead',
        self: false,
        next: 'cuisine',
      },
      {
        id: 'skip-allergy',
        label: 'Skip Allergy Filter',
        icon: '⚠',
        action: 'show all options including shellfish dishes',
        self: false,
        next: 'allergy',
      },
    ],
  },

  restaurants: {
    id: 'restaurants',
    label: 'nearby',
    value: '3 spots',
    kind: 'results',
    response:
      "Here's what's close and open now: Amarin Thai (0.6 mi, ~25 min), Marnee Thai (0.9 mi, ~30 min), and Lers Ros (1.1 mi, ~35 min). Amarin has a solid tofu panang curry and is fastest. Want me to place that order, or take a look at the full menu first?",
    fields: [
      { key: 'closest', value: 'Amarin 0.6mi' },
      { key: 'eta', value: '~25 min' },
    ],
    thoughts: [
      ['retrieve', 'Queried DoorDash for Thai within 2 miles, open now'],
      ['observe', 'Three candidates: Amarin, Marnee, Lers Ros'],
      ['infer', 'Amarin is closest and fastest at ~25 minutes'],
      ['verify', 'Tofu panang contains no shellfish or fish sauce'],
    ],
    actions: [
      {
        id: 'order',
        label: 'Order Tofu Panang',
        icon: '⇥',
        action: 'place the order for tofu panang curry from amarin thai',
        self: true,
        next: 'placed',
      },
      {
        id: 'menu',
        label: 'View Full Menu',
        icon: '☰',
        action: 'show the full amarin thai menu',
        self: false,
        next: 'menu',
      },
      {
        id: 'compare',
        label: 'Compare Other Spots',
        icon: '⊟',
        action: 'show menus for marnee thai and lers ros too',
        self: false,
        next: 'compare',
      },
    ],
  },

  placed: {
    id: 'placed',
    label: 'ordered',
    value: '$18.40',
    kind: 'confirmed',
    response:
      "Order placed — tofu panang curry from Amarin Thai, $18.40 with tip, arriving around 7:45pm to your Mission address. I'll keep an eye on it and let you know if the ETA slips.",
    fields: [
      { key: 'total', value: '$18.40' },
      { key: 'eta', value: '7:45pm' },
      { key: 'status', value: 'confirmed' },
    ],
    thoughts: [
      ['decide', 'Placing tofu panang curry, no substitutions'],
      ['observe', 'Subtotal $15.00, fees and tip bring it to $18.40'],
      ['verify', 'Delivery address matches the saved Mission address'],
      ['verify', 'Order confirmed by the restaurant, ETA 7:45pm'],
    ],
    actions: [
      {
        id: 'track',
        label: 'Track Order',
        icon: '◎',
        action: 'watch the delivery and tell me if it slips',
        self: true,
        next: 'tracking',
      },
      {
        id: 'add-drink',
        label: 'Add A Drink',
        icon: '+',
        action: 'add a thai iced tea to the order',
        self: false,
        next: 'drink',
      },
      {
        id: 'receipt',
        label: 'Save Receipt',
        icon: '⎘',
        action: 'file the receipt with my expenses',
        self: true,
        next: 'receipt',
      },
    ],
  },

  tracking: {
    id: 'tracking',
    label: 'tracking',
    value: '7:41pm',
    kind: 'live',
    response:
      "Tracking it. The driver picked up at 7:31 and is four minutes out — running slightly ahead of the original estimate. I'll ping you if anything changes.",
    fields: [
      { key: 'driver', value: 'picked up' },
      { key: 'revised', value: '7:41pm' },
    ],
    thoughts: [
      ['observe', 'Driver marked the order picked up at 7:31pm'],
      ['retrieve', 'Pulled live position and route from DoorDash'],
      ['infer', 'Arrival now 7:41pm, four minutes ahead of estimate'],
    ],
    actions: [],
  },

  // Branches that acknowledge the choice without a scripted follow-on.
  service: {
    id: 'service',
    label: 'service',
    value: 'Which?',
    kind: 'question',
    response:
      'Sure — DoorDash, UberEats, or Grubhub? If you are not sure, I can check which ones are already connected to your account.',
    fields: [{ key: 'options', value: '3' }],
    thoughts: [
      ['observe', 'No service chosen yet'],
      ['decide', 'Offer the three majors, and a shortcut to connections'],
    ],
    actions: [
      {
        id: 'connections',
        label: 'Check Connections',
        icon: '⊕',
        action: 'look for any connected food delivery app',
        self: true,
        next: 'connections',
      },
    ],
  },

  address: {
    id: 'address',
    label: 'address',
    value: 'Mission',
    kind: 'location',
    response:
      'Using your home address in the Mission — the same one your last few orders went to. Say the word if it should go somewhere else tonight.',
    fields: [
      { key: 'saved', value: 'home' },
      { key: 'area', value: 'Mission' },
    ],
    thoughts: [
      ['retrieve', 'Loaded saved addresses from the account'],
      ['infer', 'Home in the Mission is the usual destination'],
      ['verify', 'Address is inside the delivery radius'],
    ],
    actions: [
      {
        id: 'craving',
        label: "Say What You're Craving",
        icon: '☺',
        action: 'say what you are craving',
        self: false,
        next: 'craving',
      },
    ],
  },

  cuisine: {
    id: 'cuisine',
    label: 'cuisine',
    value: 'Open',
    kind: 'question',
    response:
      'No problem — what sounds good instead? I will keep the shellfish allergy in mind whatever we land on.',
    fields: [{ key: 'constraint', value: 'no shellfish' }],
    thoughts: [
      ['observe', 'Thai was rejected, nothing new named yet'],
      ['decide', 'Hold the allergy constraint across whatever comes next'],
    ],
    actions: [],
  },

  allergy: {
    id: 'allergy',
    label: 'allergy',
    value: 'Held',
    kind: 'guard',
    response:
      "I would rather not drop that filter — shellfish is on your profile as an allergy, not a preference. I can show everything else, including fish dishes, if that helps.",
    fields: [{ key: 'filter', value: 'kept on' }],
    thoughts: [
      ['observe', 'Request is to remove the shellfish filter'],
      ['retrieve', 'Profile records this as an allergy, not a dislike'],
      ['decide', 'Keep the filter, offer fish dishes as the middle ground'],
    ],
    actions: [
      {
        id: 'browse',
        label: 'Browse Thai Spots',
        icon: '⌕',
        action: 'pull up nearby thai restaurants on doordash',
        self: true,
        next: 'restaurants',
      },
    ],
  },

  menu: {
    id: 'menu',
    label: 'menu',
    value: 'Amarin',
    kind: 'listing',
    response:
      'Amarin Thai: panang, massaman and green curries all come with a tofu option; pad see ew and pad thai can be made vegetarian. The tofu panang is the one I would pick.',
    fields: [
      { key: 'safe picks', value: '5' },
      { key: 'flagged', value: '2 shrimp' },
    ],
    thoughts: [
      ['retrieve', 'Pulled the full Amarin Thai menu'],
      ['infer', 'Five dishes fit the profile once shrimp items are set aside'],
      ['verify', 'Checked each for fish sauce and shellfish'],
    ],
    actions: [
      {
        id: 'order',
        label: 'Order Tofu Panang',
        icon: '⇥',
        action: 'place the order for tofu panang curry from amarin thai',
        self: true,
        next: 'placed',
      },
    ],
  },

  compare: {
    id: 'compare',
    label: 'compare',
    value: '3 menus',
    kind: 'listing',
    response:
      'Marnee leans seafood-heavy, so fewer safe options there. Lers Ros has a good vegetable jungle curry but is the slowest at ~35 minutes. Amarin still looks like the best fit.',
    fields: [
      { key: 'best fit', value: 'Amarin' },
      { key: 'slowest', value: 'Lers Ros' },
    ],
    thoughts: [
      ['retrieve', 'Loaded menus for Marnee Thai and Lers Ros'],
      ['observe', 'Marnee is seafood-heavy; fewer dishes pass the filter'],
      ['infer', 'Lers Ros works but adds ten minutes'],
      ['decide', 'Amarin remains the best balance of fit and speed'],
    ],
    actions: [
      {
        id: 'order',
        label: 'Order Tofu Panang',
        icon: '⇥',
        action: 'place the order for tofu panang curry from amarin thai',
        self: true,
        next: 'placed',
      },
    ],
  },

  drink: {
    id: 'drink',
    label: 'drink',
    value: '+$4.50',
    kind: 'addon',
    response:
      'Added a Thai iced tea — $4.50, new total $22.90. The restaurant had not started prep yet, so it made it onto the same order.',
    fields: [
      { key: 'added', value: 'Thai iced tea' },
      { key: 'total', value: '$22.90' },
    ],
    thoughts: [
      ['observe', 'Order is confirmed but prep has not started'],
      ['decide', 'Amend the existing order rather than placing a second'],
      ['verify', 'Restaurant accepted the amendment, total now $22.90'],
    ],
    actions: [],
  },

  receipt: {
    id: 'receipt',
    label: 'receipt',
    value: 'Filed',
    kind: 'record',
    response:
      'Receipt saved and filed under meals for tonight. It will show up in your next expense export.',
    fields: [
      { key: 'category', value: 'meals' },
      { key: 'amount', value: '$18.40' },
    ],
    thoughts: [
      ['retrieve', 'Fetched the itemised receipt from DoorDash'],
      ['decide', 'Filed under meals, dated today'],
      ['verify', 'Entry appears in the pending expense export'],
    ],
    actions: [],
  },
}

/**
 * Prompts that play a scripted conversation, and the script each one
 * runs. Anything else falls through to the generic node flow.
 */
export const DEMOS: Record<string, DemoScript> = {
  'order food': ORDER_FOOD,
  'check email': CHECK_EMAIL,
}

/** The script a prompt triggers, if any. */
export const demoFor = (value: string): DemoScript | undefined =>
  DEMOS[value.trim().toLowerCase()]

/** Prompts the canvas recognises, for the empty-state hints. */
export const DEMO_PROMPTS = Object.keys(DEMOS)

/** Build the thought chain for a demo turn. */
export const demoThoughts = (turn: DemoTurn, pathId: string): Thought[] =>
  turn.thoughts.map(([type, description], i) => ({
    id: `${pathId}-t${i}`,
    type,
    description,
  }))
