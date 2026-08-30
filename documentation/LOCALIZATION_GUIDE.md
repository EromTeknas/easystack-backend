# Easystack Localization Guide

This document serves as the central source of truth for how Easystack validates JSON feeds, how users select specific paths for translation using wildcards, and how the platform tracks translation lifecycles across multiple languages.

---

## 1. JSON Structural Validation Rules

Before a feed is saved or localized, the backend enforces a rigid set of structural requirements. The frontend editor must also enforce these rules to provide immediate feedback.

1. **Object Root**: The root of the JSON payload must be a valid JSON Object `{}`.
2. **Not Empty**: The root object must contain at least one key-value pair.
3. **No Empty Keys**: Keys cannot be empty strings `""` or consist entirely of whitespace.
4. **No Dot Notation in Keys**: Keys cannot contain the `.` character (e.g., `"user.name"` is invalid). This is to prevent conflicts with our path selection system.
5. **Max Depth (10)**: The JSON tree cannot exceed 10 levels of nesting.
6. **No 2D Arrays**: Arrays cannot contain other arrays (e.g., `[[1, 2], [3, 4]]` is strictly forbidden).
7. **Strict Array Homogeneity**:
   - Arrays of primitives must be 100% homogenous (e.g., all strings or all numbers).
   - Arrays of objects must contain objects with the **exact same shape** (identical keys).
   - *Example of Invalid Array*: `[ { "id": 1, "name": "Apple" }, { "id": 2 } ]` (The second object is missing the `name` key).

---

## 2. Localization Selection & Wildcard Logic (`selectedKeys`)

Users don't always want to translate an entire JSON file. By providing an array of `selectedKeys`, the backend will only translate specific paths.

Because we enforce **Strict Array Homogeneity**, array items are collapsed into a single generic schema using the `*` wildcard.

### Wildcard Syntax Rules
* **Basic Fields (Dot Notation)**: For top-level fields or nested objects, separate the keys with a dot. (e.g., `"address.street"`)
* **Arrays of Objects**: Replace the array index with `*`. This tells the backend to iterate over *every* object in the list and target that specific property. (e.g., `"items.*.name"`)
* **Arrays of Primitives**: Point the wildcard directly at the array to translate every string inside it. (e.g., `"tags.*"`)

### Complete JSON Example
**Input JSON:**
```json
{
  "title": "Welcome",
  "settings": {
    "theme": "dark",
    "description": "App settings"
  },
  "tags": ["organic", "fresh"],
  "products": [
    { "id": 1, "name": "Apple", "price": 10 },
    { "id": 2, "name": "Orange", "price": 15 }
  ]
}
```

**Valid `selectedKeys` Payload:**
If you want to translate the title, the description, all tags, and just the name of every product:
```json
"selectedKeys": [
  "title",
  "settings.description",
  "tags.*",
  "products.*.name"
]
```

---

## 3. The Translation Lifecycle (Per-Language)

When a JSON payload is submitted, it is dispatched to background workers for translation. Each targeted language goes through a specific lifecycle, tracked in the database as a `FeedLocalization`.

1. **`UNTRANSLATED`** (Dynamic): A new language was added to the project settings, but the feed hasn't been queued for translation in that language yet.
2. **`PENDING`**: The translation job has been successfully created in the Redis queue, waiting for an available worker.
3. **`PROCESSING`**: A worker has picked up the job and is currently translating the JSON via the LLM provider.
4. **`COMPLETED`**: The translated JSON was successfully returned and saved permanently to the database.
5. **`FAILED`**: The translation failed permanently (e.g., invalid JSON schema returned) or exhausted all retry attempts (e.g., persistent rate limits).

---

## 4. Aggregated Status Logic (Overall Feed Progress)

Because a single feed can be translating into 10 different languages simultaneously, the backend computes a single **Aggregate Status** to represent the feed's overall progress. 

This aggregate status follows a strict execution priority, evaluated in this exact order:

1. **`TRANSLATING` (Highest Priority)**: If *any* target language is currently `PROCESSING` or `PENDING`, the feed is marked as `TRANSLATING`—regardless of failures or completed languages.
2. **`FAILED`**: If no languages are currently translating, but at least one language has `FAILED`.
3. **`PARTIALLY_COMPLETED`**: If no languages are translating or failed, but at least one language is missing/`UNTRANSLATED`.
4. **`COMPLETED`**: Every single language configured in the project has successfully finished translating.

*(Note: The Feed's base language—e.g., English—is inherently considered `COMPLETED` and does not impact the aggregate priority logic).*
