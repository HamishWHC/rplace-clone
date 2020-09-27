import * as functions from 'firebase-functions';
import * as admin from "firebase-admin"

admin.initializeApp();
const db = admin.firestore();

// export const updateUserTimestampOnPlace = functions.firestore.document("pixels/{pixelId}").onWrite((_change, context) => {
//     if (context.eventType === "google.firestore.document.delete") return

//     db.collection("users").doc(context.auth!.uid).set({
//         lastPlacementTimestamp: context.timestamp
//     })
// })

export const updatePixelHistory = functions.firestore.document("pixels/{pixelId}").onWrite((change, context) => {
    if (context.eventType === "google.firestore.document.delete") {
        console.log(`Deleting history for pixel: ${change.before.id}`)
        deleteCollection(db, change.before.ref.collection("history"), "placementTime", "asc", 100)
    } else {
        console.log(`Adding history entry for pixel: ${change.before.id}`)
        change.before.ref.collection("history").doc(context.eventId).set(change.after.data()!)
    }
})

async function deleteCollection(
    db: FirebaseFirestore.Firestore,
    collectionRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
    orderByField: string,
    orderByDirection: "asc" | "desc",
    batchSize: number
) {
    const query = collectionRef.orderBy(orderByField, orderByDirection).limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>, resolve: (value?: unknown) => void) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}