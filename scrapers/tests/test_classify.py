import unittest

from scrapers.classify import classify

NONE: frozenset[str] = frozenset()


def c(title, summary="", categories=(), trusted=NONE):
    return classify(title, summary, list(categories), trusted)


class KeepTest(unittest.TestCase):
    def test_keeps_free_titles(self):
        self.assertTrue(c("FREE Wawa Coffee – Today ONLY").keep)
        self.assertTrue(c("BOGO Entrées at Chipotle Through Sunday").keep)

    def test_ignores_free_shipping_and_compound_words(self):
        self.assertFalse(c("Up to 65% Off Crocs + FREE Shipping").keep)
        self.assertFalse(c("Men's Wrinkle-Free Golf Pants Just $14.99").keep)
        self.assertFalse(c("75% Off Free People Sale").keep)
        self.assertFalse(c("Up to 40% Off Hair Care + Free Same-Day Delivery").keep)
        self.assertFalse(c("$5 Off Pizza + Free Curbside Pickup").keep)

    def test_drops_sponsored_posts(self):
        self.assertFalse(c("FREE Sample Box", categories=["Sponsored Posts"]).keep)

    def test_trusted_category_vouches_but_not_for_discounts(self):
        trusted = frozenset({"Freebies"})
        self.assertTrue(c("Claim Your Monthly Gift", categories=["Freebies"], trusted=trusted).keep)
        self.assertFalse(c("Silk Soy Milk Only $1.99", categories=["Freebies"], trusted=trusted).keep)


class FoodTest(unittest.TestCase):
    def test_detects_food_and_merchant(self):
        result = c("FREE Chick-fil-A Chicken Biscuit")
        self.assertTrue(result.is_food)
        self.assertEqual(result.suggested_merchant, "Chick-fil-A")

    def test_pet_food_is_not_food(self):
        self.assertFalse(c("FREE Cesar Dog Food Sample").is_food)

    def test_food_detection_ignores_summary(self):
        self.assertFalse(c("FREE Tote Bag", summary="grab a coffee while you shop").is_food)


class InclusionRulesTest(unittest.TestCase):
    """Each product rule, with real-world-shaped titles."""

    def assertRejected(self, title, reason):
        self.assertEqual(c(title).reject_reason, reason, title)

    def test_paid_membership(self):
        self.assertRejected("TWO FREE eBooks for Amazon Prime Members", "paid_membership")
        self.assertRejected("Target Circle 360 Members! Claim Your Monthly Freebie", "paid_membership")
        self.assertRejected("Verizon Rewards Members: Score 1-Hour Free Gameplay", "paid_membership")

    def test_free_loyalty_accounts_are_fine(self):
        self.assertIsNone(c("FREE Starbucks Coffee for Target Circle Members on October 6th").reject_reason)

    def test_rebates(self):
        self.assertRejected("FREE Cereal After Rebate", "rebate")
        self.assertRejected("FREE Ice Cream After Walmart Cash", "rebate")
        self.assertRejected("TWO Better Than FREE Toothbrushes", "rebate")

    def test_contests(self):
        self.assertRejected("Chipotle IQ Test = Win FREE Burritos for a Year", "contest")

    def test_limited_quantity(self):
        self.assertRejected("FREE Frozen Yogurt for the First 50 Customers", "limited_quantity")
        self.assertRejected("FREE Ice Cream Coupon for First 20,000", "limited_quantity")

    def test_in_store_events(self):
        self.assertRejected("FREE Home Depot Kids Workshop on 9/5", "in_store_event")
        self.assertRejected("Target Store Event w/ Pampers Freebie Today from 12-4 PM", "in_store_event")
        self.assertRejected("FREE Halloween Pet Photos at Tractor Supply on October 10th", "in_store_event")

    def test_audience_only(self):
        self.assertRejected("FREE Medium Drink For Teachers at Scooter's Coffee", "audience_only")
        self.assertRejected("4th Graders Get a FREE National Park Pass", "audience_only")

    def test_roundups(self):
        self.assertRejected("National Taco Day | Here's Where to Grab Free Tacos", "roundup")
        self.assertRejected("FREE KFC Bucket, BOGO Cakes + More Cheap Eats This Week!", "roundup")
        self.assertRejected("Score Freebies With These October Roblox Codes", "roundup")


class CategoryTest(unittest.TestCase):
    def test_pure_freebie(self):
        self.assertEqual(c("FREE IHOP Pancakes – No Purchase Needed").suggested_category, "pure_freebie")

    def test_with_purchase(self):
        self.assertEqual(c("FREE Coffee With Any Purchase").suggested_category, "free_with_purchase")
        self.assertEqual(c("BOGO Entrées at Chipotle").suggested_category, "free_with_purchase")

    def test_trial(self):
        self.assertEqual(c("Get a FREE Trial of Notion").suggested_category, "free_trial")
        self.assertEqual(c("Calm: 3 months free").suggested_category, "free_trial")

    def test_dropped_items_get_no_category(self):
        self.assertIsNone(c("50% Off Everything").suggested_category)


if __name__ == "__main__":
    unittest.main()
