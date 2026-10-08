"""ZeroCatch's inclusion rules as keyword heuristics.

A lead must be free, and must NOT be any of: purchase-required (BOGO, gift
with purchase), points/credit/gift-card offers, free shipping or delivery,
gated behind a paid membership, a rebate/cash-back offer, limited quantity,
an in-store event, for one audience only, a contest, or a roundup. These rules
are product decisions, so each rejection carries a reason code that the
scraper reports. That makes the filter measurable and easy to tune.
"""

import re
from dataclasses import dataclass

# Sponsored or affiliate posts are exactly the junk ZeroCatch filters out.
BLOCKED_CATEGORIES = {"Sponsored Posts"}

# "free" as a standalone word: not "Wrinkle-Free", the idiom "rent free", the
# brand "Free People", or fulfillment perks like "Free Shipping" / "Free Same-Day Delivery".
_FREE_RE = re.compile(
    r"(?<![-\w])(?<!rent )(free(?![-\w]| people| (?:[\w-]+ ){0,2}(?:shipping|delivery|returns|pickup)\b)|freebies?|bogo|b1g1|"
    r"buy one,? get one|on the house|complimentary)(?![-\w])",
    re.I,
)
_PURCHASE_RE = re.compile(
    r"\b(bogo|b1g1|buy one,? get one|with (any )?purchase|when you (buy|spend|order)|"
    r"min(imum)? (purchase|order)|\$\d+\+? (purchase|order))\b",
    re.I,
)
# Fulfillment perks: when "free shipping/delivery" is the only free thing, the
# deal is rejected with its own reason rather than lumped in with "not free".
_SHIPPING_RE = re.compile(r"\bfree (?:[\w-]+ ){0,2}(?:shipping|delivery|returns|pickup)\b|\bships free\b", re.I)
_TRIAL_RE = re.compile(r"\bfree trial\b|\b\d+[- ](day|week|month)s? free\b", re.I)
# Price-cut posts ("$5 off", "Only $43") are discounts, not freebies.
_DISCOUNT_ONLY_RE = re.compile(r"\$\d+(\.\d\d)? off\b|\bonly \$\d|\breg\. \$\d|\d+% off\b", re.I)

# Order matters: the first matching rule is the reported reason.
REJECT_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("requires_purchase", _PURCHASE_RE),
    ("rebate", re.compile(
        r"after (easy )?(online )?(rebate|cash ?back|\w+ cash|\w+ rewards)|better than free|\bibotta\b|"
        r"fetch rewards|money ?back|cash back", re.I)),
    # Money-adjacent "freebies": points, store credit, gift cards, bonus bucks.
    ("points_or_credit", re.compile(
        r"\bpoints?\b|\bcredits?\b|store credit|gift cards?|e-?gift|\bbonus bucks\b|extrabucks|"
        r"rewards dollars|\bcash\b|\$\d+ (off|free)", re.I)),
    ("paid_membership", re.compile(
        r"\bprime\b|circle 360|walmart\+|walmart plus|verizon|t-mobile|at&t|sam'?s club|costco|siriusxm|"
        r"dashpass|disney\+|kindle unlimited|audible|uber one|instacart\+|grubhub\+|paramount\+|peacock|"
        r"\bhulu\b|netflix|spotify premium|youtube premium|chatgpt plus", re.I)),
    ("contest", re.compile(
        r"\bwin\b|\bwinners?\b|sweepstakes|\bgiveaway\b|enter (to|for)|instant win|chance to", re.I)),
    ("limited_quantity", re.compile(
        r"first \d[\d,]*|while supplies|limited (quantit|supply)|will (sell|go) (out|quickly)|"
        r"sell out|\d{1,3}(,\d{3})+ (free|available)|only \d[\d,]* available|first come", re.I)),
    ("in_store_event", re.compile(
        r"\bevents?\b|workshop|in-store|\bclass(es)?\b|photos? with|(pet|santa|bunny|holiday|halloween) photos?|from \d{1,2}(:\d\d)? ?(am|pm)?\s*[-–]\s*\d|"
        r"\b\d{1,2}(:\d\d)? ?(am|pm)\b", re.I)),
    ("audience_only", re.compile(
        r"\b(teachers?|educators?|students?|college|military|veterans?|nurses?|first responders|seniors|"
        r"healthcare workers|graduates|grads|kids|\d+(st|nd|rd|th) graders|moms|dads|admin professionals)\b", re.I)),
    ("roundup", re.compile(
        r"^(the )?best\b|here'?s (where|how|the|what)|huge list|round-?up|\bwhere to\b|"
        r"^\d+\+? |^over \d+|\d+ (free|ways|completely)|deals? (this|of the) week|you can'?t miss|"
        r"freebies? (&|and) deals|\bevery free\b|how to (score|get|watch)|this week!?$|\bcodes\b", re.I)),
]

