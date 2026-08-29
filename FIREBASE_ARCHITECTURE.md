# MOTVIN Firebase Architecture

This document provides a comprehensive overview of the Firebase integration for the MOTVIN application. It details the authentication flow, database structure, security rules, offline behavior, and the end-to-end data synchronization process between the client UI, LocalStorage, and Firebase Firestore.

## 1. Authentication Flow

MOTVIN uses Firebase Authentication to manage user identities, primarily supporting Google Sign-In and anonymous/guest flows.

*   **Initialization (`firebase-url-beta.js`)**: The app initializes Firebase Authentication (`firebase.auth()`) and immediately attaches an `onAuthStateChanged` listener.
*   **State Observation**: When a user signs in, their UID, email, and photo URL are cached locally. The app enters a "signed-in" state.
*   **Permissions**: Until the user signs in, any attempt to save palettes or typefaces triggers a "Sign in required" toast. 

## 2. Database Structure (Firestore)

The Firestore database is strictly scoped by User ID (`uid`) to ensure data privacy. The primary data models are:

### User Collections (`/users/{userId}/collections/{collectionType}`)
This path stores the user's saved palettes and typefaces.
*   `userId`: The Firebase Authentication UID of the user.
*   `collectionType`: String literal for the type of data, currently `"palettes"` or `"typefaces"`.
*   **Document Structure**:
    ```json
    {
      "uid": "USER_UID",
      "updatedAtMs": 1718049281000,
      "entries": [
        {
          "name": "My Palette",
          "kind": "palette",
          "savedAt": 1718049281000,
          "snapshot": { /* Palette Data */ }
        }
      ]
    }
    ```

### URL Beta Credits (`/urlBetaDailyCredits/{docId}`)
Manages daily usage limits for specific tools (like URL parsing).
*   **Document Structure**:
    ```json
    {
      "uid": "USER_UID",
      "day": "2024-06-10",
      "used": 15,
      "limit": 50,
      "lastUpdatedMs": 1718049281000
    }
    ```

## 3. Security Rules (`firestore.rules`)

Firebase Security Rules form the backbone of the application's data security. They guarantee that users can never access or modify data belonging to anyone else.

*   **Strict UID Matching**: Read, Create, Update, and Delete operations on `/users/{userId}/collections/{collectionType}` are strictly gated by `request.auth.uid == userId`.
*   **Payload Validation**: When creating or updating a collection, the rules enforce that the `uid` inside the document payload matches the authenticated user (`request.resource.data.uid == userId`) and that `entries` is a valid list.
*   **Credit Protections**: Daily credits can only be incremented by 1 at a time (`request.resource.data.used <= resource.data.used + 1`) and cannot exceed the defined daily limit, preventing malicious abuse of the quota system.

## 4. Data Flow & Synchronization

The system employs an "Offline-First / Optimistic UI" syncing strategy. 

### LocalStorage (Cache & UI Speed)
*   When a user clicks "Save" (e.g., in `styles.html` or `typeface.html`), the app **immediately** writes the new entry to browser `LocalStorage`.
*   This triggers a custom `motvin:history-storage-change` event, instantly updating the UI (like the History Sidebar) without waiting for a network request.

### Cloud Synchronization (`app.js` & `firebase-url-beta.js`)
*   Immediately after the LocalStorage update, the app calls `saveCollectionToCloud("palettes", collection)`.
*   **Offline Check**: If `!navigator.onLine`, a 500ms delayed error toast alerts the user that they are offline ("Cannot sync to cloud. Please check your connection.").
*   **Network Request**: If online, `saveUserCollection` pushes the entire array to the user's specific Firestore document, overwriting the old array.

### Restoration on Login
*   Upon detecting an authentication state change (user logs in), `syncFirestoreToLocal()` is triggered.
*   It fetches `"palettes"` and `"typefaces"` from Firestore.
*   If cloud data is found, it overwrites the `LocalStorage` cache.
*   A 15-second "lock" prevents accidental overriding of newly downloaded data by local saves immediately after login.
*   UI elements are re-rendered to display the user's previously saved cloud data.

## 5. Component Relationships

*   **`firebase-url-beta.js`**: The low-level database wrapper. Handles all direct calls to `firebase.firestore()`. Exports `saveUserCollection`, `loadUserCollection`, and credit methods.
*   **`app.js`**: The orchestration layer. Listens for auth changes, handles the `syncFirestoreToLocal` login flow, and provides the `saveCollectionToCloud` wrappers that bridge UI saves to Firestore.
*   **`styles.html` / `typeface.html`**: The presentation layer. Contains the localized UI logic for saving. They trigger local `savePaletteCollection` or `saveTypefaceCollection` functions, which write to LocalStorage, update the UI, and delegate the cloud sync to `app.js` (or handle it directly, with localized offline toast intercepts).

## 6. Offline Error Handling

To provide clear feedback, offline actions are intercepted locally:
1.  **Direct Interception (`styles.html` & `typeface.html`)**: If a user is offline and clicks "Save", the local `showToast` or `showTypefaceToast` function intercepts the standard "Saved" success toast.
2.  **Replacement**: It rewrites the toast to an error: `Title: "You are offline"`, `Message: "Cannot sync to cloud. Please check your connection."`, `State: "error"`.
3.  **App Level (`app.js`)**: `saveCollectionToCloud` also executes a `navigator.onLine` check to ensure no silent failures occur if the UI intercept misses it.

## 7. Security Summary
- **Data Isolation**: Verified. Users only read/write their own UID partitions.
- **Client Restrictions**: Verified. Firestore rules prevent arbitrary schema injection (e.g., enforcing `entries` as a list).
- **Authentication**: Verified. Cloud sync immediately halts and warns the user if `auth.currentUser` is null.
