import { dbAdmin } from "./firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

interface CategoryData {
    id: string; // Internal ID
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
     * Ensures a category exists by Name/Slug.
     * Returns the Category ID (Auto-generated).
     * 
     * Strategy:
     * 1. Check if doc exists with `slug` == generatedSlug.
     * 2. If yes, return its ID.
     * 3. If no, create NEW doc with Auto-ID.
     */
    static async ensureCategory(name: string): Promise<{ id: string, slug: string, name: string }> {
        if (!name) throw new Error("Category name required");

        const slug = this.getSlug(name);
        const colRef = dbAdmin.collection(this.COLLECTION);

        // 1. Check existence by Querying Slug
        // Note: This relies on slug uniqueness.
        const snapshot = await colRef.where("slug", "==", slug).limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, slug, name: doc.data().name || name };
        }

        // 2. Create if missing
        // Requires Auto-ID
        const newDocRef = colRef.doc(); // Auto-ID
        await newDocRef.set({
            name: name,
            slug: slug,
            // Initializing with 0, explicit increment required
            postCount: 0,
            lastPostAt: null,
            enabled: true,
            created_at: FieldValue.serverTimestamp()
        });

        return { id: newDocRef.id, slug, name };
    }

    /**
     * Increment category count atomically by ID.
     */
    static async incrementCategoryCount(categoryId: string, transaction?: Transaction): Promise<void> {
        if (!categoryId) return;
        const ref = dbAdmin.collection(this.COLLECTION).doc(categoryId);

        const updateFn = (t: Transaction) => {
            return t.get(ref).then((doc) => {
                if (!doc.exists) {
                    // Start at 1 if somehow missing (Edge case for racing ensure?)
                    // If ensure wasn't called, this might fail or we blindly set it?
                    // Safer to expect existence if we passed ID.
                    console.warn(`Category ${categoryId} missing during increment.`);
                    // Fallback?? NO, we rely on ID.
                    return;
                }

                t.update(ref, {
                    postCount: FieldValue.increment(1),
                    lastPostAt: FieldValue.serverTimestamp()
                });
            });
        };

        if (transaction) {
            await updateFn(transaction);
        } else {
            await dbAdmin.runTransaction(updateFn);
        }
    }

    /**
     * Decrement category count atomically by ID.
     */
    static async decrementCategoryCount(categoryId: string, transaction?: Transaction): Promise<void> {
        if (!categoryId) return;
        const ref = dbAdmin.collection(this.COLLECTION).doc(categoryId);

        const updateFn = async (t: Transaction) => {
            const doc = await t.get(ref);
            if (!doc.exists) return;

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
        return snap.docs.map(d => ({ ...(d.data() as Omit<CategoryData, 'id'>), id: d.id }));
    }

    /**
     * Get active categories (App)
     */
    static async getActiveCategories(): Promise<CategoryData[]> {
        const snap = await dbAdmin.collection(this.COLLECTION)
            .where("enabled", "==", true)
            .where("postCount", ">", 0)
            .orderBy("postCount", "desc")
            .get();

        return snap.docs.map(d => ({ ...(d.data() as Omit<CategoryData, 'id'>), id: d.id }));
    }
}
