import { dbAdmin } from "./firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

interface CategoryData {
    name: string;
    slug: string;
    postCount: number;
    lastPostAt: any; // Timestamp
    enabled: boolean;
}

export class CategoryService {
    private static COLLECTION = "categories";

    /**
     * Ensures consistent slug generation
     */
    static getSlug(name: string): string {
        return name.toLowerCase().trim().replace(/\s+/g, '-');
    }

    /**
     * Increment category count atomically.
     * Can be used within an existing transaction or standalone.
     */
    static async incrementCategoryCount(categoryName: string, transaction?: Transaction): Promise<void> {
        if (!categoryName) return;
        const slug = this.getSlug(categoryName);
        const ref = dbAdmin.collection(this.COLLECTION).doc(slug);

        const updateFn = (t: Transaction) => {
            return t.get(ref).then((doc) => {
                if (!doc.exists) {
                    // Create new category if it doesn't exist
                    t.set(ref, {
                        name: categoryName,
                        slug: slug,
                        postCount: 1,
                        lastPostAt: FieldValue.serverTimestamp(),
                        enabled: true
                    });
                } else {
                    // Atomically increment
                    t.update(ref, {
                        postCount: FieldValue.increment(1),
                        lastPostAt: FieldValue.serverTimestamp()
                    });
                }
            });
        };

        if (transaction) {
            await updateFn(transaction);
        } else {
            await dbAdmin.runTransaction(updateFn);
        }
    }

    /**
     * Decrement category count atomically.
     * Ensures count never goes below 0.
     */
    static async decrementCategoryCount(categoryName: string, transaction?: Transaction): Promise<void> {
        if (!categoryName) return;
        const slug = this.getSlug(categoryName);
        const ref = dbAdmin.collection(this.COLLECTION).doc(slug);

        const updateFn = async (t: Transaction) => {
            const doc = await t.get(ref);
            if (!doc.exists) return; // Nothing to decrement

            const data = doc.data() as CategoryData;
            const newCount = Math.max(0, (data.postCount || 0) - 1);

            t.update(ref, {
                postCount: newCount
            });
        };

        if (transaction) {
            await updateFn(transaction);
        } else {
            await dbAdmin.runTransaction(updateFn);
        }
    }

    /**
     * Get all categories (Admin)
     */
    static async getAllCategories(): Promise<CategoryData[]> {
        const snap = await dbAdmin.collection(this.COLLECTION).get();
        return snap.docs.map(d => d.data() as CategoryData);
    }

    /**
     * Get active categories (App)
     * Only enabled ones with posts > 0
     */
    static async getActiveCategories(): Promise<CategoryData[]> {
        const snap = await dbAdmin.collection(this.COLLECTION)
            .where("enabled", "==", true)
            .where("postCount", ">", 0)
            .orderBy("postCount", "desc") // Show popular first? or maybe just verify index later
            .get();

        return snap.docs.map(d => d.data() as CategoryData);
    }
}
