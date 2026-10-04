import unittest

from scrapers.classify import classify

NONE: frozenset[str] = frozenset()


def c(title, summary="", categories=(), trusted=NONE):
    return classify(title, summary, list(categories), trusted)


class KeepTest(unittest.TestCase):
    def test_keeps_free_titles(self):
        self.assertTrue(c("FREE Wawa Coffee – Today ONLY").keep)
        self.assertTrue(c("BOGO Entrées This Week").keep)

    def test_ignores_free_shipping_and_compound_words(self):
        self.assertFalse(c("Up to 65% Off Crocs + FREE Shipping").keep)
        self.assertFalse(c("Men's Wrinkle-Free Golf Pants Just $14.99").keep)
        self.assertFalse(c("75% Off Free People Sale").keep)

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


class CategoryTest(unittest.TestCase):
    def test_pure_freebie(self):
        self.assertEqual(c("FREE IHOP Pancakes – No Purchase Needed").suggested_category, "pure_freebie")

    def test_with_purchase(self):
        self.assertEqual(c("FREE Coffee With Any Purchase").suggested_category, "free_with_purchase")
        self.assertEqual(c("FREE Cereal After Rebate").suggested_category, "free_with_purchase")
        self.assertEqual(c("FREE Ice Cream After Walmart Cash").suggested_category, "free_with_purchase")

    def test_trial(self):
        self.assertEqual(c("Get a FREE Trial of Audible").suggested_category, "free_trial")
        self.assertEqual(c("Kindle Unlimited: 3 months free").suggested_category, "free_trial")

    def test_dropped_items_get_no_category(self):
        self.assertIsNone(c("50% Off Everything").suggested_category)


if __name__ == "__main__":
    unittest.main()
