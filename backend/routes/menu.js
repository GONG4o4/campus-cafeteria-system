
const express = require("express");
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { getBestSellers, BEST_SELLER_DAYS } = require("../services/bestSellers");

const router = express.Router();


const parseMenuId = (value) => {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id) && id <= 2147483647
        ? id
        : null;
};

// image_url is optional. An empty string is saved as NULL.
const cleanImageUrl = (value) => {
    if (typeof value === "string") {
        return value.trim() || null;
    }

    return value;
};

const isValidImageUrl = (value) => {
    if (value === null) {
        return true;
    }

    if (typeof value !== "string" || value.length > 500) {
        return false;
    }

    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};


router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM menu_items ORDER BY menu_item_id ASC"
        );

        return res.status(200).json(result.rows);

    } catch (error) {
        console.error("Failed to retrieve menu items:", error.message);

        return res.status(500).json({
            message: "Failed to retrieve menu items"
        });
    }
});


// Top 10 best sellers for the customer menu's Best Seller badge.
// Public like GET /, and read-only.
// Must stay above "/:id" so "best-sellers" is not read as a menu item ID.
router.get("/best-sellers", async (req, res) => {
    try {
        const items = await getBestSellers(pool);

        return res.status(200).json({
            items,
            period: {
                type: "rolling_days",
                days: BEST_SELLER_DAYS
            }
        });
    } catch (error) {
        console.error("Failed to load best sellers:", error.message);

        return res.status(500).json({
            message: "Failed to load best sellers"
        });
    }
});

router.get("/:id", async (req, res) => {
    const id = parseMenuId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            message: "Invalid menu item ID"
        });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM menu_items WHERE menu_item_id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Menu item not found"
            });
        }

        return res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error("Failed to retrieve menu item:", error.message);

        return res.status(500).json({
            message: "Failed to retrieve menu item"
        });
    }
});

router.post("/", authenticateToken, requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const {
        name,
        description = null,
        price,
        is_available = true,
        image_url = null
    } = req.body || {};

    const imageUrl = cleanImageUrl(image_url);


    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        (description !== null && typeof description !== "string") ||
        typeof is_available !== "boolean" ||
        !["string", "number"].includes(typeof price) ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(String(price)) ||
        !isValidImageUrl(imageUrl)
    ) {
        return res.status(400).json({
            message: "Invalid menu item information"
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO menu_items
             (name, description, price, is_available, image_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                name.trim(),
                description,
                String(price),
                is_available,
                imageUrl
            ]
        );

        return res.status(201).json({
            message: "Menu item created successfully",
            item: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to create menu item:", error.message);

        return res.status(500).json({
            message: "Failed to create menu item"
        });
    }
});



router.put("/:id", authenticateToken, requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const id = parseMenuId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            message: "Invalid menu item ID"
        });
    }

    const {
        name,
        description = null,
        price,
        is_available = true,
        image_url = null
    } = req.body || {};

    const imageUrl = cleanImageUrl(image_url);

    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        (description !== null && typeof description !== "string") ||
        typeof is_available !== "boolean" ||
        !["string", "number"].includes(typeof price) ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(String(price)) ||
        !isValidImageUrl(imageUrl)
    ) {
        return res.status(400).json({
            message: "Invalid menu item information"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE menu_items
             SET name = $1,
                 description = $2,
                 price = $3,
                 is_available = $4,
                 image_url = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE menu_item_id = $6
             RETURNING *`,
            [
                name.trim(),
                description,
                String(price),
                is_available,
                imageUrl,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Menu item not found"
            });
        }

        return res.status(200).json({
            message: "Menu item updated successfully",
            item: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to update menu item:", error.message);

        return res.status(500).json({
            message: "Failed to update menu item"
        });
    }
});

// Staff choose which meals show up as "Featured" on the menu and home page.
// Body: { "is_featured": true } or { "is_featured": false }
router.patch("/:id/featured", authenticateToken, requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const id = parseMenuId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            message: "Invalid menu item ID"
        });
    }

    const isFeatured = req.body ? req.body.is_featured : undefined;

    if (typeof isFeatured !== "boolean") {
        return res.status(400).json({
            message: "is_featured must be true or false"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE menu_items
             SET is_featured = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE menu_item_id = $2
             RETURNING *`,
            [isFeatured, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Menu item not found"
            });
        }

        return res.status(200).json({
            message: isFeatured ? "Meal is now featured" : "Meal is no longer featured",
            item: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to update featured meal:", error.message);

        return res.status(500).json({
            message: "Failed to update featured meal"
        });
    }
});

router.delete("/:id", authenticateToken, requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const id = parseMenuId(req.params.id);

    if (id === null) {
        return res.status(400).json({
            message: "Invalid menu item ID"
        });
    }

    try {
        const result = await pool.query(
            "DELETE FROM menu_items WHERE menu_item_id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Menu item not found"
            });
        }

        return res.status(200).json({
            message: "Menu item deleted successfully",
            item: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                message: "Cannot delete menu item because it is referenced by existing orders"
            });
        }

        console.error("Failed to delete menu item:", error.message);

        return res.status(500).json({
            message: "Failed to delete menu item"
        });
    }
});

module.exports = router;
