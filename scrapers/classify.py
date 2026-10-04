"""Cheap keyword heuristics to decide what's worth a human's time.

Deliberately simple and transparent: false positives cost one click to reject
in the review queue, false negatives are invisible. So err toward keeping.
"""

import re
from dataclasses import dataclass

# Sponsored or affiliate roundups are exactly the junk ZeroCatch filters out.
BLOCKED_CATEGORIES = {"Sponsored Posts"}

# "free" as a standalone word: not "Wrinkle-Free", "Free Shipping", or the brand "Free People".
_FREE_RE = re.compile(
    r"(?<![-\w])(free(?![-\w]| shipping| delivery| people)|freebies?|bogo|b1g1|"
    r"buy one,? get one|on the house|complimentary)(?![-\w])",
    re.I,
)
_PURCHASE_RE = re.compile(
    r"\b(bogo|b1g1|buy one,? get one|with (any )?purchase|when you (buy|spend|order)|"
    r"min(imum)? (purchase|order)|\$\d+\+? (purchase|order)|"
    # "FREE … After Rebate / Cash Back / Walmart Cash": you pay first.
    r"after (easy )?(online )?(rebate|cash back|\w+ cash|\w+ rewards)|better than free)\b",
    re.I,
)
_TRIAL_RE = re.compile(r"\bfree trial\b|\b\d+[- ](day|week|month)s? free\b", re.I)
# Price-cut posts ("$5 off", "Only $43") are discounts, not freebies.
_DISCOUNT_ONLY_RE = re.compile(r"\$\d+(\.\d\d)? off\b|\bonly \$\d|\breg\. \$\d|\d+% off\b", re.I)

FOOD_WORDS = (
    "coffee", "latte", "espresso", "donut", "doughnut", "pizza", "burger", "taco", "burrito",
    "fries", "sandwich", "sub", "chicken", "nuggets", "wings", "ice cream", "cone", "frosty",
    "cookie", "pastry", "bagel", "breakfast", "lunch", "dinner", "meal", "entree", "appetizer",
    "dessert", "drink", "soda", "smoothie", "tea", "slushie", "snack", "candy", "chips",
    "pretzel", "pancake", "waffle", "food", "restaurant", "kids eat",
)  # fmt: skip

# Display name → patterns. Order matters only for readability.
MERCHANTS = {
    "7-Eleven": r"7-eleven|7 eleven",
    "Arby's": r"arby'?s",
    "Burger King": r"burger king",
    "Chick-fil-A": r"chick-?fil-?a",
    "Chipotle": r"chipotle",
    "Dairy Queen": r"dairy queen",
    "Domino's": r"domino'?s",
    "Dunkin'": r"dunkin'?",
    "IHOP": r"\bihop\b",
    "Jersey Mike's": r"jersey mike'?s",
    "Krispy Kreme": r"krispy kreme",
    "McDonald's": r"mcdonald'?s",
    "Panda Express": r"panda express",
    "Panera Bread": r"panera",
    "Papa John's": r"papa john'?s",
    "Pizza Hut": r"pizza hut",
    "Popeyes": r"popeyes",
    "Raising Cane's": r"raising cane'?s",
    "Sheetz": r"sheetz",
    "Sonic": r"\bsonic\b",
    "Starbucks": r"starbucks",
    "Subway": r"\bsubway\b",
    "Taco Bell": r"taco bell",
    "Wawa": r"\bwawa\b",
    "Wendy's": r"wendy'?s",
    "Whataburger": r"whataburger",
}
_MERCHANT_RES = {name: re.compile(pattern, re.I) for name, pattern in MERCHANTS.items()}
_PET_RE = re.compile(r"\b(dog|cat|pet|pup|puppy|kitten)s?\b", re.I)
_FOOD_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in FOOD_WORDS) + r")s?\b", re.I)


@dataclass
class Classification:
    keep: bool
    is_food: bool
    suggested_category: str | None
    suggested_merchant: str | None


def classify(title: str, summary: str, categories: list[str], trusted: frozenset[str]) -> Classification:
    text = f"{title} {summary}"
    merchant = next((name for name, rx in _MERCHANT_RES.items() if rx.search(title)), None)
    # Titles only: summaries mention food in passing far too often.
    is_food = (bool(merchant) or bool(_FOOD_RE.search(title))) and not _PET_RE.search(title)

    blocked = bool(BLOCKED_CATEGORIES.intersection(categories))
    has_free = bool(_FREE_RE.search(title))
    # A trusted category vouches for a post, but never overrides a price-cut title.
    looks_free = has_free or bool(trusted.intersection(categories))
    discount_only = bool(_DISCOUNT_ONLY_RE.search(title)) and not has_free
    keep = looks_free and not blocked and not discount_only

    if _TRIAL_RE.search(text):
        category = "free_trial"
    elif _PURCHASE_RE.search(text):
        category = "free_with_purchase"
    else:
        category = "pure_freebie"

    return Classification(keep, is_food, category if keep else None, merchant)