FOOD_WORDS = (
    "coffee", "latte", "espresso", "donut", "doughnut", "pizza", "burger", "taco", "burrito",
    "fries", "sandwich", "sub", "chicken", "nuggets", "wings", "ice cream", "cone", "frosty",
    "cookie", "pastry", "bagel", "breakfast", "lunch", "dinner", "meal", "entree", "appetizer",
    "dessert", "drink", "soda", "smoothie", "tea", "slushie", "slurpee", "snack", "candy", "chips",
    "pretzel", "pancake", "waffle", "food", "restaurant", "italian ice", "frozen yogurt",
)  # fmt: skip

# Display name → (title pattern, brand domain used to pick the right link).
MERCHANTS: dict[str, tuple[str, str]] = {
    "7-Eleven": (r"7-eleven|7 eleven", "7-eleven.com"),
    "Arby's": (r"arby'?s", "arbys.com"),
    "Ben & Jerry's": (r"ben (&|and) jerry'?s", "benjerry.com"),
    "Burger King": (r"burger king", "bk.com"),
    "Chick-fil-A": (r"chick-?fil-?a", "chick-fil-a.com"),
    "Chipotle": (r"chipotle", "chipotle.com"),
    "Dairy Queen": (r"dairy queen", "dairyqueen.com"),
    "Domino's": (r"domino'?s", "dominos.com"),
    "Dunkin'": (r"dunkin'?", "dunkindonuts.com"),
    "IHOP": (r"\bihop\b", "ihop.com"),
    "Jersey Mike's": (r"jersey mike'?s", "jerseymikes.com"),
    "KFC": (r"\bkfc\b", "kfc.com"),
    "Krispy Kreme": (r"krispy kreme", "krispykreme.com"),
    "McDonald's": (r"mcdonald'?s", "mcdonalds.com"),
    "Panda Express": (r"panda express", "pandaexpress.com"),
    "Panera Bread": (r"panera", "panerabread.com"),
    "Papa John's": (r"papa john'?s", "papajohns.com"),
    "Pizza Hut": (r"pizza hut", "pizzahut.com"),
    "Popeyes": (r"popeyes", "popeyes.com"),
    "Raising Cane's": (r"raising cane'?s", "raisingcanes.com"),
    "Rita's": (r"rita'?s", "ritasice.com"),
    "Sheetz": (r"sheetz", "sheetz.com"),
    "Smoothie King": (r"smoothie king", "smoothieking.com"),
    "Sonic": (r"\bsonic\b", "sonicdrivein.com"),
    "Starbucks": (r"starbucks", "starbucks.com"),
    "Subway": (r"\bsubway\b", "subway.com"),
    "Taco Bell": (r"taco bell", "tacobell.com"),
    "Wawa": (r"\bwawa\b", "wawa.com"),
    "Wendy's": (r"wendy'?s", "wendys.com"),
    "Whataburger": (r"whataburger", "whataburger.com"),
    "White Castle": (r"white castle", "whitecastle.com"),
}
_MERCHANT_RES = {name: re.compile(pattern, re.I) for name, (pattern, _) in MERCHANTS.items()}
_PET_RE = re.compile(r"\b(dog|cat|pet|pup|puppy|kitten)s?\b", re.I)
_FOOD_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in FOOD_WORDS) + r")s?\b", re.I)


@dataclass
class Classification:
    reject_reason: str | None  # None means the lead passes every rule
    is_food: bool
    suggested_category: str | None
    suggested_merchant: str | None

    @property
    def keep(self) -> bool:
        return self.reject_reason is None


def classify(title: str, summary: str, categories: list[str], trusted: frozenset[str]) -> Classification:
    text = f"{title} {summary}"
    merchant = next((name for name, rx in _MERCHANT_RES.items() if rx.search(title)), None)
    # Titles only: summaries mention food in passing far too often.
    is_food = (bool(merchant) or bool(_FOOD_RE.search(title))) and not _PET_RE.search(title)

    has_free = bool(_FREE_RE.search(title))
    if BLOCKED_CATEGORIES.intersection(categories):
        reason = "sponsored"
    elif not has_free and _SHIPPING_RE.search(title):
        reason = "free_shipping"
    elif not (has_free or trusted.intersection(categories)):
        reason = "not_free"
    elif _DISCOUNT_ONLY_RE.search(title) and not has_free:
        reason = "discount_only"
    else:
        # Rules read the title only: summaries are padded with unrelated promos.
        reason = next((name for name, rx in REJECT_RULES if rx.search(title)), None)

    category = "free_trial" if _TRIAL_RE.search(text) else "pure_freebie"

    return Classification(reason, is_food, category if reason is None else None, merchant)
